'use strict';
/* Cut-out sprite animator.
   Animates a single painted pixel-art frame the way HD-2D games animate large sprites:
   row-based deformation (breathing, hair, cape sway), detached layers (the floating orb),
   whole-body squash / lean / knockback, and pixel FX drawn at the sprite's own resolution.
   Every frame is a pure function of (animation, time), so exports are deterministic. */

const STAGE_W = 360, STAGE_H = 240;
const SPR_X = 24, SPR_Y = 8;                     // where the 225x225 sprite sits on the stage

/* Rig: hand-measured landmarks on the source sprite (source pixel coordinates). */
const RIG = {
  pivot: { x: 112, y: 215 },                     // between the feet: squash, stretch and lean pivot
  torso: { full: 84, end: 104 },                 // rows above `full` ride the breath, fading out by `end` (belt)
  hair: { top: 18, end: 36, x0: 94, x1: 136 },
  capeL: { y0: 112, y1: 150, staff: [63, 90, 79, 196] },  // staff shaft (x0,y0,x1,y1): the left cape never drags it
  capeR: { x0: 150, x1: 170, y0: 100, y1: 150 },
  orb: { x0: 155, y0: 36, x1: 185, y1: 64, cx: 170, cy: 54, r: 8 },  // detached layer
  gem: { x: 55, y: 30 },                         // staff crystal
  chest: { x: 114, y: 96 },
  eyes: [[103, 106, 47], [110, 114, 47]]         // blink: [x0, x1, row]
};
const GROUND = SPR_Y + RIG.pivot.y;
const FEET_X = SPR_X + RIG.pivot.x;

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => clamp((t - a) / (b - a), 0, 1);           // progress of t through [a, b]
const E = {
  out: k => 1 - (1 - k) * (1 - k),
  in: k => k * k,
  inOut: k => k < .5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k),
  outBack: k => { const c = 1.7; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); }
};
const hash = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + .5) / 16;
const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const COL = {
  orb: rgb('#6f9cff'), orbHi: rgb('#e6f0ff'),
  arcane: rgb('#a874ff'), arcaneHi: rgb('#f0e2ff'), arcaneMid: rgb('#7a4ad0'), arcaneDk: rgb('#2e1858'),
  gold: rgb('#ffcc6a'), goldHi: rgb('#fff2cc'), white: [255, 255, 255], hit: rgb('#ff6a40'), shadow: [20, 12, 8]
};

/* ---------- pixel buffer ---------- */
class Buf {
  constructor(w, h) { this.w = w; this.h = h; this.img = new ImageData(w, h); this.d = this.img.data; }
  clear() { this.d.fill(0); }
  blend(x, y, c, a) {
    x = Math.floor(x); y = Math.floor(y);
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    a = Math.min(1, a);
    const i = (y * this.w + x) * 4, d = this.d, da = d[i + 3] / 255, oa = a + da * (1 - a);
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa;
    d[i + 3] = oa * 255;
  }
  light(x, y, c, k) {                              // additive light; over empty pixels it becomes a translucent glow
    x = Math.floor(x); y = Math.floor(y);
    if (k <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, d = this.d;
    if (d[i + 3] === 0) { d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.min(255, k * 255); return; }
    for (let j = 0; j < 3; j++) d[i + j] = Math.min(255, d[i + j] + c[j] * k);
    d[i + 3] = Math.min(255, d[i + 3] + k * 255);
  }
}

/* ---------- pixel FX primitives ---------- */
function glow(b, cx, cy, r, c, I, squash) {      // banded, dithered radial light
  squash = squash || 1;
  const ry = r * squash;
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
    const q = 1 - Math.hypot((x + .5 - cx) / r, (y + .5 - cy) / ry);
    if (q > 0) b.light(x, y, c, Math.floor(q * q * I * 4 + bayer(x, y)) / 4);
  }
}
function spark(b, x, y, c, size, a) {            // 1 px dot, plus-shaped star, or long-armed star
  a = a === undefined ? 1 : a;
  b.blend(x, y, c, a);
  if (size >= 1) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.blend(x + dx, y + dy, c, a * .55);
  if (size >= 2) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) b.blend(x + dx, y + dy, c, a * .3);
}
function line(b, x0, y0, x1, y1, c, a) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let i = 0; i <= n; i++) b.blend(Math.round(lerp(x0, x1, i / n)), Math.round(lerp(y0, y1, i / n)), c, a);
}
function ring(b, cx, cy, rx, ry, c, a, from, to) {
  from = from || 0; to = to === undefined ? TAU : to;
  const seen = new Set(), n = Math.ceil((to - from) * Math.max(rx, ry) * 1.5) + 1;
  for (let i = 0; i <= n; i++) {
    const t = lerp(from, to, i / n), x = Math.round(cx + Math.cos(t) * rx), y = Math.round(cy + Math.sin(t) * ry), k = y * 4096 + x;
    if (!seen.has(k)) { seen.add(k); b.blend(x, y, c, a); }
  }
}
function fillPoly(b, pts, shade) {               // even-odd scanline fill; shade(x, y) -> [colour, alpha]
  const ys = pts.map(p => p[1]), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    const yc = y + .5, xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + (yc - ay) / (by - ay) * (bx - ax));
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) { const [c, a] = shade(x, y); b.blend(x, y, c, a); }
  }
}

