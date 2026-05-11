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
//   <script src="/js/engine.js?v=1"></script>
//
// Phase 1 (current): sect determination.
// Future phases will add: essential dignity, accidental dignity,
// combustion, house rulership, and aspect synthesis.

(function (global) {
  'use strict';

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

  // ─── Public API ─────────────────────────────────────────────
  global.elsewhereEngine = global.elsewhereEngine || {};
  global.elsewhereEngine.getSect = getSect;

})(typeof window !== 'undefined' ? window : globalThis);
