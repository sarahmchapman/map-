export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { q, lat, lng, type, zoom } = req.query;
  let url;

  if (type === 'reverse') {
    const z = parseInt(zoom) || 3;

    if (z <= 3) {
      // Very zoomed out — just show country
      url = `https://secure.geonames.org/countryCodeJSON?lat=${lat}&lng=${lng}&username=sarahmchapman`;
    } else if (z <= 5) {
      // Zoomed out — show region/state level
      url = `https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&radius=200&maxRows=1&style=SHORT&featureCode=ADM1&username=sarahmchapman`;
    } else {
      // Zoomed in — show nearest city
      url = `https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&radius=50&maxRows=1&style=FULL&username=sarahmchapman`;
    }
  } else {
    url = `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(q)}&maxRows=12&featureClass=P&orderby=relevance&username=sarahmchapman`;
  }

  try {
    const r = await fetch(url);
    const data = await r.json();

    // Normalise country-only response to geonames format
    if (type === 'reverse' && parseInt(zoom) <= 3 && data.countryName) {
      return res.json({ geonames: [{ name: data.countryName, adminName1: '', countryName: data.countryName }] });
    }

    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'GeoNames request failed' });
  }
}
