import type { TextareaHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-36 w-full rounded-[28px] border border-[var(--border)] bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--foreground)] shadow-[0_12px_24px_rgba(69,45,27,0.06)] outline-none transition focus-visible:ring-4 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
