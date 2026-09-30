'use strict';
/* Actors: posable pixel rigs. Humanoids face left (toward enemies), enemies face right.
   Poses are flat objects of numbers so they can be blended; angles are in degrees.
   Limb angle convention: 0 = straight down, +90 = forward (toward the opponent), 180 = up. */

const D2R = Math.PI / 180;
const fdir = a => ({ x: -Math.sin(a * D2R), y: Math.cos(a * D2R) });   // humanoids: forward is -x
const edir = a => ({ x: Math.sin(a * D2R), y: Math.cos(a * D2R) });    // enemies: forward is +x
const add = (p, d, k) => ({ x: p.x + d.x * k, y: p.y + d.y * k });

/* ---------- palettes ---------- */
const PAL = {
  eye: hex32('#140c1c'),
  gold: ramp('#4a3414', '#7a5a26', '#a88440', '#d4b270'),
  fur: ramp('#3e3426', '#6a5c44', '#968462', '#c2b08a', '#e4d6b2'),
  wood: ramp('#24140c', '#462a16', '#724824', '#a07440'),
  steel: ramp('#24262c', '#484c56', '#737884', '#a8acb4'),
  // Aruna
  aSkin: ramp('#4a2a22', '#7a4a36', '#a26e52', '#c8926c'),
  aHair: ramp('#1a1210', '#2e221c', '#4a382c', '#6a5440'),
  aRobe: ramp('#1a1c2e', '#2c3050', '#434a72', '#646c96'),
  aCloak: ramp('#141820', '#222a34', '#34404c', '#4a5864'),
  aShawl: ramp('#5a3414', '#8a5a26', '#b8843e', '#d8aa64'),
  aOrb: ramp('#6a1a5a', '#c2409a', '#ff80d0', '#fff0fa'),
  aBoot: ramp('#1e1612', '#342820', '#4e3c2e', '#6a5440'),
  // Ayo
  yySkin: ramp('#22140e', '#3e2618', '#5e3c26', '#80583a'),
  yyHair: ramp('#0e0a08', '#221812', '#3a2a20', '#5a4232'),
  yyTunic: ramp('#12281e', '#1e4030', '#2e5c44', '#46785a'),
  yyBand: ramp('#4a2410', '#7a3e1c', '#a8602e', '#cc8a4e'),
  yySash: ramp('#3a1412', '#62221e', '#8a3a30', '#b05a48'),
  yyPants: ramp('#20160e', '#382818', '#523c26', '#6e5638'),
  yyWrap: ramp('#4a4234', '#6e644e', '#948868', '#bcb08a'),
  // Serafina
  sSkin: ramp('#8a5048', '#c0806c', '#e2ae94', '#fad8c2'),
  sHair: ramp('#5a5664', '#8c8898', '#b8b4c0', '#dedae2'),
  sCape: ramp('#240c10', '#421a1e', '#62282c', '#84403e'),
  sSkirt: ramp('#1a0c10', '#301820', '#4a2630', '#683a42'),
  sGreave: ramp('#1a1a1e', '#2e3036', '#464a52', '#646a72'),
  // enemies
  wFur: ramp('#1e4424', '#2e6232', '#468440', '#66a452', '#90c46c'),
  wMane: ramp('#18381e', '#26542a', '#3a7438', '#56924a'),
  wBelly: ramp('#5e7a44', '#86a060', '#aec482', '#d2e2a4'),
  bone: ramp('#5a4a2e', '#9a865e', '#d6c896', '#fff6d6'),
  bark: ramp('#22140c', '#3e281a', '#63432a', '#8e663e'),
  stone: ramp('#2a2a38', '#4c4e62', '#767a90', '#a8acbe'),
  moss: ramp('#18321a', '#2c5426', '#4a8434', '#7cb84a'),
  mWing: ramp('#34245e', '#4e3c8e', '#6e5cb4', '#9282d4', '#b8aaec'),
  gStone: ramp('#3a3c42', '#565a60', '#76797c', '#96978f', '#b4b2a6'),
  gGold: ramp('#5a3e14', '#8a6424', '#b88a38', '#dcb458', '#f4dc8a'),
  gWood: ramp('#3a2414', '#5a3a20', '#7a5430', '#9a6e40', '#b88a56'),
  gMoss: ramp('#2e5a1e', '#44802a', '#62a038', '#86c04c', '#aede6a'),
  mFur: ramp('#6a5030', '#a8885a', '#dac08a', '#fff0c8'),
  mEye: ramp('#0a5a6a', '#18a8b8', '#6af0f0', '#e6ffff')
};
const FAR = {};
function far(name) { return FAR[name] || (FAR[name] = dimRamp(PAL[name])); }

/* ---------- humanoid rig ---------- */
const HD = { rootX: 52, ground: 74, th: 7.4, sh: 7.2, torso: 10.2, neck: 6.2, ua: 6, la: 5.4, hr: 6.4, hs: .74 };  // normal proportions; heads are drawn at 6.4 and scaled by hs
const NEUTRAL = { bx: 0, by: 0, lean: 4, head: 0, aN0: 12, aN1: 25, aF0: -10, aF1: 20, lN0: 10, lN1: -8, lF0: -9, lF1: -3, wN: 0, wF: 0, cape: .2, blink: 0 };
const P = o => Object.assign({}, NEUTRAL, o);
function mixPose(a, b, t) { const o = {}; for (const k in a) o[k] = a[k] + ((b[k] === undefined ? a[k] : b[k]) - a[k]) * t; return o; }

