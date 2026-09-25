const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const timeEl = document.getElementById("time");
const levelEl = document.getElementById("level");
const playerHpEl = document.getElementById("playerHp");
const bossHpEl = document.getElementById("bossHp");
const weaponBadge = document.getElementById("weaponBadge");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const levelButtons = document.querySelectorAll("[data-level]");

const W = canvas.width;
const H = canvas.height;
const GRAVITY = 1700;
const WORLD_W = 8200;
const FLOOR_Y = 462;
const START_SECONDS = 300;

const keys = new Set();
let lastTime = 0;
let state;
let running = false;
let jumpQueued = false;

function rectsHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function makePlatforms() {
  return [
    { x: 360, y: 390, w: 180, h: 20 },
    { x: 720, y: 330, w: 150, h: 20 },
    { x: 1120, y: 365, w: 190, h: 20 },
    { x: 1530, y: 305, w: 160, h: 20 },
    { x: 1980, y: 380, w: 210, h: 20 },
    { x: 2470, y: 320, w: 170, h: 20 },
    { x: 2940, y: 360, w: 220, h: 20 },
    { x: 3430, y: 300, w: 160, h: 20 },
    { x: 3900, y: 372, w: 210, h: 20 },
    { x: 4400, y: 318, w: 160, h: 20 },
    { x: 4880, y: 360, w: 220, h: 20 },
    { x: 5420, y: 310, w: 180, h: 20 },
    { x: 5960, y: 370, w: 190, h: 20 },
    { x: 6480, y: 330, w: 200, h: 20 },
  ];
}

function makeEnemies(level) {
  const enemies = [];
  const types = ["goomba", "plant", "koopa"];
  const count = level === 3 ? 70 : level === 2 ? 55 : 30;
  const spacing = level === 3 ? 91 : level === 2 ? 116 : 205;
  const hpScale = level === 3 ? 2.55 : level === 2 ? 1.95 : 1;
  const speedScale = level === 3 ? 2.45 : level === 2 ? 1.9 : 1;
  const patrol = level === 3 ? 178 : level === 2 ? 152 : 88;
  const bonusDamage = level === 3 ? 24 : level === 2 ? 16 : 0;
  for (let i = 0; i < count; i += 1) {
    const type = types[i % types.length];
    const x = 520 + i * spacing + (i % 4) * 34;
    const baseHp = type === "plant" ? 90 : type === "koopa" ? 120 : 70;
    const hp = Math.round(baseHp * hpScale);
    enemies.push({
      type,
      x,
      y: type === "plant" ? FLOOR_Y - 74 : FLOOR_Y - 34,
      w: type === "plant" ? 36 : 34,
      h: type === "plant" ? 74 : 34,
      vx: type === "plant" ? 0 : (i % 2 ? 42 : -42) * speedScale,
      patrol,
      origin: x,
      hp,
      maxHp: hp,
      damage: (type === "koopa" ? 18 : 12) + bonusDamage,
      hitCooldown: 0,
      alive: true,
    });
  }
  return enemies;
}

function resetGame(level = 1) {
  const hard = level >= 2;
  const impossible = level === 3;
  state = {
    level,
    mode: "run",
    won: false,
    lost: false,
    nextLevel: 0,
    timeLeft: START_SECONDS,
    cameraX: 0,
    attackTimer: 0,
    message: "",
    messageTimer: 0,
    bossIntro: false,
    player: {
      x: 55,
      y: FLOOR_Y - 58,
      w: 34,
      h: 58,
      vx: 0,
      vy: 0,
      hp: 200,
      grounded: false,
      jumpsUsed: 0,
      face: 1,
      duck: false,
      hurtTimer: 0,
      akUnlocked: false,
    },
    platforms: makePlatforms(),
    enemies: makeEnemies(level),
    bullets: [],
    bossProjectiles: [],
    boss: {
      x: 7640,
      y: FLOOR_Y - 118,
      w: 92,
      h: 118,
      hp: impossible ? 3000 : hard ? 1900 : 1000,
      maxHp: impossible ? 3000 : hard ? 1900 : 1000,
      fireTimer: impossible ? 0.45 : hard ? 0.62 : 1.5,
      desperationTimer: impossible ? 0.48 : hard ? 0.65 : 1.2,
      meteorTimer: impossible ? 0.7 : hard ? 0.95 : 99,
      bombTimer: impossible ? 1.1 : hard ? 1.65 : 99,
      laserTimer: impossible ? 1.35 : 99,
      stompTimer: impossible ? 1.05 : hard ? 1.5 : 2.7,
      stompUsed: false,
      stompActive: false,
      stompShock: 0,
    },
    peach: { x: 7975, y: FLOOR_Y - 76, w: 34, h: 76 },
  };
  updateHud();
}

