/**
 * Structured error capture. Deliberately not wired to @sentry/nextjs's SDK directly:
 * that package's build-time webpack plugin needs verifying against a real `next build`,
 * which wasn't possible to test in the environment this was written in. This gives you
 * real, greppable/alertable structured error logs today (most hosts — Railway, Fly,
 * Render — capture stdout/stderr and can alert on patterns in it), with a clean seam to
 * drop in a real APM later: every call site uses `captureError`, so upgrading means
 * changing the inside of this one function, not every call site.
 *
 * To upgrade to Sentry: `npm install @sentry/nextjs && npx @sentry/wizard@latest -i nextjs`,
 * then replace the body of `captureError` with `Sentry.captureException(error, { extra: context })`.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const payload = {
    level: "error",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context,
    timestamp: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}
