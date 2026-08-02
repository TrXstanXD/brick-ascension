// ============================================================
// STATE.JS - Central game state, economy, prestige, achievements, persistence
// ============================================================
window.Game = window.Game || {};

Game.State = (function () {
  const U = Game.Util;
  const SAVE_KEY = 'idleBreakoutSave_v1';

  function freshBalls() {
    const out = {};
    Game.BALL_ORDER.forEach((id) => {
      const def = Game.BALL_TYPES[id];
      out[id] = {
        unlocked: def.unlockCost === 0,
        dmgLevel: 0,
        count: def.baseCount,
        dmgCost: 25,
        countCost: def.unlockCost === 0 ? 40 : def.unlockCost * 1.4
      };
    });
    return out;
  }

  function defaultState() {
    return {
      version: 1,
      gold: 20,
      gems: 0,
      level: 1,
      balls: freshBalls(),
      globalUpgrades: {}, // id -> level
      prestigeUpgrades: {}, // id -> level
      achievementsUnlocked: {}, // id -> true
      bonuses: { // permanent flat bonuses earned from achievements
        damageMultFlat: 0, goldMultFlat: 0, critMultFlat: 0, gemGainFlat: 0, offlineMultFlat: 0
      },
      skills: { meteor: { lastUsed: 0 }, goldrain: { lastUsed: 0 }, frenzy: { lastUsed: 0 }, nuke: { lastUsed: 0 } },
      frenzyUntil: 0,
      settings: {
        sfxVolume: 0.5, musicVolume: 0.3, particles: true, screenShake: true,
        showDamageNumbers: true, autosaveSec: 10, fpsCap: 60
      },
      stats: {
        bricksDestroyed: 0, totalGoldEarned: 0, runGoldEarned: 0, totalGoldSpent: 0, critHits: 0,
        bossesKilled: 0, treasureBricksDestroyed: 0, explosiveBricksDestroyed: 0,
        upgradesBought: 0, prestigeCount: 0, playTimeSec: 0, runTimeSec: 0,
        biggestHit: 0, ballsSpawned: 0
      },
      lastSaveTime: Date.now(),
      lastActiveTime: Date.now(),
      createdAt: Date.now()
    };
  }

  let s = null;

  function get() { return s; }

  function init() {
    const loaded = load();
    s = loaded || defaultState();
    Game._offlineResult = applyOfflineProgress();
  }

  // ---------------- computed multipliers ----------------
  function globalUpgradeLevel(id) { return s.globalUpgrades[id] || 0; }
  function prestigeUpgradeLevel(id) { return s.prestigeUpgrades[id] || 0; }

  function computeGlobalStat(statName) {
    let val = 0;
    Game.GLOBAL_UPGRADES.filter(u => u.stat === statName).forEach((u) => {
      const lvl = globalUpgradeLevel(u.id);
      let v = lvl * u.perLevel;
      if (u.cap !== undefined) v = Math.min(v, u.cap);
      val += v;
    });
    return val;
  }

  function computePrestigeStat(statName) {
    let val = 0;
    Game.PRESTIGE_UPGRADES.filter(u => u.stat === statName).forEach((u) => {
      const lvl = prestigeUpgradeLevel(u.id);
      val += lvl * u.perLevel;
    });
    return val;
  }

  function damageMultiplier() {
    let m = 1 + computeGlobalStat('damageMult') + s.bonuses.damageMultFlat + computePrestigeStat('gemDamageMult');
    if (Date.now() < s.frenzyUntil) m *= 1.5;
    return m;
  }
  function goldMultiplier() {
    return 1 + computeGlobalStat('goldMult') + s.bonuses.goldMultFlat + computePrestigeStat('gemGoldMult');
  }
  function critChance() { return U.clamp(computeGlobalStat('critChance'), 0, 0.75); }
  function critMultiplier() { return 2 + computeGlobalStat('critMult') + s.bonuses.critMultFlat; }
  function speedMultiplier() { return 1 + computeGlobalStat('speedMult'); }
  function fireRateMultiplier() { return U.clamp(1 - computeGlobalStat('fireRateMult'), 0.3, 1); }
  function offlineEfficiency() { return U.clamp(0.2 + computeGlobalStat('offlineMult') + s.bonuses.offlineMultFlat, 0, 1); }
  function brickHpScaleReduction() { return computeGlobalStat('brickWeaken'); }
  function maxBallSlotsBonus() { return computePrestigeStat('gemBallSlots'); }

  function ballDamage(id) {
    const def = Game.BALL_TYPES[id];
    const b = s.balls[id];
    const base = def.baseDamage * Math.pow(1.13, b.dmgLevel);
    return base * damageMultiplier();
  }

  // ---------------- purchases ----------------
  function costFor(base, mult, level) { return Math.ceil(base * Math.pow(mult, level)); }

  function buyBallDamage(id) {
    const b = s.balls[id];
    if (!b.unlocked) return false;
    const cost = Math.ceil(b.dmgCost);
    if (s.gold < cost) return false;
    s.gold -= cost;
    s.stats.totalGoldSpent += cost;
    b.dmgLevel++;
    b.dmgCost = Math.ceil(b.dmgCost * 1.14);
    s.stats.upgradesBought++;
    return true;
  }

  function buyBallCount(id) {
    const b = s.balls[id];
    const def = Game.BALL_TYPES[id];
    if (!b.unlocked) {
      if (s.gold < def.unlockCost) return false;
      s.gold -= def.unlockCost;
      s.stats.totalGoldSpent += def.unlockCost;
      b.unlocked = true;
      return true;
    }
    const max = def.baseCount + 19 + maxBallSlotsBonus();
    if (b.count >= max) return false;
    const cost = Math.ceil(b.countCost);
    if (s.gold < cost) return false;
    s.gold -= cost;
    s.stats.totalGoldSpent += cost;
    b.count++;
    b.countCost = Math.ceil(b.countCost * 1.35);
    s.stats.upgradesBought++;
    return true;
  }

  function buyGlobalUpgrade(id) {
    const def = Game.GLOBAL_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const lvl = globalUpgradeLevel(id);
    if (def.cap !== undefined && lvl * def.perLevel >= def.cap) return false;
    const cost = costFor(def.baseCost, def.costMult, lvl);
    if (s.gold < cost) return false;
    s.gold -= cost;
    s.stats.totalGoldSpent += cost;
    s.globalUpgrades[id] = lvl + 1;
    s.stats.upgradesBought++;
    return true;
  }

  function buyPrestigeUpgrade(id) {
    const def = Game.PRESTIGE_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const lvl = prestigeUpgradeLevel(id);
    const cost = costFor(def.baseCost, def.costMult, lvl);
    if (s.gems < cost) return false;
    s.gems -= cost;
    s.prestigeUpgrades[id] = lvl + 1;
    return true;
  }

  // ---------------- prestige ----------------
  function gemsOnPrestige() {
  return Math.floor(Math.sqrt(Math.max(0, s.stats.runGoldEarned || 0) / 5e5));
}

  function doPrestige() {
  const gained = gemsOnPrestige();
  if (gained < 1) return false;
  const keep = {
    gems: s.gems + gained + Math.floor(gained * s.bonuses.gemGainFlat),
    prestigeUpgrades: s.prestigeUpgrades,
    achievementsUnlocked: s.achievementsUnlocked,
    bonuses: s.bonuses,
    settings: s.settings,
    stats: s.stats,
    createdAt: s.createdAt
  };
  const fresh = defaultState();
  fresh.gems = keep.gems;
  fresh.prestigeUpgrades = keep.prestigeUpgrades;
  fresh.achievementsUnlocked = keep.achievementsUnlocked;
  fresh.bonuses = keep.bonuses;
  fresh.settings = keep.settings;
  fresh.stats = keep.stats;
  fresh.stats.prestigeCount++;
  fresh.stats.runTimeSec = 0;
  fresh.stats.runGoldEarned = 0; // Reset run gold on ascension
  fresh.createdAt = keep.createdAt;
  fresh.gold = 20 + computePrestigeStatWith(fresh, 'gemStartGold');
  s = fresh;
  return true;
}

  function computePrestigeStatWith(state, statName) {
    let val = 0;
    Game.PRESTIGE_UPGRADES.filter(u => u.stat === statName).forEach((u) => {
      const lvl = state.prestigeUpgrades[u.id] || 0;
      val += lvl * u.perLevel;
    });
    return val;
  }

  // ---------------- achievements ----------------
  function checkAchievements(onUnlock) {
    Game.ACHIEVEMENTS.forEach((a) => {
      if (s.achievementsUnlocked[a.id]) return;
      let ok = false;
      try { ok = !!a.check(s); } catch (e) { ok = false; }
      if (ok) {
        s.achievementsUnlocked[a.id] = true;
        try { a.reward(s); } catch (e) {}
        if (onUnlock) onUnlock(a);
      }
    });
  }

  // ---------------- gold / gain ----------------
  function addGold(amount) {
  const g = amount * goldMultiplier();
  s.gold += g;
  s.stats.totalGoldEarned += g;
  s.stats.runGoldEarned = (s.stats.runGoldEarned || 0) + g;
  return g;
}

  // approximate gold-per-second for offline calc / skill use, based on recent brick value
  function estimatedGps() {
    if (!Game._lastGpsSample) return 0;
    return Game._lastGpsSample;
  }

  // ---------------- save / load ----------------
  function serialize() {
    s.lastSaveTime = Date.now();
    return JSON.stringify(s);
  }

  function isStorageAvailable() {
    try {
      const testKey = '__idleBreakoutStorageTest__';
      localStorage.setItem(testKey, '1');
      const ok = localStorage.getItem(testKey) === '1';
      localStorage.removeItem(testKey);
      return ok;
    } catch (e) { return false; }
  }

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, serialize());
      return true;
    } catch (e) { console.warn('Save failed', e); return false; }
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return migrate(parsed);
    } catch (e) { console.warn('Load failed, starting fresh', e); return null; }
  }

  function migrate(parsed) {
    // shallow-merge onto a default state so new fields introduced later never crash old saves
    const fresh = defaultState();
    function deepMerge(target, src) {
      for (const k in target) {
        if (src[k] === undefined) continue;
        if (typeof target[k] === 'object' && target[k] !== null && !Array.isArray(target[k])) {
          deepMerge(target[k], src[k] || {});
        } else {
          target[k] = src[k];
        }
      }
    }
    deepMerge(fresh, parsed);
    return fresh;
  }

  function exportSave() {
    const data = serialize();
    const b64 = btoa(unescape(encodeURIComponent(data)));
    return b64;
  }

  function importSave(b64) {
    try {
      const json = decodeURIComponent(escape(atob(b64.trim())));
      const parsed = JSON.parse(json);
      s = migrate(parsed);
      save();
      return true;
    } catch (e) { console.warn('Import failed', e); return false; }
  }

  function hardReset() {
    localStorage.removeItem(SAVE_KEY);
    s = defaultState();
  }

  // ---------------- offline progress ----------------
  function applyOfflineProgress() {
    const now = Date.now();
    const away = (now - (s.lastActiveTime || now)) / 1000;
    s.lastActiveTime = now;
    if (away < 30) return { seconds: 0, gold: 0 };
    const maxHours = 2 + computePrestigeStat('gemOfflineHours');
    const cappedSec = Math.min(away, maxHours * 3600);
    const gps = Game._lastGpsSample || (5 + s.level * 2);
    const earned = gps * cappedSec * offlineEfficiency();
    if (earned > 0) addGold(earned);
    s.stats.playTimeSec += 0; // offline time doesn't count as active playtime
    return { seconds: cappedSec, gold: earned };
  }

  return {
    get, init, defaultState,
    globalUpgradeLevel, prestigeUpgradeLevel, computeGlobalStat,
    damageMultiplier, goldMultiplier, critChance, critMultiplier, speedMultiplier,
    fireRateMultiplier, offlineEfficiency, brickHpScaleReduction, maxBallSlotsBonus,
    ballDamage, costFor,
    buyBallDamage, buyBallCount, buyGlobalUpgrade, buyPrestigeUpgrade,
    gemsOnPrestige, doPrestige,
    checkAchievements, addGold, estimatedGps,
    save, load, exportSave, importSave, hardReset, applyOfflineProgress, isStorageAvailable
  };
})();
