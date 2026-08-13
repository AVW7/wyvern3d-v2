'use client'

import { useMemo, useRef, useEffect } from 'react'
import { BackSide, Color, ShaderMaterial, SphereGeometry } from 'three'
import type { Rgb } from './palette'

/**
 * A hand-authored gradient sky.
 *
 * Deliberately not drei's `<Sky>`: that is a Preetham physical-sky model whose
 * output is hard to steer toward the warm palette this game uses, and its
 * colours cannot be driven directly from `palette.ts`. Two uniforms over
 * world-space height is all this needs, and it art-directs exactly.
 *
 * Also deliberately not `<Environment preset>` or `<Cloud>` — both fetch assets
 * from a third-party CDN at runtime, which the game scene must not depend on.
 */
export interface SkyDomeHandle {
  setColors: (horizon: Rgb, zenith: Rgb) => void
}

export function SkyDome({
  handleRef,
  radius = 340,
}: {
  handleRef: { current: SkyDomeHandle | null }
  radius?: number
}) {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        // The dome must not be fogged, or it takes the fog colour and the
        // gradient disappears into a flat wash.
        fog: false,
        uniforms: {
          uHorizon: { value: new Color('#c4d8ea') },
          uZenith: { value: new Color('#6092c8') },
        },
        vertexShader: `
          varying vec3 vWorld;
          void main() {
            vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 uHorizon;
          uniform vec3 uZenith;
          varying vec3 vWorld;
          void main() {
            // Normalized height up the dome, eased so the horizon band stays
            // tight instead of smearing across the whole sky.
            float h = clamp(normalize(vWorld).y, 0.0, 1.0);
            gl_FragColor = vec4(mix(uHorizon, uZenith, pow(h, 0.55)), 1.0);
          }
        `,
      }),
    [],
  )

  const geometry = useMemo(() => new SphereGeometry(radius, 32, 20), [radius])
  const horizon = useRef(new Color())
  const zenith = useRef(new Color())

  useEffect(() => {
    handleRef.current = {
      setColors: (h, z) => {
        horizon.current.setRGB(h[0], h[1], h[2])
        zenith.current.setRGB(z[0], z[1], z[2])
        ;(material.uniforms.uHorizon!.value as Color).copy(horizon.current)
        ;(material.uniforms.uZenith!.value as Color).copy(zenith.current)
      },
    }
    return () => {
      handleRef.current = null
    }
  }, [handleRef, material])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={-1} />
}
