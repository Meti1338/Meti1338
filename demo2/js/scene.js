'use strict';
/* Scene: pre-rendered parallax diorama layers for the Thornwood clearing (Verdance). */

const PADX = 28;                                  // layers are wider than the screen so the camera can pan
const SCENE = { layers: [], leaves: [], motes: [] };

function seeded(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function buildScene() {
  const W = LW + PADX * 2, r = seeded(11), D = 2;
  const mk = () => new Pix(W, LH, D);
  const q = 1 / D;
  const lerpC = (c0, c1, t) => { const a = hexRGB(c0), b2 = hexRGB(c1); return u32(lerp(a[0], b2[0], t) | 0, lerp(a[1], b2[1], t) | 0, lerp(a[2], b2[2], t) | 0); };
  const dab = (px, x, y, rx, ry, rp, o) => px.ellipse(x, y, rx, ry, rp, Object.assign({ dither: .12 }, o || {}));

  /* sky: pale blue to warm cream, soft clouds */
  const sky = mk();
  for (let fy = 0; fy < 130 * D; fy++) { const t = fy / (130 * D), c = t < .6 ? lerpC('#8fbde0', '#cfe0e6', t / .6) : lerpC('#cfe0e6', '#f6eed4', (t - .6) / .4); for (let fx = 0; fx < W * D; fx++) sky.fset(fx, fy, c); }
  const cloud = ramp('#a9bfd6', '#c9d8e6', '#e6eef4', '#f8fbfc', '#ffffff');
  for (const [cx, cy, sc] of [[330, 26, 1.3], [420, 62, .9], [120, 14, .8], [470, 18, 1], [250, 50, .7]]) {
    for (let i = 0; i < 9; i++) dab(sky, cx + (i - 4) * 9 * sc + r() * 4, cy + Math.sin(i * 1.3) * 3 * sc - (i > 2 && i < 6 ? 4 * sc : 0), (9 + r() * 5) * sc, (6 + r() * 3) * sc, cloud, { amb: .55 });
  }
  SCENE.layers.push({ pix: sky, par: .06 });

  /* far forest: hazy blue-green canopies */
  const far = mk();
  const hazeG = ramp('#7c9e98', '#8fb0a2', '#a6c2ac', '#bdd3b8', '#d2e2c8');
  for (let x = -10; x < W + 10; x += 9 + r() * 7) {
    const y0 = 72 + r() * 22, rr = 9 + r() * 9;
    far.capsule(x, y0 + rr * .6, x, 128, 1.4, 1.6, ramp('#8a9a94', '#98a8a0', '#a8b6ac', '#b8c4b8'));
    dab(far, x, y0, rr, rr * .85, hazeG, { amb: .5 });
    dab(far, x - rr * .5, y0 + rr * .4, rr * .7, rr * .6, hazeG, { amb: .5 });
  }
  SCENE.layers.push({ pix: far, par: .2 });

  /* mid forest: saturated rounded canopies, trunks with bark */
  const mid = mk();
  const leaf = ramp('#1e4a2a', '#2e6a34', '#44883c', '#62a44a', '#8cc45e', '#b6dc7a');
  const bark = ramp('#2a2018', '#43352a', '#5e4c3c', '#7c6852', '#9a8670');
  for (let x = -8; x < W + 10; x += 30 + r() * 20) {
    const top = 34 + r() * 30, R = 16 + r() * 10, tx = x + r() * 4;
    mid.capsule(tx, top + R, tx + r() * 3 - 1.5, 126, 3 + r(), 4.2, bark, { amb: .25, bias: -.15 });
    for (let k = 0; k < 4; k++) mid.hair(tx - 2 + k, top + R + 4 + k * 3, tx - 1.5 + k, 124, bark[0]);
    for (let i = 0; i < 9; i++) {
      const ox = (r() - .5) * R * 2.1, oy = (r() - .5) * R * 1.4, rr = R * (.45 + r() * .35);
      dab(mid, tx + ox, top + oy, rr, rr * .82, leaf, { amb: .38 });
    }
    for (let i = 0; i < 26; i++) {                  // leaf dabs for a painted texture
      const a = r() * 6.28, d2 = r() * R, lx = tx + Math.cos(a) * d2 * 1.1, ly = top + Math.sin(a) * d2 * .7 - 2;
      mid.ellipse(lx, ly, 1.4 + r() * 1.4, 1 + r(), leaf, { amb: .5, bias: ly < top ? .15 : -.1, dither: 0 });
    }
  }
  // soft haze over the mid forest
  for (let fy = 30 * D; fy < 128 * D; fy++) for (let fx = 0; fx < W * D; fx++) { const i = fy * mid.w + fx, c = mid.buf[i]; if (c) mid.buf[i] = mix32(c, 200, 222, 196, .12 + .1 * (1 - fy / (128 * D))); }
  SCENE.layers.push({ pix: mid, par: .45 });

  /* ground: meadow edges, ochre dirt clearing with cracks, pebbles, grass tufts, standing stones */
  const gr = mk();
  const grass = ramp('#3a6a2a', '#4e8432', '#64a03c', '#80b84a', '#a0cc5e');
  const dirt = ramp('#6e4e2e', '#8c6a40', '#a8844e', '#c29c62', '#d6b47a');
  const inClear = (x, y) => { const nx = (x - W / 2 + 6) / (W * .56), ny = (y - 212) / 92; return nx * nx + ny * ny; };
  for (let fy = 116 * D; fy < LH * D; fy++) for (let fx = 0; fx < W * D; fx++) {
    const x = fx / D, y = fy / D, depth = (y - 116) / (LH - 116);
    const n = Math.sin(x * .21 + y * .5) * .05 + Math.sin(x * .05 - y * .13) * .08 + (r() - .5) * .05;
    const pc = inClear(x, y);
    if (pc < 1 + n * 1.2) gr.fset(fx, fy, gr.shade(dirt, clamp(.7 - depth * .28 + n + (1 - pc) * .12, 0, .99), fx, fy, .25));
    else gr.fset(fx, fy, gr.shade(grass, clamp(.8 - depth * .3 + n * 1.3, 0, .99), fx, fy, .3));
  }
  for (let i = 0; i < 90; i++) {                    // cracks in the dirt
    let x = r() * W, y = 132 + r() * 136; if (inClear(x, y) > .85) continue;
    const s0 = .6 + (y - 132) / 120; let a = r() * 6.28;
    for (let k = 0; k < 4 + r() * 6; k++) { const nx = x + Math.cos(a) * 3 * s0, ny = y + Math.sin(a) * 1.4 * s0; gr.hair(x, y, nx, ny, dirt[0]); gr.hair(x, y + q, nx, ny + q, dirt[4]); x = nx; y = ny; a += (r() - .5) * 1.4; }
  }
  for (let i = 0; i < 140; i++) {                   // pebbles
    const x = r() * W, y = 130 + Math.pow(r(), .8) * 138; if (inClear(x, y) > .95) continue;
    const s0 = .5 + (y - 130) / 110; gr.ellipse(x, y, 1.4 * s0, .9 * s0, ramp('#6a6660', '#8e8a84', '#b4b0a8', '#d8d4cc'), { amb: .45, dither: 0 });
  }
  for (let i = 0; i < 1400; i++) {                  // grass blades, bigger toward the camera
    const x = r() * W, y = 118 + Math.pow(r(), .7) * (LH - 118), pc = inClear(x, y);
    if (pc < .9 && r() > .06) continue;
    const s0 = .5 + (y - 118) / 70, c = grass[2 + Math.floor(r() * 3)], lean = (r() - .5) * 2;
    for (let k = 0; k < 3; k++) gr.hair(x + k * q * 2, y, x + k * q * 2 + lean * s0, y - (2 + r() * 3) * s0, k === 1 ? grass[4] : c);
  }
  const flowers = ['#fff3c4', '#ffd27a', '#e8f0ff', '#ffb0c8'].map(hex32);
  for (let i = 0; i < 120; i++) { const x = r() * W, y = 120 + r() * 150; if (inClear(x, y) < 1.05) continue; gr.dot(x, y, flowers[i % 4]); gr.dot(x + q, y, flowers[i % 4]); }
  const stone = ramp('#5a5e62', '#7a7e82', '#9a9ea0', '#bcc0c0', '#dadcdc');
  for (const [x, h] of [[276, 22], [300, 16]]) {
    gr.poly([[x - 4, 126], [x - 4.2, 126 - h], [x - 1, 122 - h - 2], [x + 3.5, 125 - h], [x + 4.2, 126]], stone, { grad: [x - 4, 120 - h, x + 4, 126], dither: .1 });
    gr.ellipse(x, 126.5, 6, 1.6, grass, { flat: 1 });
    SCENE.runes && 0;
  }
  SCENE.layers.push({ pix: gr, par: 1 });
  SCENE.runes = [{ x: 276, y: 110 }, { x: 300, y: 115 }];

  /* framing trees and foreground grass (blurred by depth of field) */
  const fg = mk();
  const bigBark = ramp('#1e1612', '#34281e', '#4e3e2e', '#6a5640', '#8a7456');
  const bigLeaf = ramp('#12301a', '#1c4624', '#2a6030', '#3e7e3a', '#5c9c48', '#86bc5c');
  for (const [tx, dir] of [[PADX + 12, 1], [W - PADX - 12, -1]]) {
    fg.poly([[tx - 26, LH], [tx - 16, 190], [tx - 12, 90], [tx - 18, -4], [tx + 18, -4], [tx + 12, 90], [tx + 16, 190], [tx + 30, LH]], bigBark, { grad: [tx - 12, 0, tx + 14, 0], dither: .15 });
    for (let k = 0; k < 11; k++) fg.hair(tx - 13 + k * 2.6, 6 + (k % 4) * 9, tx - 16 + k * 3.4 + Math.sin(k) * 2, LH, bigBark[k % 2 ? 0 : 4]);
    for (let k = 0; k < 2; k++) fg.capsule(tx + dir * (14 + k * 4), LH - 26 + k * 10, tx + dir * (34 + k * 12), LH - 14 + k * 10, 4.4 - k, 2, bigBark, { amb: .35 });
    fg.capsule(tx + dir * 8, 30, tx + dir * 50, 6, 4.6, 2.4, bigBark, { amb: .35 });
    for (let i = 0; i < 16; i++) { const ox = dir * (r() * 90 - 10), oy = r() * 44 - 20, rr = 10 + r() * 10; dab(fg, tx + ox, oy, rr * 1.2, rr, bigLeaf, { amb: .35 }); }
    for (let i = 0; i < 60; i++) { const ox = dir * (r() * 100 - 10), oy = r() * 50 - 22; fg.ellipse(tx + ox, oy, 1.6 + r(), 1.1 + r() * .6, bigLeaf, { amb: .55, bias: .1, dither: 0 }); }
  }
  const fgGrass = ramp('#16301a', '#224424', '#305a2c', '#44743a');
  for (let i = 0; i < 520; i++) {
    const x = r() * W, y = LH + 2 - r() * 18, h = 8 + r() * 16, lean = (r() - .5) * 8;
    const c = fgGrass[Math.floor(r() * 4)];
    fg.capsule(x, y, x + lean, y - h, 1.1, .3, [c, c, c, c], { flat: 0 });
  }
  SCENE.layers.push({ pix: fg, par: 1.25, fore: true });

  for (const L of SCENE.layers) L.cv = L.pix.finish({ outline: false });

  for (let i = 0; i < 18; i++) SCENE.leaves.push({ x: r() * LW, y: r() * LH, vx: .15 + r() * .2, vy: .18 + r() * .2, ph: r() * 6, c: pickOne(['#e8c040', '#b8d060', '#f0a04a', '#7ab84a']) });
  for (let i = 0; i < 40; i++) SCENE.motes.push({ x: r() * LW, y: 40 + r() * 200, ph: r() * 6, s: .3 + r() * .7 });
}

function drawLayers(ctx, cam, fore) {
  for (const L of SCENE.layers) {
    if (!!L.fore !== fore) continue;
    ctx.drawImage(L.cv, Math.round((-PADX - cam.lx * L.par) * RES) / RES, Math.round(-cam.ly * L.par * RES) / RES, L.cv.width / L.pix.d, L.cv.height / L.pix.d);
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
