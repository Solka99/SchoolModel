import { DEFAULTS, PARAMETERS, normalizeParams, computeMetrics } from './classroom.js';

export const ROOM_SPECS = Object.freeze([
  ...Array.from({ length: 16 }, (_, index) => Object.freeze({
    number: String(101 + index),
    subject: ['Mathematics', 'Science', 'Literature', 'History'][index % 4],
    corridorIndex: Math.floor(index / 4),
    side: 1,
  })),
]);
const ROOM_GAP = 0.4;
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

function transformPoint(corridor, x, z) {
  const cos = Math.cos(corridor.yaw), sin = Math.sin(corridor.yaw);
  return [corridor.center[0] + cos * x + sin * z, corridor.center[2] - sin * x + cos * z];
}

export function schoolLayout(values = {}, specs = ROOM_SPECS) {
  const params = normalizeSchoolParams(values), metrics = computeMetrics(params);
  const roomCounts = specs.reduce((counts, room) => {
    counts[room.corridorIndex] = (counts[room.corridorIndex] || 0) + 1;
    return counts;
  }, []);
  const maxRoomsPerCorridor = Math.max(0, ...roomCounts);
  const roomsSpan = maxRoomsPerCorridor * metrics.roomDepth +
    Math.max(0, maxRoomsPerCorridor - 1) * ROOM_GAP;
  const length = roomsSpan + 4, halfLength = length / 2;
  const corridors = [
    { index: 0, center: [0, 0, -halfLength], yaw: Math.PI / 2, length, name: 'North corridor' },
    { index: 1, center: [halfLength, 0, 0], yaw: 0, length, name: 'East corridor' },
    { index: 2, center: [0, 0, halfLength], yaw: -Math.PI / 2, length, name: 'South corridor' },
    { index: 3, center: [-halfLength, 0, 0], yaw: Math.PI, length, name: 'West corridor' },
  ];
  const corners = corridors.map((corridor, index) => {
    const [x, z] = transformPoint(corridor, 0, halfLength);
    return { index, center: [x, 0, z], yaw: corridor.yaw };
  });
  const entranceZ = -halfLength + 6;
  const roomSlots = [];
  const rooms = specs.map(spec => {
    const corridor = corridors[spec.corridorIndex];
    if (!corridor) throw new Error(`Room ${spec.number} has an invalid corridor.`);
    const roomCount = roomCounts[spec.corridorIndex];
    const slot = roomSlots[spec.corridorIndex] || 0;
    roomSlots[spec.corridorIndex] = slot + 1;
    const sideSpan = roomCount * metrics.roomDepth + Math.max(0, roomCount - 1) * ROOM_GAP;
    const centerZ = -sideSpan / 2 + metrics.roomDepth / 2 + slot * (metrics.roomDepth + ROOM_GAP);
    const localX = spec.side * (params.corridorWidth / 2 + 0.2 + metrics.roomWidth / 2);
    const localZ = centerZ - metrics.centerZ;
    const [x, z] = transformPoint(corridor, localX, localZ);
    const [doorX, doorZ] = transformPoint(corridor, spec.side * (params.corridorWidth / 2 + 0.1),
      localZ + metrics.doorCenterZ);
    const corners = [
      [metrics.xLeft, metrics.zFront], [metrics.xRight, metrics.zFront],
      [metrics.xLeft, metrics.zBack], [metrics.xRight, metrics.zBack],
    ].map(([dx, dz]) => transformPoint(corridor, localX + dx, localZ + dz));
    return {
      ...spec, origin: [x, 0, z], yaw: corridor.yaw,
      localOrigin: [localX, 0, localZ],
      localBounds: { minX: metrics.xLeft, maxX: metrics.xRight, minZ: metrics.zFront, maxZ: metrics.zBack },
      door: [doorX, 1, doorZ],
      bounds: {
        minX: Math.min(...corners.map(point => point[0])),
        maxX: Math.max(...corners.map(point => point[0])),
        minZ: Math.min(...corners.map(point => point[1])),
        maxZ: Math.max(...corners.map(point => point[1])),
      },
    };
  });
  const [spawnX, spawnZ] = transformPoint(corridors[0], -params.corridorWidth / 2 + 1.4, entranceZ);
  return {
    params, metrics, rooms, corridors, corners, length, entranceZ,
    spawn: [spawnX, 0, spawnZ],
  };
}

export function uncoveredSegments(start, end, covered) {
  const result = []; let cursor = start;
  for (const [a, b] of [...covered].sort((a, b) => a[0] - b[0])) {
    if (a > cursor) result.push([cursor, Math.min(a, end)]);
    cursor = Math.max(cursor, b);
  }
  if (cursor < end) result.push([cursor, end]);
  return result.filter(([a, b]) => b > a);
}

export function corridorWallSegments(layout, spec, side) {
  const covered = layout.rooms.filter(room => room.corridorIndex === spec.index && room.side === side).map(room => [
    room.localOrigin[2] + layout.metrics.zFront - 0.2,
    room.localOrigin[2] + layout.metrics.zBack + 0.2,
  ]);
  return uncoveredSegments(-layout.length / 2, layout.length / 2, covered);
}
