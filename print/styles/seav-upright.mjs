// ==================================================================
// STYLE: SEAV-UPRIGHT
// ------------------------------------------------------------------

// The original look without Concialdi's -5.4 deg tilt: the map stands upright
// and the North Pole sits on the page's vertical center line. Uses the shared
// print grid: thin line weights for a 150 cm print and grid labels.
// Changes vs. seav-original: orientation, framing, and the print grid.
// Every later variant builds on this style.

export default {
  extends    : ['seav-original', 'preset-print-grid'],
  name       : 'seav-upright',
  description: 'Original look, untilted, North Pole centered horizontally, print grid',

  view: { tiltDeg: 0, frame: 'pole-centered', paddingUnits: 1 },
};
