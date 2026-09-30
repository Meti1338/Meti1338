'use strict';
/* Scene: pre-rendered parallax diorama layers for the Thornwood clearing (Verdance). */

const PADX = 28;                                  // layers are wider than the screen so the camera can pan
const SCENE = { layers: [], leaves: [], motes: [] };

function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function buildScene() {
  const W = LW + PADX * 2, r = seeded(11);
  const mk = () => new Pix(W, LH);

  /* sky */
  const sky = mk();
  const skyR = ramp('#f6d6a0', '#e8b890', '#a8b8d8', '#6e94cc', '#46689e');
  for (let y = 0; y < 120; y++) for (let x = 0; x < W; x++) {
    const s = clamp(y / 118, 0, 1);
    sky.set(x, y, sky.shade(skyR.slice().reverse(), s, x, y, .9));
  }
  const cloud = ramp('#c89aa0', '#e8c0b0', '#fbe2c8', '#fff6e8');
  for (const [cx, cy, s] of [[70, 34, 1], [210, 20, .8], [330, 44, 1.2], [470, 26, .9]]) {
    for (let i = 0; i < 6; i++) sky.ellipse(cx + (i - 2.5) * 11 * s, cy + Math.sin(i * 1.7) * 3, 12 * s, 6 * s, cloud, { amb: .45 });
  }
  SCENE.layers.push({ pix: sky, par: .08 });

  /* far hills and shrine of the old gods */
  const farL = mk();
  const haze = ramp('#6a7aa8', '#7e8eb8', '#94a2c6', '#aab6d2');
  const hill = x => 86 + Math.sin(x / 47) * 9 + Math.sin(x / 19) * 3;
  for (let x = 0; x < W; x++) for (let y = Math.floor(hill(x)); y < 130; y++) farL.set(x, y, farL.shade(haze, .75 - (y - hill(x)) / 60, x, y));
  const tx = 150;
  farL.poly([[tx - 7, 88], [tx - 5, 46], [tx + 5, 46], [tx + 7, 88]], haze, { grad: [tx - 6, 46, tx + 7, 90], hi: .6, lo: .1 });
  farL.poly([[tx - 9, 48], [tx, 36], [tx + 9, 48]], haze, { flat: 1 });
  for (const ox of [-26, 24]) farL.poly([[tx + ox - 3, 88], [tx + ox - 3, 64], [tx + ox + 3, 62], [tx + ox + 3, 88]], haze, { flat: 1 });
  SCENE.layers.push({ pix: farL, par: .22 });
  SCENE.shrine = { x: tx, y: 52, par: .22 };

  /* mid treeline */
  const mid = mk();
  const leafA = ramp('#16302a', '#22463a', '#346246', '#4e8250', '#76a85a'), trunk = ramp('#1c1418', '#2e2026', '#46323a', '#604650');
  for (let x = -10; x < W + 10; x += 22 + Math.floor(r() * 10)) {
    const h = 30 + r() * 30, y0 = 118 - h;
    mid.capsule(x, y0 + 20, x + r() * 4 - 2, 128, 3 + r() * 2, 4, trunk);
    for (let i = 0; i < 7; i++) {
      const ox = (r() - .5) * 28, oy = (r() - .5) * 26, rr = 9 + r() * 8;
      mid.ellipse(x + ox, y0 + oy, rr * 1.1, rr * .9, leafA, { amb: .3 });
    }
  }
  for (let x = 0; x < W; x++) for (let y = 100; y < 132; y++) if (mid.get(x, y) && ((x + y) & 1) && y > 118) mid.set(x, y, leafA[0]);
  SCENE.layers.push({ pix: mid, par: .5 });

  /* ground (the battle floor) */
  const gr = mk();
  const grass = ramp('#284a2a', '#355e30', '#467838', '#5e9440', '#80b04e');
  const dirt = ramp('#5a4028', '#7a5a36', '#9a7a4c', '#bca068', '#dcc88e');
  for (let y = 114; y < LH; y++) for (let x = 0; x < W; x++) {
    const depth = (y - 114) / (LH - 114);
    const nx = (x - W / 2) / (W * .52), ny = (y - 196) / 64, path = nx * nx + ny * ny;
    const n = Math.sin(x * .31 + y * .7) * .08 + Math.sin(x * .07 - y * .2) * .1 + (r() - .5) * .08;
    if (path < 1 + n * 1.5) gr.set(x, y, gr.shade(dirt, clamp(.62 - depth * .25 + n + (1 - path) * .1, 0, .99), x, y));
    else gr.set(x, y, gr.shade(grass, clamp(.72 - depth * .35 + n * 1.2, 0, .99), x, y));
  }
  for (let i = 0; i < 900; i++) {                   // grass tufts, bigger toward the camera
    const y = 116 + Math.floor(Math.pow(r(), .8) * (LH - 116)), x = Math.floor(r() * W);
    const nx = (x - W / 2) / (W * .52), ny = (y - 196) / 64;
    if (nx * nx + ny * ny < .92) continue;
    const s = 1 + Math.floor((y - 116) / 50);
    for (let k = 0; k < s + 1; k++) { gr.set(x - k, y - k - 1, grass[4]); gr.set(x + k, y - k - 1, grass[3]); }
    gr.set(x, y - 1, grass[3]);
  }
  for (let i = 0; i < 70; i++) {                    // pebbles on the path
    const x = r() * W, y = 150 + r() * 110;
    const nx = (x - W / 2) / (W * .52), ny = (y - 196) / 64;
    if (nx * nx + ny * ny > .9) continue;
    const s = .8 + (y - 150) / 70;
    gr.ellipse(x, y, 1.3 * s, .9 * s, ramp('#5a5060', '#8a8090', '#b8b0bc', '#e0dae0'));
  }
  const flowers = ['#ffd27a', '#ff9ac6', '#fff3c4', '#9ad0ff', '#ff6a5a'].map(hex32);
  for (let i = 0; i < 160; i++) {
    const y = 118 + r() * 150, x = r() * W, nx = (x - W / 2) / (W * .52), ny = (y - 196) / 64;
    if (nx * nx + ny * ny < 1.05) continue;
    const c = flowers[i % 5]; gr.set(x, y, c); if (y > 190) { gr.set(x + 1, y, c); gr.set(x, y - 1, c); gr.set(x + 1, y + 1, hex32('#2a4a22')); }
  }
  // standing stones at the back of the clearing, a log at the left
  const stone = ramp('#3a3848', '#5a5a6e', '#7e8094', '#a8aabb');
  for (const [x, h] of [[270, 20], [296, 14], [246, 12]]) {
    gr.poly([[x - 4, 124], [x - 4.5, 124 - h], [x - 1, 120 - h - 3], [x + 4, 124 - h], [x + 4.5, 124]], stone, { grad: [x - 4, 120 - h, x + 4, 124] });
    gr.ellipse(x - .5, 126, 6, 1.6, grass, { flat: 0 });
  }
  gr.capsule(40, 132, 92, 128, 5, 4.4, ramp('#2a1a12', '#4a3020', '#6e4a2e', '#946a42'));
  gr.ellipse(40, 132, 4.6, 5, ramp('#6a4a2a', '#9a7a4c', '#c8a66a', '#e8cc90'), { ring: .3 });
  gr.ellipse(70, 126, 12, 2.4, ramp('#2c5426', '#4a8434', '#7cb84a', '#a8d86a'));
  SCENE.layers.push({ pix: gr, par: 1 });
  SCENE.runes = [{ x: 270, y: 112 }, { x: 296, y: 116 }, { x: 246, y: 118 }];

  /* foreground (blurred by depth of field) */
  const fg = mk();
  const fern = ramp('#0e1a14', '#16281c', '#223a26', '#2e4c2e');
  for (const [bx, by, n, dirx] of [[10, 272, 9, 1], [W - 10, 272, 9, -1], [150, 280, 5, 1], [W - 120, 280, 4, -1]]) {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + dirx * (i / n) * 1.4 - dirx * .2, len = 30 + r() * 26;
      const ex = bx + Math.cos(a) * len * (dirx), ey = by + Math.sin(a) * len;
      fg.capsule(bx, by, ex, ey, 4, 1.2, fern);
    }
  }
  fg.capsule(4, 0, 12, 280, 9, 13, ramp('#0a0a0e', '#16141c', '#221e28', '#302a36'));
  fg.capsule(W - 6, 0, W - 16, 280, 10, 14, ramp('#0a0a0e', '#16141c', '#221e28', '#302a36'));
  for (let i = 0; i < 26; i++) fg.ellipse(r() < .5 ? r() * 60 : W - r() * 60, r() * 36, 10 + r() * 8, 7 + r() * 5, fern);
  SCENE.layers.push({ pix: fg, par: 1.35, fore: true });

  for (const L of SCENE.layers) L.cv = L.pix.finish({ outline: false });

  for (let i = 0; i < 18; i++) SCENE.leaves.push({ x: r() * LW, y: r() * LH, vx: .15 + r() * .2, vy: .18 + r() * .2, ph: r() * 6, c: pickOne(['#e8a040', '#c8d060', '#ff8a4a', '#7ab84a']) });
  for (let i = 0; i < 34; i++) SCENE.motes.push({ x: r() * LW, y: 60 + r() * 200, ph: r() * 6, s: .3 + r() * .7 });
}

