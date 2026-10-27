import * as THREE from 'three';
import { Simulation, SIM_PHASE } from './Simulation.js';
import { EventBus } from './EventBus.js';
import { STATES, GameStateMachine } from './GameState.js';
import { formatGameClock } from './GameClock.js';
import { Settings } from '../ui/Settings.js';
import { createMaterials } from '../render/Materials.js';
import { PostFX } from '../render/PostFX.js';
import { CameraFeedRenderer } from '../render/CameraFeedRenderer.js';
import { Facility, makeFeedCamera } from '../world/Facility.js';
import { EntityPresenter } from '../world/EntityPresenter.js';
import { LightingController } from '../world/Lighting.js';
import { StationPresenter } from '../world/StationPresenter.js';
import { Environment } from '../world/Environment.js';
import { PlayerController } from '../player/PlayerController.js';
import { InteractionSystem } from '../player/InteractionSystem.js';
import { createInteractionHandlers } from '../player/Interactions.js';
import { AudioSystem } from '../systems/AudioSystem.js';
import { EntitySoundscape } from '../systems/EntitySoundscape.js';
import { CameraSpeaker } from '../systems/CameraSpeaker.js';
import { VoiceSystem } from '../systems/VoiceSystem.js';
import { radioLineId, tapeLineId, gateLineId, morningLineId, deviationLineId, DEVIATION_LOGGED_ID, DEVIATION_RADIO_ID } from '../content/VoiceLines.js';
import { DEVIATION_NOTE_DOC, DEVIATION_LOGGED, DEVIATION_LINES, DEVIATION_RADIO, deviationAvailable } from '../content/Endings.js';
import { HUD } from '../ui/HUD.js';
import { Subtitles, HintsUI } from '../ui/Subtitles.js';
import { DocumentViewer } from '../ui/DocumentViewer.js';
import { SurveillanceUI, CAMERA_ORDER } from '../ui/SurveillanceUI.js';
import { MainMenu, controlsGrid } from '../ui/MainMenu.js';
import { SettingsMenu } from '../ui/SettingsMenu.js';
import { PauseMenu } from '../ui/PauseMenu.js';
import { EndScreen } from '../ui/EndScreen.js';
import { AIDebugger } from '../ui/AIDebugger.js';
import { PracticeCoach } from '../ui/PracticeCoach.js';
import { RadioBriefing } from '../ui/RadioBriefing.js';
import { customSchedule, customLabel } from '../ui/CustomNight.js';
import { el, showScreen } from '../ui/dom.js';
import { HINTS } from '../content/Hints.js';
import { GATE_MESSAGES, victoryLines } from '../content/TerminalMessages.js';
import { Progress } from './Progress.js';
import { TAPES } from '../content/Documents.js';
import { subjectsActive } from '../content/SubjectFiles.js';
import { ROOMS } from '../config/FacilityLayout.js';
import { ENTITY_IDS, PRACTICE_SCHEDULE, NIGHT_SCHEDULES, NIGHT_COUNT } from '../config/GameConfig.js';

const FAILURE_SECONDS = 10;
const VICTORY_SECONDS = 9;
const DEVIATION_VICTORY_SECONDS = 12;
// The contained ending holds on CAM 13 (the station, as WARDEN now files it) before the fade.
const CONTAINED_VICTORY_SECONDS = 17;
const CELL05_CROSSFADE = 2.5;
const SEAT_POS = new THREE.Vector3(0, 1.3, -2.2);
const SEAT_TARGET = new THREE.Vector3(0, 1.27, -3.1);

/**
 * Owns the renderer, the 3D world, audio, UI and the current Simulation.
 * The simulation is advanced with a fixed timestep from real elapsed time;
 * everything else reads its state each frame.
 */
export class Game {
  constructor(viewport, uiRoot) {
    this.viewport = viewport;
    this.uiRoot = uiRoot;
    this.settings = new Settings();
    this.bus = new EventBus();
    this.params = new URLSearchParams(location.search);
    this.debugEnabled = !!import.meta.env?.DEV || this.params.has('debug');
    this.fixedSeed = this.params.get('seed');
    this.fsm = new GameStateMachine(STATES.SPLASH);
    this.timeScale = 1;
    this.mode = 'NIGHT'; // 'NIGHT' | 'PRACTICE' | 'CUSTOM'
    this.night = 1;
    // ?debug=1 or ?unlock=all opens every night for testing; dev builds keep the real locks.
    this.progress = new Progress({ unlockAll: this.params.has('debug') || this.params.get('unlock') === 'all' });
    this.feedDip = 0;
    this.messages = [];
    this.tmpVec = new THREE.Vector3();
    this.failureProgress = 0;
    this.failureHidesFeed = false;
    this.workstationOpen = false;
    this.tapePlaying = false;
    this.fps = 60;
    this.lastWalking = false;
    this.lastZone = 'STATION';

    this.initRenderer();
    this.materials = createMaterials();
    this.facility = new Facility(this.materials);
    this.postfx = new PostFX(this.renderer);
    this.feeds = new CameraFeedRenderer(this.renderer, this.postfx);
    this.entities = new EntityPresenter(this.facility, this.settings);
    this.lighting = new LightingController(this.facility, this.settings);
    this.station = new StationPresenter(this.facility, this.feeds, this.settings);
    this.stationCam = makeFeedCamera([3.9, 2.75, 3.1], [-1.2, 0.9, -2.2], 80);
    this.cell05Cam = makeFeedCamera([2.4, 2.7, 0.9], [0.1, 0.7, -2.1], 62);
    this.audio = new AudioSystem(this.settings);
    this.cameraSpeaker = new CameraSpeaker(this);
    this.voice = new VoiceSystem(this.settings, this.audio);
    this.player = new PlayerController(this.camera, this.renderer.domElement, this.settings, this.facility.kit.colliders);
    this.player.onStep = (pos) => this.audio.playerStep(pos);
    this.interaction = new InteractionSystem(this.camera, this.facility, createInteractionHandlers(this), this);

    this.initUI();
    this.soundscape = new EntitySoundscape(this);
    this.environment = new Environment(this);
    this.sim = new Simulation({ seed: 'menu', bus: new EventBus() });
    this.entities.update(this.sim, 0, 0);
    this.subscribe();
    this.bindInput();
    this.applySettings('*');
    this.settings.onChange((k) => this.applySettings(k));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.menu.show('splash');
    this.clockStart = performance.now();
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  get state() {
    return this.fsm.state;
  }

  // ------------------------------------------------------------- setup

  initRenderer() {
    const r = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.15;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFShadowMap;
    this.viewport.append(r.domElement);
    this.renderer = r;
    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 40);
    this.menuCam = new THREE.PerspectiveCamera(60, 1, 0.05, 40);
  }

