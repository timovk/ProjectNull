import { NIGHT_COUNT } from '../config/GameConfig.js';
import { SUBJECT_ORDER } from '../content/SubjectFiles.js';

const STORAGE_KEY = 'project-null.progress.v1';

/**
 * Campaign progress: which nights are unlocked and completed, which endings
 * have been reached, and whether R.'s note on the Night 5 work order has
 * been read (it unlocks the deviation ending), and which subject records
 * the workstation's FILES tab can show. Stored in
 * localStorage when available (guarded: private windows simply start fresh).
 * Pass `unlockAll` (debug builds, ?debug=1) to open every night.
 */
export class Progress {
  constructor({ unlockAll = false, storage = globalThis.localStorage } = {}) {
    this.storage = storage;
    this.unlockAll = unlockAll;
    this.state = { unlocked: 1, completed: [], endings: { contained: false, deviation: false }, deviationNoteRead: false, files: [] };
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      const v = raw ? JSON.parse(raw) : null;
      if (v && Number.isInteger(v.unlocked)) {
        this.state.unlocked = Math.max(1, Math.min(NIGHT_COUNT, v.unlocked));
        this.state.completed = Array.isArray(v.completed) ? v.completed.filter((n) => Number.isInteger(n) && n >= 1 && n <= NIGHT_COUNT) : [];
        this.state.endings = { contained: v.endings?.contained === true, deviation: v.endings?.deviation === true };
        this.state.deviationNoteRead = v.deviationNoteRead === true;
        // Saves from before the subject records: grant what those nights would have earned.
        this.state.files = Array.isArray(v.files)
          ? SUBJECT_ORDER.filter((id) => v.files.includes(id))
          : this.state.completed.length ? SUBJECT_ORDER.slice(0, this.state.completed.some((n) => n >= 2) ? 4 : 3) : [];
      }
    } catch {
      /* storage unavailable or corrupt: start fresh */
    }
  }

  save() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      /* storage unavailable */
    }
  }

  isUnlocked(night) {
    return this.unlockAll || night <= this.state.unlocked;
  }

  isCompleted(night) {
    return this.state.completed.includes(night);
  }

  /** The night the Continue button should start. */
  get current() {
    for (let n = 1; n <= NIGHT_COUNT; n++) if (this.isUnlocked(n) && !this.isCompleted(n)) return n;
    return NIGHT_COUNT;
  }

  get allComplete() {
    return this.state.completed.length >= NIGHT_COUNT;
  }

  get deviationNoteRead() {
    return this.state.deviationNoteRead;
  }

  markDeviationNoteRead() {
    if (this.state.deviationNoteRead) return;
    this.state.deviationNoteRead = true;
    this.save();
  }

  /** 'contained' or 'deviation'. */
  hasEnding(kind) {
    return this.state.endings[kind] === true;
  }

  recordEnding(kind) {
    if (!(kind in this.state.endings)) return;
    this.state.endings[kind] = true;
    this.save();
  }

  /** Subject ids whose records are unlocked, in subject order. */
  get files() {
    return [...this.state.files];
  }

  /** Unlock subject records. Returns the ids that were new. */
  unlockFiles(ids) {
    const fresh = SUBJECT_ORDER.filter((id) => ids.includes(id) && !this.state.files.includes(id));
    if (!fresh.length) return [];
    this.state.files = SUBJECT_ORDER.filter((id) => this.state.files.includes(id) || fresh.includes(id));
    this.save();
    return fresh;
  }

  /** Mark a night survived and unlock the next. Returns the next night or null. */
  complete(night) {
    if (!this.state.completed.includes(night)) this.state.completed.push(night);
    const next = night < NIGHT_COUNT ? night + 1 : null;
    if (next && next > this.state.unlocked) this.state.unlocked = next;
    this.save();
    return next;
  }
}
