/**
 * map.js — Leaflet.js xarita moduli
 * Urganch shahri uchun interaktiv xarita:
 * - Yo'nalish chiziqlari (Polyline)
 * - Bekat markerlari (custom HTML icon)
 * - Avtobus harakatlanish animatsiyasi
 */

'use strict';

// ─── Urganch shahrining markaz koordinatasi ───────────────────────────────────
const URGANCH_CENTER = [41.5480, 60.6330];
const DEFAULT_ZOOM   = 13;

let mapInstance  = null;   // Leaflet xarita obyekti
let routeLayers  = {};     // { routeId: { polyline, markers[] } }
let busMarkers   = {};     // { busId: Leaflet.Marker }
let activeRouteId = null;  // Tanlangan yo'nalish ID

/**
 * Xaritani boshlash
 */
export function initMap() {
  mapInstance = L.map('map', {
    center: URGANCH_CENTER,
    zoom: DEFAULT_ZOOM,
    zoomControl: false,    // o'ng pastga ko'chiramiz
  });

  // OpenStreetMap tile qatlami
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(mapInstance);

  // Zoom controls — o'ng pastda
  L.control.zoom({ position: 'bottomright' }).addTo(mapInstance);

  return mapInstance;
}

/**
 * Berilgan yo'nalish uchun polyline va bekat markerlarini xaritada ko'rsatish
 * @param {Object} route — API dan kelgan yo'nalish obyekti
 * @param {boolean} fitBounds — yo'nalishga xaritani moslash
 */
export function drawRoute(route, fitBounds = true) {
  // Eski qatlamni tozalash
  clearRoute(route.id);

  const { id, color, stops } = route;

  if (!stops || stops.length === 0) return;

  // ── Koordinatalar ro'yxati ─────────────────────────────────────────────
  const latlngs = stops.map(s => [s.lat, s.lng]);

  // ── Polyline (yo'nalish chiziq) ───────────────────────────────────────
  const polyline = L.polyline(latlngs, {
    color,
    weight: 5,
    opacity: 0.85,
    smoothFactor: 2,
    lineJoin: 'round',
    lineCap: 'round',
  }).addTo(mapInstance);

  // Animatsiyali "pulse" effekti uchun ikkinchi chiziq
  const glowLine = L.polyline(latlngs, {
    color,
    weight: 10,
    opacity: 0.18,
    smoothFactor: 2,
  }).addTo(mapInstance);

  // ── Bekat markerlari ──────────────────────────────────────────────────
  const markers = stops.map((stop, idx) => {
    const isFirst = idx === 0;
    const isLast  = idx === stops.length - 1;

    // Custom HTML ikonka
    const icon = L.divIcon({
      className: '',
      html: `
        <div class="stop-marker" style="--marker-color:${color}; ${isFirst || isLast ? 'width:34px;height:34px;font-size:16px;' : ''}">
          ${isFirst ? '🚉' : isLast ? '🏁' : '🚏'}
        </div>
      `,
      iconSize:   isFirst || isLast ? [34, 34] : [28, 28],
      iconAnchor: isFirst || isLast ? [17, 17] : [14, 14],
      popupAnchor: [0, -20],
    });

    const marker = L.marker([stop.lat, stop.lng], { icon })
      .addTo(mapInstance)
      .bindPopup(
        `<div style="font-family:Inter,sans-serif;min-width:160px;">
          <div style="font-weight:700;font-size:0.9rem;margin-bottom:4px;">${stop.name}</div>
          <div style="font-size:0.75rem;color:#7FA3C8;">Yo'nalish ${route.number} · Bekat №${idx + 1}</div>
          <div style="margin-top:6px;font-size:0.72rem;background:rgba(37,99,235,0.1);border-radius:6px;padding:4px 8px;color:${color};font-weight:600;">
            📍 ${stop.lat.toFixed(4)}, ${stop.lng.toFixed(4)}
          </div>
        </div>`,
        { className: 'custom-popup' }
      );

    return marker;
  });

  // ── Saqlash ───────────────────────────────────────────────────────────
  routeLayers[id] = { polyline, glowLine, markers };

  // ── Xaritani yo'nalishga moslash ──────────────────────────────────────
  if (fitBounds) {
    mapInstance.flyToBounds(polyline.getBounds(), {
      padding: [60, 60],
      duration: 1.2,
      easeLinearity: 0.4,
    });
  }
}

