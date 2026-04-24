
// elsewhere — astrocartography
// Pre-generated reading descriptions
// ═══════════════════════════════════════════════════════════
// AUTH — Supabase magic link
// ═══════════════════════════════════════════════════════════
var SUPABASE_URL = 'https://wdulylmxhvlxhjfmfivu.supabase.co';
var SUPABASE_KEY = 'sb_publishable_pBoHzlLsZiLAr7EYF824DA_R6pw5sdR';
var _sb = null;
var _currentUser = null;
var _currentProfile = null;

function initSupabase() {
  if (typeof supabase === 'undefined') return;
  _sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Check for existing session
  _sb.auth.getSession().then(function(result) {
    if (result.data && result.data.session) {
      _currentUser = result.data.session.user;
      onUserSignedIn(_currentUser);
    }
  });

  // Listen for auth changes
  _sb.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_IN' && session) {
      _currentUser = session.user;
      onUserSignedIn(_currentUser);
    } else if (event === 'SIGNED_OUT') {
      _currentUser = null;
      _currentProfile = null;
      updateAuthUI(false);
    }
  });
}

function onUserSignedIn(user) {
  // Load profile
  fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get_profile', user_id: user.id })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.profile) {
      _currentProfile = data.profile;
      // Pre-fill form if on form screen
      prefillForm(_currentProfile);
    } else {
      // New user — save their profile with current form data if available
      saveProfileFromForm(user);
    }
    updateAuthUI(true);
  }).catch(function(err) {
    console.error('Profile load error:', err);
    updateAuthUI(true);
  });
}

function prefillForm(profile) {
  if (!profile) return;
  // Only prefill if form fields are empty
  if (profile.name && !document.getElementById('inName').value) {
    document.getElementById('inName').value = profile.name;
  }
  if (profile.birth_place && !document.getElementById('cityInput').value) {
    document.getElementById('cityInput').value = profile.birth_place;
    // Set the hidden geo data
    selectedGeo = { lat: profile.birth_lat, lng: profile.birth_lng, display: profile.birth_place };
  }
  if (profile.birth_date) {
    var parts = profile.birth_date.split(' ');
    // birth_date stored as "DD Month YYYY"
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    if (parts.length === 3) {
      if (!document.getElementById('inDay').value) document.getElementById('inDay').value = parts[0];
      if (!document.getElementById('inMonth').value) {
        var mIdx = months.indexOf(parts[1]) + 1;
        if (mIdx > 0) document.getElementById('inMonth').value = mIdx;
      }
      if (!document.getElementById('inYear').value) document.getElementById('inYear').value = parts[2];
    }
  }
  if (profile.birth_time) {
    var timeParts = profile.birth_time.split(':');
    if (timeParts.length >= 2) {
      if (!document.getElementById('inHour').value) document.getElementById('inHour').value = timeParts[0];
      if (!document.getElementById('inMinute').value) document.getElementById('inMinute').value = timeParts[1];
    }
  }
}

function saveProfileFromForm(user) {
  // Called after sign-in to save whatever birth data is in localStorage
  var raw = localStorage.getItem('elsewhere_reading');
  if (!raw) return;
  try {
    var data = JSON.parse(raw);
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_profile',
        user_id: user.id,
        email: user.email,
        name: data.name || '',
        birth_date: data.birthDate || '',
        birth_time: '',
        birth_place: data.birthPlace || '',
        birth_lat: data.birthLat,
        birth_lng: data.birthLng
      })
    });
  } catch(e) {}
}

function updateAuthUI(signedIn) {
  var signInBtn = document.getElementById('signInBtn');
  var accountBtn = document.getElementById('accountBtn');
  if (!signInBtn || !accountBtn) return;
  if (signedIn) {
    signInBtn.style.display = 'none';
    accountBtn.style.display = 'inline-flex';
  } else {
    signInBtn.style.display = 'inline-flex';
    accountBtn.style.display = 'none';
  }
}

function openAuthModal() {
  var modal = document.getElementById('authModal');
  modal.style.display = 'flex';
  document.getElementById('authForm').style.display = 'block';
  document.getElementById('authSent').style.display = 'none';
  setTimeout(function() { document.getElementById('authEmail').focus(); }, 100);
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
}

function sendMagicLink() {
  var email = document.getElementById('authEmail').value.trim();
  if (!email || !email.includes('@')) {
    alert('Please enter a valid email address.');
    return;
  }

  var btn = document.querySelector('#authForm button');
  btn.textContent = 'Sending…';
  btn.disabled = true;

  fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send_magic_link', email: email })
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.error) {
      alert('Error: ' + data.error);
      btn.textContent = 'Send magic link';
      btn.disabled = false;
    } else {
      document.getElementById('authEmailSent').textContent = email;
      document.getElementById('authForm').style.display = 'none';
      document.getElementById('authSent').style.display = 'block';
    }
  }).catch(function(err) {
    alert('Something went wrong. Please try again.');
    btn.textContent = 'Send magic link';
    btn.disabled = false;
  });
}

function openAccountModal() {
  if (!_currentProfile && !_currentUser) return;
  var modal = document.getElementById('accountModal');
  modal.style.display = 'flex';
  document.getElementById('accountEmail').textContent = _currentUser ? _currentUser.email : '';
  document.getElementById('accountName').textContent = (_currentProfile && _currentProfile.name) ? _currentProfile.name : 'Your account';
  var used = (_currentProfile && _currentProfile.readings_used) ? _currentProfile.readings_used : 0;
  document.getElementById('accountReadings').textContent = used + ' of 3 free readings used';
}

function closeAccountModal() {
  document.getElementById('accountModal').style.display = 'none';
}

function signOut() {
  if (_sb) {
    _sb.auth.signOut().then(function() {
      closeAccountModal();
      _currentUser = null;
      _currentProfile = null;
      updateAuthUI(false);
    });
  }
}

// Close modals on backdrop click
document.addEventListener('click', function(e) {
  var authModal = document.getElementById('authModal');
  var accountModal = document.getElementById('accountModal');
  if (e.target === authModal) closeAuthModal();
  if (e.target === accountModal) closeAccountModal();
});

// Init on load
document.addEventListener('DOMContentLoaded', function() {
  initSupabase();
});


// 40 base descriptions (planet x angle) + 120 sign modifiers (planet x sign)





// Best for: 40 planet x angle descriptions


// Watch for: 40 planet x angle descriptions