  initUI() {
    const ui = this.uiRoot;
    this.fadeNode = el('div', { id: 'fade' });
    this.viewport.after(this.fadeNode); // above the 3D view, below every UI layer
    this.hud = new HUD(ui);
    this.subtitles = new Subtitles(ui, this.settings);
    this.hints = new HintsUI(ui, this.settings);
    this.coach = new PracticeCoach(ui);
    this.radio = new RadioBriefing(ui, {
      onMessage: (text, index) => {
        this.audio.radioChirp();
        this.pushMessage('R: ' + text, 'radio');
        this.voice.say(radioLineId(index));
      }
    });
    this.docs = new DocumentViewer(ui, { onClose: () => this.closeDocument() });
    this.workstation = new SurveillanceUI(ui, {
      onSelect: (room) => this.selectCamera(room),
      onPing: () => {
        const r = this.command({ type: 'PING', room: this.sim.surveillance.selected });
        if (r.ok) {
          this.audio.uiSwitch();
          this.subtitles.show(`[A faint acoustic pulse, ${ROOMS[this.sim.surveillance.selected].name}]`, 'ambient');
        } else this.audio.uiDeny();
      },
      onClose: () => this.closeWorkstation()
    });
    // Label for the contained ending's last feed. CAM 13 is not on the workstation's list.
    this.cell05Time = el('div', { class: 'timestamp' });
    this.cell05Label = el('div', { id: 'cell05-feed' }, [
      el('div', { class: 'feed-label' }, [el('div', { class: 'cam', text: 'CAM 13' }), el('div', { class: 'room', text: 'CELL 05' }), el('div', { class: 'rec', html: '<i></i>REC' })]),
      this.cell05Time
    ]);
    ui.append(this.cell05Label);
    this.menu = new MainMenu(ui, {
      onBegin: () => this.begin(),
      onStart: (night) => {
        this.night = Math.max(1, Math.min(NIGHT_COUNT, night ?? 1));
        this.startNight('NIGHT');
      },
      progress: this.progress,
      onPractice: () => this.startNight('PRACTICE'),
      onCustom: (levels) => {
        this.customLevels = levels;
        this.startNight('CUSTOM');
      },
      onSettings: () => this.openSettings('main'),
      settings: this.settings
    });
    this.menu.onBackToPause = () => this.pauseMenu.show(true);
    this.settingsMenu = new SettingsMenu(ui, this.settings, { onBack: () => this.closeSettings() });
    this.pauseMenu = new PauseMenu(ui, {
      onResume: () => this.resume(),
      onSettings: () => this.openSettings('pause'),
      onControls: () => {
        this.pauseMenu.show(false);
        this.menu.show('controls', 'pause');
      },
      onRestart: () => this.startNight(this.mode),
      onExit: () => this.toMenu()
    });
    this.endScreen = new EndScreen(ui, {
      onRetry: () => this.startNight(this.mode),
      onNight: () => {
        // Practice -> Night 1; a survived night -> the next one.
        this.night = this.endNext ?? 1;
        this.startNight('NIGHT');
      },
      onMenu: () => this.toMenu()
    });
    this.debugger = new AIDebugger(ui, this);
    void controlsGrid;
  }

  subscribe() {
    const bus = this.bus;
    bus.on('facility:gate', ({ id, open }) => {
      if (open && GATE_MESSAGES[id]) {
        this.pushMessage(GATE_MESSAGES[id], 'facility', true);
        this.speakFacility(gateLineId(id), GATE_MESSAGES[id]);
      }
    });
    bus.on('power:failed', () => {
      this.pushMessage('MAIN POWER DEPLETED. EMERGENCY LIGHTING ENGAGED', 'alert', true);
      if (this.workstationOpen) this.closeWorkstation();
      this.subtitles.show('[Every machine in the station winds down into silence]', 'warning');
    });
    bus.on('power:restored', () => this.pushMessage('POWER RESTORED FROM AUXILIARY CELL', 'facility', true));
    bus.on('security:doorForced', ({ id }) => this.pushMessage(`${id.replace('_', ' ')} MOTOR FAILURE`, 'alert', true));
    bus.on('surveillance:thermal', () => {
      this.pushMessage('WORKSTATION THERMAL SHUTDOWN', 'alert', true);
    });
    bus.on('surveillance:fault', ({ room, active }) => {
      if (active) this.pushMessage(`${ROOMS[room].camera} ${ROOMS[room].name.toUpperCase()}: SIGNAL LOST`, 'alert');
    });
    bus.on('sim:practiceBreach', (b) => {
      this.coach.onBreach(b);
      this.pushMessage('PRACTICE: ' + b.designation + ' REACHED THE STATION. RETURNED TO CONTAINMENT', 'alert');
    });
    bus.on('entity:moved', ({ from, to }) => {
      if (this.workstationOpen && (from === this.sim.surveillance.selected || to === this.sim.surveillance.selected)) this.feedDisruption = 1;
    });
  }

