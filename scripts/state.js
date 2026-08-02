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
      particles: true,
      showDamageNumbers: true
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
      biggestHit: 0
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
      globalDamage: 0,
      globalSpeed: 0,
      fireRate: 0,
      critChance: 0,
      critDamage: 0,
      brickHpReduce: 0
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

  function save() {
    try {
      localStorage.setItem('brick_ascension_save', JSON.stringify(state));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem('brick_ascension_save');
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign({}, DEFAULT_STATE, parsed);
        state.balls = Object.assign({}, DEFAULT_STATE.balls, parsed.balls || {});
        state.upgrades = Object.assign({}, DEFAULT_STATE.upgrades, parsed.upgrades || {});
        state.stats = Object.assign({}, DEFAULT_STATE.stats, parsed.stats || {});
      }
    } catch (e) {
      console.warn('Failed to load save, resetting to default:', e);
      state = JSON.parse(JSON.stringify(DEFAULT_STATE));
    }
  }

  // --- STAT MULTIPLIERS ---
  function damageMultiplier() {
    const lvl = state.upgrades.globalDamage || 0;
    return (1 + lvl * 0.2) * Math.pow(1.1, state.prestigePoints || 0);
  }

  function speedMultiplier() {
    const lvl = state.upgrades.globalSpeed || 0;
    return 1 + lvl * 0.05;
  }

  function fireRateMultiplier() {
    const lvl = state.upgrades.fireRate || 0;
    return Math.max(0.2, 1 - lvl * 0.04);
  }

  function critChance() {
    const lvl = state.upgrades.critChance || 0;
    return 0.05 + lvl * 0.02;
  }

  function critMultiplier() {
    const lvl = state.upgrades.critDamage || 0;
    return 2.0 + lvl * 0.25;
  }

  function brickHpScaleReduction() {
    const lvl = state.upgrades.brickHpReduce || 0;
    return Math.min(0.5, lvl * 0.03);
  }

  // --- BALL CALCULATIONS ---
  const BASE_BALL_COSTS = {
    basic: 10,
    plasma: 2500,
    sniper: 18000,
    poison: 120000,
    cannon: 850000,
    scatter: 5000000
  };

  function ballDamage(typeId) {
    const b = state.balls[typeId];
    if (!b) return 1;
    const base = Game.BALL_TYPES && Game.BALL_TYPES[typeId] ? Game.BALL_TYPES[typeId].baseDamage || 1 : 1;
    const lvl = Math.max(1, b.level || 1);
    // Base formula scaling with ball level
    const dmg = base * Math.pow(1.15, lvl - 1) + (lvl - 1) * 0.5;
    return Math.max(1, Math.floor(dmg * damageMultiplier()));
  }

  function upgradeBallDmgCost(typeId) {
    const b = state.balls[typeId];
    if (!b) return 10;
    const base = BASE_BALL_COSTS[typeId] || 10;
    const lvl = Math.max(1, b.level || 1);
    return Math.floor(base * Math.pow(1.22, lvl - 1) + lvl * 5);
  }

  function upgradeBallCountCost(typeId) {
    const b = state.balls[typeId];
    if (!b) return 50;
    const base = (BASE_BALL_COSTS[typeId] || 10) * 5;
    const count = Math.max(0, b.count || 0);
    return Math.floor(base * Math.pow(1.8, count) + count * 25);
  }

  function buyBallDmgUpgrade(typeId) {
    const cost = upgradeBallDmgCost(typeId);
    if ((state.gold || 0) >= cost) {
      state.gold -= cost;
      state.balls[typeId].level = (state.balls[typeId].level || 1) + 1;
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
      save();
      return true;
    }
    return false;
  }

  function unlockBall(typeId) {
    const cost = BASE_BALL_COSTS[typeId] || 1000;
    if ((state.gold || 0) >= cost && !state.balls[typeId].unlocked) {
      state.gold -= cost;
      state.balls[typeId].unlocked = true;
      state.balls[typeId].count = Math.max(1, state.balls[typeId].count || 1);
      save();
      return true;
    }
    return false;
  }

  function checkAchievements(onUnlocked) {
    if (!Game.ACHIEVEMENTS) return;
    Game.ACHIEVEMENTS.forEach((ach) => {
      if (!state.achievements[ach.id] && ach.condition(state)) {
        state.achievements[ach.id] = true;
        if (onUnlocked) onUnlocked(ach);
      }
    });
  }

  load();

  return {
    get, save, load,
    damageMultiplier, speedMultiplier, fireRateMultiplier,
    critChance, critMultiplier, brickHpScaleReduction,
    ballDamage, upgradeBallDmgCost, upgradeBallCountCost,
    buyBallDmgUpgrade, buyBallCountUpgrade, unlockBall,
    checkAchievements
  };
})();