// ═══════════════════════════════════════════════════════════
// CITY DATABASE (abbreviated — top global cities)
// ═══════════════════════════════════════════════════════════
var CITY_DB=[
{n:'New York',r:'New York',c:'United States',lat:40.7128,lng:-74.006},
{n:'Los Angeles',r:'California',c:'United States',lat:34.0522,lng:-118.2437},
{n:'Chicago',r:'Illinois',c:'United States',lat:41.8781,lng:-87.6298},
{n:'Houston',r:'Texas',c:'United States',lat:29.7604,lng:-95.3698},
{n:'Phoenix',r:'Arizona',c:'United States',lat:33.4484,lng:-112.074},
{n:'Philadelphia',r:'Pennsylvania',c:'United States',lat:39.9526,lng:-75.1652},
{n:'San Antonio',r:'Texas',c:'United States',lat:29.4241,lng:-98.4936},
{n:'San Diego',r:'California',c:'United States',lat:32.7157,lng:-117.1611},
{n:'Dallas',r:'Texas',c:'United States',lat:32.7767,lng:-96.797},
{n:'San Francisco',r:'California',c:'United States',lat:37.7749,lng:-122.4194},
{n:'Seattle',r:'Washington',c:'United States',lat:47.6062,lng:-122.3321},
{n:'Denver',r:'Colorado',c:'United States',lat:39.7392,lng:-104.9903},
{n:'Boston',r:'Massachusetts',c:'United States',lat:42.3601,lng:-71.0589},
{n:'Atlanta',r:'Georgia',c:'United States',lat:33.749,lng:-84.388},
{n:'Miami',r:'Florida',c:'United States',lat:25.7617,lng:-80.1918},
{n:'Minneapolis',r:'Minnesota',c:'United States',lat:44.9778,lng:-93.265},
{n:'Portland',r:'Oregon',c:'United States',lat:45.5051,lng:-122.675},
{n:'Las Vegas',r:'Nevada',c:'United States',lat:36.1699,lng:-115.1398},
{n:'Nashville',r:'Tennessee',c:'United States',lat:36.1627,lng:-86.7816},
{n:'New Orleans',r:'Louisiana',c:'United States',lat:29.9511,lng:-90.0715},
{n:'Austin',r:'Texas',c:'United States',lat:30.2672,lng:-97.7431},
{n:'Salt Lake City',r:'Utah',c:'United States',lat:40.7608,lng:-111.891},
{n:'Kansas City',r:'Missouri',c:'United States',lat:39.0997,lng:-94.5786},
{n:'Pittsburgh',r:'Pennsylvania',c:'United States',lat:40.4406,lng:-79.9959},
{n:'Honolulu',r:'Hawaii',c:'United States',lat:21.3069,lng:-157.8583},
{n:'Anchorage',r:'Alaska',c:'United States',lat:61.2181,lng:-149.9003},
{n:'Toronto',r:'Ontario',c:'Canada',lat:43.6532,lng:-79.3832},
{n:'Montreal',r:'Quebec',c:'Canada',lat:45.5017,lng:-73.5673},
{n:'Vancouver',r:'British Columbia',c:'Canada',lat:49.2827,lng:-123.1207},
{n:'Calgary',r:'Alberta',c:'Canada',lat:51.0447,lng:-114.0719},
{n:'Ottawa',r:'Ontario',c:'Canada',lat:45.4215,lng:-75.6972},
{n:'Edmonton',r:'Alberta',c:'Canada',lat:53.5461,lng:-113.4938},
{n:'Mexico City',r:'',c:'Mexico',lat:19.4326,lng:-99.1332},
{n:'Guadalajara',r:'',c:'Mexico',lat:20.6597,lng:-103.3496},
{n:'Monterrey',r:'',c:'Mexico',lat:25.6866,lng:-100.3161},
{n:'London',r:'England',c:'United Kingdom',lat:51.5074,lng:-0.1278},
{n:'Birmingham',r:'England',c:'United Kingdom',lat:52.4862,lng:-1.8904},
{n:'Manchester',r:'England',c:'United Kingdom',lat:53.4808,lng:-2.2426},
{n:'Glasgow',r:'Scotland',c:'United Kingdom',lat:55.8642,lng:-4.2518},
{n:'Edinburgh',r:'Scotland',c:'United Kingdom',lat:55.9533,lng:-3.1883},
{n:'Liverpool',r:'England',c:'United Kingdom',lat:53.4084,lng:-2.9916},
{n:'Bristol',r:'England',c:'United Kingdom',lat:51.4545,lng:-2.5879},
{n:'Cardiff',r:'Wales',c:'United Kingdom',lat:51.4816,lng:-3.1791},
{n:'Belfast',r:'Northern Ireland',c:'United Kingdom',lat:54.5973,lng:-5.9301},
{n:'Paris',r:'',c:'France',lat:48.8566,lng:2.3522},
{n:'Marseille',r:'',c:'France',lat:43.2965,lng:5.3698},
{n:'Lyon',r:'',c:'France',lat:45.7640,lng:4.8357},
{n:'Toulouse',r:'',c:'France',lat:43.6047,lng:1.4442},
{n:'Nice',r:'',c:'France',lat:43.7102,lng:7.262},
{n:'Berlin',r:'',c:'Germany',lat:52.52,lng:13.405},
{n:'Hamburg',r:'',c:'Germany',lat:53.5753,lng:10.0153},
{n:'Munich',r:'',c:'Germany',lat:48.1351,lng:11.582},
{n:'Frankfurt',r:'',c:'Germany',lat:50.1109,lng:8.6821},
{n:'Cologne',r:'',c:'Germany',lat:50.938,lng:6.9599},
{n:'Stuttgart',r:'',c:'Germany',lat:48.7758,lng:9.1829},
{n:'Madrid',r:'',c:'Spain',lat:40.4168,lng:-3.7038},
{n:'Barcelona',r:'',c:'Spain',lat:41.3851,lng:2.1734},
{n:'Valencia',r:'',c:'Spain',lat:39.4699,lng:-0.3763},
{n:'Seville',r:'',c:'Spain',lat:37.3891,lng:-5.9845},
{n:'Bilbao',r:'',c:'Spain',lat:43.263,lng:-2.935},
{n:'Rome',r:'',c:'Italy',lat:41.9028,lng:12.4964},
{n:'Milan',r:'',c:'Italy',lat:45.4654,lng:9.1859},
{n:'Naples',r:'',c:'Italy',lat:40.8518,lng:14.2681},
{n:'Turin',r:'',c:'Italy',lat:45.0703,lng:7.6869},
{n:'Florence',r:'',c:'Italy',lat:43.7696,lng:11.2558},
{n:'Venice',r:'',c:'Italy',lat:45.4408,lng:12.3155},
{n:'Amsterdam',r:'',c:'Netherlands',lat:52.3676,lng:4.9041},
{n:'Rotterdam',r:'',c:'Netherlands',lat:51.9244,lng:4.4777},
{n:'Brussels',r:'',c:'Belgium',lat:50.8503,lng:4.3517},
{n:'Zurich',r:'',c:'Switzerland',lat:47.3769,lng:8.5417},
{n:'Geneva',r:'',c:'Switzerland',lat:46.2044,lng:6.1432},
{n:'Vienna',r:'',c:'Austria',lat:48.2082,lng:16.3738},
{n:'Prague',r:'',c:'Czech Republic',lat:50.0755,lng:14.4378},
{n:'Warsaw',r:'',c:'Poland',lat:52.2297,lng:21.0122},
{n:'Budapest',r:'',c:'Hungary',lat:47.4979,lng:19.0402},
{n:'Bucharest',r:'',c:'Romania',lat:44.4268,lng:26.1025},
{n:'Athens',r:'',c:'Greece',lat:37.9838,lng:23.7275},
{n:'Lisbon',r:'',c:'Portugal',lat:38.7223,lng:-9.1393},
{n:'Porto',r:'',c:'Portugal',lat:41.1579,lng:-8.6291},
{n:'Stockholm',r:'',c:'Sweden',lat:59.3293,lng:18.0686},
{n:'Oslo',r:'',c:'Norway',lat:59.9139,lng:10.7522},
{n:'Copenhagen',r:'',c:'Denmark',lat:55.6761,lng:12.5683},
{n:'Helsinki',r:'',c:'Finland',lat:60.1699,lng:24.9384},
{n:'Dublin',r:'',c:'Ireland',lat:53.3498,lng:-6.2603},
{n:'Moscow',r:'',c:'Russia',lat:55.7558,lng:37.6173},
{n:'St Petersburg',r:'',c:'Russia',lat:59.9311,lng:30.3609},
{n:'Novosibirsk',r:'',c:'Russia',lat:54.9833,lng:82.8964},
{n:'Yekaterinburg',r:'',c:'Russia',lat:56.8389,lng:60.6057},
{n:'Kyiv',r:'',c:'Ukraine',lat:50.4501,lng:30.5234},
{n:'Minsk',r:'',c:'Belarus',lat:53.9045,lng:27.5615},
{n:'Riga',r:'',c:'Latvia',lat:56.9496,lng:24.1052},
{n:'Vilnius',r:'',c:'Lithuania',lat:54.6872,lng:25.2797},
{n:'Tallinn',r:'',c:'Estonia',lat:59.4370,lng:24.7536},
{n:'Istanbul',r:'',c:'Turkey',lat:41.0082,lng:28.9784},
{n:'Ankara',r:'',c:'Turkey',lat:39.9334,lng:32.8597},
{n:'Izmir',r:'',c:'Turkey',lat:38.4192,lng:27.1287},
{n:'Cairo',r:'',c:'Egypt',lat:30.0444,lng:31.2357},
{n:'Alexandria',r:'',c:'Egypt',lat:31.2001,lng:29.9187},
{n:'Lagos',r:'',c:'Nigeria',lat:6.5244,lng:3.3792},
{n:'Abuja',r:'',c:'Nigeria',lat:9.0765,lng:7.3986},
{n:'Nairobi',r:'',c:'Kenya',lat:-1.2921,lng:36.8219},
{n:'Addis Ababa',r:'',c:'Ethiopia',lat:9.0054,lng:38.7636},
{n:'Dar es Salaam',r:'',c:'Tanzania',lat:-6.7924,lng:39.2083},
{n:'Johannesburg',r:'',c:'South Africa',lat:-26.2041,lng:28.0473},
{n:'Cape Town',r:'',c:'South Africa',lat:-33.9249,lng:18.4241},
{n:'Durban',r:'',c:'South Africa',lat:-29.8587,lng:31.0218},
{n:'Casablanca',r:'',c:'Morocco',lat:33.5731,lng:-7.5898},
{n:'Marrakesh',r:'',c:'Morocco',lat:31.6295,lng:-7.9811},
{n:'Fez',r:'',c:'Morocco',lat:34.0181,lng:-5.0078},
{n:'Tunis',r:'',c:'Tunisia',lat:36.8065,lng:10.1815},
{n:'Algiers',r:'',c:'Algeria',lat:36.7372,lng:3.0865},
{n:'Accra',r:'',c:'Ghana',lat:5.6037,lng:-0.187},
{n:'Dakar',r:'',c:'Senegal',lat:14.7167,lng:-17.4677},
{n:'Kinshasa',r:'',c:'DR Congo',lat:-4.4419,lng:15.2663},
{n:'Kampala',r:'',c:'Uganda',lat:0.3476,lng:32.5825},
{n:'Khartoum',r:'',c:'Sudan',lat:15.5007,lng:32.5599},
{n:'Luanda',r:'',c:'Angola',lat:-8.8368,lng:13.2343},
{n:'Maputo',r:'',c:'Mozambique',lat:-25.9692,lng:32.5732},
{n:'Harare',r:'',c:'Zimbabwe',lat:-17.8292,lng:31.0522},
{n:'Lusaka',r:'',c:'Zambia',lat:-15.3875,lng:28.3228},
{n:'Antananarivo',r:'',c:'Madagascar',lat:-18.8792,lng:47.5079},
{n:'Dubai',r:'',c:'UAE',lat:25.2048,lng:55.2708},
{n:'Abu Dhabi',r:'',c:'UAE',lat:24.4539,lng:54.3773},
{n:'Riyadh',r:'',c:'Saudi Arabia',lat:24.6877,lng:46.7219},
{n:'Jeddah',r:'',c:'Saudi Arabia',lat:21.4858,lng:39.1925},
{n:'Doha',r:'',c:'Qatar',lat:25.2854,lng:51.531},
{n:'Kuwait City',r:'',c:'Kuwait',lat:29.3759,lng:47.9774},
{n:'Manama',r:'',c:'Bahrain',lat:26.2235,lng:50.5876},
{n:'Muscat',r:'',c:'Oman',lat:23.5880,lng:58.3829},
{n:'Tehran',r:'',c:'Iran',lat:35.6892,lng:51.389},
{n:'Baghdad',r:'',c:'Iraq',lat:33.3152,lng:44.3661},
{n:'Beirut',r:'',c:'Lebanon',lat:33.8938,lng:35.5018},
{n:'Tel Aviv',r:'',c:'Israel',lat:32.0853,lng:34.7818},
{n:'Jerusalem',r:'',c:'Israel',lat:31.7683,lng:35.2137},
{n:'Amman',r:'',c:'Jordan',lat:31.9454,lng:35.9284},
{n:'Damascus',r:'',c:'Syria',lat:33.5138,lng:36.2765},
{n:'Islamabad',r:'',c:'Pakistan',lat:33.6844,lng:73.0479},
{n:'Karachi',r:'',c:'Pakistan',lat:24.8607,lng:67.0011},
{n:'Lahore',r:'',c:'Pakistan',lat:31.5204,lng:74.3587},
{n:'Mumbai',r:'',c:'India',lat:19.076,lng:72.8777},
{n:'Delhi',r:'',c:'India',lat:28.7041,lng:77.1025},
{n:'Bangalore',r:'',c:'India',lat:12.9716,lng:77.5946},
{n:'Hyderabad',r:'',c:'India',lat:17.385,lng:78.4867},
{n:'Chennai',r:'',c:'India',lat:13.0827,lng:80.2707},
{n:'Kolkata',r:'',c:'India',lat:22.5726,lng:88.3639},
{n:'Pune',r:'',c:'India',lat:18.5204,lng:73.8567},
{n:'Ahmedabad',r:'',c:'India',lat:23.0225,lng:72.5714},
{n:'Dhaka',r:'',c:'Bangladesh',lat:23.8103,lng:90.4125},
{n:'Kathmandu',r:'',c:'Nepal',lat:27.7172,lng:85.324},
{n:'Colombo',r:'',c:'Sri Lanka',lat:6.9271,lng:79.8612},
{n:'Yangon',r:'',c:'Myanmar',lat:16.8661,lng:96.1951},
{n:'Bangkok',r:'',c:'Thailand',lat:13.7563,lng:100.5018},
{n:'Chiang Mai',r:'',c:'Thailand',lat:18.7883,lng:98.9853},
{n:'Kuala Lumpur',r:'',c:'Malaysia',lat:3.139,lng:101.6869},
{n:'Singapore',r:'',c:'Singapore',lat:1.3521,lng:103.8198},
{n:'Jakarta',r:'',c:'Indonesia',lat:-6.2088,lng:106.8456},
{n:'Bali',r:'',c:'Indonesia',lat:-8.4095,lng:115.1889},
{n:'Manila',r:'',c:'Philippines',lat:14.5995,lng:120.9842},
{n:'Ho Chi Minh City',r:'',c:'Vietnam',lat:10.8231,lng:106.6297},
{n:'Hanoi',r:'',c:'Vietnam',lat:21.0285,lng:105.8542},
{n:'Phnom Penh',r:'',c:'Cambodia',lat:11.5564,lng:104.9282},
{n:'Vientiane',r:'',c:'Laos',lat:17.9757,lng:102.6331},
{n:'Taipei',r:'',c:'Taiwan',lat:25.033,lng:121.5654},
{n:'Hong Kong',r:'',c:'China',lat:22.3193,lng:114.1694},
{n:'Shanghai',r:'',c:'China',lat:31.2304,lng:121.4737},
{n:'Beijing',r:'',c:'China',lat:39.9042,lng:116.4074},
{n:'Guangzhou',r:'',c:'China',lat:23.1291,lng:113.2644},
{n:'Shenzhen',r:'',c:'China',lat:22.5431,lng:114.0579},
{n:'Chengdu',r:'',c:'China',lat:30.5728,lng:104.0668},
{n:'Xi\'an',r:'',c:'China',lat:34.3416,lng:108.9398},
{n:'Wuhan',r:'',c:'China',lat:30.5928,lng:114.3055},
{n:'Seoul',r:'',c:'South Korea',lat:37.5665,lng:126.978},
{n:'Busan',r:'',c:'South Korea',lat:35.1796,lng:129.0756},
{n:'Tokyo',r:'',c:'Japan',lat:35.6762,lng:139.6503},
{n:'Osaka',r:'',c:'Japan',lat:34.6937,lng:135.5023},
{n:'Kyoto',r:'',c:'Japan',lat:35.0116,lng:135.7681},
{n:'Sapporo',r:'',c:'Japan',lat:43.0618,lng:141.3545},
{n:'Ulaanbaatar',r:'',c:'Mongolia',lat:47.8864,lng:106.9057},
{n:'Almaty',r:'',c:'Kazakhstan',lat:43.2220,lng:76.8512},
{n:'Tashkent',r:'',c:'Uzbekistan',lat:41.2995,lng:69.2401},
{n:'Kabul',r:'',c:'Afghanistan',lat:34.5553,lng:69.2075},
{n:'Sydney',r:'New South Wales',c:'Australia',lat:-33.8688,lng:151.2093},
{n:'Melbourne',r:'Victoria',c:'Australia',lat:-37.8136,lng:144.9631},
{n:'Brisbane',r:'Queensland',c:'Australia',lat:-27.4698,lng:153.0251},
{n:'Perth',r:'Western Australia',c:'Australia',lat:-31.9505,lng:115.8605},
{n:'Adelaide',r:'South Australia',c:'Australia',lat:-34.9285,lng:138.6007},
{n:'Auckland',r:'',c:'New Zealand',lat:-36.8509,lng:174.7645},
{n:'Wellington',r:'',c:'New Zealand',lat:-41.2866,lng:174.7756},
{n:'Suva',r:'',c:'Fiji',lat:-18.1416,lng:178.4419},
{n:'Port Moresby',r:'',c:'Papua New Guinea',lat:-9.4438,lng:147.1803},
{n:'São Paulo',r:'',c:'Brazil',lat:-23.5505,lng:-46.6333},
{n:'Rio de Janeiro',r:'',c:'Brazil',lat:-22.9068,lng:-43.1729},
{n:'Brasília',r:'',c:'Brazil',lat:-15.7801,lng:-47.9292},
{n:'Salvador',r:'',c:'Brazil',lat:-12.9714,lng:-38.5014},
{n:'Fortaleza',r:'',c:'Brazil',lat:-3.7172,lng:-38.5433},
{n:'Manaus',r:'',c:'Brazil',lat:-3.119,lng:-60.0217},
{n:'Buenos Aires',r:'',c:'Argentina',lat:-34.6037,lng:-58.3816},
{n:'Córdoba',r:'',c:'Argentina',lat:-31.4201,lng:-64.1888},
{n:'Rosario',r:'',c:'Argentina',lat:-32.9442,lng:-60.6505},
{n:'Santiago',r:'',c:'Chile',lat:-33.4489,lng:-70.6693},
{n:'Lima',r:'',c:'Peru',lat:-12.0464,lng:-77.0428},
{n:'Bogotá',r:'',c:'Colombia',lat:4.711,lng:-74.0721},
{n:'Medellín',r:'',c:'Colombia',lat:6.2518,lng:-75.5636},
{n:'Caracas',r:'',c:'Venezuela',lat:10.4806,lng:-66.9036},
{n:'Quito',r:'',c:'Ecuador',lat:-0.1807,lng:-78.4678},
{n:'Guayaquil',r:'',c:'Ecuador',lat:-2.1894,lng:-79.8891},
{n:'La Paz',r:'',c:'Bolivia',lat:-16.5,lng:-68.15},
{n:'Asunción',r:'',c:'Paraguay',lat:-25.2867,lng:-57.647},
{n:'Montevideo',r:'',c:'Uruguay',lat:-34.9011,lng:-56.1645},
{n:'Panama City',r:'',c:'Panama',lat:8.9936,lng:-79.5197},
{n:'San José',r:'',c:'Costa Rica',lat:9.9281,lng:-84.0907},
{n:'Guatemala City',r:'',c:'Guatemala',lat:14.6349,lng:-90.5069},
{n:'Havana',r:'',c:'Cuba',lat:23.1136,lng:-82.3666},
{n:'Santo Domingo',r:'',c:'Dominican Republic',lat:18.4861,lng:-69.9312},
{n:'Port-au-Prince',r:'',c:'Haiti',lat:18.5944,lng:-72.3074},
{n:'Kingston',r:'',c:'Jamaica',lat:17.9970,lng:-76.7936},
{n:'Reykjavik',r:'',c:'Iceland',lat:64.1265,lng:-21.8174},
{n:'Nuuk',r:'',c:'Greenland',lat:64.1836,lng:-51.7214},
{n:'Noumea',r:'',c:'New Caledonia',lat:-22.2758,lng:166.458},
{n:'Papeete',r:'',c:'French Polynesia',lat:-17.5334,lng:-149.5667},
{n:'Lusaka',r:'',c:'Zambia',lat:-15.3875,lng:28.3228}
];

function tzFromLng(lng){return Math.round(lng/15);}

