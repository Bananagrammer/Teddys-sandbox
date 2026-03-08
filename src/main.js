import { Engine } from "@babylonjs/core/Engines/engine";
import { Game } from "./Game.js";

async function main() {
  const canvas = document.getElementById("renderCanvas");
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
    antialias: true
  });

  window.addEventListener("resize", () => engine.resize());

  const game = new Game(engine, canvas);
  await game.start();
}

main().catch(console.error);
