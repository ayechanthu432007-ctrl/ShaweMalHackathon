import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import {
  ConfirmDialog,
  DataTable,
  FilterBar,
  StatusBadge,
  humanizeStatus,
  type DataTableColumn,
} from '@/components/operational'
import { LoadingState } from '@/components/common/PageStates'
import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { selectClassName } from '@/components/ui/field-styles'
import { ApiRequestError } from '@/lib/api/client'
import { bookingsApi } from '@/features/houses/api/bookings-api'
import type { HouseBooking } from '@/features/houses/types/booking'

import { agentBookingsApi } from '../api/agent-bookings-api'

function isActiveBooking(status: string): boolean {
  return status.toUpperCase() !== 'CANCELLED'
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

export function AgentBookingsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, isBootstrapping, user } = useAuth()
  const queryClient = useQueryClient()
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [cancelTarget, setCancelTarget] = useState<HouseBooking | null>(null)
  const isAgent = Boolean(user?.roles?.includes('agent'))

  useEffect(() => {
    if (!isBootstrapping && !isAuthenticated) {
      navigate('/sign-in', { replace: true, state: { from: location.pathname } })
    }
  }, [isAuthenticated, isBootstrapping, location.pathname, navigate])

  const bookingsQuery = useQuery({
    queryKey: ['agent-bookings'],
    enabled: isAuthenticated && isAgent,
    queryFn: () => agentBookingsApi.list(),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: string) => bookingsApi.updateStatus(id, 'CANCELLED'),
    onSuccess: async () => {
      setCancelTarget(null)
      setActionError(null)
      await queryClient.invalidateQueries({ queryKey: ['agent-bookings'] })
    },
    onError: (error) => {
      setActionError(error instanceof ApiRequestError ? error.message : t('agent.bookings.cancelFailed'))
    },
  })

  const allBookings = useMemo(() => bookingsQuery.data?.items ?? [], [bookingsQuery.data?.items])
  const bookings = useMemo(() => {
    const term = search.trim().toLowerCase()
    return allBookings.filter((booking) => {
      if (status !== 'all' && booking.status.toUpperCase() !== status) return false
      if (!term) return true
      return [booking.house?.title, booking.user?.name, booking.user?.email, booking.user?.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    })
  }, [allBookings, search, status])

  if (isBootstrapping || !isAuthenticated) {
    return <LoadingState />
  }

  if (!isAgent) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.bookings.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('agent.houses.roleRequired')}</p>
      </section>
    )
  }

  const columns: DataTableColumn<HouseBooking>[] = [
    {
      key: 'house',
      header: t('agent.bookings.houseColumn'),
      cell: (booking) => (
        <Link to={`/houses/${booking.houseId}`} className="font-medium hover:underline">
          {booking.house?.title ?? booking.houseId}
        </Link>
      ),
      sortValue: (booking) => booking.house?.title ?? booking.houseId,
    },
    {
      key: 'booker',
      header: t('agent.bookings.bookerDetails'),
      cell: (booking) => (
        <div>
          <div>{booking.user?.name ?? '—'}</div>
          <div className="text-xs text-muted-foreground">{booking.user?.email ?? '—'}</div>
        </div>
      ),
      sortValue: (booking) => booking.user?.name ?? '',
    },
    {
      key: 'phone',
      header: t('auth.phone'),
      cell: (booking) => booking.user?.phone ?? '—',
      hideOnMobile: true,
    },
    {
      key: 'createdAt',
      header: t('agent.bookings.bookedAt'),
      cell: (booking) => formatDate(booking.createdAt),
      sortValue: (booking) => new Date(booking.createdAt),
    },
    {
      key: 'status',
      header: t('agent.bookings.status'),
      cell: (booking) => <StatusBadge status={booking.status} />,
      sortValue: (booking) => booking.status,
    },
    {
      key: 'cancelledBy',
      header: t('agent.bookings.cancelledByLabel'),
      cell: (booking) =>
        booking.status.toUpperCase() === 'CANCELLED'
          ? t('agent.bookings.cancelledBy', { actor: booking.cancelledByRole ?? '—' })
          : '—',
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: t('admin.verifications.columns.actions'),
      align: 'right',
      cell: (booking) =>
        isActiveBooking(booking.status) ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={cancelMutation.isPending}
            onClick={() => {
              setActionError(null)
              setCancelTarget(booking)
            }}
          >
            {t('houses.cancelBooking')}
          </Button>
        ) : null,
      mobileFullWidth: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('agent.bookings.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('agent.bookings.subtitle')}</p>
        </div>
        <Button asChild variant="outline">
          <Link to="/agent/houses">{t('agent.houses.title')}</Link>
        </Button>
      </div>

      {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}

      <FilterBar
        title={t('agent.bookings.filtersTitle')}
        description={t('agent.bookings.filtersDescription')}
        onClear={() => {
          setSearch('')
          setStatus('all')
        }}
        activeFilters={[
          ...(search.trim() ? [{ key: 'search', label: search.trim(), onRemove: () => setSearch('') }] : []),
          ...(status !== 'all' ? [{ key: 'status', label: status, onRemove: () => setStatus('all') }] : []),
        ]}
      >
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="agent-booking-search">{t('agent.bookings.searchLabel')}</Label>
          <Input
            id="agent-booking-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('agent.bookings.searchPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-booking-status">{t('agent.bookings.status')}</Label>
          <select
            id="agent-booking-status"
            className={selectClassName}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">{t('agent.bookings.statusAll')}</option>
            {(['PENDING', 'CONFIRMED', 'CANCELLED'] as const).map((code) => (
              <option key={code} value={code}>
                {humanizeStatus(code)}
              </option>
            ))}
          </select>
        </div>
      </FilterBar>

      {bookingsQuery.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive">{t('agent.bookings.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void bookingsQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={bookings}
        columns={columns}
        rowKey={(booking) => booking.id}
        caption={t('agent.bookings.title')}
        isLoading={bookingsQuery.isLoading}
        emptyMessage={allBookings.length === 0 ? t('agent.bookings.empty') : t('agent.bookings.noMatches')}
        selectable
        rowLabel={(booking) => booking.house?.title ?? booking.id}
        csv={{
          fileName: 'agent-bookings',
          columns: [
            { header: t('agent.bookings.houseColumn'), value: (booking) => booking.house?.title ?? booking.houseId },
            { header: t('agent.bookings.bookerDetails'), value: (booking) => booking.user?.name ?? '' },
            { header: t('auth.email'), value: (booking) => booking.user?.email ?? '' },
            { header: t('auth.phone'), value: (booking) => booking.user?.phone ?? '' },
            { header: t('agent.bookings.bookedAt'), value: (booking) => formatDate(booking.createdAt) },
            { header: t('agent.bookings.status'), value: (booking) => booking.status },
            { header: t('agent.bookings.cancelledByLabel'), value: (booking) => booking.cancelledByRole ?? '' },
          ],
        }}
        toolbar={
          <span className="text-sm text-muted-foreground">
            {t('agent.bookings.itemCount', { count: bookings.length })}
          </span>
        }
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title={t('agent.bookings.cancelConfirmTitle')}
        description={t('agent.bookings.cancelConfirmBody')}
        recordName={cancelTarget?.house?.title ?? cancelTarget?.houseId}
        confirmLabel={t('houses.cancelBooking')}
        isPending={cancelMutation.isPending}
        onCancel={() => {
          if (!cancelMutation.isPending) setCancelTarget(null)
        }}
        onConfirm={() => {
          if (cancelTarget) cancelMutation.mutate(cancelTarget.id)
        }}
      />
    </section>
  )
}
