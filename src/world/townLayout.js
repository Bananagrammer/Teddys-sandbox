// Deterministic town plan. No Math.random — every lot comes from the street grid.

export const STREET_HALF = 4;
export const PLAZA_HALF = 14;
export const STREET_CENTERS = [-100, -50, 0, 50, 100];
export const GROUND_SIZE = 340;
export const GROUND_HALF = GROUND_SIZE / 2;
export const ROAD_LIMIT = 158;

// Well cylinder matches Town._well (diameter 2.1). Spawn is south of it, on the plaza.
export const WELL = { x: 0, z: 0 };
export const WELL_RADIUS = 1.05;
export const SPAWN = { x: 0, z: -6.5 };

// Four corners of the square, inset so they read as plaza lamps and stay off the streets.
export const LAMPS = [
  [11, 11],
  [-11, 11],
  [11, -11],
  [-11, -11],
];

const WALLS = [
  [0.93, 0.86, 0.68],
  [0.7, 0.8, 0.84],
  [0.86, 0.72, 0.4],
  [0.84, 0.5, 0.4],
  [0.9, 0.9, 0.86],
  [0.58, 0.66, 0.48],
  [0.75, 0.62, 0.5],
  [0.8, 0.76, 0.68],
  [0.66, 0.58, 0.5],
  [0.78, 0.74, 0.64],
];

const ROOFS = [
  [0.62, 0.24, 0.16],
  [0.32, 0.28, 0.3],
  [0.42, 0.22, 0.14],
  [0.55, 0.2, 0.14],
  [0.28, 0.3, 0.34],
  [0.36, 0.2, 0.12],
  [0.45, 0.18, 0.14],
  [0.34, 0.26, 0.24],
];

const HEIGHTS = [4.4, 5.1, 4.8, 6.2, 5.5, 4.6, 6.8, 5.8, 4.3, 7.1];
const WIDTHS = [8.2, 7.2, 9.0, 6.6, 8.6, 7.6, 9.4, 6.8];
const DEPTHS = [7.4, 8.0, 6.6, 8.4, 7.0, 7.8, 6.8, 8.6];

function floor1(n) {
  return Math.floor(n * 10 + 1e-6) / 10;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function gaps() {
  const limit = GROUND_HALF - 4;
  const edges = [-limit, ...STREET_CENTERS, limit];
  const out = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const a = edges[i] + (i === 0 ? 10 : STREET_HALF + 2);
    const b = edges[i + 1] - (i + 1 === edges.length - 1 ? 10 : STREET_HALF + 2);
    if (b - a >= 7.2) out.push([a, b]);
  }
  return out;
}

function subtractPlaza(x0, x1, z0, z1) {
  const ix0 = Math.max(x0, -PLAZA_HALF);
  const ix1 = Math.min(x1, PLAZA_HALF);
  const iz0 = Math.max(z0, -PLAZA_HALF);
  const iz1 = Math.min(z1, PLAZA_HALF);
  if (ix1 <= ix0 || iz1 <= iz0) return [[x0, x1, z0, z1]];

  const rects = [];
  if (x0 < ix0 - 0.5) rects.push([x0, ix0, z0, z1]);
  if (ix1 + 0.5 < x1) rects.push([ix1, x1, z0, z1]);
  if (z0 < iz0 - 0.5) rects.push([ix0, ix1, z0, iz0]);
  if (iz1 + 0.5 < z1) rects.push([ix0, ix1, iz1, z1]);
  return rects;
}

function slotPlan(sx, sz) {
  if (sx < 7.2 || sz < 7.2) return [0, 0];
  const shortSide = Math.min(sx, sz);
  const longSide = Math.max(sx, sz);
  const splitLong = (shortSide < 16 && longSide >= 24) || (sx >= 46 && sz >= 46);
  if (!splitLong) return [1, 1];
  return sx >= sz ? [2, 1] : [1, 2];
}

