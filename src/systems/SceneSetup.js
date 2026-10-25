import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";
import { createSky, skyHorizonColor } from "../graphics/SurfaceTextures.js";

export class SceneSetup {
  static init(scene) {
    const horizon = skyHorizonColor();
    scene.clearColor = new Color4(horizon.r, horizon.g, horizon.b, 1);
    scene.ambientColor = new Color3(0.18, 0.18, 0.2);
    createSky(scene);

    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.42;
    hemi.diffuse = new Color3(0.78, 0.84, 0.95);
    hemi.groundColor = new Color3(0.28, 0.3, 0.2);

    const sun = new DirectionalLight("sun", new Vector3(-0.85, -1.35, 0.35).normalize(), scene);
    sun.intensity = 1.45;
    sun.diffuse = new Color3(1.0, 0.94, 0.82);
    sun.position = new Vector3(-30, 70, 18);
    sun.autoCalcShadowZBounds = true;

    const shadowGen = new ShadowGenerator(1024, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 8;
    shadowGen.bias = 0.005;
    shadowGen.normalBias = 0.04;
    scene._shadowGenerator = shadowGen;

    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = horizon;
    scene.fogDensity = 0.0036;
  }
}
