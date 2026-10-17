import { useEffect, useId } from 'react'
import { Car, Hash, Mail, Phone, User, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import {
  assignedDriverEmail,
  assignedDriverName,
  assignedDriverPhone,
  assignedDriverProfilePhotoPath,
  assignedLicensePlate,
  vehicleLabel,
} from '../lib/moving-status'
import type { MovingRequest } from '../types'

export function MovingStatusDriverDetailsDialog({
  open,
  request,
  onDismiss,
}: {
  open: boolean
  request: MovingRequest
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const driverName = assignedDriverName(request)
  const phone = assignedDriverPhone(request)
  const email = assignedDriverEmail(request)
  const plate = assignedLicensePlate(request)
  const photoSrc = resolvePublicUploadUrl(assignedDriverProfilePhotoPath(request))

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onDismiss])

  if (!open) return null

  const rows: Array<{ icon: typeof User; label: string; value: string | null; href?: string }> = [
    { icon: User, label: t('moving.statusDriverName'), value: driverName },
    {
      icon: Phone,
      label: t('auth.phone'),
      value: phone,
      href: phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined,
    },
    { icon: Mail, label: t('auth.email'), value: email, href: email ? `mailto:${email}` : undefined },
    { icon: Hash, label: t('moving.statusLicensePlate'), value: plate },
    { icon: Car, label: t('moving.vehicleType'), value: vehicleLabel(request) },
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto p-4 [&>[role=dialog]]:my-auto">
      <div aria-hidden="true" className="fixed inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onDismiss} />
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-md overflow-hidden shadow-overlay"
      >
        <div className="h-1 bg-primary" />
        <CardHeader className="space-y-4 pb-3">
          {photoSrc ? (
            <img
              src={photoSrc}
              alt={driverName ?? t('driver.profilePhotoPath')}
              className="size-20 rounded-full border border-input object-cover"
            />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-10" aria-hidden="true" />
            </div>
          )}
          <CardTitle>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {t('moving.statusDriverDetails')}
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl id={descriptionId} className="grid gap-4">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start gap-3 text-sm">
                <row.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <div>
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium">
                    {row.href && row.value ? (
                      <a className="text-primary underline-offset-2 hover:underline" href={row.href}>
                        {row.value}
                      </a>
                    ) : (
                      (row.value ?? '—')
                    )}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
          <div className="flex justify-end">
            <Button type="button" variant="outline" autoFocus onClick={onDismiss}>
              {t('common.close')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
