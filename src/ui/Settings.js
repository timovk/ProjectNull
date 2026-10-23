/**
 * Persistent player settings. Stored in localStorage when available; every
 * access is guarded so the game works in private windows and sandboxes.
 */
const STORAGE_KEY = 'project-null.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  // Controls
  mouseSensitivity: 1.0,
  invertY: false,
  fov: 72,
  // Audio (0..1)
  masterVolume: 0.7,
  ambientVolume: 0.8,
  entityVolume: 0.9,
  interfaceVolume: 0.6,
  // Display / comfort
  brightness: 1.0,
  reducedDistortion: false,
  reducedMotion: false,
  disableFlicker: false,
  subtitles: true,
  hints: true,
  // Graphics
  resolutionScale: 1.0,
  shadows: true,
  postProcessing: true,
  lightingQuality: 'high', // 'low' | 'high'
  renderDistance: 40,
  showFps: false
});

export const SETTING_LIMITS = {
  mouseSensitivity: [0.2, 3.0, 0.05],
  fov: [60, 95, 1],
  masterVolume: [0, 1, 0.01],
  ambientVolume: [0, 1, 0.01],
  entityVolume: [0, 1, 0.01],
  interfaceVolume: [0, 1, 0.01],
  brightness: [0.6, 1.8, 0.01],
  resolutionScale: [0.5, 1.0, 0.05],
  renderDistance: [15, 60, 1]
};

export class Settings {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS, ...this.load() };
    this.listeners = new Set();
  }

  load() {
    try {
      const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      const clean = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (k in DEFAULT_SETTINGS && typeof v === typeof DEFAULT_SETTINGS[k]) clean[k] = v;
      }
      return clean;
    } catch {
      return {};
    }
  }

  save() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* storage unavailable: settings last for this session only */
    }
  }

  get(key) {
    return this.values[key];
  }

  set(key, value) {
    if (!(key in DEFAULT_SETTINGS)) return;
    const limits = SETTING_LIMITS[key];
    if (limits && typeof value === 'number') value = Math.max(limits[0], Math.min(limits[1], value));
    if (this.values[key] === value) return;
    this.values[key] = value;
    this.save();
    for (const fn of this.listeners) fn(key, value, this.values);
  }

  reset() {
    this.values = { ...DEFAULT_SETTINGS };
    this.save();
    for (const fn of this.listeners) fn('*', null, this.values);
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
