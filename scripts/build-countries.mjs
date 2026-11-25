// À lancer une seule fois : télécharge les frontières (Natural Earth 1:110m)
// et écrit data/countries.geojson (allégé) + scripts/countries.json.
// Usage : node scripts/build-countries.mjs .
import { writeFileSync, mkdirSync } from 'node:fs';
const out = process.argv[2] || '.';
mkdirSync(out + '/data', { recursive: true });
const r = await fetch('https://cdn.jsdelivr.net/gh/vasturiano/globe.gl/example/datasets/ne_110m_admin_0_countries.geojson');
const j = await r.json();
const dn = new Intl.DisplayNames(['fr'], { type: 'region' });
const round = (c) => Array.isArray(c[0]) ? c.map(round) : [Math.round(c[0] * 100) / 100, Math.round(c[1] * 100) / 100];
const feats = [];
const list = [];
for (const f of j.features) {
  const p = f.properties;
  let iso = p.ISO_A2 !== '-99' ? p.ISO_A2 : (p.WB_A2 && p.WB_A2 !== '-99' ? p.WB_A2 : null);
  if (p.ADMIN === 'France') iso = 'FR';
  if (p.ADMIN === 'Norway') iso = 'NO';
  if (p.ADMIN === 'Kosovo') iso = 'XK';
  if (p.ADMIN === 'Northern Cyprus') iso = 'CY-N';
  if (p.ADMIN === 'Somaliland') iso = 'SO-S';
  if (!iso || p.ADMIN === 'Antarctica') { if (p.ADMIN === 'Antarctica') iso = 'AQ'; else continue; }
  let nameFr;
  try { nameFr = dn.of(iso); } catch { nameFr = null; }
  if (!nameFr || nameFr === iso) nameFr = { 'XK': 'Kosovo', 'CY-N': 'Chypre du Nord', 'SO-S': 'Somaliland', 'AQ': 'Antarctique' }[iso] || p.NAME;
  nameFr = { CD: 'RD Congo', CG: 'Congo', MM: 'Birmanie', PS: 'Palestine', VN: 'Vietnam', TF: 'Terres australes', FK: 'Îles Malouines' }[iso] || nameFr;
  // centre approximatif = centroïde du plus grand anneau extérieur
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let best = null, bestA = -1;
  for (const poly of polys) {
    const ring = poly[0]; let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[i + 1]; const k = x0 * y1 - x1 * y0;
      a += k; cx += (x0 + x1) * k; cy += (y0 + y1) * k;
    }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [cy / (3 * a), cx / (3 * a)]; }
  }
  const [lat, lng] = best.map(v => Math.round(v * 100) / 100);
  feats.push({ type: 'Feature', properties: { iso, name: nameFr, continent: p.CONTINENT, pop: p.POP_EST, color: p.MAPCOLOR7, lat, lng }, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } });
  list.push({ iso, name: nameFr, en: p.NAME, continent: p.CONTINENT, pop: p.POP_EST, lat, lng });
}
writeFileSync(out + '/data/countries.geojson', JSON.stringify({ type: 'FeatureCollection', features: feats }));
writeFileSync(out + '/scripts/countries.json', JSON.stringify(list, null, 1));
console.log(feats.length, 'countries');
console.log(list.filter(c => c.name === c.en).map(c => c.iso + ':' + c.name).join(' | '));
