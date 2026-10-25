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

    this.scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, 0.05);
      if (input.consumeDoor()) {
        const p = boy.capsuleMesh.position;
        town.tryToggleChapelDoor(p.x, p.z);
      }
      town.updateChapelDoor(dt);
    });

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
        get grounded() { return controller.grounded; },
        get velocity() {
          const v = boy.physicsBody.body.getLinearVelocity();
          return v ? { x: v.x, y: v.y, z: v.z } : { x: 0, y: 0, z: 0 };
        },
        get lamps() {
          return town.lamps.map((lamp) => ({
            x: lamp.x,
            z: lamp.z,
            lit: lamp.lit,
            intensity: lamp.light.intensity,
          }));
        },
        get well() {
          return { x: town.wellX, z: town.wellZ };
        },
        get counts() {
          return { buildings: town.buildingCount, trees: town.treeCount };
        },
        get hud() { return document.getElementById("hud")?.textContent ?? ""; },
        get climbing() { return controller.climbing; },
        get ladder() { return controller.ladder; },
        get meshNames() { return boy.scene.meshes.map((mesh) => mesh.name); },
        place(x, y, z) { controller.place(x, y, z); },
        aim(yaw, pitch) {
          controller.yaw = yaw;
          if (typeof pitch === "number") controller.pitch = pitch;
        },
        mesh(name) {
          const mesh = boy.scene.getMeshByName(name);
          if (!mesh) return null;
          return {
            x: mesh.position.x,
            y: mesh.position.y,
            z: mesh.position.z,
            alpha: mesh.material?.alpha ?? null,
          };
        },
        get door() { return this.doorState(town.chapelDoor); },
        get houseDoor() { return this.doorState(town.house48Door); },
        doorState(door) {
          if (!door) return null;
          const p = boy.capsuleMesh.position;
          const q = door.mesh.rotationQuaternion;
          return {
            opened: door.opened,
            opening: door.opening,
            closing: door.closing,
            angle: door.angle,
            facing: door.facing,
            anchorX: door.anchorX,
            anchorZ: door.anchorZ,
            distance: Math.hypot(p.x - door.anchorX, p.z - door.anchorZ),
            meshX: door.mesh.position.x,
            meshY: door.mesh.position.y,
            meshZ: door.mesh.position.z,
            yaw: q ? q.toEulerAngles().y : door.mesh.rotation.y,
          };
        },
      };
    }

    this.engine.runRenderLoop(() => {
      this.scene.render();
    });
  }
}
