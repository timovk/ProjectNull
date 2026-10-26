import * as THREE from 'three';

const MAX_DISTANCE = 2.4;

/**
 * Looks along the view centre for interactable hitboxes (occluded by walls)
 * and dispatches E presses to handlers keyed by `interactId`.
 *
 * Handler shape (all optional except prompt):
 *   prompt(data, game)      -> string | null   (null hides the prompt)
 *   press(data, game)                           single press
 *   hold: seconds                               hold-to-complete
 *   complete(data, game)                        after a full hold
 *   holdStart / holdEnd(data, game)             (noise while working etc.)
 *   continuous: true + tick(data, game, dt)     held action (manual door)
 */
export class InteractionSystem {
  constructor(camera, facility, handlers, game) {
    this.camera = camera;
    this.facility = facility;
    this.handlers = handlers;
    this.game = game;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = MAX_DISTANCE;
    this.center = new THREE.Vector2(0, 0);
    this.targets = [...facility.hitboxes, ...facility.occluders];
    this.current = null;
    this.prompt = null;
    this.holding = null; // { data, handler, progress }
    this.ePressed = false;
    this.eDown = false;
    this.enabled = true;
  }

  pressE() {
    this.ePressed = true;
    this.eDown = true;
  }

  releaseE() {
    this.eDown = false;
  }

  cancelHold() {
    if (this.holding) {
      this.holding.handler.holdEnd?.(this.holding.data, this.game, false);
      this.holding = null;
    }
  }

  update(dt) {
    if (!this.enabled) {
      this.cancelHold();
      this.current = null;
      this.prompt = null;
      this.ePressed = false;
      return;
    }
    this.raycaster.setFromCamera(this.center, this.camera);
    const hits = this.raycaster.intersectObjects(this.targets, false);
    let target = null;
    for (const h of hits) {
      if (h.object.userData.disabled) continue; // an item that is not there tonight
      if (h.object.userData.interactId) {
        target = h.object.userData;
        break;
      }
      break; // first hit is a wall: blocked
    }
    // Leaving the target cancels a hold.
    if (this.holding && this.holding.data !== target) this.cancelHold();
    this.current = target;
    const handler = target ? this.handlers[target.interactId] : null;
    this.prompt = handler ? handler.prompt(target, this.game) : null;

    if (handler && this.prompt) {
      if (handler.continuous) {
        if (this.eDown && !this.holding) {
          this.holding = { data: target, handler, progress: 0 };
          handler.holdStart?.(target, this.game);
        }
        if (this.holding && this.eDown) handler.tick?.(target, this.game, dt);
        if (this.holding && !this.eDown) this.cancelHold();
      } else if (handler.hold) {
        if (this.ePressed && !this.holding && (handler.canHold?.(target, this.game) ?? true)) {
          this.holding = { data: target, handler, progress: 0 };
          handler.holdStart?.(target, this.game);
        }
        if (this.holding) {
          if (!this.eDown) this.cancelHold();
          else {
            this.holding.progress += dt / handler.hold;
            if (this.holding.progress >= 1) {
              const h = this.holding;
              this.holding = null;
              h.handler.holdEnd?.(h.data, this.game, true);
              h.handler.complete?.(h.data, this.game);
            }
          }
        }
      } else if (this.ePressed) {
        handler.press?.(target, this.game);
      }
    }
    this.ePressed = false;
  }

  get holdProgress() {
    return this.holding && !this.holding.handler.continuous ? this.holding.progress : 0;
  }
}
