import type { GameAssets } from "./assets";
import type { Difficulty } from "../types/domain";

interface Bullet {
  x: number;
  y: number;
  speed: number;
}

interface Asteroid {
  x: number;
  y: number;
  radius: number;
  speed: number;
  rotation: number;
  spin: number;
  sprite: HTMLImageElement;
}

export interface GameSnapshot {
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
}

interface DifficultyConfig {
  asteroidSpeed: number;
  spawnMs: number;
  bulletSpeed: number;
  shipSpeed: number;
  fireCooldownMs: number;
  scorePerHit: number;
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: { asteroidSpeed: 1.85, spawnMs: 820, bulletSpeed: 10.5, shipSpeed: 6, fireCooldownMs: 155, scorePerHit: 10 },
  normal: { asteroidSpeed: 2.55, spawnMs: 610, bulletSpeed: 11.2, shipSpeed: 7, fireCooldownMs: 145, scorePerHit: 15 },
  hard: { asteroidSpeed: 3.4, spawnMs: 430, bulletSpeed: 11.8, shipSpeed: 8.2, fireCooldownMs: 130, scorePerHit: 20 },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceSquared(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function drawCover(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number): void {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

export class SpaceShooterEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private assets: GameAssets;

  private shipX: number;
  private shipY: number;
  private shipWidth = 72;
  private shipHeight = 62;

  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];

  private score = 0;
  private gameOver = false;
  private paused = false;
  private moveX = 0;
  private shootPressed = false;
  private now = 0;

  private difficulty: Difficulty;
  private lastSpawnTime = 0;
  private lastShotTime = 0;
  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement, difficulty: Difficulty, assets: GameAssets) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = true;

    this.width = canvas.width;
    this.height = canvas.height;
    this.assets = assets;

