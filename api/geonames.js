export default async function handler(req, res) {
  const { q, lat, lng, type } = req.query;
  let url;
  if (type === 'reverse') {
    url = `https://secure.geonames.org/findNearbyPlaceNameJSON?lat=${lat}&lng=${lng}&featureClass=P&radius=15&maxRows=1&style=FULL&username=sarahmchapman`;
  } else {
    url = `https://secure.geonames.org/searchJSON?q=${encodeURIComponent(q)}&maxRows=12&featureClass=P&orderby=relevance&username=sarahmchapman`;
  }
  try {
    const r = await fetch(url);
    const data = await r.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'GeoNames request failed' });
  }
}
