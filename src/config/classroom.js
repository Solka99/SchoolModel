export const DEFAULTS = Object.freeze({
  seatSections: 3, seatCols: 5, seatRows: 7,
  seatSlotWidth: 0.5, seatSlotDepth: 1.05, seatColGap: 0.1, seatRowGap: 1,
  aisleWidth: 1.5, seatStartZ: 1.6, rowHeight: 0.2,
  roomHeight: 10, frontMargin: 3, backMargin: 1.5, sideMargin: 1.5,
  blackboardWidth: 5, blackboardHeight: 1.3, doorOnLeft: true, doorDistanceFromFront: 1.6,
});
export const PARAMETERS = [
  { key: 'seatRows', label: 'Seating rows', min: 1, max: 20, step: 1 },
  { key: 'seatCols', label: 'Seats per section', min: 2, max: 10, step: 1 },
  { key: 'frontMargin', label: 'Front space · m', min: 1.5, max: 5, step: 0.1 },
  { key: 'roomHeight', label: 'Ceiling height · m', min: 2.5, max: 10, step: 0.1 },
];
export function normalizeParams(values = {}) {
  const p = { ...DEFAULTS, ...values };
  for (const d of PARAMETERS) {
    const value = Number(p[d.key]);
    p[d.key] = Math.max(d.min, Math.min(d.max, Number.isFinite(value) ? value : DEFAULTS[d.key]));
    if (d.step === 1) p[d.key] = Math.round(p[d.key]);
  }
  p.seatSections = Math.max(1, Math.min(5, Math.round(Number(p.seatSections) || 3)));
  p.roomHeight = Math.max(p.roomHeight, p.seatRows * p.rowHeight + 1.8 + 0.3);
  return p;
}
export function computeMetrics(p) {
  const rowDepth = Math.max(p.seatRowGap, p.seatSlotDepth);
  const sectionWidth = p.seatCols * p.seatSlotWidth + (p.seatCols - 1) * p.seatColGap;
  const seatingWidth = p.seatSections * sectionWidth + (p.seatSections - 1) * p.aisleWidth;
  const seatingDepth = p.seatRows * rowDepth;
  const roomWidth = seatingWidth + 2 * p.sideMargin;
  const roomDepth = p.frontMargin + p.seatStartZ + seatingDepth + p.backMargin;
  const zFront = -p.frontMargin, zBack = zFront + roomDepth;
  return { rowDepth, sectionWidth, seatingWidth, seatingDepth, roomWidth, roomDepth,
    xLeft: -roomWidth / 2, xRight: roomWidth / 2, zFront, zBack, centerZ: (zFront + zBack) / 2,
    doorCenterZ: Math.max(zFront + 0.5, Math.min(zBack - 0.5, zFront + p.doorDistanceFromFront)),
    spawn: [1.6, 0, -0.2] };
}
