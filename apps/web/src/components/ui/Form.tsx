import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { IconChevronDown } from '../icons'

/** Aparência compartilhada por todos os campos, para altura e foco consistentes. */
export const control =
  'rounded-lg border border-black/[0.12] bg-white text-[14px] text-ink-900 shadow-[inset_0_0.5px_1px_rgb(0_0_0/0.04)] ' +
  'placeholder:text-neutral-500 ' +
  'transition-[border-color,box-shadow] duration-100 ease-out ' +
  'hover:border-black/[0.18] ' +
  'focus:border-brand-500 focus:outline-none focus:ring-[3px] focus:ring-brand-500/20 focus-visible:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500'

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
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-800">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-danger-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-[12px] text-neutral-600">{hint}</p>
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
  return <input className={cn(control, 'h-9 px-3', widthClass(className), className)} {...props} />
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(control, 'resize-y px-3 py-2.5 leading-relaxed', widthClass(className), className)}
        {...props}
      />
    )
  },
)

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
        className={cn(
          control,
          'h-9 cursor-pointer appearance-none pl-3 pr-9',
          // Em barra de filtro fica na mesma altura de busca e segmentado.
          auto ? 'h-8 w-auto text-[13px]' : 'w-full',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <IconChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500"
      />
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
    <section className={cn('border-t border-black/[0.06] pt-7 first:border-t-0 first:pt-0', className)}>
      <h2 className="text-heading text-ink-900">{title}</h2>
      {description && <p className="mt-1 text-[13px] text-neutral-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
