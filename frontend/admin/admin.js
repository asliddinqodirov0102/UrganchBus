/**
 * admin.js — Urganch Bus Admin Panel logikasi
 * Login, dashboard, CRUD operatsiyalar, modal, toast
 */

'use strict';

// ─── Admin API manzili ────────────────────────────────────────────────────────
// Lokal: http://127.0.0.1:5000/api/admin
// Production (Render): https://urganch-bus-backend.onrender.com/api/admin
const BASE_ORIGIN = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:5000'
  : window.location.origin;
const API = BASE_ORIGIN + '/api/admin';

// ─── Global holat ─────────────────────────────────────────────────────────────
let routesData    = [];
let stopsData     = [];
let busesData     = [];
let schedulesData = [];
let currentSection = 'dashboard';
let editTarget    = null;   // { type:'route'|'stop'|'bus'|'schedule', id }
let deleteTarget  = null;

// ─── Umumiy fetch yordamchi ───────────────────────────────────────────────────
async function api(method, endpoint, body = null) {
  const opts = {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + endpoint, opts);
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TOAST XABARNOMALAR
// ═══════════════════════════════════════════════════════════════════════════════
function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  el.innerHTML = `<span>${icons[type] || '✅'}</span><span>${msg}</span>`;
  container.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.35s ease forwards';
    setTimeout(() => el.remove(), 350);
  }, 3500);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MODAL BOSHQARUVI
// ═══════════════════════════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
function closeAllModals() {
  document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
  editTarget = null; deleteTarget = null;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  LOGIN / LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════
async function doLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const btn      = document.getElementById('loginBtn');
  const errEl    = document.getElementById('loginError');

  btn.disabled = true;
  btn.textContent = 'Tekshirilmoqda...';
  errEl.classList.remove('show');

  const { ok, data } = await api('POST', '/login', { username, password });

  btn.disabled = false;
  btn.textContent = 'Kirish';

  if (ok && data.success) {
    showAdminApp();
    loadDashboard();
  } else {
    errEl.textContent = data.message || 'Xato yuz berdi';
    errEl.classList.add('show');
  }
}

async function doLogout() {
  await api('POST', '/logout');
  document.getElementById('adminApp').classList.remove('visible');
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('loginPassword').value = '';
}

function showAdminApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminApp').classList.add('visible');
}

