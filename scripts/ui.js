// ============================================================
// UI.JS - Interface rendering & event bindings
// ============================================================
window.Game = window.Game || {};

Game.UI = (function () {

  function renderHeader() {
    const s = Game.State.get();
    const goldEl = document.querySelector('#gold-display');
    const gemsEl = document.querySelector('#gems-display');
    const gpsEl = document.querySelector('#gps-display');
    const levelEl = document.querySelector('#level-display');

    if (goldEl) goldEl.textContent = Game.Util.fmt(s.gold || 0);
    if (gemsEl) gemsEl.textContent = Game.Util.fmt(s.diamonds || 0);
    if (gpsEl) gpsEl.textContent = Game.Util.fmt(Game._lastGpsSample || 0) + '/s';
    if (levelEl) levelEl.textContent = s.level || 1;
  }

  function showToast(title, msg, isSuccess = false) {
    const container = document.querySelector('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${isSuccess ? 'success' : ''}`;
    toast.innerHTML = title ? `<strong>${title}</strong>: ${msg}` : msg;
    container.appendChild(toast);

    // Force a reflow so the CSS transition actually triggers, then reveal it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('show'));
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  let autosaveTimerId = null;

  function restartAutosaveTimer() {
    if (autosaveTimerId) clearInterval(autosaveTimerId);
    const s = Game.State.get();
    const seconds = Game.Util.clamp(s.settings.autosaveInterval || 30, 5, 120);
    autosaveTimerId = setInterval(() => {
      Game.State.save();
    }, seconds * 1000);
  }

  function applySettingsToInputs() {
    const s = Game.State.get();
    const settings = s.settings || {};

    const sfx = document.querySelector('#sfx-volume');
    const music = document.querySelector('#music-volume');
    const particles = document.querySelector('#opt-particles');
    const screenShake = document.querySelector('#opt-screenShake');
    const dmgNumbers = document.querySelector('#opt-showDamageNumbers');
    const autosave = document.querySelector('#autosave-interval');

    if (sfx) sfx.value = settings.sfxVolume ?? 0.5;
    if (music) music.value = settings.musicVolume ?? 0.5;
    if (particles) particles.checked = settings.particles !== false;
    if (screenShake) screenShake.checked = settings.screenShake !== false;
    if (dmgNumbers) dmgNumbers.checked = settings.showDamageNumbers !== false;
    if (autosave) autosave.value = settings.autosaveInterval ?? 30;
  }

  function bindSettings() {
    const s = Game.State.get();
    s.settings = s.settings || {};

    const sfx = document.querySelector('#sfx-volume');
    const music = document.querySelector('#music-volume');
    const particles = document.querySelector('#opt-particles');
    const screenShake = document.querySelector('#opt-screenShake');
    const dmgNumbers = document.querySelector('#opt-showDamageNumbers');
    const autosave = document.querySelector('#autosave-interval');

    applySettingsToInputs();

    if (sfx) {
      sfx.oninput = () => {
        Game.State.get().settings.sfxVolume = parseFloat(sfx.value);
        Game.State.save();
      };
    }
    if (music) {
      music.oninput = () => {
        Game.State.get().settings.musicVolume = parseFloat(music.value);
        Game.State.save();
      };
    }
    if (particles) {
      particles.onchange = () => {
        Game.State.get().settings.particles = particles.checked;
        Game.State.save();
      };
    }
    if (screenShake) {
      screenShake.onchange = () => {
        Game.State.get().settings.screenShake = screenShake.checked;
        Game.State.save();
      };
    }
    if (dmgNumbers) {
      dmgNumbers.onchange = () => {
        Game.State.get().settings.showDamageNumbers = dmgNumbers.checked;
        Game.State.save();
      };
    }
    if (autosave) {
      autosave.onchange = () => {
        const val = Game.Util.clamp(parseInt(autosave.value, 10) || 30, 5, 120);
        autosave.value = val;
        Game.State.get().settings.autosaveInterval = val;
        Game.State.save();
        restartAutosaveTimer();
        showToast(null, `Autosave interval set to ${val}s`, true);
      };
    }

    restartAutosaveTimer();
  }

  function renderSkills() {
    const listEl = document.querySelector('#skills-list');
    if (!listEl) return;

    const s = Game.State.get();
    const skills = Game.SKILLS || [];
    let html = '';

    skills.forEach((sk) => {
      const locked = (s.level || 1) < sk.unlockLevel;
      const cdRemain = Game.Engine?.skillCooldownRemaining ? Game.Engine.skillCooldownRemaining(sk.id) : 0;
      const ready = !locked && cdRemain <= 0;
      const cdText = locked ? `Unlocks Lv.${sk.unlockLevel}` : (ready ? 'READY' : `${Math.ceil(cdRemain / 1000)}s`);

      html += `
        <button class="skill-btn ${locked ? 'locked' : ''} ${ready ? 'ready' : ''}"
                data-action="use-skill" data-id="${sk.id}"
                ${(locked || !ready) ? 'disabled' : ''} title="${sk.desc}">
          <div class="skill-name">${sk.name}</div>
          <div class="skill-cd">${cdText}</div>
        </button>
      `;
    });

    listEl.innerHTML = html;
  }

  function renderUpgrades() {
    const listEl = document.querySelector('#upgrades-list');
    if (!listEl) return;

    const s = Game.State.get();
    const upgrades = Game.GLOBAL_UPGRADES || [];
    let html = '';

    upgrades.forEach((upg) => {
      const lvl = s.upgrades[upg.id] || 0;
      const cost = Game.State.getGlobalUpgradeCost(upg);
      const isCapped = upg.cap !== undefined && (lvl * upg.perLevel) >= upg.cap;

      html += `
        <div class="upgrade-card">
          <div class="upgrade-info">
            <strong>${upg.name} (Lv. ${lvl})</strong>
            <div class="upgrade-desc">${upg.desc}</div>
          </div>
          <button class="btn primary small" data-action="buy-global-upg" data-id="${upg.id}" ${s.gold < cost || isCapped ? 'disabled' : ''}>
            ${isCapped ? 'MAXED' : `Upgrade (${Game.Util.fmt(cost)}g)`}
          </button>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function renderPrestige() {
    const gainEl = document.querySelector('#prestige-gain');
    if (gainEl) {
      gainEl.textContent = Game.Util.fmt(Game.State.getPrestigeGain());
    }

    const listEl = document.querySelector('#prestige-upgrades-list');
    if (!listEl) return;

    const s = Game.State.get();
    const upgrades = Game.PRESTIGE_UPGRADES || [];
    let html = '';

    upgrades.forEach((upg) => {
      const lvl = s.prestigeUpgrades[upg.id] || 0;
      const cost = Game.State.getGemUpgradeCost(upg);

      html += `
        <div class="upgrade-card">
          <div class="upgrade-info">
            <strong>${upg.name} (Lv. ${lvl})</strong>
            <div class="upgrade-desc">${upg.desc}</div>
          </div>
          <button class="btn primary small" data-action="buy-gem-upg" data-id="${upg.id}" ${s.diamonds < cost ? 'disabled' : ''}>
            Upgrade (${Game.Util.fmt(cost)} 💎)
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
    const achs = Game.ACHIEVEMENTS || [];
    let unlockedCount = 0;
    let html = '';

    achs.forEach((ach) => {
      const isUnlocked = s.achievements[ach.id];
      if (isUnlocked) unlockedCount++;

      if (ach.hidden && !isUnlocked) return;

      html += `
        <div class="ach-card ${isUnlocked ? 'unlocked' : 'locked'}">
          <strong>${ach.name}</strong>
          <div class="ach-desc">${ach.desc}</div>
          <span class="ach-status">${isUnlocked ? '✓ UNLOCKED' : 'LOCKED'}</span>
        </div>
      `;
    });

    if (badgeEl) badgeEl.textContent = `${unlockedCount}/${achs.length}`;
    listEl.innerHTML = html;
  }

  function renderStats() {
    const listEl = document.querySelector('#stats-list');
    if (!listEl) return;

    const s = Game.State.get();
    const stats = s.stats || {};

    listEl.innerHTML = `
      <div class="stat-row"><span>Total Playtime:</span> <strong>${Game.Util.fmtTime(stats.playTimeSec || 0)}</strong></div>
      <div class="stat-row"><span>Current Run Time:</span> <strong>${Game.Util.fmtTime(stats.runTimeSec || 0)}</strong></div>
      <div class="stat-row"><span>Total Gold Earned:</span> <strong>${Game.Util.fmt(stats.totalGoldEarned || 0)}</strong></div>
      <div class="stat-row"><span>Bricks Destroyed:</span> <strong>${Game.Util.fmt(stats.bricksDestroyed || 0)}</strong></div>
      <div class="stat-row"><span>Bosses Defeated:</span> <strong>${Game.Util.fmt(stats.bossesKilled || 0)}</strong></div>
      <div class="stat-row"><span>Critical Hits:</span> <strong>${Game.Util.fmt(stats.critHits || 0)}</strong></div>
      <div class="stat-row"><span>Highest Single Hit:</span> <strong>${Game.Util.fmt(stats.biggestHit || 0)}</strong></div>
      <div class="stat-row"><span>Ascensions:</span> <strong>${stats.prestigeCount || 0}</strong></div>
    `;
  }

  function renderBalls() {
    const listEl = document.querySelector('#balls-list');
    if (!listEl) return;

    const s = Game.State.get();
    const ballOrder = Game.BALL_ORDER || ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];
    const extraSlots = Game.State.getExtraSlots ? Game.State.getExtraSlots() : 0;

    let html = '';
    ballOrder.forEach((id) => {
      const ball = s.balls[id] || { unlocked: false, level: 1, count: 0, rateLevel: 0 };
      const def = Game.BALL_TYPES ? Game.BALL_TYPES[id] : { name: id, desc: '', color: '#fff' };
      const currentDmg = Game.State.ballDamage(id);
      const currentDeploySec = Game.State.ballDeployRateSec(id).toFixed(2);
      const dmgCost = Game.State.upgradeBallDmgCost(id);
      const countCost = Game.State.upgradeBallCountCost(id);
      const rateCost = Game.State.upgradeBallRateCost(id);

      if (ball.unlocked) {
        const maxAllowed = (ball.count || 0) + extraSlots;
        const activeCount = Game.Engine?.getActiveCountForType ? Game.Engine.getActiveCountForType(id) : 0;
        const isWaiting = activeCount >= maxAllowed && maxAllowed > 0;

        const totalCountDisplay = extraSlots > 0 
          ? `${maxAllowed} <span style="color:#ffd700;">(+${extraSlots})</span>` 
          : maxAllowed;

        const spawnStatusHtml = isWaiting
          ? `<span class="spawn-status waiting" style="color: #ff9800; font-weight: bold; font-size: 0.8em; margin-left: 6px;">[WAITING FOR SLOT]</span>`
          : `<span class="spawn-status spawning" style="color: #4caf50; font-weight: bold; font-size: 0.8em; margin-left: 6px;">[SPAWNING]</span>`;

        const progressInfo = Game.Engine?.getSpawnProgress ? Game.Engine.getSpawnProgress(id) : { pct: 0, remainingSec: 0 };
        const barWidth = isWaiting ? 100 : Math.min(100, Math.max(0, progressInfo.pct));
        const barColor = isWaiting ? '#ff9800' : (def.color || '#4fc3f7');
        const timeText = isWaiting ? 'PAUSED' : `${progressInfo.remainingSec.toFixed(1)}s`;

        html += `
          <div class="ball-card ${isWaiting ? 'status-waiting' : ''}">
            <div class="ball-card-head">
              <span class="ball-dot" style="background:${def.color || '#4fc3f7'};"></span>
              <strong>${def.name || id}</strong>
              <span class="ball-active">Active: ${activeCount}/${totalCountDisplay} ${spawnStatusHtml}</span>
            </div>
            <div class="ball-desc">${def.desc || ''}</div>
            <div class="ball-stats">
              Damage: <strong>${Game.Util.fmt(currentDmg)}</strong> (Lv.${ball.level}) | 
              Deploy Rate: <strong>${currentDeploySec}s</strong>
            </div>

            <div class="deploy-bar-container" style="background: rgba(0,0,0,0.4); border-radius: 4px; height: 14px; width: 100%; position: relative; margin: 8px 0; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
              <div class="deploy-bar-fill" style="width: ${barWidth}%; background: ${barColor}; height: 100%; transition: width 0.1s linear;"></div>
              <span style="position: absolute; width: 100%; text-align: center; top: 0; left: 0; line-height: 14px; font-size: 0.7em; font-weight: bold; color: #fff; text-shadow: 0 0 3px #000;">
                ${timeText}
              </span>
            </div>

            <div class="ball-actions">
              <button class="btn primary small" data-action="buy-dmg" data-id="${id}" ${s.gold < dmgCost ? 'disabled' : ''}>
                +DMG (${Game.Util.fmt(dmgCost)}g)
              </button>
              <button class="btn small" data-action="buy-count" data-id="${id}" ${s.gold < countCost ? 'disabled' : ''}>
                +Count (${Game.Util.fmt(countCost)}g)
              </button>
              <button class="btn small" data-action="buy-rate" data-id="${id}" ${s.gold < rateCost ? 'disabled' : ''}>
                +Rate (${Game.Util.fmt(rateCost)}g)
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
              Unlock (${Game.Util.fmt(unlockCost)}g)
            </button>
          </div>
        `;
      }
    });

    listEl.innerHTML = html;
  }

  function renderActiveTab() {
    const activeTabBtn = document.querySelector('.tab-btn.active');
    if (!activeTabBtn) return;

    const tab = activeTabBtn.getAttribute('data-tab');
    if (tab === 'balls') renderBalls();
    else if (tab === 'upgrades') renderUpgrades();
    else if (tab === 'prestige') renderPrestige();
    else if (tab === 'achievements') renderAchievements();
    else if (tab === 'stats') renderStats();
  }

  function bindTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab-panel').forEach((panel) => {
          panel.classList.remove('active');
        });

        const targetPanel = document.querySelector(`#panel-${tab}`);
        if (targetPanel) targetPanel.classList.add('active');

        renderActiveTab();
      };
    });
  }

  function bindEvents() {
    bindTabs();

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');

      if (action === 'buy-dmg') {
        if (Game.State.buyBallDmgUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'buy-count') {
        if (Game.State.buyBallCountUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
      } else if (action === 'buy-rate') {
        if (Game.State.buyBallRateUpgrade(id)) Game.Engine?.SFX?.upgrade?.();
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
      renderSkills();
    });

    const prestigeBtn = document.querySelector('#prestige-btn');
    if (prestigeBtn) {
      prestigeBtn.onclick = () => {
        const gain = Game.State.getPrestigeGain();
        if (gain <= 0) {
          const s = Game.State.get();
          const totalGold = s.stats?.totalGoldEarned || 0;
          const needed = 1e5;
          showToast('CANNOT ASCEND', totalGold < needed
            ? `Earn at least ${Game.Util.fmt(needed)} total gold this run first (currently ${Game.Util.fmt(totalGold)}).`
            : 'Not enough progress yet to earn any Gems.');
          return;
        }
        if (confirm(`Ascend now for ${gain} Gems? This resets your current run progress!`)) {
          if (Game.State.prestige()) {
            Game.Engine?.resetRun();
            Game.Engine?.SFX?.prestige?.();
            showToast('ASCENSION', `Ascended for +${gain} Gems!`, true);
            renderHeader();
            renderActiveTab();
            renderSkills();
          }
        }
      };
    }

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
            applySettingsToInputs();
            restartAutosaveTimer();
            renderHeader();
            renderActiveTab();
            renderSkills();
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
          applySettingsToInputs();
          restartAutosaveTimer();
          renderHeader();
          renderActiveTab();
          renderSkills();
        } else {
          alert('Invalid save code!');
        }
      };
    }

    bindSettings();

    const hardResetBtn = document.querySelector('#hard-reset-btn');
    if (hardResetBtn) {
      hardResetBtn.onclick = () => {
        if (confirm('CRITICAL WARNING: This will permanently erase ALL save data and progress. Are you completely sure?')) {
          Game.State.hardReset();
          Game.Engine?.resetRun();
          showToast('RESET', 'All save data erased.');
          applySettingsToInputs();
          restartAutosaveTimer();
          renderHeader();
          renderActiveTab();
          renderSkills();
        }
      };
    }
  }

  function init() {
    bindEvents();
    renderHeader();
    renderActiveTab();
    renderSkills();

    setInterval(() => {
      renderHeader();
      renderActiveTab();
      renderSkills();
    }, 250);
  }

  return {
    init,
    renderHeader,
    renderBalls,
    renderActiveTab,
    renderSkills,
    showToast
  };
})();
