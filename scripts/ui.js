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
        const totalCountDisplay = extraSlots > 0 ? `${ball.count} <span style="color:#ffd700;">(+${extraSlots})</span>` : ball.count;
        html += `
          <div class="ball-card">
            <div class="ball-card-head">
              <span class="ball-dot" style="background:${def.color || '#4fc3f7'};"></span>
              <strong>${def.name || id}</strong>
              <span class="ball-active">Count: ${totalCountDisplay}</span>
            </div>
            <div class="ball-desc">${def.desc || ''}</div>
            <div class="ball-stats">
              Damage: <strong>${formatNum(currentDmg)}</strong> (Lv.${ball.level}) | 
              Deploy Rate: <strong>${currentDeploySec}s</strong>
            </div>
            <div class="ball-actions">
              <button class="btn primary small" data-action="buy-dmg" data-id="${id}" ${s.gold < dmgCost ? 'disabled' : ''}>
                +DMG (${formatNum(dmgCost)}g)
              </button>
              <button class="btn small" data-action="buy-count" data-id="${id}" ${s.gold < countCost ? 'disabled' : ''}>
                +Count (${formatNum(countCost)}g)
              </button>
              <button class="btn small" data-action="buy-rate" data-id="${id}" ${s.gold < rateCost ? 'disabled' : ''}>
                +Rate (${formatNum(rateCost)}g)
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
