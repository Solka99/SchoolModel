import { DEFAULTS, PARAMETERS, normalizeParams, computeMetrics } from './classroom.js';

export const ROOM_SPECS = Object.freeze([
  { number: '101', subject: 'Mathematics', side: 1, row: 0 },
  { number: '102', subject: 'Science', side: -1, row: 0 },
  { number: '103', subject: 'Literature', side: 1, row: 1 },
]);
export const SCHOOL_DEFAULTS = Object.freeze({ ...DEFAULTS, roomHeight: 4, corridorWidth: 4.4 });
export const SCHOOL_PARAMETERS = [
  ...PARAMETERS.map(p => p.key === 'roomHeight' ? { ...p, min: 3.2 } : p),
  { key: 'corridorWidth', label: 'Corridor width · m', min: 3, max: 6, step: 0.2 },
];
export function normalizeSchoolParams(values = {}) {
  const p = normalizeParams({ ...SCHOOL_DEFAULTS, ...values });
  const width = Number(p.corridorWidth);
  p.corridorWidth = Math.max(3, Math.min(6, Number.isFinite(width) ? width : SCHOOL_DEFAULTS.corridorWidth));
  p.roomHeight = Math.max(3.2, p.roomHeight);
  return p;
}
// Room interiors sit across a shared 0.2-thick wall from the corridor.
// Placement is derived from current classroom dimensions, never hand-copied.
export function schoolLayout(values = {}, specs = ROOM_SPECS) {
  const params = normalizeSchoolParams(values), metrics = computeMetrics(params);
  const entranceDepth = 6, gap = 0.4, endMargin = 2;
  const rows = Math.max(...specs.map(r => r.row)) + 1;
  const length = entranceDepth + rows * (metrics.roomDepth + gap) + endMargin;
  const rooms = specs.map(spec => {
    const origin = [spec.side * (params.corridorWidth / 2 + 0.2 + metrics.roomWidth / 2), 0,
      entranceDepth + spec.row * (metrics.roomDepth + gap) - metrics.zFront];
    const door = [spec.side * (params.corridorWidth / 2 + 0.1), 1, origin[2] + metrics.doorCenterZ];
    return { ...spec, origin, door,
      bounds: { minX: origin[0] + metrics.xLeft, maxX: origin[0] + metrics.xRight,
        minZ: origin[2] + metrics.zFront, maxZ: origin[2] + metrics.zBack } };
  });
  return { params, metrics, rooms, length, entranceDepth, spawn: [0, 0, 1.5] };
}

// Returns the parts of a wall not already supplied by adjoining room shells.
export function uncoveredSegments(start, end, covered) {
  const result = []; let cursor = start;
  for (const [a, b] of [...covered].sort((a, b) => a[0] - b[0])) {
    if (a > cursor) result.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) result.push([cursor, end]);
  return result.filter(([a, b]) => b > a);
}
