import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Ray } from "@babylonjs/core/Culling/ray";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";

const MOVE_SPEED     = 8;       // units per second on ground
const JUMP_VELOCITY  = 7.5;     // upward impulse on jump
const MOUSE_SENS     = 0.0020;  // radians per pixel
const CAMERA_DIST    = 7;       // follow distance behind player
const CAMERA_HEIGHT  = 3.2;     // height above capsule centre
const MIN_PITCH      = -0.35;   // look down limit (radians)
const MAX_PITCH       = 0.65;   // look up limit

export class PlayerController {
  constructor(orc, input, scene) {
    this.orc   = orc;
    this.input = input;
    this.scene = scene;

    this.yaw   = 0;   // horizontal look angle (radians)
    this.pitch = 0.2; // vertical look angle (starts slightly down)
    this.isGrounded = false;
  }

  attach() {
    // Third-person camera using UniversalCamera positioned behind the orc
    this.camera = new UniversalCamera("playerCam", Vector3.Zero(), this.scene);
    this.scene.activeCamera = this.camera;

    // Run the update every frame before the scene renders
    this.scene.registerBeforeRender(() => this._update());
  }

  _update() {
    const { dx, dy } = this.input.consumeMouseDelta();

    // === Mouse look ===
    this.yaw   += dx * MOUSE_SENS;
    this.pitch  = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch + dy * MOUSE_SENS));

    // === Ground check — short downward ray from capsule centre ===
    const capsulePos = this.orc.capsuleMesh.getAbsolutePosition();
    const groundRay  = new Ray(capsulePos, Vector3.Down(), 1.45);
    const hit = this.scene.pickWithRay(groundRay, mesh =>
      mesh !== this.orc.capsuleMesh &&
      !mesh.name.startsWith("orc") &&
      !mesh.name.startsWith("axe") &&
      !mesh.name.startsWith("shield") &&
      !mesh.name.startsWith("tusk") &&
      !mesh.name.startsWith("ear") &&
      mesh.isVisible
    );
    this.isGrounded = !!(hit && hit.hit && hit.distance < 1.45);

    // === WASD movement ===
    const physBody = this.orc.physicsBody.body;
    const currentVel = physBody.getLinearVelocity();

    let moveX = 0;
    let moveZ = 0;
    if (this.input.isDown("KeyW")) moveZ =  1;
    if (this.input.isDown("KeyS")) moveZ = -1;
    if (this.input.isDown("KeyA")) moveX = -1;
    if (this.input.isDown("KeyD")) moveX =  1;

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) { moveX /= len; moveZ /= len; }

    // Rotate move direction by yaw so WASD is relative to camera facing
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const worldX =  moveX * cosY + moveZ * sinY;
    const worldZ = -moveX * sinY + moveZ * cosY;

    // Apply velocity — preserve vertical (gravity) component
    const targetVelX = worldX * MOVE_SPEED;
    const targetVelZ = worldZ * MOVE_SPEED;
    physBody.setLinearVelocity(new Vector3(targetVelX, currentVel.y, targetVelZ));

    // === Jump ===
    if (this.input.isDown("Space") && this.isGrounded) {
      physBody.setLinearVelocity(new Vector3(targetVelX, JUMP_VELOCITY, targetVelZ));
    }

    // === Rotate visual orc root to face direction of travel ===
    this.orc.root.rotation.y = this.yaw;

    // === Sync visual root to physics capsule ===
    // Offset downward so the feet of the visual mesh sit at ground level
    this.orc.root.position.x = capsulePos.x;
    this.orc.root.position.y = capsulePos.y - 1.15;
    this.orc.root.position.z = capsulePos.z;

    // === Position camera behind and above the orc ===
    // Camera swings on a boom behind the character based on yaw + pitch
    const camX = capsulePos.x - Math.sin(this.yaw) * CAMERA_DIST;
    const camY = capsulePos.y + CAMERA_HEIGHT + this.pitch * 2;
    const camZ = capsulePos.z - Math.cos(this.yaw) * CAMERA_DIST;

    // Smooth lerp so camera doesn't snap
    this.camera.position = Vector3.Lerp(this.camera.position, new Vector3(camX, camY, camZ), 0.18);

    // Always look at a point slightly above the orc's centre (head level)
    const lookAt = new Vector3(capsulePos.x, capsulePos.y + 0.5, capsulePos.z);
    this.camera.setTarget(lookAt);
  }
}
