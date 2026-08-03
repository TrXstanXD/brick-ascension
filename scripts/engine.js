// ============================================================
// ENGINE.JS - Updated Spawning Logic & Collision Engine
// ============================================================

function getActiveCountForType(typeId) {
  let count = 0;
  for (let i = 0; i < activeBalls.length; i++) {
    if (activeBalls[i].typeId === typeId && !activeBalls[i].isFragment) {
      count++;
    }
  }
  return count;
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

    // Check maximum balls allowed on screen (purchased count + prestige slots)
    const maxAllowed = (b.count || 0) + extraSlots;
    const currentOnScreen = getActiveCountForType(id);

    // Only progress deployment timer if screen capacity has room
    if (currentOnScreen < maxAllowed) {
      spawnTimers[id] = (spawnTimers[id] || 0) - dt;
      const frenzy = now < (s.frenzyUntil || 0) ? 3 : 1;

      if (spawnTimers[id] <= 0) {
        spawnBall(id);
        const deploySec = Game.State.ballDeployRateSec(id);
        spawnTimers[id] = (deploySec * 1000) / frenzy;
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
        const dmg = (Game.BALL_TYPES?.poison?.poisonDPS || 5) * b.poisonStacks * getStatMult('damageMultiplier', 1) * 0.5;
        damageBrick(b, Math.max(1, dmg), b.x + b.w / 2, b.y + b.h / 2, true);
      }
    }
  });

  // --- BALL MOVEMENT & BOTTOM COLLISION ---
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

    ball.x += ball.vx * (dt / 16.6);
    ball.y += ball.vy * (dt / 16.6);

    // Canvas boundary bounces
    if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx *= -1; }
    if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx *= -1; }
    if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy *= -1; }

    // Reaching the bottom boundary clears the ball and opens up a slot to respawn
    if (ball.y - ball.r > H) { 
      activeBalls.splice(i, 1); 
      continue; 
    }

    // Brick collisions
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
    Game.State.checkAchievements((a) => { SFX.achievement(); emit('achievement', a); });
  }
}

// Expose helper to global Engine object for UI synchronization
if (window.Game && window.Game.Engine) {
  window.Game.Engine.getActiveCountForType = getActiveCountForType;
}
