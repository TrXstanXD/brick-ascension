// ============================================================
// STATE.JS - Primary state holder, persistence, upgrade math
// ============================================================
window.Game = window.Game || {};

Game.State = (function () {
  const STORAGE_KEY = 'idle_breakout_save_v1';

  let state = createDefaultState();

  function createDefaultState() {
    console.log('[DEBUG State] Creating default clean state...');
    const balls = {};
    Game.BALL_ORDER.forEach((id) => {
      const def = Game.BALL_TYPES[id];
      balls[id] = {
        unlocked: id === 'basic',
        count: id === 'basic' ? 1 : 0,
        dmgLevel: 1,
        countCost: def.baseCost,
        dmgCost: def.baseDmgCost
      };
    });

    return {
      version: 1,
      gold: 0,
      gems: 0,
      level: 1,
      lastSaveTime: Date.now(),
      balls: balls,
      globalUpgrades: {},   // Map of upgrade_id -> level
      prestigeUpgrades: {}, // Map of prestige_id -> level
      achievementsUnlocked: {},
      stats: {
        totalGoldEarned: 0,
        totalGoldSpent: 0,
        bricksDestroyed: 0,
        treasureBricksDestroyed: 0,
        explosiveBricksDestroyed: 0,
        bossesKilled: 0,
        critHits: 0,
        biggestHit: 0,
        ballsSpawned: 0,
        upgradesBought: 0,
        prestigeCount: 0,
        playTimeSec: 0,
        runTimeSec: 0
      },
      settings: {
        sfxVolume: 0.8,
        musicVolume: 0.5,
        particles: true,
        screenShake: true,
        showDamageNumbers: true,
        autosaveSec: 10
      }
    };
  }

  // ---------------- GETTERS ----------------
  function get() { return state; }

  function costFor(baseCost, mult, level) {
    return Math.ceil(baseCost * Math.pow(mult, level));
  }

  function globalUpgradeLevel(id) {
    return state.globalUpgrades[id] || 0;
  }

  function prestigeUpgradeLevel(id) {
    return state.prestigeUpgrades[id] || 0;
  }

  // ---------------- CALCULATIONS ----------------
  function ballDamage(id) {
    const def = Game.BALL_TYPES[id];
    const b = state.balls[id];
    if (!b || !b.unlocked) return 0;

    let dmg = def.baseDmg + (b.dmgLevel - 1) * def.dmgStep;

    // Apply global upgrade multipliers
    const gPowerLvl = globalUpgradeLevel('ball_power');
    if (gPowerLvl > 0) {
      const u = Game.GLOBAL_UPGRADES.find(x => x.id === 'ball_power');
      if (u) dmg *= (1 + gPowerLvl * u.perLevel);
    }

    // Apply prestige upgrade multipliers
    const pPowerLvl = prestigeUpgradeLevel('p_ball_power');
    if (pPowerLvl > 0) {
      const u = Game.PRESTIGE_UPGRADES.find(x => x.id === 'p_ball_power');
      if (u) dmg *= (1 + pPowerLvl * u.perLevel);
    }

    return Math.max(1, Math.round(dmg));
  }

  // ---------------- PURCHASES ----------------
  function buyBallCount(id) {
    const b = state.balls[id];
    const def = Game.BALL_TYPES[id];
    if (!b) return false;

    if (!b.unlocked) {
      if (state.gold < def.unlockCost) return false;
      state.gold -= def.unlockCost;
      state.stats.totalGoldSpent += def.unlockCost;
      b.unlocked = true;
      b.count = 1;
      b.countCost = Math.ceil(def.baseCost * def.costMult);
      state.stats.upgradesBought++;
      save();
      return true;
    }

    if (state.gold < b.countCost) return false;
    state.gold -= b.countCost;
    state.stats.totalGoldSpent += b.countCost;
    b.count++;
    b.countCost = Math.ceil(b.countCost * def.costMult);
    state.stats.upgradesBought++;
    save();
    return true;
  }

  function buyBallDamage(id) {
    const b = state.balls[id];
    const def = Game.BALL_TYPES[id];
    if (!b || !b.unlocked) return false;

    if (state.gold < b.dmgCost) return false;
    state.gold -= b.dmgCost;
    state.stats.totalGoldSpent += b.dmgCost;
    b.dmgLevel++;
    b.dmgCost = Math.ceil(b.dmgCost * def.costMult);
    state.stats.upgradesBought++;
    save();
    return true;
  }

  function buyGlobalUpgrade(id) {
    const u = Game.GLOBAL_UPGRADES.find(x => x.id === id);
    if (!u) return false;

    const lvl = globalUpgradeLevel(id);
    if (u.cap !== undefined && lvl * u.perLevel >= u.cap) return false;

    const cost = costFor(u.baseCost, u.costMult, lvl);
    if (state.gold < cost) return false;

    state.gold -= cost;
    state.stats.totalGoldSpent += cost;
    state.globalUpgrades[id] = lvl + 1;
    state.stats.upgradesBought++;
    console.log(`[DEBUG State] Purchased Global Upgrade ${id} -> Lv.${state.globalUpgrades[id]}`);
    save();
    return true;
  }

  function buyPrestigeUpgrade(id) {
    const u = Game.PRESTIGE_UPGRADES.find(x => x.id === id);
    if (!u) return false;

    const lvl = prestigeUpgradeLevel(id);
    const cost = costFor(u.baseCost, u.costMult, lvl);
    if (state.gems < cost) return false;

    state.gems -= cost;
    state.prestigeUpgrades[id] = lvl + 1;
    console.log(`[DEBUG State] Purchased Prestige Upgrade ${id} -> Lv.${state.prestigeUpgrades[id]}`);
    save();
    return true;
  }

  // ---------------- PRESTIGE RESET ----------------
  function gemsOnPrestige() {
    const earned = state.stats.totalGoldEarned || 0;
    const calc = Math.floor(earned / 100000);
    return Math.max(0, calc);
  }

  function doPrestige() {
    const gain = gemsOnPrestige();
    if (gain < 1) return false;

    state.gems += gain;
    state.gold = 0;
    state.level = 1;
    state.globalUpgrades = {}; // Reset global gold upgrades

    Game.BALL_ORDER.forEach((id) => {
      const def = Game.BALL_TYPES[id];
      state.balls[id] = {
        unlocked: id === 'basic',
        count: id === 'basic' ? 1 : 0,
        dmgLevel: 1,
        countCost: def.baseCost,
        dmgCost: def.baseDmgCost
      };
    });

    state.stats.prestigeCount++;
    state.stats.runTimeSec = 0;
    console.log('[DEBUG State] Prestiged! Retained Prestige Upgrades:', state.prestigeUpgrades);
    save();
    return true;
  }

  // ---------------- PERSISTENCE ----------------
  function isStorageAvailable() {
    try {
      const k = '__test__';
      localStorage.setItem(k, k);
      localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function save() {
    if (!isStorageAvailable()) {
      console.warn('[DEBUG Save] localStorage is not available!');
      return;
    }
    state.lastSaveTime = Date.now();
    try {
      const payload = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, payload);
      console.log('[DEBUG Save] Game state saved successfully!', {
        globalUpgrades: state.globalUpgrades,
        prestigeUpgrades: state.prestigeUpgrades,
        gold: state.gold,
        gems: state.gems
      });
    } catch (e) {
      console.error('[DEBUG Save] Failed to save game state:', e);
    }
  }

  function load() {
    if (!isStorageAvailable()) {
      console.warn('[DEBUG Load] localStorage not available.');
      return false;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        console.log('[DEBUG Load] No save key found in localStorage.');
        return false;
      }

      const loaded = JSON.parse(raw);
      console.log('[DEBUG Load] Raw JSON loaded from localStorage:', loaded);
      
      state.gold = loaded.gold ?? 0;
      state.gems = loaded.gems ?? 0;
      state.level = loaded.level ?? 1;
      state.lastSaveTime = loaded.lastSaveTime || Date.now();

      // Deep restore objects
      state.globalUpgrades = loaded.globalUpgrades || {};
      state.prestigeUpgrades = loaded.prestigeUpgrades || {};
      state.achievementsUnlocked = loaded.achievementsUnlocked || {};

      if (loaded.balls) {
        Object.keys(loaded.balls).forEach((id) => {
          if (state.balls[id]) {
            Object.assign(state.balls[id], loaded.balls[id]);
          }
        });
      }

      if (loaded.stats) Object.assign(state.stats, loaded.stats);
      if (loaded.settings) Object.assign(state.settings, loaded.settings);

      console.log('[DEBUG Load] State successfully restored in memory:', {
        globalUpgrades: state.globalUpgrades,
        prestigeUpgrades: state.prestigeUpgrades
      });

      return true;
    } catch (e) {
      console.error('[DEBUG Load] Failed to parse save:', e);
      return false;
    }
  }

  function exportSave() {
    save();
    return btoa(JSON.stringify(state));
  }

  function importSave(str) {
    try {
      const json = atob(str.trim());
      const data = JSON.parse(json);
      if (typeof data !== 'object' || data === null) return false;

      state = createDefaultState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      load();
      return true;
    } catch (e) {
      console.error('[DEBUG Import] Invalid save string:', e);
      return false;
    }
  }

  function hardReset() {
    console.log('[DEBUG State] Performing HARD RESET');
    state = createDefaultState();
    if (isStorageAvailable()) {
      localStorage.removeItem(STORAGE_KEY);
    }
    save();
  }

  // Initialize load automatically on startup
  load();

  return {
    get,
    costFor,
    globalUpgradeLevel,
    prestigeUpgradeLevel,
    ballDamage,
    buyBallCount,
    buyBallDamage,
    buyGlobalUpgrade,
    buyPrestigeUpgrade,
    gemsOnPrestige,
    doPrestige,
    isStorageAvailable,
    save,
    load,
    exportSave,
    importSave,
    hardReset
  };
})();