function solveHuman(p, breath) {
  const legs = {};
  for (const [k, a0, a1, off] of [['N', p.lN0, p.lN1, -1.3], ['F', p.lF0, p.lF1, 1.5]]) {
    const h = { x: HD.rootX + p.bx + off, y: 0 };
    const kn = add(h, fdir(a0), HD.th), ft = add(kn, fdir(a0 + a1), HD.sh);
    legs[k] = { h, kn, ft };
  }
  const low = Math.max(legs.N.ft.y, legs.F.ft.y), dy = HD.ground - low + p.by;
  for (const k in legs) for (const j of ['h', 'kn', 'ft']) legs[k][j].y += dy;
  const hip = { x: HD.rootX + p.bx, y: dy };
  const up = fdir(180 - p.lean);
  const neck = add(hip, up, HD.torso + breath);
  const head = add(neck, fdir(180 - p.lean - p.head), HD.neck);
  const sN = { x: neck.x - 2.6, y: neck.y + 1.8 + breath * .5 }, sF = { x: neck.x + 2.8, y: neck.y + 1.4 + breath * .5 };
  const eN = add(sN, fdir(p.aN0), HD.ua), hN = add(eN, fdir(p.aN0 + p.aN1), HD.la);
  const eF = add(sF, fdir(p.aF0), HD.ua), hF = add(eF, fdir(p.aF0 + p.aF1), HD.la);
  return { legs, hip, up, neck, head, sN, eN, hN, sF, eF, hF, wN: p.aN0 + p.aN1 + p.wN, wF: p.aF0 + p.aF1 + p.wF };
}
function hArm(px, s, e, h, sleeve, skin, forearmSkin, band) {
  px.capsule(s.x, s.y, e.x, e.y, 1.75, 1.45, sleeve);
  px.capsule(e.x, e.y, h.x, h.y, 1.45, 1.25, forearmSkin ? skin : sleeve);
  if (band) px.capsule(e.x + (h.x - e.x) * .45, e.y + (h.y - e.y) * .45, e.x + (h.x - e.x) * .75, e.y + (h.y - e.y) * .75, 1.9, 1.9, band);
  px.ellipse(h.x, h.y, 1.5, 1.5, skin);
}
function hLeg(px, L, pants, boots, feet) {
  px.capsule(L.h.x, L.h.y, L.kn.x, L.kn.y, 2.2, 1.8, pants);
  px.capsule(L.kn.x, L.kn.y, L.ft.x, L.ft.y, 1.9, 1.7, boots);
  px.capsule(L.ft.x + .8, L.ft.y - .5, L.ft.x - 2.6, L.ft.y + .1, 1.7, 1.4, feet || boots);
}
function hFace(px, J, p, eyeCol, skin) {           // front 3/4 face drawn in fine pixels
  const h = J.head, q = 1 / px.d, dk = PAL.eye, wh = hex32('#ffffff');
  const [r, g, bl] = unpack(eyeCol), irisD = u32(r * .5 | 0, g * .5 | 0, bl * .6 | 0), irisL = u32(Math.min(255, r * 1.25 + 40) | 0, Math.min(255, g * 1.25 + 40) | 0, Math.min(255, bl * 1.2 + 40) | 0);
  const eyes = [[h.x - 1.9, 2.5], [h.x - 5.1, 1.5]], y0 = h.y + .3;
  for (const [x0, wd] of eyes) {
    const cols = Math.round(wd * px.d), rows = Math.round(3 * px.d);
    if (p.blink > .5) { for (let i = -1; i <= cols; i++) px.dot(x0 + i * q, y0 + 2 * q * px.d / 2 + q, dk); continue; }
    for (let i = -1; i <= cols; i++) px.dot(x0 + i * q, y0, dk);                                   // lash line
    for (let j = 1; j < rows; j++) for (let i = 0; i < cols; i++) {
      const u = j / rows; px.dot(x0 + i * q, y0 + j * q, u < .45 ? irisD : u > .8 ? irisL : eyeCol);
    }
    const pc = x0 + Math.floor(cols / 2) * q;
    px.dot(pc, y0 + 2 * q, dk); px.dot(pc, y0 + 3 * q, dk);                                        // pupil
    px.dot(x0, y0 + q, wh); if (cols > 3) px.dot(x0 + q, y0 + q, wh);                                 // highlight
    px.dot(x0 + (cols - 1) * q, y0 + (rows - 2) * q, irisL);
    px.dot(x0 + (cols - 1) * q, y0 + (rows - 1) * q, dk);
  }
  px.dot(h.x - 3.3, h.y + 3.2, skin[1]);                                                            // nose
  px.dot(h.x - 3.6, h.y + 4.4, skin[0]); px.dot(h.x - 3.1, h.y + 4.5, skin[0]); px.dot(h.x - 2.6, h.y + 4.4, skin[1]);   // mouth
  px.dot(h.x - .6, h.y + 3.3, u32(...unpack(skin[3]).slice(0, 3).map((v, i) => Math.min(255, v + [30, 0, 10][i]))));   // cheek glow
}
function furCollar(px, n, w) {                         // chunky fur collar with tufted lower edge
  w = w || 5.4;
  px.ellipse(n.x + .6, n.y + 1.4, w, 2.8, PAL.fur, { amb: .4 });
  const q = 1 / px.d;
  for (let x = n.x - w + 1; x < n.x + w - .5; x += q) { const k = Math.round(x * px.d); px.dot(x, n.y + 3.6 + (k % 3) * q, k % 2 ? PAL.fur[1] : PAL.fur[2]); if (k % 3 === 0) px.dot(x, n.y + 4 + q, PAL.fur[0]); }
  for (let x = n.x - w + 1.5; x < n.x + w - .5; x += 1.5) { px.dot(x, n.y + .4, PAL.fur[4]); px.dot(x + q, n.y + .9, PAL.fur[3]); px.dot(x - q, n.y + 1.6, PAL.fur[1]); }
}
function folds(px, list, rp) {                       // cloth folds: thin shadow line with a lit edge
  const q = 1 / px.d;
  for (const [x0, y0, x1, y1] of list) { px.hair(x0, y0, x1, y1, rp[0]); px.hair(x0 - q, y0, x1 - q, y1, rp[rp.length - 1]); }
}
function hHead(px, J, skin) { px.ellipse(J.head.x, J.head.y + .6, HD.hr, HD.hr - .4, skin, { amb: .5, dither: .15, bias: .08 }); }
function spikes(px, list, rp) {                      // hair strands: [baseX, baseY, tipX, tipY, width]
  for (const [bx, by, tx, ty, w] of list) {
    const dx = tx - bx, dy = ty - by, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w;
    px.poly([[bx + nx, by + ny], [tx, ty], [bx - nx, by - ny]], rp, { grad: [bx - 2, by - 2, tx + 1, ty + 2], hi: .98 });
    px.hair(bx + nx * .35, by + ny * .35, lerp(bx, tx, .6), lerp(by, ty, .6), rp[rp.length - 1]);
    px.hair(bx - nx * .5, by - ny * .5, lerp(bx, tx, .85), lerp(by, ty, .85), rp[0]);
  }
}
function curvedBlade(px, h, ang, len, curve, r0, rp, edge) {
  let p = { x: h.x, y: h.y }, a = ang; const pts = [p];
  const steps = Math.ceil(len / 1.2);
  for (let i = 0; i < steps; i++) { a += curve; p = add(p, fdir(a), 1.2); pts.push(p); }
  for (let i = 0; i < pts.length - 1; i++) {
    const r = lerp(r0, .45, i / pts.length);
    px.capsule(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y, r, r * .92, rp, { bias: .1 });
  }
  if (edge) for (let i = 2; i < pts.length; i += 1) px.set(pts[i].x, pts[i].y, rp[3]);
  return pts[pts.length - 1];
}

