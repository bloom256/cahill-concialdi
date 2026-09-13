// ==================================================================
// RASTER MAP GEOMETRY (DOM-FREE)
// ------------------------------------------------------------------

// The faux inverse projection used to draw raster layers: the map is divided
// into 1x1 deg cells, and each cell is treated as a linear quadrilateral in
// output pixel space. Shared by the web app (map-raster.mjs) and the Node
// print renderer (print/), so both sample source imagery identically.

import { TWO_PI, DEGS_IN_CIRCLE } from './globals.mjs';
import { LatLon } from './data-types.mjs';
import { MAP_AREAS, project } from './concialdi.mjs';

// ------------------------------------------------------------------

// Class to represent a 1x1 deg cell of the raster map
export class MapCell {

  constructor(swLatLon, cellCorners, maskCorners) {

    // Original LatLon of the cell's SW corner in degrees
    this.swLatLon = swLatLon;

    // Array of projected coordinates (as Point objects) of the cell corners
    // starting from the SW corner going counterclockwise
    this.cellCorners = cellCorners;

    // Same as above but for the cell mask to account for the half-cells along
    // the Bering Strait cut: we only draw pixels within the mask
    this.maskCorners = maskCorners;

    const isNorthPolar = cellCorners[2].isEqualTo(cellCorners[3]);
    const isSouthPolar = cellCorners[0].isEqualTo(cellCorners[1]);

    // Indicates if this cell is adjacent to the N/S pole
    this.isPolar = isNorthPolar || isSouthPolar;

    // If isPolar, indicates if this cell is adjacent to the N pole
    this.isNorthPolar = isNorthPolar;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns true if the given point lies inside the cell mask.
  // This is implemented as a simplified point-in-polygon algorithm.
  isInMask(point) {
    let numIntersections = 0;
    for (let idx = 0; idx < this.maskCorners.length; idx++) {
      const edgePointA = this.maskCorners[idx];
      const edgePointB = this.maskCorners[(idx + 1) % this.maskCorners.length];
      if (
        point.x >= Math.min(edgePointA.x, edgePointB.x) &&
        point.x <  Math.max(edgePointA.x, edgePointB.x)
      ) {
        if (
          point.y >= Math.max(edgePointA.y, edgePointB.y) ||
          point.y >= Math.min(edgePointA.y, edgePointB.y) &&
          point.y >= edgePointA.y + (point.x - edgePointA.x) / (edgePointB.x - edgePointA.x) * (edgePointB.y - edgePointA.y)
        ) numIntersections++;
      }
    }
    return numIntersections % 2 === 1;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns the spherical coordinates in degrees as a LatLon object
  // of a given "projected" point inside this cell if cell is not polar
  getInverseLatLon(point) {

    // Given 1x1 deg cell with corners in projected map coordinates:
    //   - SW corner = (A, B) = this.cellCorners[0]
    //   - SE corner = (C, D) = this.cellCorners[1]
    //   - NW corner = (E, F) = this.cellCorners[3]
    //   - NE corner = (G, H) = this.cellCorners[2]

    const corners = this.cellCorners;

    // Set of equations determining the "projected" coordinates (x', y')
    // of an input relative coordinates in degrees (x, y) into a cell,
    // where (x0, y0) and (x1, y1) are intermediate coordinates:
    //   1. x0 = A + (C - A)x
    //      y0 = B + (D - B)x
    //      x1 = E + (G - E)x
    //      y1 = F + (H - F)x
    //   2. x' = x0 + (x1 - x0)y
    //      y' = y0 + (y1 - y0)y
    //
    // Equations above combined into a system of 2 equations with unknowns x, y:
    //   x' - A = (C - A)x + (E - A)y + (A + G - C - E)xy
    //   y' - B = (D - B)x + (F - B)y + (B + H - D - F)xy
    //
    // Helper coefficients for the system of equations:
    //   J = x' - A
    //   K = y' - B
    //   L = C - A
    //   M = D - B
    //   N = E - A
    //   P = F - B
    //   Q = A + G - C - E
    //   R = B + H - D - F

    const J = point.x - corners[0].x;
    const K = point.y - corners[0].y;
    const L = corners[1].x - corners[0].x;
    const M = corners[1].y - corners[0].y;
    const N = corners[3].x - corners[0].x;
    const P = corners[3].y - corners[0].y;
    const Q = corners[0].x + corners[2].x - corners[1].x - corners[3].x;
    const R = corners[0].y + corners[2].y - corners[1].y - corners[3].y;

    // Same system of equations above but using helper coefficients:
    //   J = Lx + Ny + Qxy
    //   K = Mx + Py + Rxy
    //
    // Combined equation in terms of y:
    //   y = (J - Lx)/(N + Qx) = (K - Mx)/(P + Rx)
    //
    // Quadratic equation with variable x:
    //   (-LR + QM)x^2 + (JR + NM - LP - QK)x + (JP - NK) = 0

    // Quadratic equation coefficients:
    const a =           - L*R + Q*M;
    const b = J*R + N*M - L*P - Q*K;
    const c = J*P - N*K;

    // Determine 2 solutions to the quadratic equation
    const discriminantRoot = Math.sqrt(b*b - 4*a*c);
    const x1 = (-b + discriminantRoot) / (2*a);
    const x2 = (-b - discriminantRoot) / (2*a);
    const y1 = (J - L * x1) / (N + Q * x1);
    const y2 = (J - L * x2) / (N + Q * x2);

    // Return one of the solutions added to the SW corner coordinates
    const latLon = (0 <= x1 && x1 <= 1 && 0 <= y1 && y1 <= 1)
      ? new LatLon(y1, x1)
      : new LatLon(y2, x2);
    latLon.lat += this.swLatLon.lat;
    latLon.lon += this.swLatLon.lon;
    return latLon;
  }

  // - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

  // Returns the spherical coordinates in degrees as a LatLon object
  // of a given "projected" point inside this cell if cell is polar.
  // The algorithm is basic triangular math assuming that the cell is
  // shaped like an isosceles triangle with the vertex point at the pole.
  getPolarInverseLatLon(point) {

    const corners = this.cellCorners;

    // Compute relative latitude as a function of the ratio of the point's
    // distance to the pole
    const cellHeight = corners[2].getDistanceTo(corners[1]);
    const relLat = this.isNorthPolar
      ? 1 - corners[2].getDistanceTo(point) / cellHeight
      :     corners[1].getDistanceTo(point) / cellHeight;

    // Compute relative longitude as a function of the angle of the point
    // with respect to the pole in relation the the vertex angle
    let cellWidth = this.isNorthPolar
      ? corners[2].getAngleTo(corners[0]) - corners[2].getAngleTo(corners[1])
      : corners[1].getAngleTo(corners[2]) - corners[1].getAngleTo(corners[3]);
    if (cellWidth < 0) cellWidth += TWO_PI;
    let relLon = this.isNorthPolar
        ? +(corners[2].getAngleTo(corners[0]) - corners[2].getAngleTo(point))
        : -(corners[1].getAngleTo(corners[3]) - corners[1].getAngleTo(point));
    if (relLon < 0) relLon += TWO_PI;
    relLon /= cellWidth;

    return new LatLon(this.swLatLon.lat + relLat, this.swLatLon.lon + relLon);
  }
}

// ------------------------------------------------------------------

// Calls callback(cell) for every 1x1 deg MapCell of every map area, in drawing
// order. toPixel(point) converts an untilted map Point (which it may mutate)
// to output pixel coordinates.
export function forEachMapCell(toPixel, callback) {
  MAP_AREAS.forEach((area, idx) => {
    for (let lat = area.swCorner.lat; lat < area.neCorner.lat; lat++) {

      // Account for the antimeridian and the Bering Strait half-cells
      const antiMeridianAdjust = area.hasAntimeridian ? DEGS_IN_CIRCLE : 0;
      const startLon = Math.floor(area.swCorner.lon);
      const endLon   = Math.ceil (area.neCorner.lon) + antiMeridianAdjust;

      for (let lon = startLon; lon < endLon; lon++) {

        const maskedLonW = Math.max(lon    , area.swCorner.lon);
        const maskedLonE = Math.min(lon + 1, area.neCorner.lon + antiMeridianAdjust);

        const cornerPositions =
          // Raw 2D list of spherical coordinates of the corners
          // starting from the SW corner going counterclockwise
          [
            // Cell corners
            [lat    , lon    ],
            [lat    , lon + 1],
            [lat + 1, lon + 1],
            [lat + 1, lon    ],
            // Cell mask corners
            [lat    , maskedLonW],
            [lat    , maskedLonE],
            [lat + 1, maskedLonE],
            [lat + 1, maskedLonW],
          ]
          .map(coords => new LatLon(...coords))
          .map(latLon => toPixel(project(latLon, idx)));

        callback(new MapCell(
          new LatLon(lat, lon),
          cornerPositions.slice(0, 4),
          cornerPositions.slice(4, 8),
        ));
      }
    }
  });
}