/* ---------- sprite layers ---------- */
const Sprite = { ready: false };
function loadSprite(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      const g = c.getContext('2d'); g.drawImage(im, 0, 0);
      buildLayers(g.getImageData(0, 0, im.width, im.height)); res();
    };
    im.onerror = rej; im.src = src;
  });
}
function buildLayers(img) {
  const W = img.width, H = img.height, body = new Uint8ClampedArray(img.data), O = RIG.orb;
  const ow = O.x1 - O.x0 + 1, oh = O.y1 - O.y0 + 1, orb = new Uint8ClampedArray(ow * oh * 4);
  for (let y = O.y0; y <= O.y1; y++) for (let x = O.x0; x <= O.x1; x++) {           // lift the orb off the hand
    const i = (y * W + x) * 4, j = ((y - O.y0) * ow + x - O.x0) * 4;
    for (let k = 0; k < 4; k++) { orb[j + k] = body[i + k]; body[i + k] = 0; }
  }
  const blink = new Uint8ClampedArray(body);
  for (const [x0, x1, y] of RIG.eyes) for (let x = x0; x <= x1; x++) {                // closed lids: skin from below, a shade darker
    const i = (y * W + x) * 4, s = ((y + 2) * W + x) * 4;
    for (let k = 0; k < 3; k++) blink[i + k] = body[s + k] * .86;
  }
  const edges = [], solid = (x, y) => x >= 0 && y >= 0 && x < W && y < H && body[(y * W + x) * 4 + 3] > 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)                          // outline ring for the Boost aura
    if (!solid(x, y) && (solid(x + 1, y) || solid(x - 1, y) || solid(x, y + 1) || solid(x, y - 1))) edges.push([x, y]);
  Object.assign(Sprite, { ready: true, W, H, body, blink, orb, ow, oh, edges });
}