var selectedGeo=null,selectedFocus='Love',hiIdx=-1;
var MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
function pad(n){return String(n).padStart(2,'0');}
function normStr(s){return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

function _localSearch(q){
  var n=normStr(q.trim());if(n.length<1)return[];
  var a=[],b=[];
  for(var i=0;i<CITY_DB.length;i++){
    var city=CITY_DB[i],cn=normStr(city.n),cc=normStr(city.c),cr=normStr(city.r||'');
    if(cn.indexOf(n)===0||cc.indexOf(n)===0)a.push(city);
    else if(cn.indexOf(n)>0||cr.indexOf(n)>0||cc.indexOf(n)>0)b.push(city);
    if(a.length+b.length>=20)break;
  }
  return a.concat(b).slice(0,8);
}

(function(){
  var inp=document.getElementById('cityInput'),drop=document.getElementById('citySuggestions');
  if(!inp||!drop)return;
  var hi=-1,_debounce=null;
  function its(){return drop.getElementsByClassName('city-item');}
  function close(){drop.classList.remove('show');hi=-1;}
  function hl(i){var x=its();[].forEach.call(x,function(el){el.classList.remove('hi');});hi=Math.max(-1,Math.min(i,x.length-1));if(hi>=0)x[hi].classList.add('hi');}
  function pick(city){
    inp.value=city.n+(city.r&&city.r!==city.n&&city.r!==city.c?', '+city.r:'')+', '+city.c;
    selectedGeo={lat:city.lat,lng:city.lng,city:city.n,country:city.c,display:inp.value,tz:tzFromLng(city.lng)};
    close();document.getElementById('geoErr').classList.remove('on');
  }
  function renderHits(hits){
    drop.innerHTML='';if(!hits.length){close();return;}
    hits.forEach(function(city){
      var div=document.createElement('div');div.className='city-item';
      div.innerHTML='<span class="ci-name">'+city.n+'</span><span class="ci-sub">'+(city.r&&city.r!==city.n&&city.r!==city.c?city.r+', ':'')+city.c+'</span>';
      div.addEventListener('mousedown',function(ev){ev.preventDefault();pick(city);});
      drop.appendChild(div);
    });
    drop.classList.add('show');hi=-1;
  }
  function nominatimSearch(q){
    fetch('/api/geonames?q='+encodeURIComponent(q))
      .then(function(r){return r.json();})
      .then(function(data){
        if(inp.value.trim()!==q)return;
        var results=[];
        (data.geonames||[]).forEach(function(g){results.push({n:g.name,r:g.adminName1||'',c:g.countryName||'',lat:parseFloat(g.lat),lng:parseFloat(g.lng)});});
        var local=_localSearch(q),merged=local.slice();
        results.forEach(function(ar){var seen=merged.some(function(lr){return normStr(lr.n)===normStr(ar.n)&&normStr(lr.c)===normStr(ar.c);});if(!seen)merged.push(ar);});
        renderHits(merged.slice(0,12));
      }).catch(function(){});
  }
  inp.addEventListener('keydown',function(e){
    if(!drop.classList.contains('show'))return;
    var x=its();
    if(e.key==='ArrowDown'){e.preventDefault();hl(hi+1);}
    else if(e.key==='ArrowUp'){e.preventDefault();hl(hi-1);}
    else if(e.key==='Enter'){e.preventDefault();if(hi>=0&&hi<x.length){x[hi].dispatchEvent(new MouseEvent('mousedown'));}else if(x.length===1){x[0].dispatchEvent(new MouseEvent('mousedown'));}}
    else if(e.key==='Escape')close();
  });
  inp.addEventListener('blur',function(){setTimeout(close,200);});
  inp.addEventListener('input',function(){
    selectedGeo=null;var q=inp.value.trim();
    if(q.length<2){drop.innerHTML='';close();return;}
    renderHits(_localSearch(q));
    clearTimeout(_debounce);_debounce=setTimeout(function(){nominatimSearch(q);},400);
  });
})();

// ═══════════════════════════════════════════════════════════
// EPHEMERIS — Meeus algorithms
// ═══════════════════════════════════════════════════════════
var SIGNS=['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
var PCOL={Sun:'#c9973f',Moon:'#5a7aa8',Mercury:'#4a8a6a',Venus:'#c0607a',Mars:'#9b3535',Jupiter:'#7a5a30',Saturn:'#6a6055',Uranus:'#3a7a7a',Neptune:'#4a4a9a',Pluto:'#7a4a6a',Chiron:'#2a2a2a',NNode:'#2c6e49',SNode:'#5a9e7a'};
var PSYM={Sun:'☉',Moon:'☽',Mercury:'☿',Venus:'♀',Mars:'♂',Jupiter:'♃',Saturn:'♄',Uranus:'♅',Neptune:'♆',Pluto:'♇',Chiron:'⚷',NNode:'☊',SNode:'☋'};
var FOCUS_PLANETS={Love:['Venus','Moon','Neptune','Jupiter'],Career:['Saturn','Sun','Mars','Jupiter'],Healing:['Moon','Neptune','Venus','Pluto'],Self:['Sun','Mars','Mercury','Uranus']};
var OBL=23.4365;

function n360(x){return((x%360)+360)%360;}
function n180(x){return((x+540)%360)-180;}
function R(d){return d*Math.PI/180;}

function jdFromDate(y,mo,d,h,mn){
  if(mo<=2){y--;mo+=12;}
  var A=Math.floor(y/100),B=2-A+Math.floor(A/4);
  return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(mo+1))+d+h/24+mn/1440+B-1524.5;
}

var _S=1e-8;
var _EL0=[[175347046*_S,0,0],[3341656*_S,4.6732156,6283.0758500],[34894*_S,4.62610,12566.15170],[3497*_S,2.7441,5753.3849],[3418*_S,2.8289,3.5231],[3136*_S,3.6277,77713.7715],[2676*_S,4.4181,7860.4194],[2343*_S,6.1352,3930.2097],[1324*_S,0.7425,11506.7698],[1273*_S,2.0371,529.6910]];
var _EL1=[[628331966747*_S,0,0],[206059*_S,2.678235,6283.075850],[4303*_S,2.6351,12566.1517],[425*_S,1.590,3.523],[119*_S,5.796,26.298],[109*_S,2.966,1577.344]];
var _EL2=[[52919*_S,0,0],[8720*_S,1.0721,6283.0758],[309*_S,0.867,12566.152]];
var _EB0=[[280*_S,3.199,84334.662],[102*_S,5.422,5507.553],[80*_S,3.88,5223.69]];
var _ER0=[[100013989*_S,0,0],[1670700*_S,3.0984635,6283.0758500],[13956*_S,3.05525,12566.15170],[3084*_S,5.1985,77713.7715],[1628*_S,1.1739,5753.3849],[1576*_S,2.8469,7860.4194]];
var _ER1=[[103019*_S,1.107490,6283.075850],[1721*_S,1.0644,12566.1517]];
var _VL0=[[317614667*_S,0,0],[1353968*_S,5.5931332,10213.2855462],[89892*_S,5.30650,20426.57109],[5477*_S,4.4163,7860.4194],[3456*_S,2.6996,11790.6291],[2372*_S,2.9938,3930.2097],[1664*_S,4.2502,1577.3435],[1438*_S,4.1575,9683.5946]];
var _VL1=[[1021352943052*_S,0,0],[95708*_S,2.46424,10213.28555],[14445*_S,0.51625,20426.57109]];
var _VL2=[[54127*_S,0,0],[3891*_S,0.3451,10213.2855]];
var _VB0=[[5923638*_S,0.2670278,10213.2855462],[40108*_S,1.14737,20426.57109],[32815*_S,3.14159,0]];
var _VB1=[[513348*_S,1.803643,10213.285546],[199*_S,0,0]];
var _VR0=[[72333282*_S,0,0],[489824*_S,4.021518,10213.285546],[1658*_S,4.9021,20426.5711]];
var _VR1=[[34551*_S,0.89199,10213.28555]];
var _MaL0=[[620347712*_S,0,0],[18656368*_S,5.0503417,3340.6124267],[1108217*_S,5.4009984,6681.2248534],[91798*_S,5.7547,10021.8373],[27745*_S,5.9705,2281.2305],[12316*_S,0.8496,2810.9215],[10610*_S,2.9396,2942.4634],[8927*_S,4.1578,0.0173],[8716*_S,6.1101,13362.4497]];
var _MaL1=[[334085627154*_S,0,0],[1458227*_S,3.6042605,3340.6124267],[164901*_S,3.9263,6681.2249],[19963*_S,4.2660,10021.8373],[3452*_S,4.7321,3337.0893]];
var _MaL2=[[58016*_S,2.0498,3340.6124],[54188*_S,0,0],[13908*_S,2.4574,6681.2248]];
var _MaB0=[[3197135*_S,3.7683204,3340.6124267],[298033*_S,4.1061,6681.2249],[289105*_S,3.14159,0],[31366*_S,4.4465,10021.8373]];
var _MaB1=[[350069*_S,5.368478,3340.612427],[14116*_S,3.14159,0],[9671*_S,5.4788,6681.2249]];
var _MaR0=[[153033488*_S,0,0],[14184953*_S,3.47971,3340.6124267],[660776*_S,3.817834,6681.224853],[46179*_S,4.15595,10021.83728],[8110*_S,5.5596,2810.9215]];
var _MaR1=[[1107433*_S,2.03253,3340.6124267],[103176*_S,2.37072,6681.224853],[12877*_S,0,0]];
var _JuL0=[[59954691*_S,0,0],[9695899*_S,5.0619179,529.6909651],[573610*_S,1.44406,7.11355],[306389*_S,5.41734,1059.38193],[97178*_S,4.14265,632.78374],[72903*_S,3.64042,522.57742],[64264*_S,3.41145,103.09277]];
var _JuL1=[[52993480757*_S,0,0],[489741*_S,4.22067,529.690965],[228919*_S,6.02648,7.11355],[55733*_S,0.24322,1059.38193]];
var _JuL2=[[47234*_S,4.32148,7.11355],[38966*_S,0,0],[30629*_S,2.93021,529.69097]];
var _JuB0=[[2268616*_S,3.5585261,529.6909651],[110090*_S,0,0],[109972*_S,3.908093,1059.381930]];
var _JuB1=[[177352*_S,5.701665,529.690965]];
var _JuR0=[[520887429*_S,0,0],[25209327*_S,3.49108640,529.6909651],[610600*_S,3.841154,1059.38193],[282029*_S,2.574199,632.78374]];
var _JuR1=[[1271802*_S,2.649375,529.6909651],[61662*_S,3.000992,1059.38193],[53444*_S,3.890718,522.57742],[41390*_S,0,0]];
var _SaL0=[[87401354*_S,0,0],[11107660*_S,3.9620509,213.2990954],[1414151*_S,4.5858152,7.1135470],[398379*_S,0.52112,206.18555],[350769*_S,3.30330,426.59819],[206816*_S,0.24658,103.09277]];
var _SaL1=[[21354295596*_S,0,0],[1296855*_S,1.82821,213.29910],[564348*_S,2.88500,7.11355],[107679*_S,2.27770,206.18555],[98323*_S,1.08087,426.59819]];
var _SaL2=[[116441*_S,1.17988,7.11355],[91921*_S,0.07325,213.29910],[90592*_S,0,0],[15277*_S,4.06492,206.18555]];
var _SaB0=[[4330678*_S,3.6028443,213.2990954],[240348*_S,2.852385,426.598191],[84746*_S,0,0]];
var _SaB1=[[397555*_S,5.332900,213.299095],[49479*_S,3.14159,0]];
var _SaR0=[[955758136*_S,0,0],[52921382*_S,2.39226220,213.2990954],[1873680*_S,5.235496,206.18555],[1464664*_S,1.647631,426.59819]];
var _SaR1=[[6182981*_S,0.2584352,213.2990954],[506578*_S,0.711147,206.18555],[341394*_S,5.796358,426.59819],[188491*_S,0.472157,220.41264]];
var _UrL0=[[548129294*_S,0,0],[9260408*_S,0.8910642,74.7815986],[1504248*_S,3.6271490,1.4844727],[365982*_S,1.899715,73.2971259],[272328*_S,3.358255,149.5631971]];
var _UrL1=[[7502543122*_S,0,0],[154458*_S,5.242017,74.781599],[24456*_S,1.71256,1.48447]];
var _UrL2=[[53033*_S,0,0],[16983*_S,3.16565,138.5175],[9987*_S,5.9491,74.7816]];
var _UrB0=[[1346278*_S,2.6187781,74.7815986],[62341*_S,5.08111,149.5632],[61601*_S,3.14159,0]];
var _UrB1=[[206366*_S,4.12394,74.78160]];
var _UrR0=[[1921264848*_S,0,0],[88784984*_S,5.60377527,74.7815986],[3440835*_S,0.32836,73.2971259],[2055653*_S,1.78295,149.5631971]];
var _UrR1=[[1479896*_S,3.6720571,74.7815986],[71212*_S,6.22815,63.73590]];
var _NeL0=[[531188633*_S,0,0],[1798476*_S,2.9010127,38.1330356],[1019728*_S,0.4858092,1.4844727],[124532*_S,4.830081,36.6485629]];
var _NeL1=[[3837687717*_S,0,0],[16604*_S,4.86319,1.48447],[15807*_S,2.27923,38.13304]];
var _NeL2=[[53892*_S,0,0],[296*_S,1.855,1.48447]];
var _NeB0=[[3088623*_S,1.4410437,38.1330356],[27701*_S,5.909627,76.2660712],[27237*_S,3.14159,0]];
var _NeB1=[[227279*_S,3.807931,38.133035],[2721*_S,3.14159,0]];
var _NeR0=[[3007013206*_S,0,0],[27062259*_S,1.32999459,38.1330356],[1691764*_S,3.2518614,36.6485629]];
var _NeR1=[[236339*_S,0.70498,38.133035]];

function _vs(t,tau){var s=0;t.forEach(function(v){s+=v[0]*Math.cos(v[1]+v[2]*tau);});return s;}
function _helio(L0,L1,L2,B0,B1,R0,R1,tau){
  var L=_vs(L0,tau)+_vs(L1,tau)*tau+(L2?_vs(L2,tau)*tau*tau:0);
  var B=_vs(B0,tau)+(B1?_vs(B1,tau)*tau:0);
  var Rv=_vs(R0,tau)+_vs(R1,tau)*tau;
  return{x:Rv*Math.cos(B)*Math.cos(L),y:Rv*Math.cos(B)*Math.sin(L),z:Rv*Math.sin(B)};
}
function _geoLon(p,e){return n360(Math.atan2(p.y-e.y,p.x-e.x)*180/Math.PI);}

function kepler(M,e){var E=M,d;for(var i=0;i<10;i++){d=E-e*Math.sin(E)-M;E-=d/(1-e*Math.cos(E));if(Math.abs(d)<1e-10)break;}return E;}
function _kepGeo(L0r,Lr,e0r,er,w0r,wr,i0r,ir,O0r,Or,ar,jd,ex,ey){
  var T=(jd-2451545)/36525,L=n360(L0r+Lr*T),e=e0r+er*T,w=n360(w0r+wr*T),i=R(i0r+ir*T),O=R(O0r+Or*T),M=R(n360(L-w)),E=kepler(M,e),nu=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2)),r=ar*(1-e*Math.cos(E));
  var sm=R(w)-O,u=nu+sm,x=r*(Math.cos(O)*Math.cos(u)-Math.sin(O)*Math.sin(u)*Math.cos(i)),y=r*(Math.sin(O)*Math.cos(u)+Math.cos(O)*Math.sin(u)*Math.cos(i));
  return n360(Math.atan2(y-ey,x-ex)*180/Math.PI);
}

function sunLon(jd){
  var T=(jd-2451545)/36525,L0=n360(280.46646+36000.76983*T),M=n360(357.52911+35999.05029*T-.0001537*T*T),Mr=R(M);
  return n360(L0+(1.914602-.004817*T-.000014*T*T)*Math.sin(Mr)+(0.019993-.000101*T)*Math.sin(2*Mr)+.000289*Math.sin(3*Mr));
}
function moonLon(jd){
  var T=(jd-2451545)/36525,L0=n360(218.3165+481267.8813*T),M=n360(357.5291+35999.0503*T),Mp=n360(134.9634+477198.8676*T),D=n360(297.8502+445267.1115*T),F=n360(93.2721+483202.0175*T);
  return n360(L0+6.2888*Math.sin(R(Mp))+1.274*Math.sin(R(2*D-Mp))+.6583*Math.sin(R(2*D))+.2136*Math.sin(R(2*Mp))-.1851*Math.sin(R(M))-.1143*Math.sin(R(2*F))+.0588*Math.sin(R(2*D-2*Mp))+.0572*Math.sin(R(2*D-M-Mp))+.0533*Math.sin(R(2*D+Mp)));
}
function parseLon(lon){
  var si=Math.floor(lon/30)%12,s=lon-si*30,d=Math.floor(s),m=Math.floor((s-d)*60);
  return{totalDeg:lon,sign:SIGNS[si],deg:d,min:m};
}
function lonToRA(lon){var l=R(lon),e=R(OBL);return n360(Math.atan2(Math.sin(l)*Math.cos(e),Math.cos(l))*180/Math.PI);}
function lonToDec(lon){var l=R(lon),e=R(OBL);return Math.asin(Math.sin(e)*Math.sin(l))*180/Math.PI;}