function drawLayers(ctx, cam, fore) {
  for (const L of SCENE.layers) {
    if (!!L.fore !== fore) continue;
    ctx.drawImage(L.cv, Math.round(-PADX - cam.lx * L.par), Math.round(-cam.ly * L.par));
  }
}
function drawAmbientLow(ctx, cam, t) {
  const ox = -cam.lx, oy = -cam.ly;
  for (const l of SCENE.leaves) {
    l.x += l.vx + Math.sin(t / 700 + l.ph) * .15; l.y += l.vy;
    if (l.y > LH + 4) { l.y = -4; l.x = Math.random() * LW; } if (l.x > LW + 4) l.x = -4;
    ctx.fillStyle = l.c;
    const flip = Math.sin(t / 180 + l.ph) > 0;
    ctx.fillRect(Math.round(l.x + ox * .8), Math.round(l.y + oy * .8), flip ? 2 : 1, flip ? 1 : 2);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (const m of SCENE.motes) {
    const a = .25 + .5 * Math.max(0, Math.sin(t / 600 * m.s + m.ph));
    const x = Math.round(m.x + Math.sin(t / 1500 + m.ph) * 8 + ox), y = Math.round(m.y + Math.cos(t / 1900 + m.ph) * 5 + oy);
    ctx.fillStyle = 'rgba(255,236,170,' + a + ')'; ctx.fillRect(x, y, 1, 1);
  }
  // rune glow on the standing stones (magic veins in Verdance)
  for (const rn of SCENE.runes) {
    const a = .45 + .35 * Math.sin(t / 500 + rn.x);
    ctx.fillStyle = 'rgba(255,200,90,' + a + ')';
    ctx.fillRect(Math.round(rn.x + ox), Math.round(rn.y + oy), 1, 3); ctx.fillRect(Math.round(rn.x - 1 + ox), Math.round(rn.y + 1 + oy), 3, 1);
  }
  ctx.globalCompositeOperation = 'source-over';
}
