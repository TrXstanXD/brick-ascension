// ============================================================
// UTIL.JS - Shared helper functions
// ============================================================
window.Game = window.Game || {};

Game.Util = (function () {
  const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

  function fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '0';
    const neg = n < 0;
    n = Math.abs(n);
    if (n < 1000) {
      const out = (Number.isInteger(n) ? n : n.toFixed(1));
      return (neg ? '-' : '') + out;
    }
    let tier = Math.floor(Math.log10(n) / 3);
    tier = Math.min(tier, SUFFIXES.length - 1);
    const scaled = n / Math.pow(1000, tier);
    const out = scaled.toFixed(scaled < 10 ? 2 : scaled < 100 ? 1 : 0);
    return (neg ? '-' : '') + out + SUFFIXES[tier];
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(min, max) { return min + Math.random() * (max - min); }
  function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function weightedChoice(entries) {
    // entries: [{value, weight}]
    const total = entries.reduce((a, e) => a + e.weight, 0);
    let r = Math.random() * total;
    for (const e of entries) {
      if (r < e.weight) return e.value;
      r -= e.weight;
    }
    return entries[entries.length - 1].value;
  }

  function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
  }

  function circleRectCollide(cx, cy, cr, rx, ry, rw, rh) {
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx, dy = cy - ny;
    return (dx * dx + dy * dy) < (cr * cr);
  }

  return { fmt, fmtTime, clamp, lerp, rand, randInt, choice, weightedChoice, getPath, circleRectCollide };
})();
