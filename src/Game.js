import { Scene } from "@babylonjs/core/scene";
import { PhysicsSetup } from "./systems/PhysicsSetup.js";
import { SceneSetup } from "./systems/SceneSetup.js";
import { InputManager } from "./systems/InputManager.js";
import { Terrain } from "./world/Terrain.js";
import { Castle } from "./world/Castle.js";
import { OrcCharacter } from "./entities/OrcCharacter.js";
import { PlayerController } from "./controllers/PlayerController.js";

export class Game {
  constructor(engine, canvas) {
    this.engine = engine;
    this.canvas = canvas;
    this.scene = new Scene(engine);
  }

  async start() {
    // Physics MUST initialize before any PhysicsAggregate is created
    await PhysicsSetup.init(this.scene);

    // Lights, fog, shadow generator, sky color
    SceneSetup.init(this.scene);

    // World geometry
    const terrain = new Terrain(this.scene);
    terrain.build();

    const castle = new Castle(this.scene);
    castle.build();

    // Orc player character (mesh + physics capsule + weapon anchors)
    const orc = new OrcCharacter(this.scene);
    orc.build();

    // Input and movement
    const input = new InputManager(this.canvas);
    const controller = new PlayerController(orc, input, this.scene);
    controller.attach();

    // Start the render loop
    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
}
