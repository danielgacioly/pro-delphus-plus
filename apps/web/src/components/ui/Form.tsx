import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/** Aparência compartilhada por todos os campos, para altura e foco consistentes. */
const control =
  'rounded-lg border border-neutral-200 bg-white text-sm text-ink-900 shadow-xs ' +
  'placeholder:text-neutral-400 ' +
  'transition-[border-color,box-shadow] duration-150 ease-out ' +
  'hover:border-neutral-300 ' +
  'focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400'

export function Field({
  label,
  hint,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-neutral-700">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-brand-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] text-neutral-500">{hint}</p>
      )}
    </div>
  )
}

/**
 * Campos ocupam a largura toda por padrão. Quando quem usa já define a largura
 * (`w-…`, `flex-1`, `min-w-…`), o `w-full` é omitido — senão as duas classes
 * competem e quem vence depende da ordem no CSS gerado, não da intenção.
 */
function widthClass(className?: string) {
  return /(^|\s)(w-|flex-1|min-w-)/.test(className ?? '') ? undefined : 'w-full'
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, 'h-10 px-3', widthClass(className), className)} {...props} />
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(control, 'resize-y px-3 py-2.5 leading-relaxed', widthClass(className), className)}
      {...props}
    />
  )
}

/**
 * `auto` encolhe o campo até o conteúdo — usado nas barras de filtro, onde um
 * select de largura total desequilibraria a linha.
 */
export function Select({
  className,
  children,
  auto,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { auto?: boolean }) {
  return (
    <div className={cn('relative', auto ? 'inline-block' : 'w-full')}>
      <select
        className={cn(control, 'h-10 cursor-pointer appearance-none pl-3 pr-9', auto ? 'w-auto' : 'w-full', className)}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  )
}

/** Agrupa campos relacionados dentro de um formulário longo. */
export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('border-t border-neutral-200/70 pt-6 first:border-t-0 first:pt-0', className)}>
      <h2 className="text-eyebrow text-neutral-400">{title}</h2>
      {description && <p className="mt-1.5 text-[13px] text-neutral-500">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
