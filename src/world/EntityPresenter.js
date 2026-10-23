import * as THREE from 'three';
import { ENTITY_ORDER, ENTITY_IDS } from '../config/GameConfig.js';
import { createWanderer, createObserver, createEcho, createPatient, animateModel, setModelOpacity } from './EntityModels.js';

const FACTORIES = {
  [ENTITY_IDS.WANDERER]: createWanderer,
  [ENTITY_IDS.OBSERVER]: createObserver,
  [ENTITY_IDS.ECHO]: createEcho,
  [ENTITY_IDS.PATIENT]: createPatient
};

const WALK_SPEED = {
  [ENTITY_IDS.WANDERER]: 0.9,
  [ENTITY_IDS.OBSERVER]: 0.7,
  [ENTITY_IDS.ECHO]: 1.4,
  [ENTITY_IDS.PATIENT]: 0.45
};

/**
 * Places entity models wherever the simulation says they are.
 *
 * Nothing here decides anything: it reads `entity.currentRoom` every frame.
 * Remote rooms are only seen through cameras, so models are placed there
 * instantly (a camera signal disruption covers the change). The approach
 * rooms are directly visible from the station, so arrivals there are walked
 * in slowly from the dark corridor and faded in. No sudden appearances.
 */
export class EntityPresenter {
  constructor(facility, settings) {
    this.facility = facility;
    this.settings = settings;
    this.parking = new THREE.Group(); // detached models live here (never rendered)
    this.views = new Map();
    ENTITY_ORDER.forEach((id, index) => {
      const model = FACTORIES[id]();
      model.name = id;
      this.parking.add(model);
      this.views.set(id, { id, index, model, room: null, phase: 'IDLE', from: null, to: null, t: 0, duration: 1, opacity: 1, headYaw: 0, breach: false });
    });
    this.tmpA = new THREE.Vector3();
    this.tmpB = new THREE.Vector3();
  }

  reset() {
    for (const v of this.views.values()) {
      v.room = null;
      v.phase = 'IDLE';
      v.breach = false;
      v.opacity = 1;
      v.headYaw = 0;
      setModelOpacity(v.model, 1);
      this.parking.add(v.model);
    }
  }

  roomDesc(roomId) {
    return this.facility.rooms[roomId] ?? null;
  }

  update(sim, dt, time) {
    for (const e of sim.ai.entities) {
      const v = this.views.get(e.id);
      if (v.room !== e.currentRoom) this.changeRoom(v, v.room, e.currentRoom, e);
      this.advance(v, dt);
      animateModel(v.model, time + v.index * 3.7, {
        reducedMotion: this.settings.get('reducedMotion'),
        reducedDistortion: this.settings.get('reducedDistortion'),
        agitation: e.agitation ?? 0
      });
      if (e.id === ENTITY_IDS.OBSERVER) this.updateObserverHead(v, e, dt);
    }
  }

  changeRoom(v, fromId, toId, entity) {
    v.room = toId;
    const from = fromId ? this.roomDesc(fromId) : null;
    const to = this.roomDesc(toId);
    const anchor = to?.anchors?.[v.index];

    // Leaving a directly visible approach: walk back into the dark first.
    if (from?.main && (!to || !to.main)) {
      v.phase = 'EXIT';
      v.from = v.model.position.clone();
      v.to = from.entry.clone();
      v.t = 0;
      v.duration = Math.min(6, Math.max(1.5, v.from.distanceTo(v.to) / WALK_SPEED[v.id]));
      v.next = to && anchor ? { scene: to.scene, anchor } : null;
      faceTowards(v.model, v.to);
      return;
    }

    if (!to || !anchor) {
      // Vent duct / station: not visible as a model (the station is handled by the failure sequence).
      v.phase = 'HIDDEN';
      this.parking.add(v.model);
      return;
    }

    if (to.main) {
      to.scene.add(v.model);
      v.phase = 'ENTER';
      v.from = to.entry.clone();
      v.to = anchor.pos.clone();
      v.t = 0;
      v.duration = Math.min(8, Math.max(2.5, v.from.distanceTo(v.to) / WALK_SPEED[v.id]));
      v.anchorFacing = anchor.facing;
      v.model.position.copy(v.from);
      faceTowards(v.model, v.to);
      v.opacity = 0;
      setModelOpacity(v.model, 0);
      return;
    }

    to.scene.add(v.model);
    v.model.position.copy(anchor.pos);
    v.model.rotation.set(0, anchor.facing, 0);
    v.phase = 'PLACED';
    v.opacity = 1;
    setModelOpacity(v.model, 1);
    void entity;
  }

