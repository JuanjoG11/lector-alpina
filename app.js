// ============================================================
//  RIEL SCANNER - app.js
//  Cámara: ZXing  |  BD: Supabase
// ============================================================

const SUPA_URL = 'https://aylfgwyoxvplfegshewv.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF5bGZnd3lveHZwbGZlZ3NoZXd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3NTQ0MzYsImV4cCI6MjEwMDMzMDQzNn0.MMjgt35jrLB4tdTGIFqTvbzqniyQ1C4EGghAiokipfA';
const SCAN_KEY = 'riel_escaneos_v2';

let codeReader = null;
let scanning   = false;
let lastCode   = '';
let lastScanTs = 0;
const DEBOUNCE = 2500; // ms entre lecturas del mismo código

// ============================================================
//  CÁMARA
// ============================================================
async function startCamera() {
  if (scanning) return;

  // Inicializar ZXing
  codeReader = new ZXing.BrowserMultiFormatReader();

  document.getElementById('cam-overlay').classList.add('hidden');
  document.getElementById('scan-line').style.display = 'block';
  document.getElementById('btn-start').disabled = true;
  document.getElementById('btn-stop').disabled  = false;

  try {
    // Seleccionar cámara trasera si existe
    const devices = await ZXing.BrowserMultiFormatReader.listVideoInputDevices();
    const back = devices.find(d =>
      /back|rear|environment/i.test(d.label)
    ) || devices[devices.length - 1];

    const deviceId = back ? back.deviceId : undefined;

    await codeReader.decodeFromVideoDevice(deviceId, 'video', (result, err) => {
      if (!result) return;
      const code = result.getText();
      const now  = Date.now();
      // Debounce: ignorar el mismo código si se leyó hace menos de DEBOUNCE ms
      if (code === lastCode && (now - lastScanTs) < DEBOUNCE) return;
      lastCode   = code;
      lastScanTs = now;
      processScan(code);
    });

    scanning = true;
  } catch (e) {
    showOverlay('No se pudo acceder a la cámara. Verificá los permisos.');
    resetCameraUI();
  }
}

function stopCamera() {
  if (codeReader) {
    codeReader.reset();
    codeReader = null;
  }
  scanning = false;
  resetCameraUI();
  showOverlay('Cámara detenida. Presioná Activar para volver a escanear.');
}

function resetCameraUI() {
  document.getElementById('btn-start').disabled = false;
  document.getElementById('btn-stop').disabled  = true;
  document.getElementById('scan-line').style.display = 'none';
}

function showOverlay(msg) {
  const o = document.getElementById('cam-overlay');
  o.classList.remove('hidden');
  o.querySelector('p').innerHTML = msg;
}

// ============================================================
//  MANUAL
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('manual-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); manualScan(); }
  });
  updateStats();
});

function manualScan() {
  const input = document.getElementById('manual-input');
  const code  = input.value.trim();
  if (!code) { showToast('Ingresá un código', 'error'); return; }
  input.value = '';
  processScan(code);
}

// ============================================================
//  ESCANEO PRINCIPAL
// ============================================================
async function processScan(code) {
  setLoading(true);
  hideResult();

  let pedido;
  try {
    pedido = await buscarPedido(code);
  } catch (e) {
    setLoading(false);
    showResult({
      tipo: 'error',
      cliente: `Código: ${code}`,
      badge: '❌ Sin conexión',
      meta: 'No se pudo conectar a Supabase',
      productos: [],
    });
    showToast('Error de red', 'error');
    return;
  }

  setLoading(false);

  if (!pedido) {
    vibrate([200, 100, 200]);
    showResult({
      tipo: 'error',
      cliente: code,
      badge: '❌ No encontrado',
      meta: 'El código no está en la base de pedidos',
      productos: [],
    });
    showToast('Código no encontrado', 'error');
    return;
  }

  const yaEscaneado = wasScannedToday(code);
  saveEscaneo(code, pedido);
  updateStats();

  showResult({
    tipo:      yaEscaneado ? 'warning' : 'ok',
    cliente:   pedido.cliente || pedido.nroFactura,
    badge:     yaEscaneado ? '⚠️ Ya escaneado' : '✅ Registrado',
    meta:      [
      pedido.factura   ? `Fact. ${pedido.factura}`      : '',
      pedido.nroFactura? `Nº ${pedido.nroFactura}`       : '',
      pedido.ruta      ? `Ruta ${pedido.ruta}`           : '',
      pedido.zona      ? `Zona ${pedido.zona}`           : '',
      pedido.ordCompra ? `OC ${pedido.ordCompra}`        : '',
    ].filter(Boolean).join('  ·  '),
    productos: pedido.productos,
  });

  if (!yaEscaneado) { vibrate([80]); showToast('✅ Pedido registrado', 'success'); }
  else              { vibrate([50,50,50]); showToast('⚠️ Ya fue escaneado hoy', 'warning'); }
}