function computePlanets(jd,lat,lng){
  var p={};
  var tau=(jd-2451545)/365250;
  var E=_helio(_EL0,_EL1,_EL2,_EB0,null,_ER0,_ER1,tau);
  p.Sun=parseLon(sunLon(jd));
  p.Moon=parseLon(moonLon(jd));
  p.Venus  =parseLon(_geoLon(_helio(_VL0,_VL1,_VL2,_VB0,_VB1,_VR0,_VR1,tau),E));
  p.Mars   =parseLon(_geoLon(_helio(_MaL0,_MaL1,_MaL2,_MaB0,_MaB1,_MaR0,_MaR1,tau),E));
  p.Jupiter=parseLon(_geoLon(_helio(_JuL0,_JuL1,_JuL2,_JuB0,_JuB1,_JuR0,_JuR1,tau),E));
  p.Saturn =parseLon(_geoLon(_helio(_SaL0,_SaL1,_SaL2,_SaB0,_SaB1,_SaR0,_SaR1,tau),E));
  p.Uranus =parseLon(_geoLon(_helio(_UrL0,_UrL1,_UrL2,_UrB0,_UrB1,_UrR0,_UrR1,tau),E));
  p.Neptune=parseLon(_geoLon(_helio(_NeL0,_NeL1,_NeL2,_NeB0,_NeB1,_NeR0,_NeR1,tau),E));
  p.Mercury=parseLon(_kepGeo(252.250906,149472.6746358,0.20563175,-0.000020407,77.45779628,0.15940013,7.00498625,-0.00594749,48.33076593,-0.12534081,0.387098310,jd,E.x,E.y));
  p.Pluto  =parseLon(_kepGeo(238.929038,145.2078051,0.24880766,0,224.068916,0,17.1410426,0,110.3034700,0,39.48211675,jd,E.x,E.y));
  var gmst=n360(280.46061837+360.98564736629*(jd-2451545));
  var ramc=n360(gmst+lng),rr=R(ramc),er=R(OBL),lr=R(lat);
  var mc=n360(Math.atan2(Math.tan(rr),Math.cos(er))*180/Math.PI);
  if(Math.cos(rr)<0)mc=n360(mc+180);
  var asc=n360(Math.atan2(Math.cos(rr),-(Math.sin(rr)*Math.cos(er)+Math.tan(lr)*Math.sin(er)))*180/Math.PI);
  // Chiron — Keplerian approximation (~6° accuracy)
  (function(){
    var T=(jd-2451545)/36525;
    var a=13.6605,ec=0.3316+0.0002*T;
    var ii=R(6.9316-0.003*T);
    var OO=R(n360(209.3724+0.7*T));
    var wb=339.5971+1.5*T;
    var Ld=n360(209.0+(360/50.45)*(jd-2451545)/365.25);
    var Mr=R(n360(Ld-wb));
    var Ev=Mr,dv;
    for(var k=0;k<50;k++){dv=(Mr-Ev+ec*Math.sin(Ev))/(1-ec*Math.cos(Ev));Ev+=dv;if(Math.abs(dv)<1e-10)break;}
    var nu2=2*Math.atan2(Math.sqrt(1+ec)*Math.sin(Ev/2),Math.sqrt(1-ec)*Math.cos(Ev/2));
    var rr=a*(1-ec*Math.cos(Ev));
    var wr=R(wb-209.3724);
    var uu=nu2+wr;
    var cx=rr*(Math.cos(OO)*Math.cos(uu)-Math.sin(OO)*Math.sin(uu)*Math.cos(ii));
    var cy=rr*(Math.sin(OO)*Math.cos(uu)+Math.cos(OO)*Math.sin(uu)*Math.cos(ii));
    var cz=rr*Math.sin(uu)*Math.sin(ii);
    var ELd=n360(100.466457+36000.7698278*T);
    var EMr2=R(n360(357.529+35999.050*T));
    var Ek=EMr2;for(var k=0;k<10;k++){var dk=(EMr2-Ek+0.016709*Math.sin(Ek))/(1-0.016709*Math.cos(Ek));Ek+=dk;if(Math.abs(dk)<1e-10)break;}
    var Er=1.000001*(1-0.016709*Math.cos(Ek));
    var ELt=n360(ELd+(1.9146-0.004817*T)*Math.sin(EMr2)+0.020*Math.sin(2*EMr2));
    var Ex=Er*Math.cos(R(ELt)),Ey=Er*Math.sin(R(ELt));
    var dx2=cx-Ex,dy2=cy-Ey,dz2=cz;
    var clon=n360(Math.atan2(dy2,dx2)*180/Math.PI);
    var eb=Math.atan2(dz2,Math.sqrt(dx2*dx2+dy2*dy2));
    var er=R(OBL);
    var cl=R(clon);
    var cra=n360(Math.atan2(Math.sin(cl)*Math.cos(er)-Math.tan(eb)*Math.sin(er),Math.cos(cl))*180/Math.PI);
    var cdec=Math.asin(Math.sin(eb)*Math.cos(er)+Math.cos(eb)*Math.sin(er)*Math.sin(cl))*180/Math.PI;
    // Store Chiron RA/Dec for line drawing via acgData sync
    p.Chiron=parseLon(clon);
    p._chironRA=cra;
    p._chironDec=cdec;
  })();
  p.Midheaven=parseLon(mc);
  p.IC=parseLon(n360(mc+180));
  p.Ascendant=parseLon(asc);
  p.Descendant=parseLon(n360(asc+180));
  return p;
}

var ADEFS=[{n:'conjunction',a:0,o:8,s:'☌'},{n:'sextile',a:60,o:4,s:'⚹'},{n:'square',a:90,o:7,s:'□'},{n:'trine',a:120,o:7,s:'△'},{n:'opposition',a:180,o:8,s:'☍'}];
function computeAspects(p){
  var names=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'],out=[];
  for(var i=0;i<names.length;i++)for(var j=i+1;j<names.length;j++){
    var p1=names[i],p2=names[j],diff=Math.abs(p[p1].totalDeg-p[p2].totalDeg),ang=diff>180?360-diff:diff;
    ADEFS.forEach(function(a){var orb=Math.abs(ang-a.a);if(orb<=a.o)out.push({p1:p1,p2:p2,type:a.n,sym:a.s,orb:Math.round(orb*10)/10});});
  }
  return out.sort(function(a,b){return a.orb-b.orb;});
}

// ═══════════════════════════════════════════════════════════
// ACG LINE MATH — CORRECTED
// MC  = gmst - ra           (geographic lon where planet culminates)
// ASC = mcLon - H           (planet rises H° before culminating)
// DSC = mcLon + H           (planet sets H° after culminating)
// IC  = mcLon + 180°
// ═══════════════════════════════════════════════════════════
function buildACG(planets,jd){
  var T=(jd-2451545.0)/36525.0;
  var gmst=n360(280.46061837+360.98564736629*(jd-2451545)
    +0.000387933*T*T-T*T*T/38710000.0);
  var lines={};
  var e=R(OBL);

  ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'].forEach(function(nm){
    var lon=R(planets[nm].totalDeg);
    // Convert ecliptic longitude to equatorial RA/Dec
    var ra=n360(Math.atan2(Math.sin(lon)*Math.cos(e),Math.cos(lon))*180/Math.PI);
    var dec=Math.asin(Math.sin(e)*Math.sin(lon))*180/Math.PI;
    var dr=R(dec);

    // MC longitude: where GMST equals RA → geographic longitude = GMST - RA
    var mcL=n180(gmst-ra);
    var icL=n180(mcL+180);

    var mc=[],ic=[],asc=[],dsc=[];

    // MC and IC are vertical lines at all latitudes
    for(var lat=-85;lat<=85;lat+=1){
      mc.push([lat,mcL]);
      ic.push([lat,icL]);
    }

    // ASC/DSC: compute at each latitude where planet crosses horizon
    for(var lat2=-85;lat2<=85;lat2+=1){
      var cH=-Math.tan(R(lat2))*Math.tan(dr);
      if(Math.abs(cH)>1)continue; // circumpolar or never rises
      var H=Math.acos(Math.max(-1,Math.min(1,cH)))*180/Math.PI;
      // ASC: planet rises H degrees BEFORE culmination (west of MC)
      asc.push([lat2,n180(mcL-H)]);
      // DSC: planet sets H degrees AFTER culmination (east of MC)
      dsc.push([lat2,n180(mcL+H)]);
    }

    lines[nm]={MC:mc,IC:ic,ASC:asc,DSC:dsc,mcLon:mcL,ra:ra,dec:dec};
  });
  return lines;
}

// ═══════════════════════════════════════════════════════════
// MAP ENGINE — Tile-based slippy map
// ═══════════════════════════════════════════════════════════
var ltypeState={MC:true,IC:true,ASC:true,DSC:true};
var toggleState={};

var _map={
  canvas:null,svg:null,ctx:null,wrap:null,
  W:0,H:0,zoom:2,zoomF:2.0,cx:0,cy:20,
  dragging:false,lastX:0,lastY:0,pinchDist:0,pinchZoom:2,
  tileCache:{},ready:false,hasDragged:false
};

function _tileUrl(z,x,y){
  var n=1<<z;x=((x%n)+n)%n;
  var s=['a','b','c','d'][(Math.abs(x+y))%4];
  return 'https://'+s+'.basemaps.cartocdn.com/rastertiles/voyager/'+z+'/'+x+'/'+y+'.png';
}
function _lngToTileX(lng,z){return(lng+180)/360*Math.pow(2,z);}
function _latToTileY(lat,z){
  var lr=Math.max(-85.05,Math.min(85.05,lat))*Math.PI/180;
  return(1-Math.log(Math.tan(lr)+1/Math.cos(lr))/Math.PI)/2*Math.pow(2,z);
}
function _tileXToLng(tx,z){return tx/Math.pow(2,z)*360-180;}
function _tileYToLat(ty,z){
  var n=Math.PI-2*Math.PI*ty/Math.pow(2,z);
  return 180/Math.PI*Math.atan(0.5*(Math.exp(n)-Math.exp(-n)));
}
function _ll2px(lat,lng){
  var z=_map.zoomF,tileSize=256;
  var cx=_lngToTileX(_map.cx,z)*tileSize;
  var cy=_latToTileY(_map.cy,z)*tileSize;
  var px=_lngToTileX(lng,z)*tileSize-cx+_map.W/2;
  var py=_latToTileY(lat,z)*tileSize-cy+_map.H/2;
  return{x:px,y:py};
}
function _px2ll(x,y){
  var z=_map.zoomF,tileSize=256;
  var cx=_lngToTileX(_map.cx,z)*tileSize;
  var cy=_latToTileY(_map.cy,z)*tileSize;
  var tx=(x-_map.W/2+cx)/tileSize;
  var ty=(y-_map.H/2+cy)/tileSize;
  return{lat:_tileYToLat(ty,z),lng:_tileXToLng(tx,z)};
}
function _loadTile(z,x,y){
  var key=z+'/'+x+'/'+y;
  if(_map.tileCache[key])return _map.tileCache[key];
  var img=new Image();img.crossOrigin='anonymous';
  img.onload=function(){img._loaded=true;_redraw();};
  img.onerror=function(){
    if(img.src.indexOf('openstreetmap')<0){
      var n=1<<z,xi=((x%n)+n)%n,subs=['a','b','c'];
      img.src='https://'+subs[xi%3]+'.tile.openstreetmap.org/'+z+'/'+xi+'/'+y+'.png';
    }
  };
  img.src=_tileUrl(z,x,y);
  _map.tileCache[key]=img;
  var keys=Object.keys(_map.tileCache);
  if(keys.length>600)delete _map.tileCache[keys[0]];
  return img;
}
function _renderTiles(){
  var m=_map;if(!m.ctx)return;
  var ctx=m.ctx,W=m.W,H=m.H;
  var z=Math.round(m.zoomF),tileSize=256;
  var scale=Math.pow(2,m.zoomF-z),scaledTile=tileSize*scale;
  ctx.clearRect(0,0,W,H);ctx.fillStyle='#ddeef7';ctx.fillRect(0,0,W,H);
  var cTX=_lngToTileX(m.cx,z),cTY=_latToTileY(m.cy,z);
  var tilesX=Math.ceil(W/scaledTile)+2,tilesY=Math.ceil(H/scaledTile)+2;
  var startTX=Math.floor(cTX-tilesX/2),startTY=Math.floor(cTY-tilesY/2);
  for(var ty=startTY;ty<=startTY+tilesY;ty++){
    for(var tx=startTX;tx<=startTX+tilesX;tx++){
      if(ty<0||ty>=Math.pow(2,z))continue;
      var img=_loadTile(z,tx,ty);
      var px=(tx-cTX)*scaledTile+W/2,py=(ty-cTY)*scaledTile+H/2;
      if(img._loaded)ctx.drawImage(img,px,py,scaledTile+1,scaledTile+1);
      else{ctx.fillStyle='#ddeef7';ctx.fillRect(px,py,scaledTile,scaledTile);}
    }
  }
}

function _renderOverlay(){
  var m=_map,svg=m.svg;
  if(!svg||!acgData||!activeChart){if(svg)svg.innerHTML='';return;}
  var W=m.W,H=m.H;
  var lw=Math.max(1.2,Math.min(2.5,m.zoomF*0.45));
  var fs=Math.round(Math.max(9,Math.min(13,m.zoomF*2.2)));
  var PALL=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode','SNode'];
  var html='';
  var topLabels=[],botLabels=[],leftLabels=[],rightLabels=[];

  function buildPaths(pts){
    var paths=[],seg=[];
    for(var i=0;i<pts.length;i++){
      var p=_ll2px(pts[i][0],pts[i][1]);
      if(seg.length>0&&Math.abs(p.x-seg[seg.length-1].x)>W*0.45){if(seg.length>1)paths.push(seg);seg=[];}
      seg.push(p);
    }
    if(seg.length>1)paths.push(seg);
    return paths;
  }
  function segToD(seg){
    var d='M'+seg[0].x.toFixed(1)+','+seg[0].y.toFixed(1);
    for(var i=1;i<seg.length;i++)d+=' L'+seg[i].x.toFixed(1)+','+seg[i].y.toFixed(1);
    return d;
  }

  PALL.forEach(function(p){
    if(!toggleState[p]||!acgData[p])return;
    var col=PCOL[p];
    ['MC','IC','ASC','DSC'].forEach(function(lt){
      if(!ltypeState[lt])return;
      var pts=acgData[p][lt];if(!pts||pts.length<2)return;
      var isDash=(lt==='IC'||lt==='DSC');
      var ltype=lt==='ASC'?'AC':lt==='DSC'?'DC':lt;
      var fullLabel=PSYM[p]+' '+ltype;
      var opacity=isDash?0.55:0.92;
      var sw=lw*(isDash?0.75:1);
      var dash=isDash?'stroke-dasharray="6,4"':'';
      buildPaths(pts).forEach(function(seg){
        if(seg.length<2)return;
        html+='<path d="'+segToD(seg)+'" stroke="'+col+'" stroke-width="'+sw+'" fill="none" opacity="'+opacity+'" '+dash+' stroke-linecap="round" stroke-linejoin="round"/>';
        var topPt=null,botPt=null;
        seg.forEach(function(pt){if(!topPt||pt.y<topPt.y)topPt=pt;if(!botPt||pt.y>botPt.y)botPt=pt;});
        if(topPt)topLabels.push({x:topPt.x,y:topPt.y,text:fullLabel,col:col});
        if(botPt)botLabels.push({x:botPt.x,y:botPt.y,text:fullLabel,col:col});
        var first=seg[0],last=seg[seg.length-1];
        if(first.x<5)leftLabels.push({y:first.y,text:fullLabel,col:col});
        else if(last.x<5)leftLabels.push({y:last.y,text:fullLabel,col:col});
        if(first.x>W-5)rightLabels.push({y:first.y,text:fullLabel,col:col});
        else if(last.x>W-5)rightLabels.push({y:last.y,text:fullLabel,col:col});
      });
    });
  });

  function svgLabel(text,x,y,col,anchor){
    var cw=text.length*fs*0.6+4;
    var bx=anchor==='start'?x:anchor==='end'?x-cw:x-cw/2;
    var tx=anchor==='start'?x+2:anchor==='end'?x-2:x;
    return '<rect x="'+bx+'" y="'+(y-fs/2-2)+'" width="'+cw+'" height="'+(fs+4)+'" fill="rgba(250,248,244,0.9)" rx="2"/>'+
           '<text x="'+tx+'" y="'+y+'" fill="'+col+'" font-size="'+fs+'" font-family="Jost,sans-serif" font-weight="500" dominant-baseline="middle" text-anchor="'+(anchor||'middle')+'">'+text+'</text>';
  }

  topLabels.sort(function(a,b){return a.x-b.x;});var lastTX=-999;
  topLabels.forEach(function(lb){if(lb.x<0||lb.x>W)return;var ty=Math.max(fs+4,Math.min(lb.y,fs+4));if(Math.abs(lb.x-lastTX)<fs*3)return;html+=svgLabel(lb.text,lb.x,ty,lb.col,'center');lastTX=lb.x;});
  botLabels.sort(function(a,b){return a.x-b.x;});var lastBX=-999;
  botLabels.forEach(function(lb){if(lb.x<0||lb.x>W)return;var by=Math.min(H-fs-4,Math.max(lb.y,H-fs-4));if(Math.abs(lb.x-lastBX)<fs*3)return;html+=svgLabel(lb.text,lb.x,by,lb.col,'center');lastBX=lb.x;});
  leftLabels.sort(function(a,b){return a.y-b.y;});var lastLY=-999;
  leftLabels.forEach(function(lb){if(lb.y<0||lb.y>H)return;if(Math.abs(lb.y-lastLY)<fs*2)return;html+=svgLabel(lb.text,4,lb.y,lb.col,'start');lastLY=lb.y;});
  rightLabels.sort(function(a,b){return a.y-b.y;});var lastRY=-999;
  rightLabels.forEach(function(lb){if(lb.y<0||lb.y>H)return;if(Math.abs(lb.y-lastRY)<fs*2)return;html+=svgLabel(lb.text,W-4,lb.y,lb.col,'end');lastRY=lb.y;});

  if(activeChart.geo&&activeChart.geo.lat!=null){
    var bp=_ll2px(activeChart.geo.lat,activeChart.geo.lng);
    if(bp.x>0&&bp.x<W&&bp.y>0&&bp.y<H){
      html+='<circle cx="'+bp.x+'" cy="'+bp.y+'" r="8" fill="none" stroke="#b8955a" stroke-width="2.5"/>';
      html+='<circle cx="'+bp.x+'" cy="'+bp.y+'" r="2" fill="#b8955a"/>';
      html+='<text x="'+bp.x+'" y="'+(bp.y-13)+'" fill="#1a1714" font-size="10" font-family="Jost,sans-serif" font-weight="500" text-anchor="middle">Birth</text>';
    }
  }
  svg.innerHTML=html;
}

