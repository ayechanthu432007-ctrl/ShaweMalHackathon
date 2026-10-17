import { Banknote, Briefcase, MapPin, Pencil, Phone, Trash2, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { CoverImage } from '@/components/common/CoverImage'
import { UserAvatar } from '@/components/common/UserAvatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { MatchReasons, MatchScore } from '@/features/recommendations/components/MatchDetails'
import { resolvePublicUploadUrl } from '@/lib/uploads/resolve-public-url'

import type { RoommatePost } from '../types'

type RoommateCardProps = {
  post: RoommatePost
  /** Whether the person looking at the list is signed in and has saved preferences. */
  viewer: { signedIn: boolean; hasPreferences: boolean }
  isOwner: boolean
  occupationName: string
  onEdit: () => void
  onDelete: () => void
}

const GENDER_KEYS: Record<string, string> = { MALE: 'roommates.genderMale', FEMALE: 'roommates.genderFemale', ANY: 'roommates.genderAny' }

/** One roommate post, with the viewer's personal compatibility at the top when it can be calculated. */
export function RoommateCard({ post, viewer, isOwner, occupationName, onEdit, onDelete }: RoommateCardProps) {
  const { t } = useTranslation()
  const [showProfile, setShowProfile] = useState(false)

  const flags = (group: Record<string, boolean> | undefined) =>
    Object.entries(group ?? {})
      .filter(([, value]) => value)
      .map(([key]) => t(`roommates.flags.${key}`, { defaultValue: key }))
  const housingPreferences = flags(post.preferences)
  const hobbies = flags(post.hobbies)
  const photos = (post.photos ?? []).flatMap((path) => resolvePublicUploadUrl(path) ?? [])
  const location = [post.house?.city?.name, post.house?.state?.name].filter(Boolean).join(', ')
  const phone = post.user?.phone?.replace(/\s+/g, '')
  const name = post.user?.name ?? t('home.anonymousReviewer')
  const match = post.match && post.match.confidence !== 'INCOMPLETE' ? post.match : null
  const genderKey = GENDER_KEYS[String(post.gender).toUpperCase()]

  return (
    <Card className="flex h-full flex-col shadow-sm">
      <CardContent className="flex flex-1 flex-col gap-3 p-4 text-sm">
        {/* The match sits at the top so the list can be scanned by it. */}
        {isOwner ? (
          <p className="self-start rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{t('roommates.yourPost')}</p>
        ) : match ? (
          <MatchScore match={match} />
        ) : viewer.signedIn ? (
          <p className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {viewer.hasPreferences ? (
              t('match.whyIncomplete')
            ) : (
              <>
                {t('roommates.completePreferences')}{' '}
                <Link to="/profile#housing-preferences" className="font-medium text-primary underline-offset-4 hover:underline">
                  {t('match.setPreferences')}
                </Link>
              </>
            )}
          </p>
        ) : null}

        <div className="flex items-start gap-3">
          <UserAvatar path={post.user?.profilePicturePath} name={post.user?.name} />
          <div className="min-w-0 space-y-0.5">
            <p className="truncate text-base font-semibold">{name}</p>
            <p className="line-clamp-2 text-muted-foreground">{post.title}</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          <li className="flex items-center gap-2">
            <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t('roommates.gender')}: </span>
            {genderKey ? t(genderKey) : post.gender}
          </li>
          <li className="flex items-center gap-2">
            <Briefcase className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {occupationName}
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {location || t('houses.locationUnknown')}
          </li>
          <li className="flex items-start gap-2">
            <Banknote className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="font-medium">{post.budgetCostSharing}</span>
          </li>
          {post.user?.phone ? (
            <li className="flex items-center gap-2">
              <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">{t('roommates.contactPhone')}: </span>
              <a href={`tel:${phone}`} className="hover:underline">
                {post.user.phone}
              </a>
            </li>
          ) : null}
        </ul>

        {photos.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {photos.map((src, index) => (
              <div key={src} className="aspect-[4/3] overflow-hidden rounded-md border border-input">
                <CoverImage src={src} alt={t('roommates.photoAlt', { name: post.user?.name ?? '', index: index + 1 })} />
              </div>
            ))}
          </div>
        ) : null}

        {[
          { label: t('roommates.interests'), items: housingPreferences },
          { label: t('roommates.hobbies'), items: hobbies },
        ].map((group) =>
          group.items.length > 0 ? (
            <div key={group.label} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
              <ul className="flex flex-wrap gap-1">
                {group.items.map((item) => (
                  <li key={item} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}

        {match ? <MatchReasons match={match} subject="roommate" compact /> : null}

        {showProfile ? (
          <div className="space-y-1 rounded-md border bg-muted/40 p-3">
            <p className="font-medium">{post.title}</p>
            {post.house?.title ? <p className="text-muted-foreground">{t('match.roommates.home', { title: post.house.title })}</p> : null}
            {match && match.missing.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {t('match.notCompared', { factors: match.missing.map((key) => t(`match.factors.${key}`, { defaultValue: key })).join(', ') })}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" aria-expanded={showProfile} onClick={() => setShowProfile((open) => !open)}>
            {showProfile ? t('match.hideProfile') : t('match.viewProfile')}
          </Button>
          {phone && !isOwner ? (
            <Button asChild size="sm">
              <a href={`tel:${phone}`} aria-label={t('roommates.contactPerson', { name })}>
                {t('match.contact')}
              </a>
            </Button>
          ) : null}
          {isOwner ? (
            <>
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="size-4" aria-hidden />
                {t('roommates.editAction')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                {t('roommates.deleteAction')}
              </Button>
            </>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
