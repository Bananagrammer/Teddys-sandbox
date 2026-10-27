import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

import { PLAY_LADDERS, TREE_LADDER } from "../world/townLayout.js";

const MOVE_SPEED = 5;
const MOUSE_SENS = 0.0025;
const STICK_LOOK = 3.0;
const PITCH_LIMIT = 1.15;
// v^2 / (2g) ≈ 0.8 m at 9.81. A hop, not a climb.
const JUMP_SPEED = 4;
// Holding A in front of the ladder. A tap is only a few centimeters.
const CLIMB_SPEED = 1.45;
const MOUNT_SPEED = 2.4;
// Ray starts a little above the feet so it is not born inside the plaza decal,
// and only a short gap under the feet still counts as standing.
const GROUND_START = 0.12;
const GROUND_PROBE = 0.16;
const GROUND_SINK = 0.08;
// Already leaving the ground: another press must not add a second launch.
const RISING_SPEED = 0.8;

/**
 * Eyes of the boy. Walk on the ground, look around, and hop.
 * Yaw 0 faces +Z. Positive yaw turns toward +X (look right).
 * Positive pitch looks down, matching Babylon's camera rotation.
 */
export class PlayerController {
  constructor(boy, input, scene) {
    this.boy = boy;
    this.input = input;
    this.scene = scene;
    this.camera = null;
    this.yaw = 0;
    this.pitch = 0;
    this.ready = false;
    this.grounded = false;
    this.climbing = false;
    this._mounting = false;
    this._wasClimbing = false;
    this._pendingPlace = null;
    this._frames = 0;
    this._groundRay = new Ray(new Vector3(), new Vector3(0, -1, 0), GROUND_START + GROUND_PROBE);
    this.ladders = [TREE_LADDER, ...PLAY_LADDERS].map((spec) => this._ladderSpec(spec, boy.halfHeight));
    // The debug getter still names the tree-house ladder. Climbing uses this.ladders.
    this.ladder = this.ladders[0];
    this._mountLadder = null;
  }

  _ladderSpec(spec, halfHeight) {
    const standY = spec.deckTop + halfHeight;
    return {
      id: spec.id || "tree",
      x: spec.x,
      z: spec.z,
      deckTop: spec.deckTop,
      climb: spec.climb,
      standX: spec.standX,
      standZ: spec.standZ,
      standY,
      clearY: standY + 0.18,
    };
  }

  _ladderAt(x, z) {
    for (const ladder of this.ladders) {
      const box = ladder.climb;
      if (x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1) return ladder;
    }
    return null;
  }

  /** Dev hook. Applied on the next update so physics teleports with it. */
  place(x, y, z) {
    this._pendingPlace = { x, y, z };
    this._mounting = false;
    this._wasClimbing = false;
  }

  attach() {
    const start = this.boy.capsuleMesh.position;
    this.camera = new UniversalCamera(
      "eyes",
      new Vector3(start.x, start.y + this.boy.eyeAboveCenter, start.z),
      this.scene
    );
    this.camera.fov = 1.15;
    this.camera.minZ = 0.08;
    this.camera.maxZ = 1200;
    this.camera.inertia = 0;
    this.scene.activeCamera = this.camera;

    this.boy.attachHands();
    this._lookPipeline();
    this.scene.onBeforeRenderObservable.add(() => this._update());
  }

  _lookPipeline() {
    const pipeline = new DefaultRenderingPipeline("townLook", true, this.scene, [this.camera]);
    pipeline.fxaaEnabled = true;
    pipeline.bloomEnabled = false;
    pipeline.imageProcessingEnabled = true;
    pipeline.imageProcessing.contrast = 1.06;
    pipeline.imageProcessing.exposure = 1.0;
  }

  getLookDirection() {
    const direction = this.camera.getDirection(new Vector3(0, 0, 1));
    return { x: direction.x, y: direction.y, z: direction.z };
  }

