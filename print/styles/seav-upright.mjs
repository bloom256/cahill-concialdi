// ==================================================================
// STYLE: SEAV-UPRIGHT
// ------------------------------------------------------------------

// The original look without Concialdi's -5.4 deg tilt: the map stands upright
// and the North Pole sits on the page's vertical center line.
// Changes vs. seav-original: orientation and framing only.

export default {
  extends    : ['seav-original'],
  name       : 'seav-upright',
  description: 'Original look, untilted, North Pole centered horizontally',

  view: { tiltDeg: 0, frame: 'pole-centered', paddingUnits: 1 },
};
