import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Card com rolagem horizontal — tabelas largas nunca empurram a página. */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-sm',
        className,
      )}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('min-w-full text-sm', className)} {...props} />
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-neutral-50/80', className)} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-neutral-200/60', className)} {...props} />
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-neutral-200/70 px-4 py-2.5 text-left text-[12px] font-semibold text-neutral-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle text-neutral-600', className)} {...props} />
}

export function Tr({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-150',
        interactive ? 'cursor-pointer hover:bg-neutral-500/6' : 'hover:bg-neutral-500/4',
        className,
      )}
      {...props}
    />
  )
}