  bindInput() {
    const canvas = this.renderer.domElement;
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyE') this.interaction.releaseE();
    });
    canvas.addEventListener('click', () => {
      if (this.state === STATES.PLAYING && !this.workstationOpen && !this.docs.open && !this.player.isLocked) this.player.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (this.player.isLocked) {
        this.hadLock = true;
        return;
      }
      if (this.expectUnlock) {
        this.expectUnlock = false;
        return;
      }
      if (this.state === STATES.PLAYING && !this.workstationOpen && !this.docs.open) this.pause();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === STATES.PLAYING) this.pause();
    });
  }

  onKeyDown(e) {
    if (e.code === 'F3' && this.debugEnabled) {
      e.preventDefault();
      this.debugger.toggle();
      return;
    }
    if (e.code === 'F4' && this.debugEnabled) {
      e.preventDefault();
      const order = [1, 4, 16];
      this.setTimeScale(order[(order.indexOf(this.timeScale) + 1) % order.length] ?? 1);
      return;
    }
    if (e.repeat && e.code !== 'KeyE') return;
    if (this.workstationOpen) {
      if (e.code === 'Escape' || e.code === 'KeyE' || e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) this.closeWorkstation();
        return;
      }
      if (e.code === 'Tab') {
        e.preventDefault();
        this.workstation.cycleTab();
        this.audio.uiClick();
        return;
      }
      const idx = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit7: 6, Digit8: 7, Digit9: 8, Digit0: 9, Minus: 10, Equal: 11 }[e.code];
      if (idx !== undefined && CAMERA_ORDER[idx]) this.selectCamera(CAMERA_ORDER[idx]);
      if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        const cur = CAMERA_ORDER.indexOf(this.sim.surveillance.selected);
        const n = CAMERA_ORDER.length;
        this.selectCamera(CAMERA_ORDER[(cur + (e.code === 'BracketRight' ? 1 : n - 1)) % n]);
      }
      return;
    }
    if (this.docs.open) {
      if ((e.code === 'Escape' || e.code === 'KeyE') && !e.repeat) {
        e.preventDefault();
        this.closeDocument();
      }
      return;
    }
    if (e.code === 'Escape') {
      if (this.state === STATES.PLAYING) this.pause();
      else if (this.state === STATES.PAUSED) {
        if (!this.settingsMenu.node.classList.contains('hidden')) this.closeSettings();
        else if (!this.menu.controls.classList.contains('hidden')) this.menu.back();
        else this.resume();
      }
      return;
    }
    if (e.code === 'KeyE' && this.state === STATES.PLAYING && !e.repeat) this.interaction.pressE();
  }

  // ------------------------------------------------------------- flow

  begin() {
    this.audio.init();
    this.audio.setFade(0.6, 3);
    this.fsm.set(STATES.MENU);
    this.menu.show('main');
    this.setFade(0);
  }

  newSeed() {
    return this.fixedSeed ?? `N17-${Math.floor(Math.random() * 1e9).toString(36)}`;
  }

  startNight(mode = this.mode) {
    this.mode = mode;
    const practice = mode === 'PRACTICE';
    const custom = mode === 'CUSTOM';
    const levels = this.customLevels ?? [5, 4, 3, 1];
    this.audio.init();
    this.menu.hideAll();
    this.pauseMenu.show(false);
    this.settingsMenu.show(false);
    this.endScreen.hide();
    this.docs.hide();
    if (this.workstationOpen) this.closeWorkstation(true);

    this.bus.clear();
    this.subscribe();
    const nightSchedule = NIGHT_SCHEDULES[this.night] ?? NIGHT_SCHEDULES[1];
    this.sim = new Simulation({ seed: this.newSeed(), bus: this.bus, practice, schedule: practice ? PRACTICE_SCHEDULE : custom ? customSchedule(levels) : nightSchedule });
    this.endNext = null;
    this.soundscape = new EntitySoundscape(this);
    this.cameraSpeaker.reset();
    this.voice.stop();
    this.entities.reset();
    this.lighting.reset();
    this.station.reset();
    this.environment.reset();
    this.hints.reset();
    this.subtitles.clear();
    this.hud.clearWarnings();
    this.hud.setPracticeMap(practice);
    this.workstation.setPracticeMap(practice);
    this.workstation.setFiles(this.progress.files);
    this.cell05Label.classList.remove('visible');
    if (practice) this.coach.start();
    else this.coach.stop();
    this.radio.start(!practice && !custom && this.night === 1 && this.settings.get('radioBriefing'));
    this.hud.setNightLabel(practice ? 'PRACTICE' : custom ? customLabel(levels) : `NIGHT ${this.night}`);
    this.endScreen.setRun(custom
      ? { label: `Custom night ${levels.join('/')}`, retry: 'RETRY CUSTOM NIGHT', again: 'PLAY IT AGAIN' }
      : { label: `Night ${this.night}`, retry: `RETRY NIGHT ${this.night}`, again: `PLAY NIGHT ${this.night} AGAIN` });
    this.feedDip = 0;
    this.debugger.resetLog();
    this.facility.setNightItems(mode === 'NIGHT' ? this.night : 0);
    this.facility.lights.restricted?.glow.color.setHex(0xff3020);
    this.messages = [];
    this.failure = null;
    this.victory = null;
    this.failureProgress = 0;
    this.failureHidesFeed = false;
    this.feedDisruption = 0;
    this.tapePlaying = false;
    this.lastWalking = false;
    this.lastZone = 'STATION';
    this.timeScale = 1;
    this.interaction.enabled = true;
    this.player.reset(new THREE.Vector3(0.6, 0, 0.9), 0.1);
    this.player.enabled = true;
    this.audio.setFailure(0);
    this.audio.setFade(1, 3);

    // Valid from any state: route through MENU when a direct transition is not allowed
    // (e.g. restarting while a failure or morning sequence is still playing).
    if (!this.fsm.can(STATES.PLAYING) && this.state !== STATES.PLAYING) this.fsm.set(STATES.MENU);
    this.fsm.set(STATES.PLAYING);
    this.audio.setPaused(false);
    this.hud.setVisible(true);
    this.hud.setDimmed(false);
    this.setFade(1, true);
    setTimeout(() => this.setFade(0), 60);
    this.player.requestLock();
    this.entities.update(this.sim, 0, 0);
  }

  pause() {
    if (this.state !== STATES.PLAYING) return;
    this.fsm.set(STATES.PAUSED);
    this.interaction.cancelHold();
    this.interaction.releaseE();
    this.audio.setPaused(true);
    this.voice.pause();
    this.expectUnlock = true;
    this.player.releaseLock();
    if (!document.pointerLockElement) this.expectUnlock = false;
    this.pauseMenu.show(true);
  }

  resume() {
    if (this.state !== STATES.PAUSED) return;
    this.pauseMenu.show(false);
    this.settingsMenu.show(false);
    this.menu.hideAll();
    this.fsm.set(STATES.PLAYING);
    this.audio.setPaused(false);
    this.voice.resume();
    this.last = performance.now();
    if (!this.workstationOpen && !this.docs.open) this.player.requestLock();
  }

  toMenu() {
    this.coach.stop();
    this.radio.stop();
    this.voice.stop();
    this.hud.setPracticeMap(false);
    this.pauseMenu.show(false);
    this.endScreen.hide();
    this.settingsMenu.show(false);
    if (this.workstationOpen) this.closeWorkstation(true);
    this.docs.hide();
    this.hud.setVisible(false);
    this.hud.clearWarnings();
    this.subtitles.clear();
    this.expectUnlock = true;
    this.player.releaseLock();
    if (!document.pointerLockElement) this.expectUnlock = false;
    this.player.enabled = false;
    this.audio.tape(false);
    this.audio.setFailure(0);
    this.audio.setPaused(false);
    this.audio.setFade(0.6, 2);
    this.fsm.set(STATES.MENU);
    this.menu.show('main');
    this.setFade(0);
  }

  openSettings(from) {
    this.settingsReturn = from;
    if (from === 'pause') this.pauseMenu.show(false);
    else this.menu.hideAll();
    this.settingsMenu.show(true);
  }

  closeSettings() {
    this.settingsMenu.show(false);
    if (this.settingsReturn === 'pause') this.pauseMenu.show(true);
    else this.menu.show('main');
  }

  setTimeScale(s) {
    this.timeScale = s;
  }

  setFade(opacity, instant = false) {
    if (instant) {
      this.fadeNode.style.transition = 'none';
      this.fadeNode.style.opacity = String(opacity);
      void this.fadeNode.offsetWidth;
      this.fadeNode.style.transition = '';
    } else this.fadeNode.style.opacity = String(opacity);
  }

  command(cmd) {
    if (!this.sim || this.state !== STATES.PLAYING) return { ok: false, reason: 'NOT_PLAYING' };
    return this.sim.command(cmd);
  }

  pushMessage(text, kind = 'facility', flash = false) {
    this.messages.push({ text, kind, clock: formatGameClock(this.sim?.gameHours ?? 0) });
    if (this.messages.length > 200) this.messages.shift();
    if (flash) this.flashInfo(`TERMINAL: ${text}`, kind === 'alert' ? '' : 'info');
  }

  /** Speak a facility announcement; when it is heard, show what it said as a subtitle. */
  speakFacility(lineId, text) {
    if (this.voice.say(lineId)) this.subtitles.show(`FACILITY: ${text}`, 'radio', 6);
  }

  flashInfo(text, kind = 'info', seconds = 5) {
    const id = `flash-${text}`;
    this.hud.setWarning(id, text, kind);
    setTimeout(() => this.hud.setWarning(id, null), seconds * 1000);
  }

  // ------------------------------------------------------- workstation

  openWorkstation(tab = 'cameras') {
    if (this.state !== STATES.PLAYING || this.workstationOpen) return;
    this.workstationOpen = true;
    this.interaction.cancelHold();
    this.player.focus(SEAT_POS, SEAT_TARGET);
    this.workstation.setTab(tab);
    this.workstation.show(true);
    this.nextWsUpdate = 0;
    this.hud.setDimmed(true);
    this.command({ type: 'VIEW', viewing: true });
    this.command({ type: 'PLAYER', walking: false });
    this.lastWalking = false;
    this.expectUnlock = true;
    this.player.releaseLock();
    if (!document.pointerLockElement) this.expectUnlock = false;
    this.audio.uiSwitch();
    this.feedDisruption = 0.6;
  }

  closeWorkstation(silent = false) {
    if (!this.workstationOpen) return;
    this.workstationOpen = false;
    this.workstation.show(false);
    this.player.unfocus();
    this.hud.setDimmed(false);
    if (this.sim && this.sim.phase === SIM_PHASE.RUNNING && this.state === STATES.PLAYING) this.sim.command({ type: 'VIEW', viewing: false });
    else if (this.sim) this.sim.surveillance.viewing = false;
    if (!silent && this.state === STATES.PLAYING) {
      this.audio.uiClick();
      this.player.requestLock();
    }
  }

  selectCamera(room) {
    if (!this.workstationOpen) return;
    if (room === this.sim.surveillance.selected) return;
    const r = this.command({ type: 'CAMERA', room });
    if (r.ok) {
      this.audio.uiSwitch();
      this.feedDisruption = 0.45;
      this.nextWsUpdate = 0;
      this.nextFeed = 0;
    }
  }

  // ---------------------------------------------------------- documents

  openDocument(docId) {
    if (this.docs.show(docId)) {
      if (docId === DEVIATION_NOTE_DOC && this.mode === 'NIGHT') this.progress.markDeviationNoteRead();
      this.interaction.cancelHold();
      this.expectUnlock = true;
      this.player.releaseLock();
      if (!document.pointerLockElement) this.expectUnlock = false;
      this.audio.burst({ bus: 'ui', buffer: 'white', type: 'bandpass', freq: 3000, q: 0.8, attack: 0.03, hold: 0.05, release: 0.15, peak: 0.04, reverb: 0 });
    }
  }

  closeDocument() {
    this.docs.hide();
    if (this.state === STATES.PLAYING) this.player.requestLock();
  }

  /** Whether a hand on the Sublevel B door counts as the deviation right now. */
  canDeviate() {
    return this.state === STATES.PLAYING && deviationAvailable({
      mode: this.mode,
      night: this.night,
      noteRead: this.progress.deviationNoteRead,
      hours: this.sim.gameHours,
      done: !!this.sim.deviation
    });
  }

  logDeviation() {
    if (!this.canDeviate()) return;
    const r = this.sim.command({ type: 'DEVIATION' });
    if (!r.ok) return;
    this.facility.lights.restricted?.glow.color.setHex(0xffa040);
    this.pushMessage(DEVIATION_LOGGED, 'facility', true);
    this.speakFacility(DEVIATION_LOGGED_ID, DEVIATION_LOGGED);
    this.subtitles.show('[The door is ice cold. The lamp above it turns amber.]', 'ambient', 6);
  }

  playTape(tapeId = 'log_six') {
    if (this.tapePlaying) return;
    const transcript = TAPES[tapeId].lines;
    this.tapePlaying = true;
    this.audio.tape(true);
    const startedAt = performance.now();
    const shown = new Set();
    const tick = () => {
      if (!this.tapePlaying) return;
      if (this.state === STATES.PAUSED) return void setTimeout(tick, 200);
      const t = (performance.now() - startedAt) / 1000;
      for (const line of transcript) {
        if (t >= line.at && !shown.has(line.at)) {
          shown.add(line.at);
          this.subtitles.show(line.text, 'tape', 5.5);
          this.voice.say(tapeLineId(transcript.indexOf(line), tapeId));
          if (!this.settings.get('subtitles')) this.hints.push(line.text, 'AUDIO LOG');
        }
      }
      if (t > transcript[transcript.length - 1].at + 1) {
        this.tapePlaying = false;
        this.audio.tape(false);
        return;
      }
      setTimeout(tick, 200);
    };
    tick();
  }

  // ------------------------------------------------------- end states

  beginFailure() {
    const b = this.sim.breach;
    this.fsm.set(STATES.FAILING);
    this.failure = { t: 0, entityId: b.entityId, via: b.via };
    this.interaction.enabled = false;
    this.interaction.cancelHold();
    if (this.docs.open) this.docs.hide();
    if (this.workstationOpen) this.closeWorkstation(true);
    this.hud.setDimmed(true);
    this.hints.reset();
    this.radio.stop();
    this.voice.stop();
    const gentle = this.settings.get('noStartle');
    // No-startle mode: nothing is shown in the doorway, the room just goes dark.
    this.entities.stageBreach(b.entityId, gentle ? 'HIDDEN' : b.via);
    this.audio.tape(false);
    const cues = gentle ? GENTLE_FAILURE_CUES : FAILURE_CUES;
    this.subtitles.show(cues[b.entityId] ?? '[The station goes very quiet]', 'warning', 7);
  }

  updateFailure(dt) {
    const f = this.failure;
    f.t += dt;
    const k = Math.min(1, f.t / FAILURE_SECONDS);
    this.failureProgress = Math.min(1, Math.max(0, (f.t - 0.8) / (FAILURE_SECONDS - 2.5)));
    this.audio.setFailure(k);
    this.entities.updateBreach(f.entityId, f.t / 6);
    // Subject 02: every monitor shows the station itself, empty.
    this.failureHidesFeed = f.entityId === ENTITY_IDS.OBSERVER ? false : k > 0.2;
    if (f.t > FAILURE_SECONDS - 2.6 && !f.fading) {
      f.fading = true;
      this.setFade(1);
      this.audio.setFade(0.15, 2.4);
    }
    if (f.t >= FAILURE_SECONDS) {
      this.fsm.set(STATES.ENDED);
      this.hud.setVisible(false);
      this.expectUnlock = true;
      this.player.releaseLock();
      if (!document.pointerLockElement) this.expectUnlock = false;
      this.player.enabled = false;
      this.endScreen.showFailure(this.sim.getSummary());
      this.audio.setFailure(0.6);
      this.audio.setFade(0.35, 3);
    }
  }

  beginVictory() {
    this.fsm.set(STATES.VICTORY);
    this.victory = { t: 0, lines: 0 };
    this.interaction.enabled = false;
    this.interaction.cancelHold();
    if (this.workstationOpen) this.closeWorkstation(true);
    if (this.docs.open) this.docs.hide();
    this.audio.chime();
    this.hints.reset();
    this.radio.stop();
    this.subtitles.show('[Somewhere above, the morning systems begin to hum]', 'ambient', 6);
  }

  updateVictory(dt) {
    const v = this.victory;
    v.t += dt;
    // The deviation ending: WARDEN reports the deviation instead of "contained", then R. speaks.
    const deviation = this.mode === 'NIGHT' && !!this.sim.deviation;
    const lines = deviation ? DEVIATION_LINES : victoryLines(this.mode === 'NIGHT' ? this.night : 1);
    // The contained ending: after the report, the screen crossfades to CAM 13, the station filed as CELL 05.
    const contained = this.mode === 'NIGHT' && this.night >= NIGHT_COUNT && !deviation;
    const duration = deviation ? DEVIATION_VICTORY_SECONDS : contained ? CONTAINED_VICTORY_SECONDS : VICTORY_SECONDS;
    if (contained && v.cell05At === undefined && v.t > 0.8 + lines.length * 1.2 + 1.2) {
      v.cell05At = v.t;
      this.hud.setVisible(false);
      this.cell05Time.textContent = `N-17 ${formatGameClock(this.sim.gameHours)}  1998-10-23`;
      this.cell05Label.classList.add('visible');
    }
    while (v.lines < lines.length && v.t > 0.8 + v.lines * 1.2) {
      this.pushMessage(lines[v.lines], 'facility', v.lines === 0);
      this.voice.say(deviation ? deviationLineId(v.lines) : morningLineId(this.mode === 'NIGHT' ? this.night : 1, v.lines));
      v.lines++;
    }
    if (deviation && !v.radio && v.t > 0.8 + lines.length * 1.2 + 0.8) {
      v.radio = true;
      this.audio.radioChirp();
      this.pushMessage(`R: ${DEVIATION_RADIO}`, 'radio');
      this.subtitles.show(`R: ${DEVIATION_RADIO}`, 'radio', 5);
      this.voice.say(DEVIATION_RADIO_ID);
    }
    if (v.t > duration - 2.6 && !v.fading) {
      v.fading = true;
      this.setFade(1);
      this.audio.setFade(0.3, 2.4);
      this.cell05Label.classList.remove('visible');
    }
    if (v.t >= duration) {
      this.fsm.set(STATES.ENDED);
      this.hud.setVisible(false);
      this.expectUnlock = true;
      this.player.releaseLock();
      if (!document.pointerLockElement) this.expectUnlock = false;
      this.player.enabled = false;
      if (this.mode === 'PRACTICE') {
        this.endScreen.showPracticeComplete(this.sim.getSummary(), this.coach.lessonsDone);
        this.coach.stop();
      } else if (this.mode === 'NIGHT') {
        const next = this.progress.complete(this.night);
        const final = this.night >= NIGHT_COUNT;
        if (final) this.progress.recordEnding(deviation ? 'deviation' : 'contained');
        const newFiles = this.progress.unlockFiles(subjectsActive(this.sim));
        this.workstation.setFiles(this.progress.files);
        this.endNext = next;
        this.endScreen.showVictory(this.sim.getSummary(), { lines, next, final, deviation, newFiles });
      } else this.endScreen.showVictory(this.sim.getSummary());
    }
  }

  // ------------------------------------------------------------- frame

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    const realDt = Math.max(0, (now - this.last) / 1000);
    this.last = now;
    const dt = Math.min(0.1, realDt);
    this.fps += (1 / Math.max(0.001, realDt) - this.fps) * 0.05;
    const time = (now - this.clockStart) / 1000;
    const sim = this.sim;

    if (this.state === STATES.PLAYING) {
      // Practice: time runs at half speed while an urgent lesson waits for the player.
      const scale = this.timeScale * (this.coach.slow ? 0.5 : 1);
      if (scale > 0) sim.advance(realDt * scale);
      if (sim.phase === SIM_PHASE.BREACHED) this.beginFailure();
      else if (sim.phase === SIM_PHASE.SURVIVED) this.beginVictory();
    }

    const playing = this.state === STATES.PLAYING;
    const inWorld = playing || this.state === STATES.FAILING || this.state === STATES.VICTORY;
    if (inWorld) {
      const moveScale = this.state === STATES.FAILING ? Math.max(0, 1 - this.failure.t / 4) : this.state === STATES.VICTORY ? 0.6 : 1;
      this.player.enabled = !this.docs.open && !this.workstationOpen;
      this.player.update(dt, moveScale);
      if (playing) {
        if (this.player.walking !== this.lastWalking) {
          this.lastWalking = this.player.walking;
          this.command({ type: 'PLAYER', walking: this.player.walking });
        }
        const zone = this.player.zone;
        if (zone !== this.lastZone) {
          this.lastZone = zone;
          this.command({ type: 'PLAYER', zone });
        }
        this.interaction.enabled = !this.docs.open && !this.workstationOpen;
        this.interaction.update(dt);
        this.environment.update(dt, sim);
        if (this.mode === 'PRACTICE') this.coach.update(sim, this);
        else this.hints.check(HINTS, sim);
        this.radio.update(sim);
      }
      if (this.state === STATES.FAILING) this.updateFailure(dt);
      if (this.state === STATES.VICTORY) this.updateVictory(dt);
    } else if (this.state === STATES.MENU || this.state === STATES.SPLASH) {
      this.updateMenuCamera(time);
    }

    // Presentation.
    this.entities.update(sim, dt, time);
    this.lighting.update(dt, time, sim, {
      failure: this.state === STATES.FAILING ? this.failureProgress : this.state === STATES.ENDED && this.failure ? 1 : 0,
      morning: this.state === STATES.VICTORY ? Math.min(1, this.victory.t / 5) : 0
    });
    this.station.update(dt, time, sim, this);
    if (this.audio.ready) {
      const listenerCam = this.state === STATES.MENU || this.state === STATES.SPLASH ? this.menuCam : this.camera;
      this.audio.updateListener(listenerCam);
      const threat = playing ? this.soundscape.update(dt) : 0;
      const ambience = playing || this.state === STATES.FAILING
        ? { hush: playing && this.soundscape.hush, dread: this.soundscape.dread, tubes: this.lighting.tubeSound }
        : { hush: false, dread: 0, tubes: this.lighting.tubeSound };
      this.audio.updateLayers(sim, dt, threat, ambience);
      this.cameraSpeaker.update(sim, dt, { open: this.workstationOpen, active: playing || this.state === STATES.PAUSED });
    }
    if (playing || this.state === STATES.FAILING) {
      this.updateWarnings(sim);
      this.hud.update(sim, this.interaction, this.fps, this.settings.get('showFps'));
      if (this.workstationOpen && (!this.nextWsUpdate || time > this.nextWsUpdate)) {
        this.nextWsUpdate = time + 0.2; // DOM-heavy: 5 Hz is plenty
        this.workstation.update(sim, this.messages);
      }
    }
    this.subtitles.update();
    this.hints.update();
    this.debugger.update();

    this.render(time, dt);
  }

  updateMenuCamera(time) {
    const c = this.menuCam;
    const a = time * 0.03;
    c.position.set(-2.6 + Math.sin(a) * 0.4, 1.75 + Math.sin(time * 0.2) * 0.03, 2.3 + Math.cos(a) * 0.3);
    c.lookAt(0.2, 1.1, -2.6);
  }

  updateWarnings(sim) {
    const s = sim.security;
    this.hud.setWarning('power', sim.power.failed ? 'MAIN POWER DEPLETED' : sim.power.level < 15 ? 'MAIN POWER CRITICAL' : null);
    this.hud.setWarning('wdoor', s.doors.WEST_DOOR.damaged ? 'WEST DOOR MOTOR FAILURE' : null);
    this.hud.setWarning('edoor', s.doors.EAST_DOOR.damaged ? 'EAST DOOR MOTOR FAILURE' : null);
    this.hud.setWarning('thermal', sim.surveillance.thermalShutdown ? 'CAMERA RACK THERMAL SHUTDOWN' : sim.surveillance.thermal > 0.8 ? 'CAMERA RACK OVERHEATING' : null, sim.surveillance.thermalShutdown ? '' : 'info');
  }

  feedParams(sim, time, room) {
    const sv = sim.surveillance;
    const status = sv.feedStatus(room);
    const gentle = this.settings.get('noStartle');
    // No-startle mode: disruptions dim the feed smoothly (feedDip) instead of a static burst.
    let staticAmount = 0.06 + (gentle ? 0 : this.feedDisruption ?? 0);
    let distort = 0;
    for (const e of sim.ai.entities) {
      if (e.currentRoom !== room) continue;
      if (e.id === ENTITY_IDS.ECHO) distort = this.settings.get('reducedDistortion') ? 0.25 : 1;
      if (e.id === ENTITY_IDS.OBSERVER && e.detected) staticAmount += (e.agitation / 10) * 0.25;
    }
    if (status === 'DISRUPTED' && !gentle) staticAmount = Math.max(staticAmount, 0.7);
    if (sv.thermal > 0.7) staticAmount += (sv.thermal - 0.7) * (gentle ? 0.5 : 1.2);
    if (!gentle && Math.sin(time * 0.37) * Math.sin(time * 1.13) > 0.93) staticAmount += 0.25; // signal degradation
    if (gentle) staticAmount = Math.min(staticAmount, 0.3);
    const noSignal = status === 'NO_SIGNAL' || status === 'THERMAL' || status === 'OFFLINE' || status === 'NO_POWER' ? 1 : 0;
    const roomLit = ROOMS[room]?.lightable && sim.security.isCorridorLit(room);
    return { time, staticAmount: Math.min(1, staticAmount), noSignal, distort, bright: roomLit ? 1.9 : 2.8, dim: gentle ? 1 - 0.6 * this.feedDip : 1 };
  }

  render(time, dt) {
    const sim = this.sim;
    const r = this.renderer;
    this.feedDisruption = Math.max(0, (this.feedDisruption ?? 0) - dt * 1.4);
    const roomId = sim.surveillance.selected;
    {
      const disrupted = this.feedDisruption > 0.05 || sim.surveillance.isDisrupted(roomId);
      const target = disrupted ? 1 : 0;
      this.feedDip += (target - this.feedDip) * Math.min(1, dt * (target > this.feedDip ? 2.5 : 0.9));
    }
    const room = this.facility.rooms[roomId];
    const focusK = this.player.override?.k ?? 0;
    const showFeed = this.workstationOpen && focusK > 0.92 && this.state === STATES.PLAYING;
    const observerFailure = this.state === STATES.FAILING && this.failure.entityId === ENTITY_IDS.OBSERVER;
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    // Two moments put the station itself on every screen: the Observer's failure
    // (CAM 00, the station empty) and the contained ending (CAM 13, filed as CELL 05).
    const stationFeed = observerFailure
      ? {
          cam: this.stationCam,
          alpha: clamp01((this.failureProgress - 0.3) / 0.35),
          staticAmount: 0.15 + this.failureProgress * 0.3,
          dim: 1 - Math.max(0, (this.failure.t - (FAILURE_SECONDS - 2.5)) / 2.5)
        }
      : this.state === STATES.VICTORY && this.victory?.cell05At !== undefined
        ? { cam: this.cell05Cam, alpha: clamp01((this.victory.t - this.victory.cell05At) / CELL05_CROSSFADE), staticAmount: 0.1, dim: 1 }
        : null;

    if (stationFeed) {
      if (!this.nextStationFeed || time > this.nextStationFeed) {
        this.nextStationFeed = time + 1 / 12;
        r.setRenderTarget(this.feeds.feedRT);
        r.render(this.facility.scene, stationFeed.cam);
        r.setRenderTarget(null);
        this.feeds.renderMonitor({ time, staticAmount: 0.2, noSignal: 0, distort: 0 });
      }
      // Crossfade (never a cut) from the room into the station feed.
      if (stationFeed.alpha >= 0.999) {
        this.feeds.renderToScreen({ time, staticAmount: stationFeed.staticAmount, noSignal: 0, distort: 0, dim: stationFeed.dim }, this.aspect);
        return;
      }
    } else if (showFeed) {
      if (!this.nextFeed || time > this.nextFeed) {
        this.nextFeed = time + 1 / 24;
        this.lighting.updateRemoteRoom(room, sim, time, 1 / 24);
        this.feeds.renderRoom(room);
      }
      this.feeds.renderToScreen(this.feedParams(sim, time, roomId), this.aspect);
      return;
    } else if (sim.surveillance.operational) {
      if (!this.nextMonitor || time > this.nextMonitor) {
        this.nextMonitor = time + 1 / 8;
        this.lighting.updateRemoteRoom(room, sim, time, 1 / 8);
        this.feeds.renderRoom(room);
        this.feeds.renderMonitor(this.feedParams(sim, time, roomId));
      }
    }

    const cam = this.state === STATES.MENU || this.state === STATES.SPLASH ? this.menuCam : this.camera;
    const reduced = this.settings.get('reducedDistortion');
    const f = this.state === STATES.FAILING ? this.failureProgress : 0;
    const echoDistort = this.state === STATES.FAILING && this.failure.entityId === ENTITY_IDS.ECHO ? f * (reduced ? 0.15 : 1.2) : 0;
    const tint = this.tint ?? (this.tint = new THREE.Color());
    tint.setRGB(1, 1, 1);
    if (this.state === STATES.FAILING && this.failure.entityId === ENTITY_IDS.PATIENT) tint.setRGB(1 - f * 0.35, 1 - f * 0.15, 1 + f * 0.2);
    if (sim.power.failed && this.state === STATES.PLAYING) tint.setRGB(1.05, 0.92, 0.9);
    this.postfx.renderScene(this.facility.scene, cam, {
      enabled: this.settings.get('postProcessing'),
      time,
      grain: reduced ? 0.25 : 0.55,
      bloom: this.settings.get('lightingQuality') === 'low' ? 0 : 0.55,
      vignette: 1.05,
      chroma: reduced ? 0 : 0.0035,
      distort: echoDistort,
      desat: 0.12 + f * 0.6,
      tint
    });
    if (stationFeed && stationFeed.alpha > 0) {
      this.feeds.renderToScreen({ time, staticAmount: stationFeed.staticAmount, noSignal: 0, distort: 0, alpha: stationFeed.alpha }, this.aspect);
    }
  }

  // ------------------------------------------------------------ settings

  applySettings(key) {
    const s = this.settings;
    const all = key === '*';
    if (all || key === 'fov') {
      this.camera.fov = s.get('fov');
      this.camera.updateProjectionMatrix();
    }
    if (all || key === 'renderDistance') {
      const d = s.get('renderDistance');
      this.camera.far = d;
      this.camera.updateProjectionMatrix();
      this.facility.scene.fog.far = d;
    }
    if (all || key === 'brightness') this.renderer.toneMappingExposure = 1.15 * s.get('brightness');
    if (all || key === 'resolutionScale') {
      this.resize();
      this.feeds.setQuality(s.get('resolutionScale'));
    }
    if (all || key === 'shadows') {
      this.renderer.shadowMap.enabled = s.get('shadows');
      this.facility.scene.traverse((o) => {
        if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true));
      });
    }
    if (all || key === 'lightingQuality') this.lighting.setQuality(s.get('lightingQuality'));
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2) * this.settings.get('resolutionScale');
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.postfx.setSize(size.x, size.y);
    this.aspect = w / h;
    for (const c of [this.camera, this.menuCam]) {
      c.aspect = this.aspect;
      c.updateProjectionMatrix();
    }
  }
}

const GENTLE_FAILURE_CUES = {
  SUBJECT_01: '[The lights slowly go out. Subject 01 came through the open door]',
  SUBJECT_02: '[Every monitor switches to the same feed: this room. Subject 02 came through the open door]',
  SUBJECT_03: '[The sounds of the room slowly fade. Subject 03 came down through the vent]',
  SUBJECT_04: '[The air turns cold and the lights fade. Subject 04 came through the door]'
};

const FAILURE_CUES = {
  SUBJECT_01: '[The door frame darkens. Something very tall stands in it, and does not move]',
  SUBJECT_02: '[Every monitor switches to the same feed: this room]',
  SUBJECT_03: '[The scraping stops directly above you. Every sound begins to bend]',
  SUBJECT_04: '[The air turns cold. Slow breathing, inside the room now]'
};
