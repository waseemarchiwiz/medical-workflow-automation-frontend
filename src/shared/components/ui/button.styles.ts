import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-full text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[0_18px_30px_rgba(15,118,110,0.22)] hover:opacity-90',
        secondary:
          'bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90',
        outline:
          'border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-white/70',
        ghost: 'text-[var(--foreground)] hover:bg-white/60',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-6 text-sm',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)