  _update() {
    const dt = Math.min(this.scene.getEngine().getDeltaTime() / 1000, 0.05);
    const look = this.input.consumeLook();

    this.yaw += look.mouseX * MOUSE_SENS + look.stickX * STICK_LOOK * dt;
    this.pitch += look.mouseY * MOUSE_SENS + look.stickY * STICK_LOOK * dt;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));

    const body = this.boy.physicsBody.body;
    const currentVel = body.getLinearVelocity();
    if (!currentVel) return;
    const vertical = currentVel.y;
    // Physics already stepped this frame. A teleport flag set here is consumed
    // on the next step, so leave it false only when this update moves the mesh.
    body.disablePreStep = true;

    const move = this.input.getMoveAxes();
    const jump = this.input.consumeJump();
    const padA = this.input.isPadAHeld();
    this.grounded = this._isGrounded(vertical);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let vx = (sin * move.y + cos * move.x) * MOVE_SPEED;
    let vz = (cos * move.y - sin * move.x) * MOVE_SPEED;
    let vy = vertical;

    const pos = this.boy.capsuleMesh.position;
    const here = this._ladderAt(pos.x, pos.z);
    const atLadder = !!here;
    let climbing = false;

    if (this._pendingPlace) {
      const spot = this._pendingPlace;
      this._pendingPlace = null;
      this._mounting = false;
      this._mountLadder = null;
      this._wasClimbing = false;
      pos.set(spot.x, spot.y, spot.z);
      body.disablePreStep = false;
      body.setGravityFactor(1);
      vx = 0;
      vy = 0;
      vz = 0;
    } else if (padA && this._mounting) {
      const mounted = this._slideOntoDeck(body, pos, dt);
      climbing = !mounted;
      vx = this._slideVx;
      vy = this._slideVy;
      vz = this._slideVz;
    } else if (padA && here && pos.y < here.clearY - 0.02) {
      const nextX = pos.x + vx * dt;
      const nextZ = pos.z + vz * dt;
      const walkingOff = (vx !== 0 || vz !== 0) && !this._ladderAt(nextX, nextZ);
      if (walkingOff) {
        this._stopClimb(body);
        if (this._wasClimbing && vy > 0) vy = 0;
      } else {
        // A climbs here. It must not also add the hop impulse.
        climbing = true;
        this._mountLadder = here;
        body.setGravityFactor(0);
        vy = CLIMB_SPEED;
        if (pos.y + CLIMB_SPEED * Math.max(dt, 1 / 60) >= here.clearY - 0.03) {
          this._mounting = true;
        }
      }
    } else {
      this._stopClimb(body);
      const endedClimb = this._wasClimbing || this._mounting;
      this._mounting = false;
      this._mountLadder = null;
      if (this.grounded && (jump.space || (jump.pad && !atLadder))) vy = JUMP_SPEED;
      else if (endedClimb && vy > 0) vy = 0;
    }

    this.climbing = climbing;
    this._wasClimbing = climbing;

    body.setLinearVelocity(new Vector3(vx, vy, vz));
    body.setAngularVelocity(Vector3.Zero());

    this.boy.root.position.set(pos.x, pos.y - this.boy.halfHeight, pos.z);
    this.boy.root.rotation.y = this.yaw;

    this.camera.position.set(pos.x, pos.y + this.boy.eyeAboveCenter, pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0);

    if (this.boy.handsRoot) {
      this.boy.handsRoot.position.copyFrom(this.camera.position);
      this.boy.handsRoot.rotation.set(this.pitch, this.yaw, 0);
    }

    this._frames += 1;
    if (this._frames > 10) this.ready = true;
  }

  _inClimbColumn(x, z) {
    return !!this._ladderAt(x, z);
  }

  _stopClimb(body) {
    body.setGravityFactor(1);
  }

  /**
   * Slide from the top of the ladder onto the deck while A stays held.
   * Returns true once he has been set down on the deck.
   */
  _slideOntoDeck(body, pos, dt) {
    const ladder = this._mountLadder || this.ladder;
    const dx = ladder.standX - pos.x;
    const dz = ladder.standZ - pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.14) {
      pos.set(ladder.standX, ladder.standY, ladder.standZ);
      body.disablePreStep = false;
      body.setGravityFactor(1);
      this._mounting = false;
      this._slideVx = 0;
      this._slideVy = 0;
      this._slideVz = 0;
      return true;
    }
    body.setGravityFactor(0);
    const speed = Math.min(MOUNT_SPEED, dist / Math.max(dt, 1e-4));
    this._slideVx = (dx / dist) * speed;
    this._slideVz = (dz / dist) * speed;
    const dy = ladder.clearY - pos.y;
    this._slideVy = Math.max(-CLIMB_SPEED, Math.min(CLIMB_SPEED, dy / Math.max(dt, 1e-4)));
    return false;
  }

  /**
   * Short downward ray from just above the feet. Skips the boy, his hands,
   * and the lamp pole, glass, cap, and ribs — those are not the floor.
   */
  _isGrounded(verticalSpeed) {
    if (verticalSpeed > RISING_SPEED) return false;

    const pos = this.boy.capsuleMesh.position;
    const feetY = pos.y - this.boy.halfHeight;
    this._groundRay.origin.set(pos.x, feetY + GROUND_START, pos.z);
    this._groundRay.length = GROUND_START + GROUND_PROBE;

    const hit = this.scene.pickWithRay(this._groundRay, (mesh) => this._isWalkSurface(mesh));
    if (!hit?.hit || !hit.pickedPoint) return false;
    const gap = feetY - hit.pickedPoint.y;
    return gap <= GROUND_PROBE && gap >= -GROUND_SINK;
  }

  _isWalkSurface(mesh) {
    if (!mesh) return false;
    const name = mesh.name || "";
    if (name === "boyCapsule" || name.startsWith("lamp")) return false;
    let node = mesh;
    while (node) {
      if (node === this.boy.root || node === this.boy.handsRoot) return false;
      node = node.parent;
    }
    return true;
  }
}
