// js/engine.js — chart condition engine for elsewhere
//
// Pure-function module that derives traditional astrological factors
// from natal chart data. No DOM, no globals, no dependencies on app.js
// state. Callers pass in a planets object (the same shape that
// computePlanets() in app.js produces) and get back a structured
// description of the chart's condition.
//
// Exposed as window.elsewhereEngine. Add this to any page that needs
// chart-condition synthesis with:
//   <script src="/js/engine.js?v=2"></script>
//
// Phase 1 (done): sect determination — getSect()
// Phase 2 (this file): essential dignity, whole-sign house, combustion,
//                      house rulership, and line categorization.
// Phase 3 (later): aspects synthesis using app.js computeAspects().

(function (global) {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────
  var SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo',
               'Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];

  // Traditional seven planets — these are the only planets that have
  // dignity, rulership, sect, and combustion in Hellenistic astrology.
  // Outer planets (Uranus, Neptune, Pluto) and points (Chiron, Nodes)
  // don't get categorized at the line level in this engine.
  var TRADITIONAL = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];

  // ─── Sect determination ─────────────────────────────────────
  // In traditional/Hellenistic astrology, a chart is either "diurnal"
  // (Sun above the horizon at birth) or "nocturnal" (Sun below the
  // horizon). Sect determines which benefic and malefic are "of sect"
  // (operating in their preferred polarity, generally stronger and more
  // beneficial in their action) versus "out of sect" (harder to access
  // for the benefic, more challenging in expression for the malefic).
  //
  // Geometric test: a planet is above the horizon when its ecliptic
  // longitude falls between the Descendant and Ascendant going through
  // the Midheaven — i.e. houses 7 through 12, measured forward in the
  // zodiac from the Ascendant. The simplest equivalent: the angular
  // distance from ASC to Sun, taken forward in zodiacal order, falls
  // between 180° and 360°.
  //
  // Input:  planets — object from computePlanets(); needs .Sun.totalDeg
  //                   and .Ascendant.totalDeg
  // Output: { type, luminary, benefic, malefic, offSectBenefic,
  //           offSectMalefic, sunDiff } — or null if inputs missing
  function getSect(planets) {
    if (!planets || !planets.Sun || !planets.Ascendant) return null;

    var sunLon = planets.Sun.totalDeg;
    var ascLon = planets.Ascendant.totalDeg;
    var diff = ((sunLon - ascLon) % 360 + 360) % 360;
    var sunAboveHorizon = diff >= 180;

    if (sunAboveHorizon) {
      return {
        type: 'day',
        luminary: 'Sun',
        benefic: 'Jupiter',        // of-sect benefic — most reliably helpful
        malefic: 'Saturn',         // of-sect malefic — challenging but workable
        offSectBenefic: 'Venus',   // out-of-sect benefic — helpful but less reliable
        offSectMalefic: 'Mars',    // out-of-sect malefic — hardest planet for this chart
        sunDiff: diff              // exposed for debugging / verification
      };
    } else {
      return {
        type: 'night',
        luminary: 'Moon',
        benefic: 'Venus',
        malefic: 'Mars',
        offSectBenefic: 'Jupiter',
        offSectMalefic: 'Saturn',
        sunDiff: diff
      };
    }
  }

  // ─── Essential dignity ──────────────────────────────────────
  // "Essential dignity" describes how comfortable a planet is in the
  // sign it occupies. A planet in its own sign (domicile) operates at
  // full strength. In its exaltation it's honored. In detriment or fall
  // it struggles. The classical scoring scheme (Lilly):
  //   domicile    +5   the planet rules this sign
  //   exaltation  +4   the planet is exalted here
  //   triplicity  +3   sect-dependent — see TRIPLICITY below
  //   detriment   -5   opposite of domicile
  //   fall        -4   opposite of exaltation
  //   peregrine    0   none of the above
  //
  // (We skip bounds and decans in this pass — they're traditionally
  // weighted lower and don't change a line's category by themselves.)
  //
  // DOMICILE: which sign each planet rules.
  var DOMICILE = {
    Sun:    ['Leo'],
    Moon:   ['Cancer'],
    Mercury:['Gemini','Virgo'],
    Venus:  ['Taurus','Libra'],
    Mars:   ['Aries','Scorpio'],
    Jupiter:['Sagittarius','Pisces'],
    Saturn: ['Capricorn','Aquarius']
  };

  // EXALTATION: the sign where a planet is honored/elevated.
  var EXALTATION = {
    Sun:'Aries', Moon:'Taurus', Mercury:'Virgo', Venus:'Pisces',
    Mars:'Capricorn', Jupiter:'Cancer', Saturn:'Libra'
  };

  // DETRIMENT: opposite of domicile — planet is out of place.
  var DETRIMENT = {
    Sun:    ['Aquarius'],
    Moon:   ['Capricorn'],
    Mercury:['Sagittarius','Pisces'],
    Venus:  ['Aries','Scorpio'],
    Mars:   ['Taurus','Libra'],
    Jupiter:['Gemini','Virgo'],
    Saturn: ['Cancer','Leo']
  };

  // FALL: opposite of exaltation — planet is weakened.
  var FALL = {
    Sun:'Libra', Moon:'Scorpio', Mercury:'Pisces', Venus:'Virgo',
    Mars:'Cancer', Jupiter:'Capricorn', Saturn:'Aries'
  };

  // TRIPLICITY: Dorothean scheme. Each of the four elemental triplicities
  // (fire/earth/air/water) has a day ruler and a night ruler. The triplicity
  // ruler for the chart's sect gets +3.
  var TRIPLICITY = {
    fire:  { signs:['Aries','Leo','Sagittarius'],     day:'Sun',     night:'Jupiter' },
    earth: { signs:['Taurus','Virgo','Capricorn'],    day:'Venus',   night:'Moon' },
    air:   { signs:['Gemini','Libra','Aquarius'],     day:'Saturn',  night:'Mercury' },
    water: { signs:['Cancer','Scorpio','Pisces'],     day:'Venus',   night:'Mars' }
  };

  // getEssentialDignity returns the planet's dignity status in its sign.
  // Input:  planetName — string, e.g. 'Mars'
  //         planets    — full planets object
  //         sect       — output of getSect() (only needed for triplicity)
  // Output: { status: 'domicile'|'exaltation'|'triplicity'|'peregrine'|'detriment'|'fall',
  //           score: number,
  //           label: string }  // short human-readable phrase
  //         or null if planet not found / not a traditional planet
  function getEssentialDignity(planetName, planets, sect) {
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    if (!planets || !planets[planetName]) return null;
    var sign = planets[planetName].sign;
    if (!sign) return null;

    if (DOMICILE[planetName].indexOf(sign) !== -1) {
      return { status:'domicile', score:5, label:'in own sign ('+sign+')' };
    }
    if (EXALTATION[planetName] === sign) {
      return { status:'exaltation', score:4, label:'exalted in '+sign };
    }
    // triplicity check — needs sect
    if (sect) {
      for (var element in TRIPLICITY) {
        var t = TRIPLICITY[element];
        if (t.signs.indexOf(sign) !== -1) {
          var ruler = (sect.type === 'day') ? t.day : t.night;
          if (ruler === planetName) {
            return { status:'triplicity', score:3, label:'in own triplicity ('+sign+')' };
          }
          break;
        }
      }
    }
    if (DETRIMENT[planetName].indexOf(sign) !== -1) {
      return { status:'detriment', score:-5, label:'in detriment ('+sign+')' };
    }
    if (FALL[planetName] === sign) {
      return { status:'fall', score:-4, label:'in fall ('+sign+')' };
    }
    return { status:'peregrine', score:0, label:'peregrine in '+sign };
  }

  // ─── Whole-sign houses ──────────────────────────────────────
  // Hellenistic astrology uses whole-sign houses: the sign rising on the
  // eastern horizon IS the entire first house, the next sign IS the
  // entire second house, and so on. This is different from the Placidus
  // system used elsewhere on the site (reading.html), but it's the
  // correct system for traditional dignity and rulership work.
  //
  // getWholeSignHouse returns which house (1–12) the planet occupies.
  function getWholeSignHouse(planetName, planets) {
    if (!planets || !planets[planetName] || !planets.Ascendant) return null;
    var planetSignIdx = SIGNS.indexOf(planets[planetName].sign);
    var ascSignIdx    = SIGNS.indexOf(planets.Ascendant.sign);
    if (planetSignIdx === -1 || ascSignIdx === -1) return null;
    // (planetSign - ascSign + 12) mod 12 gives 0-based offset;
    // +1 makes it 1-based (house 1 = ASC sign).
    return ((planetSignIdx - ascSignIdx + 12) % 12) + 1;
  }

  // ─── Accidental dignity (angularity) ────────────────────────
  // Where a planet sits by house affects how strongly it expresses.
  // Angular houses (1, 4, 7, 10) — most active and visible.
  // Succedent houses (2, 5, 8, 11) — moderately active, supporting.
  // Cadent houses (3, 6, 9, 12) — weaker, more internal.
  //
  // Traditional astrology also flags the 6th and 12th specifically as
  // "averse" or "joy-less" houses where planets struggle more.
  function getAngularity(planetName, planets) {
    var house = getWholeSignHouse(planetName, planets);
    if (!house) return null;
    var angular   = [1,4,7,10];
    var succedent = [2,5,8,11];
    if (angular.indexOf(house) !== -1) {
      return { house:house, type:'angular', score:4, label:'strong in '+ordinal(house)+' house' };
    }
    if (succedent.indexOf(house) !== -1) {
      return { house:house, type:'succedent', score:1, label:'in '+ordinal(house)+' house' };
    }
    // cadent — 6th and 12th especially weak ("averse" houses)
    if (house === 6 || house === 12) {
      return { house:house, type:'cadent', score:-2, label:'weakened in '+ordinal(house)+' house' };
    }
    return { house:house, type:'cadent', score:-1, label:'in '+ordinal(house)+' house' };
  }

  // Helper to write "1st", "2nd", "3rd", "4th" etc.
  function ordinal(n) {
    var s = ['th','st','nd','rd'];
    var v = n % 100;
    var suffix = (v >= 11 && v <= 13) ? 'th' : (s[n % 10] || 'th');
    return n + suffix;
  }

  // ─── House rulership ────────────────────────────────────────
  // Each traditional planet rules one or two signs. Those signs occupy
  // particular houses in this chart (under whole-sign), and that's how
  // we know which life themes a planet's lines activate. Mercury rules
  // Gemini & Virgo — if Gemini is the 2nd house and Virgo is the 11th
  // for this chart, then Mercury lines activate 2nd-house themes
  // (money, values) AND 11th-house themes (friends, networks).
  //
  // HOUSE_THEMES is a short list of keywords per house. The copy layer
  // (separate file) uses these to write the descriptive paragraphs.
  var HOUSE_THEMES = {
    1:  'self, identity, appearance, how people see you',
    2:  'money, possessions, personal values, self-worth',
    3:  'siblings, neighbors, short trips, daily communication',
    4:  'home, family, ancestry, roots, private life',
    5:  'romance, creativity, children, play, self-expression',
    6:  'work routines, health, daily habits, service',
    7:  'partnerships, marriage, open enemies, contracts',
    8:  'shared resources, intimacy, inheritance, transformation, the occult',
    9:  'travel, higher learning, philosophy, religion, foreign cultures',
    10: 'career, reputation, public standing, authority',
    11: 'friends, groups, networks, hopes and wishes',
    12: 'solitude, spirituality, hidden things, self-undoing'
  };

  // getRulerships returns the houses that planet rules in this chart.
  // Output: { houses: [2, 11], themes: ['money, ...', 'friends, ...'] }
  function getRulerships(planetName, planets) {
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    if (!planets || !planets.Ascendant) return null;
    var ascSignIdx = SIGNS.indexOf(planets.Ascendant.sign);
    if (ascSignIdx === -1) return null;

    var ruledSigns = DOMICILE[planetName] || [];
    var houses = [];
    var themes = [];
    ruledSigns.forEach(function (sign) {
      var signIdx = SIGNS.indexOf(sign);
      if (signIdx === -1) return;
      var house = ((signIdx - ascSignIdx + 12) % 12) + 1;
      houses.push(house);
      themes.push(HOUSE_THEMES[house]);
    });
    return { houses: houses, themes: themes };
  }

  // ─── Combustion ─────────────────────────────────────────────
  // When a planet sits too close to the Sun, traditional astrology says
  // its light is overwhelmed and its function impaired.
  //   cazimi      within 17' (0.283°) of Sun — exceptionally empowered
  //   combust     within 8°30'           — severely weakened
  //   under beams within 15°             — diminished, less reliable
  //
  // Sun itself and non-planets don't get combustion checks.
  function getCombustion(planetName, planets) {
    if (planetName === 'Sun') return null;
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    if (!planets || !planets[planetName] || !planets.Sun) return null;

    var diff = Math.abs(planets[planetName].totalDeg - planets.Sun.totalDeg);
    if (diff > 180) diff = 360 - diff;

    if (diff <= 0.2833) {  // 17 arc-minutes
      return { status:'cazimi', score:6, label:'cazimi (heart of the Sun)' };
    }
    if (diff <= 8.5) {
      return { status:'combust', score:-4, label:'combust' };
    }
    if (diff <= 15) {
      return { status:'under_beams', score:-2, label:'under the beams' };
    }
    return { status:'free', score:0, label:null };
  }

  // ─── Sect status (per-planet) ───────────────────────────────
  // Given the chart's sect, what role does this planet play?
  function getSectStatus(planetName, sect) {
    if (!sect) return null;
    var label = sect.type === 'day' ? 'day chart' : 'night chart';
    if (planetName === sect.benefic) {
      return { role:'sect_benefic',     score:3,  label:'sect benefic ('+label+')' };
    }
    if (planetName === sect.offSectBenefic) {
      return { role:'off_sect_benefic', score:1,  label:'out-of-sect benefic ('+label+')' };
    }
    if (planetName === sect.malefic) {
      return { role:'sect_malefic',     score:-2, label:'of-sect malefic ('+label+')' };
    }
    if (planetName === sect.offSectMalefic) {
      return { role:'off_sect_malefic', score:-4, label:'out-of-sect malefic ('+label+')' };
    }
    if (planetName === sect.luminary) {
      return { role:'luminary',         score:2,  label:'luminary of the sect' };
    }
    // Sun on night charts / Moon on day charts — out of sect luminary
    if (planetName === 'Sun' || planetName === 'Moon') {
      return { role:'off_sect_luminary', score:0, label:'out-of-sect luminary' };
    }
    return null;
  }

  // ─── Whole-planet condition ─────────────────────────────────
  // For one planet, pull together every condition factor we measure.
  function analyzePlanet(planetName, planets, sect) {
    if (TRADITIONAL.indexOf(planetName) === -1) return null;
    var dignity    = getEssentialDignity(planetName, planets, sect);
    var angularity = getAngularity(planetName, planets);
    var combustion = getCombustion(planetName, planets);
    var rulerships = getRulerships(planetName, planets);
    var sectStatus = getSectStatus(planetName, sect);

    // Total score = sum of all factor scores. We'll use this to bin
    // into harmonious/dynamic/challenging in categorizeLine().
    var score = 0;
    if (dignity)    score += dignity.score;
    if (angularity) score += angularity.score;
    if (combustion) score += combustion.score;
    if (sectStatus) score += sectStatus.score;

    return {
      planet: planetName,
      sign: planets[planetName].sign,
      house: angularity ? angularity.house : null,
      sect: sectStatus,
      dignity: dignity,
      angularity: angularity,
      combustion: combustion,
      rulerships: rulerships,
      score: score
    };
  }

  // ─── Full chart analysis ────────────────────────────────────
  // Run analyzePlanet() for every traditional planet. Returns the full
  // condition picture — this is what the report builder consumes.
  function analyzeChart(planets) {
    var sect = getSect(planets);
    var result = { sect: sect, planets: {} };
    TRADITIONAL.forEach(function (p) {
      var analysis = analyzePlanet(p, planets, sect);
      if (analysis) result.planets[p] = analysis;
    });
    return result;
  }

  // ─── Line categorization ────────────────────────────────────
  // Given a planet's full analysis, decide whether its lines should be
  // filed as harmonious, dynamic, or challenging, AND produce the
  // one-line summary that explains why (in Neutrino's style:
  // "Sect benefic, strong in 4th house, but in detriment").
  //
  // Approach: score-it-up. Sum the contributing factors, then apply
  // bin thresholds. The summary lists the most important supporting
  // factors first, then a "but ..." with the most important opposing
  // factors. We don't list every factor — just the ones that meaningfully
  // shaped the verdict, in the same hand-curated style Neutrino uses.
  //
  // (Aspects are not yet included — Phase 3 will fold them in.)
  function categorizeLine(planetName, analysis) {
    if (!analysis || !analysis.planets || !analysis.planets[planetName]) return null;
    var a = analysis.planets[planetName];

    // Collect supporting (positive) and opposing (negative) factors.
    var positives = [];
    var negatives = [];
    function push(item) {
      if (!item || !item.label) return;
      if (item.score > 0) positives.push({ label:item.label, score:item.score });
      else if (item.score < 0) negatives.push({ label:item.label, score:item.score });
    }
    push(a.sect);
    push(a.dignity);
    push(a.angularity);
    push(a.combustion);

    // Sort by absolute weight so we lead with the biggest factors.
    positives.sort(function (x, y) { return y.score - x.score; });
    negatives.sort(function (x, y) { return x.score - y.score; });

    // Build the summary line, Neutrino-style.
    var pLabels = positives.map(function (p) { return p.label; });
    var nLabels = negatives.map(function (n) { return n.label; });
    var summary;
    if (pLabels.length && nLabels.length) {
      summary = capitalize(pLabels.join(', ')) + ', but ' + nLabels.join(', ');
    } else if (pLabels.length) {
      summary = capitalize(pLabels.join(', '));
    } else if (nLabels.length) {
      summary = capitalize(nLabels.join(', '));
    } else {
      summary = 'No strong condition factors';
    }

    // Categorize by total score. Thresholds chosen so that:
    //  - clearly positive (sect benefic + good dignity + angular) → harmonious
    //  - clearly negative (out-of-sect malefic + detriment + combust) → challenging
    //  - mixed signals → dynamic
    // Tunable as we test on real charts.
    var category;
    if (a.score >= 5)       category = 'harmonious';
    else if (a.score <= -3) category = 'challenging';
    else                    category = 'dynamic';

    // Cazimi is an override — even with other negatives, cazimi makes
    // a planet exceptionally empowered.
    if (a.combustion && a.combustion.status === 'cazimi') {
      category = 'harmonious';
    }

    return {
      planet: planetName,
      category: category,
      score: a.score,
      summary: summary,
      rulerships: a.rulerships,    // { houses, themes } — for the paragraph copy
      sign: a.sign,
      house: a.house
    };
  }

  function capitalize(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ─── Convenience: categorize every traditional planet at once ───
  // Returns an object grouped by category, the shape the report wants.
  function categorizeAllLines(planets) {
    var analysis = analyzeChart(planets);
    var out = { harmonious: [], dynamic: [], challenging: [], sect: analysis.sect };
    TRADITIONAL.forEach(function (p) {
      var c = categorizeLine(p, analysis);
      if (c) out[c.category].push(c);
    });
    // Sort each bucket by score (best-first for harmonious, worst-first for challenging).
    out.harmonious.sort(function (x, y) { return y.score - x.score; });
    out.challenging.sort(function (x, y) { return x.score - y.score; });
    out.dynamic.sort(function (x, y) { return y.score - x.score; });
    return out;
  }

  // ─── Public API ─────────────────────────────────────────────
  global.elsewhereEngine = global.elsewhereEngine || {};
  global.elsewhereEngine.getSect             = getSect;
  global.elsewhereEngine.getEssentialDignity = getEssentialDignity;
  global.elsewhereEngine.getWholeSignHouse   = getWholeSignHouse;
  global.elsewhereEngine.getAngularity       = getAngularity;
  global.elsewhereEngine.getCombustion       = getCombustion;
  global.elsewhereEngine.getRulerships       = getRulerships;
  global.elsewhereEngine.getSectStatus       = getSectStatus;
  global.elsewhereEngine.analyzePlanet       = analyzePlanet;
  global.elsewhereEngine.analyzeChart        = analyzeChart;
  global.elsewhereEngine.categorizeLine      = categorizeLine;
  global.elsewhereEngine.categorizeAllLines  = categorizeAllLines;

})(typeof window !== 'undefined' ? window : globalThis);
