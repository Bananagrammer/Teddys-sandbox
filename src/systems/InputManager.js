const DEADZONE = 0.18;

/**
 * Keyboard, mouse, and standard-mapping gamepads (Xbox layout).
 * Left stick / WASD walk. Right stick / mouse look.
 * Jump is Xbox A (button 0) or Space, edge-triggered, away from the ladder.
 * Holding A in front of the ladder climbs; that hold is not a jump.
 * Space is never a climb button.
 * The nearest door (chapel or house 48) is Xbox X (button 2) or F, edge-triggered,
 * and only while he is standing next to that door.
 * One press opens the door; the next press closes it. A and Space still jump.
 * Axes follow the W3C standard gamepad mapping:
 * 0 left X, 1 left Y (up is negative), 2 right X, 3 right Y (up is negative).
 * Buttons: 0 is the bottom face button (A on Xbox).
 */
export class InputManager {
  constructor(canvas) {
    this._canvas = canvas;
    this.keys = new Set();
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.pointerLocked = false;
    this._padConnected = false;
    this._spaceHeld = false;
    this._padAHeld = false;
    this._doorHeld = false;

    document.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
    });
    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("click", () => {
      canvas.focus();
      const lock = canvas.requestPointerLock?.();
      if (lock && typeof lock.catch === "function") lock.catch(() => {});
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === canvas;
      this._refreshHud();
    });

    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    window.addEventListener("gamepadconnected", () => this._refreshHud());
    window.addEventListener("gamepaddisconnected", () => this._refreshHud());
    this._refreshHud();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /**
   * Camera-relative move axes. x is strafe (right positive), y is forward.
   * Each component is in [-1, 1], and the vector is clamped to length 1.
   */
  getMoveAxes() {
    this._notePad();

    let x = 0;
    let y = 0;
    if (this.isDown("KeyW") || this.isDown("ArrowUp")) y += 1;
    if (this.isDown("KeyS") || this.isDown("ArrowDown")) y -= 1;
    if (this.isDown("KeyD") || this.isDown("ArrowRight")) x += 1;
    if (this.isDown("KeyA") || this.isDown("ArrowLeft")) x -= 1;

    const pad = this._standardPad();
    if (pad) {
      const left = radialDeadzone(pad.axes[0] || 0, pad.axes[1] || 0, DEADZONE);
      x += left.x;
      y += -left.y;
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  }

  /**
   * Mouse deltas in pixels (consumed) plus right-stick deflection in [-1, 1].
   * Stick Y is positive when the stick is pushed down.
   */
  consumeLook() {
    const mouseX = this.mouseDeltaX;
    const mouseY = this.mouseDeltaY;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    let stickX = 0;
    let stickY = 0;
    const pad = this._standardPad();
    if (pad && pad.axes.length >= 4) {
      const right = radialDeadzone(pad.axes[2] || 0, pad.axes[3] || 0, DEADZONE);
      stickX = right.x;
      stickY = right.y;
    }
    return { mouseX, mouseY, stickX, stickY };
  }

  /**
   * Edge of Space, and edge of Xbox A. Holding either does not keep
   * returning true, so a hop does not chain. The controller drops the A
   * edge while he is in the ladder spot and climbs from isPadAHeld instead.
   */
  consumeJump() {
    const spaceDown = this.isDown("Space");
    const padDown = this._padButton(0);
    const space = spaceDown && !this._spaceHeld;
    const pad = padDown && !this._padAHeld;
    this._spaceHeld = spaceDown;
    this._padAHeld = padDown;
    return { space, pad };
  }

  /** True while Xbox A (button 0) is held. Space does not count. */
  isPadAHeld() {
    return this._padButton(0);
  }

  /**
   * True on the frame F or Xbox X (standard button 2) goes down.
   * Holding either does not keep returning true. A and Space are not this action.
   * Near the chapel or house 48, that edge toggles the nearest door.
   */
  consumeDoor() {
    const down = this.isDown("KeyF") || this._padButton(2);
    const edge = down && !this._doorHeld;
    this._doorHeld = down;
    return edge;
  }

  _padButton(index) {
    const pad = this._standardPad();
    const button = pad?.buttons?.[index];
    if (!button) return false;
    return button.pressed === true || button.value >= 0.5;
  }

  _standardPad() {
    const pads = typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [];
    for (const pad of pads) {
      if (pad && pad.connected && pad.mapping === "standard") return pad;
    }
    return null;
  }

  _notePad() {
    const connected = !!this._standardPad();
    if (connected !== this._padConnected) {
      this._padConnected = connected;
      this._refreshHud();
    }
  }

  _refreshHud() {
    const hud = document.getElementById("hud");
    if (!hud) return;
    const look = this.pointerLocked
      ? "Esc: release mouse"
      : "Click for mouse look";
    const pad = this._padConnected
      ? "Xbox connected — left stick walks, right stick looks, hold A at a ladder to climb, A jumps away from it, X toggles the nearest door"
      : "Xbox: left stick walks, right stick looks, hold A at a ladder to climb, A jumps away from it, X toggles the nearest door";
    hud.textContent = `${look}  |  WASD or arrows: walk  |  Space: jump  |  F: toggle the nearest door  |  Mouse: look  |  ${pad}`;
  }
}

function radialDeadzone(x, y, deadzone) {
  const mag = Math.hypot(x, y);
  if (mag < deadzone || mag === 0) return { x: 0, y: 0 };
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  return { x: (x / mag) * scaled, y: (y / mag) * scaled };
}
