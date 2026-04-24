import type { VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'

import { buttonVariants } from '@/shared/components/ui/button.styles'
import { cn } from '@/shared/lib/utils'

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

function Button({ className, size, variant, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { Button }
