/* =========================================================
   Orbi – le monde, pays par pays
   Globe : globe.gl (three.js) · Données : /data/*.json
   ========================================================= */
(() => {
'use strict';

// ---------- Réglages visuels ----------
const OCEAN = '#4cc3f1';
const CONTINENT_COLORS = {
  'Europe': '#5fd39a', 'Asia': '#ff9b54', 'Africa': '#ffc93c', 'North America': '#9d8cff',
  'South America': '#2ec4b6', 'Oceania': '#ff7eb6', 'Antarctica': '#f4f8fc', 'Seven seas (open ocean)': '#9d8cff',
};
const NEUTRAL = '#e9eef5';
const SEV_COLORS = { 3: '#ff5a5a', 2: '#ffa53d', 1: '#ffd84d' };
const RELATED = '#f6d3d3'; // pays concerné indirectement
const MODES = {
  all:  { label: 'Tout',          icon: '🌍', title: 'Bienvenue 👋' },
  good: { label: 'Good news',     icon: '🌈', title: '🌈 Là où ça va bien' },
  geo:  { label: 'Géopolitique',  icon: '⚔️', title: '⚔️ Zones de tension' },
  foot: { label: 'Foot',          icon: '⚽', title: '⚽ Mercato d\'été 2026' },
  eco:  { label: 'Économie',      icon: '💼', title: '💼 Grands rachats 2026' },
};

// ---------- État ----------
const S = {
  mode: 'all', features: [], byIso: {}, daily: null, geo: null, deals: null, transfers: null,
  hover: null, selected: null, newsCache: {}, panel: null, focusArc: null,
};
const $ = (s) => document.querySelector(s);
const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// ---------- Utilitaires couleur / format ----------
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + ((1 << 24) + (ch(16) << 16) + (ch(8) << 8) + ch(0)).toString(16).slice(1);
}
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
function ago(d) {
  const diff = (new Date(d) - Date.now()) / 1000;
  const a = Math.abs(diff);
  if (a < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}
const popFmt = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });
const CONTINENT_FR = { 'Europe': 'Europe', 'Asia': 'Asie', 'Africa': 'Afrique', 'North America': 'Amérique du Nord', 'South America': 'Amérique du Sud', 'Oceania': 'Océanie', 'Antarctica': 'Antarctique', 'Seven seas (open ocean)': 'Océans' };
const flagUrl = (iso) => /^[A-Z]{2}$/.test(iso) ? `https://flagcdn.com/w160/${iso.toLowerCase()}.png` : null;

// ---------- Index des données curées ----------
// zonesOf : zones où le pays est acteur principal OU concerné ; maxSev : seulement acteur principal (couleur)
function zonesOf(iso) { return (S.geo?.zones || []).filter(z => z.countries.includes(iso) || (z.related || []).includes(iso)); }
function maxSev(iso) { return (S.geo?.zones || []).filter(z => z.countries.includes(iso)).reduce((m, z) => Math.max(m, z.severity), 0); }
const isRelatedOnly = (iso) => !maxSev(iso) && zonesOf(iso).length > 0;
function dealsOf(iso) { return (S.deals?.deals || []).filter(d => d.buyer.iso === iso || d.target.iso === iso); }
function transfersOf(iso) { return (S.transfers?.transfers || []).filter(t => t.from.iso === iso || t.to.iso === iso); }
const counts = (iso) => S.daily?.counts?.[iso] || { all: 0, good: 0, eco: 0, foot: 0 };

// ---------- Couleur des pays selon le filtre ----------
function baseColor(f) {
  const p = f.properties, iso = p.iso;
  switch (S.mode) {
    case 'good': {
      const c = counts(iso);
      if (!c.all) return NEUTRAL;
      return moodColor(c.mood ?? 0);
    }
    case 'geo': { const s = maxSev(iso); return s ? SEV_COLORS[s] : (isRelatedOnly(iso) ? RELATED : NEUTRAL); }
    case 'foot': return S.daily?.football?.[iso] ? '#6fd66f' : (transfersOf(iso).length ? '#b9ecc0' : NEUTRAL);
    case 'eco': return dealsOf(iso).length ? '#a99bff' : NEUTRAL;
    default: {
      const c = CONTINENT_COLORS[p.continent] || '#ccc';
      return shade(c, ((p.color || 4) - 4) * 0.035);
    }
  }
}
// humeur de l'actu : -1 (que des mauvaises nouvelles) → +1 (que des bonnes)
const moodColor = (m) => mix('#e3e8ee', '#2fb344', Math.max(0, Math.min(1, (m + 0.6) / 1)));
const moodLabel = (m) => m >= 0.15 ? 'Plutôt de bonnes nouvelles 😊' : m >= -0.15 ? 'Actu mitigée 😐' : m >= -0.45 ? 'Actu plutôt sombre 😟' : 'Actu très sombre 😢';