var _rafPending=false;
function _redraw(){
  if(_rafPending)return;_rafPending=true;
  requestAnimationFrame(function(){_rafPending=false;_renderTiles();_renderOverlay();});
}

function _setupMapEvents(){
  var cv=_map.canvas;
  var coordEl=document.getElementById('mapCoords');
  cv.addEventListener('mousedown',function(e){
    _map.dragging=true;_map.hasDragged=false;
    _map.lastX=e.clientX;_map.lastY=e.clientY;
    cv.style.cursor='grabbing';
  });
  window.addEventListener('mousemove',function(e){
    if(!_map.dragging){
      var r=cv.getBoundingClientRect();
      var ll=_px2ll(e.clientX-r.left,e.clientY-r.top);
      if(coordEl&&ll.lat>-90&&ll.lat<90)
        coordEl.textContent=Math.abs(ll.lat).toFixed(2)+(ll.lat>=0?'°N':'°S')+' '+Math.abs(ll.lng).toFixed(2)+(ll.lng>=0?'°E':'°W');
      return;
    }
    var dx=e.clientX-_map.lastX,dy=e.clientY-_map.lastY;
    if(Math.abs(dx)+Math.abs(dy)>8)_map.hasDragged=true;
    _map.lastX=e.clientX;_map.lastY=e.clientY;
    var z=_map.zoomF,tileSize=256,scale=Math.pow(2,z)*tileSize;
    _map.cx-=dx/scale*360;
    _map.cx=((_map.cx+180)%360+360)%360-180;
    var cTY=_latToTileY(_map.cy,z);
    _map.cy=_tileYToLat(cTY-dy/tileSize,z);
    _map.cy=Math.max(-85,Math.min(85,_map.cy));
    _redraw();
  });
  window.addEventListener('mouseup',function(){_map.dragging=false;cv.style.cursor='crosshair';});
  cv.addEventListener('mouseleave',function(){if(coordEl)coordEl.textContent='';});
  cv.addEventListener('wheel',function(e){
    e.preventDefault();
    var r=cv.getBoundingClientRect();
    var mx=e.clientX-r.left,my=e.clientY-r.top;
    var raw=e.deltaY;
    if(e.deltaMode===1)raw*=32;if(e.deltaMode===2)raw*=400;
    var step=Math.max(-1,Math.min(1,-raw/100));
    if(Math.abs(step)<0.05)return;
    var llBefore=_px2ll(mx,my);
    var oldZ=_map.zoomF;
    _map.zoomF=Math.max(1,Math.min(17,oldZ+step));
    if(_map.zoomF===oldZ)return;
    var tileSize=256;
    _map.cx=_tileXToLng(_lngToTileX(llBefore.lng,_map.zoomF)-(mx-_map.W/2)/tileSize,_map.zoomF);
    _map.cy=_tileYToLat(_latToTileY(llBefore.lat,_map.zoomF)-(my-_map.H/2)/tileSize,_map.zoomF);
    _map.cx=((_map.cx+180)%360+360)%360-180;
    _map.cy=Math.max(-85,Math.min(85,_map.cy));
    _redraw();
  },{passive:false});
  cv.addEventListener('touchstart',function(e){
    e.preventDefault();_map.hasDragged=false;
    if(e.touches.length===1){
      _map.dragging=true;_map.pinching=false;
      _map.lastX=e.touches[0].clientX;_map.lastY=e.touches[0].clientY;
    }else if(e.touches.length===2){
      _map.dragging=false;_map.pinching=true;_map.hasDragged=true;
      _map.pinchDist=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      _map.pinchZoom=_map.zoomF;
    }
  },{passive:false});
  cv.addEventListener('touchmove',function(e){
    e.preventDefault();
    if(e.touches.length===1&&_map.dragging){
      var dx=e.touches[0].clientX-_map.lastX,dy=e.touches[0].clientY-_map.lastY;
      if(Math.abs(dx)+Math.abs(dy)>10)_map.hasDragged=true;
      _map.lastX=e.touches[0].clientX;_map.lastY=e.touches[0].clientY;
      var z=_map.zoomF,tileSize=256,scale=Math.pow(2,z)*tileSize;
      _map.cx-=dx/scale*360;
      _map.cx=((_map.cx+180)%360+360)%360-180;
      var cTY=_latToTileY(_map.cy,z);
      _map.cy=_tileYToLat(cTY-dy/tileSize,z);
      _map.cy=Math.max(-85,Math.min(85,_map.cy));
      _redraw();
    }else if(e.touches.length===2){
      var d=Math.hypot(e.touches[1].clientX-e.touches[0].clientX,e.touches[1].clientY-e.touches[0].clientY);
      var newZ=Math.max(1,Math.min(17,_map.pinchZoom+Math.log2(d/_map.pinchDist)));
      var r2=cv.getBoundingClientRect();
      var midX=(e.touches[0].clientX+e.touches[1].clientX)/2-r2.left;
      var midY=(e.touches[0].clientY+e.touches[1].clientY)/2-r2.top;
      var llMid=_px2ll(midX,midY);
      _map.zoomF=newZ;var tileSize=256;
      _map.cx=_tileXToLng(_lngToTileX(llMid.lng,newZ)-(midX-_map.W/2)/tileSize,newZ);
      _map.cy=_tileYToLat(_latToTileY(llMid.lat,newZ)-(midY-_map.H/2)/tileSize,newZ);
      _map.cx=((_map.cx+180)%360+360)%360-180;
      _map.cy=Math.max(-85,Math.min(85,_map.cy));
      _redraw();
    }
  },{passive:false});
  cv.addEventListener('touchend',function(e){
    _map.dragging=false;
    // Don't open card after pinch zoom — wait 400ms after last pinch
    if(_map.pinching){
      _map.pinching=false;_map.hasDragged=true;
      clearTimeout(_map.pinchTimer);
      _map.pinchTimer=setTimeout(function(){_map.hasDragged=false;},400);
      return;
    }
    if(!_map.hasDragged&&e.changedTouches.length===1&&acgData&&activeChart){
      var r=cv.getBoundingClientRect();
      var ll=_px2ll(e.changedTouches[0].clientX-r.left,e.changedTouches[0].clientY-r.top);
      _handleMapClick(ll.lat,ll.lng);
    }
  },{passive:false});
  cv.addEventListener('click',function(e){
    if(_map.hasDragged)return;
    var r=cv.getBoundingClientRect();
    var ll=_px2ll(e.clientX-r.left,e.clientY-r.top);
    _handleMapClick(ll.lat,ll.lng);
  });
}

function _handleMapClick(lat,lng){
  if(!acgData||!activeChart)return;
  var PALL=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode','SNode'];
  var PALL_PZ=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode']; // SNode excluded from power zones

  // For each line, find its longitude at the CLICKED latitude
  // This is the only reliable way to know if lines genuinely cross near the click
  function _lngAtLat(pts, targetLat){
    if(!pts||pts.length<2)return null;
    // Find two bracketing points around targetLat
    var sorted=pts.slice().sort(function(a,b){return a[0]-b[0];});
    for(var i=0;i<sorted.length-1;i++){
      var a=sorted[i], b=sorted[i+1];
      if(a[0]<=targetLat&&b[0]>=targetLat){
        var t=(targetLat-a[0])/(b[0]-a[0]);
        var dlng=b[1]-a[1];
        if(dlng>180)dlng-=360;if(dlng<-180)dlng+=360;
        return a[1]+t*dlng;
      }
    }
    return null;
  }

  // Find nearest line to the click for normal card
  var nearby=[];
  PALL_PZ.forEach(function(p){
    if(!toggleState[p]||!acgData[p])return;
    ['MC','IC','ASC','DSC'].forEach(function(lt){
      if(!ltypeState[lt])return;
      var pts=acgData[p][lt];if(!pts)return;
      var best=Infinity;
      for(var i=0;i<pts.length;i++){
        var dlat=pts[i][0]-lat,dlng=pts[i][1]-lng;
        if(dlng>180)dlng-=360;if(dlng<-180)dlng+=360;
        var d=Math.sqrt(dlat*dlat+dlng*dlng);
        if(d<best)best=d;
      }
      // Get the line's longitude at the exact clicked latitude
      var lngHere=_lngAtLat(pts,lat);
      if(best<Infinity)nearby.push({p:p,lt:lt,d:best,lngHere:lngHere});
    });
  });
  nearby.sort(function(a,b){return a.d-b.d;});

  // Power zone detection:
  // 1. Click must be within 1.5° of at least one line
  // 2. 2+ lines must have their longitude at the clicked latitude within 1.5° of each other
  // This means they genuinely cross near this point
  var inZone=[];
  var clickedLines=nearby.filter(function(x){return x.d<1.5&&x.lngHere!=null;});
  if(clickedLines.length>=2){
    // Group lines that are close to each other at this latitude
    var refLng=clickedLines[0].lngHere;
    inZone=clickedLines.filter(function(x){
      var dlng=Math.abs(x.lngHere-refLng);
      if(dlng>180)dlng=360-dlng;
      return dlng<1.5;
    });
    if(inZone.length<2)inZone=[];
  }
  var bestP=nearby.length?nearby[0].p:'Sun';
  var bestLT=nearby.length?nearby[0].lt:'MC';
  // Always find nearest city from local DB — no distance limit
  var zoom=_map.zoomF;
  var nearCity='',bestCD=Infinity;
  CITY_DB.forEach(function(city){
    var dlat=city.lat-lat,dlng=city.lng-lng;
    if(dlng>180)dlng-=360;if(dlng<-180)dlng+=360;
    var d=Math.sqrt(dlat*dlat+dlng*dlng);
    if(d<bestCD){bestCD=d;nearCity=city.n+(city.c?', '+city.c:'');}
  });
  var initLabel=nearCity||'This location';
  openCard(initLabel,bestP,bestLT,lat,lng,inZone.length>=2?inZone:null);
  // Then try GeoNames for better result
  fetch('/api/geonames?type=reverse&lat='+lat.toFixed(5)+'&lng='+lng.toFixed(5)+'&zoom='+Math.round(zoom))
    .then(function(r){return r.json();})
    .then(function(data){
      if(!data.label)return;
      window._resolvedCityName=data.label; // store for _openReading
      var el=document.getElementById('rcCity');
      if(el&&document.getElementById('readingCard').classList.contains('open')){
        var parts=el.innerHTML.split('<br>');
        el.innerHTML=data.label+(parts[1]?'<br>'+parts[1]:'');
      }
    }).catch(function(){});
}

function mapZoom(delta){_map.zoomF=Math.max(1,Math.min(17,_map.zoomF+delta));_redraw();}
function mapReset(){
  if(activeChart&&activeChart.geo&&activeChart.geo.lat!=null){
    _map.cx=activeChart.geo.lng;_map.cy=activeChart.geo.lat;
  }else{_map.cx=0;_map.cy=20;}
  _map.zoomF=3.0;_redraw();
}

function drawMap(){
  var wrap=document.getElementById('mapWrap');if(!wrap)return;
  var tileCanvas=document.getElementById('mapTiles');
  // SVG overlay - no canvas needed
  if(!tileCanvas)return;
  var W=wrap.clientWidth||800;
  var H=parseInt(getComputedStyle(tileCanvas).height)||520;
  tileCanvas.width=W;tileCanvas.height=H;
  _map.W=W;_map.H=H;
  _map.canvas=tileCanvas;
  _map.ctx=tileCanvas.getContext('2d');
  _map.svg=document.getElementById('lineSvg');
  _map.svg.setAttribute('viewBox','0 0 '+W+' '+H);var cr=document.getElementById('mapClipRect');if(cr){cr.setAttribute('width',W);cr.setAttribute('height',H);}
  if(!_map.ready){
    _map.ready=true;
    _map.cx=(activeChart&&activeChart.geo&&activeChart.geo.lat!=null)?activeChart.geo.lng:0;
    _map.cy=(activeChart&&activeChart.geo&&activeChart.geo.lat!=null)?activeChart.geo.lat:20;
    _map.zoomF=3.0;
    _setupMapEvents();
  }
  _redraw();
  window.addEventListener('resize',function(){
    var nW=wrap.clientWidth||800;
    tileCanvas.width=nW;_map.W=nW;if(_map.svg)_map.svg.setAttribute('viewBox','0 0 '+nW+' '+_map.H);_redraw();
  });
}
function drawLines(){_renderOverlay();}

// ═══════════════════════════════════════════════════════════
// FORM SUBMISSION
// ═══════════════════════════════════════════════════════════
var acgData=null,activeChart=null;

