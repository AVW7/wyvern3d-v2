import type { ThemeStyle } from '../constants'

/**
 * Apple Design Tactile Button
 * Features instant active scale feedback (scale(0.96)), specular top-edge,
 * spring transition, and optical font tracking.
 */
export function LabButton({
  active,
  disabled,
  children,
  onClick,
  themeStyle,
  title,
  style,
}: {
  active?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
  themeStyle: ThemeStyle
  title?: string
  style?: React.CSSProperties
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="apple-button"
      style={{
        fontSize: 11,
        letterSpacing: '-0.01em',
        padding: '5px 11px',
        borderRadius: 7,
        transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        background: active ? themeStyle.buttonActiveBg : themeStyle.buttonBg,
        color: active ? themeStyle.buttonActiveText : themeStyle.text,
        border: active ? `1px solid ${themeStyle.accentColor}` : `1px solid ${themeStyle.border}`,
        borderTop: active
          ? `1px solid ${themeStyle.accentColor}`
          : `1px solid ${themeStyle.borderTop}`,
        boxShadow: active
          ? `0 0 10px ${themeStyle.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.2)`
          : '0 1px 2px rgba(0, 0, 0, 0.1)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: active ? 600 : 450,
        outline: 'none',
        userSelect: 'none',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/**
 * Apple Design Card Container
 * Framed translucent glass card with specular light top-edge and subtle depth.
 */
export function AppleCard({
  title,
  subtitle,
  children,
  themeStyle,
  style,
}: {
  title?: string
  subtitle?: string
  children: React.ReactNode
  themeStyle: ThemeStyle
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        background: themeStyle.cardBg,
        border: `1px solid ${themeStyle.border}`,
        borderTop: `1px solid ${themeStyle.borderTop}`,
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: themeStyle.muted,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: subtitle ? 2 : 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{title}</span>
        </div>
      )}
      {subtitle && (
        <p
          style={{
            fontSize: 10,
            color: themeStyle.muted,
            lineHeight: 1.35,
            margin: '0 0 8px 0',
          }}
        >
          {subtitle}
        </p>
      )}
      {children}
    </div>
  )
}

/**
 * Apple iOS/macOS Custom Switch Toggle
 */
export function AppleToggle({
  checked,
  onChange,
  label,
  sublabel,
  themeStyle,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: React.ReactNode
  sublabel?: string
  themeStyle: ThemeStyle
  disabled?: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        fontSize: 12,
        color: themeStyle.text,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        padding: '3px 0',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12, fontWeight: 450 }}>{label}</span>
        {sublabel && (
          <span style={{ fontSize: 10, color: themeStyle.muted, marginTop: 1 }}>{sublabel}</span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault()
          if (!disabled) onChange(!checked)
        }}
        style={{
          position: 'relative',
          width: 36,
          height: 20,
          borderRadius: 10,
          border: 'none',
          padding: 0,
          cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? themeStyle.accentColor : themeStyle.segmentedBg,
          boxShadow: checked
            ? `0 0 8px ${themeStyle.accentGlow}`
            : 'inset 0 1px 2px rgba(0,0,0,0.3)',
          transition: 'background-color 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s ease',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
            transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </button>
    </label>
  )
}

/**
 * Custom Range Slider with Live Numerical Pill
 */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  textColor,
  mutedColor,
  accentColor,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
  textColor?: string
  mutedColor?: string
  accentColor?: string
}) {
  return (
    <label
      style={{
        display: 'block',
        opacity: disabled ? 0.45 : 1,
        color: textColor ?? 'inherit',
        fontSize: 11,
        marginBottom: 6,
        userSelect: 'none',
      }}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ opacity: 0.85, fontWeight: 450 }}>{label}</span>
        <span
          style={{
            fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, monospace',
            fontWeight: 600,
            fontSize: 10.5,
            color: mutedColor ?? textColor,
            background: 'rgba(0, 0, 0, 0.15)',
            padding: '1px 5px',
            borderRadius: 4,
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        style={{ width: '100%', accentColor: accentColor ?? textColor }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  )
}