/* ---------- costumes ---------- */
const COSTUME = {
  Aruna: {
    back(px, J, p, t) {
      const h = J.head, n = J.neck, sw = Math.sin(t / 420) * .8 + p.cape * 3;
      px.poly([[h.x + .5, h.y - 4.5], [h.x + 5.2, h.y - 1.5], [n.x + 6 + sw, n.y + 11], [n.x + 1.6 + sw * .5, n.y + 12.5], [n.x + .2, n.y + 2]], PAL.aHair, { grad: [h.x, h.y - 4, n.x + 4, n.y + 11] });
      px.poly([[n.x - 2.5, n.y + 1], [n.x + 4, n.y + .5], [n.x + 8.5 + sw * 1.6, HD.ground - 3 - sw], [n.x + 4 + sw, HD.ground - .5], [n.x - 1, HD.ground - 1.5]], PAL.aCloak, { grad: [n.x - 2, n.y, n.x + 8, HD.ground] });
      folds(px, [[n.x + 3, n.y + 3, n.x + 6.5 + sw * 1.4, HD.ground - 3], [n.x + 1, n.y + 4, n.x + 3 + sw, HD.ground - 1.5]], PAL.aCloak);
    },
    farArm(px, J) { hArm(px, J.sF, J.eF, J.hF, far('aRobe'), far('aSkin'), false, far('gold')); },
    legs(px, J) { hLeg(px, J.legs.F, far('aRobe'), far('aBoot')); hLeg(px, J.legs.N, PAL.aRobe, PAL.aBoot); },
    body(px, J) {
      const hp = J.hip, n = J.neck, fN = J.legs.N.ft, fF = J.legs.F.ft;
      px.capsule(hp.x, hp.y, n.x, n.y + 1, 3.8, 4.2, PAL.aRobe);
      const hemY = HD.ground - 1.5, hl = Math.min(fN.x, fF.x) - 3.4, hr = Math.max(fN.x, fF.x) + 3.2;
      px.poly([[hp.x - 3.5, hp.y - 1.5], [hp.x + 3.3, hp.y - 1.5], [hr, hemY], [hl, hemY]], PAL.aRobe, { grad: [hp.x - 3, hp.y, hr, hemY + 2] });
      folds(px, [[hp.x - 1.2, hp.y + 1.5, hl + 2.2, hemY - 1], [hp.x + 1.4, hp.y + 1.5, hr - 2.4, hemY - 1], [hp.x + .2, hp.y + 3, (hl + hr) / 2 + .6, hemY - 1]], PAL.aRobe);
      for (let x = Math.ceil(hl); x <= hr; x++) px.set(x, hemY - .5, PAL.gold[x % 3 ? 2 : 1]);
      px.line(hp.x - 1.5, hp.y + 1, (hl + hr) / 2 - 1.5, hemY - 1, PAL.gold[1]);
      px.poly([[n.x - 2.8, n.y + .8], [n.x + 2.8, n.y + .2], [hp.x + 3.6, hp.y - 1], [hp.x + .6, hp.y + .2]], PAL.aShawl, { grad: [n.x - 3, n.y, hp.x + 4, hp.y] });
      px.capsule(hp.x - 3.4, hp.y - 1.6, hp.x + 3.4, hp.y - 1.6, .9, .9, PAL.gold);
      furCollar(px, n, 5.6);
    },
    head(px, J, p) {
      const h = J.head, R = PAL.aHair;
      hHead(px, J, PAL.aSkin);
      px.ellipse(h.x + 1.8, h.y - 3.6, 6.8, 4.2, R);
      spikes(px, [[h.x - 5, h.y - 3.5, h.x - 7.2, h.y + 2.6, 1.6], [h.x - 3.4, h.y - 4.2, h.x - 4.6, h.y - .4, 1.6], [h.x - 1, h.y - 4.4, h.x - 2.2, h.y - .8, 1.5],
        [h.x + 1.4, h.y - 4.4, h.x + .8, h.y - .6, 1.4], [h.x + 3.5, h.y - 7.2, h.x + 7, h.y - 9.2, 1.6], [h.x - 1, h.y - 7.2, h.x - 2.4, h.y - 10, 1.5], [h.x + 5.5, h.y - 3, h.x + 8.2, h.y + 3.5, 1.8]], R);
      px.capsule(h.x - 6.4, h.y + 1, h.x - 6.8, h.y + 8.5, 1.4, .9, R);
      px.line(h.x - 6.4, h.y - 4.2, h.x + 5, h.y - 6.6, PAL.gold[2]);
      px.set(h.x - 2.2, h.y - 5, hex32('#ff4a6a')); px.set(h.x - 1.2, h.y - 4.4, PAL.gold[3]);
      px.set(h.x + 3.2, h.y + 3.6, PAL.gold[3]); px.set(h.x + 3.2, h.y + 4.6, PAL.gold[2]);
      hFace(px, J, p, hex32('#7a4ac8'), PAL.aSkin);
    },
    nearArm(px, J) { hArm(px, J.sN, J.eN, J.hN, PAL.aRobe, PAL.aSkin, false, PAL.gold); },
    weaponN(px, J, p, t) {
      const d = fdir(J.wN), b = add(J.hN, d, -12), top = add(J.hN, d, 19);
      px.capsule(b.x, b.y, top.x, top.y, .85, .85, PAL.wood);
      const c = add(top, d, 2.8);
      px.ellipse(c.x, c.y, 3.4, 3.4, PAL.gold, { ring: .42 });
      px.ellipse(c.x, c.y, 1.9, 1.9, PAL.aOrb, { bias: .15 });
      J.tip = c;
    }
  },
  Ayo: {
    back(px, J, p, t) {
      const h = J.head, fl = Math.sin(t / 260) * 1.2 + p.cape * 4;
      px.capsule(h.x + 3.6, h.y - 3, h.x + 9 + fl, h.y - 1 + fl * .4, .9, .5, PAL.yyBand);
      px.capsule(h.x + 3.6, h.y - 2.4, h.x + 7.8 + fl * .8, h.y + 2 + fl * .3, .8, .4, PAL.yyBand);
    },
    farArm(px, J) { hArm(px, J.sF, J.eF, J.hF, far('yyTunic'), far('yySkin'), true, far('gold')); },
    weaponF(px, J) {
      const d = fdir(J.wF), tip = add(J.hF, d, 8);
      px.capsule(J.hF.x, J.hF.y, tip.x, tip.y, .9, .4, far('steel'));
      const pr = fdir(J.wF + 90);
      px.capsule(J.hF.x - pr.x * 1.8, J.hF.y - pr.y * 1.8, J.hF.x + pr.x * 1.8, J.hF.y + pr.y * 1.8, .6, .6, far('gold'));
      J.tipF = tip;
    },
    legs(px, J) { hLeg(px, J.legs.F, far('yyPants'), far('yyWrap'), far('yyPants')); hLeg(px, J.legs.N, PAL.yyPants, PAL.yyWrap, PAL.yyPants); },
    body(px, J, p, t) {
      const hp = J.hip, n = J.neck;
      px.capsule(hp.x, hp.y, n.x, n.y + 1, 3.6, 4.2, PAL.yyTunic);
      const L0 = [n.x - 4.6, n.y + 1.2], R0 = [n.x + 4.9, n.y + .8], R1 = [hp.x + 5.9, hp.y + 1.6], L1 = [hp.x - 5.6, hp.y + 1.6];
      px.poly([L0, R0, R1, L1], PAL.yyTunic, { grad: [L0[0], L0[1], R1[0], R1[1]] });
      folds(px, [[n.x - 1.5, n.y + 5.5, hp.x - 3, hp.y - 1], [n.x + 2, n.y + 5.5, hp.x + 3, hp.y - 1]], PAL.yyTunic);
      const pat = [hex32('#c8a050'), hex32('#9a3a30'), hex32('#1a1014'), hex32('#9a3a30'), hex32('#c8a050'), hex32('#d8ccb0')];
      const rows = [Math.round(n.y + 4.5), Math.round(hp.y - .6)];
      rows.forEach((y, ri) => {
        for (let x = Math.floor(hp.x - 7); x <= hp.x + 7; x++) {
          if (!px.get(x, y)) continue;
          px.set(x, y, pat[(x + ri * 2 + 60) % 6]);
          if (px.get(x, y + 1) && (x & 1)) px.set(x, y + 1, (x + ri) % 4 ? hex32('#1a1014') : hex32('#f0c050'));
        }
      });
      const fy = Math.round(hp.y + 1.6);
      for (let x = Math.floor(L1[0]); x <= R1[0]; x++) if (px.get(x, fy - 1) && (x & 1)) px.set(x, fy, PAL.yyTunic[0]);
      px.capsule(hp.x - 4.8, hp.y + .3, hp.x + 5, hp.y + .3, 1.1, 1.1, PAL.yySash);
      const fl = Math.sin(t / 300) * .8 + p.cape * 3;
      px.capsule(hp.x + 4.6, hp.y + .5, hp.x + 7.6 + fl, hp.y + 5.2, 1, .7, PAL.yySash);
      const beads = [hex32('#e03a3a'), hex32('#3a8aff'), hex32('#f0c050')];
      px.ellipse(n.x + .4, n.y + 1.4, 4.8, 2.2, PAL.yyWrap, { amb: .4 });
      for (let i = -3; i <= 3; i++) px.set(n.x + i, n.y + 3, beads[(i + 3) % 3]);
    },
    head(px, J, p) {
      const h = J.head, R = PAL.yyHair;
      for (const [ox, oy, r] of [[5, -2.5, 2.8], [5.4, .8, 2.4], [3.4, -5.6, 2.8]]) px.ellipse(h.x + ox, h.y + oy, r, r, R);
      hHead(px, J, PAL.yySkin);
      for (const [ox, oy, r] of [[-4.6, -4.4, 2.3], [-2.4, -6.2, 2.8], [.6, -7, 3], [3.4, -5.8, 2.8], [-.8, -4.8, 2.4], [2.4, -4, 2.4], [-6, -1.6, 1.6]]) px.ellipse(h.x + ox, h.y + oy, r, r, R);
      spikes(px, [[h.x - 1, h.y - 8, h.x - 2.6, h.y - 11, 1.4], [h.x + 2.5, h.y - 8.4, h.x + 4.6, h.y - 11.4, 1.4], [h.x + 5.6, h.y - 5, h.x + 9, h.y - 6.5, 1.4]], R);
      px.capsule(h.x - 6.4, h.y - 2.6, h.x + 5.8, h.y - 4.6, 1.1, 1.1, PAL.yyBand);
      px.set(h.x + 3.4, h.y + 3, PAL.gold[3]); px.set(h.x + 3.4, h.y + 4, PAL.gold[2]);
      hFace(px, J, p, hex32('#c88a3a'), PAL.yySkin);
    },
    nearArm(px, J) { hArm(px, J.sN, J.eN, J.hN, PAL.yyTunic, PAL.yySkin, true, PAL.gold); },
    weaponN(px, J) {
      const tip = curvedBlade(px, J.hN, J.wN, 13, -2.6, 1.2, PAL.steel, true);
      const pr = fdir(J.wN + 90);
      px.capsule(J.hN.x - pr.x * 2.4, J.hN.y - pr.y * 2.4, J.hN.x + pr.x * 2.4, J.hN.y + pr.y * 2.4, .7, .7, PAL.gold);
      J.tip = tip;
    }
  },
  Serafina: {
    back(px, J, p, t) {
      const n = J.neck, h = J.head, fl = p.cape + Math.sin(t / 520) * .15, sw = Math.sin(t / 340) * .8;
      const A = [n.x - 1, n.y + 1], B = [n.x + 3.6, n.y + .4], C = [n.x + 7.5 + fl * 7 + sw, HD.ground - 5 - fl * 6], Dp = [n.x + 4.5 + fl * 3, HD.ground - 1 - fl * 2], E = [n.x + .5, HD.ground - 3];
      px.poly([A, B, C, Dp, E], PAL.sCape, { grad: [A[0], A[1], C[0], C[1] + 6] });
      folds(px, [[n.x + 2.4, n.y + 3, C[0] - 2, C[1] + 2], [n.x + 1.2, n.y + 4, Dp[0] - 1, Dp[1] - 1.5]], PAL.sCape);
      px.line(B[0], B[1], C[0], C[1], PAL.gold[1]);
      px.line(C[0], C[1], Dp[0], Dp[1], PAL.gold[2]);
      const b0 = { x: h.x + 2.9, y: h.y - 5.2 }, b1 = { x: h.x + 5.4 + sw * .4, y: h.y + 1.5 }, b2 = { x: h.x + 6.2 + fl * 2 + sw, y: h.y + 10 };
      px.capsule(b0.x, b0.y, b1.x, b1.y, 1.5, 1.3, PAL.sHair); px.capsule(b1.x, b1.y, b2.x, b2.y, 1.3, .8, PAL.sHair);
    },
    farArm(px, J) { hArm(px, J.sF, J.eF, J.hF, far('steel'), far('sSkin'), false, far('gold')); },
    weaponF(px, J, p, t) {
      const d = fdir(J.wF), pr = fdir(J.wF + 90), b = add(J.hF, d, -12), tip = add(J.hF, d, 18);
      px.capsule(b.x, b.y, tip.x, tip.y, .75, .75, PAL.wood);
      const pt = add(tip, d, 6.5);
      px.poly([[pt.x, pt.y], [tip.x + pr.x * 1.9, tip.y + pr.y * 1.9], [tip.x - d.x * 1.2, tip.y - d.y * 1.2], [tip.x - pr.x * 1.9, tip.y - pr.y * 1.9]], PAL.steel, { grad: [pt.x, pt.y - 2, tip.x, tip.y + 2], hi: .99 });
      const fl = Math.sin(t / 200) * 1.2, q0 = add(tip, d, -1.2), q1 = add(tip, d, -6);
      px.poly([[q0.x, q0.y], [q1.x, q1.y], [q0.x + 5 + fl, q0.y + 2.5 + fl * .5]], PAL.sCape, { flat: 2 });
      J.tipF = pt;
    },
    legs(px, J) { hLeg(px, J.legs.F, far('sSkirt'), far('sGreave')); hLeg(px, J.legs.N, PAL.sSkirt, PAL.sGreave); },
    body(px, J) {
      const hp = J.hip, n = J.neck;
      px.capsule(hp.x, hp.y, n.x, n.y + 1, 3.6, 4.3, PAL.steel);
      px.set(n.x - 2, n.y + 3, PAL.steel[3]); px.set(n.x - 2, n.y + 4, PAL.steel[3]);
      const t1 = [[hp.x - 4, hp.y - 1], [hp.x + 4, hp.y - 1], [hp.x + 6, hp.y + 3.6], [hp.x - 6.2, hp.y + 3.6]];
      const t2 = [[hp.x - 5.2, hp.y + 2.4], [hp.x + 5.2, hp.y + 2.4], [hp.x + 7.4, hp.y + 6.4], [hp.x - 7.6, hp.y + 6.4]];
      px.poly(t2, PAL.sSkirt, { grad: [hp.x - 5, hp.y + 3, hp.x + 7, hp.y + 9] });
      for (let x = Math.ceil(hp.x - 7.4); x <= hp.x + 7.2; x++) px.set(x, hp.y + 6, x & 1 ? PAL.sSkirt[3] : PAL.gold[2]);
      folds(px, [[hp.x - 3, hp.y + 3, hp.x - 4.6, hp.y + 6], [hp.x + 1, hp.y + 3, hp.x + 1.4, hp.y + 6], [hp.x + 4, hp.y + 3, hp.x + 5.6, hp.y + 6]], PAL.sSkirt);
      px.poly(t1, PAL.sSkirt, { grad: [hp.x - 4, hp.y - 1, hp.x + 6, hp.y + 5] });
      for (let x = Math.ceil(hp.x - 6); x <= hp.x + 5.8; x++) px.set(x, hp.y + 3.2, x & 1 ? PAL.sCape[3] : PAL.sSkirt[3]);
      px.capsule(hp.x - 3.4, hp.y - 1.4, hp.x + 3.4, hp.y - 1.4, .9, .9, PAL.gold);
      furCollar(px, n, 5.2);
    },
    head(px, J, p) {
      const h = J.head, R = PAL.sHair;
      px.poly([[h.x + 4, h.y - 1], [h.x + 11.5, h.y - 6.5], [h.x + 5.2, h.y + 2]], PAL.sSkin, { grad: [h.x + 11, h.y - 6, h.x + 4, h.y + 2] });
      hHead(px, J, PAL.sSkin);
      px.ellipse(h.x + 1.8, h.y - 3.6, 6.8, 4.2, R);
      px.ellipse(h.x + 3.6, h.y - 7.8, 3, 2.7, R);
      px.line(h.x + 1.8, h.y - 8.6, h.x + 5.6, h.y - 6.2, PAL.gold[2]);
      spikes(px, [[h.x - 5.2, h.y - 3.4, h.x - 7, h.y + 3, 1.6], [h.x - 3.4, h.y - 4.4, h.x - 5, h.y - .6, 1.5], [h.x - 1, h.y - 4.8, h.x - 3, h.y - 1, 1.5], [h.x + 1.5, h.y - 4.6, h.x - .2, h.y - 1.4, 1.3], [h.x + 5.8, h.y - 2.6, h.x + 7.4, h.y + 3.2, 1.6]], R);
      px.capsule(h.x - 6.4, h.y + .6, h.x - 6.6, h.y + 7, 1.2, .8, R);
      hFace(px, J, p, hex32('#3a6ad8'), PAL.sSkin);
    },
    nearArm(px, J) {
      px.ellipse(J.sN.x + .2, J.sN.y + .2, 3.2, 2.6, PAL.steel);
      hArm(px, J.sN, J.eN, J.hN, PAL.steel, PAL.sSkin, false, PAL.gold);
    },
    weaponN(px, J) {
      const c = { x: J.hN.x - 1.8, y: J.hN.y + .4 };
      px.ellipse(c.x, c.y, 4.8, 6.6, PAL.gold);
      px.ellipse(c.x, c.y, 3.7, 5.4, PAL.sCape);
      px.ellipse(c.x, c.y, 1.6, 1.6, PAL.gold, { bias: .2 });
      for (const [ox, oy] of [[2.6, 0], [-2.6, 0], [0, 3.3], [0, -3.3], [1.8, 2.3], [-1.8, 2.3], [1.8, -2.3], [-1.8, -2.3]]) px.set(c.x + ox, c.y + oy, PAL.gold[ox && oy ? 2 : 3]);
      J.shield = c;
    }
  }
};

