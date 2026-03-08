import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";
import { BattleAxe } from "./BattleAxe.js";
import { Shield } from "./Shield.js";

export class OrcCharacter {
  constructor(scene) {
    this.scene = scene;
    this.root = null;           // visual root — all meshes parented here
    this.capsuleMesh = null;    // invisible physics capsule — drives position
    this.physicsBody = null;    // PhysicsAggregate on capsule
    this.rightHandAnchor = null;
    this.leftHandAnchor = null;
  }

  build() {
    // Invisible physics capsule — this is what Havok moves
    this.capsuleMesh = MeshBuilder.CreateCapsule("orcCapsule", {
      height: 2.4,
      radius: 0.42,
      tessellation: 8
    }, this.scene);
    this.capsuleMesh.isVisible = false;
    this.capsuleMesh.position = new Vector3(0, 1.2, 18); // spawn in front of castle

    this.physicsBody = new PhysicsAggregate(
      this.capsuleMesh,
      PhysicsShapeType.CAPSULE,
      { mass: 80, restitution: 0.0, friction: 0.9 },
      this.scene
    );
    // Zero inertia so orc capsule never tips over from collisions
    this.physicsBody.body.setMassProperties({
      inertia: Vector3.ZeroReadOnly,
      inertiaOrientation: { x: 0, y: 0, z: 0, w: 1 }
    });

    // Visual root — follows capsule position every frame (in PlayerController)
    this.root = new TransformNode("orcRoot", this.scene);

    // Build orc body parts parented to root
    const orcMat = this._makeOrcMaterial();
    const tuskMat = this._makeTuskMaterial();
    const loinMat = this._makeLoinclothMaterial();

    // --- Torso ---
    const torso = MeshBuilder.CreateCylinder("orcTorso", {
      height: 1.3,
      diameterTop: 0.85,
      diameterBottom: 0.95,
      tessellation: 10
    }, this.scene);
    torso.parent = this.root;
    torso.position = new Vector3(0, 0.65, 0);
    torso.material = orcMat;

    // Loincloth / belt detail
    const belt = MeshBuilder.CreateCylinder("orcBelt", {
      height: 0.22,
      diameter: 1.02,
      tessellation: 10
    }, this.scene);
    belt.parent = this.root;
    belt.position = new Vector3(0, 0.11, 0);
    belt.material = loinMat;

    // --- Head ---
    const head = MeshBuilder.CreateSphere("orcHead", {
      diameter: 0.78,
      segments: 8
    }, this.scene);
    head.parent = this.root;
    head.position = new Vector3(0, 1.58, 0);
    head.scaling.y = 0.90; // slightly squashed — orcish
    head.material = orcMat;

    // Brow ridge
    const brow = MeshBuilder.CreateBox("orcBrow", {
      width: 0.55, height: 0.12, depth: 0.22
    }, this.scene);
    brow.parent = this.root;
    brow.position = new Vector3(0, 1.73, 0.28);
    brow.material = orcMat;

    // Left tusk
    const tuskL = MeshBuilder.CreateCylinder("tuskL", {
      height: 0.26, diameterTop: 0.025, diameterBottom: 0.07, tessellation: 6
    }, this.scene);
    tuskL.parent = this.root;
    tuskL.position = new Vector3(-0.14, 1.40, 0.30);
    tuskL.rotation.x = -0.35;
    tuskL.rotation.z = 0.15;
    tuskL.material = tuskMat;

    // Right tusk
    const tuskR = tuskL.clone("tuskR");
    tuskR.parent = this.root;
    tuskR.position = new Vector3(0.14, 1.40, 0.30);
    tuskR.rotation.z = -0.15;

    // Ears (small pointed cylinders)
    for (const [side, x] of [["L", -0.42], ["R", 0.42]]) {
      const ear = MeshBuilder.CreateCylinder(`ear${side}`, {
        height: 0.22, diameterTop: 0.03, diameterBottom: 0.12, tessellation: 6
      }, this.scene);
      ear.parent = this.root;
      ear.position = new Vector3(x, 1.68, 0);
      ear.rotation.z = side === "L" ? -0.5 : 0.5;
      ear.material = orcMat;
    }

    // --- Arms ---
    // Right arm (holds axe)
    const rightShoulder = this._makeArm("right", 1, orcMat);

    // Left arm (holds shield)
    const leftShoulder = this._makeArm("left", -1, orcMat);

    // --- Legs ---
    for (const [side, x] of [["L", -0.27], ["R", 0.27]]) {
      const upperLeg = MeshBuilder.CreateCylinder(`upperLeg${side}`, {
        height: 0.65, diameter: 0.34, tessellation: 8
      }, this.scene);
      upperLeg.parent = this.root;
      upperLeg.position = new Vector3(x, -0.32, 0);
      upperLeg.material = orcMat;

      const lowerLeg = MeshBuilder.CreateCylinder(`lowerLeg${side}`, {
        height: 0.60, diameter: 0.28, tessellation: 8
      }, this.scene);
      lowerLeg.parent = this.root;
      lowerLeg.position = new Vector3(x, -0.92, 0.04);
      lowerLeg.material = orcMat;

      // Foot
      const foot = MeshBuilder.CreateBox(`foot${side}`, {
        width: 0.26, height: 0.14, depth: 0.38
      }, this.scene);
      foot.parent = this.root;
      foot.position = new Vector3(x, -1.22, 0.08);
      foot.material = loinMat;
    }

    // === Weapon anchor nodes ===
    this.rightHandAnchor = new TransformNode("rightHandAnchor", this.scene);
    this.rightHandAnchor.parent = this.root;
    this.rightHandAnchor.position = new Vector3(0.72, 0.10, 0.12);

    this.leftHandAnchor = new TransformNode("leftHandAnchor", this.scene);
    this.leftHandAnchor.parent = this.root;
    this.leftHandAnchor.position = new Vector3(-0.72, 0.10, 0.22);

    // === Attach weapons ===
    const axe = new BattleAxe();
    axe.build(this.rightHandAnchor);

    const shield = new Shield();
    shield.build(this.leftHandAnchor);

    // Register all child meshes as shadow casters
    this.scene._shadowGenerator?.addShadowCaster(this.root, true);
  }

