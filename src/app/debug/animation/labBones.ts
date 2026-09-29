import type { Object3D } from 'three'

export const MARKER_ALIASES: Record<string, string[]> = {
  head: ['Head', 'Bip002-Head_015'],
  pelvis: ['Body', 'Bip002_06', 'Bip002-Pelvis_07', 'Bip002-Spine_08'],
  tail: ['Tail10', 'Tail6', 'Bip002-Tail8_03', 'Bip002-Tail6_01'],
  footL: ['L_Foot', 'Bip002-L-Foot_0188', 'Bip001-L-Foot_0178', 'Bip002-L-Foot_0226'],
  footR: ['R_Foot', 'Bip002-R-Foot_0202', 'Bip001-R-Foot_0182', 'Bip002-R-Foot_0234'],
  wingL: ['L_WingD0P2', 'L_WingD3P2', 'L_WingD4P2', 'L_WingFinger1_end', 'L_WingFinger3_end', 'L_WingFinger3', 'Bip002-L-Hand_052', 'Bip002-L-Finger3_055'],
  wingR: ['R_WingD0P2', 'R_WingD3P2', 'R_WingD4P2', 'R_WingFinger1_end', 'R_WingFinger3_end', 'R_WingFinger3', 'Bip002-R-Hand_089', 'Bip002-R-Finger3_090'],
}

export function resolveFirstBone(root: Object3D, names: string[]): Object3D | null {
  for (const name of names) {
    const obj = root.getObjectByName(name)
    if (obj) return obj
  }
  return null
}

export function resolveBoneChain(root: Object3D, candidates: (readonly string[])[]): Object3D[] {
  let bestChain: Object3D[] = []
  for (const chain of candidates) {
    const chainBones = chain
      .map((name) => root.getObjectByName(name))
      .filter((b): b is Object3D => b !== null && b !== undefined)
    if (chainBones.length === chain.length) {
      return chainBones
    }
    if (chainBones.length > bestChain.length) {
      bestChain = chainBones
    }
  }
  return bestChain
}