function capColor(f) {
  const c = baseColor(f);
  if (S.selected === f.properties.iso) return shade(c, -0.12);
  if (S.hover === f) return shade(c, 0.22);
  return c;
}
const sideColor = (f) => shade(baseColor(f), -0.25);
function altitude(f) {
  if (S.selected === f.properties.iso) return 0.045;
  if (S.hover === f) return 0.025;
  return 0.008;
}

// ---------- Globe ----------
const el = $('#globe');
let world;
try { world = new Globe(el, { animateIn: true }); } catch { world = Globe()(el); }
world
  .backgroundColor('rgba(0,0,0,0)')
  .showAtmosphere(true).atmosphereColor('#a6e3ff').atmosphereAltitude(0.18)
  .showGraticules(false)
  .polygonCapColor(capColor).polygonSideColor(sideColor)
  .polygonStrokeColor(() => '#ffffff').polygonAltitude(altitude)
  .polygonsTransitionDuration(250)
  .polygonLabel(tooltip)
  .onPolygonHover((f) => { S.hover = f; el.style.cursor = f ? 'pointer' : 'grab'; refreshPolygons(); })
  .onPolygonClick((f) => openCountry(f.properties.iso))
  .arcStartLat((a) => a.from[0]).arcStartLng((a) => a.from[1]).arcEndLat((a) => a.to[0]).arcEndLng((a) => a.to[1])
  .arcDashLength(0.45).arcDashGap(0.15).arcDashAnimateTime(2200)
  .arcStroke((a) => (S.focusArc && S.focusArc === a.ref ? 1.6 : a.stroke || 0.7))
  .arcColor((a) => (S.focusArc && S.focusArc !== a.ref) ? ['rgba(31,42,68,0.08)', 'rgba(31,42,68,0.12)'] : a.colors)
  .arcAltitudeAutoScale(0.55)
  .arcLabel((a) => `<div class="tip"><b>${esc(a.label)}</b>${a.sub ? `<div>${esc(a.sub)}</div>` : ''}</div>`)
  .onArcClick((a) => a.onClick && a.onClick())
  .pathPoints('points').pathPointLat((p) => p[0]).pathPointLng((p) => p[1]).pathPointAlt(0.012)
  .pathColor((p) => p.color).pathStroke((p) => p.stroke)
  .pathDashLength((p) => p.dash ? 0.06 : 1).pathDashGap((p) => p.dash ? 0.04 : 0).pathDashAnimateTime((p) => p.dash ? 0 : 0)
  .pathLabel((p) => `<div class="tip"><b>${esc(p.label)}</b></div>`)
  .pathTransitionDuration(0)
  .ringColor((r) => (t) => `rgba(${r.color || '255,70,70'},${1 - t})`).ringMaxRadius(4.5).ringPropagationSpeed(2.2).ringRepeatPeriod(1300)
  .ringAltitude(0.01)
  .htmlAltitude(0.02)
  .htmlElement((d) => d.el)
  .onGlobeClick(() => { if (!isMobile()) return; closePanel(); });
if (world.htmlElementVisibilityModifier) world.htmlElementVisibilityModifier((elm, visible) => { elm.style.opacity = visible ? 1 : 0; elm.style.pointerEvents = visible ? 'auto' : 'none'; });

window.__orbi = { world, S }; // pratique pour déboguer dans la console

const mat = world.globeMaterial();
mat.color.set(OCEAN);
if (mat.emissive) { mat.emissive.set('#2aa8e0'); mat.emissiveIntensity = 0.35; }
if ('shininess' in mat) mat.shininess = 6;

const controls = world.controls();
controls.autoRotate = true; controls.autoRotateSpeed = 0.45;
controls.enableDamping = true; controls.dampingFactor = 0.1;
controls.minDistance = 130; controls.maxDistance = 600;
let idleTimer;
controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(idleTimer); });
controls.addEventListener('end', () => scheduleRotate());
function scheduleRotate() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!S.panel) controls.autoRotate = true; }, 20000); }

// noms des zones visibles seulement quand on zoome (évite le fouillis)
if (world.onZoom) world.onZoom((pov) => document.body.classList.toggle('zoomed', pov.altitude < 1.45));

function resize() { world.width(window.innerWidth).height(window.innerHeight); }
window.addEventListener('resize', resize);
resize();
world.pointOfView({ lat: 30, lng: 15, altitude: isMobile() ? 2.9 : 2.2 });

function refreshPolygons() {
  world.polygonCapColor(capColor).polygonAltitude(altitude).polygonSideColor(sideColor);
}

