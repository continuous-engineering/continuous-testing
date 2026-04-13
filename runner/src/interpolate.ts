export function interpolate(
  value: unknown,
  ctx: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Record<string, string>,
): unknown {
  if (typeof value === 'string') {
    return value.replace(/\{\{(ctx|env|secrets)\.([^}]+)\}\}/g, (_, ns: string, key: string) => {
      if (ns === 'ctx')     return String(ctx[key]     ?? '')
      if (ns === 'env')     return String(env[key]     ?? '')
      if (ns === 'secrets') return String(secrets[key] ?? '')
      return ''
    })
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, ctx, env, secrets))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k, interpolate(v, ctx, env, secrets),
      ]),
    )
  }
  return value
}

export function extractPath(obj: unknown, path: string): unknown {
  const clean = path.startsWith('$.') ? path.slice(2) : path
  let cur: unknown = obj
  for (const part of clean.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}
