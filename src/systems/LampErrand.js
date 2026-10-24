const REACH = 2.4;

/**
 * The town's game: walk up to each dark street lamp and light it.
 * Keyboard E or Xbox A (standard mapping, button 0).
 */
export class LampErrand {
  constructor(town, boy, input) {
    this.town = town;
    this.boy = boy;
    this.input = input;
    this.done = false;
  }

  get litCount() {
    return this.town.lamps.filter((lamp) => lamp.lit).length;
  }

  attach(scene) {
    this._refresh();
    scene.onBeforeRenderObservable.add(() => this._update());
  }

  _update() {
    const pos = this.boy.capsuleMesh.position;
    let nearest = null;
    let best = REACH;
    for (const lamp of this.town.lamps) {
      if (lamp.lit) continue;
      const distance = Math.hypot(pos.x - lamp.x, pos.z - lamp.z);
      if (distance < best) {
        best = distance;
        nearest = lamp;
      }
    }

    if (nearest && this.input.consumeInteract()) {
      nearest.lightUp();
      this.done = this.town.lamps.every((lamp) => lamp.lit);
    } else if (!nearest) {
      this.input.consumeInteract();
    }

    this._refresh(nearest);
  }

  _refresh(nearest) {
    const goal = document.getElementById("goal");
    const prompt = document.getElementById("prompt");
    const total = this.town.lamps.length;
    const lit = this.litCount;
    if (goal) {
      goal.textContent = this.done
        ? "The streets are lit."
        : `Light the street lamps  ${lit} / ${total}`;
    }
    if (prompt) {
      prompt.textContent = !this.done && nearest ? "E or A: light this lamp" : "";
    }
  }
}