function startGame(level = 1) {
  overlay.classList.add("hidden");
  jumpQueued = false;
  resetGame(level);
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function finishGame(title, text, buttonText = "Restart", nextLevel = 0) {
  running = false;
  state.nextLevel = nextLevel;
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = text;
  startBtn.textContent = buttonText;
  overlay.classList.remove("hidden");
}

function updateHud() {
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = Math.max(0, Math.floor(state.timeLeft % 60));
  levelEl.textContent = state.level;
  timeEl.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  playerHpEl.textContent = Math.max(0, Math.ceil(state.player.hp));
  bossHpEl.textContent = Math.max(0, Math.ceil(state.boss.hp));
  weaponBadge.textContent = state.player.akUnlocked ? "AK-47" : "Punch";
}

function damagePlayer(amount) {
  const p = state.player;
  if (p.hurtTimer > 0 || state.won || state.lost) return;
  p.hp -= amount;
  p.hurtTimer = 0.75;
  if (p.hp < 100 && !p.akUnlocked) {
    p.akUnlocked = true;
    state.message = "AK-47 unlocked";
    state.messageTimer = 2.3;
  }
  if (p.hp <= 0) {
    state.lost = true;
    finishGame("Game Over", "Bowser's army stopped the rescue. Press Restart and try a cleaner run.");
  }
}

function damageEnemy(enemy, amount) {
  enemy.hp -= amount;
  if (enemy.hp <= 0) enemy.alive = false;
}

function damageBoss(amount) {
  if (state.mode !== "boss" || state.boss.hp <= 0) return;
  state.boss.hp -= amount;
  if (state.boss.hp <= 0) {
    state.boss.hp = 0;
    state.won = true;
    if (state.level < 3) {
      const nextLevel = state.level + 1;
      finishGame(
        "Peach Saved",
        nextLevel === 2
          ? "Peach is safe for now, but Bowser dragged the fight into a harder second level."
          : "You survived Level 2. Level 3 is Bowser's basically impossible final trap.",
        `Start Level ${nextLevel}`,
        nextLevel
      );
    } else {
      finishGame("Peach Saved", "Somehow, you cleared Level 3 and rescued Princess Peach for real.");
    }
  }
}

function updatePlayer(dt) {
  const p = state.player;
  p.duck = keys.has("s");
  const speed = p.duck ? 105 : 245;
  p.vx = 0;
  if (keys.has("a")) {
    p.vx = -speed;
    p.face = -1;
  }
  if (keys.has("d")) {
    p.vx = speed;
    p.face = 1;
  }
  if (jumpQueued && !p.duck && (p.grounded || p.jumpsUsed < 2)) {
    const jumpedFromGround = p.grounded;
    p.vy = -640;
    p.grounded = false;
    p.jumpsUsed = jumpedFromGround ? 1 : p.jumpsUsed + 1;
  }
  jumpQueued = false;

  p.x += p.vx * dt;
  p.x = clamp(p.x, 0, WORLD_W - p.w);
  p.vy += GRAVITY * dt;
  p.y += p.vy * dt;
  p.grounded = false;

  if (p.y + p.h >= FLOOR_Y) {
    p.y = FLOOR_Y - p.h;
    p.vy = 0;
    p.grounded = true;
    p.jumpsUsed = 0;
  }

  for (const platform of state.platforms) {
    const wasAbove = p.y + p.h - p.vy * dt <= platform.y;
    if (p.vy >= 0 && wasAbove && rectsHit(p, platform)) {
      p.y = platform.y - p.h;
      p.vy = 0;
      p.grounded = true;
      p.jumpsUsed = 0;
    }
  }

  if (p.hurtTimer > 0) p.hurtTimer -= dt;
}

function updateEnemies(dt) {
  const p = state.player;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    if (enemy.type !== "plant") {
      enemy.x += enemy.vx * dt;
      if (Math.abs(enemy.x - enemy.origin) > enemy.patrol) enemy.vx *= -1;
    } else {
      enemy.y = FLOOR_Y - 54 - Math.abs(Math.sin(performance.now() / 520 + enemy.x)) * 28;
      enemy.h = FLOOR_Y - enemy.y;
    }

    enemy.hitCooldown = Math.max(0, enemy.hitCooldown - dt);
    if (rectsHit(p, enemy) && enemy.hitCooldown <= 0) {
      enemy.hitCooldown = 0.55;
      damagePlayer(enemy.damage);
    }
  }
}

