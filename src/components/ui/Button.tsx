import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-brand text-white border-brand hover:bg-zinc-800',
  secondary: 'bg-white text-zinc-800 border-zinc-300 hover:bg-zinc-50',
  ghost: 'bg-transparent text-zinc-600 border-transparent hover:bg-zinc-100',
  danger: 'bg-danger text-white border-danger hover:bg-red-700',
}

// md is the default, general-purpose action size — 40px keeps it close to
// the ~44px mobile touch-target guideline without making every secondary
// button on a dense desktop toolbar oversized. sm stays for genuinely
// compact contexts (inline table-row actions) where a 44px target isn't
// practical given the surrounding density.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-md border font-medium transition-colors',
          'disabled:opacity-50 disabled:pointer-events-none',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-accent',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'
