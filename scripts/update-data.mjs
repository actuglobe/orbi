// =============================================================
//  Collecte quotidienne des données (lancée chaque matin par GitHub Actions)
//  - Actualités par pays : Google Actualités (flux RSS, en français)
//  - Classements de foot : API publique ESPN
//  - Actus liées aux zones de tension : Google Actualités
//  Résultat : data/daily.json (résumé) + data/news/<PAYS>.json (lus par le site)
//  Usage : node scripts/update-data.mjs
// =============================================================
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const countries = JSON.parse(readFileSync(ROOT + 'scripts/countries.json', 'utf8'));
const geopolitics = JSON.parse(readFileSync(ROOT + 'data/geopolitics.json', 'utf8'));
const deals = JSON.parse(readFileSync(ROOT + 'data/business.json', 'utf8'));
const QUICK = process.argv.includes('--quick'); // pour tester : 12 pays seulement

// ---------- Termes de recherche (quand le nom seul est ambigu) ----------
const QUERY = {
  US: '"États-Unis"', GB: '"Royaume-Uni"', CD: '(RDC OR "RD Congo")', CG: '"Congo-Brazzaville"',
  PS: '(Gaza OR Cisjordanie OR Palestiniens)', MM: 'Birmanie', KR: '"Corée du Sud"', KP: '"Corée du Nord"',
  CI: '"Côte d\'Ivoire"', EH: '"Sahara occidental"', SV: '"Salvador" Bukele', GE: 'Géorgie Tbilissi',
  NE: 'Niger -Nigeria', GN: '"Guinée" Conakry', TF: '"Terres australes"', CY: 'Chypre', 'CY-N': '"Chypre du Nord"',
  AQ: 'Antarctique', FK: 'Malouines', TL: '"Timor oriental"', SZ: 'Eswatini', CZ: '(Tchéquie OR "République tchèque")',
  AE: '"Émirats arabes unis"', SA: '"Arabie saoudite"', ZA: '"Afrique du Sud"', NZ: '"Nouvelle-Zélande"',
  JO: 'Jordanie', SS: '"Soudan du Sud"', SD: 'Soudan -"Soudan du Sud"',
};
const q = (c) => QUERY[c.iso] || (c.name.includes(' ') || c.name.includes('-') ? `"${c.name}"` : c.name);

// ---------- Classement automatique des titres ----------
const RX = {
  geo: /guerre|conflit|arm[ée]e|militaire|soldat|frapp|bombard|missile|drone|attaque|otage|cessez-le-feu|sanction|diplomat|sommet|n[ée]gociation|[ée]lection|coup d'[ÉE]tat|rebelle|terror|jihad|djihad|r[ée]fugi|fronti[èe]re|nucl[ée]aire|OTAN|ONU|tension|blocus|invasion|offensive|manifest|r[ée]pression|ministre|pr[ée]sident/i,
  eco: /entreprise|rachat|rach[èe]te|acquisition|fusion|milliard|bourse|PIB|inflation|[ée]conomi|croissance|investiss|usine|emploi|licenci|march[ée]|export|douane|droits de douane|tarif|start-?up|PDG|chiffre d'affaires|banque|p[ée]trole|gaz|industri|commerce|budget|dette|taux|salari/i,
  foot: /football|\bfoot\b|ligue 1|premier league|liga|serie a|bundesliga|ligue des champions|mercato|attaquant|milieu|d[ée]fenseur|gardien|entra[îi]neur|s[ée]lection(neur)?|coupe du monde|\bCAN\b|ballon d'or|\bbut(s)?\b|PSG|OM\b|Real Madrid|Bar[çc]a/i,
};
const POS = /record|succ[èe]s|r[ée]ussi|victoire|remporte|sauv[ée]|sauvetage|gu[ée]ri|d[ée]couv|innov|inaugur|solidarit|\bpaix\b|lib[ée]r[ée]s?\b|progr[èe]s|laur[ée]at|r[ée]compens|prot[ée]g|espoir|renaiss|r[ée]habilit|reboise|naissance|f[êe]te|c[ée]l[ée]br|h[ée]ro|g[ée]n[ée]reu|b[ée]n[ée]vol|exploit|premi[èe]re mondiale|r[ée]ouv|baisse du ch[ôo]mage|vaccin|biodiversit|m[ée]daille|champion|sacr[ée]|qualifi|primé|bonne nouvelle/i;
const NEG = /mort|tu[ée]s?\b|d[ée]c[èe]s|victime|bless|attaque|guerre|crise|drame|explos|incendie|accident|chute|effondr|menace|condamn|violen|inqui[ée]t|meurtre|\bviol|arrest|pol[ée]mique|scandale|catastroph|s[ée]isme|inondation|famine|[ée]pid[ée]mie|faillite|licenci|gr[èe]ve|terror|bombard|frappe|d[ée]faite|perd|recul|alerte|danger|disparu|enl[èe]v|otage|fraude|corruption|proc[èe]s|pire|tension|sanction|expuls|aucun|\bpas\b|\bplus de\b|\bfin aux?\b|barrage|[ée]chec|refus|rejet|suspen|co[ûu]t|d[ée]ficit|pol[ée]mique|accus|plainte|enqu[êe]te|interdi|\bsans\b/i;
const isGood = (t) => POS.test(t) && !NEG.test(t);
const tagsOf = (t) => Object.keys(RX).filter(k => RX[k].test(t)).concat(isGood(t) ? ['good'] : []);