// ============================================================
//  SUPABASE
// ============================================================
async function buscarPedido(codigo) {
  // 1. Buscar por código de barras
  let rows = await supaGet(
    `pedidos?codigo_barras=eq.${encodeURIComponent(codigo)}&select=*&limit=1`
  );

  // 2. Si no encontró, intentar por nro_factura
  if (!rows || rows.length === 0) {
    rows = await supaGet(
      `pedidos?nro_factura=eq.${encodeURIComponent(codigo)}&select=*&limit=1`
    );
  }

  if (!rows || rows.length === 0) return null;

  // Traer todos los productos de esa factura
  const nro  = rows[0].nro_factura;
  const todo = await supaGet(
    `pedidos?nro_factura=eq.${encodeURIComponent(nro)}&select=*`
  );
  return buildPedido(todo);
}

function buildPedido(rows) {
  if (!rows || rows.length === 0) return null;
  const b = rows[0];
  return {
    nroFactura: b.nro_factura,
    factura:    b.factura,
    cliente:    b.cliente || b.negocio || b.nro_factura,
    ruta:       b.ruta,
    zona:       b.zona,
    ordCompra:  b.ord_compra,
    productos:  rows.map(r => ({
      codigoBarras: r.codigo_barras,
      codProducto:  r.cod_producto,
      nombre:       r.producto,
      cantidad:     r.cantidad,
    })),
  };
}

async function supaGet(path) {
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: {
      'apikey':        SUPA_KEY,
      'Authorization': `Bearer ${SUPA_KEY}`,
    },
  });
  if (!r.ok) throw new Error(r.statusText);
  return r.json();
}

// ============================================================
//  UI
// ============================================================
function setLoading(on) {
  document.getElementById('loading').classList.toggle('hidden', !on);
}

function hideResult() {
  document.getElementById('result-card').classList.add('hidden');
}

function showResult({ tipo, cliente, badge, meta, productos }) {
  const card = document.getElementById('result-card');
  card.className = `result-card${tipo === 'error' ? ' error' : tipo === 'warning' ? ' warning' : ''}`;

  document.getElementById('res-cliente').textContent = cliente;

  const b = document.getElementById('res-badge');
  b.textContent = badge;
  b.className   = `result-badge${tipo === 'error' ? ' error' : tipo === 'warning' ? ' warning' : ''}`;

  document.getElementById('res-meta').textContent = meta;

  const list = document.getElementById('res-products');
  list.innerHTML = '';
  if (!productos || productos.length === 0) {
    list.innerHTML = '<li style="color:var(--muted)">Sin productos</li>';
  } else {
    productos.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `<span><span class="prod-code">[${p.codProducto || ''}]</span>${p.nombre}</span>
                      <span class="prod-qty">x${p.cantidad}</span>`;
      list.appendChild(li);
    });
  }

  document.getElementById('res-time').textContent =
    new Date().toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  card.classList.remove('hidden');
}

// ============================================================
//  STORAGE LOCAL
// ============================================================
function loadEscaneos() {
  try { return JSON.parse(localStorage.getItem(SCAN_KEY) || '[]'); } catch { return []; }
}

function saveEscaneo(code, pedido) {
  const arr = loadEscaneos();
  arr.unshift({
    id:         Date.now(),
    code,
    nroFactura: pedido.nroFactura,
    factura:    pedido.factura,
    cliente:    pedido.cliente,
    ruta:       pedido.ruta,
    zona:       pedido.zona,
    productos:  pedido.productos,
    timestamp:  new Date().toISOString(),
  });
  localStorage.setItem(SCAN_KEY, JSON.stringify(arr.slice(0, 500)));
}

function wasScannedToday(code) {
  const today = todayStr();
  return loadEscaneos().some(r => r.code === code && r.timestamp.startsWith(today));
}

function updateStats() {
  const today = todayStr();
  const hoy   = loadEscaneos().filter(r => r.timestamp.startsWith(today));
  document.getElementById('stat-hoy').textContent  = hoy.length;
  document.getElementById('stat-last').textContent =
    hoy.length ? hoy[0].cliente?.substring(0, 10) || '—' : '—';
}

// ============================================================
//  HISTORIAL
// ============================================================
function toggleHistory() {
  const wrap = document.getElementById('history-wrap');
  const open = wrap.classList.toggle('open');
  if (open) renderHistory();
}

function renderHistory() {
  const today = todayStr();
  const data  = loadEscaneos().filter(r => r.timestamp.startsWith(today));
  const list  = document.getElementById('history-list');

  if (data.length === 0) {
    list.innerHTML = '<div class="empty">📭 Sin escaneos hoy</div>';
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="hist-item">
      <div class="hist-top">
        <span class="hist-cliente">${r.cliente || r.nroFactura}</span>
        <span class="hist-time">${fmtTime(r.timestamp)}</span>
      </div>
      <div class="hist-meta">Fact. ${r.factura||''} · Nº ${r.nroFactura||''} · ${r.ruta||''}</div>
      <div class="hist-meta" style="margin-top:4px">
        ${(r.productos||[]).map(p=>`${p.nombre} x${p.cantidad}`).join(' · ')}
      </div>
    </div>`).join('');
}

// ============================================================
//  UTILS
// ============================================================
function todayStr() { return new Date().toISOString().slice(0, 10); }

function fmtTime(iso) {
  return new Date(iso).toLocaleString('es-AR', {
    day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'
  });
}

function vibrate(p) { try { navigator.vibrate && navigator.vibrate(p); } catch {} }

let _tt;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className   = `toast ${type}`;
  clearTimeout(_tt);
  _tt = setTimeout(() => t.classList.add('hidden'), 2800);
}
