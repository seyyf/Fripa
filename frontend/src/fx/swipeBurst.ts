// Canvas particle bursts for the swipe deck — fired when a card is decided.
// Hand-rolled on a 2D canvas instead of three.js on purpose: the whole engine
// is ~3KB and animates transform-free (its own rAF loop), while a WebGL scene
// would add ~150KB gzip to the shopper bundle for the same visual payoff.

export type BurstAction = 'keep' | 'pass' | 'favorite';

type Shape = 'dot' | 'shard' | 'star' | 'cross';

interface Particle {
  x: number;
  y: number;
  vx: number; // px/s
  vy: number;
  rot: number;
  vr: number; // rad/s
  size: number;
  color: string;
  shape: Shape;
  age: number; // s
  ttl: number; // s
  gravity: number;
}

// Per-gesture palette + shape mix + throw direction (radians; canvas y is down).
const RECIPES: Record<
  BurstAction,
  { colors: string[]; shapes: Shape[]; angle: number; spread: number; gravity: number }
> = {
  keep: {
    colors: ['#2bbd6b', '#1f9d55', '#8ee6b4', '#ffffff'],
    shapes: ['dot', 'shard', 'dot', 'shard'],
    angle: 0, // → follows the rightward throw
    spread: Math.PI / 3.2,
    gravity: 900,
  },
  pass: {
    colors: ['#e0231a', '#ff6a5c', '#b3140d', '#ffd2cd'],
    shapes: ['cross', 'shard', 'dot', 'shard'],
    angle: Math.PI, // ← follows the leftward throw
    spread: Math.PI / 3.2,
    gravity: 900,
  },
  favorite: {
    colors: ['#e9b94b', '#c8901a', '#ffd98a', '#fff3d6'],
    shapes: ['star', 'dot', 'star', 'shard'],
    angle: -Math.PI / 2, // ↑ follows the upward throw
    spread: Math.PI / 2.6,
    gravity: 520, // stars hang in the air a touch longer
  },
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function drawStar(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
  ctx.fill();
}

// One engine per deck. Owns the canvas, its rAF loop, and the particle pool;
// the loop only runs while particles are alive.
export class SwipeBurstEngine {
  private ctx: CanvasRenderingContext2D | null;
  private particles: Particle[] = [];
  private raf = 0;
  private last = 0;

  constructor(private readonly canvas: HTMLCanvasElement) {
    // jsdom (tests) has no 2D context — the engine just no-ops there.
    this.ctx = canvas.getContext?.('2d') ?? null;
  }

  // Match the canvas backing store to its CSS size (DPR-aware, crisp on mobile).
  resize(): void {
    if (!this.ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth, clientHeight } = this.canvas;
    this.canvas.width = Math.max(1, Math.round(clientWidth * dpr));
    this.canvas.height = Math.max(1, Math.round(clientHeight * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Fire a burst at (x, y) in CSS pixels relative to the canvas.
  burst(action: BurstAction, x: number, y: number): void {
    if (!this.ctx) return;
    const r = RECIPES[action];
    const count = (this.canvas.clientWidth < 480 ? 18 : 26) + Math.floor(rand(0, 6));
    // Extra kick along the throw axis, so the cloud clearly streams in the
    // swiped direction instead of puffing out evenly.
    const kick = rand(180, 320);
    for (let i = 0; i < count; i++) {
      const angle = r.angle + rand(-r.spread, r.spread);
      const speed = rand(300, 820);
      this.particles.push({
        x: x + rand(-14, 14),
        y: y + rand(-14, 14),
        vx: Math.cos(angle) * speed + Math.cos(r.angle) * kick,
        vy: Math.sin(angle) * speed + Math.sin(r.angle) * kick - rand(20, 90),
        rot: rand(0, Math.PI * 2),
        vr: rand(-9, 9),
        size: rand(4, 9),
        color: r.colors[i % r.colors.length],
        shape: r.shapes[i % r.shapes.length],
        age: 0,
        ttl: rand(0.55, 1.05),
        gravity: r.gravity,
      });
    }
    if (!this.raf) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    }
  }

  destroy(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.particles = [];
  }

  private tick = (now: number): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    const alive: Particle[] = [];
    for (const p of this.particles) {
      p.age += dt;
      if (p.age >= p.ttl) continue;
      p.vy += p.gravity * dt;
      p.vx *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;

      const t = p.age / p.ttl;
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3; // hold, then fade
      ctx.fillStyle = p.color;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      const s = p.size * (1 - t * 0.35); // shrink slightly as it dies
      if (p.shape === 'dot') {
        ctx.beginPath();
        ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'shard') {
        ctx.fillRect(-s * 0.5, -s * 0.22, s, s * 0.44); // confetti sliver
      } else if (p.shape === 'cross') {
        ctx.fillRect(-s * 0.6, -s * 0.16, s * 1.2, s * 0.32);
        ctx.fillRect(-s * 0.16, -s * 0.6, s * 0.32, s * 1.2);
      } else {
        drawStar(ctx, s * 0.7);
      }
      ctx.restore();
      alive.push(p);
    }
    ctx.globalAlpha = 1;
    this.particles = alive;
    this.raf = alive.length ? requestAnimationFrame(this.tick) : 0;
    if (!alive.length) ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
  };
}
