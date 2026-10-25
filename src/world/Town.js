import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { PhysicsAggregate, PhysicsMotionType, PhysicsShapeType } from "@babylonjs/core/Physics/v2";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { SurfaceTextures, boxFaceUV } from "../graphics/SurfaceTextures.js";
import {
  BUILDINGS,
  TREES,
  LAMPS,
  WELL,
  TREE_HOUSE,
  TREE_LADDER,
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
    this._plaqueFrameMat = this._mat("plaqueFrame", 0.22, 0.16, 0.12, 0.04);

    validateLayout();
    this.buildingCount = BUILDINGS.length;
    this.treeCount = TREES.length;
    this.wellX = WELL.x;
    this.wellZ = WELL.z;

    this._ground();
    this._streets();
    BUILDINGS.forEach((spec, index) => this._building(spec, index + 1));
    this._well(WELL.x, WELL.z);
    TREES.forEach(([x, z], i) => this._tree(i, x, z));
    this._treeHouse(TREE_HOUSE);
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

  _building(spec, houseNumber) {
    const { name, x, z, w, d, h, wall, roof, door, awning, steeple } = spec;
    const wallMat = this._mat(`${name}Wall`, wall[0], wall[1], wall[2], 0.04, this.textures.plaster);
    const roofMat = this._mat(`${name}Roof`, roof[0], roof[1], roof[2], 0.05, this.textures.roof);

    if (steeple) {
      // Interior lamp shares these walls with the sun and the street lamps.
      wallMat.maxSimultaneousLights = 8;
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
    if (steeple) {
      new PhysicsAggregate(roofMesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);
    }

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
    if (steeple) {
      this._steeple(name, x, z, h);
      this._chapelNave(name, x, z, w, d, door);
    }
    this._housePlaque(spec, houseNumber);
  }

  /**
   * Number 1..building count, in layout order, on the front wall above the door.
   * Shops sit a little higher so the awning does not hide the digits from the street.
   * CreatePlane faces -Z; yaw turns that face toward the street.
   */
  _housePlaque(spec, houseNumber) {
    const { name, x, z, w, d, door, awning } = spec;
    const plaqueW = 1.08;
    const plaqueH = 0.7;
    const frameT = 0.06;
    const y = awning ? 3.36 : 2.68;

    const frameOut = this._faceOffset(door, w, d, 0.012 + frameT / 2);
    const frame = MeshBuilder.CreateBox(`${name}NumberFrame`, {
      width: frameOut.alongX ? frameT : plaqueW + 0.12,
      height: plaqueH + 0.12,
      depth: frameOut.alongX ? plaqueW + 0.12 : frameT,
    }, this.scene);
    frame.position.set(x + frameOut.x, y, z + frameOut.z);
    frame.material = this._plaqueFrameMat;
    frame.isPickable = false;
    frame.receiveShadows = true;

    const plateOut = this._faceOffset(door, w, d, 0.012 + frameT + 0.012);
    const plate = MeshBuilder.CreatePlane(`${name}Number`, {
      width: plaqueW,
      height: plaqueH,
    }, this.scene);
    plate.position.set(x + plateOut.x, y, z + plateOut.z);
    plate.rotation.y = this._plaqueYaw(door);
    plate.material = this._plaqueMaterial(name, houseNumber);
    plate.isPickable = false;
    plate.metadata = { houseNumber };
  }

  _plaqueYaw(door) {
    switch (door) {
      case "north": return Math.PI;
      case "east": return -Math.PI / 2;
      case "west": return Math.PI / 2;
      default: return 0;
    }
  }

  _plaqueMaterial(name, houseNumber) {
    const width = 512;
    const height = 320;
    const texture = new DynamicTexture(`${name}NumberTex`, { width, height }, this.scene, true);
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const ctx = texture.getContext();
    ctx.fillStyle = "#f4efe4";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#241c16";
    ctx.lineWidth = 22;
    ctx.strokeRect(16, 16, width - 32, height - 32);
    ctx.fillStyle = "#1a140e";
    ctx.font = "bold 210px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(houseNumber), width / 2, height / 2 + 8);
    texture.update(true);

    const mat = new StandardMaterial(`${name}NumberMat`, this.scene);
    // Unlit. The emissive color is added to the texture, so it stays black
    // and the painted plaque is the whole color. A white emissive color
    // would clamp the digits away.
    mat.emissiveTexture = texture;
    mat.emissiveColor = Color3.Black();
    mat.diffuseColor = Color3.Black();
    mat.specularColor = Color3.Black();
    mat.disableLighting = true;
    mat.backFaceCulling = true;
    return mat;
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
    new PhysicsAggregate(ceiling, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);

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
      closing: false,
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
   * Edge already happened. Toggles only when the boy is within a few meters
   * of the doorway and the leaf is not already swinging.
   * A press while it is shut swings it open; the next press swings it shut
   * so the leaf blocks the doorway again.
   */
  tryToggleChapelDoor(px, pz) {
    const door = this.chapelDoor;
    if (!door || door.opening || door.closing) return false;
    if (Math.hypot(px - door.anchorX, pz - door.anchorZ) > CHAPEL_DOOR_REACH) return false;
    if (door.opened) door.closing = true;
    else door.opening = true;
    return true;
  }

  updateChapelDoor(dt) {
    const door = this.chapelDoor;
    if (!door || (!door.opening && !door.closing)) return;
    if (door.closing) {
      door.angle = Math.max(0, door.angle - CHAPEL_SWING_SPEED * dt);
      if (door.angle <= 1e-4) {
        door.angle = 0;
        door.closing = false;
        door.opened = false;
      }
    } else {
      door.angle = Math.min(door.openAngle, door.angle + CHAPEL_SWING_SPEED * dt);
      if (door.angle >= door.openAngle - 1e-4) {
        door.angle = door.openAngle;
        door.opening = false;
        door.opened = true;
      }
    }
    this._poseChapelDoor();
  }

  /**
   * Benches face the pulpit at the end opposite the door.
   * `out` is toward the doorway, so the sermon place sits at negative out.
   */
  _chapelNave(name, x, z, w, d, door) {
    const wallT = CHAPEL_WALL;
    const ax = this._doorAxes(door);
    const extentOut = ax.ox !== 0 ? w : d;
    const innerOut = extentOut / 2 - wallT;
    const spec = { x, z, door };
    const lit = [];

    const pewMat = this._mat(`${name}Pew`, 1, 1, 1, 0.06, this.textures.wood);
    const linen = this._mat(`${name}Linen`, 0.9, 0.88, 0.82, 0.04);
    const bookMat = this._mat(`${name}Book`, 0.34, 0.2, 0.14, 0.04, this.textures.wood);
    const crossMat = this._mat(`${name}Cross`, 0.26, 0.18, 0.12, 0.04, this.textures.wood);
    for (const mat of [pewMat, linen, bookMat, crossMat]) mat.maxSimultaneousLights = 8;

    const furnish = (suffix, outLen, sideLen, height, outDist, sideDist, y, material, physics) => {
      const mesh = this._chapelBox(
        `${name}${suffix}`, spec, outLen, sideLen, height, outDist, sideDist, y, material,
        { physics, shadow: physics, tile: 1.2 },
      );
      lit.push(mesh);
      return mesh;
    };

    const floor = this.scene.getMeshByName(`${name}Floor`);
    if (floor) {
      lit.push(floor);
      if (floor.material) floor.material.maxSimultaneousLights = 8;
    }
    for (const mesh of this.scene.meshes) {
      if (!mesh.name.startsWith(name)) continue;
      const part = mesh.name.slice(name.length);
      if (part.startsWith("Wall") || part.startsWith("Jamb") || part === "Lintel") lit.push(mesh);
    }

    const aisle = 0.64;
    const pewLen = 2.15;
    const pewSide = aisle + pewLen / 2;
    const benchOut = 0.38;
    const row0 = innerOut - 0.9;
    for (let row = 0; row < 3; row += 1) {
      const outDist = row0 - row * 1.15;
      for (const [suffix, side] of [["N", pewSide], ["S", -pewSide]]) {
        furnish(`Pew${row}${suffix}`, benchOut, pewLen, 0.4, outDist, side, 0.25, pewMat, true);
        furnish(
          `PewBack${row}${suffix}`, 0.07, pewLen, 0.48,
          outDist + benchOut / 2 - 0.035, side, 0.69, pewMat, true,
        );
      }
    }

    const stepOut = 1.15;
    const stepCenter = -innerOut + 0.16 + stepOut / 2;
    const stepFront = stepCenter + stepOut / 2;
    furnish("PulpitStep", stepOut, 1.65, 0.16, stepCenter, 0, 0.13, pewMat, true);
    const deskOut = stepFront - 0.28;
    furnish("PulpitDesk", 0.42, 0.66, 0.98, deskOut, 0, 0.7, pewMat, true);
    furnish("PulpitTop", 0.54, 0.84, 0.07, deskOut, 0, 1.225, linen, true);
    const book = furnish("Book", 0.22, 0.3, 0.045, deskOut, 0, 1.285, bookMat, false);
    book.isPickable = false;

    const crossOut = -innerOut + 0.05;
    const cross = furnish("CrossUpright", 0.08, 0.12, 1.6, crossOut, 0, 2.35, crossMat, false);
    cross.isPickable = false;
    const arm = furnish("CrossArm", 0.08, 0.76, 0.12, crossOut, 0, 2.68, crossMat, false);
    arm.isPickable = false;

    const candleMat = this._mat(`${name}Candle`, 0.95, 0.91, 0.8, 0.08);
    candleMat.emissiveColor = new Color3(0.28, 0.22, 0.12);
    candleMat.maxSimultaneousLights = 8;
    const flameMat = this._mat(`${name}Flame`, 1, 0.72, 0.28, 0.1);
    flameMat.emissiveColor = new Color3(1, 0.58, 0.16);
    flameMat.disableLighting = true;
    for (const [suffix, side] of [["L", 0.26], ["R", -0.26]]) {
      const wax = MeshBuilder.CreateCylinder(`${name}Candle${suffix}`, {
        height: 0.2,
        diameter: 0.05,
        tessellation: 8,
      }, this.scene);
      wax.position.copyFrom(this._chapelPoint(x, z, door, deskOut, side, 1.36));
      wax.material = candleMat;
      wax.isPickable = false;
      lit.push(wax);
      const flame = this._chapelBox(
        `${name}Flame${suffix}`, spec, 0.05, 0.05, 0.07, deskOut, side, 1.49, flameMat,
        { physics: false, shadow: false, tile: 0.2 },
      );
      flame.isPickable = false;
    }

    const light = new PointLight(`${name}Light`, this._chapelPoint(x, z, door, deskOut, 0, 1.9), this.scene);
    light.diffuse = new Color3(1, 0.84, 0.58);
    light.intensity = 1.6;
    light.range = 9;
    light.includedOnlyMeshes = lit;
  }

  _doorAxes(door) {
    switch (door) {
      case "north": return { ox: 0, oz: 1, sx: 1, sz: 0 };
      case "south": return { ox: 0, oz: -1, sx: 1, sz: 0 };
      case "east": return { ox: 1, oz: 0, sx: 0, sz: 1 };
      case "west": return { ox: -1, oz: 0, sx: 0, sz: 1 };
      default: return { ox: 0, oz: -1, sx: 1, sz: 0 };
    }
  }

  _chapelPoint(x, z, door, outDist, sideDist, y) {
    const ax = this._doorAxes(door);
    return new Vector3(
      x + ax.ox * outDist + ax.sx * sideDist,
      y,
      z + ax.oz * outDist + ax.sz * sideDist,
    );
  }

  _chapelBox(name, spec, outLen, sideLen, height, outDist, sideDist, y, material, options) {
    const ax = this._doorAxes(spec.door);
    const width = Math.abs(ax.ox) * outLen + Math.abs(ax.sx) * sideLen;
    const depth = Math.abs(ax.oz) * outLen + Math.abs(ax.sz) * sideLen;
    const mesh = MeshBuilder.CreateBox(name, {
      width,
      height,
      depth,
      faceUV: boxFaceUV(width, height, depth, options.tile ?? 1.4),
    }, this.scene);
    mesh.position.set(
      spec.x + ax.ox * outDist + ax.sx * sideDist,
      y,
      spec.z + ax.oz * outDist + ax.sz * sideDist,
    );
    mesh.material = material;
    mesh.receiveShadows = true;
    if (options.shadow) this.scene._shadowGenerator?.addShadowCaster(mesh);
    if (options.physics) {
      new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0, friction: 0.85 }, this.scene);
    }
    return mesh;
  }

  _solidBox(name, sx, sy, sz, px, py, pz, mat, tile) {
    const options = { width: sx, height: sy, depth: sz };
    if (tile) options.faceUV = boxFaceUV(sx, sy, sz, tile);
    const mesh = MeshBuilder.CreateBox(name, options, this.scene);
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
    new PhysicsAggregate(tower, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);

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
    new PhysicsAggregate(spire, PhysicsShapeType.BOX, { mass: 0, friction: 0.8 }, this.scene);
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

  /**
   * Cabin in the northeast meadow. The trunk collider stops him on the ground
   * and again where it comes up through the floor. A ladder on the south edge,
   * west of the trunk, is the way onto the deck. No plaque — not a numbered house.
   */
  _treeHouse(spec) {
    const { x, z } = spec;
    const name = "treeHouse";
    const deckTop = TREE_LADDER.deckTop;
    const deckH = 0.22;
    const deck = { x0: 157.35, x1: 162.45, z0: 157.35, z1: 162.75 };
    const deckCx = (deck.x0 + deck.x1) / 2;
    const deckCz = (deck.z0 + deck.z1) / 2;

    const timber = this._mat(`${name}Timber`, 0.76, 0.55, 0.34, 0.06, this.textures.wood);
    const deckMat = this._mat(`${name}Deck`, 0.62, 0.44, 0.26, 0.05, this.textures.wood);
    const roofMat = this._mat(`${name}Roof`, 0.62, 0.24, 0.16, 0.05, this.textures.roof);

    const baseH = deckTop - deckH + 0.06;
    const base = MeshBuilder.CreateCylinder(`${name}Trunk`, {
      height: baseH,
      diameter: 1.55,
      tessellation: 8,
    }, this.scene);
    base.position.set(x, baseH / 2, z);
    base.material = this._trunkMat;
    this._repeatUvs(base, 2, 3);
    base.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(base);
    new PhysicsAggregate(base, PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.85 }, this.scene);

    const flareH = 0.4;
    const flare = MeshBuilder.CreateCylinder(`${name}Flare`, {
      height: flareH,
      diameterTop: 1.45,
      diameterBottom: 1.9,
      tessellation: 8,
    }, this.scene);
    flare.position.set(x, flareH / 2, z);
    flare.material = this._trunkMat;
    this._repeatUvs(flare, 2, 1);
    flare.receiveShadows = true;
    flare.isPickable = false;
    this.scene._shadowGenerator?.addShadowCaster(flare);

    this._solidBox(
      `${name}Deck`,
      deck.x1 - deck.x0,
      deckH,
      deck.z1 - deck.z0,
      deckCx,
      deckTop - deckH / 2,
      deckCz,
      deckMat,
      1.15,
    );

    const upperBottom = deckTop - 0.1;
    const upperTop = 5.5;
    const upperH = upperTop - upperBottom;
    const upper = MeshBuilder.CreateCylinder(`${name}TrunkUpper`, {
      height: upperH,
      diameterBottom: 0.82,
      diameterTop: 0.48,
      tessellation: 8,
    }, this.scene);
    upper.position.set(x, upperBottom + upperH / 2, z);
    upper.material = this._trunkMat;
    this._repeatUvs(upper, 1, 3);
    upper.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(upper);
    new PhysicsAggregate(upper, PhysicsShapeType.CYLINDER, { mass: 0, friction: 0.8 }, this.scene);

    const wallT = 0.16;
    const wallH = 2.15;
    const wallY = deckTop + wallH / 2;
    const cab = { x0: 158.05, x1: 161.75, z0: 159.25, z1: 162.5 };
    const cabW = cab.x1 - cab.x0;
    const cabD = cab.z1 - cab.z0;
    const cabCx = (cab.x0 + cab.x1) / 2;
    const cabCz = (cab.z0 + cab.z1) / 2;
    const doorX = 159.15;
    const doorW = 1.2;
    const doorZ = cab.z0 + wallT / 2;
    const leftW = doorX - doorW / 2 - cab.x0;
    const rightW = cab.x1 - (doorX + doorW / 2);
    const lintelH = 0.16;

    this._solidBox(`${name}WallW`, wallT, wallH, cabD, cab.x0 + wallT / 2, wallY, cabCz, timber, 1.2);
    this._solidBox(`${name}WallE`, wallT, wallH, cabD, cab.x1 - wallT / 2, wallY, cabCz, timber, 1.2);
    this._solidBox(`${name}WallN`, cabW, wallH, wallT, cabCx, wallY, cab.z1 - wallT / 2, timber, 1.2);
    this._solidBox(
      `${name}JambL`,
      leftW,
      wallH,
      wallT,
      cab.x0 + leftW / 2,
      wallY,
      doorZ,
      timber,
      1.2,
    );
    this._solidBox(
      `${name}JambR`,
      rightW,
      wallH,
      wallT,
      cab.x1 - rightW / 2,
      wallY,
      doorZ,
      timber,
      1.2,
    );
    this._solidBox(
      `${name}Lintel`,
      doorW,
      lintelH,
      wallT,
      doorX,
      deckTop + wallH - lintelH / 2,
      doorZ,
      timber,
      0.8,
    );

    const winY = deckTop + 1.28;
    this._treeHouseWindow(name, "W", cab.x0 - 0.02, winY, cabCz, true);
    this._treeHouseWindow(name, "S", (doorX + doorW / 2 + cab.x1) / 2, winY, cab.z0 - 0.02, false);

    const eaveY = deckTop + wallH + 0.02;
    this._solidBox(`${name}Eave`, cabW + 0.5, 0.14, cabD + 0.46, cabCx, eaveY, cabCz, roofMat, 1.2);
    const roof = MeshBuilder.CreateCylinder(`${name}Roof`, {
      height: 1.35,
      diameterTop: 0,
      diameterBottom: Math.max(cabW, cabD) * 1.22,
      tessellation: 4,
    }, this.scene);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(cabCx, eaveY + 0.62, cabCz);
    roof.material = roofMat;
    this._repeatUvs(roof, 3, 2);
    roof.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(roof);

    this._treeLadder(name, timber);

    this._limb(name, 0, x, 3.35, z, 163.4, 5.15, 162.1, 0.34);
    this._limb(name, 1, x, 3.45, z, 161.4, 5.7, 164.0, 0.32);
    this._limb(name, 2, x, 3.3, z, 157.7, 4.7, 163.2, 0.3);
    this._limb(name, 3, x, 3.25, z, 162.6, 6.25, 160.3, 0.28);
    this._limb(name, 4, x, 2.7, z, 158.2, 2.86, 162.4, 0.42);
    this._limb(name, 5, x, 2.65, z, 162.6, 2.86, 159.6, 0.38);

    const foliage = [
      [163.2, 5.15, 162.2, 2.2, this._leafMat],
      [161.3, 5.85, 163.6, 2.15, this._leafMatDark],
      [157.9, 4.85, 163.1, 1.85, this._leafMat],
      [162.5, 6.35, 160.4, 1.9, this._leafMatDark],
      [159.6, 6.55, 161.3, 2.05, this._leafMat],
      [157.55, 4.55, 160.3, 1.7, this._leafMat],
    ];
    for (const [lx, ly, lz, diameter, mat] of foliage) {
      const leaf = MeshBuilder.CreateSphere(`${name}Leaf${lx.toFixed(0)}${lz.toFixed(0)}`, {
        diameter,
        segments: 7,
      }, this.scene);
      leaf.position.set(lx, ly, lz);
      leaf.material = mat;
      leaf.receiveShadows = true;
      leaf.isPickable = false;
      this.scene._shadowGenerator?.addShadowCaster(leaf);
    }
  }

  /**
   * Two side rails with physics, and rungs with none, so he cannot walk through
   * the ladder but a kinematic climb in front of it is not fighting the rungs.
   * Rails stop at the deck so the path over the lip stays clear.
   */
  _treeLadder(name, timber) {
    const ladderX = TREE_LADDER.x;
    const railZ = TREE_LADDER.z;
    const deckTop = TREE_LADDER.deckTop;
    const spread = 0.22;
    const railT = 0.07;
    const railD = 0.08;
    const railH = deckTop;
    this._solidBox(
      `${name}LadderRailL`,
      railT,
      railH,
      railD,
      ladderX - spread,
      railH / 2,
      railZ,
      timber,
      0.5,
    );
    this._solidBox(
      `${name}LadderRailR`,
      railT,
      railH,
      railD,
      ladderX + spread,
      railH / 2,
      railZ,
      timber,
      0.5,
    );

    const rungLen = spread * 2 - railT;
    const rungCount = 10;
    const y0 = 0.34;
    const y1 = deckTop - 0.16;
    for (let i = 0; i < rungCount; i += 1) {
      const y = y0 + ((y1 - y0) * i) / (rungCount - 1);
      const rung = MeshBuilder.CreateCylinder(`${name}LadderRung${i}`, {
        height: rungLen,
        diameter: 0.05,
        tessellation: 8,
      }, this.scene);
      rung.rotation.z = Math.PI / 2;
      rung.position.set(ladderX, y, railZ);
      rung.material = timber;
      rung.isPickable = false;
      rung.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(rung);
    }
  }

  _treeHouseWindow(name, suffix, x, y, z, alongX) {
    const trim = MeshBuilder.CreateBox(`${name}WinFrame${suffix}`, {
      width: alongX ? 0.05 : 0.78,
      height: 0.78,
      depth: alongX ? 0.78 : 0.05,
    }, this.scene);
    trim.position.set(x, y, z);
    trim.material = this._trimMat;
    trim.isPickable = false;

    const win = MeshBuilder.CreateBox(`${name}Win${suffix}`, {
      width: alongX ? 0.04 : 0.56,
      height: 0.56,
      depth: alongX ? 0.56 : 0.04,
    }, this.scene);
    win.position.set(x, y, z);
    win.material = this._windowMat;
    win.isPickable = false;
  }

  _limb(name, index, x0, y0, z0, x1, y1, z1, diameter) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dy, dz);
    const mesh = MeshBuilder.CreateCylinder(`${name}Limb${index}`, {
      height: length,
      diameterBottom: diameter,
      diameterTop: diameter * 0.62,
      tessellation: 6,
    }, this.scene);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    mesh.rotationQuaternion = new Quaternion();
    Quaternion.FromUnitVectorsToRef(
      Vector3.Up(),
      new Vector3(dx / length, dy / length, dz / length),
      mesh.rotationQuaternion,
    );
    mesh.material = this._trunkMat;
    mesh.receiveShadows = true;
    mesh.isPickable = false;
    this.scene._shadowGenerator?.addShadowCaster(mesh);
    return mesh;
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
