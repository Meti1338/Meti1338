'use strict';
/* Battle: units, rules (Break / Boost / active defense) and the choreography of every action. */

const TYPES = ['Blade', 'Spear', 'Staff', 'Fire', 'Wind', 'Earth'];
const B = { party: [], enemies: [], all: [], order: [], current: null, round: 0, stats: {}, hit: null, over: false, target: null };

function mkUnit(o) {
  return Object.assign({ ox: 0, oy: 0, alive: true, broken: false, bp: 0, aura: 0, tested: new Set(), vis: 1, fly: 0, top: 0 }, o,
    { hp: o.maxHp, mp: o.maxMp || 0, shields: o.maxShields || 0 });
}
function newBattle() {
  const A = n => new Actor(n, false), E = n => new Actor(n, true);
  B.party = [
    mkUnit({ name: 'Aruna', role: 'Mage', actor: A('Aruna'), side: 'p', x: 344, y: 150, hgt: 40, maxHp: 132, maxMp: 44, atk: 27, def: 7, spd: 12,
      dodgeWin: 250, blockWin: 220, blockMul: .5, counter: .3, dodgeMp: 0, col: '#9aa8ff',
      abs: [
        { name: 'Attack', type: 'Staff', kind: 'melee', power: 1, hits: 1, mp: 0, tg: 'one', desc: 'Staff strike. Boost adds hits.' },
        { name: 'Flame', type: 'Fire', kind: 'flame', power: 1.9, hits: 1, mp: 8, tg: 'one', desc: 'Fireball that erupts into a flame pillar.' },
        { name: 'Gale', type: 'Wind', kind: 'gale', power: 1.05, hits: 1, mp: 14, tg: 'all', desc: 'Tornadoes strike every enemy.' }] }),
    mkUnit({ name: 'Ayo', role: 'Duelist', actor: A('Ayo'), side: 'p', x: 372, y: 174, hgt: 40, maxHp: 158, maxMp: 28, atk: 25, def: 10, spd: 18,
      dodgeWin: 230, blockWin: 220, blockMul: .5, counter: .3, dodgeMp: 4, col: '#5fd3c0',
      abs: [
        { name: 'Attack', type: 'Blade', kind: 'melee', power: 1, hits: 1, mp: 0, tg: 'one', desc: 'Sabre slash. Boost adds hits.' },
        { name: 'Flurry', type: 'Blade', kind: 'flurry', power: .62, hits: 3, mp: 8, tg: 'one', desc: 'Three slashes ending in a cross cut.' },
        { name: 'Rhythm Kick', type: 'Earth', kind: 'kick', power: 1.0, hits: 2, mp: 9, tg: 'one', desc: 'Two kicks; the second raises stone spikes.' }] }),
    mkUnit({ name: 'Serafina', role: 'Warden', actor: A('Serafina'), side: 'p', x: 400, y: 198, hgt: 40, maxHp: 196, maxMp: 32, atk: 23, def: 15, spd: 9,
      dodgeWin: 200, blockWin: 300, blockMul: .35, counter: .45, dodgeMp: 0, col: '#ff8a7a',
      abs: [
        { name: 'Attack', type: 'Spear', kind: 'melee', power: 1, hits: 1, mp: 0, tg: 'one', desc: 'Lance thrust. Boost adds hits.' },
        { name: 'Shield Bash', type: 'Earth', kind: 'bash', power: 1.45, hits: 1, mp: 6, tg: 'one', desc: 'Shield charge with a shockwave.' },
        { name: 'Mend', type: null, kind: 'mend', power: 0, hits: 0, mp: 10, tg: 'ally', heal: .34, desc: 'Pillar of light heals one ally.' }] })
  ];
  B.enemies = [
    mkUnit({ name: 'Bramble Golem', actor: E('Golem'), side: 'e', x: 82, y: 178, hgt: 112, maxHp: 420, atk: 30, def: 11, spd: 6, maxShields: 5, weak: ['Fire', 'Wind', 'Spear'], reach: 56, shadow: 22, plate: 'below', atks: ['slam', 'spores'] }),
    mkUnit({ name: 'Thornwolf', actor: E('Thornwolf'), side: 'e', x: 204, y: 146, hgt: 50, maxHp: 200, atk: 23, def: 4, spd: 15, maxShields: 3, weak: ['Fire', 'Blade'], reach: 44, shadow: 20, atks: ['bite', 'claws'] }),
    mkUnit({ name: 'Lumen Moth', actor: E('Moth'), side: 'e', x: 156, y: 236, hgt: 50, fly: 30, maxHp: 170, atk: 24, def: 5, spd: 11, maxShields: 3, weak: ['Wind', 'Spear', 'Staff'], reach: 40, shadow: 14, plate: 'below', atks: ['beam', 'dive'] })
  ];
  B.all = [...B.party, ...B.enemies];
  B.stats = { breaks: 0, parries: 0, dodges: 0, blocks: 0, maxHit: 0 };
  B.order = []; B.current = null; B.round = 0; B.over = false; B.hit = null;
  for (const u of B.all) u.actor.rest(1);
}
const living = l => l.filter(u => u.alive);
const chest = u => ({ x: u.x + u.ox, y: u.y + u.oy - u.fly - u.hgt * .55 });

