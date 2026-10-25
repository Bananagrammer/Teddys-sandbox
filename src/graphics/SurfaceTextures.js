import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector4 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";

/** Box face order is +z, -z, +x, -x, top, bottom. `tile` is meters per repeat. */
export function boxFaceUV(width, height, depth, tile) {
  const face = (u, v) => new Vector4(0, 0, Math.max(u, 0.15) / tile, Math.max(v, 0.15) / tile);
  return [
    face(width, height),
    face(width, height),
    face(depth, height),
    face(depth, height),
    face(width, depth),
    face(width, depth),
  ];
}

export class SurfaceTextures {
  constructor(scene) {
    this.scene = scene;
    this.grass = this._pair("grass", 512, paintGrass, 0.8);
    this.cobble = this._pair("cobble", 256, paintCobble, 2.2);
    this.plaza = this._pair("plaza", 256, paintPlaza, 1.6);
    this.plaster = this._pair("plaster", 256, paintPlaster, 0.7);
    this.roof = this._pair("roof", 256, paintTiles, 1.8);
    this.wood = this._pair("wood", 256, paintWood, 1.1);
    this.bark = this._pair("bark", 128, paintBark, 1.4);
    this.stone = this._pair("stone", 256, paintStone, 1.5);
    this.leaves = this._pair("leaves", 128, paintLeaves, 0.4);
    this.water = this._pair("water", 128, paintWater, 0.3);
    this.plaster.bump = null;
    this.leaves.bump = null;
  }

  _pair(name, size, paint, bumpStrength) {
    const diffuse = this._texture(name, size, paint);
    const bump = this._texture(`${name}Bump`, size, (ctx, s) => {
      const pixels = diffuse.getContext().getImageData(0, 0, s, s);
      ctx.putImageData(toNormal(pixels, s, bumpStrength), 0, 0);
    });
    bump.level = 0.18;
    return { diffuse, bump };
  }

  _texture(name, size, paint) {
    const texture = new DynamicTexture(name, { width: size, height: size }, this.scene, true);
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.WRAP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 8;
    paint(texture.getContext(), size);
    texture.update(false);
    return texture;
  }
}

export function createSky(scene) {
  const texture = new DynamicTexture("sky", { width: 512, height: 256 }, scene, true);
  paintSky(texture.getContext(), 512, 256);
  texture.update(false);

  const mat = new StandardMaterial("skyMat", scene);
  mat.emissiveTexture = texture;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  mat.fogEnabled = false;

  const sky = MeshBuilder.CreateSphere("sky", { diameter: 1200, segments: 24, sideOrientation: 1 }, scene);
  sky.material = mat;
  sky.applyFog = false;
  sky.isPickable = false;
  return sky;
}

function paintSky(ctx, width, height) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, "#3f86d4");
  gradient.addColorStop(0.35, "#5ea2e4");
  gradient.addColorStop(0.5, "#78b4ea");
  gradient.addColorStop(0.68, "#9ec8ef");
  gradient.addColorStop(1, "#c5daf0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const rand = makeRng("sky");
  for (let i = 0; i < 18; i++) {
    const x = rand() * width;
    const y = height * (0.15 + rand() * 0.45);
    const rx = 30 + rand() * 70;
    const ry = 8 + rand() * 16;
    ctx.fillStyle = `rgba(255,255,255,${0.18 + rand() * 0.28})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintGrass(ctx, size) {
  const rand = makeRng("grass");
  const broad = valueNoise(rand, 6);
  const fine = valueNoise(rand, 18);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n = broad(u, v) * 0.65 + fine(u, v) * 0.35;
      const i = (y * size + x) * 4;
      data[i] = 62 + n * 36;
      data[i + 1] = 118 + n * 58;
      data[i + 2] = 46 + n * 18;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  for (let i = 0; i < 70; i++) {
    ctx.fillStyle = rand() > 0.55 ? "#e2d48a" : "#f4f0dc";
    ctx.fillRect((rand() * size) | 0, (rand() * size) | 0, 2, 2);
  }
}

function paintCobble(ctx, size) {
  const rand = makeRng("cobble");
  ctx.fillStyle = "#5c564c";
  ctx.fillRect(0, 0, size, size);
  const cells = 4;
  const cell = size / cells;
  const gap = cell * 0.14;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 132 + (rand() * 42) | 0;
      ctx.fillStyle = `rgb(${shade + 6},${shade - 2},${shade - 14})`;
      roundRect(ctx, x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap, 8);
      ctx.fill();
    }
  }
}

function paintPlaza(ctx, size) {
  const rand = makeRng("plaza");
  ctx.fillStyle = "#6d675c";
  ctx.fillRect(0, 0, size, size);
  const cells = 3;
  const cell = size / cells;
  const gap = cell * 0.06;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 168 + (rand() * 28) | 0;
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 12})`;
      ctx.fillRect(x * cell + gap / 2, y * cell + gap / 2, cell - gap, cell - gap);
    }
  }
}

