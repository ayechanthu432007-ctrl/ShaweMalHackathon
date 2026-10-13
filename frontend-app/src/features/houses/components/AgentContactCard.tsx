import { Mail, MessageCircle, Phone, Send } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { trackHouseEvent } from '@/features/agent/api/agent-plan-api'
import { telegramProfileLink, viberChatLink } from '@/lib/contact-links'

import type { HouseDetails } from '../types'

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

type AgentContactCardProps = {
  house: Pick<HouseDetails, 'id' | 'agent' | 'contact'>
  /** Extra content under the contact actions, such as the rating form after a booking. */
  children?: ReactNode
}

/** Who lists the house and every way to reach them. Contact taps are counted for the agent's statistics. */
export function AgentContactCard({ house, children }: AgentContactCardProps) {
  const { t } = useTranslation()
  const { agent, contact } = house
  const telegram = telegramProfileLink(contact.telegram)
  const viber = viberChatLink(contact.viber ?? '')
  // The number the agent gave for this listing, falling back to their account number.
  const callNumber = contact.phone || agent.phone || null
  const rows = [
    agent.phone ? { key: 'phone', icon: Phone, label: t('houses.agentPhone'), value: agent.phone, href: telHref(agent.phone) } : null,
    contact.phone && contact.phone !== agent.phone
      ? { key: 'contact', icon: Phone, label: t('houses.contactPhone'), value: contact.phone, href: telHref(contact.phone) }
      : null,
    agent.email ? { key: 'email', icon: Mail, label: t('houses.agentEmail'), value: agent.email, href: `mailto:${agent.email}` } : null,
  ].flatMap((row) => (row ? [row] : []))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('houses.agentDetails')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex items-center gap-3">
          <UserAvatar path={agent.profilePicturePath} name={agent.name} />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{agent.name}</p>
            <p className="text-xs text-muted-foreground">{t('houses.listingAgent')}</p>
          </div>
        </div>

        {rows.length > 0 ? (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="flex items-center gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <row.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{row.label}</span>
                  <a
                    href={row.href}
                    className="block truncate font-medium underline-offset-4 hover:text-primary hover:underline"
                    onClick={row.key === 'email' ? undefined : () => trackHouseEvent(house.id, 'CALL')}
                  >
                    {row.value}
                  </a>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="space-y-2">
          {callNumber ? (
            <Button asChild className="w-full">
              <a href={telHref(callNumber)} onClick={() => trackHouseEvent(house.id, 'CALL')}>
                <Phone aria-hidden />
                {t('houses.contactAgent')}
              </a>
            </Button>
          ) : null}
          {telegram || viber ? (
            <div className="grid grid-cols-2 gap-2">
              {telegram ? (
                <Button asChild variant="outline" className={viber ? '' : 'col-span-2'}>
                  <a href={telegram} target="_blank" rel="noopener noreferrer" onClick={() => trackHouseEvent(house.id, 'TELEGRAM')}>
                    <Send aria-hidden />
                    Telegram
                  </a>
                </Button>
              ) : null}
              {viber ? (
                <Button asChild variant="outline" className={telegram ? '' : 'col-span-2'}>
                  <a href={viber} onClick={() => trackHouseEvent(house.id, 'VIBER')}>
                    <MessageCircle aria-hidden />
                    Viber
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {children}
      </CardContent>
    </Card>
  )
}
