import * as THREE from 'three';
import { Kit } from '../render/Materials.js';
import * as TX from '../render/Textures.js';
import { SecurityDoor } from './Doors.js';
import { buildRemoteRooms } from './RoomBuilder.js';

/**
 * Builds the playable environment (main scene) and the remote rooms that are
 * only seen through cameras (one small scene each).
 *
 * Main scene layout (metres, y up, facility north = -z):
 *   Security station      x -4.5..4.5   z -3.5..3.5
 *   West / East approach  beyond the side doors, visible through door windows
 *   Maintenance corridor  x 1.6..3.4    z 3.5..16   (through the rear doorway)
 *   Electrical room       x 3.4..8.4    z 6.5..12
 *   Pump room (sealed)    seen through a grille in the corridor
 *   Restricted door       end of the maintenance corridor
 */
export class Facility {
  constructor(materials) {
    this.m = materials;
    this.kit = new Kit(materials);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020303);
    this.scene.fog = new THREE.Fog(0x030404, 6, 40);
    this.hitboxes = [];
    this.occluders = [];
    this.refs = {};
    this.lights = {};
    this.rooms = {}; // camera-room descriptors (approaches + remote rooms)
    this.docs = [];
    this.build();
  }

  hit(id, x, y, z, w, h, d, extra = {}) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
    mesh.position.set(x, y, z);
    mesh.visible = false;
    mesh.userData.interactId = id;
    Object.assign(mesh.userData, extra);
    this.scene.add(mesh);
    this.hitboxes.push(mesh);
    return mesh;
  }

  occlude(group) {
    group.traverse((o) => {
      if (o.isMesh) this.occluders.push(o);
    });
    return group;
  }

  build() {
    this.buildStation();
    this.buildApproach('WEST');
    this.buildApproach('EAST');
    this.buildMaintenance();
    this.buildElectrical();
    this.buildPumpRoom();
    this.buildRestrictedDoor();
    Object.assign(this.rooms, buildRemoteRooms(this.m));
    // Player cannot leave the station through the security doorways.
    this.kit.addCollider(-4.75, -4.55, -1.4, 0.4, 'doorway');
    this.kit.addCollider(4.55, 4.75, -1.4, 0.4, 'doorway');
  }

  // ------------------------------------------------------------- station

  buildStation() {
    const { kit, m, scene } = this;
    const station = new THREE.Group();
    station.name = 'station';
    scene.add(station);
    this.occlude(
      kit.room(station, {
        x0: -4.5, x1: 4.5, z0: -3.5, z1: 3.5, h: 3.0,
        wall: m.concreteGreen, floor: m.floor, ceiling: m.ceiling,
        openings: [
          { wall: 'W', from: -1.3, to: 0.3, top: 2.4 },
          { wall: 'E', from: -1.3, to: 0.3, top: 2.4 },
          { wall: 'S', from: 1.9, to: 3.1, top: 2.3 }
        ]
      })
    );
    // Wainscot band, skirting, ceiling beams and pipes.
    for (const [x0, x1, z, rot] of [[-4.34, 4.34, -3.34, 0], [-4.34, 4.34, 3.34, 0]]) {
      kit.box(station, x1 - x0, 0.9, 0.02, m.metalPaint, (x0 + x1) / 2, 0.45, z, { ry: rot });
    }
    kit.box(station, 0.02, 0.9, 1.9, m.metalPaint, -4.34, 0.45, -2.45);
    kit.box(station, 0.02, 0.9, 1.9, m.metalPaint, 4.34, 0.45, -2.45);
    kit.box(station, 0.02, 0.9, 3.0, m.metalPaint, -4.34, 0.45, 1.95);
    kit.box(station, 0.02, 0.9, 3.0, m.metalPaint, 4.34, 0.45, 1.95);
    for (const x of [-3, 0, 3]) kit.box(station, 0.25, 0.3, 7.0, m.concreteDark, x, 2.85, 0);
    kit.pipe(station, [-4.3, 2.65, -3.2], [4.3, 2.65, -3.2], 0.07);
    kit.pipe(station, [-4.3, 2.5, -3.25], [4.3, 2.5, -3.25], 0.04, m.pipeRust);
    kit.pipe(station, [4.2, 2.75, -3.3], [4.2, 2.75, 3.3], 0.06);
    kit.pipe(station, [-4.2, 2.7, -3.3], [-4.2, 2.7, 3.3], 0.05, m.pipeRust);
    // Doorway frames with hazard stripes on the floor.
    for (const s of [-1, 1]) {
      kit.box(station, 0.36, 0.12, 1.9, m.metalDark, s * 4.5, 2.46, -0.5);
      kit.box(station, 0.4, 0.012, 1.8, m.hazard, s * 4.05, 0.006, -0.5, { tile: false });
    }
    kit.box(station, 1.3, 0.12, 0.36, m.metalDark, 2.5, 2.36, 3.5);

    this.buildDesk(station);
    this.buildStationProps(station);
    this.buildStationLights(station);

    this.refs.doors = {
      WEST_DOOR: new SecurityDoor(kit, station, { id: 'WEST_DOOR', side: 'WEST', x: -4.5, z: -0.5 }),
      EAST_DOOR: new SecurityDoor(kit, station, { id: 'EAST_DOOR', side: 'EAST', x: 4.5, z: -0.5 })
    };
  }

  buildDesk(parent) {
    const { kit, m } = this;
    // Desk.
    kit.box(parent, 4.2, 0.06, 0.95, m.metalDark, 0, 0.78, -2.88, { cast: true, collide: true });
    kit.box(parent, 0.6, 0.75, 0.85, m.metal, -1.75, 0.375, -2.9, { cast: true });
    kit.box(parent, 0.6, 0.75, 0.85, m.metal, 1.75, 0.375, -2.9, { cast: true });
    kit.box(parent, 2.9, 0.5, 0.04, m.metalDark, 0, 0.5, -3.3);
    // Main surveillance monitor (feed texture is assigned at runtime).
    const mon = new THREE.Group();
    mon.position.set(0, 1.27, -3.08);
    mon.rotation.x = -0.06;
    parent.add(mon);
    kit.box(mon, 1.02, 0.72, 0.12, m.plastic, 0, 0, -0.04, { tile: false, cast: true });
    this.refs.feedScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.62), m.screenOff);
    this.refs.feedScreen.position.set(0, 0, 0.025);
    mon.add(this.refs.feedScreen);
    kit.box(parent, 0.12, 0.42, 0.12, m.plastic, 0, 1.0, -3.12, { tile: false });
    kit.box(parent, 0.4, 0.03, 0.25, m.plastic, 0, 0.8, -3.1, { tile: false });
    // Left: facility status terminal. Right: acoustic monitor.
    for (const [x, ry, key] of [[-1.3, 0.38, 'terminalScreen'], [1.3, -0.38, 'acousticScreen']]) {
      const g = new THREE.Group();
      g.position.set(x, 1.13, -2.98);
      g.rotation.y = ry;
      g.rotation.x = -0.05;
      parent.add(g);
      kit.box(g, 0.66, 0.5, 0.3, m.plasticLight, 0, 0, -0.12, { tile: false, cast: true });
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.4), m.screenOff);
      screen.position.set(0, 0, 0.032);
      g.add(screen);
      this.refs[key] = screen;
    }
    // Keyboard, mouse, mug, papers.
    kit.box(parent, 0.55, 0.03, 0.18, m.plastic, 0, 0.825, -2.62, { tile: false });
    kit.box(parent, 0.07, 0.03, 0.11, m.plastic, 0.42, 0.825, -2.62, { tile: false });
    kit.cyl(parent, 0.045, 0.04, 0.1, m.plasticLight, -0.55, 0.86, -2.55);
    kit.box(parent, 0.3, 0.005, 0.38, m.paper, 0.95, 0.813, -2.62, { tile: false, ry: 0.2 });
    // The chair.
    const chair = new THREE.Group();
    chair.position.set(0.1, 0, -1.95);
    chair.rotation.y = 0.25;
    parent.add(chair);
    kit.box(chair, 0.5, 0.08, 0.5, m.fabric, 0, 0.48, 0, { tile: false, cast: true });
    kit.box(chair, 0.48, 0.6, 0.07, m.fabric, 0, 0.82, 0.24, { tile: false, cast: true });
    kit.cyl(chair, 0.03, 0.03, 0.42, m.metalDark, 0, 0.24, 0);
    kit.cyl(chair, 0.3, 0.3, 0.04, m.metalDark, 0, 0.04, 0);
    kit.addCollider(-0.2, 0.4, -2.25, -1.65);

    // Interaction hitboxes for the desk.
    this.hit('WORKSTATION', 0, 1.25, -2.95, 1.1, 0.8, 0.5);
    this.hit('TERMINAL', -1.3, 1.13, -2.9, 0.7, 0.55, 0.45);
    this.hit('ACOUSTIC', 1.3, 1.13, -2.9, 0.7, 0.55, 0.45);

    // Shift assignment on the desk + a note taped to the monitor.
    this.addDocument(parent, 'shift_assignment', -0.72, 0.812, -2.58, { ry: -0.15 });
    this.addDocument(parent, 'note_monitor', 0.95, 1.85, -3.33, { upright: true, small: true });
  }

  addDocument(parent, docId, x, y, z, { rx = 0, ry = 0, upright = false, small = false } = {}) {
    const w = small ? 0.12 : 0.22;
    const h = small ? 0.12 : 0.3;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: TX.paperTexture([small ? '' : 'N-17'], { seed: docId.length * 7 }), side: THREE.DoubleSide }));
    mesh.position.set(x, y, z);
    if (!upright) mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.y = ry;
    if (upright) mesh.rotation.x = rx;
    parent.add(mesh);
    if (upright) this.hit('DOCUMENT', x, y, z, Math.max(w, 0.25), Math.max(h, 0.25), 0.25, { docId });
    else this.hit('DOCUMENT', x, y + 0.04, z, Math.max(w, 0.25), 0.18, Math.max(h, 0.25), { docId });
    this.docs.push({ docId, mesh });
    return mesh;
  }

  buildStationProps(parent) {
    const { kit, m } = this;
    // Wall clock (hands animated by the presenter).
    const clock = new THREE.Group();
    clock.position.set(0, 2.38, -3.33);
    parent.add(clock);
    kit.cyl(clock, 0.24, 0.24, 0.05, m.plastic, 0, 0, 0, { rx: Math.PI / 2, segments: 32 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.21, 32), new THREE.MeshLambertMaterial({ map: clockFaceTexture() }));
    face.position.z = 0.027;
    clock.add(face);
    const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.12, 0.006), m.black);
    hourHand.geometry.translate(0, 0.05, 0);
    hourHand.position.z = 0.035;
    const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.006), m.black);
    minuteHand.geometry.translate(0, 0.08, 0);
    minuteHand.position.z = 0.04;
    clock.add(hourHand, minuteHand);
    this.refs.clock = { hourHand, minuteHand };

    // Server rack (surveillance), north-west corner.
    const rack = new THREE.Group();
    rack.position.set(-3.75, 0, -2.85);
    parent.add(rack);
    kit.box(rack, 0.8, 2.0, 0.9, m.metalDark, 0, 1.0, 0, { cast: true });
    kit.addCollider(-4.2, -3.3, -3.35, -2.35);
    const leds = [];
    for (let i = 0; i < 8; i++) {
      kit.box(rack, 0.7, 0.16, 0.02, m.plastic, 0, 0.35 + i * 0.2, 0.46, { tile: false });
      for (let j = 0; j < 4; j++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), m.ledGreen);
        led.position.set(-0.28 + j * 0.05, 0.35 + i * 0.2, 0.475);
        rack.add(led);
        leds.push(led);
      }
    }
    const rackSwitch = kit.box(rack, 0.12, 0.18, 0.04, m.ledRed, 0.25, 1.95, 0.46, { tile: false });
    this.refs.rack = { leds, rackSwitch };
    this.hit('RACK', -3.75, 1.2, -2.35, 0.8, 1.6, 0.3);

    // Ventilation fan unit (north-east, high) + switch.
    const fan = new THREE.Group();
    fan.position.set(3.45, 2.3, -3.25);
    parent.add(fan);
    kit.box(fan, 0.8, 0.8, 0.25, m.metal, 0, 0, 0, { tile: false });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 8, 24), m.metalDark);
    ring.position.z = 0.13;
    fan.add(ring);
    const blades = new THREE.Group();
    blades.position.z = 0.14;
    fan.add(blades);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.28, 0.01), m.metalDark);
      b.geometry.translate(0, 0.15, 0);
      b.rotation.z = (i / 5) * Math.PI * 2;
      b.rotation.y = 0.35;
      blades.add(b);
    }
    for (let i = -3; i <= 3; i++) kit.box(fan, 0.66, 0.012, 0.012, m.metalDark, 0, i * 0.09, 0.17, { tile: false });
    const fanSwitch = new THREE.Group();
    fanSwitch.position.set(3.45, 1.35, -3.33);
    parent.add(fanSwitch);
    kit.box(fanSwitch, 0.22, 0.3, 0.05, m.metalPaint, 0, 0, 0, { tile: false });
    const fanLever = kit.box(fanSwitch, 0.04, 0.14, 0.05, m.plastic, 0, 0.04, 0.05, { tile: false });
    this.refs.fan = { blades, lever: fanLever, speed: 1 };
    this.hit('FAN', 3.45, 1.35, -3.2, 0.4, 0.45, 0.3);
    kit.box(parent, 0.3, 0.08, 0.02, m.paper, 3.45, 1.6, -3.32, { tile: false });

    // Ceiling vent grille (the station duct above).
    const vent = new THREE.Group();
    vent.position.set(0.8, 2.99, 1.4);
    parent.add(vent);
    kit.box(vent, 0.9, 0.04, 0.9, m.metalDark, 0, 0, 0, { tile: false });
    for (let i = -3; i <= 3; i++) kit.box(vent, 0.8, 0.03, 0.03, m.black, 0, -0.03, i * 0.11, { tile: false });
    this.refs.vent = vent;
    const dustCount = 60;
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(dustCount * 3), 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xb8b0a0, size: 0.018, transparent: true, opacity: 0, depthWrite: false }));
    dust.frustumCulled = false;
    parent.add(dust);
    this.refs.ventDust = { points: dust, seeds: Array.from({ length: dustCount }, () => [Math.random() - 0.5, Math.random() - 0.5, Math.random()]) };

    // Door control panels (door + corridor light) beside each door.
    this.refs.panels = {};
    for (const [side, s] of [['WEST', -1], ['EAST', 1]]) {
      const p = new THREE.Group();
      p.position.set(s * 4.33, 1.3, -1.85);
      p.rotation.y = -s * Math.PI / 2;
      parent.add(p);
      kit.box(p, 0.42, 0.62, 0.05, m.metalPaint, 0, 0, 0, { tile: false });
      const doorBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 20), m.ledGreen.clone());
      doorBtn.rotation.x = Math.PI / 2;
      doorBtn.position.set(0, 0.13, 0.04);
      const lightBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 20), m.ledOff.clone());
      lightBtn.rotation.x = Math.PI / 2;
      lightBtn.position.set(0, -0.14, 0.04);
      p.add(doorBtn, lightBtn);
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshBasicMaterial({ map: TX.signTexture(`${side} DOOR`, { width: 256, height: 64, font: 'bold 30px "Courier New", monospace' }) }));
      label.position.set(0, 0.25, 0.03);
      const label2 = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.07), new THREE.MeshBasicMaterial({ map: TX.signTexture('CORRIDOR LIGHT', { width: 256, height: 52, font: 'bold 22px "Courier New", monospace' }) }));
      label2.position.set(0, -0.26, 0.03);
      p.add(label, label2);
      this.refs.panels[side] = { doorBtn, lightBtn };
      this.hit(`DOOR_${side}`, s * 4.25, 1.43, -1.85, 0.3, 0.3, 0.42, { side });
      this.hit(`LIGHT_${side}`, s * 4.25, 1.16, -1.85, 0.3, 0.24, 0.42, { side });
      // Manual release lever (used during a power failure).
      const lever = kit.box(parent, 0.08, 0.5, 0.08, m.hazard, s * 4.32, 1.1, 0.75, { tile: false });
      this.refs.panels[side].manualLever = lever;
      this.hit(`MANUAL_${side}`, s * 4.25, 1.1, 0.75, 0.3, 0.6, 0.35, { side });
    }

    // Containment barrier console (south wall).
    const barrier = new THREE.Group();
    barrier.position.set(-1.7, 0, 3.15);
    parent.add(barrier);
    kit.box(barrier, 0.9, 1.0, 0.45, m.metal, 0, 0.5, 0, { cast: true });
    kit.box(barrier, 0.92, 0.06, 0.47, m.hazard, 0, 1.02, 0, { tile: false });
    const barrierLever = new THREE.Group();
    barrierLever.position.set(0, 1.05, -0.05);
    barrier.add(barrierLever);
    kit.box(barrierLever, 0.06, 0.4, 0.06, m.metalDark, 0, 0.2, 0, { tile: false });
    kit.box(barrierLever, 0.18, 0.07, 0.07, m.ledRed, 0, 0.4, 0, { tile: false });
    barrierLever.rotation.x = 0.6;
    const barrierLamp = kit.box(barrier, 0.5, 0.06, 0.02, m.ledOff.clone(), 0, 0.8, -0.235, { tile: false });
    const barrierSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.2), new THREE.MeshBasicMaterial({ map: TX.signTexture('CONTAINMENT FIELD', { width: 512, height: 128, sub: 'CALIBRATED: SUBJECT 04', font: 'bold 44px "Courier New", monospace' }) }));
    barrierSign.position.set(0, 0.55, -0.235);
    barrierSign.rotation.y = Math.PI;
    barrier.add(barrierSign);
    kit.addCollider(-2.2, -1.2, 2.9, 3.4);
    this.refs.barrier = { lever: barrierLever, lamp: barrierLamp };
    this.hit('BARRIER', -1.7, 1.1, 2.9, 0.9, 0.7, 0.6);
    // Barrier field planes across both doorways (shader-animated by the presenter).
    this.refs.barrierFields = [-1, 1].map((s) => {
      const mat = barrierFieldMaterial();
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.35), mat);
      plane.position.set(s * 4.05, 1.18, -0.5);
      plane.rotation.y = Math.PI / 2;
      plane.visible = false;
      parent.add(plane);
      for (const dz of [-0.85, 0.85]) kit.box(parent, 0.1, 2.35, 0.06, m.metalDark, s * 4.05, 1.18, -0.5 + dz, { tile: false });
      return plane;
    });

    // Emergency power panel (battery gauge + station lighting switch).
    const epp = new THREE.Group();
    epp.position.set(-3.3, 1.45, 3.33);
    epp.rotation.y = Math.PI;
    parent.add(epp);
    kit.box(epp, 0.7, 0.8, 0.08, m.metalPaint, 0, 0, 0, { tile: false });
    this.refs.powerGauge = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), m.screenOff);
    this.refs.powerGauge.position.set(0, 0.14, 0.045);
    epp.add(this.refs.powerGauge);
    const lightSwitch = kit.box(epp, 0.14, 0.18, 0.05, m.ledAmber, 0, -0.22, 0.06, { tile: false });
    this.refs.stationLightSwitch = lightSwitch;
    this.hit('STATION_LIGHTS', -3.3, 1.25, 3.2, 0.5, 0.35, 0.3);
    this.hit('POWER_PANEL', -3.3, 1.6, 3.2, 0.7, 0.4, 0.3);

    // Maintenance panel: signal relay reset.
    const mp = new THREE.Group();
    mp.position.set(0.85, 1.4, 3.33);
    mp.rotation.y = Math.PI;
    parent.add(mp);
    kit.box(mp, 0.55, 0.65, 0.12, m.metal, 0, 0, 0, { tile: false });
    const relayLamp = kit.box(mp, 0.1, 0.1, 0.03, m.ledGreen.clone(), 0.15, 0.2, 0.07, { tile: false });
    const relayLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.12), new THREE.MeshBasicMaterial({ map: TX.signTexture('SIGNAL RELAY', { width: 256, height: 64, font: 'bold 28px "Courier New", monospace' }) }));
    relayLabel.position.set(0, -0.12, 0.065);
    mp.add(relayLabel);
    this.refs.relayLamp = relayLamp;
    this.hit('RELAY', 0.85, 1.4, 3.2, 0.6, 0.7, 0.3);

    // Radio receiver on a shelf, east wall.
    kit.box(parent, 0.4, 0.04, 0.8, m.metalDark, 4.15, 1.05, 2.0);
    const radio = new THREE.Group();
    radio.position.set(4.12, 1.2, 2.0);
    radio.rotation.y = -Math.PI / 2;
    parent.add(radio);
    kit.box(radio, 0.5, 0.26, 0.22, m.wood, 0, 0, 0, { tile: false, cast: true });
    kit.box(radio, 0.26, 0.18, 0.01, m.fabric, -0.1, 0, 0.112, { tile: false });
    const dial = kit.cyl(radio, 0.045, 0.045, 0.03, m.plasticLight, 0.15, 0.03, 0.12, { rx: Math.PI / 2 });
    const radioLamp = kit.box(radio, 0.04, 0.02, 0.01, m.ledAmber.clone(), 0.15, -0.07, 0.115, { tile: false });
    kit.cyl(radio, 0.006, 0.006, 0.6, m.metal, 0.2, 0.42, -0.05, { rz: 0.4 });
    this.refs.radio = { group: radio, dial, lamp: radioLamp };
    this.hit('RADIO', 4.1, 1.22, 2.0, 0.35, 0.35, 0.6);

    // Filing cabinet, locker, bin.
    kit.box(parent, 0.55, 1.3, 0.65, m.metalPaint, -4.05, 0.65, 2.55, { cast: true, collide: true });
    kit.box(parent, 0.55, 1.9, 0.6, m.metal, -4.05, 0.95, 1.6, { cast: true, collide: true });
    kit.cyl(parent, 0.17, 0.14, 0.38, m.metalDark, -3.5, 0.19, -1.9, { collide: true });
    this.addDocument(parent, 'memo_observer', -4.05, 1.31, 2.55, { ry: 0.4 });
  }

  buildStationLights(parent) {
    const { kit, m, scene } = this;
    const fixtures = [];
    for (const x of [-1.7, 1.7]) {
      const g = new THREE.Group();
      g.position.set(x, 2.93, 0.2);
      parent.add(g);
      kit.box(g, 0.35, 0.08, 1.4, m.metal, 0, 0, 0, { tile: false });
      const tubes = [];
      for (const dx of [-0.08, 0.08]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), m.tube.clone());
        t.rotation.x = Math.PI / 2;
        t.position.set(dx, -0.05, 0);
        g.add(t);
        tubes.push(t);
      }
      fixtures.push({ group: g, tubes });
    }
    const main = new THREE.SpotLight(0xdfe8d8, 30, 14, 1.25, 0.85, 2);
    main.position.set(-1.7, 2.85, 0.2);
    main.target.position.set(-0.6, 0, -0.6);
    main.castShadow = true;
    main.shadow.mapSize.set(1024, 1024);
    main.shadow.bias = -0.0005;
    main.shadow.camera.near = 0.3;
    main.shadow.camera.far = 12;
    scene.add(main, main.target);
    const fill = new THREE.PointLight(0xd8e4d4, 9, 14, 2);
    fill.position.set(0.6, 2.7, -0.2);
    scene.add(fill);
    const monitorGlow = new THREE.PointLight(0x9fc4c0, 1.2, 3.2, 2);
    monitorGlow.position.set(0, 1.25, -2.55);
    scene.add(monitorGlow);
    const emergency = new THREE.PointLight(0xff3a24, 0, 16, 2);
    emergency.position.set(0, 2.7, 0.2);
    scene.add(emergency);
    const emergencyLamp = kit.box(parent, 0.3, 0.12, 0.12, m.ledOff.clone(), 0, 2.88, 3.3, { tile: false });
    const ambient = new THREE.AmbientLight(0x8a9a96, 0.22);
    scene.add(ambient);
    this.lights.station = { main, fill, monitorGlow, emergency, emergencyLamp, ambient, fixtures };
  }

  // ------------------------------------------------------------ approaches

  buildApproach(side) {
    const { kit, m, scene } = this;
    const s = side === 'WEST' ? -1 : 1;
    const g = new THREE.Group();
    g.name = `approach-${side}`;
    scene.add(g);
    const xNear = s * 4.5;
    const xFar = s * 10.2;
    const corrA = s * 8.0;
    const corrB = s * 9.8;
    this.occlude(
      kit.room(g, {
        x0: Math.min(xNear, xFar), x1: Math.max(xNear, xFar), z0: -2.2, z1: 1.2, h: 2.8,
        wall: m.concrete, floor: m.grime, ceiling: m.ceiling,
        skip: [s < 0 ? 'E' : 'W'],
        openings: [{ wall: 'N', from: Math.min(corrA, corrB), to: Math.max(corrA, corrB), top: 2.6 }],
        collide: false
      })
    );
    // Dark corridor beyond (visible but inaccessible).
    this.occlude(
      kit.room(g, {
        x0: Math.min(corrA, corrB), x1: Math.max(corrA, corrB), z0: -16, z1: -2.2, h: 2.8,
        wall: m.concreteDark, floor: m.grime, ceiling: m.ceiling, skip: ['S'], collide: false
      })
    );
    kit.box(g, Math.abs(corrB - corrA), 2.8, 0.1, m.void, (corrA + corrB) / 2, 1.4, -15.9, { tile: false });
    // Props: pipes, a fallen chair, a gurney, signage.
    kit.pipe(g, [xNear + s * 0.3, 2.55, -2.0], [xFar - s * 0.3, 2.55, -2.0], 0.08);
    kit.pipe(g, [corrA + s * 0.2, 2.5, -2.4], [corrA + s * 0.2, 2.5, -15], 0.06, m.pipeRust);
    kit.box(g, 1.9, 0.08, 0.7, m.metal, s * 7.9, 0.75, 0.75, { cast: true });
    kit.box(g, 0.05, 0.75, 0.05, m.metalDark, s * 7.1, 0.37, 1.0);
    kit.box(g, 0.05, 0.75, 0.05, m.metalDark, s * 8.7, 0.37, 1.0);
    kit.box(g, 0.05, 0.75, 0.05, m.metalDark, s * 7.1, 0.37, 0.5);
    kit.box(g, 0.05, 0.75, 0.05, m.metalDark, s * 8.7, 0.37, 0.5);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: TX.signTexture(side === 'WEST' ? 'WEST WING  >' : '<  EAST WING', { sub: 'SECURITY ACCESS ONLY' }), color: 0x9a9a90 }));
    sign.position.set(s * 6.8, 2.2, 1.18);
    sign.rotation.y = Math.PI;
    g.add(sign);
    for (let i = 0; i < 5; i++) kit.box(g, 0.012, 0.012, 1.2, m.metalDark, corrA + s * 0.4 + s * i * 0.25, 0.01, -6 - i * 1.7, { tile: false });

    // Lighting: a dim caged bulb over the approach, a corridor fixture beyond.
    const lamp = new THREE.PointLight(0xc8b890, 5, 9, 2);
    lamp.position.set(s * 7.0, 2.55, -0.5);
    scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m.tube.clone());
    bulb.position.copy(lamp.position);
    g.add(bulb);
    const corridorLamp = new THREE.PointLight(0xe8f2e8, 0, 10, 2);
    corridorLamp.position.set((corrA + corrB) / 2, 2.5, -6.5);
    scene.add(corridorLamp);
    const corridorTube = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 1.4), m.tubeOff.clone());
    corridorTube.position.set((corrA + corrB) / 2, 2.76, -6.5);
    g.add(corridorTube);

    const doorX = xNear;
    const face = -s * Math.PI / 2;
    this.rooms[`${side}_APPROACH`] = {
      id: `${side}_APPROACH`,
      scene: this.scene,
      main: true,
      camera: makeFeedCamera([s * 10.0, 2.45, 1.0], [s * 5.0, 0.9, -0.7]),
      anchors: [
        { pos: new THREE.Vector3(s * 6.6, 0, -0.45), facing: face }, // Wanderer
        { pos: new THREE.Vector3(s * 7.5, 0, -1.4), facing: face + s * 0.3 }, // Observer
        { pos: new THREE.Vector3(s * 8.4, 0, 0.3), facing: face }, // Echo (never at the door)
        { pos: new THREE.Vector3(s * 5.35, 0, -0.5), facing: face } // Patient: right behind the door
      ],
      entry: new THREE.Vector3((corrA + corrB) / 2, 0, -9),
      doorX,
      lights: { lamp, bulb, corridorLamp, corridorTube }
    };
  }

  // ------------------------------------------------------------ maintenance

  buildMaintenance() {
    const { kit, m } = this;
    const g = new THREE.Group();
    g.name = 'maintenance';
    this.scene.add(g);
    this.occlude(
      kit.room(g, {
        x0: 1.6, x1: 3.4, z0: 3.5, z1: 16, h: 2.7,
        wall: m.concrete, floor: m.grime, ceiling: m.ceiling,
        skip: ['N'],
        openings: [
          { wall: 'E', from: 8.2, to: 9.6, top: 2.2 },
          { wall: 'W', from: 6.2, to: 11.8, bottom: 0.95, top: 2.3 },
          { wall: 'S', from: 2.0, to: 3.0, top: 2.2 }
        ]
      })
    );
    // Grille over the pump-room window.
    const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 1.35, 0.03), m.metalDark, 46);
    const mtx = new THREE.Matrix4();
    for (let i = 0; i < 46; i++) {
      mtx.makeTranslation(1.6, 1.625, 6.25 + i * 0.12);
      bars.setMatrixAt(i, mtx);
    }
    g.add(bars);
    kit.box(g, 0.06, 0.05, 5.6, m.metalDark, 1.6, 2.28, 9.0, { tile: false });
    kit.box(g, 0.06, 0.05, 5.6, m.metalDark, 1.6, 0.97, 9.0, { tile: false });
    // Pipes, cable trays, lockers.
    kit.pipe(g, [3.25, 2.45, 3.6], [3.25, 2.45, 15.8], 0.09);
    kit.pipe(g, [3.1, 2.55, 3.6], [3.1, 2.55, 15.8], 0.05, m.pipeRust);
    kit.pipe(g, [1.75, 2.5, 3.6], [1.75, 2.5, 15.8], 0.06);
    kit.box(g, 0.3, 0.05, 12, m.metalDark, 2.5, 2.6, 9.8, { tile: false });
    for (let i = 0; i < 3; i++) kit.box(g, 0.45, 1.85, 0.5, m.metalPaint, 3.12, 0.93, 12.6 + i * 0.52, { cast: true, collide: true });
    this.addDocument(g, 'incident_17c', 2.9, 1.87, 13.65, { ry: 0.3 });
    // Lighting: one flickery caged lamp.
    const lamp = new THREE.PointLight(0xd8d0b0, 18, 16, 2);
    lamp.position.set(2.5, 2.5, 9.0);
    this.scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), m.tube.clone());
    bulb.position.copy(lamp.position);
    g.add(bulb);
    this.lights.maintenance = { lamp, bulb };
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: TX.signTexture('MAINTENANCE', { sub: 'ELECTRICAL  >' }), color: 0xa0a090 }));
    sign.position.set(3.38, 2.1, 7.6);
    sign.rotation.y = -Math.PI / 2;
    g.add(sign);

    // Hinged door to the electrical room.
    const hinge = new THREE.Group();
    hinge.position.set(3.4, 0, 8.2);
    g.add(hinge);
    kit.box(hinge, 0.06, 2.15, 1.38, m.door, 0, 1.075, 0.69, { cast: true, tile: 1.2 });
    kit.box(hinge, 0.1, 0.05, 0.2, m.metalDark, -0.06, 1.05, 1.2, { tile: false });
    this.refs.electricalDoor = { hinge, open: 0, target: 0 };
    this.refs.electricalDoorCollider = kit.addCollider(3.3, 3.5, 8.2, 9.6, 'electricalDoor');
    this.hit('ELECTRICAL_DOOR', 3.4, 1.1, 8.9, 0.3, 1.8, 1.3);
  }

  buildElectrical() {
    const { kit, m } = this;
    const g = new THREE.Group();
    g.name = 'electrical';
    this.scene.add(g);
    this.occlude(
      kit.room(g, {
        x0: 3.4, x1: 8.4, z0: 6.5, z1: 12, h: 2.8,
        wall: m.concreteDark, floor: m.grime, ceiling: m.ceiling, skip: ['W']
      })
    );
    // Breaker panel (door motor repairs), east wall.
    const panel = new THREE.Group();
    panel.position.set(8.25, 1.4, 8.6);
    panel.rotation.y = -Math.PI / 2;
    g.add(panel);
    kit.box(panel, 1.4, 1.1, 0.18, m.metalPaint, 0, 0, 0, { tile: false, cast: true });
    const breakerLamps = {};
    for (const [i, door] of [[0, 'WEST_DOOR'], [1, 'EAST_DOOR']]) {
      const x = -0.35 + i * 0.7;
      kit.box(panel, 0.4, 0.5, 0.06, m.metalDark, x, 0.05, 0.11, { tile: false });
      breakerLamps[door] = kit.box(panel, 0.1, 0.1, 0.04, m.ledGreen.clone(), x, 0.38, 0.11, { tile: false });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1), new THREE.MeshBasicMaterial({ map: TX.signTexture(door === 'WEST_DOOR' ? 'W. DOOR MOTOR' : 'E. DOOR MOTOR', { width: 256, height: 64, font: 'bold 26px "Courier New", monospace' }) }));
      label.position.set(x, -0.33, 0.1);
      panel.add(label);
      this.hit(`BREAKER_${door}`, 8.1, 1.45, 8.6 + (i === 0 ? -0.35 : 0.35), 0.3, 0.6, 0.45, { door }); // panel is rotated: local x -> world z
    }
    this.refs.breakerLamps = breakerLamps;
    kit.addCollider(8.0, 8.4, 7.8, 9.4);

    // Auxiliary power cell.
    const cell = new THREE.Group();
    cell.position.set(6.2, 0, 11.45);
    g.add(cell);
    kit.box(cell, 1.6, 1.6, 0.8, m.metal, 0, 0.8, 0, { cast: true });
    kit.box(cell, 1.62, 0.1, 0.82, m.hazard, 0, 1.45, 0, { tile: false });
    const cellLamp = kit.box(cell, 0.4, 0.08, 0.02, m.ledAmber.clone(), 0, 1.1, -0.41, { tile: false });
    const cellLever = kit.box(cell, 0.06, 0.4, 0.06, m.ledRed, 0.55, 1.0, -0.45, { tile: false, rx: -0.4 });
    const cellSign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.25), new THREE.MeshBasicMaterial({ map: TX.signTexture('AUX CELL 3', { sub: 'SINGLE DISCHARGE ONLY' }) }));
    cellSign.position.set(0, 0.6, -0.41);
    cellSign.rotation.y = Math.PI;
    cell.add(cellSign);
    kit.addCollider(5.4, 7.0, 11.0, 12.0);
    this.refs.auxCell = { lamp: cellLamp, lever: cellLever };
    this.hit('AUX_CELL', 6.2, 1.0, 10.9, 1.6, 1.2, 0.5);

    // Generator and transformer (decorative, humming).
    const gen = new THREE.Group();
    gen.position.set(5.2, 0, 7.3);
    g.add(gen);
    kit.box(gen, 1.6, 1.1, 1.0, m.metalPaint, 0, 0.55, 0, { cast: true });
    kit.cyl(gen, 0.35, 0.35, 1.1, m.metalDark, 0, 0.6, 0, { rz: Math.PI / 2 });
    kit.addCollider(4.4, 6.0, 6.8, 7.8);
    // Desk with the maintenance log and an audio recorder.
    kit.box(g, 1.2, 0.05, 0.6, m.wood, 4.2, 0.78, 11.55, { cast: true, collide: true });
    kit.box(g, 0.05, 0.76, 0.55, m.metalDark, 3.65, 0.38, 11.55);
    kit.box(g, 0.05, 0.76, 0.55, m.metalDark, 4.75, 0.38, 11.55);
    this.addDocument(g, 'maintenance_log', 4.0, 0.81, 11.5, { ry: 0.25 });
    const recorder = kit.box(g, 0.28, 0.08, 0.18, m.plastic, 4.5, 0.85, 11.5, { tile: false });
    kit.cyl(g, 0.04, 0.04, 0.02, m.metalDark, 4.45, 0.9, 11.5, { segments: 10 });
    kit.cyl(g, 0.04, 0.04, 0.02, m.metalDark, 4.56, 0.9, 11.5, { segments: 10 });
    this.refs.recorder = recorder;
    this.hit('TAPE', 4.5, 0.9, 11.5, 0.35, 0.2, 0.3);
    this.addDocument(g, 'barrier_notice', 7.0, 1.6, 6.66, { upright: true });
    // Light.
    const lamp = new THREE.PointLight(0xd0c8a8, 16, 12, 2);
    lamp.position.set(5.9, 2.55, 9.3);
    this.scene.add(lamp);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), m.tube.clone());
    bulb.position.copy(lamp.position);
    g.add(bulb);
    this.lights.electrical = { lamp, bulb };
  }

  buildPumpRoom() {
    const { kit, m } = this;
    const g = new THREE.Group();
    g.name = 'pump-room';
    this.scene.add(g);
    // A flooded pit seen through the grille. Floor of the walkway at y 0, water at -1.6.
    kit.box(g, 6.0, 0.1, 8.0, m.concreteDark, -1.4, -2.4, 9.0, { tile: 3 });
    kit.box(g, 0.3, 5.2, 8.0, m.concreteDark, -4.4, 0.2, 9.0, { tile: 3 });
    kit.box(g, 6.0, 5.2, 0.3, m.concreteDark, -1.4, 0.2, 5.0, { tile: 3 });
    kit.box(g, 6.0, 5.2, 0.3, m.concreteDark, -1.4, 0.2, 13.0, { tile: 3 });
    kit.box(g, 6.2, 0.1, 8.2, m.ceiling, -1.4, 2.8, 9.0, { tile: 3 });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(6, 8), m.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-1.4, -1.6, 9);
    g.add(water);
    kit.cyl(g, 0.5, 0.5, 2.6, m.pipeRust, -2.6, -0.5, 7.5);
    kit.cyl(g, 0.5, 0.5, 2.6, m.pipeRust, -2.6, -0.5, 10.5);
    kit.pipe(g, [-2.6, 0.9, 7.5], [-2.6, 0.9, 10.5], 0.18, m.pipeRust);
    kit.pipe(g, [-4.2, 1.6, 6], [1.4, 1.6, 6], 0.12);
    kit.box(g, 1.6, 0.06, 0.9, m.metalDark, -0.6, -0.2, 9.0);
    const lamp = new THREE.PointLight(0x6fa898, 2.2, 8, 2);
    lamp.position.set(-1.2, 1.8, 9.5);
    this.scene.add(lamp);
    this.lights.pump = { lamp, water };
  }

  buildRestrictedDoor() {
    const { kit, m } = this;
    const g = new THREE.Group();
    this.scene.add(g);
    kit.box(g, 1.05, 2.2, 0.15, m.metalDark, 2.5, 1.1, 16.0, { cast: true, collide: true });
    kit.box(g, 0.3, 0.2, 0.03, m.windowGlass, 2.5, 1.65, 15.92, { tile: false });
    kit.box(g, 0.1, 0.5, 0.06, m.metal, 2.85, 1.05, 15.9, { tile: false });
    kit.box(g, 1.2, 0.12, 0.2, m.hazard, 2.5, 2.25, 15.95, { tile: false });
    const red = kit.box(g, 0.18, 0.1, 0.1, m.ledRed, 2.5, 2.45, 15.85, { tile: false });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.24), new THREE.MeshBasicMaterial({ map: TX.signTexture('SUBLEVEL B', { sub: 'ACCESS REVOKED', bg: '#3a1712', fg: '#e8d6c8', border: '#8a3a2a' }) }));
    sign.position.set(2.5, 1.95, 15.9);
    sign.rotation.y = Math.PI;
    g.add(sign);
    const glow = new THREE.PointLight(0xff3020, 0.8, 4, 2);
    glow.position.set(2.5, 2.3, 15.4);
    this.scene.add(glow);
    this.lights.restricted = { red, glow };
    this.hit('RESTRICTED', 2.5, 1.2, 15.8, 1.0, 1.8, 0.4);
    this.addDocument(g, 'sublevel_note', 2.0, 1.25, 15.9, { upright: true, small: true, ry: Math.PI });
  }
}