    this.shipX = this.width / 2 - this.shipWidth / 2;
    this.shipY = this.height - this.shipHeight - 22;
    this.difficulty = difficulty;
  }

  setControls(input: { moveX: number; shoot: boolean }): void {
    this.moveX = clamp(input.moveX, -1, 1);
    this.shootPressed = input.shoot;
  }

  setPaused(value: boolean): void {
    this.paused = value;
  }

  snapshot(): GameSnapshot {
    return { score: this.score, isGameOver: this.gameOver, isPaused: this.paused };
  }

  start(onUpdate: (state: GameSnapshot) => void): void {
    let lastFrame = performance.now();

    const loop = (ts: number): void => {
      const delta = ts - lastFrame;
      lastFrame = ts;
      this.now = ts;

      if (!this.paused && !this.gameOver) {
        this.update(ts, delta);
      }
      this.render();
      onUpdate(this.snapshot());

      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  private update(ts: number, deltaMs: number): void {
    const cfg = DIFFICULTY_CONFIG[this.difficulty];
    const frameScale = clamp(deltaMs / 16.67, 0.5, 2.2);

    this.shipX += this.moveX * cfg.shipSpeed * frameScale;
    this.shipX = clamp(this.shipX, 4, this.width - this.shipWidth - 4);

    if (this.shootPressed && ts - this.lastShotTime >= cfg.fireCooldownMs) {
      const bulletY = this.shipY + 4;
      this.bullets.push({ x: this.shipX + this.shipWidth * 0.36, y: bulletY, speed: cfg.bulletSpeed });
      this.bullets.push({ x: this.shipX + this.shipWidth * 0.64, y: bulletY, speed: cfg.bulletSpeed });
      this.lastShotTime = ts;
    }

    if (ts - this.lastSpawnTime >= cfg.spawnMs) {
      const radius = 22 + Math.random() * 26;
      const x = radius + Math.random() * (this.width - radius * 2);
      const sprite = this.assets.asteroids[Math.floor(Math.random() * this.assets.asteroids.length)];
      this.asteroids.push({
        x,
        y: -radius - 20,
        radius,
        speed: cfg.asteroidSpeed * (0.8 + Math.random() * 0.9),
        rotation: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.05,
        sprite,
      });
      this.lastSpawnTime = ts;
    }

    for (const bullet of this.bullets) {
      bullet.y -= bullet.speed * frameScale;
    }
    this.bullets = this.bullets.filter((bullet) => bullet.y > -30);

    for (const asteroid of this.asteroids) {
      asteroid.y += asteroid.speed * frameScale;
      asteroid.rotation += asteroid.spin * frameScale;
    }
    this.asteroids = this.asteroids.filter((asteroid) => asteroid.y - asteroid.radius <= this.height + 56);

    this.resolveBulletHits(cfg.scorePerHit);
    this.resolveShipCollision();
  }

  private resolveBulletHits(scorePerHit: number): void {
    for (let asteroidIdx = this.asteroids.length - 1; asteroidIdx >= 0; asteroidIdx -= 1) {
      const asteroid = this.asteroids[asteroidIdx];
      const hitRadius = asteroid.radius * 0.76;
      let destroyed = false;

      for (let bulletIdx = this.bullets.length - 1; bulletIdx >= 0; bulletIdx -= 1) {
        const bullet = this.bullets[bulletIdx];
        if (distanceSquared(bullet.x, bullet.y, asteroid.x, asteroid.y) <= hitRadius * hitRadius) {
          this.bullets.splice(bulletIdx, 1);
          this.asteroids.splice(asteroidIdx, 1);
          this.score += scorePerHit;
          destroyed = true;
          break;
        }
      }

      if (destroyed) {
        continue;
      }
    }
  }

  private resolveShipCollision(): void {
    const hitboxX = this.shipX + this.shipWidth * 0.2;
    const hitboxY = this.shipY + this.shipHeight * 0.24;
    const hitboxWidth = this.shipWidth * 0.6;
    const hitboxHeight = this.shipHeight * 0.62;

    for (const asteroid of this.asteroids) {
      const closestX = clamp(asteroid.x, hitboxX, hitboxX + hitboxWidth);
      const closestY = clamp(asteroid.y, hitboxY, hitboxY + hitboxHeight);
      const hitRadius = asteroid.radius * 0.78;

      if (distanceSquared(asteroid.x, asteroid.y, closestX, closestY) <= hitRadius * hitRadius) {
        this.gameOver = true;
        break;
      }
    }
  }

  private render(): void {
    const bg = this.width / this.height < 0.72 ? this.assets.backgroundMobile : this.assets.backgroundDesktop;
    this.ctx.clearRect(0, 0, this.width, this.height);
    drawCover(this.ctx, bg ?? this.assets.backgroundFallback, this.width, this.height);

    const haze = this.ctx.createLinearGradient(0, 0, 0, this.height);
    haze.addColorStop(0, "rgba(6,16,31,0.06)");
    haze.addColorStop(1, "rgba(3,12,24,0.18)");
    this.ctx.fillStyle = haze;
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.lineWidth = 3;
    this.ctx.lineCap = "round";
    this.ctx.strokeStyle = "rgba(147, 233, 255, 0.92)";
    this.ctx.shadowColor = "rgba(88, 218, 255, 0.95)";
    this.ctx.shadowBlur = 14;
    for (const bullet of this.bullets) {
      this.ctx.beginPath();
      this.ctx.moveTo(bullet.x, bullet.y + 12);
      this.ctx.lineTo(bullet.x, bullet.y - 8);
      this.ctx.stroke();
    }
    this.ctx.shadowBlur = 0;

    for (const asteroid of this.asteroids) {
      const diameter = asteroid.radius * 2;
      this.ctx.save();
      this.ctx.translate(asteroid.x, asteroid.y);
      this.ctx.rotate(asteroid.rotation);
      this.ctx.drawImage(asteroid.sprite, -asteroid.radius, -asteroid.radius, diameter, diameter);
      this.ctx.restore();
    }

    const enginePulse = 0.7 + Math.sin(this.now / 80) * 0.18;
    const thrusterY = this.shipY + this.shipHeight * 0.9;
    this.ctx.fillStyle = `rgba(96, 220, 255, ${this.shootPressed ? 0.55 : 0.34 * enginePulse})`;
    this.ctx.beginPath();
    this.ctx.ellipse(this.shipX + this.shipWidth * 0.34, thrusterY, 5, 10, 0, 0, Math.PI * 2);
    this.ctx.ellipse(this.shipX + this.shipWidth * 0.66, thrusterY, 5, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();

    const shipImage = this.now - this.lastShotTime < 95 ? this.assets.shipFire : this.assets.shipIdle;
    this.ctx.drawImage(shipImage, this.shipX, this.shipY, this.shipWidth, this.shipHeight);
  }
}