/* ---------- humanoid poses ---------- */
const POSES = {
  Aruna: {
    idle: P({ aN0: 22, aN1: 58, wN: 100, aF0: -6, aF1: 14, lean: 2 }),
    run: P({ aN0: 22, aN1: 58, wN: 100, lean: 14, lN0: 36, lN1: -30, lF0: -26, lF1: -10, cape: 1 }),
    charge: P({ aN0: 150, aN1: 12, wN: 18, aF0: 128, aF1: 30, lean: -6, head: -6, lN0: 16, lN1: -10, lF0: -14, cape: .8 }),
    release: P({ aN0: 102, aN1: -8, wN: 16, aF0: -26, aF1: 30, lean: 12, lN0: 22, lN1: -18, lF0: -16, cape: .9 }),
    windup: P({ aN0: 172, aN1: 18, wN: 16, aF0: -30, aF1: 30, lean: -6, lN0: 14, lF0: -12 }),
    strike: P({ aN0: 70, aN1: 10, wN: 30, aF0: -34, aF1: 20, lean: 18, lN0: 28, lN1: -20, lF0: -20, lF1: -6, cape: .9 }),
    hurt: P({ aN0: -10, aN1: 40, wN: 110, aF0: -40, aF1: 30, lean: -18, head: -12, bx: 3, cape: .6 }),
    block: P({ aN0: 70, aN1: 80, wN: 30, aF0: 60, aF1: 70, lean: -4, lN0: 18, lN1: -24, lF0: -18, lF1: -14 }),
    dodge: P({ aN0: 30, aN1: 50, wN: 100, aF0: -60, aF1: 20, lean: -16, by: -4, bx: 7, lN0: 30, lN1: -40, lF0: -10, lF1: -30, cape: 1 }),
    ko: P({ aN0: 30, aN1: 10, wN: 60, aF0: 10, aF1: 10, lean: 42, head: 20, lN0: 80, lN1: -150, lF0: -20, lF1: -100 }),
    victory: P({ aN0: 170, aN1: 4, wN: 6, aF0: 40, aF1: 90, lean: -2, head: -8, cape: .7 })
  },
  Ayo: {
    idle: P({ aN0: 40, aN1: 50, wN: 60, aF0: -24, aF1: 64, wF: 88, lean: 9, lN0: 22, lN1: -30, lF0: -16, lF1: -18 }),
    run: P({ aN0: 60, aN1: 30, wN: 90, aF0: -40, aF1: 50, wF: 100, lean: 24, lN0: 44, lN1: -40, lF0: -34, lF1: -16, cape: 1 }),
    windup: P({ aN0: 176, aN1: 30, wN: 22, aF0: -30, aF1: 70, wF: 80, lean: -4, lN0: 20, lN1: -24, lF0: -12, lF1: -12, cape: .5 }),
    strike: P({ aN0: 60, aN1: -12, wN: -40, aF0: -50, aF1: 40, wF: 90, lean: 24, lN0: 40, lN1: -44, lF0: -30, lF1: 8, cape: 1 }),
    back: P({ aN0: 112, aN1: -30, wN: 100, aF0: 92, aF1: 16, wF: -8, lean: 18, lN0: 30, lN1: -34, lF0: -24, lF1: -4, cape: 1 }),
    kick: P({ aN0: 110, aN1: 20, wN: 70, aF0: -70, aF1: 30, wF: 60, lean: -12, lN0: 96, lN1: -6, lF0: -10, lF1: -6, cape: 1 }),
    kick2: P({ aN0: 130, aN1: 20, wN: 60, aF0: -60, aF1: 30, wF: 60, lean: -20, by: -8, lN0: 120, lN1: -10, lF0: 20, lF1: -60, cape: 1 }),
    hurt: P({ aN0: -10, aN1: 60, wN: 90, aF0: -40, aF1: 50, wF: 90, lean: -18, head: -12, bx: 3 }),
    block: P({ aN0: 90, aN1: 70, wN: 70, aF0: 70, aF1: 80, wF: 60, lean: 2, lN0: 20, lN1: -30, lF0: -16, lF1: -16 }),
    dodge: P({ aN0: 30, aN1: 60, wN: 70, aF0: -60, aF1: 60, wF: 80, lean: -20, by: -6, bx: 9, lN0: 40, lN1: -60, lF0: -10, lF1: -40, cape: 1 }),
    ko: P({ aN0: 30, aN1: 10, wN: 40, aF0: 10, aF1: 10, wF: 60, lean: 42, head: 20, lN0: 80, lN1: -150, lF0: -20, lF1: -100 }),
    victory: P({ aN0: 168, aN1: 0, wN: 30, aF0: -40, aF1: 60, wF: 80, lean: -4, head: -6, lN0: 14, lN1: -10, lF0: -14 })
  },
  Serafina: {
    idle: P({ aN0: 50, aN1: 60, aF0: 18, aF1: 92, wF: 70, lean: 2 }),
    run: P({ aN0: 60, aN1: 50, aF0: 30, aF1: 80, wF: 70, lean: 16, lN0: 38, lN1: -32, lF0: -26, lF1: -12, cape: 1 }),
    windup: P({ aN0: 60, aN1: 40, aF0: -44, aF1: 104, wF: 30, lean: -8, lN0: 18, lN1: -20, lF0: -16, lF1: -8, cape: .6 }),
    strike: P({ aN0: 30, aN1: 50, aF0: 78, aF1: 12, wF: 0, lean: 20, lN0: 36, lN1: -32, lF0: -26, lF1: 0, cape: 1 }),
    bash: P({ aN0: 96, aN1: -4, aF0: -20, aF1: 90, wF: 60, lean: 22, lN0: 36, lN1: -32, lF0: -26, lF1: 0, cape: 1 }),
    pray: P({ aN0: 62, aN1: 92, aF0: 36, aF1: 96, wF: 50, lean: 6, head: 10, cape: .5 }),
    raise: P({ aN0: 60, aN1: 70, aF0: 160, aF1: 10, wF: 10, lean: -6, head: -8, cape: .8 }),
    hurt: P({ aN0: 20, aN1: 60, aF0: -30, aF1: 90, wF: 70, lean: -16, head: -10, bx: 3 }),
    block: P({ aN0: 84, aN1: 36, aF0: 10, aF1: 90, wF: 70, lean: 4, lN0: 22, lN1: -30, lF0: -18, lF1: -16 }),
    dodge: P({ aN0: 60, aN1: 60, aF0: -20, aF1: 90, wF: 60, lean: -14, by: -3, bx: 6, lN0: 30, lN1: -40, lF0: -10, lF1: -30, cape: 1 }),
    ko: P({ aN0: 30, aN1: 30, aF0: 10, aF1: 30, wF: 70, lean: 42, head: 20, lN0: 80, lN1: -150, lF0: -20, lF1: -100 }),
    victory: P({ aN0: 60, aN1: 60, aF0: 170, aF1: 0, wF: 0, lean: -4, head: -8, cape: .8 })
  }
};

