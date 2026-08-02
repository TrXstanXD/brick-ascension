// ============================================================
// UI.JS - Tab management, arsenal, upgrades, achievements & stats
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

  function getTabContainer() {
    return (
      document.querySelector('#tab-content') ||
      document.querySelector('.tab-content') ||
      document.querySelector('.panel-content') ||
      document.querySelector('.side-panel') ||
      document.querySelector('.right-panel')
    );
  }

  function init() {
    setupTabs();
    bindEvents();
    renderHeader();
    renderActiveTab();

    setInterval(() => {
      renderHeader();
      renderActiveTab();
    }, 250);
  }

  function setupTabs() {
    // Look for tab buttons by data attribute, class, or plain buttons inside the right panel
    const navButtons = document.querySelectorAll(
      '[data-tab], .tab-btn, .tab-button, button'
    );

    navButtons.forEach((btn) => {
      const label = (btn.getAttribute('data-tab') || btn.innerText || '')
        .toLowerCase()
        .trim();

      if (['balls', 'upgrades', 'ascend', 'achievements', 'stats', 'settings'].includes(label)) {
        btn.setAttribute('data-tab-name', label);
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          activeTab = label;

          // Update active styling
          document.querySelectorAll('[data-tab-name]').forEach((b) => {
            if (b.getAttribute('data-tab-name') === label) {
              b.classList.add('active');
            } else {
              b.classList.remove('active');
            }
          });

          renderActiveTab();
        });
      }
    });
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'buy-dmg') {
        if (Game.State.buyBallDmgUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'buy-count') {
        if (Game.State.buyBallCountUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'unlock-ball') {
        if (Game.State.unlockBall(id)) Game.Engine?.SFX?.upgrade?.();
      }

      renderHeader();
      renderActiveTab();
    });
  }

  function renderHeader() {
    const s = Game.State.get();
    const elGold = document.querySelector('#gold-display, .stat-gold, #gold');
    const elDiamonds = document.querySelector('#diamond-display, .stat-diamonds, #diamonds');
    const elGps = document.querySelector('#gps-display, .stat-gps, #gps');
    const elLevel = document.querySelector('#level-display, .stat-level, #level');

    if (elGold) elGold.textContent = formatNum(s.gold);
    if (elDiamonds) elDiamonds.textContent = formatNum(s.diamonds);
    if (elGps) elGps.textContent = formatNum(Game._lastGpsSample || 0) + '/s';
    if (elLevel) elLevel.textContent = 'Level ' + (s.level || 1);
  }

  function renderActiveTab() {
    let container = getTabContainer();

    // If no direct panel container is found, inject or target content area next to tabs
    if (!container) return;

    // Preserve top tab buttons if container wraps everything
    let contentArea = container.querySelector('.tab-body-area');
    if (!contentArea) {
      contentArea = document.createElement('div');
      contentArea.className = 'tab-body-area';
      contentArea.style.marginTop = '12px';
      container.appendChild(contentArea);
    }

    if (activeTab === 'balls') renderBalls(contentArea);
    else if (activeTab === 'upgrades') renderUpgrades(contentArea);
    else if (activeTab === 'achievements') renderAchievements(contentArea);
    else if (activeTab === 'stats') renderStats(contentArea);
    else if (activeTab === 'ascend') renderAscend(contentArea);
    else if (activeTab === 'settings') renderSettings(contentArea);
  }

  // --- ARSENAL TAB ---
  function renderBalls(container) {
    const s = Game.State.get();
    const ballOrder = Game.BALL_ORDER || ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];

    let html = '<div style="display:flex; flex-direction:column; gap:12px;">';

    ballOrder.forEach((id) => {
      const ball = s.balls[id] || { unlocked: false, level: 1, count: 0 };
      const def = Game.BALL_TYPES ? Game.BALL_TYPES[id] : { name: id, desc: '' };
      const currentDmg = Game.State.ballDamage(id);
      const dmgCost = Game.State.upgradeBallDmgCost(id);
      const countCost = Game.State.upgradeBallCountCost(id);

      if (ball.unlocked) {
        html += `
          <div style="background:#1e1e38; border:1px solid #2e2e54; padding:12px; border-radius:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="font-size:15px; color:#fff;">${def.name || id}</strong>
              <span style="font-size:12px; color:#aaa;">Count: ${ball.count}</span>
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
          <div style="background:#141428; border:1px dashed #2e2e54; padding:12px; border-radius:8px; opacity:0.8;">
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

  function renderUpgrades(container) {
    container.innerHTML = '<div style="padding:12px; color:#aaa;">Upgrades unlocked at higher levels!</div>';
  }

  function renderAchievements(container) {
    const s = Game.State.get();
    const list = Game.ACHIEVEMENTS || [
      { id: 'first_brick', name: 'First Blood', desc: 'Destroy 1 brick' },
      { id: 'level_10', name: 'Getting Started', desc: 'Reach Level 10' }
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

  function renderStats(container) {
    const st = Game.State.get().stats || {};
    container.innerHTML = `
      <div style="background:#1e1e38; border:1px solid #2e2e54; padding:12px; border-radius:8px; color:#fff;">
        <h3 style="margin:0 0 8px 0; color:#ffd700; font-size:14px;">Statistics</h3>
        <div style="display:flex; flex-direction:column; gap:6px; font-size:12px; color:#ccc;">
          <div>Total Gold: <strong style="color:#ffd700;">${formatNum(st.totalGoldEarned || 0)}</strong></div>
          <div>Bricks Destroyed: <strong>${formatNum(st.bricksDestroyed || 0)}</strong></div>
          <div>Time Played: <strong>${Math.floor((st.playTimeSec || 0) / 60)}m</strong></div>
        </div>
      </div>
    `;
  }

  function renderAscend(container) {
    container.innerHTML = '<div style="padding:12px; color:#aaa;">Ascension requires Level 50.</div>';
  }

  function renderSettings(container) {
    container.innerHTML = '<div style="padding:12px; color:#aaa;">Settings: SFX Enabled</div>';
  }

  return { init, renderHeader, renderActiveTab };
})();

document.addEventListener('DOMContentLoaded', () => {
  Game.UI.init();
});
