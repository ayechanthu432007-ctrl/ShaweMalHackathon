import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import {
  ConfirmDialog,
  DataTable,
  FilterBar,
  StatusBadge,
  type DataTableColumn,
} from '@/components/operational'
import { formatMmk } from '@/lib/format'
import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectClassName } from '@/components/ui/field-styles'
import { ApiRequestError } from '@/lib/api/client'

import { agentHousesApi } from '../api/agent-houses-api'
import { useAgentDashboard } from '../layout/AgentDashboardLayout'
import { activeDemoBoost, useAgentDemoPreview } from '../lib/agent-demo-preview'

function isVerifiedAgent(status: string | null | undefined): boolean {
  return (status ?? '').toUpperCase() === 'VERIFIED'
}

type AgentHouse = Awaited<ReturnType<typeof agentHousesApi.list>>['items'][number]

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
  const [search, setSearch] = useState('')
  const [availability, setAvailability] = useState<'all' | 'available' | 'not_available'>('all')
  const [deleteTarget, setDeleteTarget] = useState<AgentHouse | null>(null)

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
      setDeleteTarget(null)
      setActionSuccess(t('agent.houses.deleteSuccess'))
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-houses'] })
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('agent.houses.deleteFailed'))
    },
  })

  const allHouses = useMemo(() => housesQuery.data?.items ?? [], [housesQuery.data?.items])
  const houses = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allHouses.filter((house) => {
      const isAvailable = house.availability?.toLowerCase() !== 'not_available'
      if (availability === 'available' && !isAvailable) return false
      if (availability === 'not_available' && isAvailable) return false
      if (!term) return true
      return [house.title, house.city?.name, house.state?.name, house.propertyType?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [allHouses, availability, search])

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (!isAgent) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.houses.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.roleRequired')}</p>
        <Button asChild variant="outline">
          <Link to="/agent-register">{t('nav.agentRegister')}</Link>
        </Button>
      </section>
    )
  }

  const availabilityLabel = (house: AgentHouse) =>
    house.availability?.toLowerCase() === 'not_available'
      ? t('agent.houses.notAvailable')
      : t('agent.houses.available')

  const columns: DataTableColumn<AgentHouse>[] = [
    {
      key: 'title',
      header: t('agent.houses.columnTitle'),
      cell: (house) => (
        <div className="space-y-1">
          <div className="font-medium">{house.title}</div>
          {activeDemoBoost(preview.state, house.id) ? (
            <span className="inline-flex items-center rounded-md border border-gold/40 bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-gold-ink">
              {t('agentDash.demoBoostBadge')}
            </span>
          ) : null}
        </div>
      ),
      sortValue: (house) => house.title,
    },
    {
      key: 'location',
      header: t('agent.houses.columnLocation'),
      cell: (house) =>
        [house.city?.name, house.state?.name].filter(Boolean).join(', ') || t('houses.locationUnknown'),
      sortValue: (house) => house.city?.name ?? '',
    },
    {
      key: 'fees',
      header: t('houses.monthlyFeesLabel'),
      cell: (house) => t('houses.monthlyFees', { amount: formatMmk(house.monthlyFees) }),
      sortValue: (house) => house.monthlyFees ?? 0,
      align: 'right',
    },
    {
      key: 'type',
      header: t('houses.filters.type'),
      cell: (house) => house.propertyType?.name ?? '—',
      sortValue: (house) => house.propertyType?.name ?? '',
      hideOnMobile: true,
    },
    {
      key: 'availability',
      header: t('agent.houses.availability'),
      cell: (house) => (
        <StatusBadge
          status={house.availability?.toLowerCase() === 'not_available' ? 'NOT_AVAILABLE' : 'AVAILABLE'}
          label={availabilityLabel(house)}
        />
      ),
      sortValue: (house) => house.availability ?? '',
    },
    {
      key: 'channel',
      header: t('agent.houses.postChannel'),
      cell: (house) =>
        house.postChannel?.toLowerCase() === 'roommate'
          ? t('agent.houses.postChannelRoommate')
          : t('agent.houses.postChannelAgent'),
      sortValue: (house) => house.postChannel ?? '',
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: t('admin.verifications.columns.actions'),
      align: 'right',
      cell: (house) => (
        <div className="flex flex-wrap justify-end gap-2">
          {verified ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/agent/houses/${house.id}/edit`}>
                <Pencil className="size-3.5" aria-hidden />
                {t('agent.houses.edit')}
              </Link>
            </Button>
          ) : (
            <Button type="button" size="sm" variant="outline" disabled>
              <Pencil className="size-3.5" aria-hidden />
              {t('agent.houses.edit')}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            disabled={!verified || deleteMutation.isPending}
            onClick={() => {
              setActionSuccess(null)
              setDeleteTarget(house)
            }}
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t('agent.houses.delete')}
          </Button>
        </div>
      ),
      mobileFullWidth: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.houses.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agent.houses.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/agent/bookings">{t('nav.agentBookings')}</Link>
          </Button>
          {verified ? (
            <Button asChild>
              <Link to="/agent/houses/new">
                <Plus className="size-4" aria-hidden />
                {t('agent.houses.create')}
              </Link>
            </Button>
          ) : (
            <Button type="button" disabled>
              <Plus className="size-4" aria-hidden />
              {t('agent.houses.create')}
            </Button>
          )}
        </div>
      </div>

      {!verified ? (
        <div
          role="status"
          className="rounded-md border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning"
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
        <p className="text-sm text-success-ink" role="status">
          {actionSuccess}
        </p>
      ) : null}

      <FilterBar
        title={t('agent.houses.filtersTitle')}
        description={t('agent.houses.filtersDescription')}
        onClear={() => {
          setSearch('')
          setAvailability('all')
        }}
        activeFilters={[
          ...(search.trim() ? [{ key: 'search', label: search.trim(), onRemove: () => setSearch('') }] : []),
          ...(availability !== 'all'
            ? [{
                key: 'availability',
                label: availability === 'available' ? t('agent.houses.available') : t('agent.houses.notAvailable'),
                onRemove: () => setAvailability('all'),
              }]
            : []),
        ]}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="agent-house-search">{t('agent.houses.searchLabel')}</Label>
          <Input
            id="agent-house-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('agent.houses.searchPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-house-availability">{t('agent.houses.availability')}</Label>
          <select
            id="agent-house-availability"
            className={selectClassName}
            value={availability}
            onChange={(event) => setAvailability(event.target.value as typeof availability)}
          >
            <option value="all">{t('agent.houses.availabilityAll')}</option>
            <option value="available">{t('agent.houses.available')}</option>
            <option value="not_available">{t('agent.houses.notAvailable')}</option>
          </select>
        </div>
      </FilterBar>

      {deleteMutation.isError ? (
        <p className="text-sm text-destructive" role="alert">
          {t('agent.houses.deleteFailed')}
        </p>
      ) : null}

      <DataTable
        rows={houses}
        columns={columns}
        rowKey={(house) => house.id}
        caption={t('agent.houses.title')}
        isLoading={housesQuery.isLoading}
        emptyMessage={
          allHouses.length === 0 ? (
            <span className="block space-y-2">
              <span className="block font-medium text-foreground">{t('agent.houses.emptyTitle')}</span>
              <span className="block">{t('agent.houses.emptyHint')}</span>
            </span>
          ) : (
            t('agent.houses.noMatches')
          )
        }
        csv={{
          fileName: 'agent-house-listings',
          columns: [
            { header: t('agent.houses.columnTitle'), value: (house) => house.title },
            { header: t('agent.houses.columnLocation'), value: (house) => [house.city?.name, house.state?.name].filter(Boolean).join(', ') },
            { header: t('houses.monthlyFeesLabel'), value: (house) => house.monthlyFees ?? '' },
            { header: t('houses.filters.type'), value: (house) => house.propertyType?.name ?? '' },
            { header: t('agent.houses.availability'), value: (house) => availabilityLabel(house) },
            { header: t('agent.houses.postChannel'), value: (house) => house.postChannel ?? '' },
          ],
        }}
        toolbar={
          <span className="text-sm text-muted-foreground">
            {t('agent.houses.itemCount', { count: houses.length })}
          </span>
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={t('agent.houses.deleteConfirmTitle')}
        description={t('agent.houses.deleteConfirmBody')}
        recordName={deleteTarget?.title}
        confirmLabel={t('agent.houses.delete')}
        isPending={deleteMutation.isPending}
        onCancel={() => {
          if (!deleteMutation.isPending) setDeleteTarget(null)
        }}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
        }}
      />
    </section>
  )
}