/* ---------- enemies ---------- */
const EPOSES = {
  Thornwolf: {
    idle: { crouch: 0, lunge: 0, jaw: .08, head: 0, raise: 0, air: 0 },
    windup: { crouch: 1, lunge: -.4, jaw: .3, head: .6, raise: 0, air: 0 },
    bite: { crouch: 0, lunge: 1, jaw: 1, head: -.1, raise: 0, air: 2 },
    rear: { crouch: .2, lunge: -.2, jaw: .6, head: -.8, raise: 1, air: 0 },
    claw: { crouch: .4, lunge: .8, jaw: .5, head: .3, raise: .2, air: 0 },
    hurt: { crouch: .5, lunge: -.6, jaw: .6, head: -.5, raise: 0, air: 0 }
  },
  Golem: {
    idle: { armN: 12, armF: -8, lean: 0, crouch: 0, glow: .5 },
    windup: { armN: 196, armF: -30, lean: -.6, crouch: .2, glow: .8 },
    slam: { armN: 70, armF: 20, lean: .9, crouch: 1, glow: 1 },
    raise: { armN: 150, armF: 150, lean: -.3, crouch: 0, glow: 1 },
    hurt: { armN: -20, armF: -30, lean: -.8, crouch: .3, glow: .3 }
  },
  Moth: {
    idle: { flap: 1, spread: 1, tilt: 0, rise: 0 },
    windup: { flap: 2.2, spread: 1.3, tilt: -.3, rise: 8 },
    cast: { flap: 3, spread: 1.4, tilt: .3, rise: 4 },
    dive: { flap: .4, spread: .5, tilt: .6, rise: -6 },
    hurt: { flap: .3, spread: .6, tilt: -.4, rise: 2 }
  }
};

