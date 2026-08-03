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
      basic: { unlocked: true, level: 1, count: 1 },
      plasma: { unlocked: false, level: 1, count: 0 },
      sniper: { unlocked: false, level: 1, count: 0 },
      poison: { unlocked: false, level: 1, count: 0 },
      cannon: { unlocked: false, level: 1, count: 0 },
      scatter: { unlocked: false, level: 1, count: 0 }
    },
    upgrades: {
      allDamage: 0,
      goldGain: 0,
      critChance: 0,
      critMult: 0,
      ballSpeed: 0,
      fireRate: 0,
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
      state.upgrades = Object.assign({}, DEFAULT_STATE.upgrades, parsed.upgrades || {});
      state.prestigeUpgrades = Object.assign({}, DEFAULT_STATE.prestigeUpgrades, parsed.prestigeUpgrades || {});
      state.skills = Object.assign({}, DEFAULT_STATE.skills, parsed.skills || {});
      state.achievements = Object.assign({}, DEFAULT_STATE.achievements, parsed.achievements || {});
      
      // Recalculate passive achievement rewards
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

  function fireRateMultiplier() {
    const lvl = state.upgrades.fireRate || 0;
    return Math.max(0.3, 1 - lvl * 0.015);
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

  function unlockBall(typeId) {
    const def = Game.BALL_TYPES[typeId];
    const cost = def ? def.unlockCost : 1000;
    if ((state.gold || 0) >= cost && !state.balls[typeId].unlocked) {
      state.gold -= cost;
      state.balls[typeId].unlocked = true;
      state.balls[typeId].count = Math.max(1, state.balls[typeId].count || 1);
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

  function buyGlobalUpgrade(upgId) {
    const def = Game.GLOBAL_UPGRADES.find(u => u.id === upgId);
    if (!def) return false;
    const cost = getGlobalUpgradeCost(def);
    if (state.gold >= cost) {
      state.gold -= cost;
      state.upgrades[upgId] = (state.upgrades[upgId] || 0) + 1;
      state.stats.upgradesBought = (state.stats.upgradesBought || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function getPrestigeGain() {
    if (state.level < 10) return 0;
    const bonus = state.bonuses.gemGainFlat || 0;
    const baseGems = Math.floor(Math.pow(state.level / 10, 1.5));
    return Math.floor(baseGems * (1 + bonus));
  }

  function prestige() {
    const gain = getPrestigeGain();
    if (gain <= 0) return false;

    state.diamonds = (state.diamonds || 0) + gain;
    state.stats.prestigeCount = (state.stats.prestigeCount || 0) + 1;

    // Reset run progress
    const startGold = (state.prestigeUpgrades.gemStart || 0) * 500;
    state.gold = startGold;
    state.level = 1;
    state.stats.runTimeSec = 0;

    // Reset ball levels/counts back to baseline
    Game.BALL_ORDER.forEach((id) => {
      const isBasic = id === 'basic';
      state.balls[id] = {
        unlocked: isBasic,
        level: 1,
        count: isBasic ? 1 : 0
      };
    });

    // Reset global gold upgrades
    Object.keys(state.upgrades).forEach(k => state.upgrades[k] = 0);

    save();
    return true;
  }

  function getGemUpgradeCost(upgDef) {
    const lvl = state.prestigeUpgrades[upgDef.id] || 0;
    return Math.floor(upgDef.baseCost * Math.pow(upgDef.costMult, lvl));
  }

  function buyGemUpgrade(upgId) {
    const def = Game.PRESTIGE_UPGRADES.find(u => u.id === upgId);
    if (!def) return false;
    const cost = getGemUpgradeCost(def);
    if (state.diamonds >= cost) {
      state.diamonds -= cost;
      state.prestigeUpgrades[upgId] = (state.prestigeUpgrades[upgId] || 0) + 1;
      save();
      return true;
    }
    return false;
  }

  function checkAchievements(onUnlocked) {
    if (!Game.ACHIEVEMENTS || !Array.isArray(Game.ACHIEVEMENTS)) return;
    
    Game.ACHIEVEMENTS.forEach((ach) => {
      if (!ach || state.achievements[ach.id]) return;

      let isUnlocked = false;
      if (typeof ach.check === 'function') {
        try {
          isUnlocked = ach.check(state);
        } catch (err) {}
      }

      if (isUnlocked) {
        state.achievements[ach.id] = true;
        if (typeof ach.reward === 'function') ach.reward(state);
        if (typeof onUnlocked === 'function') onUnlocked(ach);
        save();
      }
    });
  }

  function init() {
    load();
  }

  return {
    init, get, save, load, hardReset,
    importSaveString, exportSaveString, checkStoragePersistence,
    damageMultiplier, goldMultiplier, speedMultiplier, fireRateMultiplier,
    critChance, critMultiplier, brickHpScaleReduction, getExtraSlots,
    ballDamage, upgradeBallDmgCost, upgradeBallCountCost,
    buyBallDmgUpgrade, buyBallCountUpgrade, unlockBall,
    getGlobalUpgradeCost, buyGlobalUpgrade,
    getPrestigeGain, prestige, getGemUpgradeCost, buyGemUpgrade,
    checkAchievements
  };
})();
