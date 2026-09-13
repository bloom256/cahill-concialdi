// ==================================================================
// STYLE: SEAV-ORIGINAL
// ------------------------------------------------------------------

// Exact reproduction of the upstream web app's vector map (index.html and
// map-vector.mjs): same 50m data, same colors, same line widths in map units.
// Checked against the web app by `npm run parity`. Do not change its look;
// derive new variants instead.

export default {
  name       : 'seav-original',
  description: 'Upstream web app vector map, unchanged',

  view: { tiltDeg: -5.4, frame: 'original' },

  page: { mapWidthMm: 1500, color: '#000' },

  ocean: { show: true, fill: '#123' },

  graticule: { show: true, intervalDeg: 10, stroke: '#246', width: '0.15u' },

  circles: { show: true, stroke: '#357', width: '0.3u', dash: ['1u', '1u'] },

  land: { show: true, data: 'ne-country-areas.json', mode: 'position', sealWidth: '0.01u' },

  admin0: {
    show        : true,
    data        : 'ne-boundaries.json',
    stroke      : '#234',
    width       : '0.1u',
    disputedDash: ['0.5u', '0.2u'],
  },
};
