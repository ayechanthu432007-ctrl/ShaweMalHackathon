import { ArrowLeft } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type BackButtonProps = {
  /** Where to go when there is no earlier in-app page (direct URL, new tab). */
  fallback: string
  label?: string
  /** When set, the user must confirm before leaving (e.g. unsaved form changes). */
  confirmMessage?: string | null
  className?: string
}

/** Shared look of every back control on the site. */
const backControlClassName = '-ml-3 h-10'

/**
 * Returns to the page the user came from, exactly like the browser Back button, so
 * search terms, filters and pagination held in the URL are preserved.
 */
export function BackButton({ fallback, label, confirmMessage, className }: BackButtonProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const onClick = () => {
    if (confirmMessage && !window.confirm(confirmMessage)) return

    // React Router marks the first page of a visit with the key "default".
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback)
  }

  return (
    <Button type="button" variant="ghost" className={cn(backControlClassName, className)} onClick={onClick}>
      <ArrowLeft aria-hidden />
      {label ?? t('common.back')}
    </Button>
  )
}

type BackLinkProps = {
  to: string
  label: string
  className?: string
}

/** Same look as BackButton, for pages whose back destination is always the same parent page. */
export function BackLink({ to, label, className }: BackLinkProps) {
  return (
    <Button asChild variant="ghost" className={cn(backControlClassName, className)}>
      <Link to={to}>
        <ArrowLeft aria-hidden />
        {label}
      </Link>
    </Button>
  )
}