/* ---------- damage rules ---------- */
function calcDmg(a, t, power, weak) {
  return Math.max(1, Math.round(a.atk * power * (weak ? 1.3 : 1) * (t.broken ? 1.5 : 1) * rnd(.94, 1.06) - t.def * .5));
}
function hitEnemy(a, t, type, power, o) {
  o = o || {};
  if (!t.alive) return;
  const weak = t.weak.includes(type); t.tested.add(type);
  const d = calcDmg(a, t, power, weak);
  t.hp = Math.max(0, t.hp - d); B.stats.maxHit = Math.max(B.stats.maxHit, d);
  t.actor.flash = .8; dmgText(t, d, weak ? 'weak' : 'dmg');
  if (weak) labelText(t, 'WEAK', '#ffd35a', -10);
  hitstop(weak ? 80 : 50); shake(weak ? 3 : 2);
  sfx(weak ? 'weak' : 'hit');
  if (!o.noKnock) { t.ox -= 4; tween(t, 'ox', 0, 200); }
  if (t.actor.poses.hurt) t.actor.to('hurt', 60).then(() => t.alive && t.actor.rest(260));
  if (weak) breakShield(t);
  if (t.hp <= 0) killEnemy(t);
  refreshHud();
}
function breakShield(t) {
  if (!t.alive || t.broken || t.shields <= 0) return;
  t.shields--; t.shieldHit = Clock.t;
  if (t.shields === 0) {
    t.broken = true; t.brokeAt = Clock.t; B.stats.breaks++;
    hitstop(140); flash(.45, '255,240,200'); shake(8); sfx('break');
    const c = chest(t);
    fxImpact(c.x, c.y, { size: 22, rgb: '255,220,120', sparks: 30, speed: 1.6 });
    camTo(c.x, c.y, 1.14, 110, Ease.out).then(() => wait(260)).then(() => camTo(240, 150, 1, 420, Ease.inOut));
    say(t.name + ' is Broken! It loses its next turn and takes 50% more damage.');
  }
}
function killEnemy(t) {
  t.alive = false; t.broken = false;
  wait(220).then(() => { sfx('death'); fxDissolve(t.actor, t.sprLeft, t.sprTop); t.vis = 0; });
  say(t.name + ' is defeated.');
}
function hurtParty(u, d) {
  u.hp = Math.max(0, u.hp - d); u.actor.flash = 1; dmgText(u, d, 'hurt');
  if (u.hp <= 0) { u.alive = false; u.aura = 0; u.actor.to('ko', 260); say(u.name + ' collapses.'); }
  refreshHud();
}

