/**
 * Spine Wave Propagation System
 * 
 * Creates fluid, traveling wave motion through the spine chain that responds
 * to flight dynamics. Head leads, tail follows with phase delay for natural
 * "whiplash" effect.
 * 
 * Phase 1 of AAA Flight Animation Enhancement Plan.
 */

import { Object3D } from 'three';
import { applyBoneOffset } from './boneOffsets';

/**
 * Configuration for spine wave behavior
 */
export const SPINE_WAVE_CONFIG = {
  // Frequency of oscillation (Hz)
  baseFrequency: 2.5,
  
  // Phase delay per bone (fraction of cycle, 0-1)
  // Head leads, tail follows by 12% cycle per bone
  phaseDelayPerBone: 0.12,
  
  // Amplitude limits (radians)
  minAmplitude: 0.02,
  maxAmplitude: 0.08,
  
  // Speed at which amplitude reaches maximum
  speedForMaxAmplitude: 30,
  
  // Speed at which amplitude reaches minimum
  speedForMinAmplitude: 5,
  
  // Turn rate influence on asymmetry (0-1)
  turnAsymmetryFactor: 0.15,
  
  // Weight distribution for spine chain (from WYVERN_RIG_MEASUREMENTS.md)
  // Spine → Spine1 → Spine2 → Spine3 → Pelvis
  spineWeights: [0.08, 0.18, 0.25, 0.30, 0.19],
  
  // Weight distribution for neck chain (from measurements)
  // Neck → Neck1 → Neck2 → Head
  neckWeights: [0.20, 0.25, 0.30, 0.25],
} as const;

/**
 * Propagates a traveling wave through the spine chain.
 * Creates fluid S-curve motion from head to tail.
 * 
 * @param spineBones - Ordered array of spine bones (head to tail)
 * @param basePhase - Normalized phase (0-1) from time accumulator
 * @param horizontalSpeed - Current flight speed (units/second)
 * @param turnRate - Current turn rate (radians/second, positive = left)
 * @param options - Optional overrides for config
 */
export function propagateSpineWave(
  spineBones: Object3D[],
  basePhase: number,
  horizontalSpeed: number,
  turnRate: number,
  options?: Partial<{
    baseFrequency: number
    phaseDelayPerBone: number
    minAmplitude: number
    maxAmplitude: number
    speedForMaxAmplitude: number
    speedForMinAmplitude: number
    turnAsymmetryFactor: number
    spineWeights: readonly number[]
    neckWeights: readonly number[]
  }>
): void {
  if (spineBones.length === 0) return;
  
  const config = { ...SPINE_WAVE_CONFIG, ...options };
  
  // Calculate amplitude based on speed
  // Faster flight = larger amplitude (more pronounced undulation)
  const speedRange = config.speedForMaxAmplitude - config.speedForMinAmplitude;
  const speedRatio = Math.max(0, Math.min(1,
    (horizontalSpeed - config.speedForMinAmplitude) / speedRange
  ));
  
  const amplitude = config.minAmplitude + 
    speedRatio * (config.maxAmplitude - config.minAmplitude);
  
  // Turn rate creates asymmetry (one side compresses more)
  const turnInfluence = Math.max(-0.1, Math.min(0.1, 
    turnRate * config.turnAsymmetryFactor
  ));
  
  // Get weights (use default if fewer bones than expected)
  const weights = config.spineWeights;
  
  // Apply wave to each bone
  spineBones.forEach((bone, index) => {
    // Phase delay creates traveling wave effect
    const localPhase = (basePhase + index * config.phaseDelayPerBone) % 1.0;
    
    // Weight decreases towards tail (head leads)
    const weight = index < weights.length ? weights[index]! : 0.15;
    
    // Primary wave: sagittal undulation (local-Z pitch)
    // Sinusoidal motion with phase delay
    const pitchAmplitude = amplitude * weight;
    const pitch = Math.sin(localPhase * Math.PI * 2) * pitchAmplitude;
    
    // Secondary motion: lateral sway (local-Y yaw)
    // Influenced by turn rate for asymmetry
    const swayPhase = (localPhase + 0.25) % 1.0; // 90° offset from pitch
    const swayAmplitude = amplitude * weight * 0.4; // Less lateral than sagittal
    const sway = Math.sin(swayPhase * Math.PI * 2) * swayAmplitude + turnInfluence * weight;
    
    // Minimal roll (local-X) - slightly counteract banking
    const roll = Math.sin(localPhase * Math.PI * 2) * amplitude * weight * 0.1;
    
    // Apply offsets using existing bone system
    applyBoneOffset(bone, pitch, sway, roll);
  });
}

