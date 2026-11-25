/* intro.js — Pantalla de entrada: cae una caja (3D en js/intro3d.js), sale una botella, verifica la edad y se destapa (con sonido).
 * El sonido se sintetiza con Web Audio (sin archivos): "pop" del gas, tapa que cae y burbujeo.
 * Al terminar emite el evento 'bh:intro-done'. */
var Intro = (function () {
  var $ = function (s) { return document.querySelector(s); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var done = false, waiters = []; // la edad se pregunta en cada visita

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

  /* ---------------- Caja 3D (js/intro3d.js) ---------------- */
  var api = null, exiting = false, opening = false, isReady = false, fellBack = false;
  function showUI() {
    if (isReady) return; isReady = true;
    $('#intro').classList.add('ready');
    setTimeout(function () { $('#inGo').focus({ preventScroll: true }); }, 400);
  }
  function fallback(e) {
    if (api || fellBack) return; fellBack = true;
    if (e) console.warn('Intro 3D desactivada:', e);
    $('#intro').classList.add('no3d'); setTimeout(showUI, 500);
  }
  function load3d() {
    var t = setTimeout(function () { fallback('tardó demasiado'); }, 9000);
    import(new URL('js/intro3d.js', document.baseURI).href)
      .then(function (m) { return m.run($('#intro'), { ready: showUI, opened: exit }); })
      .then(function (a) { clearTimeout(t); if (fellBack) { a.dispose(); return; } api = a; })
      .catch(function (e) { clearTimeout(t); fallback(e); });
  }

  /* ---------------- Destapar ---------------- */
  function uncork() {
    if (opening) return; opening = true;
    Sound.unlock(); Sound.open();
    if (navigator.vibrate) try { navigator.vibrate([12, 40, 30]); } catch (e) {}
    var intro = $('#intro'); intro.classList.add('opening');
    if (api) api.open();
    if (!reduced && intro.animate) {
      $('#inFlash').animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' });
      setTimeout(function () { $('#inSalud').animate([{ opacity: 0, transform: 'scale(.5) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1.1) rotate(-3deg)', offset: .55 }, { opacity: 1, transform: 'scale(1) rotate(-3deg)' }], { duration: 650, fill: 'forwards', easing: 'cubic-bezier(.2,.9,.3,1.3)' }); }, 300);
    } else $('#inSalud').style.opacity = 1;
    if (!api) setTimeout(exit, 1300); // sin 3D sale por tiempo; con 3D avisa la escena
  }
  function exit() {
    if (done || exiting) return; exiting = true;
    var intro = $('#intro');
    // primero se desvanece la intro y recién luego arranca el hero (su primer cuadro es pesado) y se libera la GPU
    var rm = function () {
      if (!intro.isConnected) return; intro.remove(); finish();
      var a3 = api; api = null; if (a3) setTimeout(function () { a3.dispose(); }, 600);
    };
    if (reduced || !intro.animate) return rm();
    intro.classList.add('leaving');
    var a = intro.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 550, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    a.onfinish = rm; setTimeout(rm, 900);
  }

  /* ---------------- Arranque ---------------- */
  function start() {
    var intro = $('#intro'); if (!intro) return finish();
    document.documentElement.classList.add('intro-on');
    // si Three.js no carga (sin internet / CDN caído) el hero muestra la foto
    setTimeout(function () { if (!window.__h3d) { var h = $('#hero'); if (h) h.classList.add('no3d'); } }, 9000);
    $('#inGo').addEventListener('click', uncork);
    $('#inNo').addEventListener('click', function () {
      $('#inMsg').hidden = false; $('#inGo').hidden = true; $('#inNo').hidden = true; $('#inQ').hidden = true;
      if (api) api.no();
    });
    var gl = document.createElement('canvas');
    if (gl.getContext('webgl2') || gl.getContext('webgl')) load3d(); else fallback();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  return { ready: ready };
})();
