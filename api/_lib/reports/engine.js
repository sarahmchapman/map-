// engine.js — chart condition engine for elsewhere (logic copied from the project's reports-engine/engine.js; comments trimmed)
(function (global) {
  'use strict';
  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
               'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
  var TRADITIONAL = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
  var MODERN = ['Uranus','Neptune','Pluto','Chiron','NNode'];
  var MODERN_RULERSHIPS = { Uranus: ['Aquarius'], Neptune: ['Pisces'], Pluto: ['Scorpio'] };
  var MODERN_NATURE = {
    Uranus:  { score:  0, label: 'mixed by nature — disruption and awakening' },
    Neptune: { score: -1, label: 'dissolving by nature — dreams, sensitivity, escape' },
    Pluto:   { score: -2, label: 'intense by nature — power, depth, transformation' },
    Chiron:  { score: -2, label: 'tender by nature — wounding and the work of healing' },
    NNode:   { score:  0, label: 'forward-pulling by nature — direction of growth' }
  };
  var MODERN_PLANET_THEMES = {
    Uranus:  'disruption, awakening, sudden change, freedom',
    Neptune: 'dreams, dissolution, spiritual sensitivity, illusion',
    Pluto:   'transformation, depth, power, what is hidden brought to light',
    Chiron:  'the deepest wounds and the slow work of healing',
    NNode:   'the direction your soul is being drawn toward'
  };

  function getSect(planets) {
    if (!planets || !planets.Sun || !planets.Ascendant) return null;
    var sunLon = planets.Sun.totalDeg;
    var ascLon = planets.Ascendant.totalDeg;
    var diff = ((sunLon - ascLon) % 360 + 360) % 360;
    var sunAboveHorizon = diff >= 180;
    if (sunAboveHorizon) {
      return { type: 'day', luminary: 'Sun', benefic: 'Jupiter', malefic: 'Saturn',
               offSectBenefic: 'Venus', offSectMalefic: 'Mars', sunDiff: diff };
    } else {
      return { type: 'night', luminary: 'Moon', benefic: 'Venus', malefic: 'Mars',
               offSectBenefic: 'Jupiter', offSectMalefic: 'Saturn', sunDiff: diff };
    }
  }

  var DOMICILE = {
    Sun:['Leo'], Moon:['Cancer'], Mercury:['Gemini','Virgo'], Venus:['Taurus','Libra'],
    Mars:['Aries','Scorpio'], Jupiter:['Sagittarius','Pisces'], Saturn:['Capricorn','Aquarius']
  };
  var EXALTATION = { Sun:'Aries', Moon:'Taurus', Mercury:'Virgo', Venus:'Pisces',
    Mars:'Capricorn', Jupiter:'Cancer', Saturn:'Libra' };
  var DETRIMENT = {
    Sun:['Aquarius'], Moon:['Capricorn'], Mercury:['Sagittarius','Pisces'], Venus:['Aries','Scorpio'],
    Mars:['Taurus','Libra'], Jupiter:['Gemini','Virgo'], Saturn:['Cancer','Leo']
  };
  var FALL = { Sun:'Libra', Moon:'Scorpio', Mercury:'Pisces', Venus:'Virgo',
    Mars:'Cancer', Jupiter:'Capricorn', Saturn:'Aries' };
  var TRIPLICITY = {
    fire:  { signs:['Aries','Leo','Sagittarius'],     day:'Sun',     night:'Jupiter' },
    earth: { signs:['Taurus','Virgo','Capricorn'],    day:'Venus',   night:'Moon' },
    air:   { signs:['Gemini','Libra','Aquarius'],     day:'Saturn',  night:'Mercury' },
    water: { signs:['Cancer','Scorpio','Pisces'],     day:'Venus',   night:'Mars' }
  };

  function getEssentialDignity(planetName, planets, sect) {
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    if (!planets || !planets[planetName]) return null;
    var sign = planets[planetName].sign;
    if (!sign) return null;
    if (DOMICILE[planetName].indexOf(sign) !== -1) return { status:'domicile', score:5, label:'in own sign ('+sign+')' };
    if (EXALTATION[planetName] === sign) return { status:'exaltation', score:4, label:'exalted in '+sign };
    if (sect) {
      for (var element in TRIPLICITY) {
        var t = TRIPLICITY[element];
        if (t.signs.indexOf(sign) !== -1) {
          var ruler = (sect.type === 'day') ? t.day : t.night;
          if (ruler === planetName) return { status:'triplicity', score:3, label:'in own triplicity ('+sign+')' };
          break;
        }
      }
    }
    if (DETRIMENT[planetName].indexOf(sign) !== -1) return { status:'detriment', score:-5, label:'in detriment ('+sign+')' };
    if (FALL[planetName] === sign) return { status:'fall', score:-4, label:'in fall ('+sign+')' };
    return { status:'peregrine', score:0, label:'peregrine in '+sign };
  }

  function getWholeSignHouse(planetName, planets) {
    if (!planets || !planets[planetName] || !planets.Ascendant) return null;
    var planetSignIdx = SIGNS.indexOf(planets[planetName].sign);
    var ascSignIdx    = SIGNS.indexOf(planets.Ascendant.sign);
    if (planetSignIdx === -1 || ascSignIdx === -1) return null;
    return ((planetSignIdx - ascSignIdx + 12) % 12) + 1;
  }

  function getPlacidusHouse(planetName, planets) {
    if (!planets || !planets[planetName]) return null;
    var H = planets._houses;
    if (!H) return null;
    var lon = planets[planetName].totalDeg;
    if (lon == null) return null;
    for (var h = 1; h <= 12; h++) {
      var a = H[String(h)];
      var b = H[String(h === 12 ? 1 : h + 1)];
      if (a == null || b == null) return null;
      var span = ((b - a) % 360 + 360) % 360;
      var pos  = ((lon - a) % 360 + 360) % 360;
      if (pos < span) return h;
    }
    return null;
  }

  function getHouse(planetName, planets) {
    var p = getPlacidusHouse(planetName, planets);
    if (p) return p;
    return getWholeSignHouse(planetName, planets);
  }
  function getHouseSystem(planets) { return (planets && planets._houses) ? 'placidus' : 'whole-sign'; }

  function getAngularity(planetName, planets) {
    var house = getHouse(planetName, planets);
    if (!house) return null;
    // Oct 31: houses are judged per planet, as in traditional astrology.
    // A planet in its joy is at its best there; the Moon (body, emotional security) is weak in the hidden
    // houses (6, 8, 12); the 8th is a dark house for any planet, read lightly (it is also transformation).
    var JOY = { Mercury:1, Moon:3, Venus:5, Mars:6, Sun:9, Jupiter:11, Saturn:12 };
    if (JOY[planetName] === house) return { house:house, type:'joy', score:2, label:'in its joy ('+ordinal(house)+' house)' };
    if (planetName === 'Moon' && (house === 6 || house === 8 || house === 12)) return { house:house, type:'cadent', score:-4, label:'weakened in '+ordinal(house)+' house' };
    if (house === 8) return { house:house, type:'succedent', score:-1, label:'in the 8th house' };
    var angular   = [1,4,7,10];
    var succedent = [2,5,8,11];
    if (angular.indexOf(house) !== -1) return { house:house, type:'angular', score:3, label:'strong in '+ordinal(house)+' house' };
    if (succedent.indexOf(house) !== -1) return { house:house, type:'succedent', score:1, label:'in '+ordinal(house)+' house' };
    if (house === 6 || house === 12) return { house:house, type:'cadent', score:-2, label:'weakened in '+ordinal(house)+' house' };
    return { house:house, type:'cadent', score:-1, label:'in '+ordinal(house)+' house' };
  }

  function ordinal(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    var suffix = (v >= 11 && v <= 13) ? 'th' : (s[n % 10] || 'th');
    return n + suffix;
  }

  var HOUSE_THEMES = {
    1:'self, identity, appearance, how people see you', 2:'money, possessions, personal values, self-worth',
    3:'siblings, neighbors, short trips, daily communication', 4:'home, family, ancestry, roots, private life',
    5:'romance, creativity, children, play, self-expression', 6:'work routines, health, daily habits, service',
    7:'partnerships, marriage, open enemies, contracts', 8:'shared resources, intimacy, inheritance, transformation, the occult',
    9:'travel, higher learning, philosophy, religion, foreign cultures', 10:'career, reputation, public standing, authority',
    11:'friends, groups, networks, hopes and wishes', 12:'solitude, spirituality, hidden things, self-undoing'
  };

  function getRulerships(planetName, planets) {
    var ruledSigns = null;
    if (TRADITIONAL.indexOf(planetName) !== -1) ruledSigns = DOMICILE[planetName] || [];
    else if (MODERN_RULERSHIPS[planetName]) ruledSigns = MODERN_RULERSHIPS[planetName];
    else return { houses: [], themes: [] };
    if (!planets || !planets.Ascendant) return null;
    var houses = [], themes = [];
    var H = planets._houses;
    if (H) {
      for (var h = 1; h <= 12; h++) {
        var cuspLon = H[String(h)];
        if (cuspLon == null) continue;
        var cuspSign = SIGNS[Math.floor(((cuspLon % 360) + 360) % 360 / 30)];
        if (ruledSigns.indexOf(cuspSign) !== -1) { houses.push(h); themes.push(HOUSE_THEMES[h]); }
      }
    } else {
      var ascSignIdx = SIGNS.indexOf(planets.Ascendant.sign);
      if (ascSignIdx === -1) return null;
      ruledSigns.forEach(function (sign) {
        var signIdx = SIGNS.indexOf(sign);
        if (signIdx === -1) return;
        var house = ((signIdx - ascSignIdx + 12) % 12) + 1;
        houses.push(house); themes.push(HOUSE_THEMES[house]);
      });
    }
    return { houses: houses, themes: themes };
  }

  function getCombustion(planetName, planets) {
    if (planetName === 'Sun') return null;
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    if (!planets || !planets[planetName] || !planets.Sun) return null;
    var diff = Math.abs(planets[planetName].totalDeg - planets.Sun.totalDeg);
    if (diff > 180) diff = 360 - diff;
    if (diff <= 0.2833) return { status:'cazimi', score:6, label:'cazimi (heart of the Sun)' };
    if (diff <= 8.5) return { status:'combust', score:-4, label:'combust' };
    if (diff <= 15) return { status:'under_beams', score:-2, label:'under the beams' };
    return { status:'free', score:0, label:null };
  }

  function getSectStatus(planetName, sect) {
    if (!sect) return null;
    var label = sect.type === 'day' ? 'day chart' : 'night chart';
    if (planetName === sect.benefic) return { role:'sect_benefic', score:3, label:'sect benefic ('+label+')' };
    if (planetName === sect.offSectBenefic) return { role:'off_sect_benefic', score:1, label:'out-of-sect benefic ('+label+')' };
    if (planetName === sect.malefic) return { role:'sect_malefic', score:0, label:'of-sect malefic ('+label+')' };
    if (planetName === sect.offSectMalefic) return { role:'off_sect_malefic', score:-4, label:'out-of-sect malefic ('+label+')' };
    if (planetName === sect.luminary) return { role:'luminary', score:2, label:'luminary of the sect' };
    if (planetName === 'Sun' || planetName === 'Moon') return { role:'off_sect_luminary', score:0, label:'out-of-sect luminary' };
    return null;
  }

  function analyzePlanet(planetName, planets, sect) {
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    var dignity    = getEssentialDignity(planetName, planets, sect);
    var angularity = getAngularity(planetName, planets);
    var combustion = getCombustion(planetName, planets);
    var rulerships = getRulerships(planetName, planets);
    var sectStatus = getSectStatus(planetName, sect);
    var aspects    = getAspectPressure(planetName, planets);
    var baseScore = 0;
    if (dignity)    baseScore += dignity.score;
    if (angularity) baseScore += angularity.score;
    if (combustion) baseScore += combustion.score;
    if (sectStatus) baseScore += sectStatus.score;
    var score = Math.round((baseScore + aspects.score) * 10) / 10;
    return { planet: planetName, sign: planets[planetName].sign, house: angularity ? angularity.house : null,
      sect: sectStatus, dignity: dignity, angularity: angularity, combustion: combustion,
      rulerships: rulerships, aspects: aspects, baseScore: baseScore, score: score, kind: 'traditional' };
  }

  function analyzeOuterPlanet(planetName, planets) {
    if (MODERN.indexOf(planetName) === -1) return null;
    if (!planets || !planets[planetName]) return null;
    var angularity = getAngularity(planetName, planets);
    var rulerships = getRulerships(planetName, planets);
    var nature     = MODERN_NATURE[planetName] || { score: 0, label: null };
    var aspects    = getAspectPressure(planetName, planets);
    var baseScore = 0;
    if (angularity) baseScore += angularity.score;
    baseScore += nature.score;
    var score = Math.round((baseScore + aspects.score) * 10) / 10;
    return { planet: planetName, sign: planets[planetName].sign, house: angularity ? angularity.house : null,
      sect: null, dignity: null, angularity: angularity, combustion: null, rulerships: rulerships,
      nature: nature, aspects: aspects, baseScore: baseScore, score: score, kind: 'modern' };
  }

  function analyzeChart(planets) {
    var sect = getSect(planets);
    var result = { sect: sect, planets: {} };
    TRADITIONAL.forEach(function (p) { var a = analyzePlanet(p, planets, sect); if (a) result.planets[p] = a; });
    MODERN.forEach(function (p) { var a = analyzeOuterPlanet(p, planets); if (a) result.planets[p] = a; });
    return result;
  }

  function aspectOrbFor(planetName) {
    if (planetName === 'Sun' || planetName === 'Moon') return 6;
    if (planetName === 'Mercury' || planetName === 'Venus' || planetName === 'Mars') return 4;
    return 3;
  }
  var ASPECT_BASE = {
    conjunction: { dir:  0, weight: 3 }, opposition: { dir: -1, weight: 3 }, square: { dir: -1, weight: 3 },
    trine: { dir:  1, weight: 3 }, sextile: { dir:  1, weight: 2 }
  };
  var ASPECT_PLANET_WEIGHT = {
    Sun: 1, Moon: 1, Mercury: 0.5, Venus: 1.5, Jupiter: 1.5, Mars: -1.5, Saturn: -1.5,
    Uranus: 1, Neptune: -1, Pluto: -1.5, Chiron: -1.5, NNode: 1
  };

  function getAspectPressure(planetName, planets) {
    var empty = { score: 0, defining: null, all: [] };
    if (!planets || !planets._aspects || !planets._aspects.length) return empty;
    var mine = [];
    planets._aspects.forEach(function (a) {
      if (a.p1 !== planetName && a.p2 !== planetName) return;
      if (!ASPECT_BASE[a.type]) return;
      var other = (a.p1 === planetName) ? a.p2 : a.p1;
      var allow = Math.max(aspectOrbFor(planetName), aspectOrbFor(other));
      if (a.orb > allow) return;
      mine.push({ other: other, type: a.type, orb: a.orb, allow: allow });
    });
    if (!mine.length) return empty;
    var fused = false;
    if (planets.Jupiter && planets.Pluto && typeof planets.Jupiter.totalDeg === 'number' && typeof planets.Pluto.totalDeg === 'number') {
      var jp = Math.abs(planets.Jupiter.totalDeg - planets.Pluto.totalDeg) % 360;
      if (jp > 180) jp = 360 - jp;
      fused = jp <= 5;
    }
    var total = 0;
    mine.forEach(function (m) {
      if (fused && m.type === 'square' && (m.other === 'Jupiter' || m.other === 'Pluto') &&
          planetName !== 'Jupiter' && planetName !== 'Pluto') { m.intensity = true; return; }
      var base = ASPECT_BASE[m.type];
      var dir  = base.dir;
      var ow   = ASPECT_PLANET_WEIGHT[m.other];
      if (ow == null) ow = 1;
      if (m.type === 'conjunction') dir = ow > 0 ? 1 : (ow < 0 ? -1 : 0);
      var exact = 1 - (m.orb / m.allow);
      if (exact < 0) exact = 0;
      var mag = Math.abs(ow);
      total += dir * base.weight * mag * exact * 0.8;
    });
    var ASPECT_TOTAL_CAP = 2;
    if (total >  ASPECT_TOTAL_CAP) total =  ASPECT_TOTAL_CAP;
    if (total < -ASPECT_TOTAL_CAP) total = -ASPECT_TOTAL_CAP;
    total = Math.round(total * 10) / 10;
    var def = mine[0];
    mine.forEach(function (m) { if (m.orb < def.orb) def = m; });
    var defining = { other: def.other, type: def.type, orb: def.orb, label: planetName + ' ' + def.type + ' ' + def.other };
    return { score: total, defining: defining, all: mine };
  }

  function categorizeLine(planetName, analysis) {
    if (!analysis || !analysis.planets || !analysis.planets[planetName]) return null;
    var a = analysis.planets[planetName];
    var positives = [], negatives = [], neutrals = [];
    function push(item) {
      if (!item || !item.label) return;
      if (item.score > 0) positives.push({ label:item.label, score:item.score });
      else if (item.score < 0) negatives.push({ label:item.label, score:item.score });
      else neutrals.push({ label:item.label });
    }
    push(a.sect); push(a.dignity); push(a.angularity); push(a.combustion);
    if (a.nature) push(a.nature);
    positives.sort(function (x, y) { return y.score - x.score; });
    negatives.sort(function (x, y) { return x.score - y.score; });
    var pLabels = positives.map(function (p) { return p.label; });
    var nLabels = negatives.map(function (n) { return n.label; });
    var zLabels = neutrals.map(function (n) { return n.label; });
    var summary;
    if (pLabels.length && nLabels.length) summary = capitalize(pLabels.join(', ')) + ', but ' + nLabels.join(', ');
    else if (pLabels.length) summary = capitalize(pLabels.join(', '));
    else if (nLabels.length) summary = capitalize(nLabels.join(', '));
    else if (zLabels.length) summary = capitalize(zLabels.join(', '));
    else summary = 'No strong condition factors';
    function bucketFor(s) { if (s >= 2) return 2; if (s <= -2) return 0; return 1; }
    var BUCKETS = ['challenging', 'dynamic', 'harmonious'];
    var withAspects = bucketFor(a.score);
    var base = (typeof a.baseScore === 'number') ? bucketFor(a.baseScore) : withAspects;
    var capped = withAspects;
    if (withAspects > base + 1) capped = base + 1;
    if (withAspects < base - 1) capped = base - 1;
    var category = BUCKETS[capped];
    if (a.combustion && a.combustion.status === 'cazimi') category = 'harmonious';
    return { planet: planetName, category: category, score: a.score,
      baseScore: (typeof a.baseScore === 'number') ? a.baseScore : a.score, summary: summary,
      aspect: (a.aspects && a.aspects.defining) ? a.aspects.defining : null,
      rulerships: a.rulerships, sign: a.sign, house: a.house, kind: a.kind };
  }

  function capitalize(s) { if (!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }

  function categorizeAllLines(planets) {
    var analysis = analyzeChart(planets);
    var out = { harmonious: [], dynamic: [], challenging: [], sect: analysis.sect };
    TRADITIONAL.concat(MODERN).forEach(function (p) { var c = categorizeLine(p, analysis); if (c) out[c.category].push(c); });
    out.harmonious.sort(function (x, y) { return y.score - x.score; });
    out.challenging.sort(function (x, y) { return x.score - y.score; });
    out.dynamic.sort(function (x, y) { return y.score - x.score; });
    return out;
  }

  global.elsewhereEngine = global.elsewhereEngine || {};
  var E0 = global.elsewhereEngine;
  E0.getSect = getSect; E0.getEssentialDignity = getEssentialDignity; E0.getWholeSignHouse = getWholeSignHouse;
  E0.getPlacidusHouse = getPlacidusHouse; E0.getHouse = getHouse; E0.getHouseSystem = getHouseSystem;
  E0.getAngularity = getAngularity; E0.getCombustion = getCombustion; E0.getRulerships = getRulerships;
  E0.getSectStatus = getSectStatus; E0.analyzePlanet = analyzePlanet; E0.analyzeOuterPlanet = analyzeOuterPlanet;
  E0.analyzeChart = analyzeChart; E0.categorizeLine = categorizeLine; E0.categorizeAllLines = categorizeAllLines;
  E0.MODERN_PLANET_THEMES = MODERN_PLANET_THEMES;
})(typeof window !== 'undefined' ? window : globalThis);

(function (global) {
  'use strict';
  var E = global.elsewhereEngine;
  if (!E) return;
  var ASPECT_ANGLES = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
  var ASPECT_BODIES = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto','Chiron','NNode'];
  var LOOSE_ORB = 8;
  function computeAspects(planets) {
    var out = [];
    if (!planets) return out;
    for (var i = 0; i < ASPECT_BODIES.length; i++) {
      for (var j = i + 1; j < ASPECT_BODIES.length; j++) {
        var n1 = ASPECT_BODIES[i], n2 = ASPECT_BODIES[j];
        var b1 = planets[n1], b2 = planets[n2];
        if (!b1 || !b2) continue;
        if (typeof b1.totalDeg !== 'number' || typeof b2.totalDeg !== 'number') continue;
        var sep = Math.abs(b1.totalDeg - b2.totalDeg) % 360;
        if (sep > 180) sep = 360 - sep;
        for (var type in ASPECT_ANGLES) {
          var orb = Math.abs(sep - ASPECT_ANGLES[type]);
          if (orb <= LOOSE_ORB) { out.push({ p1: n1, p2: n2, type: type, orb: Math.round(orb * 100) / 100 }); break; }
        }
      }
    }
    return out;
  }
  function ensureAspects(planets) {
    if (planets && (!planets._aspects || !planets._aspects.length)) planets._aspects = computeAspects(planets);
    return planets;
  }
  var _origAnalyzeChart = E.analyzeChart;
  E.analyzeChart = function (planets) { return _origAnalyzeChart(ensureAspects(planets)); };
  var _origCategorizeAll = E.categorizeAllLines;
  E.categorizeAllLines = function (planets) { return _origCategorizeAll(ensureAspects(planets)); };
  E.computeAspects = computeAspects;
})(typeof window !== 'undefined' ? window : globalThis);