function drawWolf(px, p, t) {
  const br = Math.sin(t / 380) * .6, c = p.crouch, l = p.lunge, G = 70 - p.air;
  const hip = { x: 38 - l * 3, y: 46 + c * 4 + br * .3 - p.air }, sh = { x: 62 + l * 10, y: 42 + c * 4 + br * .5 - p.raise * 3 - p.air };
  const fur = PAL.wFur, ffur = far('wFur');
  // tail
  let tp = { x: hip.x - 6, y: hip.y - 3 }; const tpts = [tp];
  for (let i = 0; i < 5; i++) { const a = -2.55 - i * .22 + Math.sin(t / 260 + i * .7) * .22; tp = { x: tp.x + Math.cos(a) * 4, y: tp.y + Math.sin(a) * 4 }; tpts.push(tp); }
  for (let i = 0; i < tpts.length - 1; i++) px.capsule(tpts[i].x, tpts[i].y, tpts[i + 1].x, tpts[i + 1].y, 3.4 - i * .5, 3 - i * .5, fur);
  for (let i = 1; i < tpts.length; i += 2) px.poly([[tpts[i].x - 1.5, tpts[i].y - 1], [tpts[i].x + 1.5, tpts[i].y - 1.5], [tpts[i].x - 1, tpts[i].y - 6]], PAL.bone, { grad: [tpts[i].x, tpts[i].y - 6, tpts[i].x, tpts[i].y] });
  // far legs
  const leg = (a, k, f, rp, r) => { px.capsule(a.x, a.y, k.x, k.y, r, r * .75, rp); px.capsule(k.x, k.y, f.x, f.y, r * .7, r * .55, rp); px.ellipse(f.x + 1, f.y - .6, 2.6, 1.6, rp); };
  leg({ x: sh.x + 3, y: sh.y + 3 }, { x: sh.x + 5 + l * 6, y: sh.y + 14 - c * 3 }, { x: sh.x + 4 + l * 12, y: G }, ffur, 3.2);
  leg({ x: hip.x + 3, y: hip.y + 3 }, { x: hip.x - 3, y: hip.y + 14 - c * 2 }, { x: hip.x + 1 - l * 8, y: G }, ffur, 3.4);
  // body
  px.capsule(hip.x, hip.y, sh.x, sh.y, 10.5, 13, fur);
  px.ellipse(hip.x + 14, hip.y + 7.2, 11, 3.2, PAL.wBelly);
  for (let i = 0; i <= 5; i++) {
    const bx = lerp(hip.x - 2, sh.x - 2, i / 5), by = lerp(hip.y, sh.y, i / 5) - 9.2, hgt = 5 + (i % 2) * 2.5;
    px.poly([[bx - 2.2, by + 1.5], [bx + 2.2, by + 1.5], [bx - 2.5, by - hgt]], PAL.bone, { grad: [bx - 2, by - hgt, bx + 2, by + 1] });
  }
  // vine and berries
  for (let i = 0; i < 12; i++) { const x = hip.x + 6 + i * 1.6, y = hip.y - 3 + Math.sin(i * .9) * 2 + i * .4; px.set(x, y, hex32('#2a1a10')); }
  for (const [ox, oy] of [[9, -2], [15, 2], [21, 1]]) { px.set(hip.x + ox, hip.y + oy, hex32('#e03448')); px.set(hip.x + ox + 1, hip.y + oy, hex32('#ff7a8a')); }
  // mane + head
  const H0 = { x: sh.x + 8 + l * 4, y: sh.y - 7 + p.head * 6 };
  px.capsule(sh.x - 2, sh.y, H0.x, H0.y, 12, 8, PAL.wMane);
  for (let i = 0; i < 4; i++) { const bx = lerp(sh.x - 6, H0.x, i / 3), by = lerp(sh.y - 6, H0.y - 5, i / 3); px.poly([[bx, by + 2], [bx + 3, by], [bx - 5, by - 4]], PAL.wMane, { flat: 1 }); }
  const Hc = { x: H0.x + 4, y: H0.y - 1 };
  px.poly([[Hc.x - 2.5, Hc.y - 3.5], [Hc.x - 6.5, Hc.y - 12.5], [Hc.x + .5, Hc.y - 5]], fur, { grad: [Hc.x - 6, Hc.y - 12, Hc.x, Hc.y - 4] });
  px.poly([[Hc.x - 3.2, Hc.y - 4.8], [Hc.x - 5.6, Hc.y - 10], [Hc.x - 1.5, Hc.y - 5.2]], ramp('#3a1a1a', '#6a2a2a', '#9a4a42', '#c07060'), { flat: 1 });
  const jw = p.jaw;
  px.capsule(Hc.x + 2, Hc.y + 4.2, Hc.x + 10, Hc.y + 5 + jw * 6.5, 2.2, 1.6, far('wFur'));
  if (jw > .15) {
    px.poly([[Hc.x + 3, Hc.y + 3], [Hc.x + 12, Hc.y + 4], [Hc.x + 10, Hc.y + 4.5 + jw * 5.5], [Hc.x + 3, Hc.y + 5]], ramp('#3a0a10', '#7a1420', '#b02a34', '#e04a54'), { flat: 1 });
    for (let x = 5; x <= 11; x += 2) { px.set(Hc.x + x, Hc.y + 4, PAL.bone[3]); px.set(Hc.x + x - 1, Hc.y + 3.8 + jw * 5.2, PAL.bone[2]); }
  }
  px.ellipse(Hc.x, Hc.y, 8, 6.6, fur);
  px.capsule(Hc.x + 3, Hc.y + 1.2, Hc.x + 13, Hc.y + 3 - jw * .5, 4, 2.8, fur, { bias: .08 });
  px.ellipse(Hc.x + 13.6, Hc.y + 2, 1.4, 1.2, ramp('#0a0608', '#1a1014', '#2a2028', '#4a3a44'));
  const ey = Hc.y - 1.2;
  px.set(Hc.x + 3, ey, hex32('#ff9a20')); px.set(Hc.x + 4, ey, hex32('#ffd060')); px.set(Hc.x + 5, ey + .6, hex32('#ff7a10'));
  px.set(Hc.x + 2, ey - 1, fur[0]); px.set(Hc.x + 3, ey - 1, fur[0]); px.set(Hc.x + 4, ey - 1.4, fur[0]);
  // near legs
  const r = p.raise;
  leg({ x: sh.x - 2, y: sh.y + 4 }, { x: sh.x + 2 + l * 8 + r * 7, y: sh.y + 14 - r * 9 }, { x: sh.x + 1 + l * 14 + r * 12, y: G - r * 14 }, fur, 3.4);
  leg({ x: hip.x - 1, y: hip.y + 4 }, { x: hip.x - 6, y: hip.y + 13 }, { x: hip.x - 3 - l * 6, y: G }, fur, 3.6);
  for (const fx of [sh.x + 1 + l * 14 + r * 12, hip.x - 3 - l * 6]) { const fy = fx > hip.x + 10 ? G - r * 14 : G; px.set(fx + 3, fy, PAL.bone[3]); px.set(fx + 3, fy - 1, PAL.bone[2]); }
  return { head: { x: Hc.x + 6, y: Hc.y + 2 }, chest: { x: sh.x, y: sh.y }, mouth: { x: Hc.x + 12, y: Hc.y + 4 } };
}

