// ============================================================
// ENGINE.JS - Canvas physics, bricks, balls, particles, audio, skills
// ============================================================
window.Game = window.Game || {};

Game.Engine = (function () {
  const U = Game.Util;
  let canvas, ctx, W, H;
  let bricks = [];
  let activeBalls = [];
  let particles = [];
  let floatingTexts = [];
  let spawnTimers = {};
  let cols = 8, brickAreaTop = 8, brickH = 26, brickGap = 3;
  let running = false;
  let lastTime = 0;
  let gpsAccumulator = { gold: 0, time: 0 };

  // callbacks the UI layer can hook into
  const listeners = { levelUp: [], achievement: [], notify: [], goldGain: null };
  function on(event, fn) { if (listeners[event]) listeners[event].push(fn); }
  function emit(event, payload) { (listeners[event] || []).forEach(fn => fn(payload)); }

  // ---------------- AUDIO (synthesized, no external files needed) ----------------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
    }
    return audioCtx;
  }
  function beep(freq, dur, type, vol) {
    const s = Game.State.get();
    if (!s.settings.sfxVolume) return;
    const ac = ensureAudio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.value = (vol !== undefined ? vol : 0.15) * s.settings.sfxVolume;
    osc.connect(gain); gain.connect(ac.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.stop(ac.currentTime + dur);
  }
  const SFX = {
    hit: () => beep(220 + Math.random() * 120, 0.08, 'square', 0.05),
    crit: () => beep(500, 0.12, 'sawtooth', 0.08),
    break: () => beep(140, 0.15, 'triangle', 0.1),
    upgrade: () => beep(660, 0.15, 'sine', 0.12),
    prestige: () => beep(880, 0.4, 'sine', 0.15),
    achievement: () => { beep(523, 0.1, 'sine', 0.12); setTimeout(() => beep(784, 0.2, 'sine', 0.12), 100); },
    levelUp: () => { beep(392, 0.1, 'triangle', 0.1); setTimeout(() => beep(587, 0.15, 'triangle', 0.1), 90); }
  };

  // ---------------- SETUP ----------------
  function init(canvasEl) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
    newLevel(false);
  }

  function resize() {
    const wrap = canvas.parentElement;
    const targetW = Math.min(wrap.clientWidth, 900);
    W = canvas.width = targetW;
    H = canvas.height = Math.round(targetW * 0.62);
  }

  // ---------------- LEVEL / BRICK GENERATION ----------------
  function levelRows(level) {
    return U.clamp(3 + Math.floor(level / 4), 3, 11);
  }

  function brickBaseHp(level) {
    const reduction = 1 - Game.State.brickHpScaleReduction();
    return 8 * Math.pow(level, 1.32) * reduction + level * 2;
  }

  function specialTypeForLevel(level, isEdgeSafe) {
    if (level < 3) return 'normal';
    const weights = [
      { value: 'normal', weight: 55 },
      { value: 'shield', weight: level > 4 ? 12 : 0 },
      { value: 'heal', weight: level > 6 ? 8 : 0 },
      { value: 'explosive', weight: level > 5 ? 10 : 0 },
      { value: 'moving', weight: level > 8 ? 8 : 0 },
      { value: 'treasure', weight: 6 }
    ];
    return U.weightedChoice(weights);
  }

  function newLevel(advance) {
    const s = Game.State.get();
    if (advance) {
      s.level++;
      s.stats.runTimeSec = s.stats.runTimeSec || 0;
      emit('levelUp', s.level);
      SFX.levelUp();
    }
    bricks = [];
    const level = s.level;
    const isBossLevel = level % 10 === 0;
    const rows = levelRows(level);
    const cellW = (W - brickGap * (cols + 1)) / cols;

    if (isBossLevel) {
      // single large boss brick spanning most of the top area
      const bw = cellW * cols * 0.7;
      const bh = brickH * 3;
      const hp = brickBaseHp(level) * Game.BRICK_TYPES.boss.hpMult;
      bricks.push(makeBrick({
        x: (W - bw) / 2, y: brickAreaTop, w: bw, h: bh, hp, type: 'boss', row: 0, col: 0
      }));
      return;
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.08 && level > 2) continue; // occasional gaps for varied layouts
        const type = specialTypeForLevel(level);
        let hp = brickBaseHp(level) * U.rand(0.85, 1.25);
        if (type === 'treasure') hp *= 0.6;
        const x = brickGap + c * (cellW + brickGap);
        const y = brickAreaTop + r * (brickH + brickGap);
        bricks.push(makeBrick({ x, y, w: cellW, h: brickH, hp, type, row: r, col: c }));
      }
    }
  }

  let brickIdCounter = 0;
  function makeBrick(o) {
    return {
      id: brickIdCounter++,
      x: o.x, y: o.y, w: o.w, h: o.h,
      hp: o.hp, maxHp: o.hp,
      type: o.type,
      shieldHits: o.type === 'shield' ? Game.BRICK_TYPES.shield.shieldHits : 0,
      moveDir: Math.random() < 0.5 ? -1 : 1,
      baseX: o.x,
      poisonStacks: 0, poisonUntil: 0, poisonTick: 0,
      alive: true
    };
  }

  // ---------------- BALL SPAWNING ----------------
  const SPAWN_BASE_MS = { basic: 900, plasma: 1100, sniper: 1500, poison: 1000, cannon: 2200, scatter: 800 };

  // Max launch angle (degrees from straight up). Sniper stays narrower since it's meant
  // to fly in a clean line, everything else fans out wide so balls spread across all columns.
  const SPAWN_SPREAD_DEG = { basic: 60, plasma: 60, sniper: 30, poison: 60, cannon: 55, scatter: 65 };

  function spawnBall(typeId) {
    const def = Game.BALL_TYPES[typeId];
    const s = Game.State.get();
    const speed = def.speed * Game.State.speedMultiplier();
    const spreadDeg = SPAWN_SPREAD_DEG[typeId] !== undefined ? SPAWN_SPREAD_DEG[typeId] : 55;
    const angle = U.rand(-spreadDeg, spreadDeg) * (Math.PI / 180);
    const ball = {
      typeId, x: W / 2 + U.rand(-20, 20), y: H - 18,
      vx: Math.sin(angle) * speed, vy: -Math.cos(angle) * speed,
      r: 7, damage: Game.State.ballDamage(typeId),
      hitSet: (def.behavior === 'pierce') ? new Set() : null,
      life: 0, isFragment: false
    };
    activeBalls.push(ball);
    s.stats.ballsSpawned++;
    return ball;
  }

  function spawnFragment(x, y, damage) {
    const angle = U.rand(-Math.PI * 0.35, Math.PI * 0.35) - Math.PI / 2;
    const speed = U.rand(3, 5.5);
    activeBalls.push({
      typeId: 'scatter', x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      r: 4, damage: damage, hitSet: null, life: 0, isFragment: true, fragTTL: 4000
    });
  }

  // ---------------- SKILLS ----------------
  function useSkill(id) {
    const s = Game.State.get();
    const def = Game.SKILLS.find(k => k.id === id);
    if (!def) return false;
    const st = s.skills[id];
    const now = Date.now();
    if (now - st.lastUsed < def.cooldown) return false;
    if (s.level < def.unlockLevel) return false;
    st.lastUsed = now;
    if (id === 'meteor') {
      const alive = bricks.filter(b => b.alive);
      if (alive.length) {
        const target = U.choice(alive);
        const dmg = Game.State.ballDamage('basic') * 40 + brickBaseHp(s.level) * 2;
        damageBrick(target, dmg, target.x + target.w / 2, target.y + target.h / 2, true);
      }
    } else if (id === 'goldrain') {
      const gps = Game._lastGpsSample || (5 + s.level * 2);
      const gained = Game.State.addGold(gps * 10);
      spawnFloatingText(W / 2, H / 2, `+${U.fmt(gained)}g`, '#ffd700', 22);
    } else if (id === 'frenzy') {
      s.frenzyUntil = now + 10000;
    } else if (id === 'nuke') {
      bricks.filter(b => b.alive).forEach(b => damageBrick(b, b.maxHp * 0.25, b.x + b.w / 2, b.y + b.h / 2, false));
    }
    return true;
  }

  function skillCooldownRemaining(id) {
    const s = Game.State.get();
    const def = Game.SKILLS.find(k => k.id === id);
    const st = s.skills[id];
    return Math.max(0, def.cooldown - (Date.now() - st.lastUsed));
  }

  // ---------------- PARTICLES / FLOATING TEXT ----------------
  function spawnParticles(x, y, color, count) {
    const s = Game.State.get();
    if (!s.settings.particles) return;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = U.rand(1, 4.5);
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color, size: U.rand(2, 4) });
    }
  }
  function spawnFloatingText(x, y, text, color, size) {
    const s = Game.State.get();
    if (!s.settings.showDamageNumbers) return;
    floatingTexts.push({ x, y, text, color: color || '#fff', size: size || 14, life: 1, vy: -0.6 });
  }
