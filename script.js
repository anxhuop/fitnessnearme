/* ═══════════════════════════════════════════════════
   FitnessNearMe.in — script.js
   Uses: Leaflet.js + Overpass API (OpenStreetMap)
         No API key required — fully open source data
═══════════════════════════════════════════════════ */

"use strict";

// ─── CATEGORY CONFIGURATION ───────────────────────────────────────────────────
const CAT_CONFIG = {
  gym: {
    label: "Gym",
    emoji: "🏋️",
    color: "#c8ff00",
    textColor: "#000",
    overpassFilters: [
      '["leisure"="fitness_centre"]',
      '["leisure"="sports_centre"]',
      '["amenity"="gym"]',
      '["sport"="fitness"]',
    ],
    keywords: ["gym", "fitness", "workout", "crossfit", "strength"],
  },
  yoga: {
    label: "Yoga",
    emoji: "🧘",
    color: "#00d4ff",
    textColor: "#000",
    overpassFilters: [
      '["sport"="yoga"]',
      '["leisure"="yoga"]',
    ],
    keywords: ["yoga", "meditation", "pilates", "ayurveda"],
  },
  dance: {
    label: "Dance",
    emoji: "💃",
    color: "#ff4d1c",
    textColor: "#fff",
    overpassFilters: [
      '["sport"="dancing"]',
      '["leisure"="dance"]',
    ],
    keywords: ["dance", "dancing", "ballet", "choreograph", "bharatnatyam", "kathak"],
  },
  zumba: {
    label: "Zumba",
    emoji: "🎵",
    color: "#ff8c00",
    textColor: "#000",
    overpassFilters: [
      '["sport"="zumba"]',
      '["leisure"="aerobics"]',
    ],
    keywords: ["zumba", "aerobics", "aerobic", "cardio dance"],
  },
  protein: {
    label: "Protein Shop",
    emoji: "💊",
    color: "#a855f7",
    textColor: "#fff",
    overpassFilters: [
      '["shop"="nutrition_supplements"]',
      '["shop"="sports"]',
    ],
    keywords: ["protein", "supplement", "nutrition", "whey", "creatine", "health store"],
  },
  martial: {
    label: "Martial Arts",
    emoji: "🥋",
    color: "#ef4444",
    textColor: "#fff",
    overpassFilters: [
      '["sport"="martial_arts"]',
      '["sport"="karate"]',
      '["sport"="judo"]',
      '["sport"="taekwondo"]',
      '["sport"="boxing"]',
      '["sport"="mma"]',
      '["sport"="wrestling"]',
      '["sport"="kung_fu"]',
    ],
    keywords: ["karate", "judo", "taekwondo", "boxing", "mma", "martial", "kung fu", "wrestling", "krav maga"],
  },
};

// ─── STATE ─────────────────────────────────────────────────────────────────────
let map = null;
let userMarker = null;
let circleOverlay = null;
let allResults = [];
let mapMarkers = [];
let activeCategory = "all";
let activeCardIndex = null;
let userLat = null;
let userLon = null;
let toastTimer = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  bindEvents();
});

// ─── MAP SETUP ────────────────────────────────────────────────────────────────
function initMap() {
  map = L.map("map", {
    center: [20.5937, 78.9629],
    zoom: 5,
    zoomControl: true,
    attributionControl: true,
  });

  // Dark tile layer (CartoDB Dark Matter)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);
}

// ─── EVENT BINDINGS ────────────────────────────────────────────────────────────
function bindEvents() {
  // GPS button
  document.getElementById("btn-gps").addEventListener("click", handleGPS);

  // Search button
  document.getElementById("btn-search").addEventListener("click", handleSearch);

  // Enter key on input
  document.getElementById("location-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSearch();
  });

  // Category pills
  document.querySelectorAll(".cat-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      document.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
      pill.classList.add("active");
      activeCategory = pill.dataset.cat;
      const filtered = getFiltered();
      renderCards(filtered);
      updateMapMarkers(filtered);
    });
  });

  // Radius slider
  document.getElementById("radius-slider").addEventListener("input", function () {
    const v = +this.value;
    document.getElementById("radius-label").textContent =
      v >= 1000 ? v / 1000 + " km" : v + " m";
  });

  // Sort select
  document.getElementById("sort-select").addEventListener("change", () => {
    renderCards(getFiltered());
  });
}

