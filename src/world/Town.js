import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

// A few buildings around a crossroads. Coordinates are meters.
// Streets run along x = 0 and z = 0; the plaza is the open center.
const BUILDINGS = [
  { name: "bakery", x: -14, z: 18, w: 8, d: 7, h: 5, wall: [0.93, 0.86, 0.68], roof: [0.62, 0.24, 0.16], door: "south" },
  { name: "cottage", x: 14, z: 20, w: 7.5, d: 8, h: 4.6, wall: [0.7, 0.8, 0.84], roof: [0.32, 0.28, 0.3], door: "south" },
  { name: "houseWest", x: -16, z: -16, w: 8, d: 8, h: 7.2, wall: [0.86, 0.72, 0.4], roof: [0.42, 0.22, 0.14], door: "north" },
  { name: "shop", x: 16, z: -15, w: 10, d: 7, h: 4.4, wall: [0.84, 0.5, 0.4], roof: [0.55, 0.2, 0.14], door: "north", awning: true },
  { name: "chapel", x: 20, z: 32, w: 8, d: 11, h: 7.5, wall: [0.9, 0.9, 0.86], roof: [0.28, 0.3, 0.34], door: "south", steeple: true },
  { name: "houseFar", x: -26, z: 16, w: 6.5, d: 6.5, h: 4.2, wall: [0.58, 0.66, 0.48], roof: [0.36, 0.2, 0.12], door: "east" },
  { name: "northEnd", x: 0, z: 43, w: 12, d: 7, h: 6, wall: [0.75, 0.62, 0.5], roof: [0.45, 0.18, 0.14], door: "south" },
  { name: "southEnd", x: 0, z: -43, w: 11, d: 7, h: 5.2, wall: [0.8, 0.76, 0.68], roof: [0.34, 0.26, 0.24], door: "north" },
];

const TREES = [
  [-20, 28],
  [8, 30],
  [30, 16],
  [-28, -10],
  [12, -28],
  [-8, -30],
  [32, -10],
  [-18, 5],
];

export class Town {
  constructor(scene) {
    this.scene = scene;
    this._doorMat = null;
    this._windowMat = null;
    this._roadMat = null;
    this._plazaMat = null;
    this._trunkMat = null;
    this._leafMat = null;
    this._wellStone = null;
    this._waterMat = null;
  }

  build() {
    this._doorMat = this._mat("door", 0.35, 0.2, 0.1, 0.04);
    this._windowMat = this._mat("window", 0.18, 0.28, 0.38, 0.35);
    this._roadMat = this._mat("road", 0.42, 0.4, 0.36, 0.02);
    this._plazaMat = this._mat("plaza", 0.55, 0.52, 0.46, 0.03);
    this._trunkMat = this._mat("trunk", 0.38, 0.24, 0.12, 0.02);
    this._leafMat = this._mat("leaf", 0.24, 0.46, 0.2, 0.02);
    this._wellStone = this._mat("wellStone", 0.5, 0.48, 0.44, 0.04);
    this._waterMat = this._mat("water", 0.2, 0.38, 0.48, 0.4);

    this._ground();
    this._streets();
    for (const spec of BUILDINGS) this._building(spec);
    this._well(6.2, 5.4);
    TREES.forEach(([x, z], i) => this._tree(i, x, z));
    this.lamps = [
      [8, 12],
      [-8, 12],
      [8, -12],
      [-8, -12],
    ].map(([x, z], i) => this._lamp(i, x, z));
  }

