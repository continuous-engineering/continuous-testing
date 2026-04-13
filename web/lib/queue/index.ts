import { Queue, Worker, QueueEvents } from 'bullmq'
import { Redis } from 'ioredis'

// ─── Redis connection ─────────────────────────────────────────────────────────
// Shared connection — BullMQ requires separate instances for Queue vs Worker
function makeRedis() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'
  return new Redis(url, { maxRetriesPerRequest: null })
}

// ─── Job type definitions ─────────────────────────────────────────────────────

export type RunDagJob = {
  type: 'run_dag'
  runId: string
  tenantId: string
  pipelineId: string
  environmentId: string | null
  requiredTags: string[]
}

export type SyncIssueJob = {
  type: 'sync_issues'
  tenantId: string
  adapter: 'jira' | 'github' | 'linear'
}

export type SendNotificationJob = {
  type: 'send_notification'
  tenantId: string
  event: string
  payload: Record<string, unknown>
}

export type JobPayload = RunDagJob | SyncIssueJob | SendNotificationJob

// ─── Queue instances ──────────────────────────────────────────────────────────

const QUEUE_NAME = 'ct-jobs'

let _queue: Queue<JobPayload> | null = null
let _queueEvents: QueueEvents | null = null

export function getQueue(): Queue<JobPayload> {
  if (!_queue) {
    _queue = new Queue<JobPayload>(QUEUE_NAME, {
      connection: makeRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail:    { count: 5000 },
      },
    })
  }
  return _queue
}

export function getQueueEvents(): QueueEvents {
  if (!_queueEvents) {
    _queueEvents = new QueueEvents(QUEUE_NAME, { connection: makeRedis() })
  }
  return _queueEvents
}

// ─── Job enqueue helpers ──────────────────────────────────────────────────────

export async function enqueueRunDag(job: Omit<RunDagJob, 'type'>): Promise<string> {
  const q = getQueue()
  const j = await q.add('run_dag', { type: 'run_dag', ...job }, { priority: 1 })
  return j.id!
}

export async function enqueueSyncIssues(tenantId: string, adapter: SyncIssueJob['adapter']): Promise<void> {
  await getQueue().add('sync_issues', { type: 'sync_issues', tenantId, adapter }, { priority: 5 })
}

export async function enqueueNotification(
  tenantId: string, event: string, payload: Record<string, unknown>,
): Promise<void> {
  await getQueue().add('send_notification', { type: 'send_notification', tenantId, event, payload }, { priority: 10 })
}