// ---------- Info-bulle de survol ----------
function tooltip(f) {
  const p = f.properties, iso = p.iso, c = counts(iso);
  let sub = '';
  if (S.mode === 'all') sub = c.top ? '📰 ' + c.top : 'Clique pour voir les actus';
  if (S.mode === 'good') sub = (c.all ? moodLabel(c.mood ?? 0) : '') + (c.topGood ? ' · 🌈 ' + c.topGood : '');
  if (S.mode === 'geo') { const z = zonesOf(iso); sub = z.length ? z.map(z => `${S.geo.types[z.type].icon} ${z.name}`).join(' · ') : 'Pas de zone de tension suivie'; }
  if (S.mode === 'foot') { const fb = S.daily?.football?.[iso]; sub = fb ? `🏆 ${fb.league} · 1er : ${fb.rows[0]?.team}` : (transfersOf(iso).length ? '🔁 Transferts' : 'Pas de championnat suivi'); }
  if (S.mode === 'eco') { const d = dealsOf(iso); sub = d.length ? d.map(d => `${d.buyer.name} → ${d.target.name}`).join(' · ') : (c.eco ? `${c.eco} actus éco` : ''); }
  if (sub.length > 140) sub = sub.slice(0, 137) + '…';
  return `<div class="tip"><b>${esc(p.name)}</b>${sub ? `<div>${esc(sub)}</div>` : ''}</div>`;
}

// ---------- Badges HTML posés sur le globe ----------
function badge({ emoji, img, label, cls = '', title, onClick }) {
  const b = document.createElement('div');
  b.className = 'gbadge ' + cls + (img ? ' logo' : '');
  b.innerHTML = (img ? `<img src="${esc(img)}" alt="" loading="lazy">` : `<span class="e">${emoji}</span>`) + (label ? `<span class="lbl">${esc(label)}</span>` : '');
  if (title) b.title = title;
  b.addEventListener('click', (e) => { e.stopPropagation(); onClick && onClick(); });
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  return b;
}

// ---------- Couches selon le filtre ----------
function applyLayers() {
  const m = S.mode;
  let arcs = [], paths = [], rings = [], html = [];

  if (m === 'geo' && S.geo) {
    for (const z of S.geo.zones) {
      html.push({ lat: z.lat, lng: z.lng, el: badge({ emoji: S.geo.types[z.type].icon, label: z.name, cls: 's' + z.severity, title: z.name, onClick: () => openZone(z.id) }) });
      if (z.severity === 3) rings.push({ lat: (z.ring || [z.lat])[0], lng: z.ring ? z.ring[1] : z.lng });
      for (const a of z.arrows || []) arcs.push({ from: a.from, to: a.to, label: a.label, sub: z.name, colors: ['rgba(255,90,90,0.25)', '#e11d48'], stroke: 0.9, ref: z.id, onClick: () => openZone(z.id) });
      if (z.line) paths.push({ points: z.line.points, label: z.line.label, color: z.line.blocked ? '#e11d48' : (z.type === 'tension' ? '#f59e0b' : '#b91c1c'), stroke: z.line.blocked ? 3.2 : 2, dash: !!z.line.blocked });
    }
  }
  if (m === 'foot') {
    for (const [iso, fb] of Object.entries(S.daily?.football || {})) {
      const f = S.byIso[iso]; const lead = fb.rows[0]; if (!f || !lead) continue;
      html.push({ lat: f.properties.lat, lng: f.properties.lng, el: badge({ img: lead.logo, emoji: '⚽', title: `${fb.league} – 1er : ${lead.team}`, onClick: () => openCountry(iso) }) });
    }
    (S.transfers?.transfers || []).forEach((t, i) => arcs.push({
      from: [t.from.lat, t.from.lng], to: [t.to.lat, t.to.lng], label: `${t.player} · ${t.fee}`, sub: `${t.from.club} → ${t.to.club}`,
      colors: ['#9be36b', '#1c8cf6'], stroke: 0.9, ref: 't' + i, onClick: () => openTransfer(i),
    }));
  }
  if (m === 'eco') {
    const seen = new Set();
    for (const d of S.deals?.deals || []) {
      arcs.push({ from: [d.buyer.lat, d.buyer.lng], to: [d.target.lat, d.target.lng], label: `${d.buyer.name} → ${d.target.name}`, sub: `${d.amount} · ${d.sector}`, colors: ['#c9bfff', '#6c3cf0'], stroke: 0.9, ref: d.id, onClick: () => openDeal(d.id) });
      for (const [co, ico] of [[d.buyer, '💼'], [d.target, '🎯']]) {
        const k = co.name; if (seen.has(k)) continue; seen.add(k);
        html.push({ lat: co.lat, lng: co.lng, el: badge({ emoji: ico, label: co.name, cls: 'co', title: co.name, onClick: () => openDeal(d.id) }) });
      }
    }
  }
  // élément mis en avant (transfert / rachat sélectionné) : marqueur + onde à l'arrivée
  if (S.marker) {
    html.push({ lat: S.marker.lat, lng: S.marker.lng, el: badge({ emoji: S.marker.emoji, label: S.marker.label, cls: 'focus' }) });
    rings.push({ lat: S.marker.lat, lng: S.marker.lng, color: S.marker.color });
  }
  world.arcsData(arcs).pathsData(paths).ringsData(rings).htmlElementsData(html);
}
function setMarker(m) { S.marker = m; applyLayers(); }

