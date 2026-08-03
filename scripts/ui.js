// ============================================================
// UI.JS - Tab management, skills, arsenal, upgrades, achievements, settings
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {
  let activeTab = 'balls';
  let autosaveTimer = null;

  function formatNum(n) {
    return Game.Util ? Game.Util.fmt(n) : String(n);
  }

  function showToast(title, text, isSimple = false) {
    const container = document.querySelector('#toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${isSimple ? 'simple' : ''}`;
    toast.innerHTML = `
      ${title ? `<div class="toast-title">${title}</div>` : ''}
      <div class="toast-name">${text}</div>
    `;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function init() {
    setupTabs();
    bindEvents();
    renderSkills();
    renderHeader();
    renderActiveTab();
    initSettingsForm();
    checkStoragePersistence();

    // Event hooks from Engine
    if (Game.Engine) {
      Game.Engine.on('achievement', (ach) => {
        showToast('ACHIEVEMENT UNLOCKED!', ach.name);
      });
      Game.Engine.on('levelUp', (lvl) => {
        const elLevel = document.querySelector('#level-display');
        if (elLevel) {
          elLevel.classList.add('flash');
          setTimeout(() => elLevel.classList.remove('flash'), 300);
        }
      });
    }

    // Fast UI Loop
    setInterval(() => {
      renderHeader();
      updateSkillsCooldowns();
      if (activeTab === 'prestige') renderPrestige();
    }, 200);

    // Slow Panel Loop
    setInterval(() => {
      renderActiveTab();
    }, 1000);

    setupAutosave();
  }

  function checkStoragePersistence() {
    const warningEl = document.querySelector('#storage-warning');
    if (warningEl && Game.State) {
      if (!Game.State.checkStoragePersistence()) {
        warningEl.classList.remove('hidden');
      } else {
        warningEl.classList.add('hidden');
      }
    }
  }

  function setupAutosave() {
    if (autosaveTimer) clearInterval(autosaveTimer);
    const s = Game.State.get();
    const intervalSec = (s.settings && s.settings.autosaveInterval) || 30;
    autosaveTimer = setInterval(() => {
      Game.State.save();
    }, Math.max(5, intervalSec) * 1000);
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
      } else if (action === 'buy-global-upg') {
        if (Game.State.buyGlobalUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'buy-gem-upg') {
        if (Game.State.buyGemUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'use-skill') {
        if (Game.Engine?.useSkill(id)) Game.Engine?.SFX?.upgrade?.();
      }

      renderHeader();
      renderActiveTab();
    });

    // Prestige Button
    const prestigeBtn = document.querySelector('#prestige-btn');
    if (prestigeBtn) {
      prestigeBtn.onclick = () => {
        const gain = Game.State.getPrestigeGain();
        if (gain <= 0) return;
        if (confirm(`Ascend now for ${gain} Gems? This resets your current run progress!`)) {
          if (Game.State.prestige()) {
            Game.Engine?.resetRun();
            Game.Engine?.SFX?.prestige();
            showToast('ASCENSION', `Ascended for +${gain} Gems!`);
            renderHeader();
            renderActiveTab();
          }
        }
      };
    }

    // Save Management Buttons
    const saveBtn = document.querySelector('#save-btn');
    if (saveBtn) {
      saveBtn.onclick = () => {
        Game.State.save();
        showToast(null, 'Game saved manually!', true);
      };
    }

    const exportBtn = document.querySelector('#export-btn');
    const exportTextarea = document.querySelector('#export-textarea');
    if (exportBtn && exportTextarea) {
      exportBtn.onclick = () => {
        exportTextarea.value = Game.State.exportSaveString();
        exportTextarea.select();
        showToast(null, 'Save code exported to text box!', true);
      };
    }

    const downloadBtn = document.querySelector('#download-btn');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        const data = Game.State.exportSaveString();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `brick_ascension_save_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    const loadFileInput = document.querySelector('#load-file-input');
    if (loadFileInput) {
      loadFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          if (Game.State.importSaveString(evt.target.result)) {
            Game.State.save();
            Game.Engine?.resetRun();
            showToast(null, 'Save file imported successfully!', true);
            renderHeader();
            renderActiveTab();
          } else {
            alert('Failed to parse save file!');
          }
        };
        reader.readAsText(file);
      };
    }

    const importBtn = document.querySelector('#import-btn');
    if (importBtn && exportTextarea) {
      importBtn.onclick = () => {
        const code = exportTextarea.value.trim();
        if (!code) return;
        if (Game.State.importSaveString(code)) {
          Game.State.save();
          Game.Engine?.resetRun();
          showToast(null, 'Save code imported successfully!', true);
          renderHeader();
          renderActiveTab();
        } else {
          alert('Invalid save code!');
        }
      };
    }

    const hardResetBtn = document.querySelector('#hard-reset-btn');
    if (hardResetBtn) {
      hardResetBtn.onclick = () => {
        if (confirm('CRITICAL WARNING: This will permanently erase ALL save data and progress. Are you completely sure?')) {
          Game.State.hardReset();
          Game.Engine?.resetRun();
          showToast('RESET', 'All save data erased.');
          renderHeader();
          renderActiveTab();
        }
      };
    }
  }

  function initSettingsForm() {
    const s = Game.State.get().settings || {};
    const sfxVol = document.querySelector('#sfx-volume');
    const musicVol = document.querySelector('#music-volume');
    const optPart = document.querySelector('#opt-particles');
    const optShake = document.querySelector('#opt-screenShake');
    const optDmg = document.querySelector('#opt-showDamageNumbers');
    const autoInterval = document.querySelector('#autosave-interval');

    if (sfxVol) { sfxVol.value = s.sfxVolume ?? 0.5; sfxVol.onchange = () => { s.sfxVolume = parseFloat(sfxVol.value); Game.State.save(); }; }
    if (musicVol) { musicVol.value = s.musicVolume ?? 0.5; musicVol.onchange = () => { s.musicVolume = parseFloat(musicVol.value); Game.State.save(); }; }
    if (optPart) { optPart.checked = !!s.particles; optPart.onchange = () => { s.particles = optPart.checked; Game.State.save(); }; }
    if (optShake) { optShake.checked = !!s.screenShake; optShake.onchange = () => { s.screenShake = optShake.checked; Game.State.save(); }; }
    if (optDmg) { optDmg.checked = !!s.showDamageNumbers; optDmg.onchange = () => { s.showDamageNumbers = optDmg.checked; Game.State.save(); }; }
    if (autoInterval) {
      autoInterval.value = s.autosaveInterval ?? 30;
      autoInterval.onchange = () => {
        s.autosaveInterval = Math.max(5, parseInt(autoInterval.value) || 30);
        Game.State.save();
        setupAutosave();
      };
    }
  }

  function renderSkills() {
    const container = document.querySelector('#skills-list');
    if (!container || !Game.SKILLS) return;

    let html = '';
    Game.SKILLS.forEach((sk) => {
      html += `
        <button class="skill-btn" data-action="use-skill" data-id="${sk.id}" id="skill-btn-${sk.id}">
          <div class="skill-name">${sk.name}</div>
          <div class="skill-cd" id="skill-cd-${sk.id}">Lv.${sk.unlockLevel}</div>
        </button>
      `;
    });
    container.innerHTML = html;
  }

  function updateSkillsCooldowns() {
    if (!Game.SKILLS) return;
    const s = Game.State.get();

    Game.SKILLS.forEach((sk) => {
      const btn = document.querySelector(`#skill-btn-${sk.id}`);
      const cdEl = document.querySelector(`#skill-cd-${sk.id}`);
      if (!btn || !cdEl) return;

      const isUnlocked = s.level >= sk.unlockLevel;
      const cdRem = Game.Engine ? Game.Engine.skillCooldownRemaining(sk.id) : 0;

      if (!isUnlocked) {
        btn.className = 'skill-btn locked';
        btn.disabled = true;
        cdEl.textContent = `Unlocks Lv.${sk.unlockLevel}`;
      } else if (cdRem > 0) {
        btn.className = 'skill-btn';
        btn.disabled = true;
        cdEl.textContent = `${(cdRem / 1000).toFixed(1)}s`;
      } else {
        btn.className = 'skill-btn ready';
        btn.disabled = false;
        cdEl.textContent = 'READY';
      }
    });
  }

  function renderHeader() {
    const s = Game.State.get();
    const elGold = document.querySelector('#gold-display');
    const elGems = document.querySelector('#gems-display');
    const elGps = document.querySelector('#gps-display');
    const elLevel = document.querySelector('#level-display');

    if (elGold) elGold.textContent = formatNum(s.gold || 0);
    if (elGems) elGems.textContent = formatNum(s.diamonds || 0);
    if (elGps) elGps.textContent = formatNum(Game._lastGpsSample || 0) + '/s';
    if (elLevel) elLevel.textContent = s.level || 1;
  }

  function renderActiveTab() {
    if (activeTab === 'balls') renderBalls();
    else if (activeTab === 'upgrades') renderUpgrades();
    else if (activeTab === 'prestige') renderPrestige();
    else if (activeTab === 'achievements') renderAchievements();
    else if (activeTab === 'stats') renderStats();
  }

  function renderBalls() {
    const listEl = document.querySelector('#balls-list');
    if (!listEl) return;

    const s = Game.State.get();
    const ballOrder = Game.BALL_ORDER || ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];
    const extraSlots = Game.State.getExtraSlots ? Game.State.getExtraSlots() : 0;
