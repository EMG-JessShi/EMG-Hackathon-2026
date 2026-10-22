// Overlapping trips (shown as a warning on trip cards). Pure functions only.

// For each trip, the other enabled trips whose break shares at least one day
// with its own break, in start order (then id). Every trip gets an entry, so a
// disabled trip's card can still show what it would clash with. Trips without
// a break have none and appear in no one else's list.
function findOverlaps(trips) {
  const withBreak = trips.filter((t) => t.break);
  const others = withBreak
    .filter((t) => t.enabled)
    .sort((a, b) => (a.break.start < b.break.start ? -1 : a.break.start > b.break.start ? 1 : a.id - b.id));

  const result = {};
  for (const trip of trips) {
    result[trip.id] = trip.break
      ? others
          .filter((o) => o.id !== trip.id && o.break.start <= trip.break.end && trip.break.start <= o.break.end)
          .map((o) => ({ id: o.id, title: o.title, start: o.break.start, end: o.break.end }))
      : [];
  }
  return result;
}

module.exports = { findOverlaps };
