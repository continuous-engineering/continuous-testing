/**
 * In-process SSE pub/sub for run events.
 * Single Next.js instance: Map is sufficient.
 * Multi-instance deployment: replace with Redis pub/sub.
 */

type Emitter = (data: string) => void

const runListeners = new Map<string, Emitter[]>()

export function subscribeToRun(runId: string, emit: Emitter): () => void {
  const list = runListeners.get(runId) ?? []
  list.push(emit)
  runListeners.set(runId, list)
  return () => {
    runListeners.set(runId, (runListeners.get(runId) ?? []).filter((e) => e !== emit))
  }
}

export function emitRunEvent(runId: string, event: object): void {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const emit of runListeners.get(runId) ?? []) {
    try { emit(data) } catch { /* client disconnected */ }
  }
}