async function checkSession() {
  try {
    const { data } = await api('GET', '/check');
    if (data.logged_in) {
      showAdminApp();
      loadDashboard();
    }
  } catch { /* Offline — login ko'rsatiladi */ }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  NAVIGATSIYA
// ═══════════════════════════════════════════════════════════════════════════════
function navigate(section) {
  currentSection = section;

  // Nav items
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Sahifalar
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${section}`);
  });

  // Topbar sarlavha
  const titles = {
    dashboard: '📊 Dashboard',
    routes:    '🗺 Yo\'nalishlar',
    stops:     '🚏 Bekatlar',
    buses:     '🚌 Avtobuslar',
    schedule:  '📅 Jadvallar',
  };
  document.getElementById('topbarTitle').textContent = titles[section] || section;

  // Sahifa ma'lumotlari
  const loaders = {
    dashboard: loadDashboard,
    routes:    loadRoutes,
    stops:     loadStops,
    buses:     loadBuses,
    schedule:  loadSchedules,
  };
  if (loaders[section]) loaders[section]();

  // Mobile sidebar yopish
  document.querySelector('.sidebar').classList.remove('open');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
async function loadDashboard() {
  const { ok, data } = await api('GET', '/stats');
  if (!ok) return;

  document.getElementById('statRoutes').textContent    = data.total_routes;
  document.getElementById('statActive').textContent    = data.active_routes;
  document.getElementById('statStops').textContent     = data.total_stops;
  document.getElementById('statBuses').textContent     = data.total_buses;
  document.getElementById('statSchedules').textContent = data.total_schedules;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  YO'NALISHLAR
// ═══════════════════════════════════════════════════════════════════════════════
async function loadRoutes() {
  const tbody = document.getElementById('routesTbody');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state"><div class="empty-state-icon">⏳</div></td></tr>';

  const { ok, data } = await api('GET', '/routes');
  if (!ok) { toast('Yo\'nalishlarni yuklashda xato', 'error'); return; }
  routesData = data;

  // Nav badge yangilash
  document.querySelector('[data-section="routes"] .nav-badge').textContent = data.length;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="7">
      <div class="empty-state"><div class="empty-state-icon">🗺</div>
      <div class="empty-state-text">Hali yo'nalish kiritilmagan</div></div>
    </td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => `
    <tr>
      <td>
        <span class="route-chip" style="background:${r.color}">
          ${r.number}
        </span>
      </td>
      <td style="font-weight:600">${r.name}</td>
      <td style="max-width:180px;color:var(--text-mid);font-size:0.80rem;">${r.description || '—'}</td>
      <td>
        <span style="display:flex;align-items:center;gap:6px;">
          <span class="color-dot" style="background:${r.color}"></span>
          <code style="font-size:0.75rem">${r.color}</code>
        </span>
      </td>
      <td><span style="font-weight:700">${r.stop_count}</span> ta</td>
      <td>
        <span class="badge ${r.is_active ? 'badge-green' : 'badge-red'}">
          ${r.is_active ? '✓ Faol' : '✗ Nofaol'}
        </span>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="toggleRoute(${r.id},${r.is_active})" title="${r.is_active ? 'Nofaol qilish' : 'Faol qilish'}">
            ${r.is_active ? '⏸' : '▶'}
          </button>
          <button class="btn btn-warning btn-sm" onclick="editRoute(${r.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('route',${r.id},'${r.name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddRouteModal() {
  editTarget = null;
  document.getElementById('routeModalTitle').textContent = '➕ Yangi Yo\'nalish';
  document.getElementById('routeForm').reset();
  document.getElementById('routeColor').value = '#3B82F6';
  openModal('routeModal');
}

function editRoute(id) {
  const r = routesData.find(x => x.id === id);
  if (!r) return;
  editTarget = { type: 'route', id };
  document.getElementById('routeModalTitle').textContent = `✏️ Tahrirlash — Yo'nalish #${r.number}`;
  document.getElementById('routeNumber').value      = r.number;
  document.getElementById('routeName').value        = r.name;
  document.getElementById('routeColor').value       = r.color;
  document.getElementById('routeDesc').value        = r.description || '';
  openModal('routeModal');
}

async function saveRoute() {
  const body = {
    number:      document.getElementById('routeNumber').value.trim(),
    name:        document.getElementById('routeName').value.trim(),
    color:       document.getElementById('routeColor').value,
    description: document.getElementById('routeDesc').value.trim(),
  };
  if (!body.number || !body.name) { toast('Raqam va nom majburiy!', 'error'); return; }

  const { ok, data } = editTarget
    ? await api('PUT',  `/routes/${editTarget.id}`, body)
    : await api('POST', '/routes', body);

  if (ok) {
    toast(editTarget ? 'Yo\'nalish yangilandi ✅' : 'Yangi yo\'nalish qo\'shildi ✅');
    closeAllModals();
    loadRoutes();
    loadDashboard();
  } else {
    toast(data.error || 'Xato', 'error');
  }
}

async function toggleRoute(id, currentActive) {
  const { ok, data } = await api('POST', `/routes/${id}/toggle`);
  if (ok) {
    toast(data.is_active ? 'Yo\'nalish faollashtirildi ▶' : 'Yo\'nalish to\'xtatildi ⏸');
    loadRoutes();
    loadDashboard();
  } else {
    toast('Xato yuz berdi', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BEKATLAR
// ═══════════════════════════════════════════════════════════════════════════════
async function loadStops() {
  const tbody = document.getElementById('stopsTbody');
  tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">⏳</div></div></td></tr>';

  const [stopsRes, routesRes] = await Promise.all([
    api('GET', '/stops'),
    api('GET', '/routes'),
  ]);
  stopsData  = stopsRes.data;
  routesData = routesRes.data;

  // Bekat qo'shish modal uchun route select yangilash
  populateRouteSelect('stopRouteId');

  document.querySelector('[data-section="stops"] .nav-badge').textContent = stopsData.length;

  if (!stopsData.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state">
      <div class="empty-state-icon">🚏</div>
      <div class="empty-state-text">Bekat kiritilmagan</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = stopsData.map(s => `
    <tr>
      <td>${s.id}</td>
      <td style="font-weight:600">${s.name}</td>
      <td>
        <span class="route-chip" style="background:${s.route_color}; font-size:.72rem">
          #${s.route_number}
        </span>
        <span style="font-size:.8rem;color:var(--text-mid);margin-left:6px;">${s.route_name}</span>
      </td>
      <td style="font-size:.78rem;font-family:monospace;color:var(--text-mid)">
        ${parseFloat(s.lat).toFixed(4)}
      </td>
      <td style="font-size:.78rem;font-family:monospace;color:var(--text-mid)">
        ${parseFloat(s.lng).toFixed(4)}
      </td>
      <td style="font-weight:700;color:var(--blue)">${s.order_num + 1}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-warning btn-sm" onclick="editStop(${s.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('stop',${s.id},'${s.name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddStopModal() {
  editTarget = null;
  document.getElementById('stopModalTitle').textContent = '➕ Yangi Bekat';
  document.getElementById('stopForm').reset();
  populateRouteSelect('stopRouteId');
  openModal('stopModal');
}

function editStop(id) {
  const s = stopsData.find(x => x.id === id);
  if (!s) return;
  editTarget = { type: 'stop', id };
  document.getElementById('stopModalTitle').textContent = `✏️ Tahrirlash — ${s.name}`;
  document.getElementById('stopRouteId').value  = s.route_id;
  document.getElementById('stopName').value     = s.name;
  document.getElementById('stopLat').value      = s.lat;
  document.getElementById('stopLng').value      = s.lng;
  document.getElementById('stopOrder').value    = s.order_num;
  openModal('stopModal');
}

async function saveStop() {
  const body = {
    route_id:  parseInt(document.getElementById('stopRouteId').value),
    name:      document.getElementById('stopName').value.trim(),
    lat:       parseFloat(document.getElementById('stopLat').value),
    lng:       parseFloat(document.getElementById('stopLng').value),
    order_num: parseInt(document.getElementById('stopOrder').value) || 0,
  };
  if (!body.name || !body.route_id || isNaN(body.lat) || isNaN(body.lng)) {
    toast('Barcha maydonlarni to\'ldiring!', 'error');
    return;
  }
  const { ok, data } = editTarget
    ? await api('PUT',  `/stops/${editTarget.id}`, body)
    : await api('POST', '/stops', body);

  if (ok) {
    toast(editTarget ? 'Bekat yangilandi ✅' : 'Yangi bekat qo\'shildi ✅');
    closeAllModals();
    loadStops();
    loadDashboard();
  } else {
    toast(data.error || 'Xato', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AVTOBUSLAR
// ═══════════════════════════════════════════════════════════════════════════════
async function loadBuses() {
  const tbody = document.getElementById('busesTbody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">⏳</div></div></td></tr>';

  const [busRes, routesRes] = await Promise.all([
    api('GET', '/buses'),
    api('GET', '/routes'),
  ]);
  busesData  = busRes.data;
  routesData = routesRes.data;
  populateRouteSelect('busRouteId');

  document.querySelector('[data-section="buses"] .nav-badge').textContent = busesData.length;

  if (!busesData.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <div class="empty-state-icon">🚌</div>
      <div class="empty-state-text">Avtobus kiritilmagan</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = busesData.map(b => `
    <tr>
      <td style="font-weight:700;font-family:monospace">${b.plate_number}</td>
      <td>
        <span class="route-chip" style="background:${b.route_color}; font-size:.72rem">
          #${b.route_number}
        </span>
        <span style="font-size:.8rem;color:var(--text-mid);margin-left:6px">${b.route_name}</span>
      </td>
      <td>
        <span class="badge badge-blue">${b.capacity} o'rin</span>
      </td>
      <td>
        <span class="badge badge-green">🟢 Faol</span>
      </td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-warning btn-sm" onclick="editBus(${b.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('bus',${b.id},'${b.plate_number}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddBusModal() {
  editTarget = null;
  document.getElementById('busModalTitle').textContent = '➕ Yangi Avtobus';
  document.getElementById('busForm').reset();
  document.getElementById('busCapacity').value = 45;
  populateRouteSelect('busRouteId');
  openModal('busModal');
}

function editBus(id) {
  const b = busesData.find(x => x.id === id);
  if (!b) return;
  editTarget = { type: 'bus', id };
  document.getElementById('busModalTitle').textContent  = `✏️ Tahrirlash — ${b.plate_number}`;
  document.getElementById('busRouteId').value           = b.route_id;
  document.getElementById('busPlate').value             = b.plate_number;
  document.getElementById('busCapacity').value          = b.capacity;
  openModal('busModal');
}

async function saveBus() {
  const body = {
    route_id:     parseInt(document.getElementById('busRouteId').value),
    plate_number: document.getElementById('busPlate').value.trim().toUpperCase(),
    capacity:     parseInt(document.getElementById('busCapacity').value) || 45,
  };
  if (!body.plate_number || !body.route_id) {
    toast('Yo\'nalish va davlat raqami majburiy!', 'error');
    return;
  }
  const { ok, data } = editTarget
    ? await api('PUT',  `/buses/${editTarget.id}`, body)
    : await api('POST', '/buses', body);

  if (ok) {
    toast(editTarget ? 'Avtobus yangilandi ✅' : 'Yangi avtobus qo\'shildi ✅');
    closeAllModals();
    loadBuses();
    loadDashboard();
  } else {
    toast(data.error || 'Xato', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JADVALLAR
// ═══════════════════════════════════════════════════════════════════════════════
async function loadSchedules() {
  const tbody = document.getElementById('scheduleTbody');
  tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">⏳</div></div></td></tr>';

  const routeFilter = document.getElementById('scheduleRouteFilter')?.value;
  const endpoint = routeFilter ? `/schedules?route_id=${routeFilter}` : '/schedules';

  const [scRes, routesRes, busRes, stopsRes] = await Promise.all([
    api('GET', endpoint),
    api('GET', '/routes'),
    api('GET', '/buses'),
    api('GET', '/stops'),
  ]);
  schedulesData = scRes.data;
  routesData    = routesRes.data;
  busesData     = busRes.data;
  stopsData     = stopsRes.data;

  // Filter va formlar uchun selectlar
  populateRouteSelect('scheduleRouteFilter', true);
  populateRouteSelect('scRouteId');
  if (routeFilter) document.getElementById('scheduleRouteFilter').value = routeFilter;

  document.querySelector('[data-section="schedule"] .nav-badge').textContent = schedulesData.length;

  if (!schedulesData.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state">
      <div class="empty-state-icon">📅</div>
      <div class="empty-state-text">Jadval kiritilmagan</div>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = schedulesData.map(sc => `
    <tr>
      <td>
        <span class="route-chip" style="background:${sc.route_color}; font-size:.72rem">
          #${sc.route_number}
        </span>
      </td>
      <td style="font-weight:700;color:var(--blue);font-size:1rem;letter-spacing:.5px">
        ${sc.depart_time}
      </td>
      <td style="font-size:.82rem">${sc.stop_name}
        <span style="font-size:.68rem;color:var(--text-light)"> (#${sc.stop_order + 1})</span>
      </td>
      <td style="font-family:monospace;font-size:.80rem">${sc.plate_number}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-warning btn-sm" onclick="editSchedule(${sc.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="confirmDelete('schedule',${sc.id},'${sc.depart_time} — ${sc.stop_name.replace(/'/g,"\\'")}')">🗑</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddScheduleModal() {
  editTarget = null;
  document.getElementById('scModalTitle').textContent = '➕ Yangi Jadval';
  document.getElementById('scForm').reset();
  populateRouteSelect('scRouteId');
  openModal('scModal');
}

function editSchedule(id) {
  const sc = schedulesData.find(x => x.id === id);
  if (!sc) return;
  editTarget = { type: 'schedule', id };
  document.getElementById('scModalTitle').textContent = `✏️ Tahrirlash — ${sc.depart_time}`;
  document.getElementById('scRouteId').value   = sc.route_id;
  document.getElementById('scDepartTime').value = sc.depart_time;
  populateBusSelect(sc.route_id);
  populateStopSelect(sc.route_id);
  setTimeout(() => {
    document.getElementById('scBusId').value  = sc.bus_id;
    document.getElementById('scStopId').value = sc.stop_id;
  }, 100);
  openModal('scModal');
}

async function saveSchedule() {
  const body = {
    route_id:   parseInt(document.getElementById('scRouteId').value),
    bus_id:     parseInt(document.getElementById('scBusId').value),
    stop_id:    parseInt(document.getElementById('scStopId').value),
    depart_time: document.getElementById('scDepartTime').value,
  };
  if (!body.route_id || !body.bus_id || !body.stop_id || !body.depart_time) {
    toast('Barcha maydonlarni to\'ldiring!', 'error');
    return;
  }
  const { ok, data } = editTarget
    ? await api('PUT',  `/schedules/${editTarget.id}`, body)
    : await api('POST', '/schedules', body);

  if (ok) {
    toast(editTarget ? 'Jadval yangilandi ✅' : 'Yangi jadval qo\'shildi ✅');
    closeAllModals();
    loadSchedules();
    loadDashboard();
  } else {
    toast(data.error || 'Xato', 'error');
  }
}

// ── Jadval modali: yo'nalish o'zgarganda bus/stop select yangilash ──
function onScRouteChange() {
  const routeId = parseInt(document.getElementById('scRouteId').value);
  populateBusSelect(routeId);
  populateStopSelect(routeId);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  O'CHIRISH TASDIQLASH
// ═══════════════════════════════════════════════════════════════════════════════
function confirmDelete(type, id, name) {
  deleteTarget = { type, id };
  const labels = { route:'yo\'nalish', stop:'bekat', bus:'avtobus', schedule:'jadval' };
  document.getElementById('confirmText').innerHTML =
    `<strong>${name}</strong> nomli ${labels[type]}ni o'chirmoqchimisiz?<br>
     <span style="color:var(--red);font-size:.8rem">⚠️ Bu amalni qaytarib bo'lmaydi!</span>`;
  openModal('confirmModal');
}

async function doDelete() {
  if (!deleteTarget) return;
  const endpoints = {
    route:    `/routes/${deleteTarget.id}`,
    stop:     `/stops/${deleteTarget.id}`,
    bus:      `/buses/${deleteTarget.id}`,
    schedule: `/schedules/${deleteTarget.id}`,
  };
  const { ok, data } = await api('DELETE', endpoints[deleteTarget.type]);
  closeAllModals();
  if (ok) {
    toast('Muvaffaqiyatli o\'chirildi 🗑');
    const reloaders = { route:loadRoutes, stop:loadStops, bus:loadBuses, schedule:loadSchedules };
    reloaders[deleteTarget.type]?.();
    loadDashboard();
  } else {
    toast(data.error || 'O\'chirishda xato', 'error');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  YORDAMCHI: SELECT POPULYATSIYA
// ═══════════════════════════════════════════════════════════════════════════════
function populateRouteSelect(selectId, withAll = false) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = withAll
    ? '<option value="">— Barchasi —</option>'
    : '<option value="">— Yo\'nalish tanlang —</option>';
  routesData.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `#${r.number} — ${r.name}`;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

function populateBusSelect(routeId) {
  const sel = document.getElementById('scBusId');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Avtobus tanlang —</option>';
  busesData
    .filter(b => !routeId || b.route_id === routeId)
    .forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.plate_number;
      sel.appendChild(opt);
    });
}

function populateStopSelect(routeId) {
  const sel = document.getElementById('scStopId');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Bekat tanlang —</option>';
  stopsData
    .filter(s => !routeId || s.route_id === routeId)
    .sort((a, b) => a.order_num - b.order_num)
    .forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.order_num + 1}. ${s.name}`;
      sel.appendChild(opt);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  BOSHLASH
// ═══════════════════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  // Sessiyani tekshirish
  checkSession();

  // Login forma
  document.getElementById('loginForm').addEventListener('submit', doLogin);

  // Enter tugmasi
  document.getElementById('loginPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
  });

  // Navigatsiya
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const section = item.dataset.section;
      if (section) navigate(section);
    });
  });

  // Mobile sidebar
  document.getElementById('mobileToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // Logout
  document.getElementById('logoutBtn').addEventListener('click', doDelete);
  // Yo'nalish log out tugmasi alohida
  document.querySelector('.logout-btn').addEventListener('click', doLogout);

  // Modal yopish (overlay ustiga bosish)
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeAllModals();
    });
  });

  // Jadval filter
  document.getElementById('scheduleRouteFilter')?.addEventListener('change', loadSchedules);
});

// Global funksiyalar (HTML onclick uchun)
window.editRoute        = editRoute;
window.toggleRoute      = toggleRoute;
window.editStop         = editStop;
window.editBus          = editBus;
window.editSchedule     = editSchedule;
window.confirmDelete    = confirmDelete;
window.doDelete         = doDelete;
window.openAddRouteModal    = openAddRouteModal;
window.openAddStopModal     = openAddStopModal;
window.openAddBusModal      = openAddBusModal;
window.openAddScheduleModal = openAddScheduleModal;
window.saveRoute    = saveRoute;
window.saveStop     = saveStop;
window.saveBus      = saveBus;
window.saveSchedule = saveSchedule;
window.closeModal   = closeModal;
window.closeAllModals = closeAllModals;
window.onScRouteChange = onScRouteChange;
