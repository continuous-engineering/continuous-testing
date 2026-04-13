import type { NotificationAdapter, NotificationPayload } from './base'

export class WebhookAdapter implements NotificationAdapter {
  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    const res = await fetch(this.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.headers },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error(`Webhook failed: ${res.status} ${await res.text()}`)
  }
}