// ─── GPS HANDLER ──────────────────────────────────────────────────────────────
function handleGPS() {
  if (!navigator.geolocation) {
    showToast("❌ Geolocation not supported by your browser.", "error");
    return;
  }
  showToast("📍 Detecting your location…");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLon = pos.coords.longitude;
      reverseGeocode(userLat, userLon);
      fetchAllCategories(userLat, userLon);
    },
    (err) => {
      showToast("❌ Location access denied. Please type an area.", "error");
      console.warn("Geolocation error:", err.message);
    },
    { timeout: 12000, maximumAge: 60000 }
  );
}

// ─── SEARCH HANDLER ───────────────────────────────────────────────────────────
function handleSearch() {
  const query = document.getElementById("location-input").value.trim();
  if (!query) {
    showToast("Please enter a city or area name.", "error");
    return;
  }
  geocodeAddress(query);
}

// ─── GEOCODING (Nominatim) ────────────────────────────────────────────────────
async function geocodeAddress(query) {
  showLoading(true);
  showToast("🔍 Searching for \"" + query + "\"…");
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=1`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "en" },
    });
    const data = await res.json();
    if (!data.length) {
      showLoading(false);
      showToast("❌ Location not found. Try a different name.", "error");
      showStateNone();
      return;
    }
    userLat = parseFloat(data[0].lat);
    userLon = parseFloat(data[0].lon);
    document.getElementById("location-input").value = data[0].display_name.split(",").slice(0, 3).join(", ");
    fetchAllCategories(userLat, userLon);
  } catch (err) {
    showLoading(false);
    showToast("❌ Geocoding failed. Check your connection.", "error");
    console.error("Geocode error:", err);
  }
}

// ─── REVERSE GEOCODE ─────────────────────────────────────────────────────────
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data && data.address) {
      const addr = data.address;
      const label = [addr.suburb || addr.neighbourhood, addr.city || addr.town || addr.village]
        .filter(Boolean)
        .join(", ");
      document.getElementById("location-input").value = label || "Your Location";
    }
  } catch (_) { /* silently fail */ }
}

// ─── FETCH ALL CATEGORIES ─────────────────────────────────────────────────────
async function fetchAllCategories(lat, lon) {
  showLoading(true);
  allResults = [];
  clearMapMarkers();

  const radius = +document.getElementById("radius-slider").value;

  // Place user marker
  placeUserMarker(lat, lon);
  placeCircle(lat, lon, radius);
  map.flyTo([lat, lon], 14, { duration: 1.2 });

  const fetches = Object.entries(CAT_CONFIG).map(([cat, cfg]) =>
    fetchCategory(cat, cfg, lat, lon, radius)
  );
  const results = await Promise.allSettled(fetches);

  results.forEach((r) => {
    if (r.status === "fulfilled") {
      allResults.push(...r.value);
    }
  });

  // Deduplicate by OSM id
  const seen = new Set();
  allResults = allResults.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  showLoading(false);

  if (!allResults.length) {
    showToast("😔 No fitness spots found nearby. Try a larger radius.", "error");
    showStateNone();
    updateStats({ gym: 0, yoga: 0, dance: 0, zumba: 0, protein: 0, martial: 0 }, 0);
    return;
  }

  const filtered = getFiltered();
  renderCards(filtered);
  updateMapMarkers(filtered);
  updateStatsFromResults(allResults);
  showToast(`✅ Found ${allResults.length} fitness spots near you!`, "success");
}

// ─── FETCH ONE CATEGORY ───────────────────────────────────────────────────────
async function fetchCategory(cat, cfg, lat, lon, radius) {
  const results = [];

  for (const filter of cfg.overpassFilters) {
    try {
      const query = buildOverpassQuery(filter, lat, lon, radius);
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
      });
      const data = await res.json();
      const elements = data.elements || [];

      elements.forEach((el) => {
        const elLat = el.lat || (el.center && el.center.lat);
        const elLon = el.lon || (el.center && el.center.lon);
        if (!elLat || !elLon) return;

        const name = el.tags?.name || el.tags?.["name:en"] || inferName(el.tags, cfg);
        if (!name) return;

        const dist = haversine(lat, lon, elLat, elLon);
        results.push({
          id: `${el.type}-${el.id}`,
          name,
          cat,
          emoji: cfg.emoji,
          color: cfg.color,
          textColor: cfg.textColor,
          label: cfg.label,
          lat: elLat,
          lon: elLon,
          dist,
          address: buildAddress(el.tags),
          tags: el.tags || {},
          website: el.tags?.website || el.tags?.["contact:website"] || null,
          phone: el.tags?.phone || el.tags?.["contact:phone"] || null,
        });
      });
    } catch (err) {
      console.warn(`Fetch failed for ${cat} / ${filter}:`, err);
    }
  }

  return results;
}

// ─── OVERPASS QUERY BUILDER ───────────────────────────────────────────────────
function buildOverpassQuery(filter, lat, lon, radius) {
  return `
    [out:json][timeout:25];
    (
      node${filter}(around:${radius},${lat},${lon});
      way${filter}(around:${radius},${lat},${lon});
      relation${filter}(around:${radius},${lat},${lon});
    );
    out center tags;
  `.trim();
}

// ─── INFER NAME FROM TAGS ─────────────────────────────────────────────────────
function inferName(tags, cfg) {
  if (!tags) return null;
  const combined = Object.values(tags).join(" ").toLowerCase();
  for (const kw of cfg.keywords) {
    if (combined.includes(kw.toLowerCase())) {
      return tags["name:en"] || tags.name || null;
    }
  }
  return null;
}

// ─── BUILD ADDRESS STRING ─────────────────────────────────────────────────────
function buildAddress(tags) {
  if (!tags) return "";
  return [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:suburb"] || tags["addr:neighbourhood"],
    tags["addr:city"] || tags["addr:town"],
  ]
    .filter(Boolean)
    .join(", ");
}

// ─── HAVERSINE DISTANCE (metres) ──────────────────────────────────────────────
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── FORMAT DISTANCE ──────────────────────────────────────────────────────────
function formatDist(m) {
  return m < 1000 ? Math.round(m) + " m" : (m / 1000).toFixed(1) + " km";
}

// ─── FILTER RESULTS ───────────────────────────────────────────────────────────
function getFiltered() {
  const cats = activeCategory === "all" ? null : activeCategory;
  let list = cats ? allResults.filter((r) => r.cat === cats) : [...allResults];

  const sort = document.getElementById("sort-select")?.value || "dist";
  if (sort === "dist") list.sort((a, b) => a.dist - b.dist);
  if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

  return list;
}

// ─── RENDER CARDS ─────────────────────────────────────────────────────────────
function renderCards(items) {
  hideAllStates();
  const panel = document.getElementById("results-panel");
  const header = document.getElementById("results-header");
  const container = document.getElementById("cards-container");

  if (!items.length) {
    showStateNone();
    header.style.display = "none";
    return;
  }

  header.style.display = "flex";
  document.getElementById("results-count").innerHTML =
    `<strong>${items.length}</strong> places found`;

  container.innerHTML = "";
  items.forEach((item, idx) => {
    const card = document.createElement("div");
    card.className = "result-card";
    card.dataset.index = idx;

    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`;

    card.innerHTML = `
      <div class="card-icon" style="background:${item.color}22;">
        <span>${item.emoji}</span>
      </div>
      <div class="card-body">
        <div class="card-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
        <div class="card-meta">
          <span class="card-tag" style="background:${item.color}22;color:${item.color};">
            ${item.label}
          </span>
          <span class="card-dist">📍 ${formatDist(item.dist)}</span>
          ${item.phone ? `<span>📞 ${escHtml(item.phone)}</span>` : ""}
        </div>
        ${item.address ? `<div class="card-address">${escHtml(item.address)}</div>` : ""}
      </div>
      <a class="card-dir" href="${dirUrl}" target="_blank" rel="noopener" title="Get directions" onclick="event.stopPropagation()">
        ↗
      </a>
    `;

    card.addEventListener("click", () => selectCard(idx, items));
    container.appendChild(card);
  });
}