/* ---------- deformation ---------- */
function deform(x, y, s) {                       // how far the content at (x, y) has moved, in source pixels
  let mx = 0, my = 0;
  const T = RIG.torso, tw = y < T.full ? 1 : y > T.end ? 0 : (T.end - y) / (T.end - T.full);
  my -= Math.round(s.breath * tw);
  const H = RIG.hair;
  if (y < H.end && x > H.x0 && x < H.x1) mx += s.hair * Math.sin(s.wave * 2 + x * .3) * (H.end - y) / (H.end - H.top);
  const L = RIG.capeL, [a, b, c, d] = L.staff, staffX = a + (y - b) * (c - a) / (d - b);
  const wl = clamp((staffX - 4 - x) / 14, 0, 1) * clamp((y - L.y0) / (L.y1 - L.y0), 0, 1);
  const R = RIG.capeR, wr = clamp((x - R.x0) / (R.x1 - R.x0), 0, 1) * clamp((y - R.y0) / (R.y1 - R.y0), 0, 1);
  mx -= wl * (s.cape * Math.sin(s.wave - y * .09) + s.wind);
  mx += wr * (s.cape * Math.sin(s.wave + 1.3 - y * .09) + s.wind);
  my -= (wl + wr) * s.wind * .35;
  return [Math.round(mx), my];
}
function toStage(s, x, y) {                      // forward transform of a source point (ignores row deformation)
  const P = RIG.pivot;
  x += s.lean * (P.y - y) / 100;
  return [(x - P.x) * s.sx + P.x + SPR_X + s.ox, (y - P.y) * s.sy + P.y + SPR_Y + s.oy];
}
function drawBody(b, s) {
  const P = RIG.pivot, src = s.blink ? Sprite.blink : Sprite.body, W = Sprite.W, H = Sprite.H;
  const x0 = Math.max(0, Math.floor(SPR_X + s.ox - 24)), x1 = Math.min(b.w, Math.ceil(SPR_X + s.ox + W + 24));
  const y0 = Math.max(0, Math.floor(SPR_Y + s.oy - 24)), y1 = Math.min(b.h, Math.ceil(SPR_Y + s.oy + H + 4));
  for (let Y = y0; Y < y1; Y++) for (let X = x0; X < x1; X++) {
    const ly = (Y + .5 - SPR_Y - s.oy - P.y) / s.sy + P.y;
    let lx = (X + .5 - SPR_X - s.ox - P.x) / s.sx + P.x;
    lx -= s.lean * (P.y - ly) / 100;
    const [mx, my] = deform(lx, ly, s), sx = Math.floor(lx - mx), sy = Math.floor(ly - my);
    if (sx < 0 || sy < 0 || sx >= W || sy >= H) continue;
    const i = (sy * W + sx) * 4;
    if (src[i + 3] === 0) continue;
    let c = [src[i], src[i + 1], src[i + 2]];
    if (s.tint) c = c.map((v, k) => lerp(v, s.tint[k], s.tint[3]));
    if (s.flash) c = c.map(v => lerp(v, 255, s.flash));
    b.blend(X, Y, c, src[i + 3] / 255);
  }
}
function orbPos(s) {                             // stage centre of the orb, following hand, breath and its own bob
  const O = RIG.orb, [x, y] = toStage(s, O.cx, O.cy);
  return [x + s.orb.dx, y - s.breath + s.orb.dy];
}
function drawOrb(b, s, cx, cy, scale, alpha) {
  const O = RIG.orb, d = Sprite.orb, ow = Sprite.ow, oh = Sprite.oh;
  glow(b, cx, cy, 13 * scale, COL.orb, .55 * alpha * s.orb.glow);
  const r = Math.ceil(16 * scale);
  for (let Y = Math.floor(cy - r); Y <= cy + r; Y++) for (let X = Math.floor(cx - r); X <= cx + r; X++) {
    const sx = Math.floor((X + .5 - cx) / scale + O.cx - O.x0), sy = Math.floor((Y + .5 - cy) / scale + O.cy - O.y0);
    if (sx < 0 || sy < 0 || sx >= ow || sy >= oh) continue;
    const i = (sy * ow + sx) * 4;
    if (d[i + 3]) b.blend(X, Y, [d[i], d[i + 1], d[i + 2]].map(v => lerp(v, 255, s.orb.white || 0)), d[i + 3] / 255 * alpha);
  }
}
function gemPos(s) { const [x, y] = toStage(s, RIG.gem.x, RIG.gem.y); return [x, y - s.breath]; }

