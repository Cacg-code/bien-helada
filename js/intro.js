/* intro.js — Pantalla de carga: se destapa la botella (con sonido) y verifica la edad.
 * El sonido se sintetiza con Web Audio (sin archivos): "pop" del gas, tapa que cae y burbujeo.
 * Al terminar emite el evento 'bh:intro-done'. */
var Intro = (function () {
  var $ = function (s) { return document.querySelector(s); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var done = false, waiters = [], adult = localStorage.getItem('bh_18') === '1';

  function ready(fn) { if (done) fn(); else waiters.push(fn); }
  function finish() {
    done = true; document.documentElement.classList.remove('intro-on');
    document.dispatchEvent(new CustomEvent('bh:intro-done'));
    waiters.splice(0).forEach(function (f) { try { f(); } catch (e) { console.error(e); } });
  }

  /* ---------------- Sonido ---------------- */
  var Sound = (function () {
    var ctx, out, noise;
    function init() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      out = ctx.createGain(); out.gain.value = .9; out.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      var d = noise.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return ctx;
    }
    function src(t, dur) { var s = ctx.createBufferSource(); s.buffer = noise; s.start(t, Math.random() * 1.5, dur + .05); return s; }
    function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }

    function pop(t) {
      // golpe de aire: ruido filtrado que baja de tono rápidamente
      var n = src(t, .14), bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(2600, t); bp.frequency.exponentialRampToValueAtTime(420, t + .07);
      env(g, t, .002, 1.1, .1); n.connect(bp); bp.connect(g); g.connect(out);
      // cuerpo grave del "pop"
      var o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(70, t + .09);
      env(og, t, .003, .9, .13); o.connect(og); og.connect(out); o.start(t); o.stop(t + .2);
      // chasquido metálico al soltarse la chapa
      var c = ctx.createOscillator(), cg = ctx.createGain();
      c.type = 'triangle'; c.frequency.value = 3400; env(cg, t, .001, .12, .05); c.connect(cg); cg.connect(out); c.start(t); c.stop(t + .08);
    }
    function hiss(t) {
      // salida del gas: ssssh
      var n = src(t, 1.9), hp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2400; lp.type = 'lowpass'; lp.frequency.setValueAtTime(10000, t); lp.frequency.exponentialRampToValueAtTime(4500, t + 1.6);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.42, t + .02); g.gain.exponentialRampToValueAtTime(.12, t + .35); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      n.connect(hp); hp.connect(lp); lp.connect(g); g.connect(out);
    }
    function fizz(t) {
      // burbujas: cientos de chispitas que se van espaciando
      for (var i = 0; i < 140; i++) {
        var at = t + .04 + Math.pow(Math.random(), 1.8) * 2.4, n = src(at, .012), bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass'; bp.Q.value = 5; bp.frequency.value = 3500 + Math.random() * 6000;
        env(g, at, .001, .05 + Math.random() * .16 * (1 - (at - t) / 2.6), .008 + Math.random() * .01);
        n.connect(bp); bp.connect(g); g.connect(out);
      }
    }
    function clink(t, vol) {
      // la chapa rebota en el piso
      [2650, 3980, 5310, 7100].forEach(function (f, k) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - .5) * .02);
        env(g, t, .001, vol / (k + 1), .22 - k * .04); o.connect(g); g.connect(out); o.start(t); o.stop(t + .3);
      });
    }
    return {
      unlock: function () { if (init() && ctx.state === 'suspended') ctx.resume(); },
      open: function () {
        if (!init()) return;
        if (ctx.state === 'suspended') ctx.resume();
        var t = ctx.currentTime + .03;
        pop(t); hiss(t + .01); fizz(t + .05);
        clink(t + .62, .16); clink(t + .8, .07); clink(t + .9, .03);
      }
    };
  })();

  /* ---------------- Espuma (canvas) ---------------- */
  function foam(x, y) {
    var cv = $('#inFoam'), c = cv.getContext('2d'), dpr = Math.min(devicePixelRatio || 1, 1.5);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; c.scale(dpr, dpr);
    var P = [], scale = Math.min(1.2, innerHeight / 760);
    for (var i = 0; i < 190; i++) {
      var a = -Math.PI / 2 + (Math.random() - .5) * (i < 120 ? .7 : 1.7), v = (5 + Math.random() * 13) * scale;
      P.push({ x: x + (Math.random() - .5) * 10, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.2 + Math.random() * (i < 150 ? 4 : 9),
        life: 0, max: 50 + Math.random() * 50, gold: Math.random() < .35 });
    }
    var t0 = performance.now(), last = t0;
    (function frame(now) {
      var dt = Math.min(2.2, (now - last) / 16.7); last = now;
      c.clearRect(0, 0, innerWidth, innerHeight);
      var alive = 0;
      P.forEach(function (p) {
        if (p.life > p.max) return; alive++;
        p.life += dt; p.vy += .32 * dt; p.vx *= Math.pow(.985, dt); p.x += p.vx * dt; p.y += p.vy * dt;
        var k = 1 - p.life / p.max;
        c.globalAlpha = Math.max(0, k * .95);
        c.fillStyle = p.gold ? '#ffe2a3' : '#fffaf0';
        c.beginPath(); c.arc(p.x, p.y, p.r * (.6 + k * .4), 0, 6.283); c.fill();
        if (p.r > 5) { c.globalAlpha *= .5; c.fillStyle = '#fff'; c.beginPath(); c.arc(p.x - p.r * .3, p.y - p.r * .3, p.r * .25, 0, 6.283); c.fill(); }
      });
      if (alive) requestAnimationFrame(frame); else c.clearRect(0, 0, innerWidth, innerHeight);
    })(t0);
  }

  /* ---------------- Barra de "enfriando" ---------------- */
  var heroReady = false, onCold = null;
  document.addEventListener('bh:hero-ready', function () { heroReady = true; });
  function loadingBar() {
    var bar = $('#inBar'), temp = $('#inTemp'), t0 = performance.now();
    (function tick() {
      if (done || !bar) return;
      var el = (performance.now() - t0) / 1000, p = heroReady ? 1 : Math.min(.92, 1 - Math.exp(-el / 1.4));
      var cur = parseFloat(bar.style.getPropertyValue('--p')) || 0, nx = cur + (p - cur) * .12;
      bar.style.setProperty('--p', nx.toFixed(3));
      var deg = Math.round(8 - nx * 10);
      temp.textContent = nx > .985 ? 'Bien helada · -2 °C ✓' : 'Enfriando… ' + deg + ' °C';
      $('#intro').classList.toggle('cold', nx > .985);
      if (nx > .985 && el > 1.2 && onCold) { var f = onCold; onCold = null; f(); }
      requestAnimationFrame(tick);
    })();
  }

  /* ---------------- Destapar ---------------- */
  var opening = false;
  function uncork() {
    if (opening) return; opening = true;
    localStorage.setItem('bh_18', '1');
    Sound.open();
    if (navigator.vibrate) try { navigator.vibrate([12, 40, 30]); } catch (e) {}
    var intro = $('#intro'), cap = $('#inCap'), bottle = $('#inBottle');
    intro.classList.add('opening');
    var r = cap.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .8;

    if (reduced) { intro.classList.add('salud'); setTimeout(exit, 700); return; }

    bottle.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-2.5deg)' }, { transform: 'rotate(2deg)' }, { transform: 'rotate(-1deg) translateY(4px)' }, { transform: 'rotate(0) translateY(0)' }],
      { duration: 420, easing: 'ease-out' });
    var dir = innerWidth > 700 ? 1 : .6;
    cap.animate([
      { transform: 'translate(0,0) rotate(0)', opacity: 1 },
      { transform: 'translate(' + 60 * dir + 'px,-' + innerHeight * .42 + 'px) rotate(260deg) rotateX(60deg)', opacity: 1, offset: .45 },
      { transform: 'translate(' + 150 * dir + 'px,-' + innerHeight * .2 + 'px) rotate(520deg) rotateX(120deg)', opacity: 1, offset: .75 },
      { transform: 'translate(' + 210 * dir + 'px,' + innerHeight * .55 + 'px) rotate(760deg) rotateX(170deg)', opacity: 0 }
    ], { duration: 1150, easing: 'cubic-bezier(.15,.7,.4,1)', fill: 'forwards' });
    foam(cx, cy);
    setTimeout(function () { intro.classList.add('salud'); }, 480);
    setTimeout(exit, 1500);
  }
  function exit() {
    var intro = $('#intro');
    finish();
    if (reduced || !intro.animate) { intro.remove(); return; }
    intro.classList.add('leaving');
    var a = intro.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    var rm = function () { if (intro.isConnected) intro.remove(); };
    a.onfinish = rm; setTimeout(rm, 900);
  }

  /* ---------------- Arranque ---------------- */
  function phase(name) { var i = $('#intro'); i.classList.remove('ph-ask', 'ph-load', 'ph-tap'); i.classList.add('ph-' + name); }
  function start() {
    var intro = $('#intro'); if (!intro) return finish();
    document.documentElement.classList.add('intro-on');
    // si Three.js no carga (sin internet / CDN caído) mostramos la foto
    setTimeout(function () { if (!window.__h3d) { var h = $('#hero'); if (h) h.classList.add('no3d'); heroReady = true; } }, 7000);
    $('#inGo').addEventListener('click', function () {
      Sound.unlock();
      if (!adult) {
        // 1) respondió que es mayor → 2) carga → 3) se destapa sola (el toque ya habilitó el sonido)
        adult = true; localStorage.setItem('bh_18', '1');
        phase('load'); loadingBar(); onCold = function () { setTimeout(uncork, 250); };
      } else uncork();
    });
    $('#inBottle').addEventListener('click', function () { if (intro.classList.contains('ph-tap')) { Sound.unlock(); uncork(); } });
    $('#inNo').addEventListener('click', function () {
      $('#inMsg').hidden = false; $('#inGo').hidden = true; $('#inNo').hidden = true; $('#inQ').hidden = true;
    });
    addEventListener('keydown', function (e) { if (!done && !opening && intro.classList.contains('ph-tap') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); Sound.unlock(); uncork(); } });
    if (adult) {
      // ya confirmó antes: carga y luego "toca para destapar" (el navegador exige un toque para el sonido)
      $('#inGoTxt').textContent = 'Toca para destapar';
      phase('load'); loadingBar(); onCold = function () { phase('tap'); $('#inGo').focus({ preventScroll: true }); };
    } else {
      $('#inGoTxt').textContent = 'Sí, soy mayor de edad';
      phase('ask'); setTimeout(function () { $('#inGo').focus({ preventScroll: true }); }, 300);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return { ready: ready };
})();