function updateAttack(dt) {
  const p = state.player;
  state.attackTimer = Math.max(0, state.attackTimer - dt);
  if (!keys.has(" ")) return;

  if (p.akUnlocked) {
    const damage = 150 * dt;
    const muzzle = { x: p.x + (p.face > 0 ? p.w : -380), y: p.y + 20, w: 410, h: 12 };
    if (p.face < 0) muzzle.x = p.x - muzzle.w;
    for (const enemy of state.enemies) {
      if (enemy.alive && rectsHit(muzzle, enemy)) damageEnemy(enemy, damage);
    }
    if (rectsHit(muzzle, state.boss)) damageBoss(damage);
    if (Math.random() < 0.8) {
      state.bullets.push({
        x: p.x + (p.face > 0 ? p.w + 4 : -8),
        y: p.y + 22 + Math.random() * 6,
        vx: p.face * 720,
        life: 0.35,
      });
    }
    return;
  }

  if (state.attackTimer > 0) return;
  state.attackTimer = 0.28;
  const punch = { x: p.face > 0 ? p.x + p.w : p.x - 24, y: p.y + 12, w: 24, h: 30 };
  for (const enemy of state.enemies) {
    if (enemy.alive && rectsHit(punch, enemy)) damageEnemy(enemy, 40);
  }
  if (rectsHit(punch, state.boss)) damageBoss(32);
}

function updateBoss(dt) {
  const p = state.player;
  const boss = state.boss;
  if (p.x > 7240) {
    state.mode = "boss";
    if (!state.bossIntro) {
      state.bossIntro = true;
      state.message = "Bowser fight";
      state.messageTimer = 2;
    }
  }
  if (state.mode !== "boss" || boss.hp <= 0) return;

  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    boss.fireTimer = state.level === 3 ? 0.42 : state.level === 2 ? 0.58 : 1.05;
    state.bossProjectiles.push({
      x: boss.x - 12,
      y: boss.y + 38,
      w: 34,
      h: 18,
      vx: -360,
      damage: 20,
      life: 4.5,
    });
  }

  if (state.level >= 2) {
    boss.meteorTimer -= dt;
    if (boss.meteorTimer <= 0) {
      const impossible = state.level === 3;
      const meteorCount = impossible ? 6 : 4;
      boss.meteorTimer = impossible ? 0.78 : 1.05;
      for (let i = 0; i < meteorCount; i += 1) {
        state.bossProjectiles.push({
          x: p.x - 210 + i * (impossible ? 84 : 120),
          y: 32 - i * 18,
          w: impossible ? 34 : 28,
          h: impossible ? 34 : 28,
          vx: 0,
          vy: impossible ? 560 : 460,
          damage: impossible ? 50 : 38,
          life: 2.2,
          meteor: true,
        });
      }
      state.message = impossible ? "Meteor storm" : "Meteor rain";
      state.messageTimer = 0.9;
    }

    boss.bombTimer -= dt;
    if (boss.bombTimer <= 0) {
      const impossible = state.level === 3;
      boss.bombTimer = impossible ? 1.15 : 2.0;
      const bombCount = impossible ? 3 : 2;
      for (let i = 0; i < bombCount; i += 1) {
        state.bossProjectiles.push({
          x: boss.x - 18,
          y: boss.y + 58,
          w: 26,
          h: 26,
          vx: -(impossible ? 420 : 340) - i * 70,
          vy: -360 - i * 55,
          damage: impossible ? 90 : 70,
          life: 4,
          bounces: impossible ? 3 : 2,
          bomb: true,
        });
      }
      state.message = "Bouncing bombs";
      state.messageTimer = 0.9;
    }

    if (state.level === 3) {
      boss.laserTimer -= dt;
      if (boss.laserTimer <= 0) {
        boss.laserTimer = 1.45;
        state.bossProjectiles.push({
          x: boss.x - 18,
          y: p.y + 18,
          w: 150,
          h: 8,
          vx: -820,
          damage: 110,
          life: 1.8,
          laser: true,
        });
        state.message = "Pixel laser";
        state.messageTimer = 0.75;
      }
    }
  }

  if (boss.hp < 100) {
    boss.desperationTimer -= dt;
    if (boss.desperationTimer <= 0) {
      boss.desperationTimer = 1.35;
      state.bossProjectiles.push({
        x: boss.x - 8,
        y: boss.y + 18,
        w: 12,
        h: 12,
        vx: -520,
        damage: 199,
        life: 3.2,
        tiny: true,
      });
      state.message = "Tiny doom shot";
      state.messageTimer = 1.1;
    }
  }

  if (!boss.stompUsed) {
    boss.stompTimer -= dt;
    if (boss.stompTimer <= 0) {
      boss.stompUsed = true;
      boss.stompActive = true;
      boss.stompShock = state.level === 3 ? 0.95 : 0.75;
      state.message = "Big stomp";
      state.messageTimer = 1.5;
      if (Math.abs((p.x + p.w / 2) - (boss.x + boss.w / 2)) < (state.level === 3 ? 760 : 640) && p.grounded) {
        damagePlayer(state.level === 3 ? 160 : 120);
      }
    }
  }
}