// ---------- Changement de filtre ----------
function setMode(mode, { keepPanel = true } = {}) {
  S.mode = mode; S.focusArc = null; S.marker = null;
  document.body.dataset.mode = mode;
  document.querySelectorAll('.chip').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  refreshPolygons();
  applyLayers();
  renderHighlights();
  renderLegend();
  if (keepPanel && S.panel?.kind === 'country') renderCountry(S.panel.iso);
  else if (S.panel && S.panel.kind !== 'country') closePanel();
}
$('#filters').addEventListener('click', (e) => { const b = e.target.closest('.chip'); if (b) setMode(b.dataset.mode); });

// ---------- Caméra ----------
function flyTo(lat, lng, alt = 1.7) {
  controls.autoRotate = false;
  const mob = isMobile();
  // décale la caméra pour que la zone reste visible à côté du panneau (droite sur ordi, bas sur mobile)
  const a = mob ? Math.max(alt, 1.9) : alt;
  world.pointOfView({ lat: mob ? lat - 9 * a : lat, lng: (!mob && S.panel) ? lng + 9 * a : lng, altitude: a }, 1100);
}

// ---------- Panneau ----------
const panel = $('#panel'), pc = $('#panelContent');
function openPanel() { panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false'); }
function closePanel() {
  S.panel = null; S.selected = null; S.focusArc = null;
  panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true');
  refreshPolygons(); setMarker(null); scheduleRotate();
}
$('#panelClose').addEventListener('click', closePanel);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

async function loadNews(iso) {
  if (S.newsCache[iso]) return S.newsCache[iso];
  try {
    const r = await fetch(`data/news/${iso}.json`, { cache: 'no-cache' });
    if (!r.ok) throw 0;
    return (S.newsCache[iso] = await r.json());
  } catch { return (S.newsCache[iso] = { all: [], good: [], eco: [], foot: [] }); }
}

function newsList(items, { tags = true, max = 30 } = {}) {
  if (!items?.length) return '';
  const TAGS = { geo: 'Géopo', eco: 'Éco', foot: 'Foot', good: 'Good' };
  return `<ul class="news">${items.slice(0, max).map(i => `
    <li><a href="${esc(i.u)}" target="_blank" rel="noopener">
      <div class="t">${esc(i.t)}</div>
      <div class="m"><span>${esc(i.s)}</span><span>·</span><span>${ago(i.d)}</span>
        ${tags ? (i.g || []).map(g => `<span class="tag ${g}">${TAGS[g]}</span>`).join('') : ''}</div>
    </a></li>`).join('')}</ul>`;
}

function headCountry(f) {
  const p = f.properties, fu = flagUrl(p.iso);
  return `<div class="p-head">
    ${fu ? `<img class="p-flag" src="${fu}" alt="">` : '<div class="p-flag">🌐</div>'}
    <div><div class="p-name">${esc(p.name)}</div>
    <div class="p-meta">${CONTINENT_FR[p.continent] || ''}${p.pop ? ' · ' + popFmt.format(p.pop) + ' hab.' : ''}</div></div>
  </div>`;
}

async function openCountry(iso) {
  const f = S.byIso[iso]; if (!f) return;
  S.panel = { kind: 'country', iso }; S.selected = iso; S.focusArc = null;
  refreshPolygons(); if (S.marker) setMarker(null); else world.arcColor(world.arcColor());
  openPanel();
  flyTo(f.properties.lat, f.properties.lng);
  pc.innerHTML = headCountry(f) + '<div class="empty" style="margin-top:20px">Chargement des actus…</div>';
  await loadNews(iso);
  if (S.panel?.iso === iso) renderCountry(iso);
}

function renderCountry(iso) {
  const f = S.byIso[iso], n = S.newsCache[iso] || { all: [], good: [], eco: [], foot: [] };
  const geoNews = n.all.filter(i => i.g?.includes('geo'));
  const zones = zonesOf(iso), fb = S.daily?.football?.[iso], trs = transfersOf(iso), dls = dealsOf(iso);
  const tabs = [
    ['all', `🌍 Tout<span class="n">${n.all.length}</span>`],
    ['good', `🌈 Good<span class="n">${n.good.length}</span>`],
    ['geo', `⚔️ Géopo<span class="n">${zones.length + geoNews.length}</span>`],
    ['foot', `⚽ Foot<span class="n">${(fb ? 1 : 0) + trs.length + n.foot.length}</span>`],
    ['eco', `💼 Éco<span class="n">${dls.length + n.eco.length}</span>`],
  ];
  let body = '';
  const m = S.mode;
  if (m === 'all') {
    body = `<div class="sec-title">Actus des derniers jours</div>` + (newsList(n.all) || `<div class="empty">Aucune actu en français trouvée pour ce pays ces 3 derniers jours.</div>`);
  } else if (m === 'good') {
    body = `<div class="sec-title">Bonnes nouvelles de la semaine</div>` + (newsList(n.good, { tags: false }) || `<div class="empty">Pas de bonne nouvelle repérée cette semaine 🤷<br><small>Le tri est automatique : il sera plus fin avec une IA (voir feuille de route).</small></div>`);
  } else if (m === 'geo') {
    body = (zones.length ? `<div class="sec-title">Zones de tension suivies</div>` + zones.map(z => zoneCard(z, { compact: true })).join('') : '')
      + `<div class="sec-title">Actus géopolitiques</div>` + (newsList(geoNews) || `<div class="empty">Rien de notable repéré ces derniers jours ${zones.length ? '' : '✅'}</div>`);
  } else if (m === 'foot') {
    body = (fb ? standings(fb) : '')
      + (trs.length ? `<div class="sec-title">Mercato d'été 2026</div>` + trs.map((t) => transferCard(S.transfers.transfers.indexOf(t))).join('') : '')
      + `<div class="sec-title">Actus foot</div>` + (newsList(n.foot, { tags: false }) || `<div class="empty">${fb ? 'Pas d\'actu foot récente.' : 'Ce pays n\'a pas encore de championnat suivi dans le MVP.'}</div>`);
  } else if (m === 'eco') {
    body = (dls.length ? `<div class="sec-title">Grands rachats</div>` + dls.map(d => dealCard(d)).join('') : '')
      + `<div class="sec-title">Actus économie & entreprises</div>` + (newsList(n.eco) || `<div class="empty">Pas d'actu éco récente.</div>`);
  }
  pc.innerHTML = headCountry(f)
    + `<div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${k === m ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>`
    + body;
  pc.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setMode(b.dataset.tab)));
  bindCards();
  pc.scrollTop = 0;
}