// ─── SELECT A CARD ────────────────────────────────────────────────────────────
function selectCard(idx, items) {
  // Deactivate previous
  document.querySelectorAll(".result-card").forEach((c) => c.classList.remove("active"));
  const selected = document.querySelector(`.result-card[data-index="${idx}"]`);
  if (selected) selected.classList.add("active");

  activeCardIndex = idx;
  const item = items[idx];

  // Pan map to marker
  map.flyTo([item.lat, item.lon], 17, { duration: 0.8 });

  // Open matching popup
  mapMarkers.forEach((m) => {
    if (m._fnmId === item.id) {
      m.openPopup();
    }
  });
}

// ─── UPDATE MAP MARKERS ───────────────────────────────────────────────────────
function updateMapMarkers(items) {
  clearMapMarkers();
  items.forEach((item) => {
    const icon = L.divIcon({
      className: "",
      html: `<div class="custom-marker" style="background:${item.color};">
               <span>${item.emoji}</span>
             </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -34],
    });

    const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lon}`;
    const marker = L.marker([item.lat, item.lon], { icon })
      .bindPopup(`
        <div class="popup-name">${escHtml(item.name)}</div>
        <span class="popup-tag" style="background:${item.color}22;color:${item.color};">${item.label}</span>
        <div class="popup-dist">📍 ${formatDist(item.dist)} away</div>
        ${item.address ? `<div class="popup-addr">${escHtml(item.address)}</div>` : ""}
        ${item.phone ? `<div class="popup-addr">📞 ${escHtml(item.phone)}</div>` : ""}
        <a class="popup-link" href="${dirUrl}" target="_blank" rel="noopener">Get Directions ↗</a>
      `)
      .addTo(map);

    marker._fnmId = item.id;
    mapMarkers.push(marker);
  });
}

// ─── CLEAR MAP MARKERS ────────────────────────────────────────────────────────
function clearMapMarkers() {
  mapMarkers.forEach((m) => map.removeLayer(m));
  mapMarkers = [];
}

// ─── USER LOCATION MARKER ─────────────────────────────────────────────────────
function placeUserMarker(lat, lon) {
  if (userMarker) map.removeLayer(userMarker);
  const icon = L.divIcon({
    className: "",
    html: `<div class="user-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  userMarker = L.marker([lat, lon], { icon })
    .bindPopup("<strong>📍 Your Location</strong>")
    .addTo(map);
}

function placeCircle(lat, lon, radius) {
  if (circleOverlay) map.removeLayer(circleOverlay);
  circleOverlay = L.circle([lat, lon], {
    radius,
    color: "#c8ff00",
    fillColor: "#c8ff00",
    fillOpacity: 0.04,
    weight: 1,
    dashArray: "6 4",
    opacity: 0.35,
  }).addTo(map);
}

// ─── STATS ────────────────────────────────────────────────────────────────────
function updateStatsFromResults(results) {
  const counts = { gym: 0, yoga: 0, dance: 0, zumba: 0, protein: 0, martial: 0 };
  results.forEach((r) => {
    if (counts[r.cat] !== undefined) counts[r.cat]++;
  });

  document.getElementById("stat-gyms").textContent = counts.gym;
  document.getElementById("stat-yoga").textContent = counts.yoga;
  document.getElementById("stat-dance").textContent = counts.dance + counts.zumba;
  document.getElementById("stat-protein").textContent = counts.protein;
  document.getElementById("stat-total").textContent = results.length;

  document.getElementById("stats-strip").style.display = "flex";
}

// ─── STATE HELPERS ────────────────────────────────────────────────────────────
function showLoading(bool) {
  document.getElementById("state-empty").style.display = "none";
  document.getElementById("state-none").style.display = "none";
  document.getElementById("state-loading").style.display = bool ? "flex" : "none";
  document.getElementById("results-header").style.display = "none";
  document.getElementById("cards-container").innerHTML = "";
}

function hideAllStates() {
  document.getElementById("state-empty").style.display = "none";
  document.getElementById("state-none").style.display = "none";
  document.getElementById("state-loading").style.display = "none";
}

function showStateNone() {
  hideAllStates();
  document.getElementById("state-none").style.display = "flex";
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function showToast(msg, type = "") {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.className = "show" + (type ? " toast-" + type : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.className = "";
  }, 3500);
}

// ─── ESCAPE HTML ──────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
