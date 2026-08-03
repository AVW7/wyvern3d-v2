'use client'

import { useEffect, useMemo, useState } from 'react'
import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three'

export interface WorldLabelProps {
  text: string
  subtitle?: string
  color?: string
  outline?: string
  /** World height of the text label in 3D units. */
  size?: number
  position?: [number, number, number]
  opacity?: number
  variant?: 'default' | 'station' | 'wyvern' | 'map'
}

/**
 * A world-space text label drawn as a canvas-texture sprite.
 *
 * Deliberately NOT drei's <Text>. That component uses troika-three-text, which
 * allocates its own GL resources for SDF atlas generation and reliably takes
 * down the WebGL context in WebKit — the whole canvas goes blank the moment a
 * single label mounts. A 2D-canvas texture on a sprite has no such dependency,
 * costs one draw call, and always faces the camera for free.
 */
export function WorldLabel({
  text,
  subtitle,
  color = '#f5e4c3',
  outline = '#0e131b',
  size = 1,
  position = [0, 0, 0],
  opacity = 1,
  variant = 'station',
}: WorldLabelProps) {
  const [fontsLoaded, setFontsLoaded] = useState(false)

  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => {
        setFontsLoaded(true)
      })
    }
  }, [])

  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!

    if (variant === 'station') {
      const mainFont = '700 48px Cinzel, "Cinzel Decorative", Georgia, serif'
      const subFont = '700 20px Outfit, system-ui, sans-serif'

      ctx.font = mainFont
      const mainWidth = ctx.measureText(text.toUpperCase()).width

      let subWidth = 0
      if (subtitle) {
        ctx.font = subFont
        subWidth = ctx.measureText(subtitle.toUpperCase()).width
      }

      const contentWidth = Math.max(mainWidth, subWidth)
      const padX = 48
      const height = subtitle ? 116 : 84
      const width = Math.max(220, Math.ceil(contentWidth) + padX * 2)

      canvas.width = width
      canvas.height = height

      const rx = 16
      const w = width
      const h = height

      ctx.save()

      // Shadow glow around plaque
      ctx.shadowColor = 'rgba(212, 175, 55, 0.3)'
      ctx.shadowBlur = 18
      ctx.shadowOffsetY = 4

      // Dark translucent glass gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h)
      bgGrad.addColorStop(0, 'rgba(18, 24, 35, 0.92)')
      bgGrad.addColorStop(1, 'rgba(8, 12, 18, 0.96)')

      ctx.beginPath()
      ctx.roundRect(4, 4, w - 8, h - 8, rx)
      ctx.fillStyle = bgGrad
      ctx.fill()

      ctx.shadowColor = 'transparent'

      // Outer Gold / Amber Metallic Ring Border
      const borderGrad = ctx.createLinearGradient(0, 0, w, h)
      borderGrad.addColorStop(0, 'rgba(245, 220, 160, 0.85)')
      borderGrad.addColorStop(0.5, 'rgba(212, 175, 55, 0.5)')
      borderGrad.addColorStop(1, 'rgba(180, 140, 45, 0.8)')
      ctx.lineWidth = 2.5
      ctx.strokeStyle = borderGrad
      ctx.stroke()

      // Inner Highlight Line
      ctx.beginPath()
      ctx.roundRect(7, 7, w - 14, h - 14, rx - 3)
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
      ctx.stroke()

      // Corner Diamond Accents
      const drawDiamond = (cx: number, cy: number, r: number) => {
        ctx.beginPath()
        ctx.moveTo(cx, cy - r)
        ctx.lineTo(cx + r, cy)
        ctx.lineTo(cx, cy + r)
        ctx.lineTo(cx - r, cy)
        ctx.closePath()
        ctx.fillStyle = 'rgba(245, 220, 160, 0.85)'
        ctx.fill()
      }
      drawDiamond(18, h / 2, 4)
      drawDiamond(w - 18, h / 2, 4)

      ctx.restore()

      // Draw Text
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (subtitle) {
        // Subtitle / Eyebrow (e.g., TRAINING GROUND)
        const subY = 30
        ctx.font = subFont
        ctx.fillStyle = 'rgba(240, 205, 125, 0.95)'
        ctx.fillText(subtitle.toUpperCase(), w / 2, subY)

        // Main Text (e.g., HUNTING PEN)
        const mainY = h - 38
        ctx.font = mainFont

        // Deep outline
        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(5, 8, 12, 0.95)'
        ctx.strokeText(text.toUpperCase(), w / 2, mainY)

        // Text gradient fill
        const textGrad = ctx.createLinearGradient(0, mainY - 20, 0, mainY + 20)
        textGrad.addColorStop(0, '#ffffff')
        textGrad.addColorStop(1, color)
        ctx.fillStyle = textGrad
        ctx.fillText(text.toUpperCase(), w / 2, mainY)
      } else {
        const mainY = h / 2 + 1
        ctx.font = mainFont

        ctx.lineWidth = 6
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(5, 8, 12, 0.95)'
        ctx.strokeText(text.toUpperCase(), w / 2, mainY)

        const textGrad = ctx.createLinearGradient(0, mainY - 20, 0, mainY + 20)
        textGrad.addColorStop(0, '#ffffff')
        textGrad.addColorStop(1, color)
        ctx.fillStyle = textGrad
        ctx.fillText(text.toUpperCase(), w / 2, mainY)
      }

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.generateMipmaps = false

      return { texture: tex, aspect: canvas.width / canvas.height }
    } else {
      // Clean text rendering for default, wyvern names, or map locations
      const FONT_PX = 56
      const PAD = 16
      const font = variant === 'map' ? `700 ${FONT_PX}px Cinzel, Georgia, serif` : `600 ${FONT_PX}px Outfit, system-ui, sans-serif`

      ctx.font = font
      const measured = ctx.measureText(text)
      const width = Math.ceil(measured.width) + PAD * 2
      const height = FONT_PX + PAD * 2

      canvas.width = Math.max(2, width)
      canvas.height = Math.max(2, height)

      ctx.font = font
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      ctx.lineWidth = 8
      ctx.strokeStyle = outline
      ctx.strokeText(text, canvas.width / 2, canvas.height / 2)
      ctx.fillStyle = color
      ctx.fillText(text, canvas.width / 2, canvas.height / 2)

      const tex = new CanvasTexture(canvas)
      tex.colorSpace = SRGBColorSpace
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.generateMipmaps = false

      return { texture: tex, aspect: canvas.width / canvas.height }
    }
  }, [text, subtitle, color, outline, variant, fontsLoaded])

  useEffect(() => () => texture.dispose(), [texture])

  return (
    <sprite position={position} scale={[size * aspect, size, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  )
}
