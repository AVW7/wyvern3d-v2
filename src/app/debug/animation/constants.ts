import type { ModelState } from '@/render/assets/manifest'
import type { FlightLabPoseEdits, LabCamera, LabTheme } from './FlightLab'

export const WYVERN_MODEL = '/models/wyvern-gothic.glb'
export const WYVERN_ANIMATIONS = '/models/wyvern-gothic.glb'

export const LEG_CHAIN = {
  L: ['L_Thigh', 'L_Calf', 'L_Foot'],
  R: ['R_Thigh', 'R_Calf', 'R_Foot'],
} as const

export const TAIL_CHAIN = [
  'Tail1',
  'Tail2',
  'Tail3',
  'Tail4',
  'Tail5',
  'Tail6',
  'Tail7',
  'Tail8',
  'Tail9',
  'Tail10',
] as const

/**
 * Per-link share of a tail pose edit, root → tip, summing to 1.
 *
 * Ten entries since the chain was extended to cover the last 1205 units of
 * mesh. `Tail1` carries no skin weight — it is the pelvis pivot — so its share
 * is small; the hump sits mid-chain so a bend reads as a curve rather than a
 * hinge at either end.
 */
export const TAIL_WEIGHTS = [0.06, 0.09, 0.12, 0.14, 0.14, 0.13, 0.11, 0.09, 0.07, 0.05] as const

export const MARKERS: { key: string; bone: string; color: string }[] = [
  { key: 'head', bone: 'Head', color: '#f0d9a8' },
  { key: 'pelvis', bone: 'Body', color: '#7fd1c1' },
  { key: 'tail', bone: 'Tail10', color: '#c9773a' },
  { key: 'footL', bone: 'L_Foot', color: '#8fa8d6' },
  { key: 'footR', bone: 'R_Foot', color: '#8fa8d6' },
  { key: 'wingL', bone: 'L_WingD0P2', color: '#d67f9a' },
  { key: 'wingR', bone: 'R_WingD0P2', color: '#d67f9a' },
]

export const CAMERAS: Record<
  LabCamera,
  { position: [number, number, number]; fov: number; target: [number, number, number] }
> = {
  side: { position: [130, 16, 0], fov: 35, target: [0, 8, 0] },
  front: { position: [0, 16, 130], fov: 35, target: [0, 8, 0] },
  top: { position: [0, 125, 0.01], fov: 35, target: [0, 0, 0] },
  // Sized against the largest current clip envelope, not a convenient idle
  // frame. The close predecessors cropped bank and death poses in the Lab.
  threeQuarter: { position: [104, 58, 104], fov: 40, target: [0, 8, 0] },
  sanctuary: { position: [0, 36, 93], fov: 60, target: [0, 10, 0] },
  battle: { position: [0, 31, 88], fov: 65, target: [0, 6, 0] },
}

export const CAMERA_KEYS: LabCamera[] = ['side', 'front', 'top', 'threeQuarter', 'sanctuary', 'battle']

export interface ThemeStyle {
  bg: string
  panelBg: string
  panelBgSolid: string
  cardBg: string
  border: string
  borderTop: string
  text: string
  muted: string
  badgeBg: string
  badgeBorder: string
  badgeText: string
  buttonBg: string
  buttonHoverBg: string
  buttonActiveBg: string
  buttonActiveText: string
  accentColor: string
  accentGlow: string
  segmentedBg: string
  readoutBg: string
  readoutText: string
}

export const GROUPS: { label: string; states: ModelState[] }[] = [
  {
    label: 'Flight',
    states: [
      'fly',
      'airborne',
      'cruise',
      'scout',
      'speed',
      'glide',
      'dive',
      'climb',
      'bankLeft',
      'bankRight',
      'hover',
      'land',
      'breatheAir',
      'attackAir',
    ],
  },
  { label: 'Ground', states: ['idle', 'walk', 'hop', 'attack', 'breathe', 'death'] },
  { label: 'Hunt', states: ['pickUp', 'huntGrip', 'huntCarry', 'drop', 'huntFinish'] },
  {
    label: 'Ambient',
    states: [
      'rest',
      'sleep',
      'sit',
      'seated',
      'rise',
      'eat',
      'drink',
      'groom',
      'perch',
      'nuzzle',
      'calm',
    ],
  },
]

export const SPECIES: { id: `wyvern.${string}`; label: string; scale: number }[] = [
  // First, so the lab opens on it. The rebuilt wing is the thing under review;
  // the five species below it all share the shipped model and differ only by
  // scale, so any of them is the before-picture.
  { id: 'wyvern.gothic', label: 'gothic wing 1.00', scale: 1 },
  { id: 'wyvern.drogon', label: 'drogon v1 (blender) 1.00', scale: 1 },
  { id: 'wyvern.emberback', label: 'emberback 0.85', scale: 0.85 },
  { id: 'wyvern.cragwing', label: 'cragwing 0.90', scale: 0.9 },
  { id: 'wyvern.mirefang', label: 'mirefang 1.00', scale: 1 },
  { id: 'wyvern.frostmaw', label: 'frostmaw 1.05', scale: 1.05 },
  { id: 'wyvern.duskwyrm', label: 'duskwyrm 1.10', scale: 1.1 },
]