/**
 * Propagates wave through neck chain with different characteristics.
 * Neck is more responsive and has smoother curves than spine.
 * 
 * @param neckBones - Ordered array of neck bones (Neck → Neck1 → Neck2 → Head)
 * @param basePhase - Normalized phase (0-1)
 * @param horizontalSpeed - Current flight speed
 * @param headTargetYaw - Target yaw for head tracking (radians)
 * @param headTargetPitch - Target pitch for head tracking (radians)
 */
export function propagateNeckWave(
  neckBones: Object3D[],
  basePhase: number,
  horizontalSpeed: number,
  headTargetYaw: number = 0,
  headTargetPitch: number = 0
): void {
  if (neckBones.length === 0) return;
  
  // Neck has gentler undulation than spine
  const speedRatio = Math.max(0, Math.min(1, horizontalSpeed / 30));
  const amplitude = 0.015 + speedRatio * 0.025; // Smaller amplitude for neck
  
  const weights = SPINE_WAVE_CONFIG.neckWeights;
  const phaseDelay = 0.15; // Slightly larger phase delay for serpentine neck
  
  neckBones.forEach((bone, index) => {
    const localPhase = (basePhase + index * phaseDelay) % 1.0;
    const weight = index < weights.length ? weights[index]! : 0.25;
    
    // Neck follows spine wave pattern
    const pitch = Math.sin(localPhase * Math.PI * 2) * amplitude * weight;
    
    // Slight yaw oscillation
    const yaw = Math.sin((localPhase + 0.33) * Math.PI * 2) * amplitude * weight * 0.3;
    
    // Head tracking influence (distributed across bones)
    const trackInfluence = weight;
    const trackedYaw = headTargetYaw * trackInfluence;
    const trackedPitch = headTargetPitch * trackInfluence * 0.5; // Less pitch distribution
    
    applyBoneOffset(bone, pitch + trackedPitch, yaw + trackedYaw, 0);
  });
}

/**
 * Combined spine + neck wave propagation for full body coordination.
 * This is the main entry point for Phase 1.
 * 
 * @param skeleton - Object containing spine and neck bone arrays
 * @param basePhase - Normalized phase (0-1) from time accumulator
 * @param horizontalSpeed - Current flight speed
 * @param turnRate - Current turn rate
 * @param headTarget - Optional head tracking target (yaw, pitch)
 */
export function propagateFullBodyWave(
  skeleton: {
    spine: Object3D[];
    neck: Object3D[];
  },
  basePhase: number,
  horizontalSpeed: number,
  turnRate: number,
  headTarget?: { yaw: number; pitch: number }
): void {
  // Propagate spine wave
  propagateSpineWave(
    skeleton.spine,
    basePhase,
    horizontalSpeed,
    turnRate
  );
  
  // Propagate neck wave (with optional head tracking)
  propagateNeckWave(
    skeleton.neck,
    basePhase,
    horizontalSpeed,
    headTarget?.yaw ?? 0,
    headTarget?.pitch ?? 0
  );
}

/**
 * Utility: Calculate phase from time accumulator.
 * Use this in useFrame to maintain consistent phase.
 * 
 * @param timeAccumulator - Running time total (seconds)
 * @param frequency - Oscillation frequency (Hz)
 * @returns Normalized phase (0-1)
 */
export function calculatePhase(timeAccumulator: number, frequency: number = 2.5): number {
  return (timeAccumulator * frequency) % 1.0;
}

/**
 * Performance optimization: Batch apply spine wave to multiple wyverns.
 * Reduces per-bone quaternion allocations by reusing objects.
 */
export function propagateSpineWaveBatch(
  wyverns: Array<{
    spineBones: Object3D[];
    neckBones: Object3D[];
    horizontalSpeed: number;
    turnRate: number;
  }>,
  basePhase: number
): void {
  wyverns.forEach(wyvern => {
    propagateFullBodyWave(
      { spine: wyvern.spineBones, neck: wyvern.neckBones },
      basePhase,
      wyvern.horizontalSpeed,
      wyvern.turnRate
    );
  });
}