  advance(v, dt) {
    if (v.phase === 'ENTER' || v.phase === 'EXIT') {
      v.t = Math.min(1, v.t + dt / v.duration);
      const k = smooth(v.t);
      v.model.position.lerpVectors(v.from, v.to, k);
      v.model.position.y = Math.abs(Math.sin(v.t * v.duration * 3.0)) * (v.id === ENTITY_IDS.PATIENT ? 0.01 : 0.03);
      if (v.phase === 'ENTER') {
        v.opacity = Math.min(1, v.t * 2.2);
        if (v.t > 0.85) v.model.rotation.y = lerpAngle(v.model.rotation.y, v.anchorFacing, Math.min(1, dt * 2));
      } else {
        v.opacity = Math.max(0, 1 - Math.max(0, v.t - 0.4) / 0.6);
      }
      setModelOpacity(v.model, v.opacity);
      if (v.t >= 1) {
        if (v.phase === 'ENTER') {
          v.phase = 'PLACED';
          v.model.position.y = 0;
        } else if (v.next) {
          v.next.scene.add(v.model);
          v.model.position.copy(v.next.anchor.pos);
          v.model.rotation.set(0, v.next.anchor.facing, 0);
          v.phase = 'PLACED';
          v.opacity = 1;
          setModelOpacity(v.model, 1);
        } else {
          v.phase = 'HIDDEN';
          this.parking.add(v.model);
        }
      }
    } else if (v.phase === 'PLACED' && v.model.parent && this.roomDesc(v.room)?.main) {
      v.model.rotation.y = lerpAngle(v.model.rotation.y, this.roomDesc(v.room).anchors[v.index].facing, Math.min(1, dt * 1.5));
    }
  }

  /** The Observer's head slowly turns toward the camera watching it. */
  updateObserverHead(v, e, dt) {
    const head = v.model.userData.head;
    const room = this.roomDesc(v.room);
    let target = -0.9; // looking away and down
    let pitch = 0.35;
    if (room && e.facingCamera) {
      const camPos = this.tmpA.copy(room.camera.position);
      const local = v.model.worldToLocal(camPos);
      target = Math.max(-1.3, Math.min(1.3, Math.atan2(local.x, local.z)));
      pitch = -0.1;
    }
    const rate = this.settings.get('reducedMotion') ? 0.25 : 0.45;
    v.headYaw += (target - v.headYaw) * Math.min(1, dt * rate);
    head.rotation.y = v.headYaw;
    head.rotation.x += (pitch - head.rotation.x) * Math.min(1, dt * rate);
  }

  /**
   * Breach staging: the entity stands just inside the doorway it came through,
   * far enough away and in fading light. Echo (via the vent) is not shown.
   */
  stageBreach(entityId, via) {
    const v = this.views.get(entityId);
    if (!v) return null;
    v.room = 'SECURITY_STATION'; // already inside: no exit walk
    if (via === 'VENT' || via === 'HIDDEN') {
      v.phase = 'HIDDEN';
      this.parking.add(v.model);
      return null;
    }
    const s = via === 'WEST_DOOR' ? -1 : 1;
    this.facility.scene.add(v.model);
    v.phase = 'BREACH';
    v.from = new THREE.Vector3(s * 5.6, 0, -0.5);
    v.to = new THREE.Vector3(s * 4.6, 0, -0.5);
    v.model.position.copy(v.from);
    v.model.rotation.set(0, -s * Math.PI / 2, 0);
    v.opacity = 1;
    setModelOpacity(v.model, 1);
    return v;
  }

  updateBreach(entityId, k) {
    const v = this.views.get(entityId);
    if (!v || v.phase !== 'BREACH') return;
    v.model.position.lerpVectors(v.from, v.to, smooth(Math.min(1, k)));
  }

  /** Brightness behind each door from what stands there (for the leak/shadow). */
  doorPresence(sim) {
    const result = { WEST: { shadow: 0, any: false }, EAST: { shadow: 0, any: false } };
    for (const e of sim.ai.entities) {
      const side = e.currentRoom === 'WEST_APPROACH' ? 'WEST' : e.currentRoom === 'EAST_APPROACH' ? 'EAST' : null;
      if (!side) continue;
      const v = this.views.get(e.id);
      result[side].any = true;
      if (e.id === ENTITY_IDS.PATIENT && v.phase === 'PLACED') result[side].shadow = 1;
    }
    return result;
  }
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function faceTowards(obj, target) {
  obj.rotation.set(0, Math.atan2(target.x - obj.position.x, target.z - obj.position.z), 0);
}

function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
