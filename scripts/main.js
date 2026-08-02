// ============================================================
// MAIN.JS - Bootstraps the game once the DOM is ready
// ============================================================
(function () {
  function boot() {
    Game.State.init();
    const offlineResult = Game._offlineResult || null;
    Game.Engine.init(document.getElementById('game-canvas'));
    Game.UI.init();
    Game.Engine.start();
    if (offlineResult) Game.UI.reportOffline(offlineResult);
  }

  // capture offline progress result before UI mounts (State.init already applied it)
  const origInit = Game.State.applyOfflineProgress;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
