import test from 'node:test';
import assert from 'node:assert/strict';
import { Random, hashSeed } from '../src/core/Random.js';

test('same seed produces the same sequence', () => {
  const a = new Random('seed-1');
  const b = new Random('seed-1');
  for (let i = 0; i < 1000; i++) assert.equal(a.int(1, 20), b.int(1, 20));
});

test('different seeds produce different sequences', () => {
  const a = new Random('seed-1');
  const b = new Random('seed-2');
  let same = 0;
  for (let i = 0; i < 1000; i++) if (a.nextUint32() === b.nextUint32()) same++;
  assert.ok(same < 5);
});

test('numeric and string seeds are both accepted', () => {
  assert.equal(new Random(42).int(1, 1000), new Random(42).int(1, 1000));
  assert.equal(typeof hashSeed('N-17'), 'number');
});

test('int stays within bounds and rejects invalid ranges', () => {
  const r = new Random('bounds');
  for (let i = 0; i < 10000; i++) {
    const v = r.int(-3, 3);
    assert.ok(v >= -3 && v <= 3 && Number.isInteger(v));
  }
  assert.equal(r.int(5, 5), 5);
  assert.throws(() => r.int(5, 4));
  assert.throws(() => r.int(1.5, 4));
});

test('next() is in [0, 1)', () => {
  const r = new Random('float');
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
});

test('forked streams are independent of each other and reproducible', () => {
  const master = new Random('master');
  const a1 = master.fork('a');
  const b1 = master.fork('b');
  const master2 = new Random('master');
  const a2 = master2.fork('a');
  // Consuming b does not change a.
  for (let i = 0; i < 100; i++) b1.next();
  for (let i = 0; i < 100; i++) assert.equal(a1.int(1, 20), a2.int(1, 20));
});

test('state can be saved and restored for replay', () => {
  const r = new Random('state');
  r.next();
  const saved = r.getState();
  const seq = [r.int(1, 20), r.int(1, 20), r.int(1, 20)];
  r.setState(saved);
  assert.deepEqual([r.int(1, 20), r.int(1, 20), r.int(1, 20)], seq);
});

test('weightedIndex follows the weights and ignores zero weights', () => {
  const r = new Random('weights');
  const counts = [0, 0, 0];
  const n = 60000;
  for (let i = 0; i < n; i++) counts[r.weightedIndex([1, 0, 3])]++;
  assert.equal(counts[1], 0);
  assert.ok(Math.abs(counts[0] / n - 0.25) < 0.01);
  assert.ok(Math.abs(counts[2] / n - 0.75) < 0.01);
  assert.equal(r.weightedIndex([0, 0]), -1);
});