/* ---------- movement helpers ---------- */
async function approach(a, t, dist) {
  a.actor.to('run', 120); sfx('step');
  const tx = t.x + t.ox + (dist === undefined ? t.reach : dist) - a.x, ty = (t.y - a.y) * .55;
  await Promise.all([tween(a, 'ox', tx, 260, Ease.inOut), tween(a, 'oy', ty, 260, Ease.inOut)]);
}
async function retreat(a) {
  a.actor.to('run', 100);
  await Promise.all([tween(a, 'ox', 0, 280, Ease.inOut), tween(a, 'oy', 0, 280, Ease.inOut)]);
  a.actor.rest(180);
}

/* ---------- player actions ---------- */
async function runAction(a, ab, targets, boost) {
  a.bp -= boost; a.mp -= ab.mp; refreshHud();
  showSkill(ab.name, ab.type);
  if (boost) { fxBoostSurge(a.x, a.y, boost); sfx('boost'); await wait(320); }
  const pw = ab.kind === 'melee' ? ab.power : ab.power * (1 + .35 * boost);
  const t = targets[0];
  switch (ab.kind) {
    case 'melee': await melee(a, t, ab, 1 + boost); a.mp = Math.min(a.maxMp, a.mp + 3); break;
    case 'flame': await castFlame(a, t, pw, boost); break;
    case 'gale': await castGale(a, targets, pw, boost); break;
    case 'flurry': await flurry(a, t, pw, boost); break;
    case 'kick': await rhythmKick(a, t, pw, boost); break;
    case 'bash': await shieldBash(a, t, pw, boost); break;
    case 'mend': await mend(a, t, ab, boost); break;
  }
  a.aura = 0; if (a.ox || a.oy) { tween(a, 'ox', 0, 200); tween(a, 'oy', 0, 200); } refreshHud();
}
async function melee(a, t, ab, hits) {
  await approach(a, t);
  for (let i = 0; i < hits && t.alive; i++) {
    const c = chest(t), alt = i % 2 === 1;
    if (a.name === 'Serafina') {
      await a.actor.to('windup', 120); sfx('swish');
      a.actor.to('strike', 60, Ease.outCubic); await wait(50);
      fxSlash(c.x + 4, c.y, { r: 20, a0: -.12, a1: .12, sq: 1, w: 3, col: '#ffffff', glow: 'rgba(255,120,120,.9)', glowRGB: '255,140,140', dur: 200 });
      for (let k = 0; k < 5; k++) part({ x: c.x + 18, y: c.y + gauss() * 3, vx: -rnd(4, 7), life: 140, cols: ['#ffffff', '#ffc0c0'], size: 1 });
    } else if (a.name === 'Ayo') {
      await a.actor.to(alt ? 'strike' : 'windup', 100); sfx('slash');
      a.actor.to(alt ? 'back' : 'strike', 60, Ease.outCubic); await wait(40);
      fxSlash(c.x, c.y, alt ? { r: 21, a0: 3.4, a1: 6.4, sq: .7, w: 4, col: '#ffffff', glow: 'rgba(120,220,255,.9)' } : { r: 21, a0: -1.1, a1: 2.1, sq: .7, w: 4, col: '#ffffff', glow: 'rgba(120,220,255,.9)' });
    } else {
      await a.actor.to('windup', 130); sfx('swish');
      a.actor.to('strike', 70, Ease.outCubic); await wait(55);
      fxSlash(c.x, c.y - 4, { r: 14, a0: -2, a1: .6, sq: .9, w: 2, col: '#fff0ff', glow: 'rgba(220,150,255,.9)', glowRGB: '220,160,255' });
    }
    fxImpact(c.x, c.y, { size: 9 });
    hitEnemy(a, t, ab.type, ab.power);
    await wait(hits > 2 ? 150 : 220);
  }
  await wait(120); await retreat(a);
}
async function castIntro(a, rgb, ms) {
  const circle = fxMagicCircle(a.x + a.ox, a.y + a.oy, rgb, 17);
  sfx('cast');
  camTo(a.x - 20, a.y - 20, 1.07, 400, Ease.inOut);
  await a.actor.to(a.name === 'Serafina' ? 'raise' : 'charge', 240);
  const tip = a.actor.J && (a.actor.J.tip || a.actor.J.tipF);
  const tp = tip ? { x: a.x + a.ox - a.actor.footX + tip.x, y: a.y + a.oy - a.actor.footY + tip.y } : chest(a);
  fxGather(tp.x, tp.y, rgb, ms);
  await wait(ms);
  return { circle, tip: tp };
}
async function castFlame(a, t, pw, boost) {
  const { circle } = await castIntro(a, '255,150,70', 520);
  await a.actor.to('release', 90, Ease.outCubic);
  const J = a.actor.J, tip = { x: a.x + a.ox - a.actor.footX + J.tip.x, y: a.y + a.oy - a.actor.footY + J.tip.y };
  const c = chest(t);
  camReset(500); sfx('whoosh');
  await fxProjectile(tip.x, tip.y, c.x, c.y, 420, { arc: 26, size: 4 + boost, rgb: '255,150,60', trail: 6 });
  sfx('fire');
  fxFlamePillar(t.x + t.ox, t.y + t.oy, (t.hgt > 80 ? 1.35 : 1) + .3 * boost);
  if (boost >= 2) { wait(160).then(() => fxFlamePillar(t.x - 16, t.y + 6, .6)); wait(260).then(() => fxFlamePillar(t.x + 14, t.y - 4, .6)); }
  camTo(c.x, c.y, 1.08, 200, Ease.out);
  await wait(120);
  hitEnemy(a, t, 'Fire', pw, { noKnock: true });
  await wait(900); circle.end(); camReset(450); await a.actor.rest(260);
}
async function castGale(a, targets, pw, boost) {
  const { circle } = await castIntro(a, '150,255,180', 480);
  await a.actor.to('release', 90, Ease.outCubic);
  camReset(400); sfx('wind'); fxWindStreaks(1000);
  const alive = living(targets);
  alive.forEach((t, i) => wait(i * 90).then(() => fxTornado(t.x + t.ox, t.y + t.oy, 950, 1 + .2 * boost)));
  await wait(330);
  for (let i = 0; i < alive.length; i++) { hitEnemy(a, alive[i], 'Wind', pw, { noKnock: true }); await wait(90); }
  await wait(600); circle.end(); await a.actor.rest(260);
}
async function flurry(a, t, pw, boost) {
  await approach(a, t);
  const arcs = [{ a0: -1.1, a1: 2.1 }, { a0: 3.4, a1: 6.4 }, { a0: -1.4, a1: 1.8 }];
  for (let i = 0; i < 3 && t.alive; i++) {
    const c = chest(t);
    await a.actor.to(i === 1 ? 'strike' : 'windup', 80); sfx('slash');
    a.actor.to(i === 1 ? 'back' : 'strike', 50, Ease.outCubic); await wait(35);
    fxSlash(c.x, c.y, Object.assign({ r: 19 + i * 2, sq: .7, w: 3 + (boost ? 1 : 0), col: '#ffffff', glow: 'rgba(120,220,255,.9)' }, arcs[i]));
    fxImpact(c.x, c.y, { size: 8 });
    hitEnemy(a, t, 'Blade', pw);
    await wait(120);
  }
  if (t.alive || true) {
    const c = chest(t);
    a.actor.to('windup', 120); await wait(140);
    camTo(c.x, c.y, 1.12, 120, Ease.out); sfx('slash');
    a.actor.to('strike', 60, Ease.outCubic);
    fxSlash(c.x, c.y, { r: 24, a0: -2.3, a1: .9, sq: 1, w: 4, col: '#ffffff', glow: 'rgba(255,220,120,.9)', glowRGB: '255,220,140', dur: 380 });
    await wait(60);
    fxSlash(c.x, c.y, { r: 24, a0: -.85, a1: 2.3, sq: 1, w: 4, col: '#ffffff', glow: 'rgba(255,220,120,.9)', glowRGB: '255,220,140', dur: 380 });
    fxImpact(c.x, c.y, { size: 16, rgb: '255,230,160', sparks: 22 }); flash(.2);
    if (t.alive) hitEnemy(a, t, 'Blade', pw * 1.2);
    await wait(260); camReset(350);
  }
  await wait(80); await retreat(a);
}
async function rhythmKick(a, t, pw, boost) {
  await approach(a, t, t.reach - 4);
  let c = chest(t);
  await a.actor.to('windup', 90); sfx('swish');
  a.actor.to('kick', 70, Ease.outCubic); await wait(60);
  fxImpact(c.x, c.y + 6, { size: 10, rgb: '255,210,150' });
  hitEnemy(a, t, 'Earth', pw);
  await wait(170);
  if (t.alive) {
    await a.actor.to('kick2', 130, Ease.outCubic); sfx('rock');
    fxRockSpikes(t.x + t.ox, t.y + t.oy + 2, 1 + .25 * boost);
    await wait(70); c = chest(t);
    fxImpact(c.x, c.y, { size: 12, rgb: '255,210,150', sparkCols: ['#fff0d0', '#d4b27c', '#7a5c3c'] });
    hitEnemy(a, t, 'Earth', pw);
    await wait(260);
  }
  await retreat(a);
}
async function shieldBash(a, t, pw, boost) {
  await approach(a, t, t.reach + 6);
  await a.actor.to('block', 110);
  sfx('swish');
  a.actor.to('bash', 70, Ease.outCubic);
  await tween(a, 'ox', a.ox - 8, 70, Ease.out);
  const c = chest(t);
  fxShockwave(t.x + t.ox, t.y + t.oy, 1 + .25 * boost); sfx('rock');
  fxImpact(c.x + 6, c.y, { size: 14, rgb: '255,220,160' });
  hitEnemy(a, t, 'Earth', pw);
  await wait(300); await retreat(a);
}
async function mend(a, ally, ab, boost) {
  const { circle } = await castIntro(a, '220,255,170', 420);
  camReset(400); sfx('heal');
  fxHeal(ally.x + ally.ox, ally.y + ally.oy);
  await wait(380);
  const amt = Math.round(ally.maxHp * ab.heal * (1 + .4 * boost));
  ally.hp = Math.min(ally.maxHp, ally.hp + amt); dmgText(ally, amt, 'heal'); refreshHud();
  await wait(600); circle.end(); await a.actor.rest(260);
}

