/**
 * Hour-by-hour progression: applies the AI schedule at each hour boundary.
 * Scheduled gate releases are handled by FacilityEvents.
 */
export class NightProgression {
  constructor(sim, schedule) {
    this.sim = sim;
    this.schedule = schedule;
    this.hourIndex = -1;
  }

  update() {
    const h = this.sim.clock.hourIndex;
    if (h === this.hourIndex) return;
    const prev = this.hourIndex;
    this.hourIndex = h;
    this.sim.ai.applySchedule(h, this.schedule);
    this.sim.recordSystem('HOUR', `Hour ${h} begins`, { hourIndex: h, previous: prev });
    this.sim.bus.emit('night:hour', { hourIndex: h, previous: prev });
  }
}