function spiral(px, cx, cy, r, turns, dir, rp) {   // gold filigree scroll
  let prev = null; const q = 1 / px.d;
  for (let t = 0; t <= 1.0001; t += .025) {
    const a = dir * t * turns * Math.PI * 2, rr = r * (1 - t * .85), x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    if (prev) { px.hair(prev[0], prev[1] + q, x, y + q, rp[0]); px.hair(prev[0], prev[1], x, y, rp[3]); }
    prev = [x, y];
  }
}
function drawGolem(px, p, t) {
  const br = Math.sin(t / 700) * .8, c = p.crouch, tx = 64 + p.lean * 7, oy = c * 6 + br * .4;
  const st = PAL.gStone, gd = PAL.gGold, wd = PAL.gWood, ms = PAL.gMoss, fst = dimRamp(st, .8), fwd = dimRamp(wd, .8);
  const arm = (S, a, far) => {
    const e = add(S, edir(a), 14), f = add(e, edir(a + 22), 12), sR = far ? fst : st, wR = far ? fwd : wd;
    px.capsule(S.x, S.y, e.x, e.y, 6, 5.2, sR); px.capsule(e.x, e.y, f.x, f.y, 5.4, 6.2, wR);
    for (const k of [.3, .7]) { const b = { x: lerp(e.x, f.x, k), y: lerp(e.y, f.y, k) }; px.capsule(b.x - 5, b.y, b.x + 5, b.y, 1, 1, gd); }
    px.ellipse(f.x, f.y + 1, 7.2, 6.4, sR);
    return f;
  };
  const SF = { x: tx + 24, y: 50 + oy }, SN = { x: tx - 24, y: 52 + oy };
  const fistF = arm(SF, p.armF, true);
  px.ellipse(SF.x, SF.y - 1, 9, 8, fst); spiral(px, SF.x, SF.y - 1, 5.5, 1.6, 1, gd);
  // legs
  for (const [hx, fx, far] of [[74, 78, 1], [52, 48, 0]]) {
    const hy = 86 + oy, R = far ? fwd : wd, SR = far ? fst : st;
    px.capsule(hx + p.lean * 3, hy, fx, 112, 8.6, 7.6, R);
    for (const yy of [94, 106]) px.capsule(fx - 7, yy + oy * .3, fx + 7, yy + oy * .3, 1, 1, gd);
    px.ellipse(lerp(hx, fx, .5), 101 + oy * .5, 6, 5.4, SR); spiral(px, lerp(hx, fx, .5), 101 + oy * .5, 3.6, 1.4, far ? -1 : 1, gd);
    px.ellipse(fx + 1, 116, 10, 5, SR);
  }
  // barrel body of carved stone
  const cy0 = 66 + oy;
  px.ellipse(tx, cy0, 27, 25, st, { amb: .42 });
  for (const ox of [-12, 12]) px.hair(tx + ox, cy0 - 20, tx + ox * 1.1, cy0 + 21, st[1]);
  spiral(px, tx - 18, cy0 - 4, 6, 1.5, 1, gd); spiral(px, tx + 18, cy0 - 4, 6, 1.5, -1, gd);
  spiral(px, tx - 16, cy0 + 12, 4.5, 1.3, -1, gd); spiral(px, tx + 16, cy0 + 12, 4.5, 1.3, 1, gd);
  const g = clamp(p.glow + Math.sin(t / 260) * .15, 0, 1), glow = ramp('#8a5a10', '#d8a030', '#ffd060', '#fff6c0');
  px.ellipse(tx, cy0 - 2, 8, 8, gd, { ring: .72 });
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; px.hair(tx + Math.cos(a) * 1.8, cy0 - 2 + Math.sin(a) * 1.8, tx + Math.cos(a) * 6.4, cy0 - 2 + Math.sin(a) * 6.4, gd[3]); }
  px.ellipse(tx, cy0 - 2, 2, 2, glow, { flat: Math.round(g * 3) });
  px.capsule(tx - 25, cy0 + 16, tx + 25, cy0 + 16, 2.4, 2.4, wd);
  for (let i = -3; i <= 3; i++) px.ellipse(tx + i * 7, cy0 + 16, 1.2, 1.2, gd, { dither: 0 });
  // mossy mantle
  for (let i = -5; i <= 5; i++) {
    const x = tx + i * 5, y = cy0 - 21 + Math.abs(i) * 1.4;
    px.ellipse(x, y, 5.6, 4, ms, { amb: .45 });
    px.capsule(x, y + 2, x + (i % 2) * .5, y + 5 + ((i * 7) % 4 + 4) % 4, 1, .6, ms);
  }
  // head
  const hy = cy0 - 32;
  px.ellipse(tx + 1, hy, 10, 9, st, { amb: .45 });
  px.ellipse(tx - 3, hy - 1, 2, 1.6, ramp('#1a1a1e', '#2a2a30', '#3a3a42', '#4a4a52'), { flat: 0 }); px.ellipse(tx + 5, hy - 1, 2, 1.6, ramp('#1a1a1e', '#2a2a30', '#3a3a42', '#4a4a52'), { flat: 0 });
  px.dot(tx - 3, hy - 1, glow[3]); px.dot(tx + 5, hy - 1, glow[3]);
  px.hair(tx - 2, hy + 4, tx + 4, hy + 4, st[0]);
  for (const [a2, b2, lx2, ly2] of [[-5, -7, -14, -22], [1, -9, 2, -26], [6, -7, 16, -20]]) {
    px.capsule(tx + a2, hy + b2, tx + lx2, hy + ly2, 1.6, .9, wd);
    for (let k = 0; k < 4; k++) px.ellipse(tx + lx2 + (k - 1.5) * 2.4, hy + ly2 - 1 + (k % 2) * 1.6, 2.8, 2.2, ms, { amb: .5 });
  }
  const fistN = arm(SN, p.armN, false);
  px.ellipse(SN.x, SN.y - 1, 9.5, 8.5, st, { amb: .45 }); spiral(px, SN.x, SN.y - 1, 6, 1.6, -1, gd);
  // log club in the near fist
  const cd = edir(p.armN + 22 - 90);
  px.capsule(fistN.x - cd.x * 6, fistN.y - cd.y * 6, fistN.x + cd.x * 30, fistN.y + cd.y * 30, 3.4, 3, wd, { amb: .4 });
  px.ellipse(fistN.x + cd.x * 31, fistN.y + cd.y * 31, 3, 3.2, ramp('#8a6a44', '#a88658', '#c6a472', '#e0c290'), { ring: 0 });
  px.ellipse(fistN.x + cd.x * 14, fistN.y + cd.y * 14 - 2.5, 4, 2, ms);
  return { head: { x: tx, y: hy }, chest: { x: tx, y: cy0 }, fist: fistN, fistF };
}