function splitAxis(a, b, count) {
  if (count <= 1) return [[a, b]];
  const mid = (a + b) / 2;
  return [
    [a, mid - 1.8],
    [mid + 1.8, b],
  ];
}

function nearestDoor(x, z) {
  let best = Infinity;
  let door = "south";
  for (const s of STREET_CENTERS) {
    const dist = Math.abs(x - s);
    if (dist < best) {
      best = dist;
      door = x >= s ? "west" : "east";
    }
  }
  for (const s of STREET_CENTERS) {
    const dist = Math.abs(z - s);
    if (dist < best) {
      best = dist;
      door = z >= s ? "south" : "north";
    }
  }
  return door;
}

function buildingLots() {
  const lots = [];
  for (const [x0, x1] of gaps()) {
    for (const [z0, z1] of gaps()) {
      for (const rect of subtractPlaza(x0, x1, z0, z1)) {
        const [rx0, rx1, rz0, rz1] = rect;
        const [cols, rows] = slotPlan(rx1 - rx0, rz1 - rz0);
        if (cols === 0) continue;
        for (const [sx0, sx1] of splitAxis(rx0, rx1, cols)) {
          for (const [sz0, sz1] of splitAxis(rz0, rz1, rows)) {
            lots.push([sx0, sx1, sz0, sz1]);
          }
        }
      }
    }
  }
  return lots;
}

function fit(lot, n) {
  const [x0, x1, z0, z1] = lot;
  const sx = x1 - x0;
  const sz = z1 - z0;
  const w = floor1(Math.min(WIDTHS[n % WIDTHS.length], sx - 1.2));
  const d = floor1(Math.min(DEPTHS[n % DEPTHS.length], sz - 1.2));
  if (w < 6 || d < 6) return null;
  return {
    x: round1((x0 + x1) / 2),
    z: round1((z0 + z1) / 2),
    w,
    d,
    h: HEIGHTS[n % HEIGHTS.length],
    wall: WALLS[n % WALLS.length],
    roof: ROOFS[(n * 3) % ROOFS.length],
    door: "south",
  };
}

function decorate(buildings) {
  let chapel = null;
  let chapelScore = Infinity;
  buildings.forEach((b, i) => {
    b.name = `house${i}`;
    b.door = nearestDoor(b.x, b.z);
    if (b.z > PLAZA_HALF && b.z < 48) {
      const score = Math.abs(b.x) * 2 + b.z;
      if (score < chapelScore) {
        chapelScore = score;
        chapel = b;
      }
    }
  });
  if (chapel) {
    chapel.name = "chapel";
    chapel.steeple = true;
    chapel.h = 7.6;
    chapel.wall = [0.9, 0.9, 0.86];
    chapel.roof = [0.28, 0.3, 0.34];
  }

  const shops = buildings
    .filter((b) => b !== chapel)
    .map((b) => ({ b, dist: Math.hypot(b.x, b.z) }))
    .sort((a, c) => a.dist - c.dist || a.b.x - c.b.x)
    .slice(0, 3);
  shops.forEach((shop, i) => {
    shop.b.name = `shop${i}`;
    shop.b.awning = true;
  });
}

function layoutBuildings() {
  const buildings = [];
  buildingLots().forEach((lot, n) => {
    const building = fit(lot, n);
    if (building) buildings.push(building);
  });
  decorate(buildings);
  return buildings;
}

