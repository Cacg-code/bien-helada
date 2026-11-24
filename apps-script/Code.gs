/* Code.gs — Base de datos en Google Sheets para "Bien Helada".
 * 1) Pega también js/core.js en un archivo llamado Core.gs (tal cual).
 * 2) Ejecuta setup() una vez (acepta los permisos).
 * 3) Implementar > Nueva implementación > App web > Ejecutar como: yo · Acceso: cualquier usuario.
 */
var P_COLS = ['id', 'nombre', 'categoria', 'forma', 'presentacion', 'descripcion', 'precio', 'costo', 'stock', 'color', 'vidrio', 'etiqueta', 'imagen', 'activo', 'destacado', 'orden'];
var O_COLS = ['id', 'fecha', 'estado', 'cliente', 'telefono', 'entrega', 'direccion', 'referencia', 'pago', 'origen', 'detalle', 'subtotal', 'delivery', 'total', 'costo', 'ganancia', 'nota', 'items'];
var TEXT_O = ['id', 'fecha', 'telefono'];

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function props_() { return PropertiesService.getScriptProperties(); }

function sheet_(name, cols) {
  var sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold').setBackground('#0b1a2c').setFontColor('#8fe3ff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name, cols) {
  var sh = sheet_(name, cols), n = sh.getLastRow() - 1;
  if (n < 1) return [];
  var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return sh.getRange(2, 1, n, head.length).getValues().map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { var v = r[j]; o[h] = v instanceof Date ? v.toISOString() : v; });
    return o;
  });
}
function findRow_(name, cols, id) {
  var sh = sheet_(name, cols), n = sh.getLastRow() - 1;
  if (n < 1) return 0;
  var ids = sh.getRange(2, 1, n, 1).getDisplayValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function write_(name, cols, obj, row) {
  var sh = sheet_(name, cols);
  var vals = cols.map(function (c) {
    var v = obj[c];
    if (c === 'items') return JSON.stringify(v || []);
    if (v === undefined || v === null) return '';
    return v;
  });
  if (!row) row = sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, cols.length).setValues([vals]);
}

var DB = {
  getProducts: function () { return rows_('Productos', P_COLS); },
  saveProduct: function (p) { write_('Productos', P_COLS, p, findRow_('Productos', P_COLS, p.id)); },
  deleteProduct: function (id) { var r = findRow_('Productos', P_COLS, id); if (r) sheet_('Productos', P_COLS).deleteRow(r); },
  getOrders: function () { return rows_('Pedidos', O_COLS); },
  addOrder: function (o) { write_('Pedidos', O_COLS, o, 0); },
  saveOrder: function (o) { var r = findRow_('Pedidos', O_COLS, o.id); if (r) write_('Pedidos', O_COLS, o, r); },
  getConfig: function () {
    var o = {};
    rows_('Config', ['clave', 'valor']).forEach(function (r) { if (r.clave) o[r.clave] = r.valor; });
    return o;
  },
  saveConfig: function (c) {
    var sh = sheet_('Config', ['clave', 'valor']), keys = Object.keys(c);
    if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 2).clearContent();
    sh.getRange(2, 1, keys.length, 2).setNumberFormat('@').setValues(keys.map(function (k) { return [k, String(c[k])]; }));
  },
  nextSeq: function () { var n = Number(props_().getProperty('SEQ') || 0) + 1; props_().setProperty('SEQ', String(n)); return n; },
  checkPassword: function (pw) {
    var ok = pw && pw === props_().getProperty('ADMIN_PASSWORD');
    if (!ok) Utilities.sleep(1000);
    return ok;
  },
  setPassword: function (pw) {
    if (String(pw).length < 6) throw new Error('La clave debe tener al menos 6 caracteres.');
    props_().setProperty('ADMIN_PASSWORD', String(pw));
    props_().setProperty('TOKEN_SECRET', Utilities.getUuid()); // cierra sesiones viejas
  },
  sign: function (exp) { return exp + '.' + hmac_(String(exp)); },
  verify: function (t) {
    var p = String(t).split('.');
    return p.length === 2 && Number(p[0]) > Date.now() && p[1] === hmac_(p[0]);
  },
  lock: function (fn) {
    var l = LockService.getScriptLock();
    l.waitLock(20000);
    try { var r = fn(); SpreadsheetApp.flush(); return r; } finally { l.releaseLock(); }
  },
  now: function () { return new Date(); }
};

function hmac_(s) {
  var b = Utilities.computeHmacSha256Signature(s, props_().getProperty('TOKEN_SECRET'));
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '');
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents || '{}');
    return json_({ ok: true, data: Core.create(DB).handle(String(d.action || ''), d) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}
function doGet(e) {
  // Prueba rápida en el navegador: <URL>?action=catalogo
  try {
    var a = (e && e.parameter && e.parameter.action) || 'catalogo';
    if (a !== 'catalogo') throw new Error('Solo catálogo por GET.');
    return json_({ ok: true, data: Core.create(DB).handle('catalogo', {}) });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

/* ---------- Ejecutar UNA vez ---------- */
function setup() {
  var pr = sheet_('Productos', P_COLS), pe = sheet_('Pedidos', O_COLS), cf = sheet_('Config', ['clave', 'valor']);
  pr.getRange('A:A').setNumberFormat('@');
  TEXT_O.forEach(function (c) { var i = O_COLS.indexOf(c) + 1; pe.getRange(1, i, pe.getMaxRows(), 1).setNumberFormat('@'); });
  cf.getRange('A:B').setNumberFormat('@');
  if (pr.getLastRow() < 2) Core.SEED.forEach(function (p) { DB.saveProduct(p); });
  if (cf.getLastRow() < 2) DB.saveConfig(Core.DEF_CFG);
  var p = props_();
  if (!p.getProperty('ADMIN_PASSWORD')) p.setProperty('ADMIN_PASSWORD', 'cambiar123');
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('SEQ')) p.setProperty('SEQ', '0');
  var hoja1 = ss_().getSheetByName('Hoja 1') || ss_().getSheetByName('Sheet1');
  if (hoja1 && ss_().getSheets().length > 3) ss_().deleteSheet(hoja1);
  pe.setColumnWidth(O_COLS.indexOf('items') + 1, 80);
  Logger.log('Listo. Clave inicial: cambiar123 (cámbiala en el panel > Ajustes).');
}

/* Si olvidas la clave: edita aquí, ejecuta y borra la clave del código. */
function resetClave() { DB.setPassword('cambiar123'); Logger.log('Clave reiniciada a cambiar123'); }
