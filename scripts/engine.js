// ============================================================
// ENGINE.JS - Updated Spawning Logic & Collision Engine
// ============================================================
window.Game = window.Game || {};

Game.Engine = (function () {
  let canvas, ctx;
  let W = 800, H = 600;
  let lastTime = 0;

  const activeBalls = [];
  const bricks = [];
  const particles = [];
  const floatingTexts = [];
  const spawnTimers = {};
  const spawnIntervals = {};
  let gpsAccumulator = { gold: 0, time: 0 };

  const SFX = {
    upgrade: () => {},
    prestige: () => {},
    achievement: () => {}
  };

  function getActiveCountForType(typeId) {
    let count = 0;
    for (let i = 0; i < activeBalls.length; i++) {
      if (activeBalls[i].typeId === typeId && !activeBalls[i].isFragment) {
        count++;
      }
    }
    return count;
  }

  function getSpawnProgress(typeId) {
    const remainingMs = spawnTimers[typeId] || 0;
    const totalMs = spawnIntervals[typeId] || (Game.State.ballDeployRateSec(typeId) * 1000);
    
    if (totalMs <= 0) return { pct: 100, remainingSec: 0 };

    const elapsed = totalMs - remainingMs;
    const pct = (elapsed / totalMs) * 100;
    const remainingSec = Math.max(0, remainingMs / 1000);

    return {
      pct: Math.min(100, Math.max(0, pct)),
      remainingSec: remainingSec
    };
  }

  function spawnBall(typeId) {
    const def = Game.BALL_TYPES ? Game.BALL_TYPES[typeId] : null;
    if (!def) return;

    // Launch UPWARD (-y) from the bottom of the canvas into the bricks
    const angle = Game.Util.rand(-Math.PI * 0.75, -Math.PI * 0.25);
    const speed = def.speed || 6;

    activeBalls.push({
      typeId: typeId,
      x: W / 2,
      y: H - 40,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 8,
      color: def.color || '#ffffff',
      isFragment: false,
      life: 0
    });

    const s = Game.State.get();
    if (s.stats) s.stats.ballsSpawned = (s.stats.ballsSpawned || 0) + 1;
  }

  function generateBricks() {
    bricks.length = 0;
    const s = Game.State.get();
    const level = s.level || 1;
    const rows = Math.min(8, 3 + Math.floor(level / 2));
    const cols = 8;
    const padding = 6;
    const brickW = (W - (cols + 1) * padding) / cols;
    const brickH = 22;

    const scaleReduction = Game.State.brickHpScaleReduction ? Game.State.brickHpScaleReduction() : 0;
    const baseHp = Math.floor(10 * Math.pow(1.2 - scaleReduction, level - 1));

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let type = 'normal';
        const rand = Math.random();
        if (rand < 0.08) type = 'shield';
        else if (rand < 0.14) type = 'explosive';
        else if (rand < 0.20) type = 'treasure';
        else if (rand < 0.25) type = 'moving';

        let hp = baseHp;
        if (type === 'boss') hp *= Game.BRICK_TYPES.boss.hpMult;

        bricks.push({
          x: padding + c * (brickW + padding),
          y: 80 + r * (brickH + padding),
          w: brickW,
          h: brickH,
          hp: hp,
          maxHp: hp,
          type: type,
          alive: true,
          moveDir: 1,
          poisonStacks: 0,
          poisonUntil: 0
        });
      }
    }
  }

  function damageBrick(brick, dmg, hitX, hitY, isCrit = false) {
    if (!brick.alive) return;

    brick.hp -= dmg;
    const s = Game.State.get();

    if (s.stats) {
      if (dmg > (s.stats.biggestHit || 0)) s.stats.biggestHit = Math.floor(dmg);
      if (isCrit) s.stats.critHits = (s.stats.critHits || 0) + 1;
    }

    floatingTexts.push({
      text: Game.Util.fmt(dmg),
      x: hitX,
      y: hitY,
      vy: -1.5,
      life: 1.0,
      color: isCrit ? '#ffd700' : '#ffffff'
    });

    if (brick.hp <= 0) {
      brick.alive = false;
      const goldEarned = Math.max(1, Math.floor(brick.maxHp * 0.5 * Game.State.goldMultiplier()));
      s.gold = (s.gold || 0) + goldEarned;
      if (s.stats) {
        s.stats.totalGoldEarned = (s.stats.totalGoldEarned || 0) + goldEarned;
        s.stats.bricksDestroyed = (s.stats.bricksDestroyed || 0) + 1;
        if (brick.type === 'treasure') s.stats.treasureBricksDestroyed = (s.stats.treasureBricksDestroyed || 0) + 1;
        if (brick.type === 'explosive') s.stats.explosiveBricksDestroyed = (s.stats.explosiveBricksDestroyed || 0) + 1;
      }
      gpsAccumulator.gold += goldEarned;
    }
  }

  function handleBallBrickHit(ball, brick) {
    const isCrit = Math.random() < Game.State.critChance();
    let dmg = Game.State.ballDamage(ball.typeId);
    if (isCrit) dmg *= Game.State.critMultiplier();

    damageBrick(brick, dmg, ball.x, ball.y, isCrit);

    if (ball.typeId === 'plasma') {
      const radius = Game.BALL_TYPES.plasma.splashRadius || 50;
      bricks.forEach((other) => {
        if (!other.alive || other === brick) return;
        const dist = Math.hypot((other.x + other.w / 2) - ball.x, (other.y + other.h / 2) - ball.y);
        if (dist <= radius) {
          damageBrick(other, dmg * 0.5, other.x + other.w / 2, other.y + other.h / 2);
        }
      });
    }

    return true;
  }

  function newLevel(advance = true) {
    const s = Game.State.get();
    if (advance) s.level = (s.level || 1) + 1;
    generateBricks();
  }

  function resetRun() {
    activeBalls.length = 0;
    generateBricks();
  }

  function update(dt) {
    const s = Game.State.get();
    const now = Date.now();
    const extraSlots = Game.State.getExtraSlots ? Game.State.getExtraSlots() : 0;

    // --- BALL SPAWNING LOGIC ---
    const ballOrder = Game.BALL_ORDER || Object.keys(s.balls || {});
    ballOrder.forEach((id) => {
      const b = s.balls ? s.balls[id] : null;
      if (!b || !b.unlocked) return;

      const maxAllowed = (b.count || 0) + extraSlots;
      const currentOnScreen = getActiveCountForType(id);

      const deploySec = Game.State.ballDeployRateSec(id);
      const frenzy = now < (s.frenzyUntil || 0) ? 3 : 1;
      const targetInterval = (deploySec * 1000) / frenzy;
      spawnIntervals[id] = targetInterval;

      if (spawnTimers[id] === undefined) {
        spawnTimers[id] = targetInterval;
      }

      if (currentOnScreen < maxAllowed) {
        spawnTimers[id] -= dt;

        if (spawnTimers[id] <= 0) {
          spawnBall(id);
          spawnTimers[id] = targetInterval;
        }
      }
    });

    // --- BRICK LOGIC ---
    bricks.forEach((b) => {
      if (!b.alive) return;
      if (b.type === 'heal' && b.hp < b.maxHp) {
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * (Game.BRICK_TYPES?.heal?.healPct || 0.05) * (dt / 1000));
      }
      if (b.type === 'moving') {
        b.x += b.moveDir * (Game.BRICK_TYPES?.moving?.moveSpeed || 1.5) * (dt / 16);
        if (b.x < 0 || b.x + b.w > W) b.moveDir *= -1;
      }
      if (b.poisonStacks > 0) {
        b.poisonTick = (b.poisonTick || 0) + dt;
        if (now > b.poisonUntil) { 
          b.poisonStacks = 0; 
        } else if (b.poisonTick > 500) {
          b.poisonTick = 0;
          const dmg = (Game.BALL_TYPES?.poison?.poisonDPS || 5) * b.poisonStacks * Game.State.damageMultiplier() * 0.5;
          damageBrick(b, Math.max(1, dmg), b.x + b.w / 2, b.y + b.h / 2, true);
        }
      }
    });

    // --- BALL MOVEMENT & COLLISION ---
    for (let i = activeBalls.length - 1; i >= 0; i--) {
      const ball = activeBalls[i];
      ball.life += dt;
      
      if (ball.isFragment) {
        ball.fragTTL -= dt;
        if (ball.fragTTL <= 0) { 
          activeBalls.splice(i, 1); 
          continue; 
        }
      }

      // Anti-stuck horizontal angle fix
      if (Math.abs(ball.vy) < 0.5) {
        ball.vy += ball.vy < 0 ? -1 : 1;
      }

      ball.x += ball.vx * (dt / 16.6);
      ball.y += ball.vy * (dt / 16.6);

      // Canvas boundary bounces (Left, Right, Top)
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -1; }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx *= -1; }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }

      // Bottom boundary despawns ball to free up slot
      if (ball.y - ball.r > H) { 
        activeBalls.splice(i, 1); 
        continue; 
      }

      // Brick collisions
      for (let j = 0; j < bricks.length; j++) {
        const brick = bricks[j];
        if (!brick.alive) continue;
        if (Game.Util.circleRectCollide(ball.x, ball.y, ball.r, brick.x, brick.y, brick.w, brick.h)) {
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

    // --- PARTICLES & TEXT ---
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

    if (bricks.length && bricks.every(b => !b.alive)) {
      newLevel(true);
    }

    if (s.stats) {
      s.stats.playTimeSec = (s.stats.playTimeSec || 0) + dt / 1000;
      s.stats.runTimeSec = (s.stats.runTimeSec || 0) + dt / 1000;
    }

    gpsAccumulator.time += dt;
    if (gpsAccumulator.time > 3000) {
      Game._lastGpsSample = gpsAccumulator.gold / (gpsAccumulator.time / 1000);
      gpsAccumulator = { gold: 0, time: 0 };
    }

    if (Game.State.checkAchievements) {
      Game.State.checkAchievements((a) => { SFX.achievement(); });
    }
  }

  function render() {
    if (!ctx) return;

    ctx.fillStyle = '#0f0f1b';
    ctx.fillRect(0, 0, W, H);

    // Draw Bricks
    bricks.forEach((b) => {
      if (!b.alive) return;
      const def = Game.BRICK_TYPES[b.type] || Game.BRICK_TYPES.normal;
      ctx.fillStyle = def.color || '#4fc3f7';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(b.x, b.y, b.w, b.h);

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Game.Util.fmt(b.hp), b.x + b.w / 2, b.y + b.h / 2);
    });

    // Draw Balls
    activeBalls.forEach((ball) => {
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fillStyle = ball.color;
      ctx.fill();
      ctx.closePath();
    });

    // Draw Floating Damage Text
    floatingTexts.forEach((t) => {
      ctx.fillStyle = t.color;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
    });
  }

  function resizeCanvas() {
    if (!canvas || !canvas.parentElement) return;
    W = canvas.parentElement.clientWidth || 800;
    H = canvas.parentElement.clientHeight || 600;
    canvas.width = W;
    canvas.height = H;
  }

  function loop(now) {
    const dt = Math.min(100, now - lastTime);
    lastTime = now;

    update(dt);
    render();

    requestAnimationFrame(loop);
  }

  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    generateBricks();

    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  return {
    init,
    resetRun,
    getActiveCountForType,
    getSpawnProgress,
    SFX
  };
})();
