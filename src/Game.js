import { Scene } from "@babylonjs/core/scene";
import { PhysicsSetup } from "./systems/PhysicsSetup.js";
import { SceneSetup } from "./systems/SceneSetup.js";
import { InputManager } from "./systems/InputManager.js";
import { Town } from "./world/Town.js";
import { Boy } from "./entities/Boy.js";
import { PlayerController } from "./controllers/PlayerController.js";

export class Game {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.scene = new Scene(engine);
  }

  async start() {
    await PhysicsSetup.init(this.scene);
    SceneSetup.init(this.scene);

    const town = new Town(this.scene);
    town.build();

    const boy = new Boy(this.scene);
    boy.build();

    const input = new InputManager(this.canvas);
    const controller = new PlayerController(boy, input, this.scene);
    controller.attach();

    if (import.meta.env.DEV) {
      window.__player = {
        get position() {
          const p = boy.capsuleMesh.position;
          return { x: p.x, y: p.y, z: p.z };
        },
        get yaw() { return controller.yaw; },
        get pitch() { return controller.pitch; },
        get look() { return controller.getLookDirection(); },
        get ready() { return controller.ready; },
        get lamps() {
          return town.lamps.map((lamp) => ({
            x: lamp.x,
            z: lamp.z,
            lit: lamp.lit,
            intensity: lamp.light.intensity,
          }));
        },
        get hud() { return document.getElementById("hud")?.textContent ?? ""; },
      };
    }

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
}
