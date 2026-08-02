// ============================================================
// DATA.JS - Static game data: ball types, brick types, upgrades, achievements
// ============================================================
window.Game = window.Game || {};

// ---------------- BALL TYPES ----------------
// Each ball type is a distinct "weapon" with its own AI/behavior.
Game.BALL_TYPES = {
  basic: {
    id: 'basic', name: 'Basic Ball',
    desc: 'A reliable all-rounder. No special tricks, just steady damage.',
    baseDamage: 1, unlockCost: 0, color: '#4fc3f7', glow: '#8fe3ff',
    speed: 6.2, behavior: 'basic', baseCount: 1
  },
  plasma: {
    id: 'plasma', name: 'Plasma Ball',
    desc: 'Explodes on impact, dealing splash damage to nearby bricks.',
    baseDamage: 3, unlockCost: 300, color: '#ba68c8', glow: '#e6b8f5',
    speed: 5.4, behavior: 'splash', splashRadius: 58, splashFalloff: 0.5, baseCount: 1
  },
  sniper: {
    id: 'sniper', name: 'Sniper Ball',
    desc: 'Flies in a straight line and pierces through every brick it touches.',
    baseDamage: 9, unlockCost: 2500, color: '#ff8a65', glow: '#ffd1bd',
    speed: 11, behavior: 'pierce', baseCount: 1
  },
  poison: {
    id: 'poison', name: 'Poison Ball',
    desc: 'Weak on impact, but poisons bricks, dealing damage over time (stacks).',
    baseDamage: 1.2, unlockCost: 18000, color: '#9ccc65', glow: '#d4f0a8',
    speed: 5.2, behavior: 'poison', poisonDPS: 3, poisonDuration: 5000, poisonMaxStacks: 5, baseCount: 1
  },
  cannon: {
    id: 'cannon', name: 'Cannon Ball',
    desc: 'Slow and heavy, but hits like a truck and shreds shields instantly.',
    baseDamage: 24, unlockCost: 120000, color: '#8d6e63', glow: '#d7ccc8',
    speed: 3.1, behavior: 'heavy', baseCount: 1
  },
  scatter: {
    id: 'scatter', name: 'Scatter Ball',
    desc: 'Fragments into smaller shards on its first hit, each dealing damage.',
    baseDamage: 2.4, unlockCost: 800000, color: '#ffd54f', glow: '#fff2b3',
    speed: 7.4, behavior: 'scatter', fragments: 3, baseCount: 1
  }
};

Game.BALL_ORDER = ['basic', 'plasma', 'sniper', 'poison', 'cannon', 'scatter'];

// ---------------- BRICK SPECIAL TYPES ----------------
Game.BRICK_TYPES = {
  normal:    { id: 'normal',    label: '',        color: null },
  shield:    { id: 'shield',    label: 'SHIELD',  color: '#90caf9', shieldHits: 3 },
  heal:      { id: 'heal',      label: 'HEAL',    color: '#66bb6a', healPct: 0.02 },
  explosive: { id: 'explosive', label: 'BOOM',    color: '#ef5350', blastRadius: 70 },
  moving:    { id: 'moving',    label: '',        color: '#ffb74d', moveSpeed: 0.6 },
  treasure:  { id: 'treasure',  label: '$$$',     color: '#ffd700', goldMult: 8 },
  boss:      { id: 'boss',      label: 'BOSS',    color: '#8e24aa', hpMult: 40 }
};

