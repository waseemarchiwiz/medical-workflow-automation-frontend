import type { LabelHTMLAttributes } from 'react'

import { cn } from '@/shared/lib/utils'

function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('text-sm font-medium leading-none text-[var(--foreground)]', className)}
      {...props}
    />
  )
}

export { Label }
