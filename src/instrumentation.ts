export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startSweeper } = await import("./lib/retention");
    startSweeper();
    const { startMusicRefresher } = await import("./lib/music-library");
    startMusicRefresher();
  }
}
