import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Card com rolagem horizontal — tabelas largas nunca empurram a página. */
export function TableShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-2xl border border-black/[0.06] bg-white', className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('min-w-full text-[13.5px]', className)} {...props} />
}

/** Cabeçalho de lista do Finder: sem faixa colorida, só o traço fino embaixo. */
export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={className} {...props} />
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-black/[0.05]', className)} {...props} />
}

export function Th({ className, align, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'whitespace-nowrap border-b border-black/[0.08] px-4 pt-3 pb-2 text-left text-[12px] font-medium text-neutral-500',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-2.5 align-middle text-ink-800', className)} {...props} />
}

export function Tr({
  className,
  interactive,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'transition-colors duration-100',
        interactive ? 'cursor-pointer hover:bg-black/[0.03]' : 'hover:bg-black/[0.015]',
        className,
      )}
      {...props}
    />
  )
}