function updateProjectiles(dt) {
  const p = state.player;
  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.life -= dt;
  }
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0);

  for (const fire of state.bossProjectiles) {
    fire.x += fire.vx * dt;
    if (fire.vy) fire.y += fire.vy * dt;
    if (fire.bomb) {
      fire.vy += GRAVITY * 0.85 * dt;
      if (fire.y + fire.h >= FLOOR_Y) {
        fire.y = FLOOR_Y - fire.h;
        if (fire.bounces > 0) {
          fire.bounces -= 1;
          fire.vy = -520;
          fire.vx *= 0.94;
        } else {
          fire.life = 0;
          state.bossProjectiles.push({
            x: fire.x - 30,
            y: FLOOR_Y - 34,
            w: 86,
            h: 34,
            vx: 0,
            damage: 45,
            life: 0.2,
            burst: true,
          });
          continue;
        }
      }
    }
    fire.life -= dt;
    if (fire.meteor && fire.y + fire.h >= FLOOR_Y) {
      fire.life = 0;
      state.bossProjectiles.push({
        x: fire.x - 46,
        y: FLOOR_Y - 16,
        w: 120,
        h: 16,
        vx: 0,
        damage: 25,
        life: 0.18,
        burst: true,
      });
      continue;
    }
    if (rectsHit(p, fire)) {
      fire.life = 0;
      damagePlayer(fire.damage);
    }
  }
  state.bossProjectiles = state.bossProjectiles.filter((fire) => fire.life > 0);
  state.boss.stompShock = Math.max(0, state.boss.stompShock - dt);
}

function update(dt) {
  state.timeLeft -= dt;
  if (state.timeLeft <= 0) {
    state.timeLeft = 0;
    state.lost = true;
    finishGame("Time Up", "The 5 minute timer ran out before Peach was rescued.");
    return;
  }
  if (state.messageTimer > 0) state.messageTimer -= dt;
  updatePlayer(dt);
  updateEnemies(dt);
  updateAttack(dt);
  updateBoss(dt);
  updateProjectiles(dt);
  state.cameraX = clamp(state.player.x - W * 0.36, 0, WORLD_W - W);
  updateHud();
}

function drawRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - state.cameraX), Math.round(y), Math.round(w), Math.round(h));
}