  _ground() {
    const ground = MeshBuilder.CreateBox("ground", {
      width: 120,
      height: 2,
      depth: 120,
    }, this.scene);
    ground.position.y = -1;
    ground.material = this._mat("grass", 0.34, 0.48, 0.24, 0.02);
    ground.receiveShadows = true;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.9 }, this.scene);
  }

  _streets() {
    // Flat decals just above the grass. The ground collider is the walk surface.
    this._decal("roadN", 6, 28, 0, 23);
    this._decal("roadS", 6, 28, 0, -23);
    this._decal("roadE", 28, 6, 23, 0);
    this._decal("roadW", 28, 6, -23, 0);

    const plaza = MeshBuilder.CreateBox("plaza", { width: 18, height: 0.04, depth: 18 }, this.scene);
    plaza.position.set(0, 0.03, 0);
    plaza.material = this._plazaMat;
    plaza.receiveShadows = true;
  }

  _decal(name, w, d, x, z) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: 0.04, depth: d }, this.scene);
    mesh.position.set(x, 0.02, z);
    mesh.material = this._roadMat;
    mesh.receiveShadows = true;
    return mesh;
  }

  _building(spec) {
    const { name, x, z, w, d, h, wall, roof, door, awning, steeple } = spec;
    const wallMat = this._mat(`${name}Wall`, wall[0], wall[1], wall[2], 0.04);
    const roofMat = this._mat(`${name}Roof`, roof[0], roof[1], roof[2], 0.04);

    const body = MeshBuilder.CreateBox(`${name}Body`, { width: w, height: h, depth: d }, this.scene);
    body.position.set(x, h / 2, z);
    body.material = wallMat;
    body.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(body);
    new PhysicsAggregate(body, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);

    const roofMesh = MeshBuilder.CreateCylinder(`${name}Roof`, {
      height: 1.7,
      diameterTop: 0,
      diameterBottom: Math.max(w, d) * 1.2,
      tessellation: 4,
    }, this.scene);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.set(x, h + 0.75, z);
    roofMesh.material = roofMat;
    roofMesh.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(roofMesh);

    this._doorAndWindows(name, x, z, w, d, door);
    if (awning) this._awning(name, x, z, w, d, door);
    if (steeple) this._steeple(name, x, z, h);
  }

  _doorAndWindows(name, x, z, w, d, door) {
    const outward = this._faceOffset(door, w, d, 0.06);
    const doorMesh = MeshBuilder.CreateBox(`${name}Door`, {
      width: outward.alongX ? 0.08 : 1.05,
      height: 1.9,
      depth: outward.alongX ? 1.05 : 0.08,
    }, this.scene);
    doorMesh.position.set(x + outward.x, 0.95, z + outward.z);
    doorMesh.material = this._doorMat;

    for (const side of [-1, 1]) {
      const win = MeshBuilder.CreateBox(`${name}Win${side}`, {
        width: outward.alongX ? 0.06 : 0.7,
        height: 0.7,
        depth: outward.alongX ? 0.7 : 0.06,
      }, this.scene);
      const lateral = this._lateral(door, side * 1.7);
      win.position.set(x + outward.x * 0.7 + lateral.x, 2.5, z + outward.z * 0.7 + lateral.z);
      win.material = this._windowMat;
    }
  }

  _awning(name, x, z, w, d, door) {
    const outward = this._faceOffset(door, w, d, 0.7);
    const awning = MeshBuilder.CreateBox(`${name}Awning`, {
      width: outward.alongX ? 1.3 : 3.2,
      height: 0.08,
      depth: outward.alongX ? 3.2 : 1.3,
    }, this.scene);
    awning.position.set(x + outward.x, 2.35, z + outward.z);
    awning.material = this._mat(`${name}Awning`, 0.7, 0.18, 0.16, 0.03);
    awning.receiveShadows = true;
  }

  _steeple(name, x, z, h) {
    const tower = MeshBuilder.CreateBox(`${name}Tower`, { width: 1.5, height: 4.2, depth: 1.5 }, this.scene);
    tower.position.set(x, h + 2.1, z);
    tower.material = this._mat(`${name}Tower`, 0.86, 0.86, 0.82, 0.04);
    tower.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(tower);

    const spire = MeshBuilder.CreateCylinder(`${name}Spire`, {
      height: 2.4,
      diameterTop: 0,
      diameterBottom: 1.7,
      tessellation: 4,
    }, this.scene);
    spire.rotation.y = Math.PI / 4;
    spire.position.set(x, h + 4.2 + 1.2, z);
    spire.material = this._mat(`${name}Spire`, 0.3, 0.32, 0.36, 0.05);
    this.scene._shadowGenerator?.addShadowCaster(spire);
  }

  _lamp(index, x, z) {
    const pole = MeshBuilder.CreateCylinder(`lampPole${index}`, {
      height: 3.2,
      diameter: 0.18,
      tessellation: 8,
    }, this.scene);
    pole.position.set(x, 1.6, z);
    pole.material = this._mat(`lampPoleMat${index}`, 0.22, 0.22, 0.24, 0.15);
    pole.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(pole);
    new PhysicsAggregate(pole, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

    const glassMat = this._mat(`lampGlassMat${index}`, 1, 0.9, 0.55, 0.05);
    glassMat.emissiveColor = new Color3(1, 0.72, 0.25);
    const glass = MeshBuilder.CreateSphere(`lampGlass${index}`, {
      diameter: 0.46,
      segments: 8,
    }, this.scene);
    glass.position.set(x, 3.3, z);
    glass.material = glassMat;

    const light = new PointLight(`lampLight${index}`, new Vector3(x, 3.3, z), this.scene);
    light.diffuse = new Color3(1, 0.82, 0.45);
    light.intensity = 1.5;
    light.range = 18;

    return { x, z, lit: true, light };
  }

  _well(x, z) {
    const wall = MeshBuilder.CreateCylinder("well", {
      height: 0.85,
      diameter: 2.1,
      tessellation: 12,
    }, this.scene);
    wall.position.set(x, 0.42, z);
    wall.material = this._wellStone;
    wall.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(wall);
    new PhysicsAggregate(wall, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

    const water = MeshBuilder.CreateCylinder("wellWater", {
      height: 0.08,
      diameter: 1.45,
      tessellation: 12,
    }, this.scene);
    water.position.set(x, 0.78, z);
    water.material = this._waterMat;
  }

  _tree(index, x, z) {
    const trunk = MeshBuilder.CreateCylinder(`trunk${index}`, {
      height: 1.7,
      diameter: 0.38,
      tessellation: 7,
    }, this.scene);
    trunk.position.set(x, 0.85, z);
    trunk.material = this._trunkMat;
    trunk.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(trunk);
    new PhysicsAggregate(trunk, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

    const crown = MeshBuilder.CreateSphere(`crown${index}`, { diameter: 3.1, segments: 6 }, this.scene);
    crown.position.set(x, 2.7, z);
    crown.material = this._leafMat;
    crown.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(crown);
  }

  _faceOffset(door, w, d, reach) {
    switch (door) {
      case "north": return { x: 0, z: d / 2 + reach, alongX: false };
      case "south": return { x: 0, z: -(d / 2 + reach), alongX: false };
      case "east": return { x: w / 2 + reach, z: 0, alongX: true };
      case "west": return { x: -(w / 2 + reach), z: 0, alongX: true };
      default: return { x: 0, z: d / 2 + reach, alongX: false };
    }
  }

  _lateral(door, amount) {
    if (door === "east" || door === "west") return { x: 0, z: amount };
    return { x: amount, z: 0 };
  }

  _mat(name, r, g, b, spec) {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = new Color3(r, g, b);
    mat.specularColor = new Color3(spec, spec, spec);
    mat.maxSimultaneousLights = 6;
    return mat;
  }
}
