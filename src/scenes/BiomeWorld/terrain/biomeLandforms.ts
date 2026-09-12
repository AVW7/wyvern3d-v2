/**
 * What each biome's ground actually looks like, as data.
 *
 * Relief is one expression for every biome:
 *
 * ```text
 * h = amplitude * (macro' * wMacro + ridge * wRidge + micro' * wMicro)   // ' = centred on 0
 *   -> each operator in turn
 *   + datum                                                             // constant shift
 *   + edge^2 * rimLift                                                  // soft playfield wall
 * ```
 *
 * There is no per-biome branch — a new biome is a new row here. The operator
 * vocabulary is shared with the fantasy-biomes studio, so a landform tuned
 * there transfers as this table's data rather than as code.
 *
 * Amplitudes are metres of relief. The world is 220 m across and the walkable
 * contract in `biomeHeight.test.ts` caps |h| well below 25 m, so the budget for
 * interior relief is roughly amplitude + operator reach + rimLift.
 */

import type { GeomorphicOperator } from './landformOperators'

/** Weights on the three basis fields. Omitted entries fall back to `DEFAULT_WEIGHTS`. */
export interface NoiseWeights {
  /** Rolling body of the terrain. Centred on 0, so it cuts as well as lifts. */
  macro?: number
  /** Creased relief over the body. Uncentred, so it lifts the floor as well as
   *  sharpening it — a large weight makes a massif, not just rougher hills. */
  ridge?: number
  /** Metre-scale surface break-up. Centred on 0. Keep small on water biomes: it
   *  is the term that shows up in the protected-site slope contract. */
  micro?: number
}

export interface BiomeLandform {
  /** Metres of relief the weighted noise sum spans. */
  amplitude: number
  weights?: NoiseWeights
  /** Constant shift, e.g. a fen sitting below the bog line. */
  datum?: number
  /** Height added at the world rim (`edge^2 * rimLift`) — the soft boundary
   *  that turns the playfield back rather than fencing it. */
  rimLift: number
  operators?: GeomorphicOperator[]
}

export const DEFAULT_WEIGHTS: Required<NoiseWeights> = { macro: 0.9, ridge: 0.15, micro: 0.3 }

/**
 * The grove's world tree stands on a flat mound. The plateau is authored above
 * `GROVE_MOUND_HEIGHT` so the exported contract stays a floor, not an equality.
 */
const GROVE_PLATEAU_HEIGHT = 3.2