// ---------------- GLOBAL UPGRADES (bought with Gold) ----------------
Game.GLOBAL_UPGRADES = [
  { id: 'allDamage',  name: 'Sharpened Impact',  desc: '+2% damage for all balls',        baseCost: 50,    costMult: 1.15, perLevel: 0.02, stat: 'damageMult' },
  { id: 'goldGain',   name: 'Golden Touch',      desc: '+3% gold earned from bricks',     baseCost: 75,    costMult: 1.15, perLevel: 0.03, stat: 'goldMult' },
  { id: 'critChance', name: 'Precision Training',desc: '+0.5% critical hit chance',       baseCost: 200,   costMult: 1.20, perLevel: 0.005, stat: 'critChance', cap: 0.5 },
  { id: 'critMult',   name: 'Devastation',       desc: '+8% critical hit damage',         baseCost: 150,   costMult: 1.18, perLevel: 0.08, stat: 'critMult' },
  { id: 'ballSpeed',  name: 'Velocity Boost',    desc: '+2% ball movement speed',         baseCost: 100,   costMult: 1.15, perLevel: 0.02, stat: 'speedMult', cap: 1.0 },
  { id: 'fireRate',   name: 'Rapid Deployment',  desc: '-1.5% spawn delay for all balls', baseCost: 120,   costMult: 1.16, perLevel: 0.015, stat: 'fireRateMult', cap: 0.7 },
  { id: 'offlineRate',name: 'Automation Core',   desc: '+5% offline earning efficiency',  baseCost: 500,   costMult: 1.20, perLevel: 0.05, stat: 'offlineMult', cap: 1.0 },
  { id: 'brickWeaken',name: 'Structural Analysis', desc: '-0.5% brick HP scaling per level (weakens future bricks)', baseCost: 1000, costMult: 1.25, perLevel: 0.005, stat: 'brickWeaken', cap: 0.3 }
];

// ---------------- PRESTIGE UPGRADES (bought with Gems, permanent) ----------------
Game.PRESTIGE_UPGRADES = [
  { id: 'gemGold',    name: 'Astral Wealth',    desc: '+10% gold earned per level',        baseCost: 1, costMult: 1.6, perLevel: 0.10, stat: 'gemGoldMult' },
  { id: 'gemDamage',  name: 'Astral Might',     desc: '+10% ball damage per level',        baseCost: 1, costMult: 1.6, perLevel: 0.10, stat: 'gemDamageMult' },
  { id: 'gemStart',   name: 'Head Start',       desc: '+500 starting gold per level',      baseCost: 1, costMult: 1.5, perLevel: 500,  stat: 'gemStartGold' },
  { id: 'gemOffline', name: 'Chrono Cache',     desc: '+2 hours max offline progress',     baseCost: 2, costMult: 1.7, perLevel: 2,    stat: 'gemOfflineHours' },
  { id: 'gemSlot',    name: 'Reinforced Cannon',desc: '+1 max ball count for every type',  baseCost: 3, costMult: 2.0, perLevel: 1,    stat: 'gemBallSlots' }
];

// ---------------- SKILLS (active abilities) ----------------
Game.SKILLS = [
  { id: 'meteor',   name: 'Meteor Strike', desc: 'Deal massive damage to a random brick', cooldown: 20000, unlockLevel: 5 },
  { id: 'goldrain', name: 'Gold Rain',     desc: 'Instantly gain 10s worth of gold income', cooldown: 45000, unlockLevel: 10 },
  { id: 'frenzy',   name: 'Ball Frenzy',   desc: 'All balls fire 3x faster for 10 seconds', cooldown: 60000, unlockLevel: 15 },
  { id: 'nuke',     name: 'Brick Nuke',    desc: 'Deal damage equal to 25% of every brick\'s max HP', cooldown: 90000, unlockLevel: 25 }
];