function drawWorld() {
  const cam = state.cameraX;
  ctx.fillStyle = "#74c7e8";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 9; i += 1) {
    const x = ((i * 760 - cam * 0.35) % (WORLD_W + 260)) - 160;
    ctx.fillRect(x, 70 + (i % 3) * 48, 78, 18);
    ctx.fillRect(x + 18, 54 + (i % 3) * 48, 46, 18);
  }

  for (let x = -Math.floor(cam % 320); x < W; x += 320) {
    ctx.fillStyle = "#509b3a";
    ctx.fillRect(x, 410, 210, 52);
  }

  ctx.fillStyle = "#63b946";
  ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);
  ctx.fillStyle = "#8b5938";
  ctx.fillRect(0, FLOOR_Y + 22, W, H - FLOOR_Y - 22);
  ctx.fillStyle = "#70452e";
  for (let x = -Math.floor(cam % 40); x < W; x += 40) {
    ctx.fillRect(x, FLOOR_Y + 22, 20, 16);
    ctx.fillRect(x + 20, FLOOR_Y + 38, 20, 16);
  }

  for (const platform of state.platforms) {
    drawRect(platform.x, platform.y, platform.w, platform.h, "#c4833e");
    drawRect(platform.x, platform.y, platform.w, 6, "#f0b35c");
  }

  drawRect(7890, 316, 220, 146, "#8e4f38");
  drawRect(7920, 250, 52, 212, "#6d3a2b");
  drawRect(8030, 250, 52, 212, "#6d3a2b");
  drawRect(7870, 292, 260, 34, "#b76845");
}

function drawPlayer() {
  const p = state.player;
  const flash = p.hurtTimer > 0 && Math.floor(performance.now() / 90) % 2 === 0;
  const x = Math.round(p.x - state.cameraX);
  const y = Math.round(p.y);
  const h = p.duck ? 42 : p.h;
  const drawY = p.duck ? y + 16 : y;
  ctx.fillStyle = flash ? "#ffffff" : "#e83b3b";
  ctx.fillRect(x + 8, drawY, 18, 16);
  ctx.fillStyle = "#3567d8";
  ctx.fillRect(x + 5, drawY + 16, 24, h - 16);
  ctx.fillStyle = "#f0bf86";
  ctx.fillRect(x + 7, drawY + 5, 20, 14);
  ctx.fillStyle = "#6b3b23";
  ctx.fillRect(x + 5, drawY + h - 8, 10, 8);
  ctx.fillRect(x + 19, drawY + h - 8, 10, 8);

  if (p.akUnlocked) {
    ctx.fillStyle = "#20252b";
    const gunX = p.face > 0 ? x + 25 : x - 22;
    ctx.fillRect(gunX, drawY + 24, 30, 7);
    ctx.fillStyle = "#ffd166";
    if (keys.has(" ")) ctx.fillRect(p.face > 0 ? gunX + 30 : gunX - 8, drawY + 23, 8, 9);
  } else if (state.attackTimer > 0) {
    ctx.fillStyle = "#f0bf86";
    ctx.fillRect(p.face > 0 ? x + 30 : x - 12, drawY + 18, 14, 10);
  }
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const x = Math.round(enemy.x - state.cameraX);
    const y = Math.round(enemy.y);
    if (x < -80 || x > W + 80) continue;
    ctx.fillStyle = enemy.type === "plant" ? "#168a42" : enemy.type === "koopa" ? "#d99a2b" : "#8d4b2f";
    ctx.fillRect(x, y, enemy.w, enemy.h);
    ctx.fillStyle = enemy.type === "plant" ? "#e84a5f" : "#111722";
    ctx.fillRect(x + 6, y + 6, enemy.w - 12, 12);
    ctx.fillStyle = "#111722";
    ctx.fillRect(x + 8, y + 10, 5, 5);
    ctx.fillRect(x + enemy.w - 13, y + 10, 5, 5);
    ctx.fillStyle = "#e84a5f";
    ctx.fillRect(x, y - 8, enemy.w, 4);
    ctx.fillStyle = "#63e06f";
    ctx.fillRect(x, y - 8, enemy.w * (enemy.hp / enemy.maxHp), 4);
  }
}

