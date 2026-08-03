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

  console.warn('[DEBUG Main] Boot sequence completed successfully.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
