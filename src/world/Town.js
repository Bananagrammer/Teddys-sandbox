import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { PhysicsAggregate, PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { SurfaceTextures, boxFaceUV } from "../graphics/SurfaceTextures.js";
import {
  BUILDINGS,
  TREES,
  LAMPS,
  WELL,
  GROUND_SIZE,
  PLAZA_HALF,
  roadDecals,
  validateLayout,
} from "./townLayout.js";

// Chapel doorway. The boy is a 0.56 m wide capsule, so the opening is wider than that
// and the leaf is a little wider still so it covers the hole while it is shut.
const CHAPEL_WALL = 0.34;
const CHAPEL_OPEN_W = 1.08;
const CHAPEL_OPEN_H = 2.08;
const CHAPEL_DOOR_W = 1.22;
const CHAPEL_DOOR_H = 2.24;
const CHAPEL_DOOR_T = 0.08;
const CHAPEL_OPEN_ANGLE = 1.9;
const CHAPEL_SWING_SPEED = 1.7;
const CHAPEL_DOOR_REACH = 2.4;

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
    this.chapelDoor = null;
  }

  build() {
    this.textures = new SurfaceTextures(this.scene);
    this._doorMat = this._mat("door", 1, 1, 1, 0.08, this.textures.wood);
    this._windowMat = this._mat("window", 0.55, 0.7, 0.8, 0.85);
    this._windowMat.emissiveColor = new Color3(0.16, 0.22, 0.28);
    this._trimMat = this._mat("trim", 0.9, 0.86, 0.78, 0.08, this.textures.wood);
    this._roadMat = this._mat("road", 0.92, 0.9, 0.84, 0.04, this.textures.cobble);
    this._plazaMat = this._mat("plaza", 0.95, 0.93, 0.88, 0.05, this.textures.plaza);
    this._trunkMat = this._mat("trunk", 1, 1, 1, 0.03, this.textures.bark);
    this._leafMat = this._mat("leaf", 1, 1, 1, 0.02, this.textures.leaves);
    this._leafMatDark = this._mat("leafDark", 0.78, 0.86, 0.75, 0.02, this.textures.leaves);
    this._stoneMat = this._mat("stone", 0.82, 0.8, 0.74, 0.06, this.textures.stone);
    this._wellStone = this._stoneMat;
    this._waterMat = this._mat("water", 1, 1, 1, 0.7, this.textures.water);
    this._waterMat.specularPower = 64;
    this._waterMat.emissiveColor = new Color3(0.02, 0.06, 0.08);

    validateLayout();
    this.buildingCount = BUILDINGS.length;
    this.treeCount = TREES.length;
    this.wellX = WELL.x;
    this.wellZ = WELL.z;

    this._ground();
    this._streets();
    for (const spec of BUILDINGS) this._building(spec);
    this._well(WELL.x, WELL.z);
    TREES.forEach(([x, z], i) => this._tree(i, x, z));
    this.lamps = LAMPS.map(([x, z], i) => this._lamp(i, x, z));
  }

  _ground() {
    const ground = MeshBuilder.CreateBox("ground", {
      width: GROUND_SIZE,
      height: 2,
      depth: GROUND_SIZE,
      faceUV: boxFaceUV(GROUND_SIZE, 2, GROUND_SIZE, 4),
    }, this.scene);
    ground.position.y = -1;
    ground.material = this._mat("grass", 1, 1, 1, 0.02, this.textures.grass);
    ground.receiveShadows = true;
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0, friction: 0.9 }, this.scene);
  }

  _streets() {
    // Flat decals just above the grass. The ground collider is the walk surface.
    // East-west pieces stop at the north-south strips so the crossings do not z-fight.
    for (const road of roadDecals()) {
      this._decal(road.name, road.w, road.d, road.x, road.z);
    }

    const plazaSize = PLAZA_HALF * 2;
    const plaza = MeshBuilder.CreateBox("plaza", {
      width: plazaSize,
      height: 0.04,
      depth: plazaSize,
      faceUV: boxFaceUV(plazaSize, 0.04, plazaSize, 1.8),
    }, this.scene);
    plaza.position.set(0, 0.03, 0);
    plaza.material = this._plazaMat;
    plaza.receiveShadows = true;
  }

  _decal(name, w, d, x, z) {
    const mesh = MeshBuilder.CreateBox(name, {
      width: w,
      height: 0.04,
      depth: d,
      faceUV: boxFaceUV(w, 0.04, d, 1.15),
    }, this.scene);
    mesh.position.set(x, 0.02, z);
    mesh.material = this._roadMat;
    mesh.receiveShadows = true;
    return mesh;
  }

  _building(spec) {
    const { name, x, z, w, d, h, wall, roof, door, awning, steeple } = spec;
    const wallMat = this._mat(`${name}Wall`, wall[0], wall[1], wall[2], 0.04, this.textures.plaster);
    const roofMat = this._mat(`${name}Roof`, roof[0], roof[1], roof[2], 0.05, this.textures.roof);

    if (steeple) {
      this._chapelShell(name, x, z, w, d, h, wallMat, door);
    } else {
      const foundH = 0.46;
      const foundation = MeshBuilder.CreateBox(`${name}Found`, {
        width: w + 0.18,
        height: foundH,
        depth: d + 0.18,
        faceUV: boxFaceUV(w + 0.18, foundH, d + 0.18, 1.2),
      }, this.scene);
      foundation.position.set(x, foundH / 2, z);
      foundation.material = this._stoneMat;
      foundation.receiveShadows = true;

      const body = MeshBuilder.CreateBox(`${name}Body`, {
        width: w,
        height: h,
        depth: d,
        faceUV: boxFaceUV(w, h, d, 1.7),
      }, this.scene);
      body.position.set(x, h / 2, z);
      body.material = wallMat;
      body.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(body);
      new PhysicsAggregate(body, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);
    }

    const roofMesh = MeshBuilder.CreateCylinder(`${name}Roof`, {
      height: 1.7,
      diameterTop: 0,
      diameterBottom: Math.max(w, d) * 1.2,
      tessellation: 4,
    }, this.scene);
    roofMesh.rotation.y = Math.PI / 4;
    roofMesh.position.set(x, h + 0.75, z);
    roofMesh.material = roofMat;
    this._repeatUvs(roofMesh, 4, 2);
    roofMesh.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(roofMesh);

    const eave = MeshBuilder.CreateBox(`${name}Eave`, {
      width: w + 0.55,
      height: 0.16,
      depth: d + 0.55,
      faceUV: boxFaceUV(w + 0.55, 0.16, d + 0.55, 1.2),
    }, this.scene);
    eave.position.set(x, h - 0.02, z);
    eave.material = roofMat;
    eave.receiveShadows = true;

    if (!steeple) this._chimney(name, x, z, w, d, h);

    if (steeple) this._chapelDoor(name, x, z, w, d, door);
    else this._doorAndWindows(name, x, z, w, d, door);
    if (awning) this._awning(name, x, z, w, d, door);
    if (steeple) this._steeple(name, x, z, h);
  }

  /**
   * Hollow chapel: wall slabs with a doorway instead of one solid box,
   * so the boy can walk in once the door leaf swings aside.
   * A floor and ceiling stay even if benches or a pulpit are added later.
   */
  _chapelShell(name, x, z, w, d, h, wallMat, door) {
    const T = CHAPEL_WALL;
    const sides = [
      { side: "north", px: x, pz: z + d / 2 - T / 2, sx: w, sz: T, alongX: true },
      { side: "south", px: x, pz: z - d / 2 + T / 2, sx: w, sz: T, alongX: true },
      { side: "east", px: x + w / 2 - T / 2, pz: z, sx: T, sz: d, alongX: false },
      { side: "west", px: x - w / 2 + T / 2, pz: z, sx: T, sz: d, alongX: false },
    ];
    for (const wall of sides) {
      if (wall.side === door) this._chapelDoorWall(name, wall, h, wallMat);
      else this._solidBox(`${name}Wall${wall.side}`, wall.sx, h, wall.sz, wall.px, h / 2, wall.pz, wallMat);
    }

    const floor = MeshBuilder.CreateBox(`${name}Floor`, {
      width: Math.max(1, w - T * 2 - 0.08),
      height: 0.04,
      depth: Math.max(1, d - T * 2 - 0.08),
      faceUV: boxFaceUV(w, 0.04, d, 1.2),
    }, this.scene);
    floor.position.set(x, 0.03, z);
    floor.material = this._mat(`${name}Floor`, 1, 1, 1, 0.05, this.textures.wood);
    floor.receiveShadows = true;

    const ceiling = MeshBuilder.CreateBox(`${name}Ceiling`, {
      width: Math.max(1, w - T * 2 - 0.04),
      height: 0.08,
      depth: Math.max(1, d - T * 2 - 0.04),
    }, this.scene);
    ceiling.position.set(x, h - 0.14, z);
    ceiling.material = this._trimMat;

    this._chapelWindows(name, x, z, w, d, door);
  }

  _chapelDoorWall(name, wall, h, wallMat) {
    const openW = Math.min(CHAPEL_OPEN_W, (wall.alongX ? wall.sx : wall.sz) - 1.2);
    const jamb = ((wall.alongX ? wall.sx : wall.sz) - openW) / 2;
    const lintelH = h - CHAPEL_OPEN_H;
    if (wall.alongX) {
      this._solidBox(`${name}JambL`, jamb, h, wall.sz, wall.px - openW / 2 - jamb / 2, h / 2, wall.pz, wallMat);
      this._solidBox(`${name}JambR`, jamb, h, wall.sz, wall.px + openW / 2 + jamb / 2, h / 2, wall.pz, wallMat);
      this._solidBox(
        `${name}Lintel`,
        openW,
        lintelH,
        wall.sz,
        wall.px,
        CHAPEL_OPEN_H + lintelH / 2,
        wall.pz,
        wallMat
      );
    } else {
      this._solidBox(`${name}JambL`, wall.sx, h, jamb, wall.px, h / 2, wall.pz - openW / 2 - jamb / 2, wallMat);
      this._solidBox(`${name}JambR`, wall.sx, h, jamb, wall.px, h / 2, wall.pz + openW / 2 + jamb / 2, wallMat);
      this._solidBox(
        `${name}Lintel`,
        wall.sx,
        lintelH,
        openW,
        wall.px,
        CHAPEL_OPEN_H + lintelH / 2,
        wall.pz,
        wallMat
      );
    }
  }

  _chapelWindows(name, x, z, w, d, door) {
    const outward = this._faceOffset(door, w, d, 0.05);
    for (const side of [-1, 1]) {
      const lateral = this._lateral(door, side * 2.15);
      const wx = x + outward.x + lateral.x;
      const wz = z + outward.z + lateral.z;
      const trim = MeshBuilder.CreateBox(`${name}WinFrame${side}`, {
        width: outward.alongX ? 0.06 : 0.84,
        height: 0.9,
        depth: outward.alongX ? 0.84 : 0.06,
      }, this.scene);
      trim.position.set(wx - Math.sign(outward.x) * 0.02, 3.15, wz - Math.sign(outward.z) * 0.02);
      trim.material = this._trimMat;

      const win = MeshBuilder.CreateBox(`${name}Win${side}`, {
        width: outward.alongX ? 0.05 : 0.62,
        height: 0.66,
        depth: outward.alongX ? 0.62 : 0.05,
      }, this.scene);
      win.position.set(wx, 3.15, wz);
      win.material = this._windowMat;
    }
  }

  /**
   * Door leaf hinged at one jamb, just outside the wall. It starts shut.
   * Positive swing rotates the leaf outward (see _poseChapelDoor).
   */
  _chapelDoor(name, x, z, w, d, door) {
    const half = CHAPEL_DOOR_W / 2;
    const proud = 0.025 + CHAPEL_DOOR_T / 2;
    let hingeX;
    let hingeZ;
    let closedYaw;
    let anchorX;
    let anchorZ;
    if (door === "east") {
      hingeX = x + w / 2 + proud;
      hingeZ = z - half;
      closedYaw = 0;
      anchorX = x + w / 2 + 0.7;
      anchorZ = z;
    } else if (door === "west") {
      hingeX = x - w / 2 - proud;
      hingeZ = z + half;
      closedYaw = Math.PI;
      anchorX = x - w / 2 - 0.7;
      anchorZ = z;
    } else if (door === "south") {
      hingeX = x - half;
      hingeZ = z - d / 2 - proud;
      closedYaw = Math.PI / 2;
      anchorX = x;
      anchorZ = z - d / 2 - 0.7;
    } else {
      hingeX = x + half;
      hingeZ = z + d / 2 + proud;
      closedYaw = -Math.PI / 2;
      anchorX = x;
      anchorZ = z + d / 2 + 0.7;
    }

    const mesh = MeshBuilder.CreateBox(`${name}Door`, {
      width: CHAPEL_DOOR_T,
      height: CHAPEL_DOOR_H,
      depth: CHAPEL_DOOR_W,
      faceUV: boxFaceUV(CHAPEL_DOOR_T, CHAPEL_DOOR_H, CHAPEL_DOOR_W, 0.8),
    }, this.scene);
    mesh.material = this._doorMat;
    mesh.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(mesh);

    this.chapelDoor = {
      mesh,
      aggregate: null,
      hingeX,
      hingeZ,
      closedYaw,
      half,
      height: CHAPEL_DOOR_H,
      angle: 0,
      openAngle: CHAPEL_OPEN_ANGLE,
      opening: false,
      opened: false,
      anchorX,
      anchorZ,
      facing: door,
    };
    this._poseChapelDoor();

    const aggregate = new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.5 }, this.scene);
    aggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
    aggregate.body.disablePreStep = false;
    aggregate.body.disableSync = true;
    aggregate.body.setGravityFactor(0);
    this.chapelDoor.aggregate = aggregate;
  }

  _poseChapelDoor() {
    const door = this.chapelDoor;
    if (!door) return;
    const yaw = door.closedYaw + door.angle;
    door.mesh.position.set(
      door.hingeX + Math.sin(yaw) * door.half,
      door.height / 2,
      door.hingeZ + Math.cos(yaw) * door.half
    );
    if (!door.mesh.rotationQuaternion) door.mesh.rotationQuaternion = new Quaternion();
    Quaternion.RotationYawPitchRollToRef(yaw, 0, 0, door.mesh.rotationQuaternion);
  }

  /**
   * Edge already happened. Opens only when the boy is within a few meters
   * of the doorway. One swing; it stays open.
   */
  tryOpenChapelDoor(px, pz) {
    const door = this.chapelDoor;
    if (!door || door.opened || door.opening) return false;
    if (Math.hypot(px - door.anchorX, pz - door.anchorZ) > CHAPEL_DOOR_REACH) return false;
    door.opening = true;
    return true;
  }

  updateChapelDoor(dt) {
    const door = this.chapelDoor;
    if (!door?.opening) return;
    door.angle = Math.min(door.openAngle, door.angle + CHAPEL_SWING_SPEED * dt);
    this._poseChapelDoor();
    if (door.angle >= door.openAngle - 1e-4) {
      door.angle = door.openAngle;
      door.opening = false;
      door.opened = true;
      this._poseChapelDoor();
    }
  }

  _solidBox(name, sx, sy, sz, px, py, pz, mat) {
    const mesh = MeshBuilder.CreateBox(name, { width: sx, height: sy, depth: sz }, this.scene);
    mesh.position.set(px, py, pz);
    mesh.material = mat;
    mesh.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(mesh);
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);
    return mesh;
  }

  _doorAndWindows(name, x, z, w, d, door) {
    const outward = this._faceOffset(door, w, d, 0.06);
    const frame = MeshBuilder.CreateBox(`${name}DoorFrame`, {
      width: outward.alongX ? 0.07 : 1.28,
      height: 2.15,
      depth: outward.alongX ? 1.28 : 0.07,
    }, this.scene);
    frame.position.set(x + outward.x * 0.85, 1.05, z + outward.z * 0.85);
    frame.material = this._trimMat;

    const doorMesh = MeshBuilder.CreateBox(`${name}Door`, {
      width: outward.alongX ? 0.09 : 1.02,
      height: 1.9,
      depth: outward.alongX ? 1.02 : 0.09,
      faceUV: boxFaceUV(outward.alongX ? 0.09 : 1.02, 1.9, outward.alongX ? 1.02 : 0.09, 0.8),
    }, this.scene);
    doorMesh.position.set(x + outward.x, 0.95, z + outward.z);
    doorMesh.material = this._doorMat;

    for (const side of [-1, 1]) {
      const lateral = this._lateral(door, side * 1.7);
      const wx = x + outward.x * 0.7 + lateral.x;
      const wz = z + outward.z * 0.7 + lateral.z;
      const trim = MeshBuilder.CreateBox(`${name}WinFrame${side}`, {
        width: outward.alongX ? 0.05 : 0.92,
        height: 0.96,
        depth: outward.alongX ? 0.92 : 0.05,
      }, this.scene);
      trim.position.set(wx - outward.x * 0.15, 2.5, wz - outward.z * 0.15);
      trim.material = this._trimMat;

      const win = MeshBuilder.CreateBox(`${name}Win${side}`, {
        width: outward.alongX ? 0.07 : 0.68,
        height: 0.7,
        depth: outward.alongX ? 0.68 : 0.07,
      }, this.scene);
      win.position.set(wx, 2.5, wz);
      win.material = this._windowMat;
    }
  }

  _chimney(name, x, z, w, d, h) {
    const chimney = MeshBuilder.CreateBox(`${name}Chimney`, {
      width: 0.55,
      height: 1.35,
      depth: 0.55,
      faceUV: boxFaceUV(0.55, 1.35, 0.55, 0.55),
    }, this.scene);
    chimney.position.set(x + w * 0.22, h + 0.85, z - d * 0.12);
    chimney.material = this._stoneMat;
    chimney.receiveShadows = true;
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
    tower.material = this._mat(`${name}Tower`, 0.9, 0.9, 0.86, 0.04, this.textures.plaster);
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
    spire.material = this._mat(`${name}Spire`, 0.32, 0.34, 0.38, 0.06, this.textures.roof);
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
    const cap = MeshBuilder.CreateCylinder(`lampCap${index}`, {
      height: 0.12,
      diameter: 0.7,
      tessellation: 8,
    }, this.scene);
    cap.position.set(x, 3.62, z);
    cap.material = pole.material;

    const glass = MeshBuilder.CreateSphere(`lampGlass${index}`, {
      diameter: 0.42,
      segments: 10,
    }, this.scene);
    glass.position.set(x, 3.28, z);
    glass.material = glassMat;

    for (let bar = 0; bar < 4; bar++) {
      const angle = (bar / 4) * Math.PI * 2;
      const rib = MeshBuilder.CreateBox(`lampRib${index}_${bar}`, {
        width: 0.035,
        height: 0.48,
        depth: 0.035,
      }, this.scene);
      rib.position.set(x + Math.cos(angle) * 0.2, 3.28, z + Math.sin(angle) * 0.2);
      rib.material = pole.material;
    }

    const light = new PointLight(`lampLight${index}`, new Vector3(x, 3.28, z), this.scene);
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
    this._repeatUvs(wall, 6, 1);
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
    this._repeatUvs(trunk, 1, 3);
    trunk.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(trunk);
    new PhysicsAggregate(trunk, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

    const crowns = [
      [0, 2.55, 0, 2.7, this._leafMat],
      [0.55, 3.15, 0.35, 1.9, this._leafMatDark],
      [-0.45, 2.15, -0.3, 1.7, this._leafMat],
    ];
    for (const [ox, y, oz, diameter, mat] of crowns) {
      const crown = MeshBuilder.CreateSphere(`crown${index}_${y}`, {
        diameter,
        segments: 7,
      }, this.scene);
      crown.position.set(x + ox, y, z + oz);
      crown.material = mat;
      crown.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(crown);
    }
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

  _repeatUvs(mesh, uScale, vScale) {
    const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
    if (!uvs) return;
    const copy = uvs.slice();
    for (let i = 0; i < copy.length; i += 2) {
      copy[i] *= uScale;
      copy[i + 1] *= vScale;
    }
    mesh.setVerticesData(VertexBuffer.UVKind, copy);
  }

  _mat(name, r, g, b, spec, maps) {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = new Color3(r, g, b);
    mat.specularColor = new Color3(spec, spec, spec);
    mat.specularPower = spec > 0.2 ? 48 : 20;
    mat.maxSimultaneousLights = 6;
    if (maps?.diffuse) mat.diffuseTexture = maps.diffuse;
    if (maps?.bump) mat.bumpTexture = maps.bump;
    return mat;
  }
}
