import { cn } from '@/shared/lib/utils'

interface ProgressProps {
  className?: string
  value?: number
}

function Progress({ className, value = 0 }: ProgressProps) {
  const normalizedValue = Math.max(0, Math.min(100, value))

  return (
    <div
      aria-label="Upload progress"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-[rgba(36,28,23,0.08)]',
        className,
      )}
      role="progressbar"
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${normalizedValue}%`,
          background: 'linear-gradient(90deg, var(--primary), var(--accent))',
        }}
      />
    </div>
  )
}

export { Progress }