function handleSubmit(e){
  e.preventDefault();
  var geoErr=document.getElementById('geoErr');
  if(!selectedGeo){geoErr.classList.add('on');document.getElementById('cityInput').focus();return;}
  geoErr.classList.remove('on');
  var day=parseInt(document.getElementById('inDay').value,10);
  var month=parseInt(document.getElementById('inMonth').value,10);
  var year=parseInt(document.getElementById('inYear').value,10);
  var hour=parseInt(document.getElementById('inHour').value||'12',10);
  var min=parseInt(document.getElementById('inMinute').value||'0',10);
  var name=document.getElementById('inName').value.trim()||'You';
  var btn=document.querySelector('.submit-btn');
  btn.textContent='Casting your chart…';btn.disabled=true;
  var dateStr=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  var tzUrl='https://secure.geonames.org/timezoneJSON?lat='+selectedGeo.lat.toFixed(4)+'&lng='+selectedGeo.lng.toFixed(4)+'&date='+dateStr+'&username=sarahmchapman';
  fetch(tzUrl)
    .then(function(r){return r.json();})
    .then(function(data){
      var raw=(data&&data.rawOffset!=null)?data.rawOffset:tzFromLng(selectedGeo.lng);
      var dst=(data&&data.dstOffset!=null)?data.dstOffset:raw;
      var summerMonth=(month>=4&&month<=10);
      var tz=(summerMonth&&dst!==raw)?dst:raw;
      _buildChart(day,month,year,hour,min,name,tz);
    })
    .catch(function(){_buildChart(day,month,year,hour,min,name,tzFromLng(selectedGeo.lng));})
    .finally(function(){btn.textContent='Reveal My Map';btn.disabled=false;});
}

function _buildChart(day,month,year,hour,min,name,tz){
  var utH=hour-tz,utD=day,utMo=month,utY=year;
  if(utH>=24){utH-=24;utD++;}if(utH<0){utH+=24;utD--;}
  var jd=jdFromDate(utY,utMo,utD,utH,min);
  var planets=computePlanets(jd,selectedGeo.lat,selectedGeo.lng);
  var aspects=computeAspects(planets);
  ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode','SNode'].forEach(function(p){toggleState[p]=true;});
  ltypeState={MC:true,IC:true,ASC:true,DSC:true};
  selectedFocus='Love';
  activeChart={name:name,_jd:jd,birthDate:day+' '+MONTH_NAMES[month-1]+' '+year,birthTime:pad(hour)+':'+pad(min)+' (UTC'+(tz>=0?'+':'')+tz+')',birthPlace:selectedGeo.display,geo:selectedGeo,planets:planets,aspects:aspects};

  // Save profile to Supabase if signed in
  if (_currentUser) {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_profile',
        user_id: _currentUser.id,
        email: _currentUser.email,
        name: name,
        birth_date: day+' '+MONTH_NAMES[month-1]+' '+year,
        birth_time: pad(hour)+':'+pad(min),
        birth_place: selectedGeo.display,
        birth_lat: selectedGeo.lat,
        birth_lng: selectedGeo.lng
      })
    }).catch(function(err) { console.error('Save profile error:', err); });
  }
  document.getElementById('formScreen').style.display='none';
  document.getElementById('mapScreen').style.display='block';
  window.scrollTo(0,0);
  ['All','Love','Career','Healing','Self'].forEach(function(f){var b=document.getElementById('ff-'+f);if(b)b.classList.toggle('on',f==='All');});
  ['MC','IC','ASC','DSC'].forEach(function(lt){var b=document.getElementById('lt-'+lt);if(b)b.classList.add('on');});
  renderChart();buildToggleBar();buildLegend();drawMap();
  // Fetch accurate ACG lines from server API
  fetch('/api/astro?jd='+jd)
    .then(function(r){return r.json();})
    .then(function(data){
      acgData=data.lines;
      // Build Chiron lines client-side since API can\'t compute them
      if(activeChart&&activeChart.planets._chironRA!=null){
        var cRA=activeChart.planets._chironRA;
        var cDec=activeChart.planets._chironDec;
        var G=n360(280.46061837+360.98564736629*(activeChart._jd-2451545));
        var mcLon=n180(cRA-G);
        var icLon=n180(mcLon+180);
        var mc=[],ic=[],asc=[],dsc=[];
        for(var lt=-89;lt<=89;lt++){mc.push([lt,mcLon]);ic.push([lt,icLon]);}
        for(var lt=-89;lt<=89;lt++){
          var ch=-Math.tan(R(lt))*Math.tan(R(cDec));
          if(Math.abs(ch)>1)continue;
          var H=Math.acos(Math.max(-1,Math.min(1,ch)))*180/Math.PI;
          asc.push([lt,n180(cRA-H-G)]);
          dsc.push([lt,n180(cRA+H-G)]);
        }
        acgData.Chiron={MC:mc,IC:ic,ASC:asc,DSC:dsc,mcLon:mcLon,ra:cRA,dec:cDec};
      }
      // Derive NNode/SNode natal positions from API data
      if(activeChart&&acgData){
        if(acgData.NNode&&acgData.NNode.ra!=null){
          var nra=acgData.NNode.ra, ndec=acgData.NNode.dec;
          var ee=23.4365*Math.PI/180;
          // Correct RA+Dec -> ecliptic longitude
          var nlon=n360(Math.atan2(
            Math.sin(nra*Math.PI/180)*Math.cos(ee)+Math.tan(ndec*Math.PI/180)*Math.sin(ee),
            Math.cos(nra*Math.PI/180)
          )*180/Math.PI);
          activeChart.planets.NNode=parseLon(nlon);
          // South Node is always exactly opposite
          activeChart.planets.SNode=parseLon(n360(nlon+180));
        }
      }
      drawLines();buildLegend();
    })
    .catch(function(){
      acgData=buildACG(planets,jd);
      drawLines();buildLegend();
    });
}

var PDESC={Sun:'identity, vitality, core self',Moon:'emotions, instincts, inner world',Mercury:'mind, communication, thinking',Venus:'love, beauty, values',Mars:'drive, action, desire',Jupiter:'growth, luck, expansion',Saturn:'discipline, structure, karma',Uranus:'change, rebellion, awakening',Neptune:'dreams, spirituality, illusion',Pluto:'transformation, power, rebirth',Chiron:'healing, wounds, integration',NNode:'karmic direction, soul growth',SNode:'karmic past, natural gifts'};
function renderChart(){
  // Only update the top bar — chart grid removed from map page
  var chart=activeChart;
  document.getElementById('barName').innerHTML='<em>'+chart.name+'</em>';
  document.getElementById('barMeta').textContent=chart.birthDate+' · '+chart.birthTime+' · '+chart.birthPlace;
}

function buildToggleBar(){
  var tb=document.getElementById('togBtns');tb.innerHTML='';
  var allP=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode'];
  allP.forEach(function(p){
    if(!toggleState.hasOwnProperty(p))toggleState[p]=true;
    var col=PCOL[p];
    var btn=document.createElement('button');
    btn.className='tog-btn'+(toggleState[p]?'':' off');
    btn.id='togBtn-'+p;btn.style.borderColor=col;btn.style.color=col;
    btn.innerHTML='<span class="tg">'+PSYM[p]+'</span><span class="tn">'+p+'</span>';
    btn.onclick=(function(pp,bb){return function(){togglePlanet(pp,bb);};})(p,btn);
    tb.appendChild(btn);
  });
}
function buildLegend(){
  var leg=document.getElementById('mapLegend');leg.innerHTML='';
  var allP=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode'];
  allP.forEach(function(p){
    if(!toggleState[p])return;
    leg.innerHTML+='<span class="leg-item"><span class="leg-dot" style="background:'+PCOL[p]+'"></span><span style="font-size:.68rem;color:var(--ink-2)">'+PSYM[p]+' '+p+'</span></span>';
  });
  leg.innerHTML+='<span class="leg-item" style="margin-left:auto;color:var(--ink-3);font-size:.65rem">solid=MC/ASC &nbsp; dashed=IC/DSC</span>';
}
function togglePlanet(p,btn){toggleState[p]=!toggleState[p];btn.classList.toggle('off',!toggleState[p]);drawLines();buildLegend();}
function toggleLT(lt,btn){ltypeState[lt]=!ltypeState[lt];btn.classList.toggle('on',ltypeState[lt]);drawLines();}
function setFocusFilter(focus,btn){
  selectedFocus=(focus==='All'?'Love':focus);
  ['All','Love','Career','Healing','Self'].forEach(function(f){var b=document.getElementById('ff-'+f);if(b)b.classList.toggle('on',f===focus);});
  var show=focus==='All'?null:(FOCUS_PLANETS[focus]||null);
  var allP=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode'];
  allP.forEach(function(p){
    toggleState[p]=show?show.indexOf(p)>=0:true;
    var b=document.getElementById('togBtn-'+p);if(b)b.classList.toggle('off',!toggleState[p]);
  });
  drawLines();buildLegend();
}

// ═══════════════════════════════════════════════════════════
// READING CONTENT
// ═══════════════════════════════════════════════════════════
var LINE_DESC={
  MC:'The Midheaven line crowns this planet overhead.',
  IC:'The IC line roots this planet at the base of the chart.',
  ASC:'The Rising line places this planet on the eastern horizon.',
  DSC:'The Descendant line mirrors this energy into your relationship axis.'
};
var FEELING={
  Sun:{Love:'warmly seen, radiant, effortlessly attractive',Career:'purposeful, visible, fully alive in your work',Healing:'vital and self-possessed',Self:'unmistakably yourself'},
  Moon:{Love:'emotionally open, gently held',Career:'intuitive, nurtured by the work',Healing:'safe enough to feel everything',Self:'in rhythm with your inner tides'},
  Mercury:{Love:'witty, mentally stimulated, truly heard',Career:'sharp, articulate, strategically quick',Healing:'able to name what was unspeakable',Self:'curious, mobile, freely expressive'},
  Venus:{Love:'irresistibly magnetic, drawn toward beauty',Career:'graceful under pressure, aesthetically attuned',Healing:'gentled back into pleasure and self-worth',Self:'at ease in your own skin'},
  Mars:{Love:'charged, desirous, alive with chemistry',Career:'driven, decisive, boldly competitive',Healing:'empowered to confront what you\'ve avoided',Self:'on fire — motivated, fearlessly initiating'},
  Jupiter:{Love:'expansive, lucky in love, adventurous',Career:'abundant, opportunity-rich, doors swinging open',Healing:'hopeful, held by something larger',Self:'optimistic, growing, brushing your best self'},
  Saturn:{Love:'serious, building something lasting',Career:'disciplined, respected, earning authority',Healing:'confronting what must be released',Self:'becoming who you\'re supposed to be'},
  Uranus:{Love:'electrically alive, unconventional, free',Career:'innovative, disrupting old patterns',Healing:'suddenly liberated from what felt fixed',Self:'awakened, original, untameable'},
  Neptune:{Love:'dissolving into another, spiritually bonded',Career:'inspired, guided by invisible currents',Healing:'surrendered, compassionately restored',Self:'permeable to beauty, brushing the transcendent'},
  Pluto:{Love:'compelled, transformed, irrevocably bonded',Career:'reborn professionally, power reclaimed',Healing:'in the crucible, burning toward regeneration',Self:'confronting the shadow, emerging reforged'},
  Chiron:{Love:'tender and open, wounds and gifts arriving together',Career:'called to serve through what you have healed',Healing:'seen in your wholeness, not just your wounds',Self:'integrating the wound into wisdom'},
  NNode:{Love:'drawn toward what feels fated and growth-inducing',Career:'aligned with your soul\'s true direction',Healing:'moving toward what your soul most needs',Self:'becoming who you are here to be'},
  SNode:{Love:'meeting souls who feel familiar and deeply known',Career:'drawing on natural gifts that feel effortless',Healing:'honouring your past while releasing what no longer serves',Self:'grounded in your deepest nature'}
};


var QUALITY={
  Sun:{MC:'radiant',IC:'rooted',ASC:'magnetic',DSC:'mirrored'},
  Moon:{MC:'visible',IC:'held',ASC:'open',DSC:'bonded'},
  Mercury:{MC:'articulate',IC:'reflective',ASC:'quick',DSC:'heard'},
  Venus:{MC:'luminous',IC:'cherished',ASC:'alluring',DSC:'devoted'},
  Mars:{MC:'driven',IC:'fierce',ASC:'alive',DSC:'charged'},
  Jupiter:{MC:'expansive',IC:'abundant',ASC:'fortunate',DSC:'growing'},
  Saturn:{MC:'authoritative',IC:'ancestral',ASC:'defined',DSC:'committed'},
  Uranus:{MC:'awakened',IC:'liberated',ASC:'electric',DSC:'free'},
  Neptune:{MC:'inspired',IC:'dissolved',ASC:'dreaming',DSC:'merged'},
  Pluto:{MC:'transformed',IC:'excavated',ASC:'intense',DSC:'compelled'}
,
  Chiron:{MC:'healing',IC:'tender',ASC:'wounded and wise',DSC:'mirroring'},
  NNode:{MC:'aligned',IC:'rooted in purpose',ASC:'becoming',DSC:'fated'},
  SNode:{MC:'gifted',IC:'ancestral',ASC:'familiar',DSC:'karmic'}
};

function _lineDistance(lat,lng,pts){
  var best=Infinity;
  for(var i=0;i<pts.length;i++){
    var dlat=pts[i][0]-lat,dlng=pts[i][1]-lng;
    if(dlng>180)dlng-=360;if(dlng<-180)dlng+=360;
    var d=Math.sqrt(dlat*dlat+dlng*dlng);if(d<best)best=d;
  }
  return best;
}

function _diveDeeperBtn(cityName,lat,lng){
  if(!activeChart||lat==null||lng==null)return'';
  return '<div style="margin-top:1rem;padding-top:.75rem;border-top:.5px solid var(--paper-3);text-align:center">'
    +'<button onclick="_openReading('+lat+','+lng+')" '
    +'style="font-size:9px;font-weight:500;letter-spacing:.22em;text-transform:uppercase;'
    +'color:var(--paper);background:var(--ink);border:none;padding:.65rem 1.8rem;cursor:pointer;'
    +'transition:background .2s;width:100%;max-width:260px"'
    +' onmouseover="this.style.background=\'var(--gold)\'" onmouseout="this.style.background=\'var(--ink)\'">'
    +'Dive Deeper ✶'
    +'</button>'
    +'<p style="font-family:var(--serif);font-style:italic;font-size:.72rem;color:var(--ink-3);margin-top:.5rem">'
    +'See your full chart in this place</p>'
    +'</div>';
}

function _openReading(lat,lng){
  if(!activeChart)return;
  // Use GeoNames-resolved name if available, else read from card heading
  var cityName=window._resolvedCityName||'';
  if(!cityName){
    var cityEl=document.getElementById('rcCity');
    cityName=cityEl?cityEl.innerHTML.split('<br>')[0].replace(/<[^>]+>/g,'').trim():'This location';
  }
  // Build compact line data — just the MC longitude for each planet
  // enough to calculate distance from city without storing full point arrays
  var lineData={};
  var acg=acgData||{};
  ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode','SNode'].forEach(function(p){
    if(acg[p]){
      lineData[p]={
        mcLon:acg[p].mcLon!=null?acg[p].mcLon:null,
        ra:acg[p].ra!=null?acg[p].ra:null,
        dec:acg[p].dec!=null?acg[p].dec:null
      };
    }
  });
  localStorage.setItem('elsewhere_reading',JSON.stringify({
    jd:activeChart._jd,
    birthLat:activeChart.geo.lat,
    birthLng:activeChart.geo.lng,
    birthPlace:activeChart.birthPlace||activeChart.geo.display,
    birthDate:activeChart.birthDate,
    name:activeChart.name,
    cityName:cityName,
    cityLat:lat,
    cityLng:lng,
    lineData:lineData,
    planets:(function(){
      var out={};
      ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode','SNode'].forEach(function(p){
        var pd=activeChart.planets[p];
        if(pd)out[p]={sign:pd.sign,deg:pd.deg,min:pd.min,totalDeg:pd.totalDeg};
      });
      return out;
    })()
  }));
  // Save reading to account if signed in
  if (_currentUser) {
    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_reading',
        user_id: _currentUser.id,
        city_name: cityName,
        city_lat: lat,
        city_lng: lng
      })
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.success && _currentProfile) {
        _currentProfile.readings_used = (_currentProfile.readings_used || 0) + 1;
      }
    }).catch(function(err) { console.error('Save reading error:', err); });
  }
  window.open('/reading.html','_blank');
}

