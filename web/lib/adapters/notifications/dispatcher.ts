/**
 * Notification dispatcher.
 * Reads pipeline notification config, dispatches to registered adapters.
 * Throttle: max 1 notification per pipeline per event per hour.
 *
 * Config stored in pipeline metadata (JSONB column — no separate table needed).
 * Example pipeline notification config:
 * {
 *   "notifications": {
 *     "on": ["run_failed", "regression_detected"],
 *     "channels": [
 *       { "type": "slack", "webhookUrl": "...", "channel": "#qa-alerts" },
 *       { "type": "webhook", "url": "...", "headers": {} }
 *     ],
 *     "throttleHours": 1
 *   }
 * }
 */
import { SlackAdapter }   from './slack'
import { WebhookAdapter } from './webhook'
import type { NotificationAdapter, NotificationEvent, NotificationPayload } from './base'

// In-process throttle map: "tenantId:pipelineId:event" → last sent timestamp
const throttleMap = new Map<string, number>()

type ChannelConfig =
  | { type: 'slack';   webhookUrl: string; channel?: string }
  | { type: 'webhook'; url: string; headers?: Record<string, string> }

type NotificationConfig = {
  on:           NotificationEvent[]
  channels:     ChannelConfig[]
  throttleHours?: number
}

function makeAdapter(ch: ChannelConfig): NotificationAdapter {
  switch (ch.type) {
    case 'slack':   return new SlackAdapter(ch.webhookUrl, ch.channel)
    case 'webhook': return new WebhookAdapter(ch.url, ch.headers)
  }
}

export async function dispatch(
  event: NotificationEvent,
  payload: NotificationPayload,
  config: NotificationConfig | null | undefined,
): Promise<void> {
  if (!config) return
  if (!config.on.includes(event)) return

  const throttleKey = `${payload.tenantId}:${payload.runId}:${event}`
  const throttleMs  = (config.throttleHours ?? 1) * 3_600_000
  const lastSent    = throttleMap.get(throttleKey) ?? 0

  if (Date.now() - lastSent < throttleMs) return  // throttled
  throttleMap.set(throttleKey, Date.now())

  await Promise.allSettled(
    config.channels.map((ch) => makeAdapter(ch).send(payload)),
  )
}
