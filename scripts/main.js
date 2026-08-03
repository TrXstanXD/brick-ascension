// ============================================================
// MAIN.JS - Entry point and bootstrapper
// ============================================================
window.Game = window.Game || {};

function boot() {
  console.warn('[DEBUG Main] Boot sequence started...');
  
  if (Game.State && typeof Game.State.init === 'function') {
    Game.State.init();
  }

  if (Game.Engine && typeof Game.Engine.init === 'function') {
    Game.Engine.init();
  }

  if (Game.UI && typeof Game.UI.init === 'function') {
    Game.UI.init();
  }

  // Report offline earnings, if any, now that the UI can show a toast.
  if (Game.State && typeof Game.State.consumeOfflineReport === 'function' && Game.UI) {
    const report = Game.State.consumeOfflineReport();
    if (report && report.gained > 0) {
      const timeAway = Game.Util.fmtTime(report.awaySeconds);
      const cappedNote = report.wasCapped
        ? ` (capped at ${Game.Util.fmtTime(report.cappedSeconds)} — upgrade Chrono Cache to raise the cap)`
        : '';
      Game.UI.showToast('WELCOME BACK', `You were away for ${timeAway} and earned ${Game.Util.fmt(report.gained)}g${cappedNote}.`, true);
    }
  }

  // Make sure lastSaveTime is as accurate as possible for the next offline calc.
  window.addEventListener('beforeunload', () => Game.State?.save());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') Game.State?.save();
  });

  console.warn('[DEBUG Main] Boot sequence completed successfully.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
