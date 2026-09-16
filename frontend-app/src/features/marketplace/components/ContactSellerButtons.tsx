import { useMutation } from '@tanstack/react-query'
import { Loader2, MessageCircle, Phone, Send } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { ApiRequestError } from '@/lib/api/client'

import { marketplaceApi } from '../api/marketplace-api'
import type { ContactMethod } from '../types'

const METHOD_ICONS: Record<ContactMethod, typeof Phone> = {
  phone: Phone,
  telegram: Send,
  viber: MessageCircle,
}

type RevealedContact = { method: ContactMethod; value: string; link: string }

type ContactSellerButtonsProps = {
  listingId: string
  methods: ContactMethod[]
}

/**
 * Contact details are never rendered in the listing payload; each button asks the API
 * for that one method, which also lets the seller see who was interested.
 */
export function ContactSellerButtons({ listingId, methods }: ContactSellerButtonsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const [revealed, setRevealed] = useState<RevealedContact | null>(null)

  const revealMutation = useMutation({
    mutationFn: (method: ContactMethod) => marketplaceApi.revealContact(listingId, method),
    onSuccess: ({ contact }) => {
      setRevealed(contact)
      // Phone numbers stay on screen (tel: links do nothing on most desktops); chat apps open directly.
      if (contact.method === 'telegram') {
        window.open(contact.link, '_blank', 'noopener,noreferrer')
      } else if (contact.method === 'viber') {
        window.location.assign(contact.link)
      }
    },
  })

  if (methods.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('marketplace.detail.noContactMethods')}</p>
  }

  const onContact = (method: ContactMethod) => {
    if (!isAuthenticated) {
      navigate('/sign-in', { state: { from: location.pathname } })
      return
    }
    revealMutation.mutate(method)
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((method) => {
          const Icon = METHOD_ICONS[method]
          const pending = revealMutation.isPending && revealMutation.variables === method
          return (
            <Button
              key={method}
              type="button"
              variant={method === 'phone' ? 'default' : 'outline'}
              disabled={revealMutation.isPending}
              onClick={() => onContact(method)}
            >
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Icon aria-hidden />}
              {t(`marketplace.contact.${method}`)}
            </Button>
          )
        })}
      </div>

      {!isAuthenticated ? <p className="text-xs text-muted-foreground">{t('marketplace.contact.signInHint')}</p> : null}

      {revealed ? (
        <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm" role="status">
          {t(`marketplace.contact.revealed.${revealed.method}`)}{' '}
          <a href={revealed.link} className="font-semibold text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
            {revealed.value}
          </a>
        </p>
      ) : null}

      {revealMutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {revealMutation.error instanceof ApiRequestError ? revealMutation.error.message : t('marketplace.contact.error')}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t('marketplace.contact.safetyTip')}</p>
    </div>
  )
}
