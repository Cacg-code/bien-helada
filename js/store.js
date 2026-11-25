/* store.js — Tienda: exhibidora 3D, catálogo, carrito y pedido. */
(function () {
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = Draw.esc;
  var S = { cfg: Core.normConfig({}), prods: [], byId: {}, cart: load('bh_cart', {}), cat: 'Todo', q: '', step: 'cart', last: null, sending: false };
  var CAT_ICON = { Todo: '✨', Cervezas: '🍺', Latas: '🥫', Packs: '📦', Licores: '🥃', Complementos: '🧊' };
  var money = function (n) { return 'S/ ' + Number(n || 0).toFixed(2); };
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function load(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function buzz(ms) { if (navigator.vibrate) try { navigator.vibrate(ms || 12); } catch (e) {} }

  /* ---------- origen del link (?ref=grupo-x) ---------- */
  (function () {
    var m = location.search.match(/[?&](ref|g)=([^&]+)/);
    if (m) sessionStorage.setItem('bh_ref', decodeURIComponent(m[2]).slice(0, 40));
  })();

  /* ---------- datos ---------- */
  function setData(d) {
    S.cfg = Object.assign(Core.normConfig({}), d.config || {});
    S.prods = d.productos || [];
    S.byId = {}; S.prods.forEach(function (p) { S.byId[p.id] = p; });
    for (var id in S.cart) if (!S.byId[id]) delete S.cart[id];
    applyConfig(); renderFridge(); renderCats(); renderGrid(); syncCart();
  }
  function loadData() {
    var cache = load('bh_cat_cache', null);
    if (cache) setData(cache);
    return API.call('catalogo').then(function (d) { save('bh_cat_cache', d); setData(d); })
      .catch(function () { if (!cache) $('#grid').innerHTML = '<p class="empty">No pudimos cargar el catálogo. Revisa tu conexión y recarga 🙏</p>'; });
  }

  function applyConfig() {
    var c = S.cfg;
    document.querySelectorAll('[data-cfg]').forEach(function (el) {
      var k = el.getAttribute('data-cfg');
      if (k === 'horarioCorto') el.textContent = c.abierto ? 'abierto ahora' : 'cerrado ahora';
      else if (c[k] != null) el.textContent = c[k];
    });
    document.title = c.nombre + ' · Chelas heladas a tu puerta';
    var pill = $('#openPill'); pill.classList.toggle('closed', !c.abierto); pill.lastChild.textContent = c.abierto ? 'Abierto' : 'Cerrado';
    var n = $('#notice'), msg = c.aviso || (!c.abierto ? 'Ahora estamos cerrados. Puedes armar tu pedido y enviarlo en nuestro horario: ' + c.horario : '');
    n.hidden = !msg; n.textContent = msg;
    $('#footDelivery').textContent = (c.costoDelivery ? 'Delivery ' + money(c.costoDelivery) : 'Delivery gratis') +
      (c.deliveryGratisDesde ? ' · gratis desde ' + money(c.deliveryGratisDesde) : '') + (c.pedidoMinimo ? ' · pedido mínimo ' + money(c.pedidoMinimo) : '');
    $('#footWa').href = 'https://wa.me/' + c.whatsapp + '?text=' + encodeURIComponent('Hola, tengo una consulta sobre ' + c.nombre);
  }

  /* ---------- exhibidora 3D ---------- */
  function cols() { return innerWidth >= 720 ? 4 : 3; }
  function ml(p) { var m = String(p.presentacion).match(/([\d.]+)\s*(ml|l)\b/i); return m ? +m[1] * (/^l$/i.test(m[2]) ? 1000 : 1) : 600; }
  function sizeOf(p) { return p.forma === 'lata' ? .6 : p.forma === 'botella' ? (ml(p) >= 500 ? 1 : .86) : .92; }
  function renderFridge() {
    // como una exhibidora real: solo lo que va helado, varias unidades por producto y alturas reales
    var c = cols(), all = S.prods;
    var bottles = all.filter(function (p) { return p.forma === 'botella'; }).sort(function (x, y) { return ml(y) - ml(x) || (y.destacado - x.destacado); });
    var cans = all.filter(function (p) { return p.forma === 'lata'; });
    var others = all.filter(function (p) { return p.forma === 'otro'; });
    if (!bottles.length) bottles = all.slice();
    if (!bottles.length) return;
    var big = bottles.filter(function (p) { return ml(p) >= 500; }), small = bottles.filter(function (p) { return ml(p) < 500; });
    var plan = [big.length ? big : bottles, big.length > c ? big.slice(c).concat(small) : (small.length ? small : bottles),
      small.length ? small : bottles, cans.length ? cans : (others.length ? others : bottles)];
    var used = {}, html = '', k = 0;
    plan.forEach(function (grp, r) {
      var start = used[r] || 0;
      html += '<div class="shelf" style="--cols:' + c + '">';
      for (var j = 0; j < c; j++) {
        var p = grp[(start + j) % grp.length], out = p.stock === 0, can = p.forma === 'lata';
        var n = 3, imgs = '';
        for (var f = n - 1; f >= 0; f--) imgs += '<span class="fc fc' + f + '">' + Draw.product(p, f ? 'art-b' : 'art') + '</span>';
        html += '<button class="f-item' + (out ? ' out' : '') + (can ? ' is-can' : '') + '" data-add="' + esc(p.id) + '" style="--i:' + (k++) + ';--h:' + sizeOf(p) + '" aria-label="Agregar ' + esc(p.nombre) + ' ' + money(p.precio) + '">' +
          '<span class="facing">' + imgs + '</span>' +
          '<span class="tag"><small>' + esc(p.nombre.replace(/ lata$/i, '')) + '</small><b>' + money(p.precio).replace('S/ ', 'S/') + '</b></span></button>';
      }
      html += '</div>';
    });
    $('#shelves').innerHTML = html;
  }
  function openFridge() {
    var f = $('#fridge'), st = $('#stage');
    if (f.classList.contains('is-open')) return;
    f.classList.add('is-open'); st.classList.add('open'); buzz(20);
    var t = 6, el = $('#temp');
    var iv = setInterval(function () { t--; el.textContent = t + ' °C'; if (t <= -2) clearInterval(iv); }, reduced ? 1 : 140);
  }
  var lastCols = cols();
  addEventListener('resize', function () { if (cols() !== lastCols) { lastCols = cols(); renderFridge(); } });

  /* ---------- catálogo ---------- */
  function renderCats() {
    var cats = ['Todo'];
    S.prods.forEach(function (p) { if (cats.indexOf(p.categoria) < 0) cats.push(p.categoria); });
    $('#cats').innerHTML = cats.map(function (c) {
      return '<button class="cat' + (c === S.cat ? ' on' : '') + '" data-cat="' + esc(c) + '">' + (CAT_ICON[c] || '•') + ' ' + esc(c) + '</button>';
    }).join('');
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function renderGrid() {
    var q = norm(S.q), list = S.prods.filter(function (p) {
      return (S.cat === 'Todo' || p.categoria === S.cat) && (!q || norm(p.nombre + ' ' + p.categoria + ' ' + p.presentacion).indexOf(q) >= 0);
    });
    $('#grid').innerHTML = list.length ? list.map(function (p, i) {
      var out = p.stock === 0, low = typeof p.stock === 'number' && p.stock > 0 && p.stock <= 5;
      var badge = out ? '<span class="badge out">Agotado</span>' : low ? '<span class="badge low">Quedan ' + p.stock + '</span>' : p.destacado ? '<span class="badge hot">🔥 Top</span>' : '';
      return '<article class="card' + (out ? ' is-out' : '') + '" data-id="' + esc(p.id) + '" style="--i:' + Math.min(i, 12) + '">' +
        '<div class="card-art">' + badge + Draw.product(p, 'art') + '</div>' +
        '<div class="card-body"><h3 class="card-name">' + esc(p.nombre) + '</h3><span class="card-pres">' + esc(p.presentacion) + '</span>' +
        '<div class="card-row"><span class="price"><small>S/</small>' + p.precio.toFixed(2) + '</span><span class="ctl">' + ctl(p) + '</span></div></div></article>';
    }).join('') : '<p class="empty">No encontramos “' + esc(S.q) + '”. Prueba con otra palabra 🍻</p>';
  }
  function ctl(p) {
    var n = S.cart[p.id] || 0;
    if (!n) return '<button class="add" data-add="' + esc(p.id) + '" aria-label="Agregar ' + esc(p.nombre) + '">+</button>';
    return '<span class="step"><button data-dec="' + esc(p.id) + '" aria-label="Quitar uno">−</button><b>' + n + '</b><button data-inc="' + esc(p.id) + '" aria-label="Agregar uno">+</button></span>';
  }

  /* ---------- carrito ---------- */
  function maxOf(p) { return typeof p.stock === 'number' ? Math.min(p.stock, 99) : 99; }
  function setQty(id, n, src) {
    var p = S.byId[id]; if (!p) return;
    var prev = S.cart[id] || 0;
    n = Math.max(0, Math.min(n, maxOf(p)));
    if (n === prev) { if (n >= maxOf(p) && n > 0) toast('No hay más stock de ' + p.nombre); else if (!maxOf(p)) toast(p.nombre + ' está agotado'); return; }
    if (n) S.cart[id] = n; else delete S.cart[id];
    save('bh_cart', S.cart); buzz(n > prev ? 12 : 6);
    if (n > prev) { if (src) fly(src); toast('✓ ' + p.nombre + (n > 1 ? ' ×' + n : '') + ' agregado'); }
    syncCart();
  }
  function cartLines() {
    return Object.keys(S.cart).map(function (id) { return { p: S.byId[id], n: S.cart[id] }; }).filter(function (l) { return l.p; });
  }
  function totals(entrega) {
    var sub = 0, units = 0;
    cartLines().forEach(function (l) { sub += l.p.precio * l.n; units += l.n; });
    sub = Math.round(sub * 100) / 100;
    var c = S.cfg, del = entrega === 'recojo' || (c.deliveryGratisDesde > 0 && sub >= c.deliveryGratisDesde) ? 0 : c.costoDelivery;
    return { sub: sub, del: del, total: Math.round((sub + del) * 100) / 100, units: units };
  }
  function syncCart() {
    var t = totals('delivery'), cnt = $('#cartCount');
    cnt.textContent = t.units; cnt.classList.toggle('on', t.units > 0);
    $('#cbCount').textContent = t.units; $('#cbTotal').textContent = money(t.sub);
    $('#cartbar').hidden = !t.units || $('#sheet').classList.contains('on');
    document.querySelectorAll('.card').forEach(function (c) { var p = S.byId[c.dataset.id]; if (p) $('.ctl', c).innerHTML = ctl(p); });
    if ($('#sheet').classList.contains('on') && S.step === 'cart') renderSheet();
  }
  function fly(src) {
    var art = src.querySelector('.art') || src.closest('.card') && src.closest('.card').querySelector('.art');
    var target = !$('#cartbar').hidden ? $('#cbCount') : $('#cartBtn');
    if (art && !reduced && art.animate) {
      var a = art.getBoundingClientRect(), b = target.getBoundingClientRect(), clone = art.cloneNode(true);
      clone.classList.add('fly'); clone.style.left = a.left + a.width / 2 - 17 + 'px'; clone.style.top = a.top + a.height / 2 - 45 + 'px';
      document.body.appendChild(clone);
      var dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
      clone.animate([{ transform: 'translate(0,0) scale(1)', opacity: 1 }, { transform: 'translate(' + dx * .5 + 'px,' + (dy * .5 - 80) + 'px) scale(.8) rotate(-20deg)', opacity: 1, offset: .5 },
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.25) rotate(-40deg)', opacity: .3 }], { duration: 620, easing: 'cubic-bezier(.4,0,.6,1)' })
        .onfinish = function () { clone.remove(); bump(); };
    } else bump();
    if (src.classList.contains('f-item')) { src.classList.remove('added'); void src.offsetWidth; src.classList.add('added'); }
  }
  function bump() { ['#cartBtn', '#cartbar'].forEach(function (s) { var e = $(s); e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }); }
  var tt; function toast(m) { var t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove('on'); }, 1600); }

  /* ---------- hoja: carrito → datos → pago ---------- */
  var cust = load('bh_cliente', { cliente: '', telefono: '', entrega: 'delivery', direccion: '', referencia: '', pago: '' });
  function openSheet(step) {
    S.step = step || 'cart'; renderSheet();
    var sh = $('#sheet'), bg = $('#sheetBg');
    bg.hidden = false; requestAnimationFrame(function () { bg.classList.add('on'); sh.classList.add('on'); });
    sh.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden'; $('#cartbar').hidden = true;
    if (!history.state || !history.state.sheet) history.pushState({ sheet: 1 }, '');
  }
  function closeSheet(fromPop) {
    var sh = $('#sheet'), bg = $('#sheetBg');
    sh.classList.remove('on'); bg.classList.remove('on'); sh.setAttribute('aria-hidden', 'true'); sh.style.transform = '';
    document.body.style.overflow = ''; setTimeout(function () { bg.hidden = true; }, 300);
    if (S.step === 'ok') { S.step = 'cart'; }
    syncCart();
    if (!fromPop && history.state && history.state.sheet) history.back();
  }
  addEventListener('popstate', function () { if ($('#sheet').classList.contains('on')) closeSheet(true); });

  function renderSheet() {
    var body = $('#sheetBody'), foot = $('#sheetFoot'), st = S.step;
    var idx = { cart: 0, datos: 1, ok: 2 }[st];
    document.querySelectorAll('#steps i').forEach(function (i, k) { i.classList.toggle('on', k <= idx); });
    $('#sheetTitle').textContent = st === 'cart' ? 'Tu pedido' : st === 'datos' ? 'Tus datos' : 'Pedido enviado';
    $('#sheetBack').hidden = st !== 'datos';
    if (st === 'cart') {
      var lines = cartLines(), t = totals('delivery'), c = S.cfg;
      if (!lines.length) {
        body.innerHTML = '<div class="cart-empty"><div>🧊</div><p>Tu carrito está vacío.<br>Abre la exhibidora y elige tus chelas.</p></div>';
        foot.innerHTML = '<button class="btn btn-ice btn-block" data-close>Ver bebidas</button>'; return;
      }
      body.innerHTML = lines.map(function (l) {
        return '<div class="line">' + Draw.product(l.p, 'art') + '<div class="line-info"><b>' + esc(l.p.nombre) + '</b><span>' + esc(l.p.presentacion) + ' · ' + money(l.p.precio) + '</span><br><span><strong>' + money(l.p.precio * l.n) + '</strong></span></div>' +
          '<span class="step"><button data-dec="' + esc(l.p.id) + '" aria-label="Quitar uno">' + (l.n === 1 ? '🗑' : '−') + '</button><b>' + l.n + '</b><button data-inc="' + esc(l.p.id) + '" aria-label="Agregar uno">+</button></span></div>';
      }).join('');
      var free = c.deliveryGratisDesde > 0 && c.costoDelivery > 0 ? (t.sub >= c.deliveryGratisDesde ? '<div class="free-bar">🎉 ¡Tienes delivery gratis!<i style="--p:100%"></i></div>'
        : '<div class="free-bar">Te faltan <b>' + money(c.deliveryGratisDesde - t.sub) + '</b> para delivery gratis<i style="--p:' + Math.round(t.sub / c.deliveryGratisDesde * 100) + '%"></i></div>') : '';
      var minOk = t.sub >= c.pedidoMinimo;
      foot.innerHTML = free + '<div class="sum"><div><span>Subtotal (' + t.units + ' u.)</span><span>' + money(t.sub) + '</span></div><div><span>Delivery</span><span>' + (t.del ? money(t.del) : 'Gratis') + '</span></div><div class="tot"><span>Total</span><span>' + money(t.total) + '</span></div></div>' +
        (minOk ? '' : '<div class="err">El pedido mínimo es ' + money(c.pedidoMinimo) + '. Agrega ' + money(c.pedidoMinimo - t.sub) + ' más.</div>') +
        '<button class="btn btn-amber btn-block" data-go="datos"' + (minOk ? '' : ' disabled') + '>Continuar →</button>';
    } else if (st === 'datos') {
      var mp = S.cfg.modoPago, pago = mp === 'ambos' ? (cust.pago || 'yape') : mp;
      body.innerHTML = '<form class="form" id="form" novalidate>' +
        '<div class="field"><label for="fNom">Tu nombre</label><input id="fNom" name="cliente" autocomplete="given-name" required maxlength="60" value="' + esc(cust.cliente) + '" placeholder="¿A nombre de quién?"></div>' +
        '<div class="field"><label for="fTel">Celular</label><input id="fTel" name="telefono" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="12" value="' + esc(cust.telefono) + '" placeholder="9XX XXX XXX"></div>' +
        '<div class="field"><label>¿Cómo lo recibes?</label><div class="seg">' +
        '<label><input type="radio" name="entrega" value="delivery"' + (cust.entrega !== 'recojo' ? ' checked' : '') + '>🛵 Delivery<small>' + (S.cfg.costoDelivery ? money(S.cfg.costoDelivery) : 'Gratis') + '</small></label>' +
        '<label><input type="radio" name="entrega" value="recojo"' + (cust.entrega === 'recojo' ? ' checked' : '') + '>🏪 Recojo<small>Sin costo</small></label></div></div>' +
        '<div class="field" id="dirWrap"><label for="fDir">Dirección</label><input id="fDir" name="direccion" autocomplete="street-address" maxlength="160" value="' + esc(cust.direccion) + '" placeholder="Calle, número, mz/lote"></div>' +
        '<div class="field" id="refWrap"><label for="fRef">Referencia <small>(opcional)</small></label><input id="fRef" name="referencia" maxlength="120" value="' + esc(cust.referencia) + '" placeholder="Frente al parque, puerta verde…"></div>' +
        (mp === 'ambos' ? '<div class="field"><label>¿Cómo pagas?</label><div class="seg">' +
          '<label class="pay-yape"><input type="radio" name="pago" value="yape"' + (pago === 'yape' ? ' checked' : '') + '>💜 Yape<small>Pagas ahora</small></label>' +
          '<label class="pay-wa"><input type="radio" name="pago" value="whatsapp"' + (pago === 'whatsapp' ? ' checked' : '') + '>💬 WhatsApp<small>Coordinas el pago</small></label></div></div>'
          : '<input type="hidden" name="pago" value="' + mp + '">') +
        '<div class="field"><label for="fNota">Nota <small>(opcional)</small></label><textarea id="fNota" name="nota" maxlength="200" placeholder="Ej.: traer sencillo de S/50, bien heladas 🥶"></textarea></div>' +
        '<div id="fErr"></div></form>';
      var t2 = totals(cust.entrega);
      foot.innerHTML = '<div class="sum"><div class="tot"><span>Total</span><span id="fTot">' + money(t2.total) + '</span></div></div><button class="btn btn-amber btn-block" id="fSend" form="form" type="submit">Confirmar pedido</button>';
      var form = $('#form');
      function upd() {
        var ent = form.entrega.value; $('#dirWrap').hidden = ent === 'recojo';
        $('#fTot').textContent = money(totals(ent).total);
      }
      form.addEventListener('change', upd); upd();
      form.addEventListener('submit', submit);
      if (!cust.cliente) setTimeout(function () { $('#fNom').focus(); }, 450);
    } else renderOk();
  }

  function submit(e) {
    e.preventDefault(); if (S.sending) return;
    var f = e.target, d = {
      cliente: f.cliente.value.trim(), telefono: f.telefono.value.replace(/\D/g, ''), entrega: f.entrega.value,
      direccion: f.direccion.value.trim(), referencia: f.referencia.value.trim(), pago: f.pago.value, nota: f.nota.value.trim()
    };
    var err = d.cliente.length < 2 ? 'Escribe tu nombre.' : d.telefono.length < 9 ? 'Escribe tu celular (9 dígitos).' : d.entrega === 'delivery' && d.direccion.length < 5 ? 'Escribe tu dirección para el delivery.' : '';
    if (err) { $('#fErr').innerHTML = '<div class="err">' + err + '</div>'; buzz(40); return; }
    cust = { cliente: d.cliente, telefono: d.telefono, entrega: d.entrega, direccion: d.direccion, referencia: d.referencia, pago: d.pago };
    save('bh_cliente', cust);
    var btn = $('#fSend'); btn.disabled = true; btn.textContent = 'Enviando…'; S.sending = true;
    d.origen = sessionStorage.getItem('bh_ref') || '';
    d.items = cartLines().map(function (l) { return { id: l.p.id, cant: l.n }; });
    var snapshot = cartLines();
    API.call('crearPedido', d).then(function (r) {
      S.last = { r: r, d: d }; S.cart = {}; save('bh_cart', S.cart); S.step = 'ok';
      buzz([20, 60, 20]); renderSheet(); syncCart(); loadData();
    }).catch(function (x) {
      var m = String(x.message || x);
      var offline = /conexi|fetch|network/i.test(m);
      $('#fErr').innerHTML = '<div class="err">' + esc(offline ? 'No pudimos registrar el pedido (sin conexión).' : m) + '</div>' +
        (offline ? '<a class="btn btn-wa btn-block" style="margin-top:10px" target="_blank" rel="noopener" href="' + waLink(waText(null, d, snapshot)) + '">Enviarlo por WhatsApp igual</a>' : '');
      btn.disabled = false; btn.textContent = 'Confirmar pedido';
    }).then(function () { S.sending = false; });
  }

  function waText(r, d, lines) {
    var items = r ? r.items.map(function (i) { return '- ' + i.cant + ' x ' + i.nombre + ' = ' + money(i.precio * i.cant); })
      : lines.map(function (l) { return '- ' + l.n + ' x ' + l.p.nombre + ' ' + l.p.presentacion + ' = ' + money(l.p.precio * l.n); });
    var t = r || totals(d.entrega);
    var out = ['Hola ' + S.cfg.nombre + ', quiero hacer este pedido:', ''];
    if (r) out.push('*Pedido ' + r.codigo + '*');
    out = out.concat(items, '', 'Subtotal: ' + money(r ? r.subtotal : t.sub), 'Delivery: ' + ((r ? r.delivery : t.del) ? money(r ? r.delivery : t.del) : 'Gratis'), '*Total: ' + money(t.total) + '*', '',
      'Nombre: ' + d.cliente, 'Celular: ' + d.telefono,
      d.entrega === 'recojo' ? 'Entrega: Recojo en tienda' : 'Entrega: Delivery a ' + d.direccion + (d.referencia ? ' (Ref: ' + d.referencia + ')' : ''),
      'Pago: ' + (d.pago === 'yape' ? 'Yape - ya pagué, te envío la captura.' : 'Por coordinar'));
    if (d.nota) out.push('Nota: ' + d.nota);
    return out.join('\n');
  }
  function waLink(text) { return 'https://wa.me/' + S.cfg.whatsapp + '?text=' + encodeURIComponent(text); }

  function renderOk() {
    var r = S.last.r, d = S.last.d, c = S.cfg, body = $('#sheetBody'), foot = $('#sheetFoot');
    var head = '<div class="ok-head"><div class="ok-check">✓</div><h4>¡Pedido registrado!</h4><p>' + (d.pago === 'yape' ? 'Solo falta tu Yape.' : 'Envíalo por WhatsApp para confirmarlo.') + '</p><span class="code">' + esc(r.codigo) + '</span></div>';
    if (d.pago === 'yape') {
      body.innerHTML = head + '<div class="pay-box"><h5>💜 Paga con Yape</h5>' +
        '<button class="yape-go" data-yape="' + esc(c.yapeNumero) + '" data-monto="' + money(r.total) + '"><span class="yg-ico">Y</span><span><b>Abrir Yape y pagar ' + money(r.total) + '</b><small>Copiamos el número de la tienda por ti</small></span></button>' +
        '<div class="pay-row"><div><small>Monto exacto</small><b>' + money(r.total) + '</b></div><button class="copy" data-copy="' + r.total.toFixed(2) + '">Copiar</button></div>' +
        '<div class="pay-row"><div><small>Yape a ' + esc(c.yapeNombre) + '</small><b>' + esc(c.yapeNumero.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')) + '</b></div><button class="copy" data-copy="' + esc(c.yapeNumero) + '">Copiar</button></div>' +
        '<ol class="pay-steps"><li>En Yape toca <b>Yapear</b> → <b>pega</b> el número (ya está copiado).</li><li>Pon el monto <b>' + money(r.total) + '</b> y en el mensaje: <b>' + esc(r.codigo) + '</b>.</li><li>Toca el botón verde y mándanos la captura.</li></ol>' +
        (c.yapeQR ? '<div class="qr"><img src="' + esc(c.yapeQR) + '" alt="QR de Yape"><a href="' + esc(c.yapeQR) + '" download="yape-' + esc(c.nombre) + '.png">⬇ Guardar QR (para escanear desde la galería)</a></div>' : '') +
        '</div>';
      foot.innerHTML = '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + waLink(waText(r, d)) + '">Ya yapeé · enviar captura</a><button class="btn btn-ghost btn-block" data-close>Seguir comprando</button>';
    } else {
      body.innerHTML = head + '<div class="sum" style="padding:14px;border-radius:16px;background:#0f2034">' + r.items.map(function (i) { return '<div><span>' + i.cant + ' × ' + esc(i.nombre) + '</span><span>' + money(i.cant * i.precio) + '</span></div>'; }).join('') +
        '<div><span>Delivery</span><span>' + (r.delivery ? money(r.delivery) : 'Gratis') + '</span></div><div class="tot"><span>Total</span><span>' + money(r.total) + '</span></div></div>';
      foot.innerHTML = '<a class="btn btn-wa btn-block" target="_blank" rel="noopener" href="' + waLink(waText(r, d)) + '">Enviar pedido por WhatsApp</a><button class="btn btn-ghost btn-block" data-close>Seguir comprando</button>';
    }
  }

  /* Yape no permite (para cuentas personales) abrir la app con número y monto ya puestos:
   * copiamos el número, mostramos el monto y abrimos la app directo. */
  function openYape(btn) {
    var num = btn.getAttribute('data-yape'), monto = btn.getAttribute('data-monto');
    var go = function () {
      toast('📋 Número copiado · en Yape: Yapear → pegar → ' + monto);
      buzz(15);
      if (/android/i.test(navigator.userAgent)) {
        setTimeout(function () { location.href = 'intent://#Intent;package=com.bcp.innovacxion.yapeapp;S.browser_fallback_url=' + encodeURIComponent('https://play.google.com/store/apps/details?id=com.bcp.innovacxion.yapeapp') + ';end'; }, 700);
      } else btn.querySelector('small').textContent = 'Número copiado ✓ · abre Yape y pégalo';
    };
    if (navigator.clipboard && isSecureContext) navigator.clipboard.writeText(num).then(go, go); else go();
  }
  function copy(btn) {
    var v = btn.getAttribute('data-copy');
    var done = function () { btn.textContent = '¡Copiado!'; btn.classList.add('done'); buzz(15); setTimeout(function () { btn.textContent = 'Copiar'; btn.classList.remove('done'); }, 1800); };
    if (navigator.clipboard && isSecureContext) navigator.clipboard.writeText(v).then(done, fallback); else fallback();
    function fallback() { var i = document.createElement('textarea'); i.value = v; document.body.appendChild(i); i.select(); try { document.execCommand('copy'); done(); } catch (e) {} i.remove(); }
  }

  /* ---------- arrastrar la hoja para cerrar (celular) ---------- */
  (function () {
    var sh = $('#sheet'), y0 = null, dy = 0;
    function start(e) { if (innerWidth >= 1024) return; y0 = e.touches[0].clientY; dy = 0; sh.classList.add('drag'); }
    function move(e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; }
    function end() { if (y0 == null) return; sh.classList.remove('drag'); y0 = null; if (dy > 110) closeSheet(); else sh.style.transform = ''; }
    [$('#sheetGrab'), $('.sheet-head')].forEach(function (el) { el.addEventListener('touchstart', start, { passive: true }); });
    addEventListener('touchmove', move, { passive: true }); addEventListener('touchend', end);
  })();

  /* ---------- eventos ---------- */
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-add],[data-inc],[data-dec],[data-cat],[data-go],[data-close],[data-copy],[data-yape]');
    if (t && t.hasAttribute('data-yape')) return openYape(t);
    if (!t) return;
    if (t.dataset.add) { var p = S.byId[t.dataset.add]; if (p && p.stock === 0) { toast(p.nombre + ' está agotado'); return; } setQty(t.dataset.add, (S.cart[t.dataset.add] || 0) + 1, t); }
    else if (t.dataset.inc) setQty(t.dataset.inc, (S.cart[t.dataset.inc] || 0) + 1, t.closest('.card') ? t : null);
    else if (t.dataset.dec) setQty(t.dataset.dec, (S.cart[t.dataset.dec] || 0) - 1);
    else if (t.dataset.cat) {
      S.cat = t.dataset.cat; renderCats(); renderGrid();
      var g = $('#catalogo'); if (g.getBoundingClientRect().top < 0 || g.getBoundingClientRect().top > innerHeight * .6) g.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
      var on = $('.cat.on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
    else if (t.dataset.go) { S.step = t.dataset.go; renderSheet(); $('#sheetBody').scrollTop = 0; }
    else if (t.hasAttribute('data-close')) closeSheet();
    else if (t.dataset.copy) copy(t);
  });
  $('#cartBtn').onclick = function () { openSheet('cart'); };
  $('#cartbar').onclick = function () { openSheet('cart'); };
  $('#sheetClose').onclick = function () { closeSheet(); };
  $('#sheetBg').onclick = function () { closeSheet(); };
  $('#sheetBack').onclick = function () { S.step = 'cart'; renderSheet(); };
  $('#openBtn').onclick = openFridge;
  $('#fridge').addEventListener('click', function (e) { if (!e.target.closest('.f-item')) openFridge(); });
  var qt; $('#q').addEventListener('input', function (e) { clearTimeout(qt); qt = setTimeout(function () { S.q = e.target.value.trim(); renderGrid(); }, 120); });
  addEventListener('keydown', function (e) { if (e.key === 'Escape' && $('#sheet').classList.contains('on')) closeSheet(); });

  /* ---------- inicio ---------- */
  loadData();
  /* la exhibidora se abre sola cuando aparece en pantalla (después de destapar) */
  Intro.ready(function () {
    if (!('IntersectionObserver' in window)) return openFridge();
    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { io.disconnect(); setTimeout(openFridge, reduced ? 0 : 250); }
    }, { threshold: .35 });
    io.observe($('#fridge'));
  });
})();
