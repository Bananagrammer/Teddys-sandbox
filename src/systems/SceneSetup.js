import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";

export class SceneSetup {
  static init(scene) {
    // Daylight sky so the town reads clearly
    scene.clearColor = new Color4(0.62, 0.78, 0.92, 1.0);

    // Ambient fill light — prevents completely black shadows
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.55;
    hemi.diffuse = new Color3(0.85, 0.88, 0.95);
    hemi.groundColor = new Color3(0.22, 0.24, 0.16);

    // Directional sun light — casts shadows
    const sun = new DirectionalLight("sun", new Vector3(-0.6, -1.4, -0.4).normalize(), scene);
    sun.intensity = 1.25;
    sun.diffuse = new Color3(1.0, 0.96, 0.88);
    sun.position = new Vector3(40, 80, 30);

    // Shadow generator attached to sun
    const shadowGen = new ShadowGenerator(2048, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 8;
    // Store on scene so world/entity builders can self-register
    scene._shadowGenerator = shadowGen;

    // Light fog so the far edge of the town softens without hiding the streets
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.62, 0.78, 0.92);
    scene.fogDensity = 0.008;
  }
}
