import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Scene } from "@babylonjs/core/scene";

export class SceneSetup {
  static init(scene) {
    // Overcast sky color
    scene.clearColor = new Color4(0.28, 0.32, 0.38, 1.0);

    // Ambient fill light — prevents completely black shadows
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity = 0.35;
    hemi.diffuse = new Color3(0.7, 0.65, 0.6);
    hemi.groundColor = new Color3(0.12, 0.10, 0.08);

    // Directional sun light — casts shadows
    const sun = new DirectionalLight("sun", new Vector3(-1, -2, -1).normalize(), scene);
    sun.intensity = 1.1;
    sun.diffuse = new Color3(1.0, 0.95, 0.85);
    sun.position = new Vector3(60, 100, 60);

    // Shadow generator attached to sun
    const shadowGen = new ShadowGenerator(2048, sun);
    shadowGen.useBlurExponentialShadowMap = true;
    shadowGen.blurKernel = 8;
    // Store on scene so world/entity builders can self-register
    scene._shadowGenerator = shadowGen;

    // Atmospheric fog — hides far draw distance, adds mood
    scene.fogMode = Scene.FOGMODE_EXP2;
    scene.fogColor = new Color3(0.28, 0.32, 0.38);
    scene.fogDensity = 0.010;
  }
}
