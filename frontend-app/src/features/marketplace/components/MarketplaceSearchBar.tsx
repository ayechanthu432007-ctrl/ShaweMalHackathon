import { PackagePlus, Search, Store } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function MarketplaceSearchBar({ defaultQuery = '' }: { defaultQuery?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [query, setQuery] = useState(defaultQuery)

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    navigate(`/marketplace/search${params.size ? `?${params.toString()}` : ''}`)
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <form role="search" className="flex flex-1 gap-2" onSubmit={onSubmit}>
        <label htmlFor="marketplace-search" className="sr-only">
          {t('marketplace.searchLabel')}
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id="marketplace-search"
            type="search"
            className="h-10 pl-9"
            placeholder={t('marketplace.searchPlaceholder')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <Button type="submit" className="h-10">
          {t('marketplace.searchAction')}
        </Button>
      </form>
      <div className="flex gap-2">
        <Button asChild className="h-10 flex-1 md:flex-none" variant="secondary">
          <Link to="/marketplace/sell">
            <PackagePlus aria-hidden />
            {t('marketplace.sellItem')}
          </Link>
        </Button>
        {isAuthenticated ? (
          <Button asChild className="h-10 flex-1 md:flex-none" variant="outline">
            <Link to="/marketplace/my">
              <Store aria-hidden />
              {t('marketplace.myMarketplace')}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