function standings(fb) {
  const rows = fb.rows.slice(0, 10);
  return `<div class="sec-title">🏆 ${esc(fb.league)} ${fb.group ? '· ' + esc(fb.group) : ''}</div>
  <table class="standings"><thead><tr><th>#</th><th style="text-align:left">Équipe</th><th>J</th><th>V</th><th>N</th><th>D</th><th>Diff</th><th>Pts</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="${r.r <= 3 ? 'top' : ''}"><td>${r.r}</td><td class="team">${r.logo ? `<img src="${esc(r.logo)}" alt="" loading="lazy">` : ''}${esc(r.team)}</td><td>${r.pj ?? ''}</td><td>${r.v ?? ''}</td><td>${r.n ?? ''}</td><td>${r.d ?? ''}</td><td>${r.diff ?? ''}</td><td class="pts">${r.pts ?? ''}</td></tr>`).join('')}
  </tbody></table>`;
}

function zoneCard(z, { compact = false } = {}) {
  const t = S.geo.types[z.type];
  const live = S.daily?.zoneNews?.[z.id] || [];
  const sevTxt = { 3: 'Gravité élevée', 2: 'Gravité moyenne', 1: 'À surveiller' }[z.severity];
  return `<div class="zone s${z.severity}">
    <div class="zone-h"><div class="zone-ico">${t.icon}</div><div><div class="zone-name">${esc(z.name)}</div><div class="zone-type">${esc(t.label)}</div></div></div>
    <span class="pill s${z.severity}">${sevTxt}</span>${z.status ? `<span class="pill grey">${esc(z.status)}</span>` : ''}<span class="pill grey">Depuis : ${esc(z.since)}</span>
    <p>${esc(z.summary)}</p>
    ${!compact ? `<div class="chips-c">${[...z.countries, ...(z.related || [])].map(c => S.byIso[c] ? `<button data-country="${c}">${esc(S.byIso[c].properties.name)}</button>` : '').join('')}</div>` : `<div class="chips-c"><button data-zone="${z.id}">Voir sur le globe →</button></div>`}
    ${live.length ? `<div class="live"><div class="live-h">En direct · 7 derniers jours</div>${newsList(live.slice(0, compact ? 3 : 6), { tags: false })}</div>` : ''}
    <div class="srcs" style="margin-top:8px">Sources : ${z.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</div>
  </div>`;
}

function transferCard(i) {
  const t = S.transfers.transfers[i];
  return `<button class="transfer" data-transfer="${i}">
    <div class="tr-player">${esc(t.player)} <span style="font-weight:700;color:var(--ink-3);font-size:13px">· ${esc(t.pos)}</span></div>
    <div class="tr-route">${esc(t.from.club)} <span class="tr-arrow">➜</span> ${esc(t.to.club)}</div>
    <span class="tr-fee">${esc(t.fee)}</span>${t.highlight ? ` <span class="pill grey">${esc(t.highlight)}</span>` : ''}
  </button>`;
}

function dealCard(d, full = false) {
  const live = S.daily?.dealNews?.[d.id] || [];
  return `<div class="deal" ${full ? '' : `data-deal="${d.id}" role="button" tabindex="0"`}>
    <div class="tr-player">${esc(d.buyer.name)} <span class="tr-arrow">➜</span> ${esc(d.target.name)}</div>
    <div class="tr-route" style="font-weight:700;color:var(--ink-2);font-size:13px">${esc(d.buyer.city)} → ${esc(d.target.city)} · ${esc(d.sector)}</div>
    <span class="tr-fee">${esc(d.amount)}</span> <span class="pill grey">${esc(d.status)} · ${esc(d.date)}</span>
    ${full ? `<p>${esc(d.summary)}</p>
      ${live.length ? `<div class="live"><div class="live-h">Dans la presse</div>${newsList(live, { tags: false })}</div>` : ''}
      <div class="srcs" style="margin-top:8px">Source : <a href="${esc(d.source.url)}" target="_blank" rel="noopener">${esc(d.source.name)}</a></div>
      <div class="chips-c">${[d.buyer.iso, d.target.iso].filter((v, i, a) => a.indexOf(v) === i).map(c => S.byIso[c] ? `<button data-country="${c}">${esc(S.byIso[c].properties.name)}</button>` : '').join('')}</div>` : ''}
  </div>`;
}

function bindCards(root = pc) {
  root.querySelectorAll('[data-country]').forEach(b => b.addEventListener('click', () => openCountry(b.dataset.country)));
  root.querySelectorAll('[data-zone]').forEach(b => b.addEventListener('click', () => openZone(b.dataset.zone)));
  root.querySelectorAll('[data-transfer]').forEach(b => b.addEventListener('click', () => openTransfer(+b.dataset.transfer)));
  root.querySelectorAll('[data-deal]').forEach(b => b.addEventListener('click', () => openDeal(b.dataset.deal)));
}

function openZone(id) {
  const z = S.geo.zones.find(z => z.id === id); if (!z) return;
  if (S.mode !== 'geo') setMode('geo', { keepPanel: false });
  S.panel = { kind: 'zone', id }; S.selected = null; S.focusArc = null;
  refreshPolygons(); if (S.marker) setMarker(null); else world.arcColor(world.arcColor());
  pc.innerHTML = `<div class="sec-title" style="margin-top:4px">Zone de tension</div>` + zoneCard(z)
    + `<p class="srcs">Fiche mise à jour le ${new Date(S.geo.updatedAt).toLocaleDateString('fr-FR')}. ${esc(S.geo.note)}</p>`;
  bindCards(); openPanel(); pc.scrollTop = 0;
  flyTo(z.ring ? z.ring[0] : z.lat, z.ring ? z.ring[1] : z.lng, z.type === 'maritime' ? 0.75 : 1.3);
}

function openTransfer(i) {
  const t = S.transfers.transfers[i]; if (!t) return;
  if (S.mode !== 'foot') setMode('foot', { keepPanel: false });
  S.panel = { kind: 'transfer', i }; S.selected = null; S.focusArc = 't' + i;
  refreshPolygons();
  setMarker({ lat: t.to.lat, lng: t.to.lng, emoji: '🏁', label: `${t.player} ➜ ${t.to.club}`, color: '28,140,246' });
  pc.innerHTML = `<div class="sec-title" style="margin-top:4px">🔁 ${esc(S.transfers.window)}</div>` + transferCard(i)
    + `<div class="chips-c">${[t.from.iso, t.to.iso].filter((v, k, a) => a.indexOf(v) === k).map(c => `<button data-country="${c}">Foot en ${esc(S.byIso[c]?.properties.name)}</button>`).join('')}</div>`
    + `<p class="srcs" style="margin-top:14px">${esc(S.transfers.note)}<br>Sources : ${S.transfers.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(' · ')}</p>`;
  bindCards(); openPanel();
  flyTo((t.from.lat + t.to.lat) / 2, (t.from.lng + t.to.lng) / 2, 0.9);
}

function openDeal(id) {
  const d = S.deals.deals.find(d => d.id === id); if (!d) return;
  if (S.mode !== 'eco') setMode('eco', { keepPanel: false });
  S.panel = { kind: 'deal', id }; S.selected = null; S.focusArc = id;
  refreshPolygons();
  setMarker({ lat: d.target.lat, lng: d.target.lng, emoji: '🎯', label: `${d.target.name} (${d.amount})`, color: '108,60,240' });
  pc.innerHTML = `<div class="sec-title" style="margin-top:4px">💼 Rachat / fusion</div>` + dealCard(d, true);
  bindCards(); openPanel(); pc.scrollTop = 0;
  const dLng = Math.abs(d.buyer.lng - d.target.lng);
  flyTo((d.buyer.lat + d.target.lat) / 2, (d.buyer.lng + d.target.lng) / 2, dLng > 60 ? 2.2 : 1.3);
}

// ---------- Carte « À la une » ----------
const hl = $('#highlights');
function renderHighlights() {
  const m = S.mode, body = $('#hlBody');
  $('#hlTitle').textContent = MODES[m].title;
  $('#hlFabLabel').textContent = m === 'all' ? 'À la une' : 'Liste';
  let h = '';
  if (m === 'all') {
    h = `<p class="hl-intro">Fais tourner le globe 👆 et touche un pays pour voir ses actus du jour. Les filtres changent ce que montre la carte.</p>
      <div class="hl-section">Essaie</div>
      <div class="quick">${['FR', 'UA', 'IR', 'CD', 'US', 'JP', 'BR', 'SN'].map(c => S.byIso[c] ? `<button data-country="${c}">${esc(S.byIso[c].properties.name)}</button>` : '').join('')}</div>
      <div class="hl-section">Points chauds</div>`
      + S.geo.zones.filter(z => z.severity === 3).slice(0, 5).map(z => item(S.geo.types[z.type].icon, z.name, z.status || S.geo.types[z.type].label, `data-zone="${z.id}"`)).join('');
  } else if (m === 'good') {
    const top = Object.entries(S.daily?.counts || {}).filter(([iso, c]) => c.topGood && S.byIso[iso]).sort((a, b) => (b[1].mood ?? 0) - (a[1].mood ?? 0)).slice(0, 12);
    h = `<p class="hl-intro">Plus un pays est vert, plus son actu des derniers jours est positive. Voici ceux où ça va le mieux :</p>`
      + top.map(([iso, c]) => item(flagImg(iso), S.byIso[iso]?.properties.name, c.topGood, `data-country="${iso}"`)).join('');
  } else if (m === 'geo') {
    h = [...S.geo.zones].sort((a, b) => b.severity - a.severity).map(z => item(S.geo.types[z.type].icon, z.name, ({ 3: '🔴 Gravité élevée', 2: '🟠 Gravité moyenne', 1: '🟡 À surveiller' }[z.severity]) + (z.status ? ' · ' + z.status : ''), `data-zone="${z.id}"`)).join('')
      + `<p class="hl-intro" style="margin-top:10px;font-size:12px">Fiches sourcées, mises à jour le ${new Date(S.geo.updatedAt).toLocaleDateString('fr-FR')} · titres « en direct » mis à jour chaque jour.</p>`;
  } else if (m === 'foot') {
    h = (S.transfers?.transfers || []).map((t, i) => item('🔁', t.player, `${t.from.club} → ${t.to.club} · ${t.fee}`, `data-transfer="${i}"`)).join('')
      + `<div class="hl-section">Championnats (${Object.keys(S.daily?.football || {}).length})</div>`
      + Object.entries(S.daily?.football || {}).map(([iso, fb]) => item(fb.rows[0]?.logo ? `<img src="${esc(fb.rows[0].logo)}" alt="">` : '⚽', `${S.byIso[iso]?.properties.name} · ${fb.league}`, `1er : ${fb.rows[0]?.team} (${fb.rows[0]?.pts} pts)`, `data-country="${iso}"`)).join('');
  } else if (m === 'eco') {
    h = (S.deals?.deals || []).map(d => item('💼', `${d.buyer.name} → ${d.target.name}`, `${d.amount} · ${d.sector} · ${d.status}`, `data-deal="${d.id}"`)).join('')
      + `<p class="hl-intro" style="margin-top:10px;font-size:12px">💼 acheteur · 🎯 cible. Clique un pays pour voir ses actus économiques.</p>`;
  }
  body.innerHTML = h;
  bindCards(body);
  body.querySelectorAll('[data-country],[data-zone],[data-transfer],[data-deal]').forEach(b => b.addEventListener('click', () => { if (isMobile()) toggleHl(false); }));
}
function flagImg(iso) { const u = flagUrl(iso); return u ? `<img src="${u}" alt="" style="border-radius:4px;object-fit:cover">` : '🌐'; }
function item(icon, title, sub, attrs) {
  return `<button class="hl-item" ${attrs}><span class="hl-ico">${icon}</span><span class="hl-main"><div class="hl-title">${esc(title)}</div>${sub ? `<div class="hl-sub">${esc(sub)}</div>` : ''}</span></button>`;
}
$('#hlToggle').addEventListener('click', () => { hl.classList.toggle('collapsed'); $('#hlToggle').textContent = hl.classList.contains('collapsed') ? '+' : '–'; });
function toggleHl(force) {
  const open = force ?? !hl.classList.contains('mobile-open');
  hl.classList.toggle('mobile-open', open); document.body.classList.toggle('hl-open', open);
}
$('#hlFab').addEventListener('click', () => toggleHl());

// ---------- Légende ----------
function renderLegend() {
  const m = S.mode, L = $('#legend');
  const sw = (c, t) => `<span class="lg"><span class="sw" style="background:${c}"></span>${t}</span>`;
  const ln = (c, t) => `<span class="lg"><span class="ln" style="background:${c}"></span>${t}</span>`;
  if (m === 'geo') {
    L.innerHTML = `<div class="lg-title">Comment lire la carte</div><div class="lg-row">
      ${sw(SEV_COLORS[3], 'Grave')}${sw(SEV_COLORS[2], 'Moyen')}${sw(SEV_COLORS[1], 'À surveiller')}${sw(RELATED, 'Concerné')}</div>
      <div class="lg-row" style="margin-top:6px">${Object.values(S.geo.types).map(t => `<span class="lg">${t.icon} ${t.label}</span>`).join('')}</div>
      <div class="lg-row" style="margin-top:6px">${ln('#e11d48', 'Flèche = offensive / frappes')}${ln('repeating-linear-gradient(90deg,#e11d48 0 5px,transparent 5px 8px)', 'Passage bloqué')}</div>`;
  } else if (m === 'good') {
    L.innerHTML = `<div class="lg-title">Humeur de l'actu (analyse automatique des titres)</div><div class="lg-row">${sw(moodColor(-0.6), 'Sombre')}${sw(moodColor(-0.2), '')}${sw(moodColor(0.1), '')}${sw(moodColor(0.4), 'Positive')}</div>`;
  } else if (m === 'foot') {
    L.innerHTML = `<div class="lg-row">${sw('#6fd66f', 'Championnat suivi')}${ln('linear-gradient(90deg,#9be36b,#0ea5e9)', 'Transfert (vers le bleu = club d\'arrivée)')}<span class="lg">Logo = leader du championnat</span></div>`;
  } else if (m === 'eco') {
    L.innerHTML = `<div class="lg-row">${sw('#a99bff', 'Pays concerné')}${ln('linear-gradient(90deg,#c9bfff,#6c3cf0)', 'Rachat (acheteur → cible)')}</div>`;
  } else {
    L.innerHTML = `<div class="lg-row">${Object.entries(CONTINENT_COLORS).slice(0, 6).map(([k, c]) => sw(c, CONTINENT_FR[k])).join('')}</div>`;
  }
}