  /** Builds an upper arm + forearm pair. Returns the shoulder TransformNode. */
  _makeArm(side, xSign, mat) {
    const armX = xSign * 0.58;

    const upperArm = MeshBuilder.CreateCylinder(`upperArm_${side}`, {
      height: 0.58, diameter: 0.26, tessellation: 8
    }, this.scene);
    upperArm.parent = this.root;
    upperArm.position = new Vector3(armX, 0.60, 0);
    upperArm.rotation.z = xSign * -0.45; // arms hang slightly outward
    upperArm.material = mat;

    const foreArm = MeshBuilder.CreateCylinder(`foreArm_${side}`, {
      height: 0.52, diameter: 0.22, tessellation: 8
    }, this.scene);
    foreArm.parent = this.root;
    foreArm.position = new Vector3(xSign * 0.78, 0.22, 0.06);
    foreArm.rotation.z = xSign * -0.75;
    foreArm.material = mat;

    return upperArm;
  }

  _makeOrcMaterial() {
    const mat = new StandardMaterial("orcSkinMat", this.scene);
    mat.diffuseColor = new Color3(0.20, 0.44, 0.16); // classic orc green
    mat.specularColor = new Color3(0.08, 0.12, 0.06);
    return mat;
  }

  _makeTuskMaterial() {
    const mat = new StandardMaterial("tuskMat", this.scene);
    mat.diffuseColor = new Color3(0.94, 0.90, 0.82);
    mat.specularColor = new Color3(0.3, 0.3, 0.25);
    mat.specularPower = 40;
    return mat;
  }

  _makeLoinclothMaterial() {
    const mat = new StandardMaterial("loinMat", this.scene);
    mat.diffuseColor = new Color3(0.25, 0.18, 0.10);
    mat.specularColor = new Color3(0.02, 0.02, 0.02);
    return mat;
  }
}
