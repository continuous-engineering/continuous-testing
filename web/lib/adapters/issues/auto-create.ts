/**
 * Auto-create or reopen issues on test failure.
 * Dedup key: {pipelineId}:{stepId} — same step failing again = same issue.
 * If previously resolved and now failing again = regression → reopen + log.
 */
import pool from '@/lib/db/client'
import { readFileSync } from 'fs'
import { join } from 'path'

function sqlFile(name: string) {
  return readFileSync(join(process.cwd(), 'lib', 'queries', `${name}.sql`), 'utf-8')
}

type FailedStep = {
  stepId:       string
  stepName:     string
  stepType:     string
  pipelineId:   string
  pipelineName: string
  projectId:    string
  errorMessage: string | null
  failedAssertions: { name: string; expected: unknown; actual: unknown }[]
}

export async function autoCreateIssue(
  tenantId: string,
  runId:    string,
  step:     FailedStep,
): Promise<{ issueId: string; isRegression: boolean } | null> {
  const dedupKey = `${step.pipelineId}:${step.stepId}`

  const title = `[${step.stepType.toUpperCase()}] ${step.stepName} failed`
  const description = [
    `**Pipeline:** ${step.pipelineName}`,
    step.errorMessage ? `**Error:** ${step.errorMessage}` : null,
    step.failedAssertions.length > 0
      ? `**Failed assertions:**\n${step.failedAssertions.map((a) => `- ${a.name}: expected ${JSON.stringify(a.expected)}, got ${JSON.stringify(a.actual)}`).join('\n')}`
      : null,
    `**Run:** ${runId}`,
  ].filter(Boolean).join('\n\n')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL app.tenant_id = '${tenantId}'`)

    const { rows } = await client.query(sqlFile('issues/create'), [
      step.projectId, title, description, 'medium', runId, step.stepId, dedupKey,
    ])

    const issue = rows[0] as { id: string; status: string; is_new: boolean } | undefined
    if (!issue) return null

    await client.query('COMMIT')
    return { issueId: issue.id, isRegression: !issue.is_new }
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('[auto-issue] failed:', e)
    return null
  } finally {
    client.release()
  }
}