/* ---------- enemy actions + active defense ---------- */
const EATK = {
  bite: { name: 'Savage Bite', type: 'phys', hits: 1, power: 1.05 },
  claws: { name: 'Rending Claws', type: 'phys', hits: 2, power: .72 },
  slam: { name: 'Root Slam', type: 'phys', hits: 1, power: 1.35 },
  spores: { name: 'Spore Burst', type: 'magic', hits: 3, power: .55 },
  beam: { name: 'Glimmer Beam', type: 'magic', hits: 1, power: 1.2 },
  dive: { name: 'Dusk Dive', type: 'phys', hits: 1, power: .95 }
};
function ring(tgt, type, lead) {
  return new Promise(res => { B.hit = { tgt, type, start: Clock.t, T: Clock.t + lead, lead, res }; });
}
function defendInput() {
  const h = B.hit; if (!h) return false;
  const d = Clock.t - h.T, t = h.tgt;
  if (d < -330) return false;
  B.hit = null;
  let r = 'hit';
  if (h.type === 'phys') { if (Math.abs(d) <= 105) r = 'parry'; else if (Math.abs(d) <= t.blockWin) r = 'block'; }
  else if (Math.abs(d) <= t.dodgeWin) r = 'dodge';
  h.result = r; h.res(r);
  return true;
}
function tickDefense() {
  const h = B.hit; if (!h) return;
  if (Clock.t > h.T + Math.max(h.tgt.blockWin, h.tgt.dodgeWin) + 20) { B.hit = null; h.res('hit'); }
}
const until = T => wait(Math.max(0, T - Clock.t));

