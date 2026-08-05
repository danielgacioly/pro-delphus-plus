import type { ComponentType, SVGProps } from 'react'
import { IconInbox } from './icons'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ComponentType<SVGProps<SVGSVGElement>>
}

export function EmptyState({ title, description, icon: Icon = IconInbox }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-200 bg-white/60 px-6 py-12 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-neutral-600">{title}</p>
      {description && <p className="max-w-sm text-xs text-neutral-400">{description}</p>}
    </div>
  )
}