export const BIOME_LANDFORMS: Record<string, BiomeLandform> = {
  // — Gentle, walkable ————————————————————————————————————————————
  valley: {
    amplitude: 1.4,
    weights: { macro: 0.85, ridge: 0.1, micro: 0.3 },
    rimLift: 2.8,
    operators: [{ kind: 'basin', amount: 0.012, radius: 90 }],
  },
  forest: {
    amplitude: 2.2,
    weights: { macro: 0.9, ridge: 0.18, micro: 0.35 },
    rimLift: 4.0,
  },
  jungle: {
    amplitude: 2.6,
    weights: { macro: 0.9, ridge: 0.28, micro: 0.45 },
    rimLift: 4.0,
  },
  grove: {
    amplitude: 1.5,
    weights: { macro: 0.8, ridge: 0.08, micro: 0.28 },
    rimLift: 2.4,
    // Flattens the clearing the world tree and stone ring stand in, then eases
    // back into the meadow well inside the 60 m the mound contract samples.
    operators: [{ kind: 'plateau', amount: 1, radius: 20, height: GROVE_PLATEAU_HEIGHT, blend: 22 }],
  },
  moor: {
    amplitude: 1.8,
    weights: { macro: 0.9, ridge: 0.12, micro: 0.3 },
    rimLift: 3.0,
    operators: [{ kind: 'dune', amount: 0.35, frequency: 0.035, skew: 0.4, warp: 2.2 }],
  },

  // — Water ——————————————————————————————————————————————————————
  // Micro is deliberately low on all four: the protected-site slope contract in
  // `biomeWater.test.ts` measures a 1 m gradient, which micro dominates.
  coast: {
    amplitude: 1.6,
    weights: { macro: 0.85, ridge: 0.1, micro: 0.3 },
    datum: -1.2,
    rimLift: 2.6,
    // A domed shelf rather than a linear cone: flat beach out to 18 m, easing
    // under the tide line by ~65 m.
    operators: [{ kind: 'plateau', amount: 1, radius: 18, height: 2.6, blend: 47 }],
  },
  marsh: {
    amplitude: 1.15,
    weights: { macro: 0.85, ridge: 0.07, micro: 0.25 },
    datum: -0.4,
    rimLift: 2.5,
    operators: [{ kind: 'basin', amount: 0.01, radius: 80 }],
  },
  swamp: {
    amplitude: 1.15,
    weights: { macro: 0.85, ridge: 0.07, micro: 0.25 },
    datum: -0.45,
    rimLift: 2.5,
    operators: [{ kind: 'basin', amount: 0.012, radius: 80 }],
  },
  ashland: {
    amplitude: 1.8,
    weights: { macro: 0.7, ridge: 0.5, micro: 0.22 },
    rimLift: 5.0,
    // A caldera: sunken lava floor, a modest lip. The rim stays low because its
    // flank gradient is bounded by rimHeight * PI / (0.4 * radius).
    operators: [{ kind: 'crater', amount: 1, radius: 34, depth: 2.2, rimHeight: 0.9 }],
  },

  // — Relief ——————————————————————————————————————————————————————
  mountain: {
    // Ridge is held below macro on purpose: weighted past it, the creased-massif
    // character takes over and the range reads as mesa country rather than
    // as ridgelines with valleys between them.
    amplitude: 6.5,
    weights: { macro: 0.95, ridge: 0.7, micro: 0.35 },
    rimLift: 8.0,
    operators: [
      { kind: 'ridgeSpine', amount: 6.0, from: [-70, -40], to: [65, 55], width: 34 },
      { kind: 'terrace', amount: 0.45, stepHeight: 1.6, smoothness: 0.6 },
    ],
  },
  highland: {
    amplitude: 3.4,
    weights: { macro: 0.8, ridge: 0.8, micro: 0.3 },
    rimLift: 5.0,
    operators: [{ kind: 'terrace', amount: 0.45, stepHeight: 1.1, smoothness: 0.55 }],
  },
  spire: {
    amplitude: 2.0,
    weights: { macro: 0.7, ridge: 0.45, micro: 0.28 },
    rimLift: 6.0,
    // The pillar the biome is named for: narrow and tall, ringed by a scree lip.
    operators: [
      { kind: 'plateau', amount: 1, radius: 22, height: 7.0, blend: 26 },
      { kind: 'rim', amount: 1.2, radius: 62, falloff: 300 },
    ],
  },
  cavern: {
    amplitude: 1.9,
    weights: { macro: 0.75, ridge: 0.3, micro: 0.4 },
    rimLift: 7.0,
    operators: [{ kind: 'basin', amount: 0.055, radius: 62 }],
  },

  // — Cold and dry ————————————————————————————————————————————————
  tundra: {
    amplitude: 1.5,
    weights: { macro: 0.85, ridge: 0.1, micro: 0.25 },
    rimLift: 3.0,
    operators: [{ kind: 'dune', amount: 0.55, frequency: 0.028, skew: 0.7, warp: 3.0 }],
  },
  barrens: {
    amplitude: 1.3,
    weights: { macro: 0.8, ridge: 0.12, micro: 0.3 },
    rimLift: 2.8,
    operators: [{ kind: 'dune', amount: 0.7, frequency: 0.045, skew: -0.5, warp: 2.6 }],
  },
}

/** The landform a biome uses. Unknown ids fall back to the gentle `valley` stack. */
export function getBiomeLandform(biome: string): BiomeLandform {
  return BIOME_LANDFORMS[biome] ?? BIOME_LANDFORMS.valley!
}

export { GROVE_PLATEAU_HEIGHT }