function resetRun() {
  activeBalls = [];
  particles = [];
  floatingTexts = [];
  spawnTimers = {};
  newLevel(false);
}
  // ---------------- DAMAGE / DEATH ----------------
  function damageBrick(brick, amount, hitX, hitY, isMeteor) {
    if (!brick.alive) return;
    const s = Game.State.get();
    let crit = false;
    if (!isMeteor && Math.random() < Game.State.critChance()) {
      amount *= Game.State.critMultiplier();
      crit = true;
      s.stats.critHits++;
      SFX.crit();
    }
    if (brick.type === 'shield' && brick.shieldHits > 0) {
      brick.shieldHits--;
      spawnFloatingText(hitX, hitY, 'BLOCKED', '#90caf9', 12);
      spawnParticles(hitX, hitY, '#90caf9', 5);
      return;
    }
    brick.hp -= amount;
    s.stats.biggestHit = Math.max(s.stats.biggestHit, amount);
    spawnFloatingText(hitX, hitY, (crit ? 'CRIT ' : '') + U.fmt(amount), crit ? '#ff5252' : '#fff', crit ? 16 : 12);
    spawnParticles(hitX, hitY, crit ? '#ff5252' : '#fff', crit ? 8 : 3);
    SFX.hit();
    if (brick.hp <= 0) killBrick(brick, hitX, hitY);
  }

  function killBrick(brick, hitX, hitY) {
    if (!brick.alive) return;
    brick.alive = false;
    const s = Game.State.get();
    s.stats.bricksDestroyed++;
    let goldVal = (brick.maxHp * 0.9) * (1 + s.level * 0.02);
    if (brick.type === 'treasure') { goldVal *= Game.BRICK_TYPES.treasure.goldMult; s.stats.treasureBricksDestroyed++; }
    if (brick.type === 'boss') { s.stats.bossesKilled++; goldVal *= 2; }
    if (brick.type === 'explosive') { s.stats.explosiveBricksDestroyed++; }
    const gained = Game.State.addGold(goldVal);
    gpsAccumulator.gold += gained;
    spawnParticles(hitX, hitY, Game.BRICK_TYPES[brick.type].color || '#fff', 14);
    spawnFloatingText(hitX, hitY - 10, `+${U.fmt(gained)}`, '#ffd700', 13);

    if (brick.type === 'explosive') {
      const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2;
      const radius = Game.BRICK_TYPES.explosive.blastRadius;
      bricks.forEach((b) => {
        if (!b.alive || b === brick) return;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        const d = Math.hypot(bx - cx, by - cy);
        if (d < radius) damageBrick(b, brick.maxHp * 0.5, bx, by, false);
      });
    }
  }

  // ---------------- COLLISION HANDLING ----------------
  function handleBallBrickHit(ball, brick) {
    const def = Game.BALL_TYPES[ball.typeId] || { behavior: 'basic' };
    const hitX = ball.x, hitY = ball.y;

    if (def.behavior === 'pierce') {
      if (ball.hitSet.has(brick.id)) return false; // already hit this brick, allow pass-through
      ball.hitSet.add(brick.id);
      damageBrick(brick, ball.damage, hitX, hitY);
      return false; // don't bounce, keep flying straight
    }

    if (def.behavior === 'heavy' && brick.type === 'shield') {
      brick.shieldHits = 0; // cannon balls smash shields instantly
    }

    damageBrick(brick, ball.damage, hitX, hitY);

    if (def.behavior === 'splash') {
      const radius = def.splashRadius;
      bricks.forEach((b) => {
        if (!b.alive || b === brick) return;
        const bx = b.x + b.w / 2, by = b.y + b.h / 2;
        const d = Math.hypot(bx - hitX, by - hitY);
        if (d < radius) damageBrick(b, ball.damage * def.splashFalloff, bx, by);
      });
    }
    if (def.behavior === 'poison') {
      brick.poisonStacks = Math.min(def.poisonMaxStacks, (brick.poisonStacks || 0) + 1);
      brick.poisonUntil = Date.now() + def.poisonDuration;
    }
    if (def.behavior === 'scatter' && !ball.isFragment) {
      for (let i = 0; i < def.fragments; i++) spawnFragment(hitX, hitY, ball.damage * 0.4);
    }
    return true; // bounce
  }

  // ---------------- UPDATE LOOP ----------------
  function update(dt) {
    const s = Game.State.get();
    const now = Date.now();

    // spawn timers per ball type
    Game.BALL_ORDER.forEach((id) => {
      const b = s.balls[id];
      if (!b.unlocked) return;
      spawnTimers[id] = (spawnTimers[id] || 0) - dt;
      const activeOfType = activeBalls.filter(a => a.typeId === id && !a.isFragment).length;
      const frenzy = now < s.frenzyUntil ? 3 : 1;
      if (spawnTimers[id] <= 0 && activeOfType < b.count) {
        spawnBall(id);
        spawnTimers[id] = (SPAWN_BASE_MS[id] * Game.State.fireRateMultiplier()) / frenzy;
      }
    });

    // update bricks: heal + poison + move
    bricks.forEach((b) => {
      if (!b.alive) return;
      if (b.type === 'heal' && b.hp < b.maxHp) {
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * Game.BRICK_TYPES.heal.healPct * (dt / 1000));
      }
      if (b.type === 'moving') {
        b.x += b.moveDir * Game.BRICK_TYPES.moving.moveSpeed * (dt / 16);
        if (b.x < 0 || b.x + b.w > W) b.moveDir *= -1;
      }
      if (b.poisonStacks > 0) {
        b.poisonTick = (b.poisonTick || 0) + dt;
        if (now > b.poisonUntil) { b.poisonStacks = 0; }
        else if (b.poisonTick > 500) {
          b.poisonTick = 0;
          const dmg = Game.BALL_TYPES.poison.poisonDPS * b.poisonStacks * Game.State.damageMultiplier() * 0.5;
          damageBrick(b, dmg, b.x + b.w / 2, b.y + b.h / 2, true);
        }
      }
    });

    // update balls
    for (let i = activeBalls.length - 1; i >= 0; i--) {
      const ball = activeBalls[i];
      ball.life += dt;
      if (ball.isFragment) {
        ball.fragTTL -= dt;
        if (ball.fragTTL <= 0) { activeBalls.splice(i, 1); continue; }
      }
      ball.x += ball.vx * (dt / 16.6);
      ball.y += ball.vy * (dt / 16.6);

      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx *= -1; }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }

      if (ball.y - ball.r > H) { activeBalls.splice(i, 1); continue; }

      // brick collisions
      for (let j = 0; j < bricks.length; j++) {
        const brick = bricks[j];
        if (!brick.alive) continue;
        if (U.circleRectCollide(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) {
          const shouldBounce = handleBallBrickHit(ball, brick);
          if (shouldBounce) {
            const cx = brick.x + brick.w / 2, cy = brick.y + brick.h / 2;
            const overlapX = (brick.w / 2 + ball.r) - Math.abs(ball.x - cx);
            const overlapY = (brick.h / 2 + ball.r) - Math.abs(ball.y - cy);
            if (overlapX < overlapY) ball.vx *= -1; else ball.vy *= -1;
          }
          break;
        }
      }
    }

    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.12; p.life -= dt / 500;
      if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const t = floatingTexts[i];
      t.y += t.vy; t.life -= dt / 800;
      if (t.life <= 0) floatingTexts.splice(i, 1);
    }

    // level complete check
    if (bricks.length && bricks.every(b => !b.alive)) {
      newLevel(true);
    }

    // stats & gps tracking
    s.stats.playTimeSec += dt / 1000;
    s.stats.runTimeSec += dt / 1000;
    gpsAccumulator.time += dt;
    if (gpsAccumulator.time > 3000) {
      Game._lastGpsSample = gpsAccumulator.gold / (gpsAccumulator.time / 1000);
      gpsAccumulator = { gold: 0, time: 0 };
    }

    Game.State.checkAchievements((a) => { SFX.achievement(); emit('achievement', a); });
  }

  // ---------------- RENDER ----------------
  function render() {
    ctx.clearRect(0, 0, W, H);
    // background
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#141428');
    grad.addColorStop(1, '#0a0a16');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // bricks
    bricks.forEach((b) => {
      if (!b.alive) return;
      const def = Game.BRICK_TYPES[b.type];
      const pct = U.clamp(b.hp / b.maxHp, 0, 1);
      const hue = U.lerp(0, 130, pct);
      ctx.fillStyle = def.color || `hsl(${hue}, 65%, 50%)`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // hp bar
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
      ctx.fillStyle = '#7CFC00';
      ctx.fillRect(b.x, b.y + b.h - 4, b.w * pct, 4);
      if (def.label && b.w > 30) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(def.label, b.x + b.w / 2, b.y + b.h / 2 + 3);
      }
      if (b.poisonStacks > 0) {
        ctx.fillStyle = '#9ccc65';
        ctx.font = '9px sans-serif';
        ctx.fillText('☠' + b.poisonStacks, b.x + b.w - 10, b.y + 10);
      }
    });

    // balls
    activeBalls.forEach((ball) => {
      const def = Game.BALL_TYPES[ball.typeId];
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(ball.x, ball.y, 1, ball.x, ball.y, ball.r);
      g.addColorStop(0, def.glow);
      g.addColorStop(1, def.color);
      ctx.fillStyle = g;
      ctx.fill();
    });

    // particles
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    });
    ctx.globalAlpha = 1;

    // floating texts
    floatingTexts.forEach((t) => {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.size}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
    ctx.globalAlpha = 1;

    // cannon
    ctx.fillStyle = '#37474f';
    ctx.fillRect(W / 2 - 20, H - 14, 40, 14);
  }

  // ---------------- MAIN LOOP ----------------
  function loop(ts) {
    if (!running) return;
    const dt = Math.min(50, ts - lastTime || 16);
    lastTime = ts;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function start() { if (running) return; running = true; lastTime = 0; requestAnimationFrame(loop); }
  function stop() { running = false; }

  function getBricks() { return bricks; }
  function getActiveBallCount(typeId) { return activeBalls.filter(a => a.typeId === typeId && !a.isFragment).length; }

  return {
  init, start, stop, on, useSkill, skillCooldownRemaining,
  getBricks, getActiveBallCount, newLevel, resetRun, SFX
};
})();
