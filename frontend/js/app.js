/**
 * app.js — Urganch Bus asosiy JavaScript moduli
 * API bilan ishlash, sidebar, qidiruv, realtime simulyatsiya
 */

'use strict';

import { initMap, drawRoute, clearRoute, dimInactiveRoutes, resetAllRouteStyles,
         updateBusMarker, clearBusMarkers, fitAllRoutes } from './map.js';
import { startCountdown, stopAllCountdowns, getSecondsUntil } from './timer.js';

// ─── API bazaviy manzili ──────────────────────────────────────────────────────
// Production: Flask ham frontend ni serve qiladi (bitta server)
// Development: localhost:5000
const API_BASE = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
  ? 'http://127.0.0.1:5000'
  : window.location.origin;

// ─── Global holat ─────────────────────────────────────────────────────────────
let allRoutes       = [];   // API dan kelgan barcha yo'nalishlar
let allSchedule     = [];   // Barcha jadval yozuvlari
let selectedRouteId = null; // Tanlangan yo'nalish
let realtimeData    = [];   // /api/realtime ma'lumotlari
let busUpdateTimer  = null; // setInterval ID

// ─── DOM elementlari ─────────────────────────────────────────────────────────
const loadingOverlay  = document.getElementById('loadingOverlay');
const routesList      = document.getElementById('routesList');
const schedulePanel   = document.getElementById('schedulePanel');
const routesPanel     = document.getElementById('routesPanel');
const routesTabBtn    = document.getElementById('routesTabBtn');
const scheduleTabBtn  = document.getElementById('scheduleTabBtn');
const routeSearch     = document.getElementById('routeSearch');
const themeBtn        = document.getElementById('themeBtn');
const mobileMenuBtn   = document.getElementById('mobileMenuBtn');
const sidebar         = document.querySelector('.sidebar');
const busPopupList    = document.getElementById('busPopupList');
const totalRoutesEl   = document.getElementById('totalRoutes');
const activeBusesEl   = document.getElementById('activeBuses');
const nextArrivalEl   = document.getElementById('nextArrival');

