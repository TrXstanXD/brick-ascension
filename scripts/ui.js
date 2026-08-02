// ============================================================
// UI.JS - DOM rendering, tabs, panels, notifications, autosave
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {
  const U = Game.Util || { 
    fmt: (v) => Math.floor(v), 
    fmtTime: (s) => `${Math.floor(s/60)}m ${Math.floor(s%60)}s` 
  };
  let s;
  let refreshTimer = null;
  let isInitializing = true;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function init() {
    console.warn('[DEBUG UI] Initializing UI module...');
    Game.State.load();
    s = Game.State.get();

    checkStorage();
    bindTabs();
    bindSettings();
    bindPrestige();
    bindSaveButtons();

    // Prevent achievements from spamming toasts on reload
    setTimeout(() => { isInitializing = false; }, 1000);

    if (Game.Engine && Game.Engine.on) {
      Game.Engine.on('achievement', showAchievementToast);
      Game.Engine.on('levelUp', () => flashLevel());
    }

    renderAll();
    refreshTimer = setInterval(renderAll, 400);

    setInterval(() => { 
      Game.State.save(); 
    }, (s.settings.autosaveSec || 10) * 1000);

    window.addEventListener('beforeunload', () => {
      Game.State.save();
    });
  }

  function checkStorage() {
    const ok = Game.State.isStorageAvailable();
    const banner = $('#storage-warning');
    if (banner) banner.classList.toggle('hidden', ok);
  }

  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = $('#panel-' + btn.dataset.tab);
        if (panel) panel.classList.add('active');
      });
    });
  }

  function renderTopBar() {
    if ($('#gold-display')) $('#gold-display').textContent = U.fmt(s.gold);
    if ($('#gems-display')) $('#gems-display').textContent = U.fmt(s.gems);
    if ($('#level-display')) $('#level-display').textContent = s.level;
    const gps = Game._lastGpsSample || 0;
    if ($('#gps-display')) $('#gps-display').textContent = U.fmt(gps) + '/s';
  }

  function flashLevel() {
    const el2 = $('#level-display');
    if (!el2) return;
    el2.classList.add('flash');
    setTimeout(() => el2.classList.remove('flash'), 400);
  }

  function renderBalls() {
    const container = $('#balls-list');
    if (!container || !Game.BALL_ORDER) return;
    container.innerHTML = '';
    Game.BALL_ORDER.forEach((id) => {
      const def = Game.BALL_TYPES[id];
      const b = s.balls[id];
      const card = el('div', 'ball-card' + (b.unlocked ? '' : ' locked'));
      const active = Game.Engine && Game.Engine.getActiveBallCount ? Game.Engine.getActiveBallCount(id) : 0;
      
      if (b.unlocked) {
        card.innerHTML = `
          <div class="ball-card-head">
            <span class="ball-dot" style="background:${def.color}"></span>
            <strong>${def.name}</strong>
            <span class="ball-active">${active}/${b.count} active</span>
          </div>
          <div class="ball-desc">${def.desc}</div>
          <div class="ball-stats">Damage: <b>${U.fmt(Game.State.ballDamage(id))}</b> (Lv.${b.dmgLevel})</div>
          <div class="ball-actions">
            <button class="btn small" data-act="dmg" data-id="${id}">+DMG (${U.fmt(Math.ceil(b.dmgCost))}g)</button>
            <button class="btn small" data-act="count" data-id="${id}">+COUNT (${U.fmt(Math.ceil(b.countCost))}g)</button>
          </div>`;
      } else {
        card.innerHTML = `
          <div class="ball-card-head">
            <span class="ball-dot" style="background:${def.color}"></span>
            <strong>${def.name}</strong> <span class="locked-tag">LOCKED</span>
          </div>
          <div class="ball-desc">${def.desc}</div>
          <div class="ball-actions">
            <button class="btn small primary" data-act="count" data-id="${id}">Unlock (${U.fmt(def.unlockCost)}g)</button>
          </div>`;
      }
      container.appendChild(card);
    });
    
    container.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id, act = btn.dataset.act;
        const ok = act === 'dmg' ? Game.State.buyBallDamage(id) : Game.State.buyBallCount(id);
        if (ok) { 
          if(Game.Engine.SFX && Game.Engine.SFX.upgrade) Game.Engine.SFX.upgrade(); 
          renderAll(); 
        }
      });
    });
  }

  function renderGlobalUpgrades() {
    const container = $('#upgrades-list');
    if (!container || !Game.GLOBAL_UPGRADES) return;
    container.innerHTML = '';
    Game.GLOBAL_UPGRADES.forEach((u) => {
      const lvl = Game.State.globalUpgradeLevel(u.id);
      const cost = Game.State.costFor(u.baseCost, u.costMult, lvl);
      const atCap = u.cap !== undefined && lvl * u.perLevel >= u.cap;
      const card = el('div', 'upgrade-card');
      card.innerHTML = `
        <div class="upgrade-head"><strong>${u.name}</strong><span class="upgrade-lvl">Lv.${lvl}</span></div>
        <div class="upgrade-desc">${u.desc}</div>
        <button class="btn small" ${atCap ? 'disabled' : ''}>${atCap ? 'MAXED' : 'Buy (' + U.fmt(cost) + 'g)'}</button>`;
      card.querySelector('button').addEventListener('click', () => {
        if (Game.State.buyGlobalUpgrade(u.id)) { 
          if(Game.Engine.SFX && Game.Engine.SFX.upgrade) Game.Engine.SFX.upgrade(); 
          renderAll(); 
        }
      });
      container.appendChild(card);
    });
  }

  function showAchievementToast(a) {
    if (isInitializing) return;
    const box = el('div', 'toast');
    box.innerHTML = `<div class="toast-title">🏆 Achievement Unlocked</div><div class="toast-name">${a.name}</div>`;
    const container = $('#toast-container') || document.body;
    container.appendChild(box);
    setTimeout(() => box.classList.add('show'), 10);
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => box.remove(), 400); }, 3600);
  }

  function bindPrestige() {
    const prestigeBtn = $('#prestige-btn');
    if (prestigeBtn) {
      prestigeBtn.addEventListener('click', () => {
        const gain = Game.State.gemsOnPrestige();
        if (gain < 1) { 
          alert('Earn more gold this run before ascending.'); 
          return; 
        }
        if (!confirm(`Ascend now? You will reset progress but keep Gems. You will gain ${gain} Gem(s).`)) return;
        
        Game.State.doPrestige();
        if (Game.Engine.resetRun) Game.Engine.resetRun();
        s = Game.State.get();
        renderAll();
      });
    }
  }

  function bindSettings() {
    const resetBtn = $('#hard-reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('This will permanently erase ALL progress, including Gems. Continue?')) {
          Game.State.hardReset();
          s = Game.State.get();
          if (Game.Engine.resetRun) Game.Engine.resetRun();
          renderAll();
        }
      });
    }
  }

  function bindSaveButtons() {
    if ($('#save-btn')) $('#save-btn').addEventListener('click', () => { Game.State.save(); notify('Game saved.'); });
  }

  function notify(msg) {
    const box = el('div', 'toast simple');
    box.textContent = msg;
    const container = $('#toast-container') || document.body;
    container.appendChild(box);
    setTimeout(() => box.classList.add('show'), 10);
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => box.remove(), 400); }, 2400);
  }

  function renderAll() {
    s = Game.State.get();
    renderTopBar();
    renderBalls();
    renderGlobalUpgrades();
  }

  return { init, renderAll, notify };
})();