function openCard(cityName,planet,ltype,_lat,_lng,powerZone){
  if(!planet||!ltype||!activeChart)return;
  var chart=activeChart,pd=chart.planets[planet],col=PCOL[planet];
  var focus=selectedFocus;
  var PNAMES={NNode:'North Node',SNode:'South Node',Chiron:'Chiron'};
  var displayName=PNAMES[planet]||planet;
  var quality=((QUALITY[planet]||{})[ltype])||'transformed';
  var distNote='';
  if(_lat!=null&&_lng!=null&&acgData&&acgData[planet]&&acgData[planet][ltype]){
    var dist=_lineDistance(_lat,_lng,acgData[planet][ltype]);
    var kmDist=Math.round(dist*111);
    if(dist<2)distNote='You are <strong>on or very near</strong> this line.';
    else if(dist<6)distNote='You are <strong>within orb</strong> of this line (~'+kmDist+'km). Its influence is active.';
    else if(dist<15)distNote='You are in the <strong>extended field</strong> (~'+kmDist+'km). The energy is present but subtle.';
    else distNote='The nearest '+planet+' '+ltype+' line is approximately <strong>'+kmDist+'km</strong> away.';
  }
  var relA=chart.aspects.filter(function(a){return a.p1===planet||a.p2===planet;});
  var _aspG={
    'Sun-Moon-conjunction':"Your public face and your emotional self are unusually close — you don\'t have to perform much or hide how you really feel.",
    'Sun-Mercury-conjunction':"How you think and how you come across are essentially the same thing — your mind is very much on the surface.",
    'Sun-Venus-conjunction':"Warmth and confidence arrive together in you — you tend to be someone people genuinely want to be around.",
    'Sun-Mars-conjunction':"Drive and identity are fused in you — when you want something, you go after it without much internal debate.",
    'Sun-Jupiter-conjunction':"There's a natural optimism and confidence in you that tends to make things expand — doors open more easily than they do for most.",
    'Sun-Saturn-conjunction':"You take yourself seriously, sometimes more than others realise — ambition and discipline are baked into how you operate.",
    'Sun-Uranus-conjunction':"You don't quite fit the expected mould, and you've probably stopped trying — originality is just how you\'re built.",
    'Sun-Neptune-conjunction':"There's an idealistic, dreamy quality to how you move through the world — you see possibility where others see limits.",
    'Sun-Pluto-conjunction':"You have an intensity that people sense before you speak — transformation isn't something that happens to you, it\'s something you do.",
    'Moon-Mercury-conjunction':"Your feelings and your thoughts are hard to separate — you process emotion by talking or writing about it.",
    'Moon-Venus-conjunction':"Warmth and emotional depth arrive together in you — people feel genuinely cared for in your presence.",
    'Moon-Mars-conjunction':"You feel things with your whole body — emotion and action are fused, which means you move fast but sometimes react before you\'re ready.",
    'Moon-Jupiter-conjunction':"There's a generosity to your emotional life — you tend to make people feel held and hopeful at the same time.",
    'Moon-Saturn-conjunction':"You learned early that safety comes from self-sufficiency — there\'s an emotional self-containment that can look like strength or distance depending on the day.",
    'Moon-Uranus-conjunction':"Your emotional responses are unpredictable even to you — you need freedom and change in your inner life as much as your outer one.",
    'Moon-Neptune-conjunction':"You're highly sensitive to atmosphere — you absorb the mood of a place and the feelings of the people around you.",
    'Moon-Pluto-conjunction':"Your emotional life runs deep and intense — you don\'t do surface-level feeling, and you can sense what others are hiding.",
    'Venus-Mars-conjunction':"Passion and affection are fused in you — love tends to arrive with heat, and you don\'t separate desire from genuine care easily.",
    'Venus-Jupiter-conjunction':"There's a natural abundance to how you love and connect — generosity and warmth are just how you show up.",
    'Venus-Saturn-conjunction':"You're selective and serious about who you let in — love for you is something built, not just felt.",
    'Venus-Neptune-conjunction':"You're a romantic in the deepest sense — you see beauty and potential in people, sometimes more than they see in themselves.",
    'Venus-Pluto-conjunction':"Love for you tends to be all-or-nothing — you\'re drawn to depth and intensity, and surface-level connection leaves you cold.",
    'Mars-Jupiter-conjunction':"Your ambition has an optimistic quality — you act big and tend to believe things will work out, which often makes them do exactly that.",
    'Mars-Saturn-conjunction':"You have a slow-burning, relentless kind of drive — you don\'t give up easily and you\'re capable of real endurance.",
    'Mars-Pluto-conjunction':"Your drive runs very deep — when you want something, there\'s a quiet ferocity to how you pursue it.",
    'Jupiter-Saturn-conjunction':"You balance expansion and caution better than most — you know when to take a risk and when to hold back.",
    'Sun-Moon-trine':"Your public face and your private self are unusually close — you don\'t have to perform much.",
    'Sun-Venus-trine':"Warmth and confidence come naturally together in you — you\'re easy to like and you tend to know it.",
    'Sun-Mars-trine':"Drive and identity are well-matched — you act decisively without a lot of internal second-guessing.",
    'Sun-Jupiter-trine':"There's a natural confidence about you — things tend to work out, and you half-expect them to.",
    'Sun-Saturn-trine':"You have discipline and ambition without being rigid — you know how to work hard and still enjoy the results.",
    'Sun-Uranus-trine':"You're original and unconventional but not abrasively so — your difference is an asset you've learned to work with.",
    'Sun-Neptune-trine':"You have a creative, idealistic quality that sits easily in you — imagination isn't a burden, it\'s just how you see.",
    'Sun-Pluto-trine':"You have real psychological depth and the resilience that comes with it — you've been through things and it shows as strength.",
    'Moon-Venus-trine':"Emotional warmth and genuine care come naturally — people feel held in your presence without you having to try.",
    'Moon-Jupiter-trine':"There's a generosity and emotional expansiveness in you — you tend to make people feel more hopeful just by being around.",
    'Moon-Saturn-trine':"You have emotional steadiness without being cold — you can hold your feelings and other people's without losing yourself.",
    'Moon-Neptune-trine':"You're deeply intuitive and compassionate — you sense what people need before they say it.",
    'Moon-Pluto-trine':"Your emotional instincts about people are rarely wrong — you see through the surface.",
    'Venus-Saturn-trine':"You build love slowly and take it seriously — what lasts matters more to you than what dazzles.",
    'Venus-Jupiter-trine':"There's a natural warmth and good fortune in how you connect — people tend to feel lucky around you.",
    'Venus-Mars-trine':"Passion and affection are well-matched in you — you know what you want and you go after it with genuine warmth.",
    'Venus-Neptune-trine':"You have a genuine romantic idealism that doesn't tip into delusion — you see beauty in people and you\'re usually right.",
    'Venus-Pluto-trine':"Love for you has real depth — you\'re drawn to transformation in relationships and you tend to bring it out in others.",
    'Mars-Jupiter-trine':"Your drive has an optimistic quality — you tend to back yourself and things tend to go your way.",
    'Mars-Saturn-trine':"You have discipline and drive in equal measure — the ability to work hard over a long time without burning out.",
    'Mars-Pluto-trine':"You have a focused, quiet intensity — when you commit to something you see it through completely.",
    'Mercury-Jupiter-trine':"Your thinking runs big — you see patterns and possibilities that others miss, and you can communicate them clearly.",
    'Mercury-Saturn-trine':"You think carefully before you speak — your words tend to be precise and people trust what you say.",
    'Sun-Moon-square':"There's a tension between who you feel yourself to be and what you need emotionally — you push yourself hard sometimes.",
    'Sun-Mars-square':"Drive and identity are in friction — you\'re ambitious but sometimes at war with yourself about it.",
    'Sun-Saturn-square':"There's a demanding inner critic in you — you hold yourself to very high standards and sometimes struggle to feel like enough.",
    'Sun-Uranus-square':"You resist conformity in ways that can make life harder than it needs to be — but it\'s also what makes you genuinely interesting.",
    'Sun-Pluto-square':"There's an intensity and need for control in you that can serve you well or get in your way depending on how conscious you are of it.",
    'Moon-Mars-square':"There's a tension between what you feel and what you do about it — you act on emotion, sometimes before you've fully processed it.",
    'Moon-Saturn-square':"Emotional safety doesn't come easily — you've learned to be self-sufficient but sometimes at the cost of real vulnerability.",
    'Moon-Uranus-square':"Your emotional needs and your need for freedom are in constant negotiation — closeness and space are both necessary and hard to balance.",
    'Moon-Pluto-square':"Your emotional life is intense and sometimes overwhelming — you feel things at a depth that most people don't.",
    'Venus-Saturn-square':"Love doesn't come easily or lightly for you — there\'s a fear of rejection underneath, and you test people before you trust them.",
    'Venus-Mars-square':"Desire and affection are in friction — relationships tend to be passionate but not always easy.",
    'Venus-Pluto-square':"Love is rarely simple for you — there\'s an all-or-nothing quality to how you connect that can be consuming.",
    'Mars-Saturn-square':"Drive and caution are in friction — you have real ambition but something holds back right when you\'re about to move.",
    'Mars-Pluto-square':"There's a power struggle in you between assertion and control — the intensity can be hard to manage when you want something.",
    'Mercury-Saturn-square':"Your mind is exacting and sometimes harsh on yourself — you overthink and can be harder on your own ideas than they deserve.",
    'Sun-Moon-opposition':"What looks successful from the outside doesn't always feel right inside — your need for recognition and your emotional needs pull in different directions.",
    'Sun-Saturn-opposition':"Ambition and limitation are in dialogue in you — you\'re driven but regularly confronted with where you\'re not yet enough.",
    'Sun-Jupiter-opposition':"Confidence and overreach are your poles — you can go very big, and sometimes too big.",
    'Moon-Saturn-opposition':"The need for warmth and the fear of vulnerability are in tension — you want closeness but keep a certain distance.",
    'Venus-Mars-opposition':"What you want and what you love are sometimes in opposition — desire and affection don't always point in the same direction.",
    'Venus-Jupiter-opposition':"You can idealise love and people to a degree that sets you up for disappointment — the reality rarely matches the vision.",
    'Mars-Jupiter-opposition':"Your drive and your optimism can tip into overconfidence — you sometimes take on more than you can deliver.",
    'Sun-Moon-sextile':"Your sense of self and your emotional life support each other quietly — you\'re more integrated than you probably give yourself credit for.",
    'Sun-Venus-sextile':"Warmth and confidence work together in you — you\'re likable without having to try too hard.",
    'Sun-Jupiter-sextile':"There's a quiet confidence about you — things tend to open up when you engage with them.",
    'Moon-Venus-sextile':"Emotional warmth comes naturally — people feel genuinely cared for without you having to perform it.",
    'Venus-Saturn-sextile':"You approach love thoughtfully and with care — you\'re not reckless with people's hearts, including your own.",
    'Mercury-Venus-sextile':"You communicate with warmth — people feel heard when they talk to you.",
    'Mars-Venus-sextile':"Passion and affection sit comfortably together — you love with genuine heat and genuine care.",
    'Jupiter-Saturn-sextile':"You have a good instinct for when to expand and when to hold back — a balance most people spend their whole lives trying to find."
  };
  var _aspAngle={
    conjunction:{MC:'In your public life and career here, both sides of this show up directly — visible in how you work and how you are seen.',IC:'In your home life and private world here, it shapes what you need and what grounds you.',ASC:'In how you come across to people here, both sides arrive at once — people sense it the moment they meet you.',DSC:'In your closest relationships here, that combination shows up in who you draw to you and what you create together.'},
    trine:{MC:'In your public life and career here, that ease becomes visible — things come more naturally than they would elsewhere.',IC:'In your home life and private world here, that translates into a genuine sense of comfort and belonging.',ASC:'In how you come across to people here, it shows up effortlessly — you don\'t have to work at it.',DSC:'In your closest relationships here, it attracts people and connections that feel genuinely easy and reciprocal.'},
    sextile:{MC:'In your public life and career here, that quiet support adds up — small advantages that open doors.',IC:'In your home life and private world here, it creates a gentle ease that\'s easy to take for granted.',ASC:'In how you come across to people here, there\'s an openness and warmth that makes you easy to approach.',DSC:'In your closest relationships here, it supports connections that grow steadily rather than dramatically.'},
    square:{MC:'In your public life and career here, that friction becomes visible — drive and resistance play out where people can see it.',IC:'In your home life and private world here, it surfaces in what you carry and what you\'re working through.',ASC:'In how you come across to people here, the tension is right on the surface — an intensity that\'s hard to ignore.',DSC:'In your closest relationships here, people tend to mirror that friction back — it\'s rarely comfortable but rarely dull.'},
    opposition:{MC:'In your public life and career here, that tension plays out openly — one pull against another, both real.',IC:'In your home life and private world here, it surfaces between what you need and what you allow yourself.',ASC:'In how you come across to people here, the competing pulls are immediately visible — others sense the tension in you.',DSC:'In your closest relationships here, people tend to embody one side of that tension and hold it up for you.'}
  };
  function _buildAspectText(a,plt,lt){
    var other=a.p1===plt?a.p2:a.p1;
    var key1=plt+'-'+other+'-'+a.type,key2=other+'-'+plt+'-'+a.type;
    var gen=_aspG[key1]||_aspG[key2]||'';
    var angleCtx=(_aspAngle[a.type]||{})[lt]||'';
    if(!gen)return '';
    return '<p style="margin:0 0 .7rem;font-family:var(--serif);font-size:.86rem;color:var(--ink-2);line-height:1.65">'+gen+' '+angleCtx+'</p>';
  }
  var personText=relA.length
    ?relA.slice(0,2).map(function(a){return _buildAspectText(a,planet,ltype);}).filter(Boolean).join('')||('<p style="margin:0;font-family:var(--serif);font-size:.86rem;color:var(--ink-2);line-height:1.65">'+PSYM[planet]+' '+(PNAMES[planet]||planet)+' connects with other planets in your chart — its influence here is part of a larger pattern.</p>')
    :'<p style="margin:0;font-family:var(--serif);font-size:.86rem;color:var(--ink-2);line-height:1.65">Your '+(PNAMES[planet]||planet)+' stands alone in your chart — nothing softens or complicates it. In this place its energy arrives at full strength, unfiltered and pure.</p>';
  // ── Power Zone reading ──────────────────────────────────
  var _pzRoles={
    Sun:{MC:'your identity and purpose become visible — you show up as yourself, fully',IC:'your core self roots deeply here — home and who you are become the same thing',ASC:'you arrive as you truly are — confident, present, impossible to overlook',DSC:'your sense of self is reflected through your closest relationships here'},
    Moon:{MC:'your emotional depth becomes part of your public presence — people sense who you really are',IC:'this place feels like home at a soul level — you belong here without explanation',ASC:'you arrive open and emotionally alive — people feel safe with you immediately',DSC:'deep emotional connection finds you here — you are truly met in relationship'},
    Mercury:{MC:'your voice carries — ideas and sharp thinking open real doors here',IC:'your mind turns reflective here — deep thinking, important conversations with yourself',ASC:'you arrive articulate and curious — people want to talk to you',DSC:'the right words find you in relationship here — conversations that actually go somewhere'},
    Venus:{MC:'beauty, charm and creative confidence shape how you are recognised here',IC:'your private world becomes nourishing and beautiful — home feels like a sanctuary',ASC:'you arrive magnetic and warm — people are drawn to you before you say a word',DSC:'love and meaningful connection find you here — relationships feel genuinely harmonious'},
    Mars:{MC:'your drive and ambition are fully visible here — you act boldly and people notice',IC:'your energy goes into building something private and lasting — fierce and protective',ASC:'you arrive with fire and directness — your presence is felt immediately',DSC:'relationships here carry real passion and honest challenge — nothing stays surface level'},
    Jupiter:{MC:'opportunity and recognition expand here — doors open, your reputation grows',IC:'abundance finds you in private — home feels spacious, fortunate, held by something larger',ASC:'you arrive expansive and open — luck tends to show up when you engage with this place',DSC:'relationships here feel fortunate and expansive — people who open new worlds find you'},
    Saturn:{MC:'discipline and long-term thinking shape your public life here — recognition comes slowly but sticks',IC:'deep inner work is supported here — building real foundations, confronting the past',ASC:'you arrive with gravity and substance — people take you seriously',DSC:'relationships here are serious and lasting — commitment is tested and deepened'},
    Uranus:{MC:'your career breaks from convention here — originality and disruption lead somewhere new',IC:'old inherited patterns break open in private — real liberation is possible here',ASC:'you arrive electric and original — you don\'t fit the expected mould and it works',DSC:'relationships here are unconventional and freeing — connections that change the rules'},
    Neptune:{MC:'your calling becomes creative or spiritual here — inspired work guided by something unseen',IC:'home feels sacred and dreamlike — a place for healing, solitude, and spiritual depth',ASC:'you arrive soft and otherworldly — people sense something rare in you',DSC:'relationships here carry a spiritual or transcendent depth — soul-level connection'},
    Pluto:{MC:'transformation defines your public life here — power, depth, and complete reinvention',IC:'the deepest psychological work happens here — what is buried comes up to be healed',ASC:'you arrive with unmistakable intensity — people sense your depth before you speak',DSC:'relationships here are transformative — deep, consuming, and never superficial'},
    Chiron:{MC:'your wounds become your calling here — what you have healed, you can now offer others',IC:'deep personal healing is supported here — making peace with your roots and your story',ASC:'you arrive authentic and vulnerable — your scars and your gifts arrive together',DSC:'relationships here mirror your healing — genuine vulnerability rather than performance'},
    NNode:{MC:'your soul\'s direction aligns with your career here — this work feels destined',IC:'you are building the home and roots your soul has been moving toward',ASC:'you arrive as who you are becoming — this place pulls you toward your growth edge',DSC:'relationships here feel fated — connections that genuinely change your direction'},
    SNode:{MC:'your natural gifts show up effortlessly in your work here — deep authority without trying',IC:'deeply familiar emotional territory — ancestral, comfortable, and worth honouring',ASC:'you arrive with a natural ease — people sense you have been somewhere like this before',DSC:'relationships here feel like reunions — soul connections that carry real history'}
  };
  var _pzClosings={
    'MC-MC':'Both touch your public life and career — this is one of the most professionally charged locations on your map.',
    'IC-IC':'Both touch your home and private world — this is a deeply personal location, worth sitting with.',
    'ASC-ASC':'Both shape how you show up here — the way people experience you in this place is unusually concentrated.',
    'DSC-DSC':'Both activate your relationship life — this is a place where love and connection arrive with unusual force.',
    'MC-IC':'One touches your public life, the other your private world — this place holds both your outer ambition and your inner belonging.',
    'IC-MC':'One touches your private world, the other your public life — this place holds both your inner belonging and your outer ambition.',
    'MC-ASC':'One shapes how you are seen professionally, the other how you arrive personally — visibility comes from multiple directions here.',
    'ASC-MC':'One shapes how you arrive personally, the other how you are seen professionally — visibility comes from multiple directions here.',
    'MC-DSC':'One touches your career, the other your relationships — both tend to activate in this place at the same time.',
    'DSC-MC':'One touches your relationships, the other your career — both tend to activate in this place at the same time.',
    'IC-ASC':'One touches your private world, the other how you come across — this place can feel like both homecoming and fresh start.',
    'ASC-IC':'One touches how you come across, the other your private world — this place can feel like both fresh start and homecoming.',
    'IC-DSC':'One touches home and belonging, the other love and relationship — your deepest needs and closest connections converge here.',
    'DSC-IC':'One touches love and relationship, the other home and belonging — your closest connections and deepest needs converge here.',
    'ASC-DSC':'One shapes how you arrive, the other who arrives to meet you — the personal and relational are both activated here.',
    'DSC-ASC':'One shapes who arrives to meet you, the other how you arrive — the relational and personal are both activated here.'
  };

  function _buildPowerZoneHTML(pz){
    var lines=pz.slice(0,5);
    var labels=lines.map(function(x){
      var s=x.lt==='ASC'?'AC':x.lt==='DSC'?'DC':x.lt;
      return (PNAMES[x.p]||x.p)+' '+s;
    });
    var header='⊕ '+labels.join(' · ')+' — Power Zone';

    // Build meaning from planet+angle combinations
    // Key: what does this COMBINATION mean, not what each line does alone
    var _pzCombos={
      // Love/relationship crossings
      'Venus-Moon':'Love and emotional depth arrive together here — you can be both magnetic and genuinely open at the same time. Connection here tends to feel real.',
      'Venus-Jupiter':'This is one of the most celebrated combinations — beauty, warmth, and genuine good fortune converge. Love and abundance tend to arrive together in this place.',
      'Venus-Neptune':'Romance and spirituality blur into each other here. Connections made in this place tend to feel transcendent — though be careful what you idealise.',
      'Venus-Pluto':'Love here is rarely surface-level — intense, transformative, all-or-nothing. This place draws deep connections that change you.',
      'Venus-Mars':'Passion and affection meet here without friction — desire and genuine care point in the same direction.',
      'Moon-Jupiter':'Emotional generosity and abundance overlap here — you can feel both nourished and expansive at the same time.',
      'Moon-Neptune':'Feeling and dreaming blur here. This place is deeply intuitive and emotionally porous — beautiful and requiring some grounding.',
      'Moon-Pluto':'Emotional intensity runs deep here — transformation through feeling, connections that reach into what you usually keep hidden.',
      'Moon-Venus':'Warmth and belonging arrive together — this place can feel both beautiful and like home at the same time.',
      // Career/ambition crossings
      'Sun-Jupiter':'Confidence and opportunity align here — one of the strongest combinations for visibility, recognition, and professional growth.',
      'Sun-Mars':'Drive and identity are both on the surface here — you act boldly and people notice. A powerful place for ambition.',
      'Sun-Saturn':'Discipline and purpose converge here — recognition comes slowly but what you build in this place tends to last.',
      'Mars-Jupiter':'Ambition and optimism fuel each other here — you act big and tend to back yourself, which often makes things happen.',
      'Mars-Saturn':'Drive meets discipline here — relentless, focused, capable of building something genuinely enduring.',
      'Mercury-Jupiter':'Vision and communication combine here — your ideas run big and people want to hear them.',
      'Mercury-Sun':'Mind and identity are aligned here — how you think and how you show up are the same thing, making this a powerful place to be heard.',
      // Healing/transformation crossings
      'Chiron-Neptune':'Healing and spiritual depth meet here — a place for genuine restoration, especially from wounds that feel hard to name.',
      'Chiron-Pluto':'Deep transformation is available here — not comfortable, but the kind of change that actually sticks.',
      'Chiron-Moon':'Emotional healing and a sense of belonging arrive together — this place can hold both your tenderness and your wholeness.',
      'Pluto-Saturn':'Power and discipline intersect here — this place asks something real of you, and what you build here carries real weight.',
      'Pluto-Neptune':'Transformation and spiritual depth meet here — this place can dissolve old structures and reveal something more essential underneath.',
      // Node crossings
      'NNode-Venus':'Your soul\'s direction and your capacity for love and beauty converge here — a place where growth feels genuinely pleasurable.',
      'NNode-Jupiter':'Destiny and abundance align — this place supports stepping into who you are becoming with real optimism and opportunity.',
      'NNode-Sun':'Your karmic path and your core identity point in the same direction here — a place where being yourself is exactly what is needed.',
      'NNode-Moon':'Soul direction and emotional belonging arrive together — this place can feel both destined and like home.',
      'SNode-Saturn':'Natural gifts meet discipline here — what you have mastered over lifetimes finds real-world structure and authority.',
      'SNode-Sun':'Your natural gifts and your core identity align — you arrive in this place as someone who already knows how to be here.',
    };

    // Find best combo description
    var comboText='';
    if(lines.length>=2){
      var p1=lines[0].p, p2=lines[1].p;
      var key1=p1+'-'+p2, key2=p2+'-'+p1;
      comboText=_pzCombos[key1]||_pzCombos[key2]||'';
      // If no specific combo, try other pairs
      if(!comboText&&lines.length>=3){
        for(var pi=0;pi<lines.length&&!comboText;pi++){
          for(var pj=pi+1;pj<lines.length&&!comboText;pj++){
            var k1=lines[pi].p+'-'+lines[pj].p, k2=lines[pj].p+'-'+lines[pi].p;
            comboText=_pzCombos[k1]||_pzCombos[k2]||'';
          }
        }
      }
    }

    // Angle context
    var closingKey=lines[0].lt+'-'+lines[1].lt;
    var angleCtx=_pzClosings[closingKey]||'';

    var body=comboText
      ?(comboText+(angleCtx?' '+angleCtx:''))
      :(angleCtx||'Multiple planetary lines converge near here — this location carries concentrated influence.');

    if(lines.length>2){
      body+=' With '+lines.length+' lines active here, this is one of the more significant locations on your map.';
    }

    return {header:header,body:body};
  }

  var pzData=powerZone&&powerZone.length>=2?_buildPowerZoneHTML(powerZone):null;
  window._resolvedCityName=null; // reset on new card open
  document.getElementById('rcAccent').style.background=col;
  document.getElementById('rcCity').innerHTML=(cityName||'This location')+'<br><em>'+(pzData?'POWER ZONE':quality)+'</em>';

  if(pzData){
    document.getElementById('rcBody').innerHTML=
      '<div class="rc-slbl">Lines active here</div>'
      +'<div style="display:flex;flex-direction:column;gap:.3rem;margin-bottom:.75rem">'
      +powerZone.slice(0,3).map(function(x){
        var s=x.lt==='ASC'?'AC':x.lt==='DSC'?'DC':x.lt;
        var xpd=chart.planets[x.p];
        var xcol=PCOL[x.p];
        return '<div style="display:flex;align-items:center;gap:.5rem;padding:.3rem 0;border-bottom:.5px solid var(--paper-3)">'
          +'<span style="color:'+xcol+';font-family:var(--serif);font-size:1.2rem">'+PSYM[x.p]+'</span>'
          +'<span style="font-size:.65rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:'+xcol+'">'+(PNAMES[x.p]||x.p)+(xpd?' in '+xpd.sign:'')+' · '+s+'</span>'
          +'</div>';
      }).join('')
      +'</div>'
      +(distNote?'<div class="rc-rule"></div><div class="rc-prose" style="font-size:.82rem">'+distNote+'</div>':'')
      +'<div class="rc-rule"></div>'
      +'<div class="rc-slbl">What each line brings</div>'
      +powerZone.slice(0,3).map(function(x){
        var s=x.lt==='ASC'?'AC':x.lt==='DSC'?'DC':x.lt;
        var xpd=chart.planets[x.p];
        var xcol=PCOL[x.p];
        var lineDesc=(LINE_ACTIVATED[x.p]&&LINE_ACTIVATED[x.p][x.lt])||'';
        return '<div style="margin-bottom:1rem">'
          +'<div style="display:flex;align-items:center;gap:.5rem;margin-bottom:.35rem">'
          +'<span style="color:'+xcol+';font-family:var(--serif);font-size:1.2rem">'+PSYM[x.p]+'</span>'
          +'<span style="font-size:.65rem;font-weight:500;letter-spacing:.1em;text-transform:uppercase;color:'+xcol+'">'+(PNAMES[x.p]||x.p)+(xpd?' in '+xpd.sign:'')+' · '+s+'</span>'
          +'</div>'
          +(lineDesc?'<div class="rc-prose" style="margin:0">'+lineDesc+'</div>':'')
          +'</div>';
      }).join('')
      +'<div class="rc-rule"></div>'
      +'<div class="rc-slbl">The energies together</div>'
      +'<div class="rc-prose">'+pzData.body+'</div>'
      +'<div class="rc-rule"></div>';
  } else {
    document.getElementById('rcBody').innerHTML=
      '<div class="rc-planet-row"><span class="rc-glyph" style="color:'+col+'">'+PSYM[planet]+'</span><div><div class="rc-pname" style="color:'+col+'">'+displayName+' in '+pd.sign+' '+pd.deg+'°'+pad(pd.min)+"'"+'</div><div class="rc-ltype">'+{MC:'MC — Midheaven',IC:'IC — Imum Coeli',ASC:'AC — Ascendant',DSC:'DC — Descendant'}[ltype]+' line</div></div></div>'
      +(distNote?'<div class="rc-rule"></div><div class="rc-prose" style="font-size:.82rem">'+distNote+'</div>':'')
      +'<div class="rc-rule"></div>'
      +'<div class="rc-slbl">In this place you feel</div><div class="rc-feeling">'+((FEELING[planet]||{})[focus]||'powerfully present')+'.</div>'
      +'<div class="rc-slbl">What\'s activated</div><div class="rc-prose" id="rcActivated">'+((LINE_ACTIVATED[planet]&&LINE_ACTIVATED[planet][ltype])||LINE_DESC[ltype]||'')+' '+((SIGN_MODIFIERS[planet]&&SIGN_MODIFIERS[planet][pd.sign])||'')+'</div>'
      +'<div class="rc-slbl">Your chart here</div><div class="rc-prose">'+personText+'</div>'
      +'<div class="rc-irow"><div class="rc-ibox"><div class="rc-ilbl">Best for</div><div class="rc-itext">'+((BEST_FOR[planet]&&BEST_FOR[planet][ltype])||'')+'</div></div><div class="rc-ibox"><div class="rc-ilbl">Watch for</div><div class="rc-itext">'+((WATCH_FOR[planet]&&WATCH_FOR[planet][ltype])||'')+'</div></div></div>'
      +_diveDeeperBtn(cityName,_lat,_lng);
  }
  document.getElementById('readingCard').classList.add('open');
  document.getElementById('readingCard').scrollIntoView({behavior:'smooth',block:'nearest'});

}
function closeCard(){document.getElementById('readingCard').classList.remove('open');}

function resetToForm(){
  document.getElementById('mapScreen').style.display='none';
  document.getElementById('formScreen').style.display='flex';
  selectedGeo=null;acgData=null;activeChart=null;
  toggleState={};ltypeState={MC:true,IC:true,ASC:true,DSC:true};
  _map.ready=false;_map.tileCache={};_map.ctx=null;_map.svg=null;
  document.getElementById('cityInput').value='';
  document.getElementById('citySuggestions').innerHTML='';
  document.getElementById('readingCard').classList.remove('open');
  document.getElementById('mapLegend').innerHTML='';
}
window.addEventListener('resize',function(){if(activeChart)drawMap();});
