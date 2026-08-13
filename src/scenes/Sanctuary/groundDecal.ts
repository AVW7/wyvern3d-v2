/**
 * Shared depth policy for flat translucent decals lying on the ground.
 *
 * Station rings, the editor grid, the selection ring and the placement ghost
 * all sit within a few centimetres of the ground and of each other, which is
 * inside the depth buffer's resolution at the far end of the play area — they
 * shimmer against each other and against the flagstones as the camera moves.
 * Writing no depth and biasing the polygon toward the viewer removes the tie
 * entirely; an explicit `renderOrder` on each mesh then fixes the stacking
 * order that depth-testing would otherwise have decided.
 */
export const GROUND_DECAL = {
  transparent: true,
  depthWrite: false,
  polygonOffset: true,
  polygonOffsetFactor: -1,
  polygonOffsetUnits: -1,
} as const