/**
 * Yo'nalishni xaritadan olib tashlash
 * @param {number} routeId
 */
export function clearRoute(routeId) {
  const layer = routeLayers[routeId];
  if (!layer) return;
  layer.polyline.remove();
  layer.glowLine.remove();
  layer.markers.forEach(m => m.remove());
  delete routeLayers[routeId];
}

/**
 * Barcha yo'nalishlarni kesilgan holda ko'rsatish (xira ko'rinish)
 * @param {number} activeId — faol yo'nalish ID
 */
export function dimInactiveRoutes(activeId) {
  Object.entries(routeLayers).forEach(([rid, layer]) => {
    const dim = parseInt(rid) !== activeId;
    layer.polyline.setStyle({ opacity: dim ? 0.2 : 0.85, weight: dim ? 3 : 5 });
    layer.glowLine.setStyle({ opacity: dim ? 0.05 : 0.18 });
  });
}

/**
 * Barcha yo'nalishlarni to'liq ko'rinishga qaytarish
 */
export function resetAllRouteStyles() {
  Object.values(routeLayers).forEach(layer => {
    layer.polyline.setStyle({ opacity: 0.85, weight: 5 });
    layer.glowLine.setStyle({ opacity: 0.18 });
  });
}

/**
 * Avtobus markerini xaritada qo'shish yoki yangilash
 * @param {Object} busData — realtime API dan kelgan avtobus ma'lumotlari
 */
export function updateBusMarker(busData) {
  const { bus_id, current_stop, next_stop, progress, route_color, route_number } = busData;

  // Interpolyatsiya — avtobus hozirgi va keyingi bekat orasida
  const lat = current_stop.lat + (next_stop.lat - current_stop.lat) * progress;
  const lng = current_stop.lng + (next_stop.lng - current_stop.lng) * progress;

  const busIcon = L.divIcon({
    className: '',
    html: `<div class="bus-marker" style="background:${route_color};">${getBusEmoji(route_number)}</div>`,
    iconSize:   [36, 36],
    iconAnchor: [18, 18],
  });

  if (busMarkers[bus_id]) {
    // Mavjud markerni smooth harakatlantirish
    busMarkers[bus_id].setLatLng([lat, lng]);
  } else {
    busMarkers[bus_id] = L.marker([lat, lng], { icon: busIcon, zIndexOffset: 1000 })
      .addTo(mapInstance);
  }
}

/**
 * Barcha avtobus markerlarini tozalash
 */
export function clearBusMarkers() {
  Object.values(busMarkers).forEach(m => m.remove());
  busMarkers = {};
}

/**
 * Yo'nalish raqamiga qarab bus emoji
 */
function getBusEmoji(num) {
  const map = { '1': '🚌', '2': '🚍', '3': '🚎' };
  return map[num] || '🚌';
}

/**
 * Xaritani markaziga qaytarish
 */
export function resetMapView() {
  mapInstance.flyTo(URGANCH_CENTER, DEFAULT_ZOOM, { duration: 1 });
}

/**
 * Barcha yo'nalishlarning barchasini ko'rsatadigan zoom
 */
export function fitAllRoutes() {
  const allLayers = Object.values(routeLayers).map(l => l.polyline);
  if (allLayers.length === 0) { resetMapView(); return; }
  const group = L.featureGroup(allLayers);
  mapInstance.flyToBounds(group.getBounds(), { padding: [40, 40], duration: 1.2 });
}

export { mapInstance };
