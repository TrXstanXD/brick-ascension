// ============================================================
// UI.JS - Tab management, arsenal, upgrades, achievements & stats tabs
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {
  let activeTab = 'balls';

  function formatNum(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (n < 1000) return Math.floor(n).toLocaleString();
    const suffixes = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi'];
    const i = Math.floor(Math.log10(n) / 3);
    if (i >= suffixes.length) return n.toExponential(2);
    const formatted = (n / Math.pow(10, i * 3)).toFixed(2);
    return formatted + suffixes[i];
  }

  function init() {
    setupTabs();
    bindEvents();
    renderHeader();
    renderActiveTab();

    // Auto refresh UI loop
    setInterval(() => {
      renderHeader();
      renderActiveTab();
    }, 200);
  }

  function setupTabs() {
    const navButtons = document.querySelectorAll('.tab-btn, [data-tab]');
    navButtons.forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const target = btn.getAttribute('data-tab') || btn.innerText.toLowerCase().trim();
        if (['balls', 'upgrades', 'ascend', 'achievements', 'stats', 'settings'].includes(target)) {
          activeTab = target;
          navButtons.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          renderActiveTab();
        }
      });
    });
  }

  function bindEvents() {
    // Delegated click handler for arsenal buttons
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.getAttribute('data-action');
      const id = target.getAttribute('data-id');

      if (action === 'buy-dmg') {
        if (Game.State.buyBallDmgUpgrade(id)) Game.Engine?.SFX?.upgrade();
      } else if (action === 'buy-count') {
        if (Game.State.buyBallCountUpgrade(id)) Game.Engine?.SFX?.upgrade();
      } else if (action === 'unlock-ball') {
        if (Game.State.unlockBall(id)) Game.Engine?.SFX?.upgrade();
      }
      renderHeader();
      renderActiveTab();
    });
  }

  function renderHeader() {
    const s = Game.State.get();
    const elGold = document.querySelector('#gold-display, .stat-gold');
    const elDiamonds = document.querySelector('#diamond-display, .stat-diamonds');
    const elGps = document.querySelector('#gps-display, .stat-gps');
    const elLevel = document.querySelector('#level-display, .stat-level');

    if (elGold) elGold.textContent = formatNum(s.gold);
    if (elDiamonds) elDiamonds.textContent = formatNum(s.diamonds);
    if (elGps) elGps.textContent = formatNum(Game._lastGpsSample || 0) + '/s';
    if (elLevel) elLevel.textContent = 'Level ' + (s.level || 1);
  }

  function renderActiveTab() {
    const container = document.querySelector('#tab-content') || document.querySelector('.panel-content');
    if (!container) return;

    if (activeTab === 'balls') renderBalls(container);
    else if (activeTab === 'upgrades') renderUpgrades(container);
    else if (activeTab === 'achievements') renderAchievements(container);
    else if (activeTab === 'stats') renderStats(container);
    else if (activeTab === 'ascend') renderAscend(container);
    else if (activeTab === 'settings') renderSettings(container);
  }

  // --- ARSENAL / BALLS TAB ---
  function renderBalls(container) {
    const s = Game.State.get();
    const ballOrder = Game.BALL_ORDER || ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];

    let html = '<div class="ball-list" style="display:flex; flex-direction:column; gap:12px;">';

    ballOrder.forEach((id) => {
      const ball = s.balls[id] || { unlocked: false, level: 1, count: 0 };
      const def = Game.BALL_TYPES ? Game.BALL_TYPES[id] : { name: id, desc: '' };
      const currentDmg = Game.State.ballDamage(id);
      const dmgCost = Game.State.upgradeBallDmgCost(id);
      const countCost = Game.State.upgradeBallCountCost(id);
      const activeCount = Game.Engine?.getActiveBallCount ? Game.Engine.getActiveBallCount(id) : 0;

      if (ball.unlocked) {
        html += `
          <div class="card" style="background:#1e1e38; border:1px solid #2e2e54; padding:12px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:16px; color:#fff;">${def.name || id}</strong>
              <span style="font-size:12px; color:#aaa;">${activeCount}/${ball.count} active</span>
            </div>
            <p style="font-size:12px; color:#8a8ab0; margin:4px 0 8px 0;">${def.desc || ''}</p>
            <div style="font-size:13px; color:#ffd700; margin-bottom:8px;">
              Damage: <strong>${formatNum(currentDmg)}</strong> <span style="color:#6c757d;">(Lv.${ball.level})</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button data-action="buy-dmg" data-id="${id}" style="padding:6px 12px; background:#3b82f6; border:none; color:#fff; border-radius:4px; cursor:pointer;" ${s.gold < dmgCost ? 'disabled' : ''}>
                +DMG (${formatNum(dmgCost)}g)
              </button>
              <button data-action="buy-count" data-id="${id}" style="padding:6px 12px; background:#10b981; border:none; color:#fff; border-radius:4px; cursor:pointer;" ${s.gold < countCost ? 'disabled' : ''}>
                +COUNT (${formatNum(countCost)}g)
              </button>
            </div>
          </div>
        `;
      } else {
        const unlockCost = dmgCost * 5;
        html += `
          <div class="card locked" style="background:#141428; border:1px dashed #2e2e54; padding:12px; border-radius:8px; opacity:0.8;">
            <strong style="color:#aaa;">${def.name || id}</strong>
            <p style="font-size:12px; color:#6c757d; margin:4px 0 8px 0;">${def.desc || ''}</p>
            <button data-action="unlock-ball" data-id="${id}" style="padding:6px 12px; background:#8b5cf6; border:none; color:#fff; border-radius:4px; cursor:pointer;" ${s.gold < unlockCost ? 'disabled' : ''}>
              Unlock (${formatNum(unlockCost)}g)
            </button>
          </div>
        `;
      }
    });

    html += '</div>';
    container.innerHTML = html;
  }

  // --- UPGRADES TAB ---
  function renderUpgrades(container) {
    container.innerHTML = '<div style="padding:12px; color:#fff;">Global upgrades coming in next level!</div>';
  }

  // --- ACHIEVEMENTS TAB ---
  function renderAchievements(container) {
    const s = Game.State.get();
    const list = Game.ACHIEVEMENTS || [
      { id: 'first_brick', name: 'First Blood', desc: 'Destroy 1 brick' },
      { id: 'level_10', name: 'Getting Started', desc: 'Reach Level 10' },
      { id: 'gold_1k', name: 'Saver', desc: 'Earn 1,000 Total Gold' }
    ];

    let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
    list.forEach((ach) => {
      const unlocked = !!s.achievements[ach.id];
      html += `
        <div style="background:${unlocked ? '#1b2a26' : '#141428'}; border:1px solid ${unlocked ? '#10b981' : '#2e2e54'}; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <strong style="color:${unlocked ? '#10b981' : '#aaa'};">${ach.name}</strong>
            <div style="font-size:12px; color:#71717a;">${ach.desc}</div>
          </div>
          <span style="font-size:12px; font-weight:bold; color:${unlocked ? '#10b981' : '#52525b'};">
            ${unlocked ? '✓ UNLOCKED' : 'LOCKED'}
          </span>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // --- STATS TAB ---
  function renderStats(container) {
    const s = Game.State.get();
    const st = s.stats || {};

    container.innerHTML = `
      <div style="background:#1e1e38; border:1px solid #2e2e54; padding:16px; border-radius:8px; color:#fff;">
        <h3 style="margin-top:0; border-bottom:1px solid #2e2e54; padding-bottom:8px; color:#ffd700;">Lifetime Statistics</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:13px; margin-top:12px;">
          <div>Total Gold Earned: <strong style="color:#ffd700;">${formatNum(st.totalGoldEarned || 0)}</strong></div>
          <div>Bricks Destroyed: <strong>${formatNum(st.bricksDestroyed || 0)}</strong></div>
          <div>Bosses Killed: <strong>${formatNum(st.bossesKilled || 0)}</strong></div>
          <div>Treasure Bricks: <strong>${formatNum(st.treasureBricksDestroyed || 0)}</strong></div>
          <div>Balls Spawned: <strong>${formatNum(st.ballsSpawned || 0)}</strong></div>
          <div>Critical Hits: <strong>${formatNum(st.critHits || 0)}</strong></div>
          <div>Highest Hit Damage: <strong style="color:#ff5252;">${formatNum(st.biggestHit || 0)}</strong></div>
          <div>Time Played: <strong>${Math.floor((st.playTimeSec || 0) / 60)}m ${Math.floor((st.playTimeSec || 0) % 60)}s</strong></div>
        </div>
      </div>
    `;
  }

  function renderAscend(container) {
    container.innerHTML = '<div style="padding:16px; color:#fff;">Prestige & Ascension unlocks at Level 50!</div>';
  }

  function renderSettings(container) {
    container.innerHTML = '<div style="padding:16px; color:#fff;">Sound Effects: ON | Damage Numbers: ON</div>';
  }

  return { init, renderHeader, renderActiveTab };
})();

document.addEventListener('DOMContentLoaded', () => {
  Game.UI.init();
});