$('#legend').addEventListener('click', () => $('#legend').classList.toggle('expanded'));

// ---------- Recherche ----------
const search = $('#search');
function doSearch() {
  const v = norm(search.value); if (!v) return;
  const f = S.features.find(f => norm(f.properties.name) === v) || S.features.find(f => norm(f.properties.name).startsWith(v)) || S.features.find(f => norm(f.properties.name).includes(v));
  if (f) { openCountry(f.properties.iso); search.value = ''; search.blur(); }
}
search.addEventListener('change', doSearch);
search.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });

// ---------- Chargement des données ----------
async function getJSON(u, fallback) { try { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw 0; return await r.json(); } catch { return fallback; } }

(async function init() {
  const [geojson, daily, geo, deals, transfers] = await Promise.all([
    getJSON('data/countries.geojson', { features: [] }),
    getJSON('data/daily.json', null),
    getJSON('data/geopolitics.json', { zones: [], types: {} }),
    getJSON('data/business.json', { deals: [] }),
    getJSON('data/transfers.json', { transfers: [] }),
  ]);
  S.features = geojson.features; S.daily = daily; S.geo = geo; S.deals = deals; S.transfers = transfers;
  for (const f of S.features) S.byIso[f.properties.iso] = f;
  $('#countryList').innerHTML = [...S.features].sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'fr')).map(f => `<option value="${esc(f.properties.name)}">`).join('');
  $('#updated').textContent = daily?.updatedAt
    ? 'Actus du ' + new Date(daily.updatedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Données de démonstration';
  world.polygonsData(S.features);
  setMode(new URLSearchParams(location.search).get('mode') || 'all');
  setTimeout(() => $('#loader').classList.add('hide'), 300);
  setTimeout(() => $('#loader').remove(), 900);
  const c = new URLSearchParams(location.search).get('pays'); if (c) openCountry(c.toUpperCase());
})();

// ---------- Web app (hors ligne / installation) ----------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
})();