export const EXTRA_SCALES: { label: string; value: number }[] = [
  { label: 'hatchling 0.28', value: 0.28 },
  { label: 'juvenile 0.6', value: 0.6 },
  { label: 'adult 1.0', value: 1 },
  { label: 'battle 1.6', value: 1.6 },
]

export const NEUTRAL_POSE_EDITS: FlightLabPoseEdits = {
  bodyX: 0,
  bodyY: 0,
  bodyZ: 0,
  bodyPitch: 0,
  bodyYaw: 0,
  bodyRoll: 0,
  neckPitch: 0,
  neckYaw: 0,
  neckAlignment: 1,
  tailPitch: 0,
  tailYaw: 0,
  tailAlignment: 1,
  legTuck: 0,
  footTuck: 0,
  leftWingPitch: 0,
  leftWingYaw: 0,
  leftWingRoll: 0,
  rightWingPitch: 0,
  rightWingYaw: 0,
  rightWingRoll: 0,
  wingFold: 0,
  wingHeight: 0,
  membraneBillow: 0,
  leftLegPitch: 0,
  leftLegYaw: 0,
  rightLegPitch: 0,
  rightLegYaw: 0,
}

export const THEME_STYLES: Record<LabTheme, ThemeStyle> = {
  dark: {
    bg: 'rgba(15, 19, 26, 0.72)',
    panelBg: 'rgba(15, 19, 26, 0.78)',
    panelBgSolid: 'rgba(15, 19, 26, 0.95)',
    cardBg: 'rgba(255, 255, 255, 0.035)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderTop: 'rgba(255, 255, 255, 0.14)',
    text: '#e2e8f0',
    muted: '#64748b',
    badgeBg: 'rgba(59, 130, 246, 0.12)',
    badgeBorder: 'rgba(59, 130, 246, 0.25)',
    badgeText: '#60a5fa',
    buttonBg: 'rgba(255, 255, 255, 0.06)',
    buttonHoverBg: 'rgba(255, 255, 255, 0.12)',
    buttonActiveBg: '#3b82f6',
    buttonActiveText: '#ffffff',
    accentColor: '#3b82f6',
    accentGlow: 'rgba(59, 130, 246, 0.25)',
    segmentedBg: 'rgba(0, 0, 0, 0.25)',
    readoutBg: 'rgba(10, 14, 20, 0.90)',
    readoutText: '#94a3b8',
  },
  light: {
    bg: 'rgba(255, 255, 255, 0.82)',
    panelBg: 'rgba(255, 255, 255, 0.88)',
    panelBgSolid: 'rgba(255, 255, 255, 0.98)',
    cardBg: 'rgba(0, 0, 0, 0.025)',
    border: 'rgba(0, 0, 0, 0.08)',
    borderTop: 'rgba(0, 0, 0, 0.12)',
    text: '#0f172a',
    muted: '#64748b',
    badgeBg: 'rgba(37, 99, 235, 0.08)',
    badgeBorder: 'rgba(37, 99, 235, 0.2)',
    badgeText: '#2563eb',
    buttonBg: 'rgba(0, 0, 0, 0.04)',
    buttonHoverBg: 'rgba(0, 0, 0, 0.08)',
    buttonActiveBg: '#2563eb',
    buttonActiveText: '#ffffff',
    accentColor: '#2563eb',
    accentGlow: 'rgba(37, 99, 235, 0.2)',
    segmentedBg: 'rgba(0, 0, 0, 0.05)',
    readoutBg: 'rgba(248, 250, 252, 0.95)',
    readoutText: '#334155',
  },
  monochrome: {
    bg: 'rgba(18, 18, 18, 0.85)',
    panelBg: 'rgba(18, 18, 18, 0.90)',
    panelBgSolid: 'rgba(18, 18, 18, 0.98)',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    border: 'rgba(255, 255, 255, 0.1)',
    borderTop: 'rgba(255, 255, 255, 0.18)',
    text: '#f3f4f6',
    muted: '#6b7280',
    badgeBg: 'rgba(255, 255, 255, 0.08)',
    badgeBorder: 'rgba(255, 255, 255, 0.2)',
    badgeText: '#e5e7eb',
    buttonBg: 'rgba(255, 255, 255, 0.06)',
    buttonHoverBg: 'rgba(255, 255, 255, 0.14)',
    buttonActiveBg: '#e5e7eb',
    buttonActiveText: '#111827',
    accentColor: '#e5e7eb',
    accentGlow: 'rgba(255, 255, 255, 0.15)',
    segmentedBg: 'rgba(0, 0, 0, 0.4)',
    readoutBg: 'rgba(12, 12, 12, 0.92)',
    readoutText: '#9ca3af',
  },
}