async function resolveHit(e, tgt, atk, res, cp, hitFx) {
  const base = Math.max(1, Math.round(e.atk * atk.power * rnd(.94, 1.06) - tgt.def * .5));
  if (res === 'parry') {
    B.stats.parries++; tgt.bp = Math.min(5, tgt.bp + 1);
    tgt.actor.to('block', 50).then(() => wait(260)).then(() => tgt.alive && tgt.actor.rest(200));
    hitstop(120); flash(.35, '255,236,170'); shake(5); sfx('parry');
    fxImpact(cp.x, cp.y, { size: 20, rgb: '255,220,120', sparks: 26, speed: 1.5, sparkCols: ['#ffffff', '#fff4b0', '#ffd050'] });
    labelText(tgt, 'PARRY', '#ffd35a');
    const cd = Math.max(1, Math.round(tgt.atk * tgt.counter * (e.broken ? 1.5 : 1)));
    e.hp = Math.max(0, e.hp - cd); e.actor.flash = 1; dmgText(e, cd, 'dmg');
    e.ox -= 8; tween(e, 'ox', e.ox + 8, 220);
    if (e.hp <= 0) killEnemy(e);
    refreshHud(); return 'parry';
  }
  if (res === 'block') {
    B.stats.blocks++;
    tgt.actor.to('block', 50).then(() => wait(240)).then(() => tgt.alive && tgt.actor.rest(200));
    fxImpact(cp.x, cp.y, { size: 10, rgb: '150,210,255', sparkCols: ['#ffffff', '#c0e8ff', '#80b8ff'] }); sfx('block'); shake(3);
    labelText(tgt, 'BLOCK', '#9ad8ff');
    hurtParty(tgt, Math.max(1, Math.round(base * tgt.blockMul))); return 'block';
  }
  if (res === 'dodge') {
    B.stats.dodges++; sfx('dodge');
    tgt.actor.to('dodge', 90, Ease.outCubic).then(() => wait(240)).then(() => tgt.alive && tgt.actor.rest(200));
    labelText(tgt, 'DODGE', '#9ad8ff');
    if (tgt.dodgeMp) { tgt.mp = Math.min(tgt.maxMp, tgt.mp + tgt.dodgeMp); labelText(tgt, '+' + tgt.dodgeMp + ' SP', '#8ab8ff', -12); refreshHud(); }
    for (let k = 0; k < 6; k++) part({ x: cp.x + gauss() * 4, y: cp.y + gauss() * 8, vx: 3.5, life: 160, cols: ['#ffffff', '#c0e8ff'] });
    return 'dodge';
  }
  hitFx && hitFx(cp);
  tgt.actor.to('hurt', 60).then(() => wait(260)).then(() => tgt.alive && tgt.actor.rest(220));
  hitstop(70); shake(5); sfx('hurt');
  hurtParty(tgt, base);
  return 'hit';
}

