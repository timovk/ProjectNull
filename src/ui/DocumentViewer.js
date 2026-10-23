import { el } from './dom.js';
import { DOCUMENTS } from '../content/Documents.js';

/** Paper document overlay. Does NOT pause the night. */
export class DocumentViewer {
  constructor(root, { onClose }) {
    this.onClose = onClose;
    this.paper = el('div', { class: 'paper' });
    this.node = el('div', { id: 'document', class: 'interactive hidden', onclick: (e) => { if (e.target === this.node) this.onClose(); } }, [this.paper]);
    root.append(this.node);
    this.open = false;
    this.read = new Set();
  }

  show(docId) {
    const doc = DOCUMENTS[docId];
    if (!doc) return false;
    this.read.add(docId);
    this.paper.className = `paper ${doc.kind === 'note' ? 'note' : ''}`;
    this.paper.replaceChildren(
      el('h2', { text: doc.title }),
      ...doc.body.map((line) => el('p', { text: line || ' ' })),
      el('div', { class: 'close-hint', text: '[E] or [Esc] to put it down. The night does not pause while you read.' })
    );
    this.paper.scrollTop = 0;
    this.node.classList.remove('hidden');
    requestAnimationFrame(() => this.node.classList.add('visible'));
    this.open = true;
    return true;
  }

  hide() {
    this.node.classList.remove('visible');
    this.node.classList.add('hidden');
    this.open = false;
  }
}
