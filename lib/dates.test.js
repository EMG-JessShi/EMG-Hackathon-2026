const test = require('node:test');
const assert = require('node:assert/strict');
const { toPerthDateString } = require('./dates');

test('toPerthDateString uses Perth time (UTC+8)', () => {
  // 20:00 UTC on 31 Dec is already 1 Jan in Perth
  assert.equal(toPerthDateString(new Date('2026-12-31T20:00:00Z')), '2027-01-01');
  assert.equal(toPerthDateString(new Date('2027-03-26T00:00:00Z')), '2027-03-26');
});