/* ---------- shared idle layer ---------- */
const IDLE_MS = 4800;
function idle(t) {
  const br = (1 - Math.cos(TAU * t / 2400)) / 2;
  return {
    ox: 0, oy: 0, sx: 1, sy: 1, lean: 0, flash: 0, tint: null, shake: [0, 0],
    breath: Math.round(br * 2), hair: .7, cape: 1.4, wind: 0, wave: TAU * t / 2400,
    blink: (t % IDLE_MS) > 3600 && (t % IDLE_MS) < 3700,
    orb: { dx: 0, dy: Math.round(2 * Math.sin(TAU * t / 1600)), s: 1, a: 1, glow: .8 + .2 * Math.sin(TAU * t / 1600), behind: false },
    gem: .35 + .15 * Math.sin(TAU * t / 1200),
    shadow: 1, sparkles: 1, motes: 1, back: [], front: []
  };
}
function sparkles(b, s, t, cx, cy, k) {          // tiny lights orbiting the orb
  for (let i = 0; i < 5; i++) {
    const a = TAU * (t / 2400 + i / 5), x = cx + Math.cos(a) * 12, y = cy + Math.sin(a) * 4 - Math.cos(a) * 3;
    const tw = (Math.floor(t / 120) + i) % 4;
    if (tw === 0) continue;
    spark(b, Math.round(x), Math.round(y), Math.sin(a) > 0 ? COL.orbHi : COL.orb, tw === 3 ? 1 : 0, (Math.sin(a) > 0 ? 1 : .5) * k);
  }
}
function motes(b, t, gx, gy, n, k, col) {        // embers drifting up from the staff crystal
  for (let i = 0; i < n; i++) {
    const p = ((t / 1600) + hash(i)) % 1, x = gx + (hash(i + 9) - .5) * 14 + Math.sin(p * TAU + i) * 2, y = gy + 2 - p * 22;
    spark(b, Math.round(x), Math.round(y), p < .3 ? COL.arcaneHi : col || COL.arcane, 0, (1 - p) * k);
  }
}

