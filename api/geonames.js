export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q, lat, lng, type, zoom } = req.query;
  const USERNAME = 'sarahmchapman';

  if (type === 'reverse') {
    const z = parseInt(zoom) || 3;
    // Radius in km — larger when zoomed out so we always find something
    const radius = z <= 3 ? 300 : z <= 5 ? 150 : z <= 7 ? 75 : 30;
    // Minimum population — larger when zoomed out so we show major cities
    const minPop = z <= 3 ? 500000 : z <= 5 ? 100000 : z <= 7 ? 10000 : 0;

    try {
      const r = await fetch(
        `https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&radius=${radius}&maxRows=10&style=FULL&username=${USERNAME}`
      );
      const d = await r.json();
      const places = (d.geonames || []);
      
      // Filter by population if zoomed out, otherwise take nearest
      const filtered = minPop > 0 
        ? places.filter(g => parseInt(g.population || 0) >= minPop)
        : places;
      
      const g = filtered[0] || places[0];
      
      if (!g) {
        // Last resort: just get country
        const r2 = await fetch(`https://secure.geonames.org/countryCodeJSON?lat=${lat}&lng=${lng}&username=${USERNAME}`);
        const d2 = await r2.json();
        return res.json({ label: d2.countryName || null });
      }

      let label = g.name;
      if (g.adminName1 && g.adminName1 !== g.name) label += ', ' + g.adminName1;
      if (g.countryName) label += ' — ' + g.countryName;
      
      res.json({ label });
    } catch(e) {
      res.json({ label: null });
    }

  } else {
    // City search
    try {
      const r = await fetch(
        `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(q)}&maxRows=12&featureClass=P&orderby=relevance&username=${USERNAME}`
      );
      const d = await r.json();
      res.json(d);
    } catch(e) {
      res.status(500).json({ error: 'GeoNames request failed' });
    }
  }
}
