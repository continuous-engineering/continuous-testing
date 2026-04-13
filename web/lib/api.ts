import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export type ApiResponse<T> = { data: T } | { error: string }

export function ok<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ data }, { status })
}

export function err(message: string, status = 400): NextResponse<ApiResponse<never>> {
  return NextResponse.json({ error: message }, { status })
}

export function handleError(e: unknown): NextResponse<ApiResponse<never>> {
  if (e instanceof ZodError) {
    return err(e.errors.map((x) => x.message).join(', '), 422)
  }
  if (e instanceof Error) {
    if (e.message === 'Unauthenticated') return err('Unauthenticated', 401)
    if (e.message === 'No organization selected') return err('No organization selected', 403)
    if (e.message === 'Not found') return err('Not found', 404)
  }
  console.error(e)
  return err('Internal server error', 500)
}

/** Wrap route handler with standard error handling */
export function withErrorHandling<T>(
  fn: () => Promise<NextResponse<ApiResponse<T>>>,
): Promise<NextResponse<ApiResponse<T>>> {
  return fn().catch(handleError)
}
