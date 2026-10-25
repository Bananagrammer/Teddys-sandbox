import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";
import { SPAWN } from "../world/townLayout.js";

const CAPSULE_HEIGHT = 1.6;
const CAPSULE_RADIUS = 0.28;

/**
 * First-person boy. The physics capsule is the body that walks.
 * The visible torso and legs sit below the camera; the hands are
 * attached in front of the eyes by PlayerController.
 */
export class Boy {
  constructor(scene) {
    this.scene = scene;
    this.root = null;
    this.handsRoot = null;
    this.capsuleMesh = null;
    this.physicsBody = null;
    this.halfHeight = CAPSULE_HEIGHT / 2;
    this.eyeAboveCenter = 0.58;
    this._skin = null;
    this._shirt = null;
  }

  build() {
    this.capsuleMesh = MeshBuilder.CreateCapsule("boyCapsule", {
      height: CAPSULE_HEIGHT,
      radius: CAPSULE_RADIUS,
      tessellation: 8,
    }, this.scene);
    this.capsuleMesh.isVisible = false;
    // Feet rest on the ground (y = 0). South of the well, already in the plaza, facing it.
    this.capsuleMesh.position = new Vector3(SPAWN.x, this.halfHeight, SPAWN.z);

    this.physicsBody = new PhysicsAggregate(
      this.capsuleMesh,
      PhysicsShapeType.CAPSULE,
      { mass: 45, restitution: 0, friction: 0 },
      this.scene
    );
    this.physicsBody.body.setMassProperties({
      inertia: new Vector3(0, 0, 0),
      inertiaOrientation: Quaternion.Identity(),
    });

    this.root = new TransformNode("boyRoot", this.scene);
    this._skin = this._mat("boySkin", 0.86, 0.67, 0.5, 0.08);
    this._shirt = this._mat("boyShirt", 0.22, 0.38, 0.66, 0.04);
    const pants = this._mat("boyPants", 0.29, 0.27, 0.25, 0.03);
    const shoes = this._mat("boyShoes", 0.15, 0.12, 0.1, 0.04);

    this._box("hip", 0.34, 0.18, 0.18, 0, 0.72, 0, pants);
    this._box("torso", 0.36, 0.42, 0.2, 0, 1.02, 0, this._shirt);

    for (const [side, x] of [["L", -0.1], ["R", 0.1]]) {
      const leg = MeshBuilder.CreateCylinder(`leg${side}`, {
        height: 0.46,
        diameter: 0.12,
        tessellation: 8,
      }, this.scene);
      leg.parent = this.root;
      leg.position.set(x, 0.3, 0);
      leg.material = pants;

      this._box(`shoe${side}`, 0.12, 0.06, 0.22, x, 0.04, 0.04, shoes);
    }

    this._castShadows(this.root);
  }

  /** Simple forearms and hands that stay in front of the camera. */
  attachHands() {
    this.handsRoot = new TransformNode("handsRoot", this.scene);

    for (const [side, x] of [["L", -1], ["R", 1]]) {
      const forearm = MeshBuilder.CreateCylinder(`forearm${side}`, {
        height: 0.16,
        diameter: 0.046,
        tessellation: 8,
      }, this.scene);
      forearm.parent = this.handsRoot;
      forearm.position.set(x * 0.24, -0.32, 0.46);
      forearm.rotation.x = 1.15;
      forearm.rotation.z = x * -0.55;
      forearm.material = this._shirt;

      const hand = MeshBuilder.CreateSphere(`hand${side}`, {
        diameter: 0.058,
        segments: 8,
      }, this.scene);
      hand.parent = this.handsRoot;
      // Distal end of the tilted sleeve (local +Y), a little farther along the view
      // so the hand sits in front of the forearm instead of underneath it.
      hand.position.set(x * 0.303, -0.278, 0.553);
      hand.scaling.set(1.05, 0.75, 1.15);
      hand.material = this._skin;
    }

    this._castShadows(this.handsRoot);
  }

  _castShadows(node) {
    const generator = this.scene._shadowGenerator;
    if (!generator) return;
    for (const mesh of node.getChildMeshes()) generator.addShadowCaster(mesh);
  }

  _box(name, w, h, d, x, y, z, mat, parent = this.root) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
    mesh.parent = parent;
    mesh.position.set(x, y, z);
    mesh.material = mat;
    return mesh;
  }

  _mat(name, r, g, b, spec) {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = new Color3(r, g, b);
    mat.specularColor = new Color3(spec, spec, spec);
    return mat;
  }
}