function drawMoth(px, p, t) {
  const ph = t / 90 * p.flap, w = .6 + .4 * Math.sin(ph), w2 = .7 + .3 * Math.sin(ph - .6), s = p.spread;
  const B = { x: 70 + p.tilt * 3, y: 56 - p.rise + Math.sin(t / 300) * 2 };
  const wing = (base, pts, rp, spot) => {
    const P2 = pts.map(([x, y]) => [base.x + x * s, base.y + y]);
    px.poly(P2, rp, { grad: [base.x, base.y, P2[2][0], P2[2][1]] });
    for (let i = 1; i < P2.length - 1; i++) px.hair(base.x, base.y, lerp(base.x, P2[i][0], .85), lerp(base.y, P2[i][1], .85), PAL.gGold[1]);
    for (let i = 0; i < P2.length; i++) { const A = P2[i], Bq = P2[(i + 1) % P2.length]; px.hair(A[0], A[1], Bq[0], Bq[1], PAL.gGold[3]); }
    if (spot) { spiral(px, spot[0], spot[1], 5, 1.7, 1, PAL.gGold); spiral(px, spot[0] + 7, spot[1] + 6, 3.4, 1.4, -1, PAL.gGold); }
  };
  const fb = { x: B.x + 2, y: B.y - 4 };
  wing(fb, [[0, 0], [12, -30 * w], [0, -42 * w], [-16, -32 * w], [-8, 2]], far('mWing'));
  wing({ x: B.x + 1, y: B.y + 2 }, [[0, 0], [4, 14 * w2], [-8, 24 * w2], [-14, 14 * w2]], far('mWing'));
  px.capsule(B.x - 2, B.y + 4, B.x - 12, B.y + 21, 5.6, 2.4, PAL.mFur);
  for (let i = 0; i < 3; i++) { const y = B.y + 8 + i * 3, x = B.x - 4 - i * 2.2; px.line(x - 3, y, x + 3, y - 1, PAL.mFur[0]); }
  px.ellipse(B.x + 2, B.y, 7, 8, PAL.mFur);
  px.ellipse(B.x + 9, B.y - 6, 5.2, 5, PAL.mFur);
  px.ellipse(B.x + 11.5, B.y - 6, 2.8, 3.2, PAL.mEye, { bias: .2 });
  for (const [dx, dy] of [[4, -8], [10, -9]]) {
    let q = { x: B.x + dx, y: B.y + dy };
    for (let i = 0; i < 7; i++) { const nq = { x: q.x + 1.3, y: q.y - 1.6 + i * .1 }; px.line(q.x, q.y, nq.x, nq.y, PAL.mFur[1]); if (i & 1) px.set(nq.x + 1, nq.y + 1, PAL.mFur[2]); q = nq; }
  }
  const nb = { x: B.x - 1, y: B.y - 3 };
  wing(nb, [[0, 0], [-6, -32 * w], [-28, -42 * w], [-44, -26 * w], [-32, -2], [-8, 5]], PAL.mWing, [nb.x - 26 * s, nb.y - 22 * w]);
  wing({ x: B.x - 2, y: B.y + 3 }, [[0, 0], [-22, 6], [-34, 24 * w2], [-22, 32 * w2], [-6, 14]], PAL.mWing, [B.x - 2 - 22 * s, B.y + 3 + 20 * w2]);
  for (let i = 0; i < 3; i++) px.line(B.x + i * 2 - 1, B.y + 5, B.x + i * 2 + 1, B.y + 11, PAL.mFur[0]);
  return { head: { x: B.x + 9, y: B.y - 5 }, chest: { x: B.x, y: B.y } };
}

const ENEMY_ART = {
  Thornwolf: { w: 110, h: 76, footX: 50, footY: 70, draw: drawWolf },
  Golem: { w: 132, h: 128, footX: 64, footY: 120, draw: drawGolem },
  Moth: { w: 124, h: 104, footX: 56, footY: 96, draw: drawMoth, fly: 36 }
};

/* ---------- Actor wrapper ---------- */
class Actor {
  constructor(kind, isEnemy) {
    this.kind = kind; this.isEnemy = isEnemy;
    if (isEnemy) { const a = ENEMY_ART[kind]; this.art = a; this.px = new Pix(a.w, a.h, DENS); this.poses = EPOSES[kind]; this.footX = a.footX; this.footY = a.footY; }
    else { this.px = new Pix(96, 80, DENS); this.poses = POSES[kind]; this.footX = HD.rootX; this.footY = HD.ground; }
    this.pose = Object.assign({}, this.poses.idle);
    this.from = null; this.target = null; this.idleMode = true;
    this.flash = 0; this.tintA = 0; this.rimA = 0; this.rim = [255, 200, 120];
    this.J = null; this.phase = Math.random() * 1000;
  }
  to(name, ms, ease) {
    this.from = Object.assign({}, this.pose);
    this.target = typeof name === 'string' ? this.poses[name] : name;
    this.t0 = Clock.t; this.dur = Math.max(1, ms); this.ease = ease || Ease.inOut; this.idleMode = false;
    return wait(ms);
  }
  rest(ms) { const p = this.to('idle', ms || 220); p.then(() => { if (this.target === this.poses.idle) this.idleMode = true; }); return p; }
  update() {
    if (this.target) {
      const k = clamp((Clock.t - this.t0) / this.dur, 0, 1);
      this.pose = mixPose(this.from, this.target, this.ease(k));
    }
    this.flash = Math.max(0, this.flash - .09);
  }
  render(opts) {
    const t = Clock.t + this.phase, px = this.px;
    px.clear();
    const p = Object.assign({}, this.pose);
    if (this.isEnemy) this.J = this.art.draw(px, p, t);
    else {
      const blink = (t % 3400) < 110 ? 1 : 0; p.blink = Math.max(p.blink || 0, blink);
      const breath = this.idleMode ? Math.sin(t / 420) * .45 : 0;
      if (this.idleMode) { p.aN0 += Math.sin(t / 420) * 2; p.aF0 -= Math.sin(t / 420) * 2; }
      const J = solveHuman(p, breath), C = COSTUME[this.kind];
      C.back && C.back(px, J, p, t);
      C.farArm(px, J, p, t); C.weaponF && C.weaponF(px, J, p, t);
      C.legs(px, J, p, t); C.body(px, J, p, t);
      px.xf = { cx: J.head.x, cy: J.head.y, s: HD.hs }; C.head(px, J, p, t); px.xf = null;
      C.nearArm(px, J, p, t); C.weaponN && C.weaponN(px, J, p, t);
      this.J = J;
    }
    return px.finish(Object.assign({ flash: this.flash, rim: this.rim, rimA: this.rimA }, opts || {}));
  }
}
