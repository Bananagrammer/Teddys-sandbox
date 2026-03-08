import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class Terrain {
  constructor(scene) {
    this.scene = scene;
  }

  build() {
    const ground = MeshBuilder.CreateGround("ground", {
      width: 300,
      height: 300,
      subdivisions: 30
    }, this.scene);

    const mat = new StandardMaterial("groundMat", this.scene);
    // Earthy dirt/mud color — no external texture needed
    mat.diffuseColor = new Color3(0.32, 0.26, 0.18);
    mat.specularColor = new Color3(0.05, 0.05, 0.05);
    ground.material = mat;
    ground.receiveShadows = true;

    // Static ground — mass: 0 means it does not move under physics
    new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, this.scene);

    return ground;
  }
}
