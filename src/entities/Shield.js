import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export class Shield {
  build(parentAnchor) {
    const scene = parentAnchor.getScene();

    const shieldRoot = new TransformNode("shieldRoot", scene);
    shieldRoot.parent = parentAnchor;
    // Face the shield forward and angle it for a guard stance
    shieldRoot.rotation = new Vector3(0.15, Math.PI / 2, 0);

    const woodMat = new StandardMaterial("shieldWoodMat", scene);
    woodMat.diffuseColor = new Color3(0.42, 0.24, 0.07);
    woodMat.specularColor = new Color3(0.04, 0.03, 0.02);

    const ironMat = new StandardMaterial("shieldIronMat", scene);
    ironMat.diffuseColor = new Color3(0.58, 0.58, 0.60);
    ironMat.specularColor = new Color3(0.7, 0.7, 0.7);
    ironMat.specularPower = 48;

    // Shield body — a round disc (flattened cylinder)
    const face = MeshBuilder.CreateCylinder("shieldFace", {
      height: 0.07,
      diameter: 0.78,
      tessellation: 14
    }, scene);
    face.parent = shieldRoot;
    face.rotation.x = Math.PI / 2;
    face.material = woodMat;

    // Iron rim — torus around the edge
    const rim = MeshBuilder.CreateTorus("shieldRim", {
      diameter: 0.78,
      thickness: 0.045,
      tessellation: 22
    }, scene);
    rim.parent = shieldRoot;
    rim.rotation.x = Math.PI / 2;
    rim.material = ironMat;

    // Cross brace — two thin boxes across the face
    for (const rot of [0, Math.PI / 2]) {
      const brace = MeshBuilder.CreateBox(`shieldBrace_${rot}`, {
        width: 0.06,
        height: 0.72,
        depth: 0.03
      }, scene);
      brace.parent = shieldRoot;
      brace.position = new Vector3(0, 0, 0.05);
      brace.rotation.z = rot;
      brace.material = ironMat;
    }

    // Center boss (dome)
    const boss = MeshBuilder.CreateSphere("shieldBoss", {
      diameter: 0.2,
      segments: 6
    }, scene);
    boss.parent = shieldRoot;
    boss.position = new Vector3(0, 0, 0.06);
    boss.scaling.z = 0.5;  // flatten into dome shape
    boss.material = ironMat;

    // Boss rivet/ring
    const bossRing = MeshBuilder.CreateTorus("shieldBossRing", {
      diameter: 0.22,
      thickness: 0.025,
      tessellation: 14
    }, scene);
    bossRing.parent = shieldRoot;
    bossRing.position = new Vector3(0, 0, 0.04);
    bossRing.rotation.x = Math.PI / 2;
    bossRing.material = ironMat;

    return shieldRoot;
  }
}
