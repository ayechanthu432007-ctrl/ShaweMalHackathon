import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ApiRequestError } from '@/lib/api/client'

import { agentHousesApi } from '../api/agent-houses-api'
import { useAgentDashboard } from '../layout/AgentDashboardLayout'
import { activeDemoBoost, useAgentDemoPreview } from '../lib/agent-demo-preview'

function isVerifiedAgent(status: string | null | undefined): boolean {
  return (status ?? '').toUpperCase() === 'VERIFIED'
}

export function AgentHousesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const queryClient = useQueryClient()
  // Demo boosts made on the Boost page (browser-only on the live site) show on each listing.
  const preview = useAgentDemoPreview(useAgentDashboard().data)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const isAgent = Boolean(user?.roles?.includes('agent'))
  const verified = isVerifiedAgent(user?.agentVerificationStatus)

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const housesQuery = useQuery({
    queryKey: ['agent-houses'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => agentHousesApi.list(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentHousesApi.remove(id),
    onSuccess: async () => {
      setActionSuccess(t('agent.houses.deleteSuccess'))
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-houses'] })
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('agent.houses.deleteFailed'))
    },
  })

  if (isBootstrapping || !isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  if (!isAgent) {
    return (
      <section className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t('agent.houses.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.roleRequired')}</p>
        <Button asChild variant="outline">
          <Link to="/agent-register">{t('nav.agentRegister')}</Link>
        </Button>
      </section>
    )
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{t('agent.houses.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agent.houses.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/agent/bookings">{t('nav.agentBookings')}</Link>
          </Button>
          {verified ? (
            <Button asChild>
              <Link to="/agent/houses/new">
                <Plus className="size-4" />
                {t('agent.houses.create')}
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled>
              <Plus className="size-4" />
              {t('agent.houses.create')}
            </Button>
          )}
        </div>
      </div>

      {!verified ? (
        <div
          role="status"
          className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100"
        >
          {t('agent.houses.verificationRequired')}
        </div>
      ) : null}

      {actionError ? (
        <p className="text-sm text-destructive" role="alert">
          {actionError}
        </p>
      ) : null}
      {actionSuccess ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-300" role="status">
          {actionSuccess}
        </p>
      ) : null}

      {housesQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
      ) : null}

      {housesQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">
            {t('agent.houses.listError')}
          </p>
          <Button type="button" variant="outline" onClick={() => void housesQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      {housesQuery.isSuccess && (housesQuery.data.items?.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="space-y-2 py-8 text-center">
            <p className="font-medium">{t('agent.houses.emptyTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('agent.houses.emptyHint')}</p>
            {verified ? (
              <Button asChild className="mt-2">
                <Link to="/agent/houses/new">{t('agent.houses.create')}</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {housesQuery.isSuccess && (housesQuery.data.items?.length ?? 0) > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {housesQuery.data.items.map((house) => (
            <li key={house.id}>
              <Card className="h-full">
                <CardHeader className="space-y-1 pb-2">
                  <CardTitle className="text-lg leading-snug">
                    {house.title}
                    {activeDemoBoost(preview.state, house.id) ? (
                      <span className="ml-2 inline-flex items-center rounded-md bg-[#C69245] px-2 py-0.5 align-middle text-[11px] font-bold text-white">{t('agentDash.demoBoostBadge')}</span>
                    ) : null}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {[house.city?.name, house.state?.name].filter(Boolean).join(', ') ||
                      t('houses.locationUnknown')}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">{t('houses.monthlyFeesLabel')}</dt>
                      <dd>{t('houses.monthlyFees', { amount: house.monthlyFees })}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('agent.houses.availability')}</dt>
                      <dd>
                        {house.availability?.toLowerCase() === 'not_available'
                          ? t('agent.houses.notAvailable')
                          : t('agent.houses.available')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('houses.filters.type')}</dt>
                      <dd>{house.propertyType?.name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">{t('agent.houses.postChannel')}</dt>
                      <dd>
                        {house.postChannel?.toLowerCase() === 'roommate'
                          ? t('agent.houses.postChannelRoommate')
                          : t('agent.houses.postChannelAgent')}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {verified ? (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/agent/houses/${house.id}/edit`}>
                          <Pencil className="size-3.5" />
                          {t('agent.houses.edit')}
                        </Link>
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" disabled>
                        <Pencil className="size-3.5" />
                        {t('agent.houses.edit')}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={!verified || deleteMutation.isPending}
                      onClick={() => {
                        if (window.confirm(t('agent.houses.deleteConfirm'))) {
                          setActionSuccess(null)
                          deleteMutation.mutate(house.id)
                        }
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      {t('agent.houses.delete')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
