// ============================================================
// UI.JS - DOM rendering, tabs, panels, notifications, autosave
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {
  const U = Game.Util;
  let s;
  let refreshTimer = null;

  function $(sel) { return document.querySelector(sel); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function init() {
    s = Game.State.get();
    checkStorage();
    bindTabs();
    bindTopBar();
    bindSkills();
    bindSettings();
    bindPrestige();
    bindSaveButtons();
    Game.Engine.on('achievement', showAchievementToast);
    Game.Engine.on('levelUp', () => flashLevel());
    renderAll();
    refreshTimer = setInterval(renderAll, 400);
    setInterval(() => { Game.State.save(); }, (s.settings.autosaveSec || 10) * 1000);
    window.addEventListener('beforeunload', () => Game.State.save());
    maybeShowOfflineModal();
  }

  // ---------------- STORAGE CHECK ----------------
  function checkStorage() {
    const ok = Game.State.isStorageAvailable();
    const banner = $('#storage-warning');
    banner.classList.toggle('hidden', ok);
  }

  // ---------------- TABS ----------------
  function bindTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        $('#panel-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  // ---------------- TOP BAR ----------------
  function bindTopBar() {}

  function renderTopBar() {
    $('#gold-display').textContent = U.fmt(s.gold);
    $('#gems-display').textContent = U.fmt(s.gems);
    $('#level-display').textContent = s.level;
    const gps = Game._lastGpsSample || 0;
    $('#gps-display').textContent = U.fmt(gps) + '/s';
  }

  function flashLevel() {
    const el2 = $('#level-display');
    el2.classList.add('flash');
    setTimeout(() => el2.classList.remove('flash'), 400);
  }

  // ---------------- BALLS / UPGRADES PANEL ----------------
  function renderBalls() {
    const container = $('#balls-list');
    container.innerHTML = '';
    Game.BALL_ORDER.forEach((id) => {
      const def = Game.BALL_TYPES[id];
      const b = s.balls[id];
      const card = el('div', 'ball-card' + (b.unlocked ? '' : ' locked'));
      const active = Game.Engine.getActiveBallCount(id);
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
        if (ok) { Game.Engine.SFX.upgrade(); renderAll(); }
      });
    });
  }

  function renderGlobalUpgrades() {
    const container = $('#upgrades-list');
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
        if (Game.State.buyGlobalUpgrade(u.id)) { Game.Engine.SFX.upgrade(); renderAll(); }
      });
      container.appendChild(card);
    });
  }

  // ---------------- SKILLS ----------------
  function bindSkills() {
    const container = $('#skills-list');
    container.innerHTML = '';
    Game.SKILLS.forEach((sk) => {
      const btn = el('button', 'skill-btn');
      btn.dataset.id = sk.id;
      btn.title = sk.desc;
      btn.innerHTML = `<div class="skill-name">${sk.name}</div><div class="skill-cd"></div>`;
      btn.addEventListener('click', () => { Game.Engine.useSkill(sk.id); });
      container.appendChild(btn);
    });
  }

  function renderSkills() {
    document.querySelectorAll('.skill-btn').forEach((btn) => {
      const id = btn.dataset.id;
      const def = Game.SKILLS.find(k => k.id === id);
      const unlocked = s.level >= def.unlockLevel;
      btn.disabled = !unlocked;
      const cdEl = btn.querySelector('.skill-cd');
      if (!unlocked) {
        cdEl.textContent = `Unlocks Lv.${def.unlockLevel}`;
        btn.classList.add('locked');
      } else {
        btn.classList.remove('locked');
        const rem = Game.Engine.skillCooldownRemaining(id);
        cdEl.textContent = rem > 0 ? U.fmtTime(rem / 1000) : 'Ready!';
        btn.classList.toggle('ready', rem <= 0);
      }
    });
  }

  // ---------------- ACHIEVEMENTS ----------------
  function renderAchievements() {
    const container = $('#achievements-list');
    if (container.dataset.rendered === '1' && container.childElementCount === Game.ACHIEVEMENTS.length) {
      // just update unlocked classes, avoid full rebuild every tick
      Game.ACHIEVEMENTS.forEach((a) => {
        const node = container.querySelector(`[data-ach="${a.id}"]`);
        if (node) node.classList.toggle('unlocked', !!s.achievementsUnlocked[a.id]);
      });
      updateAchievementCount();
      return;
    }
    container.innerHTML = '';
    Game.ACHIEVEMENTS.forEach((a) => {
      const unlocked = !!s.achievementsUnlocked[a.id];
      const card = el('div', 'ach-card' + (unlocked ? ' unlocked' : ''));
      card.dataset.ach = a.id;
      card.innerHTML = `<div class="ach-name">${a.hidden && !unlocked ? '???' : a.name}</div>
        <div class="ach-desc">${a.hidden && !unlocked ? 'Hidden achievement' : a.desc}</div>`;
      container.appendChild(card);
    });
    container.dataset.rendered = '1';
    updateAchievementCount();
  }
  function updateAchievementCount() {
    const total = Game.ACHIEVEMENTS.length;
    const done = Object.keys(s.achievementsUnlocked).length;
    $('#ach-count').textContent = `${done} / ${total}`;
  }

  function showAchievementToast(a) {
    const box = el('div', 'toast');
    box.innerHTML = `<div class="toast-title">🏆 Achievement Unlocked</div><div class="toast-name">${a.name}</div>`;
    $('#toast-container').appendChild(box);
    setTimeout(() => box.classList.add('show'), 10);
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => box.remove(), 400); }, 3600);
  }

  // ---------------- STATS ----------------
  function renderStats() {
    const st = s.stats;
    const rows = [
      ['Level Reached', s.level],
      ['Gold', U.fmt(s.gold)],
      ['Gems', U.fmt(s.gems)],
      ['Total Gold Earned', U.fmt(st.totalGoldEarned)],
      ['Total Gold Spent', U.fmt(st.totalGoldSpent)],
      ['Bricks Destroyed', U.fmt(st.bricksDestroyed)],
      ['Treasure Bricks Destroyed', U.fmt(st.treasureBricksDestroyed)],
      ['Explosive Bricks Destroyed', U.fmt(st.explosiveBricksDestroyed)],
      ['Bosses Defeated', U.fmt(st.bossesKilled)],
      ['Critical Hits', U.fmt(st.critHits)],
      ['Biggest Single Hit', U.fmt(st.biggestHit)],
      ['Balls Spawned', U.fmt(st.ballsSpawned)],
      ['Upgrades Bought', U.fmt(st.upgradesBought)],
      ['Times Prestiged', st.prestigeCount],
      ['Total Play Time', U.fmtTime(st.playTimeSec)],
      ['This Run Time', U.fmtTime(st.runTimeSec)]
    ];
    $('#stats-list').innerHTML = rows.map(r => `<div class="stat-row"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  }

  // ---------------- PRESTIGE ----------------
  function bindPrestige() {
    $('#prestige-btn').addEventListener('click', () => {
      const gain = Game.State.gemsOnPrestige();
      if (gain < 1) { alert('Earn more gold this run before ascending — you need enough progress to gain at least 1 Gem.'); return; }
      if (!confirm(`Ascend now? You will reset gold, levels, and balls, but keep Gems and permanent upgrades. You will gain ${gain} Gem(s).`)) return;
      Game.Engine.SFX.prestige();
      Game.State.doPrestige();
      Game.Engine.newLevel(false);
      s = Game.State.get();
      renderAll();
    });
    $('#prestige-btn').addEventListener('click', () => {
  const gain = Game.State.gemsOnPrestige();
  if (gain < 1) { 
    alert('Earn more gold this run before ascending — you need enough progress to gain at least 1 Gem.'); 
    return; 
  }
  if (!confirm(`Ascend now? You will reset gold, levels, and balls, but keep Gems and permanent upgrades. You will gain ${gain} Gem(s).`)) return;
  
  Game.Engine.SFX.prestige();
  Game.State.doPrestige();
  Game.Engine.resetRun(); // Clears all leftover balls/effects and resets level 1 bricks
  s = Game.State.get();
  renderAll();
});
    $('#prestige-upgrades-list').innerHTML = '';
    Game.PRESTIGE_UPGRADES.forEach((u) => {
      const card = el('div', 'upgrade-card gem');
      card.dataset.id = u.id;
      $('#prestige-upgrades-list').appendChild(card);
    });
  }

  function renderPrestige() {
    $('#prestige-gain').textContent = Game.State.gemsOnPrestige();
    document.querySelectorAll('#prestige-upgrades-list .upgrade-card').forEach((card) => {
      const id = card.dataset.id;
      const u = Game.PRESTIGE_UPGRADES.find(x => x.id === id);
      const lvl = Game.State.prestigeUpgradeLevel(id);
      const cost = Game.State.costFor(u.baseCost, u.costMult, lvl);
      card.innerHTML = `
        <div class="upgrade-head"><strong>${u.name}</strong><span class="upgrade-lvl">Lv.${lvl}</span></div>
        <div class="upgrade-desc">${u.desc}</div>
        <button class="btn small gem-btn">Buy (${U.fmt(cost)} 💎)</button>`;
      card.querySelector('button').addEventListener('click', () => {
        if (Game.State.buyPrestigeUpgrade(id)) { Game.Engine.SFX.upgrade(); renderAll(); }
      });
    });
  }

  // ---------------- SETTINGS ----------------
  function bindSettings() {
    const sfx = $('#sfx-volume'), music = $('#music-volume');
    sfx.value = s.settings.sfxVolume; music.value = s.settings.musicVolume;
    sfx.addEventListener('input', () => { s.settings.sfxVolume = parseFloat(sfx.value); });
    music.addEventListener('input', () => { s.settings.musicVolume = parseFloat(music.value); });

    ['particles', 'screenShake', 'showDamageNumbers'].forEach((key) => {
      const box = $('#opt-' + key);
      box.checked = s.settings[key];
      box.addEventListener('change', () => { s.settings[key] = box.checked; });
    });

    $('#autosave-interval').value = s.settings.autosaveSec;
    $('#autosave-interval').addEventListener('change', (e) => {
      s.settings.autosaveSec = Math.max(5, parseInt(e.target.value) || 10);
    });

    $('#hard-reset-btn').addEventListener('click', () => {
      if (confirm('This will permanently erase ALL progress, including Gems and prestige upgrades. Continue?')) {
        Game.State.hardReset();
        s = Game.State.get();
        Game.Engine.newLevel(false);
        renderAll();
      }
    });
  }

  // ---------------- SAVE / LOAD BUTTONS ----------------
  function bindSaveButtons() {
    $('#save-btn').addEventListener('click', () => { Game.State.save(); notify('Game saved.'); });
    $('#export-btn').addEventListener('click', () => {
      const data = Game.State.exportSave();
      $('#export-textarea').value = data;
      $('#export-textarea').select();
      notify('Save exported below — copy it somewhere safe.');
    });
    $('#import-btn').addEventListener('click', () => {
      const val = $('#export-textarea').value;
      if (!val.trim()) { notify('Paste a save string first.'); return; }
      if (Game.State.importSave(val)) {
        s = Game.State.get();
        Game.Engine.newLevel(false);
        renderAll();
        notify('Save imported successfully.');
      } else {
        notify('Import failed — invalid save string.');
      }
    });
    $('#download-btn').addEventListener('click', () => {
      const data = Game.State.exportSave();
      const blob = new Blob([data], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'idle-breakout-save.txt';
      a.click();
    });
    $('#load-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (Game.State.importSave(reader.result)) {
          s = Game.State.get();
          Game.Engine.newLevel(false);
          renderAll();
          notify('Save file loaded successfully.');
        } else {
          notify('That file doesn\'t look like a valid save.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    });
  }

  function notify(msg) {
    const box = el('div', 'toast simple');
    box.textContent = msg;
    $('#toast-container').appendChild(box);
    setTimeout(() => box.classList.add('show'), 10);
    setTimeout(() => { box.classList.remove('show'); setTimeout(() => box.remove(), 400); }, 2400);
  }

  // ---------------- OFFLINE MODAL ----------------
  function maybeShowOfflineModal() {
    // applyOfflineProgress already ran during State.init(); we just report if meaningful
  }
  function reportOffline(result) {
    if (result && result.gold > 1) {
      notify(`Welcome back! You earned ${U.fmt(result.gold)} gold while away (${U.fmtTime(result.seconds)}).`);
    }
  }

  // ---------------- MASTER RENDER ----------------
  function renderAll() {
    s = Game.State.get();
    renderTopBar();
    renderBalls();
    renderGlobalUpgrades();
    renderSkills();
    renderAchievements();
    renderStats();
    renderPrestige();
  }

  return { init, renderAll, notify, reportOffline };
})();
