'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Mesh, MeshBasicMaterial } from 'three';

interface SupplyPulseProps {
  points: [Vector3, Vector3];
  color: string;
  speed?: number;
}

export function SupplyPulse({ points, color, speed = 1 }: SupplyPulseProps) {
  const pulse1 = useRef<Mesh>(null);
  const pulse2 = useRef<Mesh>(null);
  const pulse3 = useRef<Mesh>(null);
  const trail1 = useRef<Mesh>(null);
  const trail2 = useRef<Mesh>(null);
  const trail3 = useRef<Mesh>(null);
  
  // Reuse vectors to avoid GC overhead
  const scratch = useRef({ v1: new Vector3(), v2: new Vector3() });

  useFrame((state) => {
    const time = state.clock.getElapsedTime() * speed;
    
    const offsets = [0, 0.33, 0.66];
    const pulses = [pulse1, pulse2, pulse3];
    const trails = [trail1, trail2, trail3];
    
    for (let i = 0; i < 3; i++) {
      const t = (time + offsets[i]!) % 1;
      
      const pulse = pulses[i]!.current;
      const trail = trails[i]!.current;
      
      if (pulse && trail) {
        // Main pulse position
        scratch.current.v1.lerpVectors(points[0], points[1], t);
        pulse.position.copy(scratch.current.v1);
        
        // Size oscillation
        const scale = 0.5 + Math.sin(t * Math.PI) * 0.3;
        pulse.scale.setScalar(scale);
        
        // Fade at endpoints
        const opacity = 0.85 * Math.sin(t * Math.PI);
        const pulseMaterial = pulse.material as MeshBasicMaterial;
        pulseMaterial.opacity = opacity;
        
        // Trail glow position (clamped to 0)
        const trailT = Math.max(0, t - 0.05);
        scratch.current.v2.lerpVectors(points[0], points[1], trailT);
        trail.position.copy(scratch.current.v2);
        
        // Trail size oscillation and opacity
        const trailScale = 0.5 + Math.sin(trailT * Math.PI) * 0.3;
        trail.scale.setScalar(trailScale);
        
        const trailMaterial = trail.material as MeshBasicMaterial;
        trailMaterial.opacity = 0.3 * Math.sin(trailT * Math.PI);
      }
    }
  });

  return (
    <group>
      {/* Pulse 1 */}
      <mesh ref={pulse1}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      <mesh ref={trail1}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      
      {/* Pulse 2 */}
      <mesh ref={pulse2}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      <mesh ref={trail2}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      
      {/* Pulse 3 */}
      <mesh ref={pulse3}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
      <mesh ref={trail3}>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
