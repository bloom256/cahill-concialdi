// ==================================================================
// NODE ENVIRONMENT SETUP
// ------------------------------------------------------------------

// cahill-conformal.mjs uses Complex.js as a global (index.html loads it with a
// script tag), so expose the npm package the same way before any projection.

import Complex from 'complex.js';

globalThis.Complex = Complex;
