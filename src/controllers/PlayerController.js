import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

const MOVE_SPEED = 5;
const MOUSE_SENS = 0.0025;
const STICK_LOOK = 3.0;
const PITCH_LIMIT = 1.15;
// v^2 / (2g) ≈ 0.8 m at 9.81. A hop, not a climb.
const JUMP_SPEED = 4;
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
    this._frames = 0;
    this._groundRay = new Ray(new Vector3(), new Vector3(0, -1, 0), GROUND_START + GROUND_PROBE);
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

    const move = this.input.getMoveAxes();
    const jump = this.input.consumeJump();
    this.grounded = this._isGrounded(vertical);
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const vx = (sin * move.y + cos * move.x) * MOVE_SPEED;
    const vz = (cos * move.y - sin * move.x) * MOVE_SPEED;
    const vy = jump && this.grounded ? JUMP_SPEED : vertical;
    body.setLinearVelocity(new Vector3(vx, vy, vz));
    body.setAngularVelocity(Vector3.Zero());

    const pos = this.boy.capsuleMesh.position;
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
