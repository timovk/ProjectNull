import * as THREE from 'three';

const EYE_HEIGHT = 1.65;
const RADIUS = 0.3;
const WALK_SPEED = 2.7;

/**
 * First-person controller with pointer lock. If pointer lock is unavailable
 * (some embedded browsers) it falls back to drag-to-look.
 * Collision is circle-vs-AABB against the facility's collider list.
 */
export class PlayerController {
  constructor(camera, element, settings, colliders) {
    this.camera = camera;
    this.element = element;
    this.settings = settings;
    this.colliders = colliders;
    this.position = new THREE.Vector3(0, 0, 0.6);
    this.yaw = 0;
    this.pitch = 0;
    this.enabled = false;
    this.keys = new Set();
    this.walking = false;
    this.bobPhase = 0;
    this.stepDistance = 0;
    this.onStep = null;
    this.dragging = false;
    this.override = null; // { position, target, k } camera override (workstation view)
    this._dir = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._camPos = new THREE.Vector3();

    this.onMouseMove = (e) => {
      if (!this.enabled || this.override) return;
      const locked = document.pointerLockElement === this.element;
      if (!locked && !this.dragging) return;
      const sens = this.settings.get('mouseSensitivity') * 0.0022;
      const inv = this.settings.get('invertY') ? -1 : 1;
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens * inv;
      this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
    };
    this.onKeyDown = (e) => this.keys.add(e.code);
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onMouseDown = (e) => {
      if (e.button === 0) this.dragging = true;
    };
    this.onMouseUp = () => {
      this.dragging = false;
    };
    this.onBlur = () => this.keys.clear();
    document.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    element.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onBlur);
  }

  reset(position = new THREE.Vector3(0, 0, 0.6), yaw = 0) {
    this.position.copy(position);
    this.yaw = yaw;
    this.pitch = -0.05;
    this.keys.clear();
    this.override = null;
    this.walking = false;
  }

  requestLock() {
    try {
      const p = this.element.requestPointerLock?.();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      /* drag-to-look fallback */
    }
  }

  releaseLock() {
    if (document.pointerLockElement === this.element) document.exitPointerLock?.();
  }

  get isLocked() {
    return document.pointerLockElement === this.element;
  }

  get zone() {
    const { x, z } = this.position;
    if (z <= 3.5) return 'STATION';
    if (x > 3.4) return 'ELECTRICAL';
    return 'MAINTENANCE';
  }

  update(dt, movementScale = 1) {
    const k = this.keys;
    let fx = 0;
    let fz = 0;
    if (this.enabled && !this.override) {
      if (k.has('KeyW') || k.has('ArrowUp')) fz -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fz += 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
    }
    const len = Math.hypot(fx, fz);
    this.walking = len > 0 && movementScale > 0.05;
    if (this.walking) {
      fx /= len;
      fz /= len;
      const speed = WALK_SPEED * movementScale * (k.has('ShiftLeft') || k.has('ShiftRight') ? 0.55 : 1);
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      const dx = (fx * cos + fz * sin) * speed * dt;
      const dz = (-fx * sin + fz * cos) * speed * dt;
      const before = this.position.clone();
      this.moveAxis(dx, 0);
      this.moveAxis(0, dz);
      const moved = before.distanceTo(this.position);
      this.stepDistance += moved;
      if (this.stepDistance > 0.75) {
        this.stepDistance = 0;
        this.onStep?.(this.position);
      }
      if (moved > 0.0001) this.bobPhase += dt * 8.5;
    }
    this.applyCamera(dt);
  }

  moveAxis(dx, dz) {
    const p = this.position;
    p.x += dx;
    p.z += dz;
    for (const c of this.colliders) {
      if (!c.enabled) continue;
      const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
      const ddx = p.x - cx;
      const ddz = p.z - cz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < RADIUS * RADIUS) {
        if (d2 > 1e-9) {
          const d = Math.sqrt(d2);
          p.x = cx + (ddx / d) * RADIUS;
          p.z = cz + (ddz / d) * RADIUS;
        } else {
          // Center inside the box: push out along the movement axis.
          if (dx) p.x = dx > 0 ? c.minX - RADIUS : c.maxX + RADIUS;
          if (dz) p.z = dz > 0 ? c.minZ - RADIUS : c.maxZ + RADIUS;
        }
      }
    }
  }

  applyCamera(dt) {
    const cam = this.camera;
    const bobAmp = this.settings.get('reducedMotion') ? 0 : 0.025;
    const bob = this.walking ? Math.sin(this.bobPhase) * bobAmp : 0;
    this._camPos.set(this.position.x, EYE_HEIGHT + bob, this.position.z);
    const yaw = this.yaw;
    const pitch = this.pitch;
    this._dir.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
    this._look.copy(this._camPos).add(this._dir);
    if (this.override) {
      const o = this.override;
      const rate = this.settings.get('reducedMotion') ? 1 : Math.min(1, dt * 7);
      const goal = o.active ? 1 : 0;
      o.k += (goal - o.k) * rate;
      o.k = Math.max(0, Math.min(1, o.k));
      this._camPos.lerp(o.position, o.k);
      this._look.lerp(o.target, o.k);
      if (!o.active && o.k < 0.01) this.override = null;
    }
    cam.position.copy(this._camPos);
    cam.lookAt(this._look);
  }

  /** Smoothly moves the view to a fixed point (sitting at the workstation). */
  focus(position, target) {
    this.override = { position: position.clone(), target: target.clone(), k: this.override?.k ?? 0, active: true };
  }

  unfocus() {
    if (this.override) this.override.active = false;
  }

  dispose() {
    document.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.element.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
