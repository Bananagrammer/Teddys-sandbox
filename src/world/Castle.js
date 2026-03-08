import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { PhysicsAggregate, PhysicsShapeType } from "@babylonjs/core/Physics/v2";

export class Castle {
  constructor(scene) {
    this.scene = scene;
    this._stoneMat = null;
    this._darkStoneMat = null;
  }

  build() {
    this._stoneMat = this._makeMaterial("stoneMat", new Color3(0.48, 0.43, 0.36));
    this._darkStoneMat = this._makeMaterial("darkStoneMat", new Color3(0.32, 0.28, 0.22));

    // Castle is offset from origin so the player spawns outside it
    const cx = 0;
    const cz = -45;

    // === Outer walls (with deliberate gap on south face for "collapse") ===
    this._wall("wall_north", cx,        cz - 28, 58, 7, 2.5);
    this._wall("wall_east",  cx + 28,   cz,      2.5, 7, 56);
    this._wall("wall_west",  cx - 28,   cz,      2.5, 7, 56);
    // South wall — split in two with a gap to show crumbling
    this._wall("wall_south_L", cx - 14, cz + 28, 26, 5, 2.5);
    this._wall("wall_south_R", cx + 14, cz + 28, 22, 3, 2.5); // shorter — partially fallen

    // === Corner towers ===
    this._tower("tower_NE", cx + 28,  cz - 28);
    this._tower("tower_NW", cx - 28,  cz - 28);
    this._tower("tower_SE", cx + 28,  cz + 28);
    this._tower("tower_SW", cx - 28,  cz + 28);

    // === Battlements on north wall ===
    this._battlements("batt_north", cx, cz - 28, 58);

    // === Interior ruins — a partial inner keep ===
    this._wall("keep_N",  cx,        cz - 8,  24, 8, 2.5);
    this._wall("keep_W",  cx - 10,   cz,      2.5, 8, 16);
    // Keep doorway arch effect — two pillars with a gap
    this._wall("keep_E_L", cx + 10,  cz - 4,  2.5, 8, 8);
    this._wall("keep_E_R", cx + 10,  cz + 6,  2.5, 5, 4); // broken/shorter

    // === Rubble piles — collapsed sections ===
    this._rubble(cx + 14, cz + 28,  20); // near south-right gap
    this._rubble(cx,      cz + 28,   8); // scattered center
    this._rubble(cx + 10, cz,       10); // inside courtyard corner
  }

  _wall(name, x, z, w, h, d) {
    const mesh = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, this.scene);
    mesh.position.set(x, h / 2, z);
    mesh.material = this._stoneMat;
    mesh.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(mesh);
    new PhysicsAggregate(mesh, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    return mesh;
  }

  _tower(name, x, z) {
    const height = 16;
    const tower = MeshBuilder.CreateCylinder(name, {
      height,
      diameter: 10,
      tessellation: 10
    }, this.scene);
    tower.position.set(x, height / 2, z);
    tower.material = this._stoneMat;
    tower.receiveShadows = true;
    this.scene._shadowGenerator?.addShadowCaster(tower);
    new PhysicsAggregate(tower, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);

    // Broken-top detail: add irregular cap stones
    for (let i = 0; i < 5; i++) {
      const capSize = 0.8 + Math.random() * 1.2;
      const cap = MeshBuilder.CreateBox(`${name}_cap_${i}`, {
        width: capSize, height: capSize * 0.6, depth: capSize
      }, this.scene);
      const angle = (i / 5) * Math.PI * 2;
      cap.position.set(
        x + Math.cos(angle) * 3.5,
        height + capSize * 0.3 + Math.random() * 0.5,
        z + Math.sin(angle) * 3.5
      );
      cap.rotation.y = Math.random() * Math.PI;
      cap.rotation.z = (Math.random() - 0.5) * 0.5;
      cap.material = this._darkStoneMat;
      cap.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(cap);
      new PhysicsAggregate(cap, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    }
  }

  _battlements(name, x, z, wallWidth) {
    const merlonW = 1.4;
    const merlonH = 1.2;
    const gapW = 1.2;
    const step = merlonW + gapW;
    const count = Math.floor(wallWidth / step);
    const startX = x - (count * step) / 2 + merlonW / 2;
    const wallH = 7;

    for (let i = 0; i < count; i++) {
      // Randomly skip ~20% of merlons for crumbling effect
      if (Math.random() < 0.2) continue;
      const merlon = MeshBuilder.CreateBox(`${name}_m${i}`, {
        width: merlonW, height: merlonH, depth: 2.0
      }, this.scene);
      merlon.position.set(startX + i * step, wallH + merlonH / 2, z);
      merlon.material = this._stoneMat;
      merlon.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(merlon);
      new PhysicsAggregate(merlon, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    }
  }

  _rubble(cx, cz, count) {
    for (let i = 0; i < count; i++) {
      const w = 0.4 + Math.random() * 1.8;
      const h = w * (0.3 + Math.random() * 0.4);
      const d = 0.4 + Math.random() * 1.6;
      const block = MeshBuilder.CreateBox(`rubble_${cx}_${cz}_${i}`, {
        width: w, height: h, depth: d
      }, this.scene);
      block.position.set(
        cx + (Math.random() - 0.5) * 12,
        h / 2 + Math.random() * 0.3,
        cz + (Math.random() - 0.5) * 8
      );
      block.rotation.set(
        (Math.random() - 0.5) * 0.5,
        Math.random() * Math.PI,
        (Math.random() - 0.5) * 0.5
      );
      block.material = Math.random() < 0.3 ? this._darkStoneMat : this._stoneMat;
      block.receiveShadows = true;
      this.scene._shadowGenerator?.addShadowCaster(block);
      new PhysicsAggregate(block, PhysicsShapeType.BOX, { mass: 0 }, this.scene);
    }
  }

  _makeMaterial(name, color) {
    const mat = new StandardMaterial(name, this.scene);
    mat.diffuseColor = color;
    mat.specularColor = new Color3(0.06, 0.06, 0.06);
    return mat;
  }
}
