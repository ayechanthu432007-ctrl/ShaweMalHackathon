import { CalendarCheck, Check, Flag, MapPinned, PackageOpen, PackagePlus, Route, Truck, UserCheck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import {
  eventTimestampForStatuses,
  latestEtaForStage,
  MOVING_TIMELINE_STEPS,
  timelineStepState,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'

const STEP_ICONS: Record<string, LucideIcon> = {
  booking_confirmed: CalendarCheck,
  driver_assigned: UserCheck,
  driver_coming: Truck,
  driver_arrived: MapPinned,
  loading: PackagePlus,
  on_the_way: Route,
  unloading: PackageOpen,
  completed: Flag,
}

export function MovingStatusTimeline({ request }: { request: MovingRequest }) {
  const { t } = useTranslation()

  return (
    <Card className="border-primary/30 shadow-md">
      <CardHeader className="border-b bg-primary/5">
        <CardTitle className="text-xl">{t('moving.statusProgressTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <ol className="max-h-[30rem] space-y-0 overflow-y-auto pr-1 lg:max-h-none lg:overflow-visible">
          {MOVING_TIMELINE_STEPS.map((step, index) => {
            const state = timelineStepState(index, request.status, request.statusEvents)
            const timestamp = eventTimestampForStatuses(request.statusEvents, step.statuses)
            const etaAt = latestEtaForStage(request.etaEntries, step.etaStage)

            const StepIcon = STEP_ICONS[step.id] ?? Truck

            return (
              <li key={step.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      state === 'complete' && 'bg-primary/15 text-primary',
                      state === 'current' && 'bg-primary text-primary-foreground shadow-md ring-4 ring-primary/20',
                      state === 'pending' && 'border border-dashed border-muted-foreground/40 bg-background text-muted-foreground/60',
                    )}
                    aria-current={state === 'current' ? 'step' : undefined}
                  >
                    {state === 'complete' ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                    ) : (
                      <StepIcon className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  {index < MOVING_TIMELINE_STEPS.length - 1 ? (
                    <span
                      className={cn('my-1 w-px flex-1 min-h-6', state === 'complete' ? 'bg-primary/60' : 'bg-border')}
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <div
                  className={cn(
                    'mb-3 min-w-0 flex-1 rounded-xl px-3 py-2',
                    index === MOVING_TIMELINE_STEPS.length - 1 && 'mb-0',
                    state === 'current' && 'border-l-4 border-primary bg-primary/5 shadow-sm',
                  )}
                >
                  <p className={cn('font-semibold', state === 'pending' && 'text-muted-foreground', state === 'current' && 'text-primary')}>
                    {t(`moving.statusStep.${step.id}.title`)}
                  </p>
                  <p className="text-sm text-muted-foreground">{t(`moving.statusStep.${step.id}.body`)}</p>
                  {timestamp ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(timestamp).toLocaleString(undefined, {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  ) : null}
                  {state === 'current' && etaAt ? (
                    <p className="mt-1 text-xs font-medium text-primary">
                      {t('moving.statusEtaAt', {
                        time: new Date(etaAt).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        }),
                      })}
                    </p>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
