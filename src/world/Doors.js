import * as THREE from 'three';
import { radialTexture } from '../render/Textures.js';

/**
 * A sliding security door in the west or east wall of the station.
 * The visual state follows the simulation (closed / damaged / manual hold).
 * Also owns the light that leaks under the door and the shadow that falls
 * across it when something heavy stands on the other side.
 */
export class SecurityDoor {
  constructor(kit, parent, { id, side, x, z, width = 1.7, height = 2.4 }) {
    this.id = id;
    this.side = side;
    this.sign = side === 'WEST' ? -1 : 1;
    this.width = width;
    this.height = height;
    this.openness = 1;
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    parent.add(this.group);

    const m = kit.m;
    const t = 0.12;
    const panel = new THREE.Group();
    this.panel = panel;
    this.group.add(panel);
    const winBottom = 1.45;
    const winTop = 1.85;
    const winHalf = 0.28;
    const sideW = width / 2 - winHalf;
    kit.box(panel, t, winBottom, width, m.door, 0, winBottom / 2, 0, { cast: true, tile: 1.2 });
    kit.box(panel, t, height - winTop, width, m.door, 0, (height + winTop) / 2, 0, { cast: true, tile: 1.2 });
    kit.box(panel, t, winTop - winBottom, sideW, m.door, 0, (winBottom + winTop) / 2, -(winHalf + sideW / 2), { tile: 1.2 });
    kit.box(panel, t, winTop - winBottom, sideW, m.door, 0, (winBottom + winTop) / 2, winHalf + sideW / 2, { tile: 1.2 });
    kit.box(panel, 0.02, winTop - winBottom, winHalf * 2, m.windowGlass, 0, (winBottom + winTop) / 2, 0, { tile: false });
    // Window frame and wire mesh hint.
    kit.box(panel, t + 0.03, 0.04, winHalf * 2 + 0.08, m.metalDark, 0, winBottom, 0, { tile: false });
    kit.box(panel, t + 0.03, 0.04, winHalf * 2 + 0.08, m.metalDark, 0, winTop, 0, { tile: false });
    // Hazard band and a heavy handle bar.
    kit.box(panel, t + 0.01, 0.18, width, m.hazard, 0, 0.12, 0, { tile: false });
    kit.box(panel, t + 0.08, 0.06, 0.5, m.metalDark, 0, 1.1, -0.45, { tile: false });

    // Light leaking under the door (station side) and the shadow of feet.
    const inward = -this.sign * 0.14;
    this.leakMat = new THREE.MeshBasicMaterial({ color: 0xd8c89a, transparent: true, opacity: 0.0, depthWrite: false });
    this.leak = new THREE.Mesh(new THREE.PlaneGeometry(0.22, width - 0.1), this.leakMat);
    this.leak.rotation.x = -Math.PI / 2;
    this.leak.position.set(inward, 0.006, 0);
    this.group.add(this.leak);
    const shadowTex = radialTexture('rgba(0,0,0,1)', 'rgba(0,0,0,0)');
    this.shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false, color: 0x000000 });
    this.shadows = [-0.25, 0.25].map((dz) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.38), this.shadowMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(inward, 0.008, dz);
      this.group.add(s);
      return s;
    });
    this.shadowAmount = 0;
    this.leakLevel = 0;
    this.damagedTilt = 0;
  }

  /**
   * @param closed       simulation says the door blocks the doorway
   * @param damaged      motor forced
   * @param leakLight    0..1 brightness of the approach behind the door
   * @param shadow       0..1 something is standing right behind the door
   */
  update(dt, { closed, damaged, leakLight, shadow, instant = false }) {
    let target = closed ? 0 : 1;
    if (damaged) target = 0.78;
    const speed = 1.7;
    if (instant) this.openness = target;
    else if (this.openness < target) this.openness = Math.min(target, this.openness + speed * dt);
    else if (this.openness > target) this.openness = Math.max(target, this.openness - speed * dt);
    this.panel.position.z = this.openness * (this.width + 0.05);
    this.damagedTilt += ((damaged ? 0.035 : 0) - this.damagedTilt) * Math.min(1, dt * 3);
    this.panel.rotation.x = this.damagedTilt;

    const gapVisible = this.openness < 0.05 ? 1 : 0;
    this.leakLevel += (gapVisible * leakLight - this.leakLevel) * Math.min(1, dt * 4);
    this.leakMat.opacity = 0.55 * this.leakLevel;
    this.shadowAmount += (shadow * gapVisible - this.shadowAmount) * Math.min(1, dt * 1.2);
    this.shadowMat.opacity = 0.85 * this.shadowAmount * Math.min(1, this.leakLevel * 2);
  }

  get isMoving() {
    return this.openness > 0.001 && this.openness < 0.999;
  }
}
