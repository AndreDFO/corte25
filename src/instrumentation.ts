export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSweeper } = await import("./lib/retention");
    startSweeper();
    // Lotes que estavam no meio quando o servidor reiniciou: recomeça (ou devolve o saldo).
    const { resumeStuckJobs } = await import("./lib/engine");
    setTimeout(() => resumeStuckJobs().catch((e) => console.error("[retomar]", e)), 5000).unref?.();
  }
}