function pointBlocked(x, z, buildings, trees) {
  if (Math.abs(x) > GROUND_HALF - 6 || Math.abs(z) > GROUND_HALF - 6) return true;
  if (Math.abs(x) < PLAZA_HALF + 1.5 && Math.abs(z) < PLAZA_HALF + 1.5) return true;
  for (const s of STREET_CENTERS) {
    const onNS = Math.abs(x - s) < STREET_HALF + 1.7 && Math.abs(z) < ROAD_LIMIT + 2;
    const onEW = Math.abs(z - s) < STREET_HALF + 1.7 && Math.abs(x) < ROAD_LIMIT + 2;
    if (onNS || onEW) return true;
  }
  for (const b of buildings) {
    if (Math.abs(x - b.x) < b.w / 2 + 1.6 && Math.abs(z - b.z) < b.d / 2 + 1.6) return true;
  }
  for (const [tx, tz] of trees) {
    if ((x - tx) ** 2 + (z - tz) ** 2 < 4.2 ** 2) return true;
  }
  for (const [lx, lz] of LAMPS) {
    if ((x - lx) ** 2 + (z - lz) ** 2 < 3 ** 2) return true;
  }
  return false;
}

function layoutTrees(buildings) {
  const trees = [];
  const consider = (x, z) => {
    const px = round1(x);
    const pz = round1(z);
    if (pointBlocked(px, pz, buildings, trees)) return;
    trees.push([px, pz]);
  };

  buildings.forEach((b, i) => {
    if (i % 2 !== 0) return;
    const side = i % 4;
    const ox = (side === 0 || side === 1) ? b.w / 2 + 2.4 : -(b.w / 2 + 2.4);
    const oz = (side === 0 || side === 2) ? b.d / 2 + 2.3 : -(b.d / 2 + 2.3);
    consider(b.x + ox, b.z + oz * 0.35);
    consider(b.x + ox * 0.25, b.z + oz);
  });

  for (let i = -6; i <= 6; i += 1) {
    const along = i * 24;
    consider(-152, along);
    consider(152, along);
    consider(along, -152);
    consider(along, 152);
  }

  // A few trees just outside the square, off the street mouths.
  consider(20, 20);
  consider(-20, 20);
  consider(20, -20);
  consider(-20, -20);
  return trees;
}

function separatedGap(dx, dz) {
  if (dx >= 0 && dz >= 0) return Math.hypot(dx, dz);
  if (dx >= 0) return dx;
  if (dz >= 0) return dz;
  return Math.max(dx, dz);
}

function gapToStreets(x, z, w, d) {
  let min = Infinity;
  for (const s of STREET_CENTERS) {
    const dx = Math.abs(x - s) - w / 2 - STREET_HALF;
    const dz = Math.abs(z - s) - d / 2 - STREET_HALF;
    min = Math.min(min, dx, dz);
  }
  return min;
}

function gapToPlaza(b) {
  const dx = Math.abs(b.x) - b.w / 2 - PLAZA_HALF;
  const dz = Math.abs(b.z) - b.d / 2 - PLAZA_HALF;
  return separatedGap(dx, dz);
}

function gapBetween(a, b) {
  const dx = Math.abs(a.x - b.x) - (a.w + b.w) / 2;
  const dz = Math.abs(a.z - b.z) - (a.d + b.d) / 2;
  return separatedGap(dx, dz);
}

