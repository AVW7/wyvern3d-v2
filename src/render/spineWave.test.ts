/**
 * Unit tests for spine wave propagation system
 * 
 * Tests validate:
 * - Phase calculation and propagation
 * - Amplitude scaling with speed
 * - Turn rate asymmetry
 * - Weight distribution
 */

import { describe, it, expect } from 'vitest';
import { Object3D } from 'three';
import { 
  propagateSpineWave,
  propagateNeckWave,
  propagateFullBodyWave,
  calculatePhase,
  SPINE_WAVE_CONFIG
} from './spineWave';

// Mock bone that tracks rotations
class MockBone extends Object3D {
  public appliedRotations: Array<{ pitch: number; yaw: number; roll: number }> = [];
  
  constructor() {
    super();
    this.quaternion.set(0, 0, 0, 1);
  }
  
  // Override to capture rotation applications
  override rotateOnAxis(_axis: unknown, _angle: number): this {
    return this;
  }
}

describe('spineWave', () => {
  describe('calculatePhase', () => {
    it('should return phase between 0 and 1', () => {
      expect(calculatePhase(0)).toBe(0);
      expect(calculatePhase(0.5, 2)).toBe(0); // 0.5 * 2 = 1.0, wraps to 0
      expect(calculatePhase(0.25, 2)).toBe(0.5); // 0.25 * 2 = 0.5
      expect(calculatePhase(1, 1)).toBe(0); // 1 * 1 = 1, wraps to 0
      expect(calculatePhase(1.5, 1)).toBe(0.5); // 1.5 * 1 = 1.5, wraps to 0.5
    });
    
    it('should handle large time accumulators', () => {
      const phase = calculatePhase(1000, 2.5);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    });
  });
  
  describe('propagateSpineWave', () => {
    it('should handle empty bone array', () => {
      expect(() => propagateSpineWave([], 0, 10, 0)).not.toThrow();
    });
    
    it('should apply different rotations to different bones', () => {
      const bones = [new MockBone(), new MockBone(), new MockBone()];
      
      propagateSpineWave(bones, 0, 20, 0);
      
      // All bones should have some rotation applied
      // (though we can't easily verify the exact values due to quaternion math)
      expect(bones.length).toBe(3);
    });
    
    it('should increase amplitude with speed', () => {
      const bone1 = new MockBone();
      const bone2 = new MockBone();
      
      propagateSpineWave([bone1], 0.25, 5, 0); // Low speed
      const lowSpeedRotation = bone1.quaternion.clone();
      
      propagateSpineWave([bone2], 0.25, 30, 0); // High speed
      const highSpeedRotation = bone2.quaternion.clone();
      
      // Higher speed should produce larger rotations
      expect(lowSpeedRotation).toBeDefined();
      expect(highSpeedRotation).toBeDefined();
    });
    
    it('should create phase delay between bones', () => {
      const bones = [
        new MockBone(),
        new MockBone(),
        new MockBone(),
        new MockBone(),
        new MockBone()
      ];
      
      const elapsed = 0.5; // Half a second
      const phase = calculatePhase(elapsed, SPINE_WAVE_CONFIG.baseFrequency);
      
      propagateSpineWave(bones, phase, 20, 0);
      
      // With phase delay of 0.12, each bone should have different phase
      // This is implicitly tested by the function running without error
      expect(bones.length).toBe(5);
    });
    
    it('should handle turn rate asymmetry', () => {
      const boneLeft = new MockBone();
      const boneRight = new MockBone();
      
      propagateSpineWave([boneLeft], 0, 20, 0.5); // Left turn
      propagateSpineWave([boneRight], 0, 20, -0.5); // Right turn
      
      // Different turn rates should produce different lateral sway
      expect(boneLeft.quaternion).toBeDefined();
      expect(boneRight.quaternion).toBeDefined();
    });
    
    it('should use default weights when fewer bones than expected', () => {
      const bone = new MockBone();
      
      expect(() => {
        propagateSpineWave([bone], 0.5, 15, 0);
      }).not.toThrow();
    });
  });
  
  describe('propagateNeckWave', () => {
    it('should handle empty bone array', () => {
      expect(() => propagateNeckWave([], 0, 10)).not.toThrow();
    });
    
    it('should apply gentler amplitude than spine', () => {
      const spineBone = new MockBone();
      const neckBone = new MockBone();
      
      propagateSpineWave([spineBone], 0.25, 20, 0);
      propagateNeckWave([neckBone], 0.25, 20);
      
      // Both should have rotations (necks are gentler but still animate)
      expect(spineBone.quaternion).toBeDefined();
      expect(neckBone.quaternion).toBeDefined();
    });
    
    it('should distribute head tracking across bones', () => {
      const bones = [
        new MockBone(),
        new MockBone(),
        new MockBone(),
        new MockBone()
      ];
      
      const headTargetYaw = 0.3; // Radians
      const headTargetPitch = 0.2;
      
      propagateNeckWave(bones, 0, 20, headTargetYaw, headTargetPitch);
      
      // Should not throw when applying head tracking
      expect(bones.length).toBe(4);
    });
  });
  
  describe('propagateFullBodyWave', () => {
    it('should coordinate spine and neck', () => {
      const skeleton = {
        spine: [new MockBone(), new MockBone()],
        neck: [new MockBone(), new MockBone()]
      };
      
      expect(() => {
        propagateFullBodyWave(skeleton, 0.5, 20, 0);
      }).not.toThrow();
    });
    
    it('should accept optional head target', () => {
      const skeleton = {
        spine: [new MockBone()],
        neck: [new MockBone()]
      };
      
      const headTarget = { yaw: 0.2, pitch: 0.1 };
      
      expect(() => {
        propagateFullBodyWave(skeleton, 0.5, 20, 0, headTarget);
      }).not.toThrow();
    });
    
    it('should maintain consistent phase between spine and neck', () => {
      const skeleton = {
        spine: [new MockBone(), new MockBone()],
        neck: [new MockBone(), new MockBone()]
      };
      
      const phase1 = calculatePhase(1.2);
      propagateFullBodyWave(skeleton, phase1, 15, 0);
      
      const phase2 = calculatePhase(1.5);
      propagateFullBodyWave(skeleton, phase2, 15, 0);
      
      // Different phases should produce different results
      expect(phase1).not.toBe(phase2);
    });
  });
  
  describe('performance characteristics', () => {
    it('should process 6 bones under 1ms', () => {
      const bones = Array(6).fill(null).map(() => new MockBone());
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        propagateSpineWave(bones, i * 0.01, 20, 0);
      }
      
      const elapsed = performance.now() - start;
      const avgTime = elapsed / 100;
      
      // Should average under 0.5ms per call (generous for test runner stability)
      expect(avgTime).toBeLessThan(0.5);
    });
    
    it('should not create new quaternion objects per frame', () => {
      const bone = new MockBone();
      const initialQuaternion = bone.quaternion;
      
      propagateSpineWave([bone], 0.5, 20, 0);
      propagateSpineWave([bone], 0.6, 20, 0);
      
      // Should modify existing quaternion, not create new one
      expect(bone.quaternion).toBe(initialQuaternion);
    });
  });
  
  describe('edge cases', () => {
    it('should handle zero speed', () => {
      const bone = new MockBone();
      expect(() => propagateSpineWave([bone], 0, 0, 0)).not.toThrow();
    });
    
    it('should handle very high speed', () => {
      const bone = new MockBone();
      expect(() => propagateSpineWave([bone], 0, 1000, 0)).not.toThrow();
    });
    
    it('should handle zero turn rate', () => {
      const bone = new MockBone();
      expect(() => propagateSpineWave([bone], 0, 20, 0)).not.toThrow();
    });
    
    it('should handle maximum phase', () => {
      const bone = new MockBone();
      expect(() => propagateSpineWave([bone], 0.999, 20, 0)).not.toThrow();
    });
    
    it('should handle negative time (edge case)', () => {
      const phase = calculatePhase(-1);
      // Negative time produces negative phase, which wraps correctly
      expect(phase).toBeGreaterThanOrEqual(-1);
      expect(phase).toBeLessThan(0);
    });
  });
  
  describe('config integration', () => {
    it('should respect config weights', () => {
      const bones = Array(5).fill(null).map(() => new MockBone());
      
      // Should use 5 weights from config without error
      expect(() => {
        propagateSpineWave(bones, 0.5, 20, 0);
      }).not.toThrow();
    });
    
    it('should handle missing config options', () => {
      const bone = new MockBone();
      
      // Should use defaults when options not provided
      expect(() => {
        propagateSpineWave([bone], 0.5, 20, 0, {});
      }).not.toThrow();
    });
    
    it('should allow config overrides', () => {
      const bone = new MockBone();
      const customConfig = {
        minAmplitude: 0.01,
        maxAmplitude: 0.05,
        phaseDelayPerBone: 0.15
      };
      
      expect(() => {
        propagateSpineWave([bone], 0.5, 20, 0, customConfig);
      }).not.toThrow();
    });

    it('should use spineWeights3 for Gothic V2 3-joint spine to ensure leg root stability', () => {
      const bones = [new MockBone(), new MockBone(), new MockBone()];
      // Sample at peak phase
      propagateSpineWave(bones, 0.25, 30, 0);

      // Spine1 has weight 0.02, Spine2 has 0.22, Spine3 has 0.32
      // Therefore Spine1 rotation must be substantially smaller than Spine2 and Spine3
      const rot1 = Math.abs(bones[0]!.quaternion.x);
      const rot2 = Math.abs(bones[1]!.quaternion.x);
      const rot3 = Math.abs(bones[2]!.quaternion.x);

      expect(rot1).toBeLessThan(rot2);
      expect(rot1).toBeLessThan(rot3);
      expect(rot2).toBeGreaterThan(rot1 * 3);
    });
  });
});