function drawBossAndPeach() {
  const boss = state.boss;
  const bx = Math.round(boss.x - state.cameraX);
  const by = Math.round(boss.y);
  ctx.fillStyle = "#f5bfd2";
  ctx.fillRect(Math.round(state.peach.x - state.cameraX), state.peach.y, state.peach.w, state.peach.h);
  ctx.fillStyle = "#ffd166";
  ctx.fillRect(Math.round(state.peach.x - state.cameraX) + 5, state.peach.y - 10, 24, 12);

  ctx.fillStyle = "#2b9d4f";
  ctx.fillRect(bx + 12, by + 22, boss.w - 24, boss.h - 22);
  ctx.fillStyle = "#d6a33e";
  ctx.fillRect(bx, by + 44, boss.w, 50);
  ctx.fillStyle = "#2b9d4f";
  ctx.fillRect(bx + 16, by, 60, 40);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(bx + 26, by + 12, 10, 8);
  ctx.fillRect(bx + 54, by + 12, 10, 8);
  ctx.fillStyle = "#111722";
  ctx.fillRect(bx + 30, by + 14, 5, 5);
  ctx.fillRect(bx + 58, by + 14, 5, 5);
  ctx.fillStyle = "#f7f4e8";
  ctx.fillRect(bx + 10, by - 10, 16, 18);
  ctx.fillRect(bx + 66, by - 10, 16, 18);

  if (boss.stompShock > 0) {
    ctx.strokeStyle = "#f7f4e8";
    ctx.lineWidth = 5;
    ctx.strokeRect(bx - 560 * boss.stompShock, FLOOR_Y - 22, 1120 * boss.stompShock, 22);
  }
}

function drawEffects() {
  for (const bullet of state.bullets) {
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(Math.round(bullet.x - state.cameraX), Math.round(bullet.y), 14, 3);
  }
  for (const fire of state.bossProjectiles) {
    const x = Math.round(fire.x - state.cameraX);
    const y = Math.round(fire.y);
    if (fire.meteor) {
      ctx.fillStyle = "#7b2d26";
      ctx.fillRect(x, y, fire.w, fire.h);
      ctx.fillStyle = "#ffcf5a";
      ctx.fillRect(x + 5, y + 5, fire.w - 10, fire.h - 10);
    } else if (fire.bomb) {
      ctx.fillStyle = "#20252b";
      ctx.fillRect(x + 3, y + 3, fire.w - 6, fire.h - 6);
      ctx.fillStyle = "#e84a5f";
      ctx.fillRect(x + 8, y + 8, fire.w - 16, fire.h - 16);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x + 18, y - 3, 5, 8);
    } else if (fire.laser) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, fire.w, fire.h);
      ctx.fillStyle = "#65f0ff";
      ctx.fillRect(x, y + 2, fire.w, 4);
    } else if (fire.burst) {
      ctx.fillStyle = "#ffcf5a";
      ctx.fillRect(x, y, fire.w, fire.h);
    } else if (fire.tiny) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x, y, fire.w, fire.h);
      ctx.fillStyle = "#e84a5f";
      ctx.fillRect(x + 3, y + 3, fire.w - 6, fire.h - 6);
    } else {
      ctx.fillStyle = "#ff7a1a";
      ctx.fillRect(x, y, fire.w, fire.h);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x + 8, y + 4, 18, 8);
    }
  }
}

function drawMinimap() {
  const x = 22;
  const y = 22;
  const w = 230;
  ctx.fillStyle = "rgba(14, 21, 32, 0.78)";
  ctx.fillRect(x, y, w, 12);
  ctx.fillStyle = "#63b946";
  ctx.fillRect(x, y, w * (state.player.x / WORLD_W), 12);
  ctx.fillStyle = "#f5bfd2";
  ctx.fillRect(x + w - 12, y - 3, 8, 18);
}

function drawMessages() {
  if (state.messageTimer <= 0) return;
  ctx.fillStyle = "rgba(14, 21, 32, 0.82)";
  ctx.fillRect(W / 2 - 150, 70, 300, 44);
  ctx.fillStyle = "#ffd166";
  ctx.font = "24px Trebuchet MS";
  ctx.textAlign = "center";
  ctx.fillText(state.message, W / 2, 99);
  ctx.textAlign = "left";
}

function draw() {
  drawWorld();
  drawEnemies();
  drawBossAndPeach();
  drawEffects();
  drawPlayer();
  drawMinimap();
  drawMessages();
}

function loop(now) {
  if (!running) return;
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  if (running) requestAnimationFrame(loop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["w", "a", "s", "d", " ", "r"].includes(key)) event.preventDefault();
  if (key === "r") {
    startGame(state?.level || 1);
    return;
  }
  if (key === "w" && !keys.has("w")) jumpQueued = true;
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

startBtn.addEventListener("click", () => {
  startGame(state?.nextLevel || 1);
});

for (const button of levelButtons) {
  button.addEventListener("click", () => {
    startGame(Number(button.dataset.level));
  });
}

resetGame();
draw();