export function validateLayout(buildings = BUILDINGS, trees = TREES) {
  const problems = [];
  if (WELL.x !== 0 || WELL.z !== 0) problems.push("well is not at the origin");
  if (!(SPAWN.z < WELL.z)) problems.push("spawn is not south of the well");
  const spawnDist = Math.hypot(SPAWN.x - WELL.x, SPAWN.z - WELL.z);
  if (spawnDist < WELL_RADIUS + 2) problems.push(`spawn is too close to the well (${spawnDist})`);
  if (Math.abs(SPAWN.x) > PLAZA_HALF - 1 || Math.abs(SPAWN.z) > PLAZA_HALF - 1) {
    problems.push("spawn is outside the plaza");
  }
  if (LAMPS.length !== 4) problems.push("expected four lamps");

  for (let i = 0; i < buildings.length; i += 1) {
    const b = buildings[i];
    if (Math.abs(b.x) + b.w / 2 > GROUND_HALF - 2 || Math.abs(b.z) + b.d / 2 > GROUND_HALF - 2) {
      problems.push(`${b.name} hangs off the ground`);
    }
    const streetGap = gapToStreets(b.x, b.z, b.w, b.d);
    if (streetGap < 1.15) problems.push(`${b.name} is within ${streetGap.toFixed(2)}m of a street`);
    const plazaGap = gapToPlaza(b);
    if (plazaGap < 0.45) problems.push(`${b.name} intrudes on the plaza by ${plazaGap.toFixed(2)}m`);
    for (let j = i + 1; j < buildings.length; j += 1) {
      const gap = gapBetween(b, buildings[j]);
      if (gap < 1.2) problems.push(`${b.name} overlaps ${buildings[j].name} (gap ${gap.toFixed(2)})`);
    }
  }

  for (const [x, z] of trees) {
    if (Math.abs(x) < PLAZA_HALF && Math.abs(z) < PLAZA_HALF) problems.push(`tree ${x},${z} is in the plaza`);
    const streetGap = gapToStreets(x, z, 0.4, 0.4);
    if (streetGap < 1.2) problems.push(`tree ${x},${z} is in a street`);
    for (const b of buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + 0.8 && Math.abs(z - b.z) < b.d / 2 + 0.8) {
        problems.push(`tree ${x},${z} is inside ${b.name}`);
      }
    }
  }

  if (problems.length) {
    throw new Error(`Town layout is not walkable:\n${problems.slice(0, 12).join("\n")}`);
  }
}

export function roadDecals() {
  const decals = [];
  for (const x of STREET_CENTERS) {
    if (x === 0) {
      const north = ROAD_LIMIT - PLAZA_HALF;
      decals.push({ name: "roadN", w: STREET_HALF * 2, d: north, x: 0, z: PLAZA_HALF + north / 2 });
      decals.push({ name: "roadS", w: STREET_HALF * 2, d: north, x: 0, z: -(PLAZA_HALF + north / 2) });
    } else {
      decals.push({
        name: `roadNS${x}`,
        w: STREET_HALF * 2,
        d: ROAD_LIMIT * 2,
        x,
        z: 0,
      });
    }
  }

  const cuts = [-ROAD_LIMIT];
  for (const s of STREET_CENTERS) cuts.push(s - STREET_HALF, s + STREET_HALF);
  cuts.push(ROAD_LIMIT);

  for (const z of STREET_CENTERS) {
    for (let i = 0; i < cuts.length; i += 2) {
      let a = cuts[i];
      let b = cuts[i + 1];
      if (z === 0) {
        if (b <= -PLAZA_HALF || a >= PLAZA_HALF) {
          // already outside the square
        } else if (a < -PLAZA_HALF && b > PLAZA_HALF) {
          continue;
        } else if (a < -PLAZA_HALF) {
          b = -PLAZA_HALF;
        } else if (b > PLAZA_HALF) {
          a = PLAZA_HALF;
        } else {
          continue;
        }
      }
      if (b - a < 1) continue;
      decals.push({
        name: `roadEW${z}_${i}`,
        w: round1(b - a),
        d: STREET_HALF * 2,
        x: round1((a + b) / 2),
        z,
      });
    }
  }
  return decals;
}

export const BUILDINGS = layoutBuildings();
export const TREES = layoutTrees(BUILDINGS);

export function layoutSummary() {
  validateLayout();
  const xs = BUILDINGS.map((b) => b.x);
  const zs = BUILDINGS.map((b) => b.z);
  return {
    buildings: BUILDINGS.length,
    trees: TREES.length,
    roads: roadDecals().length,
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    zMin: Math.min(...zs),
    zMax: Math.max(...zs),
    ground: GROUND_SIZE,
    plaza: PLAZA_HALF * 2,
    well: WELL,
    spawn: SPAWN,
    lamps: LAMPS,
    chapel: BUILDINGS.find((b) => b.steeple) || null,
  };
}
