import { Dropdown } from 'antd'
import type { MenuProps, DropdownProps } from 'antd'
import type { ReactNode } from 'react'

type ToolbarDropdown = {
  menu: MenuProps
  placement?: DropdownProps['placement']
  trigger?: DropdownProps['trigger']
  open?: boolean
  onOpenChange?: DropdownProps['onOpenChange']
}

export type ToolbarAction = {
  key: string
  label: ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  loading?: boolean
  type?: 'default' | 'primary'
  className?: string
  dropdown?: ToolbarDropdown
}

interface MapToolbarProps {
  actions: ToolbarAction[]
  className?: string
}

export default function MapToolbar({ actions, className }: MapToolbarProps) {
  return (
    <div className={`map-toolbar ${className || ''}`}>
      {actions.map((action) => {
  const button = (
          <button
            key={action.key}
            type="button"
            className={`toolbar-btn ${action.className || ''}`}
            onClick={action.onClick}
            disabled={action.disabled}
            aria-busy={action.loading || undefined}
          >
            {action.label}
          </button>
        )

        if (!action.dropdown) {
          return button
        }

        return (
          <Dropdown
            key={`${action.key}-dropdown`}
            menu={action.dropdown.menu}
            placement={action.dropdown.placement}
            trigger={action.dropdown.trigger}
            open={action.dropdown.open}
            onOpenChange={action.dropdown.onOpenChange}
          >
            {button}
          </Dropdown>
        )
      })}
    </div>
  )
}