/* ---------- animations: each returns its state for time t (ms) ---------- */
const ANIMS = {
  idle: { label: 'Idle', ms: IDLE_MS, loop: true, state: t => idle(t) },

  cast: {
    label: 'Cast', ms: 1700, loop: false,
    state(t) {
      const s = idle(t), bob = s.orb.dy, charge = seg(t, 0, 520), rel = seg(t, 520, 720), back = seg(t, 1050, 1500);
      const kick = rel > 0 && rel < 1 ? 1 : 0;
      s.lean = -3 * E.out(charge) * (1 - E.out(rel)) + 3 * E.out(rel) * (1 - E.inOut(back));
      s.sx = 1 + .04 * kick; s.sy = 1 - .03 * kick;
      s.wind = 2.2 * E.out(charge) * (1 - back);
      s.cape = 1.4 + 1.2 * charge * (1 - back);
      s.gem = .35 + .6 * charge * (1 - back);
      s.orb.dx = -3 * E.out(charge); s.orb.dy = bob - 9 * E.out(charge);
      s.orb.s = 1 + .7 * E.out(charge); s.orb.glow = 1 + 1.4 * charge;
      const launch = [SPR_X + RIG.orb.cx - 3, SPR_Y + RIG.orb.cy - 9 - s.breath];
      if (t >= 520) {                                     // the orb has flown: a new one pops into the hand at the end
        const re = seg(t, 1250, 1500);
        Object.assign(s.orb, { dx: 0, dy: bob, s: Math.max(.01, E.outBack(re)), a: re > 0 ? 1 : 0, glow: 1 });
      }
      const circleA = E.out(seg(t, 60, 360)) * (1 - seg(t, 900, 1300));
      s.back.push(b => runeCircle(b, FEET_X, GROUND, 18 + 34 * E.out(charge), t, circleA));
      s.front.push(b => {
        if (t < 520) { const [ox, oy] = orbPos(s); converge(b, ox, oy, t, charge); }
        if (t >= 520 && t < 760) projectile(b, launch[0], launch[1], 330, 118, rel, s);
        if (t >= 500 && t < 620) glow(b, launch[0], launch[1], 26, COL.orbHi, 1.2 * (1 - seg(t, 500, 620)));
        if (t >= 700) impact(b, 330, 118, seg(t, 700, 1150), COL.orb, COL.orbHi);
      });
      if (t > 700 && t < 860) s.shake = [Math.floor(t / 40) % 2 ? 1 : -1, 0];
      return s;
    }
  },

  slam: {
    label: 'Staff Slam', ms: 1600, loop: false,
    state(t) {
      const s = idle(t), crouch = seg(t, 0, 280), hop = seg(t, 280, 480), land = seg(t, 480, 560), rec = seg(t, 1150, 1500);
      const hopY = Math.sin(Math.PI * hop) * 9;
      s.oy = -hopY;
      s.sy = t < 280 ? 1 - .045 * E.out(crouch) : t < 480 ? 1 + .03 * Math.sin(Math.PI * hop) : t < 640 ? 1 - .05 * (1 - seg(t, 480, 640)) : 1;
      s.sx = 2 - s.sy;
      s.lean = t < 480 ? -2 * crouch : 2 * (1 - rec);
      s.wind = t < 480 ? -1.4 * hop : 1.6 * (1 - seg(t, 480, 900));
      s.gem = .35 + .9 * crouch * (1 - seg(t, 560, 900));
      s.shadow = 1 - hopY / 18;
      if (t >= 480 && t < 680) s.shake = [0, Math.floor(t / 35) % 2 ? 2 : -1];
      s.front.push(b => {
        const [gx, gy] = gemPos(s);
        if (t < 560) for (let i = 0; i < 6; i++) {         // crackle around the crystal while charging
          const a = TAU * hash(i * 3 + Math.floor(t / 60)), r = 5 + 6 * hash(i + Math.floor(t / 60));
          spark(b, Math.round(gx + Math.cos(a) * r), Math.round(gy + Math.sin(a) * r), COL.arcaneHi, i % 3 === 0 ? 1 : 0, crouch);
        }
        if (t >= 480 && t < 640) glow(b, gx, gy, 22, COL.arcaneHi, 1.3 * (1 - seg(t, 480, 640)));
      });
      if (t >= 480) {
        s.back.push(b => shockwave(b, FEET_X, GROUND, seg(t, 480, 900)));
        s.front.push(b => { for (let i = 0; i < 5; i++) crystalSpike(b, FEET_X + 44 + i * 36, GROUND + 1, 30 + i * 5 + (i % 2) * 8, t - 540 - i * 70, i); });
      }
      return s;
    }
  },

  hurt: {
    label: 'Hurt', ms: 800, loop: false,
    state(t) {
      const s = idle(t), k = seg(t, 0, 110), back = seg(t, 320, 760);
      s.ox = -9 * E.out(k) * (1 - E.inOut(back));
      s.lean = -5 * E.out(k) * (1 - E.inOut(back));
      s.flash = t < 70 ? .9 : 0;
      if (t >= 70 && t < 260) s.tint = [...COL.hit, .32 * (1 - seg(t, 70, 260))];
      if (t < 280) s.shake = [Math.floor(t / 40) % 2 ? 2 : -2, 0];
      s.wind = 2.5 * (1 - back);
      s.orb.dx = Math.round(-4 * E.out(k) * (1 - back)) + (t < 280 ? (Math.floor(t / 50) % 2 ? 1 : -1) : 0);
      s.orb.dy += Math.round(3 * E.out(k) * (1 - back));
      s.blink = t > 60 && t < 380;
      s.sparkles = t < 300 ? 0 : 1;
      s.front.push(b => {
        const hx = SPR_X + s.ox + 150, hy = SPR_Y + 96, p = seg(t, 0, 260);
        if (p < 1) for (let i = 0; i < 10; i++) {
          const a = -.9 + 1.8 * hash(i), r = 4 + 26 * E.out(p) * (.5 + hash(i + 4));
          spark(b, Math.round(hx + Math.cos(a) * r), Math.round(hy + Math.sin(a) * r + p * p * 6), i % 2 ? COL.white : COL.hit, i % 3 ? 0 : 1, 1 - p);
        }
        if (t < 120) glow(b, hx, hy, 18, COL.white, 1 - t / 120);
      });
      return s;
    }
  },

  boost: {
    label: 'Boost', ms: 1200, loop: true,
    state(t) {
      const s = idle(t);
      s.wind = 1.1 + .4 * Math.sin(TAU * t / 600);
      s.cape = 1.8; s.gem = .6;
      s.back.push(b => glow(b, FEET_X, GROUND - 2, 64, COL.gold, .45 + .1 * Math.sin(TAU * t / 600), .18));
      s.front.push(b => aura(b, s, t));
      return s;
    }
  },

  victory: {
    label: 'Victory', ms: 2200, loop: false,
    state(t) {
      const s = idle(t);
      for (const [a, z] of [[0, 380], [380, 760]]) {
        const p = seg(t, a, z);
        if (p > 0 && p < 1) { s.oy = -Math.sin(Math.PI * p) * 5; s.sy = p < .15 || p > .85 ? .96 : 1.02; s.sx = 2 - s.sy; }
      }
      s.shadow = 1 + s.oy / 12;
      s.lean = 2 * Math.sin(Math.PI * seg(t, 800, 2000));
      const orbit = seg(t, 200, 1900);
      if (orbit > 0 && orbit < 1) {
        const ph = TAU * 2 * E.inOut(orbit), mixIn = Math.min(seg(t, 200, 420), 1 - seg(t, 1680, 1900));
        const O = RIG.orb, C = RIG.chest, [hx, hy] = toStage(s, O.cx, O.cy), [cx, cy] = toStage(s, C.x, C.y);
        const tx = cx + Math.cos(ph) * 66, ty = cy - 18 + Math.sin(ph) * 14 - Math.sin(Math.PI * orbit) * 20;
        s.orb.dx = lerp(0, tx - hx, E.inOut(mixIn)); s.orb.dy = lerp(s.orb.dy, ty - hy, E.inOut(mixIn));
        s.orb.behind = Math.sin(ph) < 0 && mixIn > .5;
        s.orb.glow = 1.3;
      }
      s.front.push(b => {
        for (let i = 0; i < 16; i++) {                     // golden motes rising around the body
          const p = ((t / 1400) + hash(i)) % 1, x = SPR_X + 60 + hash(i + 3) * 110, y = GROUND - 10 - p * 120;
          spark(b, Math.round(x + Math.sin(p * 9 + i) * 2), Math.round(y), p < .2 ? COL.goldHi : COL.gold, i % 4 === 0 ? 1 : 0, Math.sin(Math.PI * p) * Math.min(1, t / 300) * (1 - seg(t, 1900, 2200)));
        }
        const [ox, oy] = orbPos(s), p = seg(t, 1900, 2150);
        if (p > 0 && p < 1) for (let i = 0; i < 14; i++) {
          const a = TAU * i / 14, r = 3 + 22 * E.out(p);
          spark(b, Math.round(ox + Math.cos(a) * r), Math.round(oy + Math.sin(a) * r * .8), i % 2 ? COL.orbHi : COL.goldHi, i % 2, 1 - p);
        }
      });
      return s;
    }
  }
};

