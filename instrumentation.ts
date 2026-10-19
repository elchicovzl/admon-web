/**
 * Next.js instrumentation hook: runs once when the server starts.
 *
 * Validates the WhatsApp runtime config (a throw aborts startup) and starts the
 * pg-boss workers. It does nothing on the edge runtime or during `next build`,
 * which runs without secrets.
 */
export async function register() {
  // The literal `=== "nodejs"` check must wrap the import: Next replaces
  // NEXT_RUNTIME at compile time, so the edge bundle drops the Node-only graph.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NEXT_PHASE === "phase-production-build") return

    const { bootstrapRuntime } = await import("./lib/queue/bootstrap")
    await bootstrapRuntime()
  }
}