// ---------- Outils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const decode = (s) => s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GlobeNewsMVP/1.0)' } });
      if (r.ok) return await r.text();
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (i + 1)); continue; }
      return null;
    } catch { await sleep(1500 * (i + 1)); }
  }
  return null;
}

async function gnews(query, { days = 3, max = 10 } = {}) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ` when:${days}d`)}&hl=fr&gl=FR&ceid=FR:fr`;
  const xml = await get(url);
  if (!xml) return [];
  const items = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const it = m[1];
    const pick = (tag) => (it.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)) || [])[1];
    let title = decode(pick('title') || '');
    const source = decode(pick('source') || '');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    const key = title.toLowerCase().slice(0, 60);
    if (!title || seen.has(key)) continue;
    seen.add(key);
    items.push({ t: title, s: source, u: decode(pick('link') || ''), d: new Date(pick('pubDate')).toISOString() });
  }
  items.sort((a, b) => b.d.localeCompare(a.d));
  return items.slice(0, max);
}

async function pool(list, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < list.length) { const k = i++; out[k] = await fn(list[k], k); await sleep(250); }
  }));
  return out;
}

// ---------- 1. Actus par pays ----------
const LEAGUES = {
  FR: ['fra.1', 'Ligue 1'], GB: ['eng.1', 'Premier League'], ES: ['esp.1', 'LaLiga'], DE: ['ger.1', 'Bundesliga'],
  IT: ['ita.1', 'Serie A'], PT: ['por.1', 'Liga Portugal'], NL: ['ned.1', 'Eredivisie'], BE: ['bel.1', 'Pro League'],
  TR: ['tur.1', 'Süper Lig'], SA: ['ksa.1', 'Saudi Pro League'], US: ['usa.1', 'MLS'], MX: ['mex.1', 'Liga MX'],
  BR: ['bra.1', 'Brasileirão'], AR: ['arg.1', 'Liga Profesional'], JP: ['jpn.1', 'J1 League'], AU: ['aus.1', 'A-League'],
  AT: ['aut.1', 'Bundesliga autrichienne'], DK: ['den.1', 'Superliga'], GR: ['gre.1', 'Super League'], SE: ['swe.1', 'Allsvenskan'],
  NO: ['nor.1', 'Eliteserien'], RU: ['rus.1', 'Premier Liga'], CN: ['chn.1', 'Super League chinoise'], ZA: ['rsa.1', 'Premiership'],
  NG: ['nga.1', 'NPFL'], UY: ['uru.1', 'Primera División'], PE: ['per.1', 'Liga 1'], CL: ['chi.1', 'Primera División'], PY: ['par.1', 'Primera División'],
};

const list = QUICK ? countries.filter(c => ['FR', 'US', 'UA', 'RU', 'CD', 'IR', 'JP', 'BR', 'PS', 'GB', 'DE', 'ES'].includes(c.iso)) : countries;
console.log(`Actualités : ${list.length} pays…`);
const news = {};
await pool(list, 4, async (c) => {
  const name = q(c);
  const all = await gnews(name, { days: 3, max: 12 });
  const good = (await gnews(`${name} (record OR succès OR découverte OR inauguration OR solidarité OR innovation OR sauvetage OR victoire OR espoir OR médaille OR "bonne nouvelle")`, { days: 7, max: 40 })).filter(i => isGood(i.t)).slice(0, 8);
  const eco = await gnews(`${name} (entreprise OR économie OR rachat OR investissement OR milliards)`, { days: 7, max: 8 });
  const foot = LEAGUES[c.iso] ? await gnews(`${name} football`, { days: 4, max: 8 }) : [];
  const tag = (arr) => arr.map(i => ({ ...i, g: tagsOf(i.t) }));
  // on complète les "good news" avec les titres positifs du flux général
  const goodAll = [...good, ...all.filter(i => isGood(i.t) && !good.some(g => g.t === i.t))].slice(0, 8);
  news[c.iso] = { all: tag(all), good: tag(goodAll), eco: tag(eco), foot: tag(foot) };
  process.stdout.write(`${c.iso}(${all.length}/${goodAll.length}) `);
});
console.log();

// ---------- 2. Classements de foot ----------
console.log('Classements de foot…');
const football = {};
await pool(Object.entries(LEAGUES), 4, async ([iso, [code, label]]) => {
  const txt = await get(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`);
  if (!txt) return;
  try {
    const j = JSON.parse(txt);
    const ch = j.children?.[0];
    const rows = (ch?.standings?.entries || []).map(e => {
      const st = Object.fromEntries((e.stats || []).map(s => [s.name, s.displayValue]));
      return { r: +st.rank || 0, team: e.team.shortDisplayName || e.team.displayName, logo: e.team.logos?.[0]?.href || '', pj: st.gamesPlayed, v: st.wins, n: st.ties, d: st.losses, diff: st.pointDifferential, pts: st.points };
    }).sort((a, b) => (a.r || 99) - (b.r || 99));
    if (rows.length) football[iso] = { league: label, season: ch.name, group: ch.name?.match(/Conference|Group|Groupe/) ? ch.name : null, rows };
  } catch { }
});