/* ---------- composite FX ---------- */
const GLYPHS = [[1, 0, 1, 0, 1, 0, 1, 0, 1], [0, 1, 0, 1, 1, 1, 0, 1, 0], [1, 1, 0, 0, 1, 0, 0, 1, 1], [1, 0, 0, 1, 1, 0, 1, 1, 1], [0, 1, 1, 0, 1, 0, 1, 1, 0], [1, 1, 1, 0, 0, 1, 0, 1, 0]];
function runeCircle(b, cx, cy, r, t, a) {
  if (a <= 0) return;
  const sq = .3, rot = t / 900, c = COL.orb, hi = COL.orbHi;
  glow(b, cx, cy, r * 1.15, c, .5 * a, sq);
  ring(b, cx, cy, r, r * sq, hi, a);
  ring(b, cx, cy, r - 5, (r - 5) * sq, c, a * .8);
  ring(b, cx, cy, r * .45, r * .45 * sq, c, a * .7);
  const pts = [];
  for (let i = 0; i < 6; i++) { const q = rot + TAU * i / 6; pts.push([cx + Math.cos(q) * (r - 5), cy + Math.sin(q) * (r - 5) * sq]); }
  for (let i = 0; i < 6; i++) { const p = pts[i], q = pts[(i + 2) % 6]; line(b, p[0], p[1], q[0], q[1], c, a * .55); }
  for (let i = 0; i < 10; i++) {                          // glyphs ride the band between the outer rings
    const q = -rot * 1.3 + TAU * i / 10, gx = Math.round(cx + Math.cos(q) * (r - 2.5)), gy = Math.round(cy + Math.sin(q) * (r - 2.5) * sq), g = GLYPHS[i % GLYPHS.length];
    for (let k = 0; k < 9; k++) if (g[k]) b.blend(gx - 1 + k % 3, gy - 1 + (k / 3 | 0) * .5, hi, a * (Math.sin(q) > 0 ? 1 : .6));
  }
  for (let i = 0; i < 8; i++) {                           // light rising off the circle
    const p = ((t / 700) + hash(i)) % 1, q = TAU * hash(i + 20);
    spark(b, Math.round(cx + Math.cos(q) * r * .9), Math.round(cy + Math.sin(q) * r * sq - p * 26), hi, 0, a * (1 - p));
  }
}
function converge(b, cx, cy, t, k) {
  for (let i = 0; i < 16; i++) {
    const p = seg(t, hash(i) * 220, hash(i) * 220 + 300);
    if (p <= 0 || p >= 1) continue;
    const a = TAU * hash(i + 40), r = (1 - E.in(p)) * (26 + 14 * hash(i + 2));
    spark(b, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), p > .6 ? COL.orbHi : COL.orb, i % 4 === 0 ? 1 : 0, .4 + .6 * p);
  }
  glow(b, cx, cy, 18 + 8 * k, COL.orb, .3 + .5 * k);
}
function projectile(b, x0, y0, x1, y1, p, s) {
  const at = q => [lerp(x0, x1, q), lerp(y0, y1, q) - Math.sin(Math.PI * q) * 10];
  for (let i = 6; i >= 1; i--) {                          // afterimages
    const q = E.in(Math.max(0, p - i * .035)), [x, y] = at(q);
    glow(b, x, y, 9 - i, COL.orb, .5 * (1 - i / 7));
  }
  const [x, y] = at(E.in(p));
  drawOrb(b, Object.assign({}, s, { orb: Object.assign({}, s.orb, { glow: 1.6, white: .25 }) }), x, y, 1.4, 1);
}
function impact(b, x, y, p, c, hi) {
  if (p <= 0 || p >= 1) return;
  if (p < .3) glow(b, x, y, 34, hi, 1.8 * (1 - p / .3));
  glow(b, x, y, 20, c, .7 * (1 - p));
  ring(b, x, y, 6 + 26 * E.out(p), 6 + 26 * E.out(p), hi, 1 - p);
  ring(b, x, y, 3 + 16 * E.out(p), 3 + 16 * E.out(p), c, (1 - p) * .7);
  for (let i = 0; i < 14; i++) {
    const a = TAU * hash(i + 60), r = 4 + 34 * E.out(p) * (.4 + .6 * hash(i + 61));
    spark(b, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r + p * p * 10), i % 3 ? c : hi, i % 4 === 0 ? 1 : 0, 1 - p);
  }
}
function shockwave(b, cx, cy, p) {
  if (p <= 0 || p >= 1) return;
  const r = 10 + 70 * E.out(p);
  glow(b, cx, cy, r, COL.arcane, .5 * (1 - p), .25);
  ring(b, cx, cy, r, r * .25, COL.arcaneHi, 1 - p);
  ring(b, cx, cy, r * .75, r * .75 * .25, COL.arcane, (1 - p) * .7);
  for (let i = 0; i < 12; i++) {                          // dust kicked up along the wave
    const a = TAU * hash(i + 80), q = r * (.8 + .2 * hash(i));
    spark(b, Math.round(cx + Math.cos(a) * q), Math.round(cy + Math.sin(a) * q * .25 - 8 * Math.sin(Math.PI * p) * hash(i + 3)), [190, 160, 120], 0, .8 * (1 - p));
  }
}
function crystalSpike(b, x, gy, h, t, i) {
  if (t < 0) return;
  const grow = E.outBack(seg(t, 0, 110)), hold = 300, p = seg(t, 110 + hold, 110 + hold + 300);
  if (p < 1 && t < 110 + hold) {
    const H = h * grow, w = 7 + (i % 2);
    glow(b, x, gy - H * .4, 10 + H * .3, COL.arcane, .5, 1.2);
    const pts = [[x - w, gy], [x - w * .45, gy - H * .62], [x + .5, gy - H], [x + w * .55, gy - H * .5], [x + w, gy]];
    fillPoly(b, pts, (px, py) => {
      const u = (px - x) / w, v = (gy - py) / Math.max(1, H);
      const c = u < -.35 ? COL.arcaneHi : u < .05 ? COL.arcane : u < .45 ? COL.arcaneMid : COL.arcaneDk;
      return [v > .85 && u < .2 ? COL.arcaneHi : c, 1];
    });
    for (let k = 0; k < pts.length - 1; k++) line(b, pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], COL.arcaneDk, .9);
    line(b, x - w * .45, gy - H * .62, x + .5, gy - H * .15, COL.arcaneHi, .6);   // facet edge
    const sx = x + w + 2, sh = H * .45;                   // small side crystal
    fillPoly(b, [[sx - 3, gy], [sx, gy - sh], [sx + 3, gy]], px => [px < sx ? COL.arcane : COL.arcaneMid, 1]);
    if (t < 70) glow(b, x, gy - 4, 14, COL.arcaneHi, 1 - t / 70);
  }
  if (t >= 110 + hold && p < 1) for (let k = 0; k < 10; k++) {   // shatter into shards
    const a = -Math.PI / 2 + (hash(k + i * 13) - .5) * 2.4, r = 30 * E.out(p) * (.4 + hash(k + 5)), y0 = gy - h * hash(k + 7);
    spark(b, Math.round(x + Math.cos(a) * r), Math.round(y0 + Math.sin(a) * r + p * p * 24), k % 2 ? COL.arcaneHi : COL.arcane, k % 3 === 0 ? 1 : 0, 1 - p);
  }
}
function aura(b, s, t) {
  const P = RIG.pivot;
  for (const [x, y] of Sprite.edges) {                    // gold rim hugging the silhouette, flickering upward
    const k = .6 + .35 * Math.sin(TAU * t / 600 + y * .22) * Math.sin(y * .05 - TAU * t / 1200);
    if (k <= .3) continue;
    const X = (x + s.lean * (P.y - y) / 100 - P.x) * s.sx + P.x + SPR_X + s.ox, Y = (y - P.y) * s.sy + P.y + SPR_Y + s.oy - (y < RIG.torso.end ? s.breath : 0);
    const q = Math.floor(k * 4 + bayer(x, y)) / 4;
    b.blend(X, Y, y % 3 ? COL.gold : COL.goldHi, q);
    if ((x + y + Math.floor(t / 100)) % 3 === 0) b.blend(X, Y - 1, COL.goldHi, q * .5);   // flicker licks upward
  }
  for (let i = 0; i < 22; i++) {                          // rising light streaks
    const p = ((t / 900) + hash(i)) % 1, x = SPR_X + 50 + hash(i + 7) * 130, y = GROUND - 4 - p * 150, len = 2 + (i % 3);
    for (let k = 0; k < len; k++) b.blend(Math.round(x), Math.round(y + k), k === 0 ? COL.goldHi : COL.gold, Math.sin(Math.PI * p) * (1 - k / len));
  }
}