const ENEMY_SCRIPTS = {
  async bite(e, tgt, atk) {
    const lead = 950, T = Clock.t + lead, rp = ring(tgt, 'phys', lead);
    (async () => {
      await e.actor.to('windup', 420); sfx('growl');
      await until(T - 220);
      tween(e, 'ox', tgt.x - e.x - 26, 220, Ease.in); tween(e, 'oy', (tgt.y - e.y) * .9, 220, Ease.in);
      e.actor.to('bite', 200, Ease.in);
    })();
    const res = await rp; await until(T);
    const out = await resolveHit(e, tgt, atk, res, chest(tgt), cp => { fxImpact(cp.x, cp.y, { size: 12, rgb: '255,90,90', sparkCols: ['#ffffff', '#ff8a8a', '#c02030'] }); });
    await wait(200);
    e.actor.to('idle', 300); await Promise.all([tween(e, 'ox', 0, 360, Ease.inOut), tween(e, 'oy', 0, 360, Ease.inOut)]); e.actor.rest(100);
    return [out];
  },
  async claws(e, tgt, atk) {
    await Promise.all([tween(e, 'ox', tgt.x - e.x - 34, 360, Ease.inOut), tween(e, 'oy', (tgt.y - e.y) * .9, 360, Ease.inOut)]);
    const outs = [];
    for (let i = 0; i < 2 && tgt.alive; i++) {
      const lead = i ? 620 : 760, T = Clock.t + lead, rp = ring(tgt, 'phys', lead);
      (async () => { await e.actor.to('rear', lead - 120); await e.actor.to('claw', 90, Ease.in); })();
      const res = await rp; await until(T); sfx('slash');
      outs.push(await resolveHit(e, tgt, atk, res, chest(tgt), cp => fxClaw(cp.x, cp.y)));
      await wait(240);
    }
    e.actor.to('idle', 300); await Promise.all([tween(e, 'ox', 0, 380, Ease.inOut), tween(e, 'oy', 0, 380, Ease.inOut)]); e.actor.rest(100);
    return outs;
  },
  async slam(e, tgt, atk) {
    const lead = 1250, T = Clock.t + lead, rp = ring(tgt, 'phys', lead);
    (async () => {
      tween(e, 'ox', 18, 500, Ease.inOut);
      await e.actor.to('windup', 620); sfx('growl');
      await until(T - 330);
      await e.actor.to('slam', 110, Ease.in);
      const g = { x: e.x + e.ox + 44, y: e.y };
      fxShockwave(g.x, g.y, 1.1); sfx('rock');
      fxProjectile(g.x, g.y - 3, tgt.x - 4, tgt.y - 3, 210, { size: 2, col: '#e0c890', core: '#fff4d0', rgb: '255,220,150', trail: 4, trailCols: ['rgba(220,200,160,.8)', 'rgba(170,150,120,.5)'] });
    })();
    const res = await rp; await until(T);
    const out = await resolveHit(e, tgt, atk, res, chest(tgt), cp => { fxShockwave(tgt.x, tgt.y, .8); fxImpact(cp.x, cp.y, { size: 14, rgb: '255,220,160' }); });
    await wait(350); e.actor.to('idle', 400); await tween(e, 'ox', 0, 420, Ease.inOut); e.actor.rest(100);
    return [out];
  },
  async spores(e, tgt, atk) {
    e.actor.to('raise', 500); sfx('cast');
    const head = () => ({ x: e.x + e.ox + 4, y: e.y - e.hgt + 16 });
    fxGather(head().x, head().y, '200,120,255', 600);
    const outs = [];
    for (let i = 0; i < 3 && tgt.alive; i++) {
      const lead = i ? 700 : 1050, T = Clock.t + lead, rp = ring(tgt, 'magic', lead), c = chest(tgt);
      (async () => { await until(T - 460); const h = head(); sfx('bubble'); fxProjectile(h.x, h.y, c.x, c.y, 460, { arc: 34, size: 3, col: '#b070ff', core: '#e8ffd0', rgb: '190,130,255', trail: 2, trailCols: ['#d0a0ff', '#a0f070', '#6a4aa0'] }); })();
      const res = await rp; await until(T);
      outs.push(await resolveHit(e, tgt, atk, res, c, cp => { for (let k = 0; k < 16; k++) part({ x: cp.x, y: cp.y, vx: gauss() * 1.5, vy: gauss() * 1.5, drag: .9, life: 500, cols: ['#e0c0ff', '#a070e0', '#70c050'], size: 2, shape: 'bub' }); }));
    }
    await wait(300); await e.actor.rest(400);
    return outs;
  },
  async beam(e, tgt, atk) {
    const lead = 1100, T = Clock.t + lead, rp = ring(tgt, 'magic', lead);
    const head = () => ({ x: e.x + e.ox + 20, y: e.y + e.oy - e.fly - 44 });
    (async () => {
      e.actor.to('windup', 500); sfx('cast');
      fxGather(head().x, head().y, '120,240,255', 800);
      await until(T - 160); e.actor.to('cast', 120);
      const h = head(), c = chest(tgt); sfx('beam');
      fxBeam(h.x, h.y, c.x, c.y, 420, '110,230,255');
    })();
    const res = await rp; await until(T);
    const out = await resolveHit(e, tgt, atk, res, chest(tgt), cp => fxImpact(cp.x, cp.y, { size: 12, rgb: '120,230,255', sparkCols: ['#ffffff', '#b0f4ff', '#40c0e0'] }));
    await wait(350); await e.actor.rest(300);
    return [out];
  },
  async dive(e, tgt, atk) {
    const lead = 950, T = Clock.t + lead, rp = ring(tgt, 'phys', lead);
    (async () => {
      e.actor.to('windup', 450); await tween(e, 'oy', -14, 450, Ease.out); sfx('growl');
      await until(T - 250);
      e.actor.to('dive', 200);
      tween(e, 'ox', tgt.x - e.x - 22, 250, Ease.in); tween(e, 'oy', tgt.y - e.y + e.fly - 22, 250, Ease.in);
    })();
    const res = await rp; await until(T);
    const out = await resolveHit(e, tgt, atk, res, chest(tgt), cp => fxImpact(cp.x, cp.y, { size: 12, rgb: '200,160,255' }));
    await wait(200); e.actor.to('idle', 400);
    await Promise.all([tween(e, 'ox', 0, 420, Ease.inOut), tween(e, 'oy', 0, 420, Ease.inOut)]); e.actor.rest(100);
    return [out];
  }
};

