const test = require('node:test');
const assert = require('node:assert/strict');
const { findOverlaps } = require('./overlaps');

function trip(id, title, start, end, enabled = true) {
  return { id, title, enabled, break: start ? { start, end } : null };
}

const easter = trip(1, 'Easter', '2027-03-26', '2027-04-04');
const sakura = trip(3, 'Japan cherry blossom', '2027-03-26', '2027-04-06');

test('Easter and cherry blossom overlap both ways', () => {
  assert.deepEqual(findOverlaps([easter, sakura]), {
    1: [{ id: 3, title: 'Japan cherry blossom', start: '2027-03-26', end: '2027-04-06' }],
    3: [{ id: 1, title: 'Easter', start: '2027-03-26', end: '2027-04-04' }],
  });
});

test('trips that share only the last and first day overlap', () => {
  const a = trip(1, 'A', '2027-06-01', '2027-06-10');
  const b = trip(2, 'B', '2027-06-10', '2027-06-15');
  const result = findOverlaps([a, b]);
  assert.deepEqual(result[1].map((o) => o.id), [2]);
  assert.deepEqual(result[2].map((o) => o.id), [1]);
});

test('back-to-back trips with a one-day gap do not overlap', () => {
  const a = trip(1, 'A', '2027-06-01', '2027-06-10');
  const b = trip(2, 'B', '2027-06-12', '2027-06-15');
  assert.deepEqual(findOverlaps([a, b]), { 1: [], 2: [] });
  // Next day exactly (no shared day) is not an overlap either
  const c = trip(3, 'C', '2027-06-11', '2027-06-11');
  assert.deepEqual(findOverlaps([a, c]), { 1: [], 3: [] });
});

test("a disabled trip isn't listed for others, but still sees its own overlaps", () => {
  const off = trip(2, 'Off', '2027-03-28', '2027-04-02', false);
  const result = findOverlaps([easter, off, sakura]);
  assert.deepEqual(result[1].map((o) => o.id), [3]);
  assert.deepEqual(result[3].map((o) => o.id), [1]);
  assert.deepEqual(result[2].map((o) => o.id), [1, 3]);
});

test('trips without a break have no overlaps and are never listed', () => {
  const none = trip(4, 'No break', null, null);
  const result = findOverlaps([easter, none, sakura]);
  assert.deepEqual(result[4], []);
  assert.deepEqual(result[1].map((o) => o.id), [3]);
});

test('overlaps are in start order, then id, and crossing the year works', () => {
  const xmas = trip(5, 'Christmas', '2027-12-25', '2028-01-03');
  const nye = trip(9, 'Sydney NYE', '2027-12-29', '2028-01-02');
  const ski = trip(7, 'Hokkaido', '2027-12-29', '2028-01-09');
  const early = trip(8, 'Early', '2027-12-20', '2027-12-26');
  const result = findOverlaps([xmas, nye, ski, early]);
  assert.deepEqual(result[5].map((o) => o.id), [8, 7, 9]);
  assert.deepEqual(result[8].map((o) => o.id), [5]);
  assert.deepEqual(findOverlaps([]), {});
});
