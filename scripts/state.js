// ============================================================
// STATE.JS - Central state management, ball damage, & upgrade costs
// ============================================================
window.Game = window.Game || {};

Game.State = (function () {
  const DEFAULT_STATE = {
    gold: 0,
    diamonds: 0,
    prestigePoints: 0,
    level: 1,
    frenzyUntil: 0,
    lastSaveTime: 0,
    lastGpsSample: 0,
    settings: {
      sfxVolume: 0.5,
      musicVolume: 0.5,
      particles: true,
      screenShake: true,
      showDamageNumbers: true,
      autosaveInterval: 30
    },
    stats: {
      playTimeSec: 0,
      runTimeSec: 0,
      totalGoldEarned: 0,
      bricksDestroyed: 0,
      bossesKilled: 0,
      treasureBricksDestroyed: 0,
      explosiveBricksDestroyed: 0,
      ballsSpawned: 0,
      critHits: 0,
      biggestHit: 0,
      upgradesBought: 0,
      prestigeCount: 0
    },
    bonuses: {
      goldMultFlat: 0,
      damageMultFlat: 0,
      critMultFlat: 0,
      gemGainFlat: 0,
      offlineMultFlat: 0
    },
    balls: {
      basic: { unlocked: true, level: 1, count: 1, rateLevel: 0 },
      plasma: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      sniper: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      poison: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      cannon: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      scatter: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      homing: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      chain: { unlocked: false, level: 1, count: 0, rateLevel: 0 },
      void: { unlocked: false, level: 1, count: 0, rateLevel: 0 }
    },
    upgrades: {
      allDamage: 0,
      goldGain: 0,
      critChance: 0,
      critMult: 0,
      ballSpeed: 0,
      offlineRate: 0,
      brickWeaken: 0
    },
    prestigeUpgrades: {
      gemGold: 0,
      gemDamage: 0,
      gemStart: 0,
      gemOffline: 0,
      gemSlot: 0
    },
    skills: {
      meteor: { lastUsed: 0 },
      goldrain: { lastUsed: 0 },
      frenzy: { lastUsed: 0 },
      nuke: { lastUsed: 0 }
    },
    achievements: {}
  };

  let state = JSON.parse(JSON.stringify(DEFAULT_STATE));

  function get() {
    return state;
  }

  function checkStoragePersistence() {
    try {
      localStorage.setItem('__test_storage', '1');
      localStorage.removeItem('__test_storage');
      return true;
    } catch (e) {
      return false;
    }
  }

  function save() {
    try {
      state.lastSaveTime = Date.now();
      localStorage.setItem('brick_ascension_save', JSON.stringify(state));
      return true;
    } catch (e) {
      console.warn('Failed to save state:', e);
      return false;
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem('brick_ascension_save');
      if (raw) {
        importSaveString(raw);
      }
    } catch (e) {
      console.warn('Failed to load save, resetting to default:', e);
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  function importSaveString(raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      state = Object.assign({}, DEFAULT_STATE, parsed);
      state.settings = Object.assign({}, DEFAULT_STATE.settings, parsed.settings || {});
      state.stats = Object.assign({}, DEFAULT_STATE.stats, parsed.stats || {});
      state.bonuses = Object.assign({}, DEFAULT_STATE.bonuses, parsed.bonuses || {});
      state.balls = Object.assign({}, DEFAULT_STATE.balls, parsed.balls || {});
      
      // Ensure rateLevel exists on loaded state
      Object.keys(state.balls).forEach((id) => {
        if (state.balls[id].rateLevel === undefined) state.balls[id].rateLevel = 0;
      });

      state.upgrades = Object.assign({}, DEFAULT_STATE.upgrades, parsed.upgrades || {});
      state.prestigeUpgrades = Object.assign({}, DEFAULT_STATE.prestigeUpgrades, parsed.prestigeUpgrades || {});
      state.skills = Object.assign({}, DEFAULT_STATE.skills, parsed.skills || {});
      state.achievements = Object.assign({}, DEFAULT_STATE.achievements, parsed.achievements || {});
      
      recalculateAchievementRewards();
      return true;
    } catch (e) {
      console.error('Invalid save format:', e);
      return false;
    }
  }

  function exportSaveString() {
    return JSON.stringify(state);
  }

  function hardReset() {
    state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    save();
  }

  function recalculateAchievementRewards() {
    state.bonuses = JSON.parse(JSON.stringify(DEFAULT_STATE.bonuses));
    if (!Game.ACHIEVEMENTS) return;
    Game.ACHIEVEMENTS.forEach((ach) => {
      if (state.achievements[ach.id] && typeof ach.reward === 'function') {
        try {
          ach.reward(state);
        } catch (e) {}
      }
    });
  }

  function offlineMaxHours() {
    const gemLvl = state.prestigeUpgrades?.gemOffline || 0;
    return 2 + gemLvl * 2; // 2h base, +2h per Chrono Cache level
  }

  function offlineEfficiencyMultiplier() {
    const lvl = state.upgrades?.offlineRate || 0;
    const bonus = state.bonuses?.offlineMultFlat || 0;
    // Base 50% efficiency while away, boosted by the Automation Core upgrade & achievement bonuses.
    return Math.min(1.5, 0.5 + lvl * 0.05 + bonus);
  }

  let lastOfflineReport = null;
  function consumeOfflineReport() {
    const r = lastOfflineReport;
    lastOfflineReport = null;
    return r;
  }

  function applyOfflineProgress() {
    const now = Date.now();
    const last = state.lastSaveTime || 0;
    if (!last) { state.lastSaveTime = now; return; }

    const elapsedMs = now - last;
    if (elapsedMs < 15000) return; // ignore quick refreshes, nothing meaningful happened

    const cappedMs = Math.min(elapsedMs, offlineMaxHours() * 3600 * 1000);
    const seconds = cappedMs / 1000;

    const fallbackGps = (5 + (state.level || 1) * 2) * goldMultiplier();
    const gps = Math.max(state.lastGpsSample || 0, fallbackGps);
    const efficiency = offlineEfficiencyMultiplier();
    const gained = Math.max(0, Math.floor(gps * seconds * efficiency));

    if (gained > 0) {
      state.gold = (state.gold || 0) + gained;
      state.stats.totalGoldEarned = (state.stats.totalGoldEarned || 0) + gained;
    }

    lastOfflineReport = {
      gained,
      awaySeconds: elapsedMs / 1000,
      cappedSeconds: seconds,
      wasCapped: elapsedMs > cappedMs
    };

    state.lastSaveTime = now;
  }

  function init() {
    load();
    applyOfflineProgress();
    save();
  }

  // --- MULTIPLIERS ---
  function damageMultiplier() {
    const lvl = state.upgrades.allDamage || 0;
    const gemLvl = state.prestigeUpgrades.gemDamage || 0;
    const gemMult = 1 + gemLvl * 0.10;
    const prestigeMult = Math.pow(1.1, state.diamonds || state.prestigePoints || 0);
    const bonus = state.bonuses.damageMultFlat || 0;
    return (1 + lvl * 0.02 + bonus) * gemMult * prestigeMult;
  }

  function goldMultiplier() {
    const lvl = state.upgrades.goldGain || 0;
    const gemLvl = state.prestigeUpgrades.gemGold || 0;
    const gemMult = 1 + gemLvl * 0.10;
    const bonus = state.bonuses.goldMultFlat || 0;
    return (1 + lvl * 0.03 + bonus) * gemMult;
  }

  function speedMultiplier() {
    const lvl = state.upgrades.ballSpeed || 0;
    return 1 + Math.min(1.0, lvl * 0.02);
  }

  function critChance() {
    const lvl = state.upgrades.critChance || 0;
    return Math.min(0.5, 0.05 + lvl * 0.005);
  }

  function critMultiplier() {
    const lvl = state.upgrades.critMult || 0;
    const bonus = state.bonuses.critMultFlat || 0;
    return 2.0 + lvl * 0.08 + bonus;
  }

  function brickHpScaleReduction() {
    const lvl = state.upgrades.brickWeaken || 0;
    return Math.min(0.3, lvl * 0.005);
  }

  // --- BALL CALCULATIONS ---
  function getExtraSlots() {
    return state.prestigeUpgrades.gemSlot || 0;
  }

  function ballDamage(typeId) {
    const b = state.balls[typeId];
    if (!b) return 1;
    const base = Game.BALL_TYPES && Game.BALL_TYPES[typeId] ? Game.BALL_TYPES[typeId].baseDamage || 1 : 1;
    const lvl = Math.max(1, b.level || 1);
    const dmg = base * Math.pow(1.15, lvl - 1);
    return Math.max(1, Math.floor(dmg * damageMultiplier()));
  }

  function ballDeployRateSec(typeId) {
    const b = state.balls[typeId];
    const baseMs = (Game.SPAWN_BASE_MS && Game.SPAWN_BASE_MS[typeId]) || 1000;
    const rateLevel = b ? (b.rateLevel || 0) : 0;
    const mult = Math.max(0.2, 1 - rateLevel * 0.03); // Reduce interval by 3% per upgrade level
    return (baseMs * mult) / 1000;
  }

  function upgradeBallDmgCost(typeId) {
    const b = state.balls[typeId];
    if (!b) return 10;
    const base = Game.BALL_TYPES[typeId]?.unlockCost || 10;
    const baseCost = base === 0 ? 15 : base;
    const lvl = Math.max(1, b.level || 1);
    return Math.floor(baseCost * Math.pow(1.18, lvl - 1));
  }

  function upgradeBallCountCost(typeId) {
    const b = state.balls[typeId];
    if (!b) return 50;
    const base = Game.BALL_TYPES[typeId]?.unlockCost || 10;
    const baseCost = base === 0 ? 50 : base * 1.5;
    const count = Math.max(0, b.count || 0);
    return Math.floor(baseCost * Math.pow(1.65, count));
  }

  function upgradeBallRateCost(typeId) {
    const b = state.balls[typeId];
    if (!b) return 60;
    const base = Game.BALL_TYPES[typeId]?.unlockCost || 10;
    const baseCost = base === 0 ? 60 : base * 1.2;
    const rLvl = Math.max(0, b.rateLevel || 0);
    return Math.floor(baseCost * Math.pow(1.22, rLvl));
  }

  function buyBallDmgUpgrade(typeId) {
    const cost = upgradeBallDmgCost(typeId);
    if ((state.gold || 0) >= cost) {
      state.gold -= cost;
      state.balls[typeId].level = (state.balls[typeId].level || 1) + 1;
      state.stats.upgradesBought = (state.stats.upgradesBought || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function buyBallCountUpgrade(typeId) {
    const cost = upgradeBallCountCost(typeId);
    if ((state.gold || 0) >= cost) {
      state.gold -= cost;
      state.balls[typeId].count = (state.balls[typeId].count || 0) + 1;
      state.stats.upgradesBought = (state.stats.upgradesBought || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function buyBallRateUpgrade(typeId) {
    const cost = upgradeBallRateCost(typeId);
    if ((state.gold || 0) >= cost) {
      state.gold -= cost;
      state.balls[typeId].rateLevel = (state.balls[typeId].rateLevel || 0) + 1;
      state.stats.upgradesBought = (state.stats.upgradesBought || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function unlockBall(typeId) {
    const def = Game.BALL_TYPES[typeId];
    const cost = def ? def.unlockCost : 1000;
    if ((state.gold || 0) >= cost && !state.balls[typeId].unlocked) {
      state.gold -= cost;
      state.balls[typeId].unlocked = true;
      state.balls[typeId].count = Math.max(1, state.balls[typeId].count || 1);
      state.balls[typeId].rateLevel = 0;
      save();
      return true;
    }
    return false;
  }

  // --- GLOBAL & PRESTIGE UPGRADES ---
  function getGlobalUpgradeCost(upgDef) {
    const lvl = state.upgrades[upgDef.id] || 0;
    return Math.floor(upgDef.baseCost * Math.pow(upgDef.costMult, lvl));
  }

  function buyGlobalUpgrade(id) {
    const def = Game.GLOBAL_UPGRADES ? Game.GLOBAL_UPGRADES.find(u => u.id === id) : null;
    if (!def) return false;
    const cost = getGlobalUpgradeCost(def);
    const lvl = state.upgrades[id] || 0;
    if (def.cap !== undefined && (lvl * def.perLevel) >= def.cap) return false;

    if ((state.gold || 0) >= cost) {
      state.gold -= cost;
      state.upgrades[id] = lvl + 1;
      state.stats.upgradesBought = (state.stats.upgradesBought || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function getGemUpgradeCost(upgDef) {
    const lvl = state.prestigeUpgrades[upgDef.id] || 0;
    return Math.floor(upgDef.baseCost * Math.pow(upgDef.costMult, lvl));
  }

  function buyGemUpgrade(id) {
    const def = Game.PRESTIGE_UPGRADES ? Game.PRESTIGE_UPGRADES.find(u => u.id === id) : null;
    if (!def) return false;
    const cost = getGemUpgradeCost(def);
    if ((state.diamonds || 0) >= cost) {
      state.diamonds -= cost;
      state.prestigeUpgrades[id] = (state.prestigeUpgrades[id] || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function getPrestigeGain() {
    const totalGold = state.stats?.totalGoldEarned || 0;
    if (totalGold < 1e5) return 0;
    return Math.floor(Math.pow(totalGold / 1e5, 0.22));
  }

  function prestige() {
    const gain = getPrestigeGain();
    if (gain <= 0) return false;

    state.diamonds = (state.diamonds || 0) + gain;
    state.stats.prestigeCount = (state.stats.prestigeCount || 0) + 1;
    state.gold = (state.prestigeUpgrades.gemStart || 0) * 500;
    state.level = 1;

    Object.keys(state.balls).forEach((id) => {
      state.balls[id].unlocked = (id === 'basic');
      state.balls[id].level = 1;
      state.balls[id].count = id === 'basic' ? 1 : 0;
      state.balls[id].rateLevel = 0;
    });

    Object.keys(state.upgrades).forEach((id) => {
      state.upgrades[id] = 0;
    });

    save();
    return true;
  }

  function checkAchievements(onUnlocked) {
    if (!Game.ACHIEVEMENTS) return;
    Game.ACHIEVEMENTS.forEach((ach) => {
      if (!state.achievements[ach.id]) {
        if (typeof ach.check === 'function' && ach.check(state)) {
          state.achievements[ach.id] = true;
          if (typeof ach.reward === 'function') ach.reward(state);
          if (onUnlocked) onUnlocked(ach);
          save();
        }
      }
    });
  }

  return {
    init, get, save, load, exportSaveString, importSaveString, hardReset, checkStoragePersistence,
    damageMultiplier, goldMultiplier, speedMultiplier, critChance, critMultiplier, brickHpScaleReduction,
    getExtraSlots, ballDamage, ballDeployRateSec, upgradeBallDmgCost, upgradeBallCountCost, upgradeBallRateCost,
    buyBallDmgUpgrade, buyBallCountUpgrade, buyBallRateUpgrade, unlockBall,
    getGlobalUpgradeCost, buyGlobalUpgrade, getGemUpgradeCost, buyGemUpgrade,
    getPrestigeGain, prestige, checkAchievements,
    offlineMaxHours, offlineEfficiencyMultiplier, consumeOfflineReport
  };
})();
