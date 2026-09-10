import { forwardRef } from 'react'
import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
} from 'react'
import { clsx } from 'clsx'

// Shared focus/border/disabled treatment for every field type. Height is
// deliberately NOT part of this shared base — Input/Select need a fixed
// h-10 (40px, matching Button's md size so an input+button row lines up),
// while Textarea needs to grow with `rows` instead, so each sets its own
// height below rather than fighting a shared fixed value.
const fieldBase =
  'w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 transition-colors ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent disabled:bg-zinc-50 disabled:text-zinc-400'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const errorClasses = 'border-danger focus:ring-danger/15 focus:border-danger'

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => (
    <input
      ref={ref}
      className={clsx(fieldBase, 'h-10 py-2.5', error && errorClasses, className)}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <select
      ref={ref}
      className={clsx(fieldBase, 'h-10 py-2.5 pr-8', error && errorClasses, className)}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => (
    <textarea
      ref={ref}
      className={clsx(fieldBase, 'min-h-20 py-2 resize-y', error && errorClasses, className)}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

interface FormFieldProps {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
  className?: string
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-700">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-zinc-400">{hint}</p>}
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  )
}

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, description, className, id, ...props }, ref) => (
    <label
      htmlFor={id}
      className={clsx(
        'flex items-start gap-2.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm cursor-pointer hover:bg-zinc-50',
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-brand-accent focus:ring-brand-accent/20"
        {...props}
      />
      <span className="flex flex-col">
        <span className="font-medium text-zinc-800">{label}</span>
        {description && <span className="text-xs text-zinc-400">{description}</span>}
      </span>
    </label>
  ),
)
Checkbox.displayName = 'Checkbox'

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

export function Toggle({ label, description, checked, onChange, disabled }: ToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-zinc-200 bg-white px-3 py-2.5">
      <span className="flex flex-col">
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        {description && <span className="text-xs text-zinc-400">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50',
          checked ? 'bg-brand-accent' : 'bg-zinc-200',
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow',
            checked ? 'translate-x-6' : 'translate-x-1',
          )}
        />
      </button>
    </div>
  )
}
