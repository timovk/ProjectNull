/**
 * Ring-buffered record of real simulation events. The AI debugger reads from
 * here; nothing in the debugger is synthesized.
 */
export class EventLog {
  constructor(capacity = 4000) {
    this.capacity = capacity;
    this.buffer = [];
    this.sequence = 0;
    this.counts = Object.create(null);
  }

  push(record) {
    record.seq = ++this.sequence;
    this.buffer.push(record);
    // Trim in batches so pushes stay amortized O(1).
    if (this.buffer.length > this.capacity * 1.25) this.buffer.splice(0, this.buffer.length - this.capacity);
    const key = record.outcome ?? record.type;
    if (key) this.counts[key] = (this.counts[key] ?? 0) + 1;
    return record;
  }

  since(seq) {
    if (!this.buffer.length || seq >= this.sequence) return [];
    const first = this.buffer[0].seq;
    const start = Math.max(0, seq + 1 - first);
    return this.buffer.slice(start);
  }

  recent(n = 50) {
    return this.buffer.slice(-n);
  }

  clear() {
    this.buffer = [];
    this.sequence = 0;
    this.counts = Object.create(null);
  }
}