async function enemyTurn(e) {
  if (e.broken) {
    await wait(300);
    e.broken = false; e.shields = e.maxShields; e.recoverAt = Clock.t;
    say(e.name + ' recovers from Break and restores its shields.'); showSkill('Recovered', null);
    fxImpact(chest(e).x, chest(e).y, { size: 14, rgb: '150,200,255', sparkCols: ['#ffffff', '#b0d8ff'] });
    refreshHud(); await wait(700); return;
  }
  const tgt = pickOne(living(B.party)), key = pickOne(e.atks), atk = EATK[key];
  showSkill(atk.name, null, atk.type);
  say(e.name + ' uses ' + atk.name + ' on ' + tgt.name + '. ' + (atk.type === 'phys' ? 'Parry it when the rings meet!' : 'Dodge when the rings meet!'));
  UI.mode = 'defend'; renderCmd();
  await wait(420);
  const outs = await ENEMY_SCRIPTS[key](e, tgt, atk);
  if (atk.type === 'phys' && outs.length === atk.hits && outs.every(o => o === 'parry') && e.alive) {
    labelText(e, 'RIPOSTE', '#ffd35a'); sfx('parry'); breakShield(e); refreshHud();
    say('Perfect parry chain! ' + e.name + ' loses a shield.');
  }
  UI.mode = 'wait'; renderCmd();
  await wait(250);
}

