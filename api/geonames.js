// Place lookups via GeoNames.
//   ?type=reverse&lat=..&lng=..&zoom=..  → nearest place name for a map click
//   ?q=Hudson, NY                        → town/city search for the search boxes

// US states, so "Hudson, NY" or "Hudson, New York" searches only New York.
const US_STATES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',
  DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',
  IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',
  NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',
  NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',
  RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',
  VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
};

// Common country names and nicknames → ISO code ("Paris, France", "Leeds, UK").
const COUNTRIES = {
  'united states':'US','usa':'US','us':'US','america':'US','united kingdom':'GB','uk':'GB','england':'GB',
  'scotland':'GB','wales':'GB','northern ireland':'GB','great britain':'GB','britain':'GB','ireland':'IE',
  'canada':'CA','mexico':'MX','france':'FR','spain':'ES','portugal':'PT','italy':'IT','germany':'DE',
  'netherlands':'NL','holland':'NL','belgium':'BE','switzerland':'CH','austria':'AT','denmark':'DK',
  'sweden':'SE','norway':'NO','finland':'FI','iceland':'IS','poland':'PL','czechia':'CZ',
  'czech republic':'CZ','hungary':'HU','greece':'GR','turkey':'TR','croatia':'HR','romania':'RO',
  'russia':'RU','ukraine':'UA','israel':'IL','egypt':'EG','morocco':'MA','south africa':'ZA',
  'nigeria':'NG','kenya':'KE','ghana':'GH','india':'IN','china':'CN','japan':'JP','south korea':'KR',
  'korea':'KR','taiwan':'TW','hong kong':'HK','singapore':'SG','thailand':'TH','vietnam':'VN',
  'indonesia':'ID','philippines':'PH','malaysia':'MY','australia':'AU','new zealand':'NZ',
  'brazil':'BR','argentina':'AR','chile':'CL','colombia':'CO','peru':'PE','uruguay':'UY',
  'costa rica':'CR','puerto rico':'PR','jamaica':'JM','cuba':'CU','uae':'AE',
  'united arab emirates':'AE','saudi arabia':'SA','qatar':'QA','pakistan':'PK','bangladesh':'BD',
  'sri lanka':'LK','nepal':'NP','lebanon':'LB','jordan':'JO','iran':'IR','iraq':'IQ'
};

const STATE_BY_NAME = Object.fromEntries(Object.entries(US_STATES).map(([code, name]) => [name.toLowerCase(), code]));

// "Hudson, NY" → { name: 'Hudson', country: 'US', admin: 'NY' }
function parseQuery(raw) {
  const parts = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  const name = parts[0] || '';
  const out = { name, country: null, admin: null };
  // Look at the qualifiers after the town name, last one first ("Hudson, NY, USA").
  for (const part of parts.slice(1).reverse()) {
    const p = part.replace(/\./g, '').trim();
    const lower = p.toLowerCase();
    if (/^[a-z]{2}$/i.test(p) && US_STATES[p.toUpperCase()] && !out.admin) {
      out.country = 'US'; out.admin = p.toUpperCase();          // "NY"
    } else if (STATE_BY_NAME[lower] && !out.admin) {
      out.country = 'US'; out.admin = STATE_BY_NAME[lower];     // "New York"
    } else if (COUNTRIES[lower] && !out.country) {
      out.country = COUNTRIES[lower];                           // "France", "UK"
    } else if (/^[a-z]{2}$/i.test(p) && !out.country) {
      out.country = p.toUpperCase();                            // ISO code, e.g. "FR"
    }
  }
  return out;
}

async function geo(path, params) {
  const qs = new URLSearchParams({ ...params, username: 'sarahmchapman' });
  const r = await fetch(`https://secure.geonames.org/${path}?${qs}`);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q, lat, lng, type, zoom } = req.query;

  if (type === 'reverse') {
    const z = parseInt(zoom) || 3;
    // Radius in km — larger when zoomed out so we always find something
    const radius = z <= 3 ? 300 : z <= 5 ? 150 : z <= 7 ? 75 : 30;
    // Minimum population — larger when zoomed out so we show major cities
    const minPop = z <= 3 ? 500000 : z <= 5 ? 100000 : z <= 7 ? 10000 : 0;

    try {
      const d = await geo('findNearbyPlaceNameJSON', { lat, lng, radius, maxRows: 10, style: 'FULL' });
      const places = (d.geonames || []);

      // Filter by population if zoomed out, otherwise take nearest
      const filtered = minPop > 0
        ? places.filter(g => parseInt(g.population || 0) >= minPop)
        : places;

      const g = filtered[0] || places[0];

      if (!g) {
        // Last resort: just get country
        const d2 = await geo('countryCodeJSON', { lat, lng });
        return res.json({ label: d2.countryName || null });
      }

      let label = g.name;
      if (g.adminName1 && g.adminName1 !== g.name) label += ', ' + g.adminName1;
      if (g.countryName) label += ' — ' + g.countryName;

      res.json({ label });
    } catch (e) {
      res.json({ label: null });
    }

  } else {
    // Town / city search
    try {
      const { name, country, admin } = parseQuery(q);
      if (name.length < 2) return res.json({ geonames: [] });

      const base = { featureClass: 'P', isNameRequired: 'true', orderby: 'relevance', style: 'MEDIUM' };
      if (country) base.country = country;
      if (admin) base.adminCode1 = admin;

      // 1) Places named exactly this (so a small "Hudson" isn't crowded out),
      // 2) places whose name starts with it (for half-typed names).
      const [exactR, startsR] = await Promise.allSettled([
        geo('searchJSON', { ...base, name_equals: name, maxRows: 15 }),
        geo('searchJSON', { ...base, name_startsWith: name, maxRows: 15 })
      ]);
      const exact = exactR.status === 'fulfilled' ? exactR.value : {};
      const starts = startsR.status === 'fulfilled' ? startsR.value : {};

      const seen = new Set();
      const list = [];
      const add = (arr) => (arr || []).forEach(g => {
        if (!g || seen.has(g.geonameId)) return;
        seen.add(g.geonameId);
        list.push(g);
      });
      // Exact-name matches first, largest first; then the rest in GeoNames' order.
      add((exact.geonames || []).slice().sort((a, b) => (b.population || 0) - (a.population || 0)));
      add(starts.geonames);

      // Nothing found with the stricter search? Fall back to GeoNames' free-text search.
      if (!list.length) {
        const loose = await geo('searchJSON', { q: String(q || ''), featureClass: 'P', orderby: 'relevance', maxRows: 12 });
        add(loose.geonames);
      }

      res.json({ geonames: list.slice(0, 20) });
    } catch (e) {
      res.status(500).json({ error: 'GeoNames request failed' });
    }
  }
}
