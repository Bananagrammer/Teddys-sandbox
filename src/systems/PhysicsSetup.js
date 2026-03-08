import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import HavokPhysics from "@babylonjs/havok";

export class PhysicsSetup {
  static async init(scene) {
    const havokInstance = await HavokPhysics();
    const plugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  }
}