/* ---------- turn loop ---------- */
function turnList() { return living(B.all).sort((a, b) => (b.spd - a.spd) || (a.side === 'p' ? -1 : 1)); }
function upcoming() { return B.order.concat(turnList()).slice(0, 10); }
function isOver() { if (!living(B.enemies).length) return 'win'; if (!living(B.party).length) return 'lose'; return null; }
async function battleLoop() {
  while (true) {
    B.round++;
    for (const p of living(B.party)) p.bp = Math.min(5, p.bp + 1);
    refreshHud();
    B.order = turnList();
    while (B.order.length) {
      const u = B.order.shift(); if (!u.alive) continue;
      B.current = u; refreshHud();
      if (u.side === 'p') { const cmd = await playerCommand(u); UI.mode = 'busy'; renderCmd(); await runAction(u, cmd.ab, cmd.targets, cmd.boost); }
      else await enemyTurn(u);
      B.current = null; refreshHud();
      const end = isOver(); if (end) return finish(end);
      await wait(200);
    }
  }
}
async function finish(result) {
  B.over = true; UI.mode = 'over'; renderCmd();
  const win = result === 'win';
  await wait(700);
  if (win) {
    showSkill('Victory', null); sfx('victory');
    for (const p of living(B.party)) p.actor.to('victory', 300);
    camTo(372, 150, 1.18, 900, Ease.inOut);
  } else showSkill('Defeat', null);
  await wait(1500);
  showOutro(win);
}
