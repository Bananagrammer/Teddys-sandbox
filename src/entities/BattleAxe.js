import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export class BattleAxe {
  build(parentAnchor) {
    const scene = parentAnchor.getScene();

    const axeRoot = new TransformNode("axeRoot", scene);
    axeRoot.parent = parentAnchor;
    // Tilt the axe outward slightly and orient the head upward
    axeRoot.rotation = new Vector3(0.1, 0, Math.PI / 10);

    const handleMat = new StandardMaterial("axeHandleMat", scene);
    handleMat.diffuseColor = new Color3(0.38, 0.22, 0.07);
    handleMat.specularColor = new Color3(0.05, 0.03, 0.01);

    const bladeMat = new StandardMaterial("axeBladeMat", scene);
    bladeMat.diffuseColor = new Color3(0.72, 0.72, 0.75);
    bladeMat.specularColor = new Color3(0.95, 0.95, 0.95);
    bladeMat.specularPower = 80;

    // Handle — long thin cylinder (grip at bottom, blade at top)
    const handle = MeshBuilder.CreateCylinder("axeHandle", {
      height: 1.5,
      diameter: 0.07,
      tessellation: 8
    }, scene);
    handle.parent = axeRoot;
    handle.position = new Vector3(0, 0.55, 0);
    handle.material = handleMat;

    // Handle pommel (end cap)
    const pommel = MeshBuilder.CreateSphere("axePommel", { diameter: 0.13, segments: 6 }, scene);
    pommel.parent = axeRoot;
    pommel.position = new Vector3(0, -0.2, 0);
    pommel.material = bladeMat;

    // Axe head collar (where blade meets handle)
    const collar = MeshBuilder.CreateCylinder("axeCollar", {
      height: 0.1,
      diameter: 0.14,
      tessellation: 8
    }, scene);
    collar.parent = axeRoot;
    collar.position = new Vector3(0, 1.1, 0);
    collar.material = bladeMat;

    // Primary blade — wide crescent-like shape via a tapered box
    const blade = MeshBuilder.CreateBox("axeBlade", {
      width: 0.60,
      height: 0.48,
      depth: 0.055
    }, scene);
    blade.parent = axeRoot;
    blade.position = new Vector3(0.22, 1.12, 0);
    blade.rotation.z = Math.PI / 5;  // angled sweep forward
    blade.material = bladeMat;

    // Back spike — smaller wedge on the other side of the handle
    const backSpike = MeshBuilder.CreateBox("axeBackSpike", {
      width: 0.22,
      height: 0.28,
      depth: 0.05
    }, scene);
    backSpike.parent = axeRoot;
    backSpike.position = new Vector3(-0.16, 1.12, 0);
    backSpike.rotation.z = -Math.PI / 8;
    backSpike.material = bladeMat;

    // Top spike
    const topSpike = MeshBuilder.CreateCylinder("axeTopSpike", {
      height: 0.22,
      diameterTop: 0.01,
      diameterBottom: 0.09,
      tessellation: 6
    }, scene);
    topSpike.parent = axeRoot;
    topSpike.position = new Vector3(0, 1.35, 0);
    topSpike.material = bladeMat;

    return axeRoot;
  }
}