export function makeFeedCamera(pos, target, fov = 72) {
  const cam = new THREE.PerspectiveCamera(fov, 4 / 3, 0.05, 60);
  cam.position.set(...pos);
  cam.lookAt(new THREE.Vector3(...target));
  return cam;
}

function clockFaceTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#d8d4c4';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.font = 'bold 30px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillText(String(i), 128 + Math.sin(a) * 95, 128 - Math.cos(a) * 95);
  }
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const r0 = i % 5 === 0 ? 108 : 114;
    ctx.fillRect(128 + Math.sin(a) * r0 - 1, 128 - Math.cos(a) * r0 - 1, 2, 2);
  }
  ctx.font = '12px "Courier New", monospace';
  ctx.fillText('HELIX R.D.', 128, 170);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function barrierFieldMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uStrength: { value: 0 }, uCalm: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime;
      uniform float uStrength;
      uniform float uCalm;
      void main() {
        float bands = sin(vUv.y * 90.0 - uTime * mix(4.0, 0.8, uCalm)) * 0.5 + 0.5;
        float slow = sin(vUv.y * 7.0 + uTime * 0.7 + vUv.x * 3.0) * 0.5 + 0.5;
        float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x);
        float a = (0.08 + 0.16 * bands * slow) * edge * uStrength;
        gl_FragColor = vec4(vec3(0.45, 0.75, 1.0) * a, a);
      }
    `
  });
}