// ---------- 3. Actus des zones de tension et des rachats ----------
console.log('Zones de tension & rachats…');
const zoneNews = {};
await pool(geopolitics.zones, 3, async (z) => { zoneNews[z.id] = await gnews(z.query, { days: 7, max: 6 }); });
const dealNews = {};
await pool(deals.deals, 3, async (d) => { if (d.query) dealNews[d.id] = await gnews(d.query, { days: 30, max: 4 }); });

// Un petit fichier résumé (chargé au démarrage) + un fichier par pays (chargé au clic)
mkdirSync(ROOT + 'data/news', { recursive: true });
const counts = {};
for (const [iso, v] of Object.entries(news)) {
  writeFileSync(ROOT + `data/news/${iso}.json`, JSON.stringify(v));
  // « humeur » : part des titres positifs moins part des titres négatifs dans le flux général (-1 à +1)
  const n = v.all.length || 1;
  const pos = v.all.filter(i => isGood(i.t)).length, neg = v.all.filter(i => NEG.test(i.t)).length;
  const mood = Math.round(((pos - neg) / n) * 100) / 100;
  counts[iso] = { all: v.all.length, good: v.good.length, eco: v.eco.length, foot: v.foot.length, mood, top: v.all[0]?.t || '', topGood: v.good[0]?.t || '' };
}
const out = { updatedAt: new Date().toISOString(), counts, football, zoneNews, dealNews };
writeFileSync(ROOT + 'data/daily.json', JSON.stringify(out));
const n = Object.values(news).reduce((s, v) => s + v.all.length, 0);
console.log(`OK : ${n} articles, ${Object.keys(football).length} championnats → data/daily.json`);
