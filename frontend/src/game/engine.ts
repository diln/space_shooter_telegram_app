import type { Difficulty } from "../types/domain";

interface Bullet {
  x: number;
  y: number;
}

interface Asteroid {
  x: number;
  y: number;
  radius: number;
  speed: number;
}

export interface GameSnapshot {
  score: number;
  isGameOver: boolean;
  isPaused: boolean;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { asteroidSpeed: number; spawnMs: number; bulletSpeed: number; shipSpeed: number }> = {
  easy: { asteroidSpeed: 1.8, spawnMs: 900, bulletSpeed: 8, shipSpeed: 5.5 },
  normal: { asteroidSpeed: 2.5, spawnMs: 650, bulletSpeed: 9, shipSpeed: 6.5 },
  hard: { asteroidSpeed: 3.4, spawnMs: 450, bulletSpeed: 10, shipSpeed: 7.2 },
};

export class SpaceShooterEngine {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;

  private shipX: number;
  private shipY: number;
  private shipWidth = 42;
  private shipHeight = 24;

  private bullets: Bullet[] = [];
  private asteroids: Asteroid[] = [];

  private score = 0;
  private gameOver = false;
  private paused = false;

  private leftPressed = false;
  private rightPressed = false;
  private shootPressed = false;

  private difficulty: Difficulty;
  private lastSpawnTime = 0;
  private lastShotTime = 0;
  private rafId: number | null = null;

  constructor(canvas: HTMLCanvasElement, difficulty: Difficulty) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D context unavailable");
    }
    this.ctx = context;

    this.width = canvas.width;
    this.height = canvas.height;
    this.shipX = this.width / 2 - this.shipWidth / 2;
    this.shipY = this.height - 40;
    this.difficulty = difficulty;
  }

  setControls(input: { left: boolean; right: boolean; shoot: boolean }): void {
    this.leftPressed = input.left;
    this.rightPressed = input.right;
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

    if (this.leftPressed) {
      this.shipX -= cfg.shipSpeed;
    }
    if (this.rightPressed) {
      this.shipX += cfg.shipSpeed;
    }

    this.shipX = Math.max(0, Math.min(this.width - this.shipWidth, this.shipX));

    if (this.shootPressed && ts - this.lastShotTime > 180) {
      this.bullets.push({ x: this.shipX + this.shipWidth / 2 - 2, y: this.shipY - 10 });
      this.lastShotTime = ts;
    }

    if (ts - this.lastSpawnTime > cfg.spawnMs) {
      const radius = 12 + Math.random() * 14;
      const x = radius + Math.random() * (this.width - radius * 2);
      this.asteroids.push({ x, y: -radius, radius, speed: cfg.asteroidSpeed + Math.random() * 1.2 });
      this.lastSpawnTime = ts;
    }

    const bulletShift = (cfg.bulletSpeed * deltaMs) / 16.67;
    const asteroidShiftMultiplier = deltaMs / 16.67;

    this.bullets = this.bullets
      .map((b) => ({ ...b, y: b.y - bulletShift }))
      .filter((b) => b.y > -12);

    this.asteroids = this.asteroids
      .map((a) => ({ ...a, y: a.y + a.speed * asteroidShiftMultiplier }))
      .filter((a) => a.y - a.radius <= this.height + 40);

    const remainingAsteroids: Asteroid[] = [];
    for (const asteroid of this.asteroids) {
      let hit = false;
      const remainingBullets: Bullet[] = [];

      for (const bullet of this.bullets) {
        const dx = bullet.x - asteroid.x;
        const dy = bullet.y - asteroid.y;
        if (dx * dx + dy * dy <= asteroid.radius * asteroid.radius) {
          hit = true;
          this.score += this.difficulty === "hard" ? 20 : this.difficulty === "normal" ? 15 : 10;
        } else {
          remainingBullets.push(bullet);
        }
      }

      this.bullets = remainingBullets;
      if (!hit) {
        remainingAsteroids.push(asteroid);
      }
    }
    this.asteroids = remainingAsteroids;

    for (const asteroid of this.asteroids) {
      const closestX = Math.max(this.shipX, Math.min(asteroid.x, this.shipX + this.shipWidth));
      const closestY = Math.max(this.shipY, Math.min(asteroid.y, this.shipY + this.shipHeight));
      const dx = asteroid.x - closestX;
      const dy = asteroid.y - closestY;
      if (dx * dx + dy * dy <= asteroid.radius * asteroid.radius) {
        this.gameOver = true;
        break;
      }
    }
  }

  private render(): void {
    this.ctx.fillStyle = "#041e2f";
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.fillStyle = "#4de0ff";
    this.ctx.fillRect(this.shipX, this.shipY, this.shipWidth, this.shipHeight);

    this.ctx.fillStyle = "#ffd166";
    for (const bullet of this.bullets) {
      this.ctx.fillRect(bullet.x, bullet.y, 4, 10);
    }

    this.ctx.fillStyle = "#ff6b6b";
    for (const asteroid of this.asteroids) {
      this.ctx.beginPath();
      this.ctx.arc(asteroid.x, asteroid.y, asteroid.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
}
