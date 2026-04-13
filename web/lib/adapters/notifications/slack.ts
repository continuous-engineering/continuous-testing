import type { NotificationAdapter, NotificationPayload } from './base'

export class SlackAdapter implements NotificationAdapter {
  constructor(private readonly webhookUrl: string, private readonly channel?: string) {}

  async send(p: NotificationPayload): Promise<void> {
    const icon = p.summary.failed > 0 ? '🔴' : '✅'
    const color = p.summary.failed > 0 ? '#f43f5e' : '#10b981'

    const body = {
      ...(this.channel ? { channel: this.channel } : {}),
      attachments: [{
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${icon} *${p.pipelineName}* — ${p.event.replace('_', ' ')}`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Project*\n${p.projectName}` },
              { type: 'mrkdwn', text: `*Steps*\n${p.summary.passed}/${p.summary.total} passed` },
            ],
          },
          {
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'View run' },
              url: p.runUrl,
            }],
          },
        ],
      }],
    }

    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) throw new Error(`Slack webhook failed: ${res.status}`)
  }
}