function paintPlaster(ctx, size) {
  const rand = makeRng("plaster");
  const noise = valueNoise(rand, 8);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x / size, y / size);
      const shade = 214 + n * 36;
      const i = (y * size + x) * 4;
      data[i] = shade;
      data[i + 1] = shade - 2;
      data[i + 2] = shade - 6;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintTiles(ctx, size) {
  const rand = makeRng("tiles");
  ctx.fillStyle = "#8a8680";
  ctx.fillRect(0, 0, size, size);
  const rows = 8;
  const rowH = size / rows;
  const cols = 6;
  const colW = size / cols;
  for (let r = 0; r < rows; r++) {
    const shift = (r % 2) * colW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const shade = 176 + (rand() * 48) | 0;
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade - 12})`;
      const x = c * colW + shift;
      const y = r * rowH;
      ctx.beginPath();
      ctx.moveTo(x + 3, y + rowH - 1);
      ctx.lineTo(x + 3, y + rowH * 0.42);
      ctx.quadraticCurveTo(x + colW / 2, y + 1, x + colW - 3, y + rowH * 0.42);
      ctx.lineTo(x + colW - 3, y + rowH - 1);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function paintWood(ctx, size) {
  const rand = makeRng("wood");
  const bands = valueNoise(rand, 10);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = bands(x / size, 0.2);
      const grain = bands(x / size, y / size) * 0.25;
      const i = (y * size + x) * 4;
      data[i] = 112 + n * 50 + grain * 20;
      data[i + 1] = 72 + n * 28 + grain * 10;
      data[i + 2] = 40 + n * 16;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintBark(ctx, size) {
  const rand = makeRng("bark");
  const grooves = valueNoise(rand, 12);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = grooves(x / size, y / size * 0.25);
      const i = (y * size + x) * 4;
      data[i] = 78 + n * 40;
      data[i + 1] = 52 + n * 24;
      data[i + 2] = 30 + n * 12;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintStone(ctx, size) {
  const rand = makeRng("stone");
  ctx.fillStyle = "#7a756c";
  ctx.fillRect(0, 0, size, size);
  const cells = 2;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const shade = 150 + (rand() * 30) | 0;
      ctx.fillStyle = `rgb(${shade},${shade - 4},${shade - 10})`;
      ctx.fillRect(x * cell + 3, y * cell + 3, cell - 6, cell - 6);
      ctx.strokeStyle = `rgba(90,84,74,0.9)`;
      ctx.lineWidth = 2;
      ctx.strokeRect(x * cell + 8, y * cell + 10, cell * 0.4, 2);
    }
  }
}

function paintLeaves(ctx, size) {
  const rand = makeRng("leaves");
  const noise = valueNoise(rand, 6);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = noise(x / size, y / size);
      const i = (y * size + x) * 4;
      data[i] = 36 + n * 30;
      data[i + 1] = 90 + n * 50;
      data[i + 2] = 32 + n * 16;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function paintWater(ctx, size) {
  const rand = makeRng("water");
  const ripples = valueNoise(rand, 8);
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = ripples(x / size, y / size);
      const i = (y * size + x) * 4;
      data[i] = 40 + n * 20;
      data[i + 1] = 90 + n * 30;
      data[i + 2] = 120 + n * 40;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function toNormal(image, size, strength) {
  const src = image.data;
  const out = new ImageData(size, size);
  const dst = out.data;
  const heightAt = (x, y) => {
    x = (x + size) % size;
    y = (y + size) % size;
    const i = (y * size + x) * 4;
    return src[i] + src[i + 1] + src[i + 2];
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength;
      const nx = -dx;
      const ny = -dy;
      const nz = 255 * 6;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * size + x) * 4;
      dst[i] = (nx / len * 0.5 + 0.5) * 255;
      dst[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      dst[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      dst[i + 3] = 255;
    }
  }
  return out;
}

function valueNoise(rand, cells) {
  const grid = [];
  for (let y = 0; y <= cells; y++) {
    const row = [];
    for (let x = 0; x <= cells; x++) row.push(rand());
    grid.push(row);
  }
  for (let y = 0; y < cells; y++) grid[y][cells] = grid[y][0];
  grid[cells] = grid[0].slice();
  return (u, v) => {
    const fx = (u - Math.floor(u)) * cells;
    const fy = (v - Math.floor(v)) * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = grid[y0][x0];
    const b = grid[y0][x0 + 1];
    const c = grid[y0 + 1][x0];
    const d = grid[y0 + 1][x0 + 1];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function makeRng(seed) {
  let a = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    a ^= seed.charCodeAt(i);
    a = Math.imul(a, 16777619);
  }
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function skyHorizonColor() {
  return new Color3(0.91, 0.9, 0.86);
}