// ═══════════════════════════════════════════════════════════════════════════════
//  BOSHLASH
// ═══════════════════════════════════════════════════════════════════════════════
async function init() {
  // Xaritani boshlash
  initMap();

  // Dark mode — localStorage dan o'qish
  const savedTheme = localStorage.getItem('urganch-bus-theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';

  try {
    // Parallel ravishda API dan ma'lumot olish
    const [routesRes, scheduleRes] = await Promise.all([
      fetch(`${API_BASE}/api/routes`),
      fetch(`${API_BASE}/api/schedule`),
    ]);

    allRoutes   = await routesRes.json();
    allSchedule = await scheduleRes.json();

    // Sidebar yo'nalishlar ro'yxatini to'ldirish
    renderRoutesList(allRoutes);

    // Barcha yo'nalishlarni xaritada bir vaqtda ko'rsatish
    allRoutes.forEach(route => drawRoute(route, false));
    fitAllRoutes();

    // Statistika
    updateStats();

    // Realtime simulyatsiyani boshlash
    await loadRealtimeData();
    busUpdateTimer = setInterval(loadRealtimeData, 15000); // 15 soniyada yangilanish

  } catch (err) {
    console.error('[App] Backend bilan ulanib bo\'lmadi:', err);
    showOfflineMode();
  }

  // Loading ekranini yashirish
  setTimeout(() => {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => loadingOverlay.remove(), 500);
  }, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  YO'NALISHLAR SIDEBAR
// ═══════════════════════════════════════════════════════════════════════════════
function renderRoutesList(routes) {
  routesList.innerHTML = '';

  if (routes.length === 0) {
    routesList.innerHTML = `
      <div style="text-align:center;padding:40px 20px;color:var(--text-muted);">
        <div style="font-size:2rem;margin-bottom:8px;">🔍</div>
        <div style="font-size:0.85rem;">Yo'nalish topilmadi</div>
      </div>`;
    return;
  }

  routes.forEach(route => {
    const card = document.createElement('div');
    card.className = 'route-card';
    card.id = `route-card-${route.id}`;
    card.style.setProperty('--route-color', route.color);

    const stopsCount = route.stops?.length || 0;
    const busCount = realtimeData.filter(b => b.route_number === route.number).length;

    card.innerHTML = `
      <div class="route-card-top">
        <div class="route-badge" style="background:${route.color};">${route.number}</div>
        <div>
          <div class="route-info-name">${route.name}</div>
          <div class="route-info-desc">${route.description || ''}</div>
        </div>
      </div>
      <div class="route-meta">
        <span class="route-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
          </svg>
          ${stopsCount} bekat
        </span>
        <span class="route-tag">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
          </svg>
          ${busCount} avtobus
        </span>
      </div>
    `;

    card.addEventListener('click', () => selectRoute(route));
    routesList.appendChild(card);
  });
}

/**
 * Yo'nalishni tanlash — xaritada yoqish va sidebar belgilash
 */
function selectRoute(route) {
  // Oldingi tanlangan kartochkadan highlight olib tashlash
  if (selectedRouteId) {
    document.getElementById(`route-card-${selectedRouteId}`)?.classList.remove('selected');
  }

  if (selectedRouteId === route.id) {
    // Ikkinchi marta bossalar — tanlashni bekor qilish
    selectedRouteId = null;
    resetAllRouteStyles();
    fitAllRoutes();
    return;
  }

  selectedRouteId = route.id;
  document.getElementById(`route-card-${route.id}`)?.classList.add('selected');

  // Faqat tanlangan yo'nalishni xaritada to'liq ko'rsatish
  drawRoute(route, true);
  dimInactiveRoutes(route.id);

  // Jadval tabiga o'tish va filterlash
  renderSchedule(route.id);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  JADVAL PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function renderSchedule(routeId) {
  const filtered = routeId
    ? allSchedule.filter(s => {
        const route = allRoutes.find(r => r.id === routeId);
        return route && s.route_number === route.number;
      })
    : allSchedule;

  schedulePanel.innerHTML = '';

  if (filtered.length === 0) {
    schedulePanel.innerHTML = `
      <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.82rem;">
        Jadval topilmadi
      </div>`;
    return;
  }

  // Vaqt bo'yicha saralash
  const sorted = [...filtered].sort((a, b) => a.depart_time.localeCompare(b.depart_time));

  sorted.forEach(item => {
    const secondsLeft = getSecondsUntil(item.depart_time);
    const isPast = secondsLeft > 82000; // 23+ soat — o'tib ketgan

    const el = document.createElement('div');
    el.className = 'schedule-item';
    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="schedule-time" style="color:${item.route_color};">${item.depart_time}</div>
        <span style="font-size:0.68rem;padding:2px 8px;border-radius:999px;
          background:${isPast ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'};
          color:${isPast ? '#EF4444' : '#10B981'};font-weight:600;">
          ${isPast ? 'O\'tdi' : 'Kutilmoqda'}
        </span>
      </div>
      <div class="schedule-stop">🚏 ${item.stop_name}</div>
      <div class="schedule-bus">🚌 ${item.bus_plate} · ${item.route_name}</div>
    `;
    schedulePanel.appendChild(el);
  });

  // Jadval tabiga o'tish
  activateTab('schedule');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  TAB BOSHQARUVI
// ═══════════════════════════════════════════════════════════════════════════════
function activateTab(tab) {
  if (tab === 'routes') {
    routesPanel.style.display = 'block';
    schedulePanel.style.display = 'none';
    routesTabBtn.classList.add('active');
    scheduleTabBtn.classList.remove('active');
  } else {
    routesPanel.style.display = 'none';
    schedulePanel.style.display = 'block';
    scheduleTabBtn.classList.add('active');
    routesTabBtn.classList.remove('active');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  REAL-VAQT BUS SIMULYATSIYA
// ═══════════════════════════════════════════════════════════════════════════════
async function loadRealtimeData() {
  try {
    const res = await fetch(`${API_BASE}/api/realtime`);
    realtimeData = await res.json();

    // Barcha bus markerlarini yangilash
    clearBusMarkers();
    realtimeData.forEach(bus => updateBusMarker(bus));

    // Sidebar bus kartochkalarini yangilash
    renderBusCards();

    // Statistika
    updateStats();

  } catch (err) {
    console.warn('[Realtime] Yangilanmadi:', err.message);
  }
}

/**
 * O'ng paneldagi bus status kartochkalarini render qilish
 */
function renderBusCards() {
  stopAllCountdowns();
  busPopupList.innerHTML = '';

  realtimeData.forEach(bus => {
    const card = document.createElement('div');
    card.className = 'bus-status-card';
    card.id = `bus-card-${bus.bus_id}`;

    card.innerHTML = `
      <div class="bsc-header">
        <div class="bsc-dot" style="background:${bus.route_color};"></div>
        <span class="bsc-route">${bus.route_number}-yo'nalish · ${bus.route_name.split('—')[0].trim()}</span>
        <span class="bsc-plate">${bus.plate_number}</span>
      </div>
      <div class="bsc-body">
        <div class="bsc-row">
          <span class="bsc-label">Hozir:</span>
          <span class="bsc-val">${bus.current_stop.name}</span>
        </div>
        <div class="bsc-row">
          <span class="bsc-label">Keyingi:</span>
          <span class="bsc-val">${bus.next_stop.name}</span>
        </div>
        <div class="bsc-eta">
          <span class="bsc-eta-icon">⏱</span>
          <span class="bsc-eta-text">Kelishi:</span>
          <span class="bsc-countdown" id="countdown-${bus.bus_id}">--:--</span>
        </div>
      </div>
    `;

    busPopupList.appendChild(card);

    // Countdown timer boshlash
    const countdownEl = document.getElementById(`countdown-${bus.bus_id}`);
    if (countdownEl) {
      startCountdown(bus.bus_id, bus.eta_minutes, countdownEl, onBusArrived);
    }
  });
}

/**
 * Avtobus bekatga yetib kelganda
 */
function onBusArrived(busId) {
  // 3 soniyadan keyin yangi ETA bilan qayta yuklash
  setTimeout(loadRealtimeData, 3000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  STATISTIKA
// ═══════════════════════════════════════════════════════════════════════════════
function updateStats() {
  if (totalRoutesEl) totalRoutesEl.textContent = allRoutes.length;
  if (activeBusesEl) activeBusesEl.textContent = realtimeData.length;

  // Eng yaqin avtobus
  if (nextArrivalEl && realtimeData.length > 0) {
    const minEta = Math.min(...realtimeData.map(b => b.eta_minutes));
    nextArrivalEl.textContent = `${minEta} daq`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  OFFLINE MODE (backend ishlamayotganda)
// ═══════════════════════════════════════════════════════════════════════════════
function showOfflineMode() {
  // Demo ma'lumotlar bilan ishlash — backend ishlamasa ham ko'rinish bo'lsin
  const DEMO_ROUTES = [
    {
      id: 1, number: '1', name: 'Vokzal — Aeroport',
      color: '#3B82F6', description: 'Demo rejim',
      stops: [
        { id:1, name:'Temir yo\'l Vokzali', lat:41.5385, lng:60.6208, order:0 },
        { id:2, name:'Markaziy Maydon',     lat:41.5440, lng:60.6270, order:1 },
        { id:3, name:'Al-Xorazmiy Ko\'chasi', lat:41.5469, lng:60.6315, order:2 },
        { id:4, name:'Markaziy Shifoxona', lat:41.5498, lng:60.6350, order:3 },
        { id:5, name:'Bozor turar-joy',    lat:41.5530, lng:60.6400, order:4 },
        { id:6, name:'Aeroport',           lat:41.5605, lng:60.6512, order:5 },
      ]
    },
    {
      id: 2, number: '2', name: 'Yangi Urgench — Xorazm Universiteti',
      color: '#10B981', description: 'Demo rejim',
      stops: [
        { id:7, name:'Yangi Urgench', lat:41.5320, lng:60.6150, order:0 },
        { id:8, name:'Mustaqillik Xiyoboni', lat:41.5365, lng:60.6200, order:1 },
        { id:9, name:'Shifokorlar tumani', lat:41.5410, lng:60.6255, order:2 },
        { id:10, name:'Pedagogika Instituti', lat:41.5450, lng:60.6300, order:3 },
        { id:11, name:'Stadium', lat:41.5495, lng:60.6350, order:4 },
        { id:12, name:'Xorazm Davlat Universiteti', lat:41.5548, lng:60.6412, order:5 },
      ]
    },
    {
      id: 3, number: '3', name: 'Do\'stlik — Karvon Bozor',
      color: '#F59E0B', description: 'Demo rejim',
      stops: [
        { id:13, name:'Do\'stlik Ko\'chasi', lat:41.5450, lng:60.6180, order:0 },
        { id:14, name:'Xalqlar Do\'stligi', lat:41.5470, lng:60.6230, order:1 },
        { id:15, name:'Eski Shahar', lat:41.5488, lng:60.6278, order:2 },
        { id:16, name:'Savdo Markazi', lat:41.5500, lng:60.6320, order:3 },
        { id:17, name:'Navoi Ko\'chasi', lat:41.5515, lng:60.6370, order:4 },
        { id:18, name:'Karvon Bozor', lat:41.5530, lng:60.6420, order:5 },
        { id:19, name:'Sharq Mahallasi', lat:41.5555, lng:60.6470, order:6 },
      ]
    },
  ];

  allRoutes = DEMO_ROUTES;
  renderRoutesList(allRoutes);
  allRoutes.forEach(route => drawRoute(route, false));
  fitAllRoutes();

  // Demo realtime
  realtimeData = [
    {
      bus_id:1, plate_number:'01 A 123 BC', route_number:'1',
      route_name:'Vokzal — Aeroport', route_color:'#3B82F6',
      current_stop:{ name:'Markaziy Maydon', lat:41.544, lng:60.627 },
      next_stop:{ name:'Al-Xorazmiy Ko\'chasi', lat:41.5469, lng:60.6315 },
      eta_minutes:4, progress:0.2
    },
    {
      bus_id:2, plate_number:'01 B 789 BC', route_number:'2',
      route_name:'Yangi Urgench — Xorazm Universiteti', route_color:'#10B981',
      current_stop:{ name:'Shifokorlar tumani', lat:41.541, lng:60.6255 },
      next_stop:{ name:'Pedagogika Instituti', lat:41.545, lng:60.63 },
      eta_minutes:7, progress:0.4
    },
    {
      bus_id:3, plate_number:'01 C 654 BC', route_number:'3',
      route_name:'Do\'stlik — Karvon Bozor', route_color:'#F59E0B',
      current_stop:{ name:'Savdo Markazi', lat:41.55, lng:60.632 },
      next_stop:{ name:'Navoi Ko\'chasi', lat:41.5515, lng:60.637 },
      eta_minutes:3, progress:0.6
    },
  ];

  realtimeData.forEach(b => updateBusMarker(b));
  renderBusCards();
  updateStats();

  // Demo: backend ishlamayotgani haqida xabar
  const notice = document.createElement('div');
  notice.style.cssText = `
    position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
    background:rgba(245,158,11,0.95); color:#fff; padding:10px 20px;
    border-radius:40px; font-size:0.8rem; font-weight:600; z-index:9999;
    box-shadow:0 4px 16px rgba(0,0,0,0.2); backdrop-filter:blur(8px);
  `;
  notice.textContent = '⚠️ Demo rejim — Backend ulanmagan. python backend/app.py ni ishga tushiring.';
  document.body.appendChild(notice);
  setTimeout(() => notice.remove(), 8000);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  EVENT HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// Dark/Light mode toggle
themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('urganch-bus-theme', next);
  themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
});

// Qidiruv
routeSearch.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase().trim();
  const filtered = allRoutes.filter(r =>
    r.number.includes(q) || r.name.toLowerCase().includes(q)
  );
  renderRoutesList(filtered);
});

// Tab toggling
routesTabBtn.addEventListener('click', () => activateTab('routes'));
scheduleTabBtn.addEventListener('click', () => {
  activateTab('schedule');
  if (!schedulePanel.hasChildNodes() || !schedulePanel.textContent.trim()) {
    renderSchedule(null);
  }
});

// Mobile sidebar
mobileMenuBtn.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

// Sidebar tashqarisiga click — yopish (mobile)
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 &&
      !sidebar.contains(e.target) &&
      !mobileMenuBtn.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// ─── Boshlash ────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', init);