// Inside renderBalls() in UI.js:
const rateCost = Game.State.getGlobalUpgradeCost ? Game.State.getGlobalUpgradeCost({ id: 'fireRate', baseCost: 120, costMult: 1.16 }) : 120;

html += `
  <div class="ball-actions">
    <button class="btn primary small" data-action="buy-dmg" data-id="${id}" ${s.gold < dmgCost ? 'disabled' : ''}>
      +DMG (${formatNum(dmgCost)}g)
    </button>
    <button class="btn small" data-action="buy-count" data-id="${id}" ${s.gold < countCost ? 'disabled' : ''}>
      +Count (${formatNum(countCost)}g)
    </button>
    <button class="btn small" data-action="buy-global-upg" data-id="fireRate" ${s.gold < rateCost ? 'disabled' : ''}>
      +Deploy Rate (${formatNum(rateCost)}g)
    </button>
  </div>
`;
    let html = '';
    ballOrder.forEach((id) => {
      const ball = s.balls[id] || { unlocked: false, level: 1, count: 0 };
      const def = Game.BALL_TYPES ? Game.BALL_TYPES[id] : { name: id, desc: '', color: '#fff' };
      const currentDmg = Game.State.ballDamage(id);
      const dmgCost = Game.State.upgradeBallDmgCost(id);
      const countCost = Game.State.upgradeBallCountCost(id);

      if (ball.unlocked) {
        const totalCountDisplay = extraSlots > 0 ? `${ball.count} <span style="color:#ffd700;">(+${extraSlots})</span>` : ball.count;
        html += `
          <div class="ball-card">
            <div class="ball-card-head">
              <span class="ball-dot" style="background:${def.color || '#4fc3f7'};"></span>
              <strong>${def.name || id}</strong>
              <span class="ball-active">Count: ${totalCountDisplay}</span>
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
        const unlockCost = def.unlockCost || 1000;
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
    if (!listEl || !Game.GLOBAL_UPGRADES) return;

    const s = Game.State.get();
    let html = '';

    Game.GLOBAL_UPGRADES.forEach((upg) => {
      const lvl = s.upgrades[upg.id] || 0;
      const cost = Game.State.getGlobalUpgradeCost(upg);
      const isCapped = upg.cap !== undefined && (lvl * upg.perLevel) >= upg.cap;

      html += `
        <div class="upgrade-card">
          <div class="upgrade-head">
            <strong>${upg.name}</strong>
            <span class="upgrade-lvl">Lv. ${lvl}</span>
          </div>
          <div class="upgrade-desc">${upg.desc}</div>
          <button class="btn primary small" data-action="buy-global-upg" data-id="${upg.id}" ${isCapped || s.gold < cost ? 'disabled' : ''}>
            ${isCapped ? 'MAXED' : `Upgrade (${formatNum(cost)}g)`}
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function renderPrestige() {
    const gainEl = document.querySelector('#prestige-gain');
    const prestigeBtn = document.querySelector('#prestige-btn');
    const gain = Game.State.getPrestigeGain();

    if (gainEl) gainEl.textContent = formatNum(gain);
    if (prestigeBtn) prestigeBtn.disabled = gain <= 0;

    const listEl = document.querySelector('#prestige-upgrades-list');
    if (!listEl || !Game.PRESTIGE_UPGRADES) return;

    const s = Game.State.get();
    let html = '';

    Game.PRESTIGE_UPGRADES.forEach((upg) => {
      const lvl = s.prestigeUpgrades[upg.id] || 0;
      const cost = Game.State.getGemUpgradeCost(upg);

      html += `
        <div class="upgrade-card gem">
          <div class="upgrade-head">
            <strong>${upg.name}</strong>
            <span class="upgrade-lvl">Lv. ${lvl}</span>
          </div>
          <div class="upgrade-desc">${upg.desc}</div>
          <button class="btn gem-btn primary small" data-action="buy-gem-upg" data-id="${upg.id}" ${s.diamonds < cost ? 'disabled' : ''}>
            Upgrade (${formatNum(cost)} 💎)
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function renderAchievements() {
    const listEl = document.querySelector('#achievements-list');
    const badgeEl = document.querySelector('#ach-count');
    if (!listEl) return;

    const s = Game.State.get();
    const list = Game.ACHIEVEMENTS || [];
    let unlockedCount = 0;

    let html = '';
    list.forEach((ach) => {
      if (!ach) return;
      const unlocked = !!s.achievements[ach.id];
      if (unlocked) unlockedCount++;
      if (ach.hidden && !unlocked) return;

      html += `
        <div class="ach-card ${unlocked ? 'unlocked' : ''}">
          <div class="ach-name">${ach.name}</div>
          <div class="ach-desc">${ach.desc}</div>
        </div>
      `;
    });

    if (badgeEl) badgeEl.textContent = `(${unlockedCount}/${list.length})`;
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
      <div class="stat-row"><span>Treasure Bricks</span><strong>${formatNum(st.treasureBricksDestroyed || 0)}</strong></div>
      <div class="stat-row"><span>Explosive Bricks</span><strong>${formatNum(st.explosiveBricksDestroyed || 0)}</strong></div>
      <div class="stat-row"><span>Balls Spawned</span><strong>${formatNum(st.ballsSpawned || 0)}</strong></div>
      <div class="stat-row"><span>Critical Hits</span><strong>${formatNum(st.critHits || 0)}</strong></div>
      <div class="stat-row"><span>Highest Single Hit</span><strong>${formatNum(st.biggestHit || 0)}</strong></div>
      <div class="stat-row"><span>Upgrades Purchased</span><strong>${formatNum(st.upgradesBought || 0)}</strong></div>
      <div class="stat-row"><span>Times Ascended</span><strong>${formatNum(st.prestigeCount || 0)}</strong></div>
      <div class="stat-row"><span>Run Time</span><strong>${Game.Util ? Game.Util.fmtTime(st.runTimeSec || 0) : '0s'}</strong></div>
      <div class="stat-row"><span>Total Time Played</span><strong>${Game.Util ? Game.Util.fmtTime(st.playTimeSec || 0) : '0s'}</strong></div>
    `;
  }

  return { init, renderHeader, renderActiveTab };
})();
