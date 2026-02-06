import { CSSProperties, useLayoutEffect, useMemo, useRef } from 'react'
import './AnimatedSwitch.css'

interface AnimatedSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  leftLabel: string
  rightLabel: string
  ariaLabel?: string
  className?: string
  disabled?: boolean
  offTrackGradient?: string
  onTrackGradient?: string
  thumbColor?: string
  focusRingColor?: string
  activeLabelColor?: string
  inactiveLabelColor?: string
}

function buildStyleVars({
  offTrackGradient,
  onTrackGradient,
  thumbColor,
  focusRingColor,
  activeLabelColor,
  inactiveLabelColor,
}: Pick<AnimatedSwitchProps, 'offTrackGradient' | 'onTrackGradient' | 'thumbColor' | 'focusRingColor' | 'activeLabelColor' | 'inactiveLabelColor'>): CSSProperties {
  const vars: Record<string, string> = {}

  if (offTrackGradient) vars['--animated-switch-off-track'] = offTrackGradient
  if (onTrackGradient) vars['--animated-switch-on-track'] = onTrackGradient
  if (thumbColor) vars['--animated-switch-thumb-color'] = thumbColor
  if (focusRingColor) vars['--animated-switch-focus-ring'] = focusRingColor
  if (activeLabelColor) vars['--animated-switch-label-active'] = activeLabelColor
  if (inactiveLabelColor) vars['--animated-switch-label-inactive'] = inactiveLabelColor

  return vars as CSSProperties
}

export default function AnimatedSwitch({
  checked,
  onChange,
  leftLabel,
  rightLabel,
  ariaLabel = '切换开关',
  className,
  disabled = false,
  offTrackGradient,
  onTrackGradient,
  thumbColor,
  focusRingColor,
  activeLabelColor,
  inactiveLabelColor,
}: AnimatedSwitchProps) {
  const prevCheckedRef = useRef(checked)
  const styleVars = useMemo(
    () => buildStyleVars({
      offTrackGradient,
      onTrackGradient,
      thumbColor,
      focusRingColor,
      activeLabelColor,
      inactiveLabelColor,
    }),
    [offTrackGradient, onTrackGradient, thumbColor, focusRingColor, activeLabelColor, inactiveLabelColor]
  )

  const animationDirection =
    prevCheckedRef.current === checked ? '' : checked ? 'animate-to-on' : 'animate-to-off'

  const rootClassName = [
    'animated-switch',
    checked ? 'is-on' : '',
    disabled ? 'is-disabled' : '',
    animationDirection,
    className || '',
  ].filter(Boolean).join(' ')

  useLayoutEffect(() => {
    prevCheckedRef.current = checked
  }, [checked])

  return (
    <div className={rootClassName} style={styleVars}>
      <input
        className="animated-switch-checkbox"
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="animated-switch-track" aria-hidden="true">
        <div className="animated-switch-thumb" />
        <span className={`animated-switch-label animated-switch-label-left ${!checked ? 'active' : ''}`}>{leftLabel}</span>
        <span className={`animated-switch-label animated-switch-label-right ${checked ? 'active' : ''}`}>{rightLabel}</span>
      </div>
    </div>
  )
}
