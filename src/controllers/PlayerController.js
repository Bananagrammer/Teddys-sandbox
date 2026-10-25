import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { DefaultRenderingPipeline } from "@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline";

const MOVE_SPEED = 5;
const MOUSE_SENS = 0.0025;
const STICK_LOOK = 3.0;
const PITCH_LIMIT = 1.15;

/**
 * Eyes of the boy. Walk on the ground and look around.
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
    this._frames = 0;
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

    const move = this.input.getMoveAxes();
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const vx = (sin * move.y + cos * move.x) * MOVE_SPEED;
    const vz = (cos * move.y - sin * move.x) * MOVE_SPEED;
    body.setLinearVelocity(new Vector3(vx, currentVel.y, vz));
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
}
