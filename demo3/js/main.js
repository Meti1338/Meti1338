'use strict';
/* Page controller: plays animations on the stage, handles view options and sprite sheet export. */

(() => {
  const { STAGE_W, STAGE_H, ANIMS, Buf, renderFrame, loadSprite } = window.MageAnim;
  const view = document.getElementById('view'), g = view.getContext('2d');
  view.width = STAGE_W; view.height = STAGE_H;
  const buf = new Buf(STAGE_W, STAGE_H), frame = document.createElement('canvas');
  frame.width = STAGE_W; frame.height = STAGE_H;
  const fg = frame.getContext('2d');
  const ui = { bg: document.getElementById('bg'), speed: document.getElementById('speed'), mirror: document.getElementById('mirror') };
  const order = Object.keys(ANIMS);
  let cur = 'idle', t = 0, last = performance.now(), bgCanvas = null;

  /* backgrounds, drawn once in stage pixels */
  function makeBg(kind) {
    const c = document.createElement('canvas'); c.width = STAGE_W; c.height = STAGE_H;
    const x = c.getContext('2d'), G = window.MageAnim.RIG.pivot.y + 8;
    if (kind === 'tan') { x.fillStyle = '#b39772'; x.fillRect(0, 0, STAGE_W, STAGE_H); }
    else if (kind === 'checker') for (let j = 0; j < STAGE_H; j += 8) for (let i = 0; i < STAGE_W; i += 8) { x.fillStyle = (i + j) % 16 ? '#2a2836' : '#3a3848'; x.fillRect(i, j, 8, 8); }
    else {
      const night = kind === 'night', sky = x.createLinearGradient(0, 0, 0, G);
      sky.addColorStop(0, night ? '#0c1028' : '#e9dfb8'); sky.addColorStop(1, night ? '#28304e' : '#a8b878');
      x.fillStyle = sky; x.fillRect(0, 0, STAGE_W, G);
      for (let i = 0; i < 9; i++) {                       // distant tree line
        x.fillStyle = night ? '#141a30' : '#6e8a4e';
        const tx = i * 44 - 10, th = 70 + (i * 37 % 40);
        x.beginPath(); x.moveTo(tx, G); x.lineTo(tx + 22, G - th); x.lineTo(tx + 44, G); x.fill();
      }
      x.fillStyle = night ? '#1c2232' : '#7a6a44'; x.fillRect(0, G - 6, STAGE_W, STAGE_H - G + 6);
      x.fillStyle = night ? '#252c40' : '#8e7c52';
      for (let i = 0; i < 70; i++) x.fillRect((i * 53) % STAGE_W, G - 4 + (i * 17) % (STAGE_H - G + 2), 2, 1);
      if (night) { x.fillStyle = '#c8d0ff'; for (let i = 0; i < 40; i++) x.fillRect((i * 97) % STAGE_W, (i * 41) % (G - 90), 1, 1); }
    }
    return c;
  }
  function setBg() { bgCanvas = makeBg(ui.bg.value); }

  /* whole-number scaling keeps sprite pixels square */
  function fit() {
    const w = document.getElementById('stage').clientWidth, k = Math.max(1, Math.floor(w / STAGE_W));
    view.style.width = STAGE_W * k + 'px'; view.style.height = STAGE_H * k + 'px';
  }

  const bar = document.getElementById('anims'), btns = {};
  order.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.innerHTML = ANIMS[name].label + '<kbd>' + (i + 1) + '</kbd>';
    b.onclick = () => play(name);
    bar.appendChild(b); btns[name] = b;
  });
  function play(name) { cur = name; t = 0; for (const k in btns) btns[k].classList.toggle('on', k === name); }

  function draw() {
    const s = renderFrame(buf, cur, t);
    fg.putImageData(buf.img, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, STAGE_W, STAGE_H);
    g.drawImage(bgCanvas, 0, 0);
    if (ui.mirror.checked) g.setTransform(-1, 0, 0, 1, STAGE_W, 0);
    g.drawImage(frame, s.shake[0], s.shake[1]);
  }
  function tick(now) {
    t += Math.min(now - last, 50) * +ui.speed.value; last = now;
    const A = ANIMS[cur];
    if (!A.loop && t >= A.ms) play('idle');
    draw();
    requestAnimationFrame(tick);
  }

  function downloadSheet() {
    const A = ANIMS[cur], n = Math.ceil(A.ms / (1000 / 12)), cols = Math.min(8, n), rows = Math.ceil(n / cols);
    const c = document.createElement('canvas'); c.width = cols * STAGE_W; c.height = rows * STAGE_H;
    const x = c.getContext('2d'), b = new Buf(STAGE_W, STAGE_H);
    for (let i = 0; i < n; i++) { renderFrame(b, cur, i * 1000 / 12); x.putImageData(b.img, (i % cols) * STAGE_W, Math.floor(i / cols) * STAGE_H); }
    const a = document.createElement('a');
    a.download = 'mage_' + cur + '_' + n + 'f_12fps.png'; a.href = c.toDataURL('image/png'); a.click();
  }

  ui.bg.onchange = setBg;
  document.getElementById('sheet').onclick = downloadSheet;
  view.onclick = () => play(order[(order.indexOf(cur) + 1) % order.length]);
  addEventListener('keydown', e => { const i = +e.key - 1; if (i >= 0 && i < order.length) play(order[i]); });
  addEventListener('resize', fit);

  window.MageView = { makeBg };
  setBg(); fit(); play('idle');
  loadSprite(SPRITE_PNG).then(() => { last = performance.now(); requestAnimationFrame(tick); });
})();
