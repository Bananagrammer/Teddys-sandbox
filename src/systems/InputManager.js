export class InputManager {
  constructor(canvas) {
    this._canvas = canvas;
    this.keys = {};
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.pointerLocked = false;

    // Keyboard state
    document.addEventListener("keydown", e => { this.keys[e.code] = true; });
    document.addEventListener("keyup",   e => { this.keys[e.code] = false; });

    // Pointer lock on click — required to capture mouse movement in browser
    canvas.addEventListener("click", () => {
      canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      const hud = document.getElementById("hud");
      if (hud) {
        hud.textContent = this.pointerLocked
          ? "Esc: release mouse  |  WASD: Move  |  Mouse: Look  |  Space: Jump"
          : "Click to capture mouse  |  WASD: Move  |  Mouse: Look  |  Space: Jump";
      }
    });

    // Accumulate mouse delta — consumed and reset each frame
    document.addEventListener("mousemove", e => {
      if (document.pointerLockElement === canvas) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });
  }

  /** Read and clear the accumulated mouse movement since last frame */
  consumeMouseDelta() {
    const dx = this.mouseDeltaX;
    const dy = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return { dx, dy };
  }

  isDown(code) {
    return !!this.keys[code];
  }
}
