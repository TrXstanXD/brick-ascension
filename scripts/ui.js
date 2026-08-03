// ============================================================
// UI.JS - Tab management, arsenal, upgrades, achievements & stats
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {
  let activeTab = 'balls';

  function formatNum(n) {
    return Game.Util ? Game.Util.fmt(n) : String(n);
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
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.onclick = (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab');
        if (!tab) return;
        activeTab = tab;

        tabBtns.forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === activeTab));
        document.querySelectorAll('.tab-panel').forEach(p => {
          p.classList.toggle('active', p.id === `panel-${activeTab}`);
        });

        renderActiveTab();
      };
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
    const elGold = document.querySelector('#gold-display');
    const elGems = document.querySelector('#gems-display');
    const elGps = document.querySelector('#gps-display');
    const elLevel = document.querySelector('#level-display');

    if (elGold) elGold.textContent = formatNum(s.gold || 0);
    if (elGems) elGems.textContent = formatNum(s.diamonds || s.gems || 0);
    if (elGps) elGps.textContent = formatNum(Game._lastGpsSample || 0) + '/s';
    if (elLevel) elLevel.textContent = s.level || 1;
  }

  function renderActiveTab() {
    if (activeTab === 'balls') renderBalls();
    else if (activeTab === 'upgrades') renderUpgrades();
    else if (activeTab === 'achievements') renderAchievements();
    else if (activeTab === 'stats') renderStats();
  }

  function renderBalls() {
    const listEl = document.querySelector('#balls-list');
    if (!listEl) return;

    const s = Game.State.get();
    const ballOrder = Game.BALL_ORDER || ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];

    let html = '';
    ballOrder.forEach((id) => {
      const ball = s.balls[id] || { unlocked: false, level: 1, count: 0 };
      const def = Game.BALL_TYPES ? Game.BALL_TYPES[id] : { name: id, desc: '', color: '#fff' };
      const currentDmg = Game.State.ballDamage(id);
      const dmgCost = Game.State.upgradeBallDmgCost(id);
      const countCost = Game.State.upgradeBallCountCost(id);

      if (ball.unlocked) {
        html += `
          <div class="ball-card">
            <div class="ball-card-head">
              <span class="ball-dot" style="background:${def.color || '#4fc3f7'};"></span>
              <strong>${def.name || id}</strong>
              <span class="ball-active">Count: ${ball.count}</span>
            </div>
            <div class="ball-desc">${def.desc || ''}</div>
            <div class="ball-stats">Damage: <strong>${formatNum(currentDmg)}</strong> (Lv.${ball.level})</div>
            <div class="ball-actions">
              <button class="btn primary small" data-action="buy-dmg" data-id="${id}" ${s.gold < dmgCost ? 'disabled' : ''}>
                +DMG (${formatNum(dmgCost)}g)
              </button>
              <button class="btn small" data-action="buy-count" data-id="${id}" ${s.gold < countCost ? 'disabled' : ''}>
                +Count (${formatNum(countCost)}g)
              </button>
            </div>
          </div>
        `;
      } else {
        const unlockCost = dmgCost * 5;
        html += `
          <div class="ball-card locked">
            <div class="ball-card-head">
              <strong>${def.name || id}</strong>
              <span class="locked-tag">LOCKED</span>
            </div>
            <div class="ball-desc">${def.desc || ''}</div>
            <button class="btn primary small" data-action="unlock-ball" data-id="${id}" ${s.gold < unlockCost ? 'disabled' : ''}>
              Unlock (${formatNum(unlockCost)}g)
            </button>
          </div>
        `;
      }
    });

    listEl.innerHTML = html;
  }

  function renderUpgrades() {
    const listEl = document.querySelector('#upgrades-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="hint">Global upgrades unlock as you complete higher levels!</p>';
  }

  function renderAchievements() {
    const listEl = document.querySelector('#achievements-list');
    if (!listEl) return;

    const s = Game.State.get();
    const list = Game.ACHIEVEMENTS || [];

    let html = '';
    list.forEach((ach) => {
      const unlocked = !!s.achievements[ach.id];
      html += `
        <div class="ach-card ${unlocked ? 'unlocked' : ''}">
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
      `;
    });
    listEl.innerHTML = html;
  }

  function renderStats() {
    const listEl = document.querySelector('#stats-list');
    if (!listEl) return;

    const st = Game.State.get().stats || {};
    listEl.innerHTML = `
      <div class="stat-row"><span>Total Gold Earned</span><strong>${formatNum(st.totalGoldEarned || 0)}</strong></div>
      <div class="stat-row"><span>Bricks Destroyed</span><strong>${formatNum(st.bricksDestroyed || 0)}</strong></div>
      <div class="stat-row"><span>Bosses Defeated</span><strong>${formatNum(st.bossesKilled || 0)}</strong></div>
      <div class="stat-row"><span>Time Played</span><strong>${Game.Util ? Game.Util.fmtTime(st.playTimeSec || 0) : '0s'}</strong></div>
    `;
  }

  return { init, renderHeader, renderActiveTab };
})();