/* ---------- frame renderer ---------- */
function renderFrame(b, name, t) {
  const A = ANIMS[name], s = A.state(A.loop ? t % A.ms : Math.min(t, A.ms));
  b.clear();
  const sh = clamp(s.shadow, .3, 1.2);                    // contact shadow
  for (let y = -4; y <= 4; y++) for (let x = -50; x <= 50; x++) {
    const q = Math.hypot(x / (48 * sh), y / (5 * sh));
    if (q < 1) b.blend(FEET_X + s.ox + x, GROUND + y, COL.shadow, (q < .6 ? .32 : .2) * Math.min(1, sh) * (bayer(x, y) < .85 ? 1 : 0));
  }
  for (const f of s.back) f(b);
  const [ox, oy] = orbPos(s), ga = s.gem;
  if (s.orb.behind && s.orb.a > 0) drawOrb(b, s, ox, oy, s.orb.s * .85, s.orb.a * .8);
  drawBody(b, s);
  const [gx, gy] = gemPos(s);
  glow(b, gx, gy, 9 + ga * 6, COL.arcane, ga);
  if (s.motes) motes(b, t, gx, gy, 5, .8);
  if (!s.orb.behind && s.orb.a > 0) drawOrb(b, s, ox, oy, s.orb.s, s.orb.a);
  if (s.sparkles && s.orb.a > 0 && s.orb.s > .5) sparkles(b, s, t, ox, oy, s.orb.a);
  for (const f of s.front) f(b);
  return s;
}

window.MageAnim = { STAGE_W, STAGE_H, ANIMS, RIG, Buf, renderFrame, loadSprite, Sprite };
