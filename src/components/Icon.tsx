import React from 'react'

interface IconProps {
  type: string // 阿里图标库的类名，例如 'icon-restaurant' 或 'icon-cafe'
  className?: string
  style?: React.CSSProperties
}

/**
 * 阿里图标库图标组件
 * 使用方式: <Icon type="icon-restaurant" />
 */
const Icon: React.FC<IconProps> = ({ type, className = '', style }) => {
  return (
    <i 
      className={`iconfont ${type} ${className}`.trim()} 
      style={style}
    />
  )
}

export default Icon

