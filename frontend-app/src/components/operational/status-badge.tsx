import { Badge, type BadgeTone } from '@/components/ui/badge'
import { humanizeStatus, statusTone } from '@/components/operational/status'
import { cn } from '@/lib/utils'

type StatusBadgeProps = {
  status: string | null | undefined
  /** Localized label; falls back to a readable form of the status code. */
  label?: string
  tone?: BadgeTone
  size?: 'sm' | 'xs'
  className?: string
}

export function StatusBadge({ status, label, tone, size = 'sm', className }: StatusBadgeProps) {
  return (
    <Badge tone={tone ?? statusTone(status)} size={size} className={cn('tabular-nums', className)}>
      {label ?? humanizeStatus(status)}
    </Badge>
  )
}
