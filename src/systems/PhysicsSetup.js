import "@babylonjs/core/Physics/joinedPhysicsEngineComponent";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import HavokPhysics from "@babylonjs/havok";
// Deep import: the package exports map does not expose the wasm file.
import havokWasmUrl from "../../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";

export class PhysicsSetup {
  static async init(scene) {
    // Vite rewrites the Havok glue script, so the wasm file has to be located explicitly.
    const havokInstance = await HavokPhysics({
      locateFile: (file) => (file.endsWith(".wasm") ? havokWasmUrl : file),
    });
    const plugin = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.81, 0), plugin);
  }
}