// ---------------- ACHIEVEMENTS ----------------
// Procedurally built milestone tracks (real conditions, real rewards) plus a handful of
// flavorful one-offs. This yields a genuine, checkable list rather than a padded fake one.
(function buildAchievements() {
  const list = [];

  function milestone(prefix, name, thresholds, statPath, rewardFn, descFn) {
    thresholds.forEach((t, i) => {
      list.push({
        id: `${prefix}_${i}`,
        name: `${name} ${i + 1}`,
        desc: descFn(t),
        check: (s) => Game.Util.getPath(s, statPath) >= t,
        reward: rewardFn(t),
        hidden: false
      });
    });
  }

  milestone('bricks', 'Brick Breaker', [50, 250, 1000, 5000, 25000, 100000, 500000, 2000000],
    'stats.bricksDestroyed',
    (t) => (s) => { s.bonuses.goldMultFlat += 0.01; },
    (t) => `Destroy ${Game.Util.fmt(t)} bricks total.`);

  milestone('gold', 'Gold Hoarder', [1000, 10000, 100000, 1e6, 10e6, 100e6, 1e9, 1e12],
    'stats.totalGoldEarned',
    (t) => (s) => { s.bonuses.goldMultFlat += 0.01; },
    (t) => `Earn ${Game.Util.fmt(t)} total gold.`);

  milestone('level', 'Depth Diver', [5, 10, 25, 50, 100, 250, 500, 1000],
    'level',
    (t) => (s) => { s.bonuses.damageMultFlat += 0.02; },
    (t) => `Reach level ${t}.`);

  milestone('prestige', 'Ascendant', [1, 3, 5, 10, 25, 50],
    'stats.prestigeCount',
    (t) => (s) => { s.bonuses.gemGainFlat += 0.05; },
    (t) => `Prestige ${t} time(s).`);

  milestone('crit', 'Lucky Streak', [10, 100, 1000, 10000],
    'stats.critHits',
    (t) => (s) => { s.bonuses.critMultFlat += 0.02; },
    (t) => `Land ${Game.Util.fmt(t)} critical hits.`);

  milestone('bosses', 'Boss Slayer', [1, 5, 15, 50, 150],
    'stats.bossesKilled',
    (t) => (s) => { s.bonuses.damageMultFlat += 0.03; },
    (t) => `Defeat ${t} boss brick(s).`);

  milestone('playtime', 'Dedicated', [1800, 18000, 90000, 360000],
    'stats.playTimeSec',
    (t) => (s) => { s.bonuses.offlineMultFlat += 0.05; },
    (t) => `Play for ${Math.round(t / 60)} minutes total.`);

  Game.BALL_ORDER.forEach((id) => {
    list.push({
      id: `unlock_${id}`,
      name: `Recruit: ${Game.BALL_TYPES[id].name}`,
      desc: `Unlock the ${Game.BALL_TYPES[id].name}.`,
      check: (s) => s.balls[id].unlocked,
      reward: (s) => { s.bonuses.damageMultFlat += 0.02; }
    });
    [10, 25, 50, 100].forEach((c) => {
      list.push({
        id: `count_${id}_${c}`,
        name: `${Game.BALL_TYPES[id].name} Swarm x${c}`,
        desc: `Own ${c} ${Game.BALL_TYPES[id].name}s at once.`,
        check: (s) => s.balls[id].count >= c,
        reward: (s) => { s.bonuses.goldMultFlat += 0.01; }
      });
    });
  });

  // Flavorful one-offs
  list.push(
    { id: 'first_blood', name: 'First Blood', desc: 'Destroy your very first brick.', check: (s) => s.stats.bricksDestroyed >= 1, reward: (s) => {} },
    { id: 'window_shopper', name: 'Window Shopper', desc: 'Buy your first upgrade.', check: (s) => s.stats.upgradesBought >= 1, reward: (s) => {} },
    { id: 'speedrunner', name: 'Speedrunner', desc: 'Reach level 10 within 10 minutes of starting a run.', hidden: true, check: (s) => s.level >= 10 && s.stats.runTimeSec <= 600, reward: (s) => { s.bonuses.damageMultFlat += 0.05; } },
    { id: 'pacifist_no', name: 'Overkill', desc: 'Deal over 1,000,000 damage in a single hit.', hidden: true, check: (s) => s.stats.biggestHit >= 1000000, reward: (s) => { s.bonuses.critMultFlat += 0.05; } },
    { id: 'treasure_hunter', name: 'Treasure Hunter', desc: 'Destroy 100 treasure bricks.', check: (s) => s.stats.treasureBricksDestroyed >= 100, reward: (s) => { s.bonuses.goldMultFlat += 0.03; } },
    { id: 'exterminator', name: 'Exterminator', desc: 'Destroy 500 explosive bricks.', check: (s) => s.stats.explosiveBricksDestroyed >= 500, reward: (s) => { s.bonuses.damageMultFlat += 0.02; } },
    { id: 'completionist', name: 'Full Arsenal', desc: 'Unlock every ball type.', check: (s) => Game.BALL_ORDER.every((id) => s.balls[id].unlocked), reward: (s) => { s.bonuses.damageMultFlat += 0.10; } }
  );

  Game.ACHIEVEMENTS = list;
})();
