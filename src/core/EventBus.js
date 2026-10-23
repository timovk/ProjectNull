/** Minimal synchronous publish/subscribe bus. */
export class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    this.handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    const set = this.handlers.get(type);
    if (set) for (const h of [...set]) h(payload);
    const any = this.handlers.get('*');
    if (any) for (const h of [...any]) h(type, payload);
  }

  clear() {
    this.handlers.clear();
  }
}
