import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import {
  DataTable,
  FilterBar,
  StatusBadge,
  type DataTableColumn,
} from '@/components/operational'
import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Pagination } from '@/components/ui/pagination'
import { ApiRequestError } from '@/lib/api/client'

import { adminApi } from '../api/admin-api'
import type { PaginatedVerificationList, VerificationQueueFilters, VerificationStatusValue } from '../types'

type QueueKind = 'agent' | 'driver'

type QueueRow = {
  userId: string
  name: string
  email: string
  phone: string
  nrc: string
  extra: string
  submittedAt: string
  verificationStatus: VerificationStatusValue
}

const statusFilters: Array<VerificationStatusValue | 'all'> = ['PENDING', 'VERIFIED', 'REJECTED', 'all']

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

async function loadQueue(
  kind: QueueKind,
  applied: VerificationQueueFilters,
): Promise<PaginatedVerificationList<QueueRow>> {
  if (kind === 'agent') {
    const data = await adminApi.listAgentRegistrations(applied)
    return {
      ...data,
      items: data.items.map((item) => ({
        userId: item.userId,
        name: item.name,
        email: item.email,
        phone: item.phone,
        nrc: item.nrc,
        extra: `${item.city.name} · ${item.serviceRegion.name}`,
        submittedAt: item.submittedAt,
        verificationStatus: item.verificationStatus,
      })),
    }
  }

  const data = await adminApi.listDriverRegistrations(applied)
  return {
    ...data,
    items: data.items.map((item) => ({
      userId: item.userId,
      name: item.name,
      email: item.email,
      phone: item.phone,
      nrc: item.nrc,
      extra: `${item.vehicleLicensePlateNumber} · ${item.vehicleType.name}`,
      submittedAt: item.submittedAt,
      verificationStatus: item.verificationStatus,
    })),
  }
}

export function AdminVerificationQueuePage({ kind }: { kind: QueueKind }) {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const [applied, setApplied] = useState<VerificationQueueFilters>({
    status: 'PENDING',
    page: 1,
    pageSize: 20,
  })

  const listQuery = useQuery({
    queryKey: ['admin', kind, 'verifications', applied],
    queryFn: () => loadQueue(kind, applied),
  })

  const titleKey = kind === 'agent' ? 'admin.verifications.agentQueueTitle' : 'admin.verifications.driverQueueTitle'
  const subtitleKey =
    kind === 'agent' ? 'admin.verifications.agentQueueSubtitle' : 'admin.verifications.driverQueueSubtitle'
  const detailBase = kind === 'agent' ? '/admin/verifications/agents' : '/admin/verifications/drivers'
  const extraHeader = kind === 'agent' ? t('admin.verifications.columns.location') : t('admin.verifications.columns.vehicle')

  const rows = listQuery.data?.items ?? []
  const activeFilters = [
    ...(applied.status && applied.status !== 'all'
      ? [{
          key: 'status',
          label: t(`admin.verifications.filter.${applied.status}`),
          onRemove: () => setApplied((current) => ({ ...current, status: 'all', page: 1 })),
        }]
      : []),
    ...(applied.q
      ? [{
          key: 'q',
          label: applied.q,
          onRemove: () => {
            setSearchInput('')
            setApplied((current) => ({ ...current, q: undefined, page: 1 }))
          },
        }]
      : []),
  ]

  const columns: DataTableColumn<QueueRow>[] = [
    {
      key: 'name',
      header: t('admin.verifications.columns.name'),
      cell: (row) => <span className="font-medium">{row.name}</span>,
      sortValue: (row) => row.name,
    },
    {
      key: 'contact',
      header: t('admin.verifications.columns.contact'),
      cell: (row) => (
        <div>
          <div>{row.phone}</div>
          <div className="text-xs text-muted-foreground">{row.email}</div>
        </div>
      ),
      sortValue: (row) => row.email,
    },
    {
      key: 'nrc',
      header: t('agent.nrc'),
      cell: (row) => row.nrc,
      sortValue: (row) => row.nrc,
      hideOnMobile: true,
    },
    {
      key: 'extra',
      header: extraHeader,
      cell: (row) => row.extra,
      sortValue: (row) => row.extra,
      hideOnMobile: true,
    },
    {
      key: 'submittedAt',
      header: t('admin.verifications.columns.submitted'),
      cell: (row) => formatDate(row.submittedAt),
      sortValue: (row) => new Date(row.submittedAt),
    },
    {
      key: 'status',
      header: t('admin.verifications.columns.status'),
      cell: (row) => (
        <StatusBadge
          status={row.verificationStatus}
          label={t(`admin.verifications.filter.${row.verificationStatus}`, { defaultValue: row.verificationStatus })}
        />
      ),
      sortValue: (row) => row.verificationStatus,
    },
    {
      key: 'actions',
      header: t('admin.verifications.columns.actions'),
      align: 'right',
      cell: (row) => (
        <Button asChild size="sm" variant="outline">
          <Link to={`${detailBase}/${row.userId}`}>{t('admin.verifications.review')}</Link>
        </Button>
      ),
      mobileFullWidth: true,
    },
  ]

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(titleKey)}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t(subtitleKey)}</p>
      </div>

      <FilterBar
        description={t('admin.verifications.filtersDescription')}
        onSubmit={() => setApplied((current) => ({ ...current, q: searchInput.trim() || undefined, page: 1 }))}
        onClear={() => {
          setSearchInput('')
          setApplied({ status: 'PENDING', page: 1, pageSize: 20 })
        }}
        activeFilters={activeFilters}
      >
        <div className="space-y-2">
          <Label htmlFor={`${kind}-status`}>{t('admin.verifications.statusFilter')}</Label>
          <select
            id={`${kind}-status`}
            className={selectClassName}
            value={applied.status ?? 'PENDING'}
            onChange={(event) => {
              const status = event.target.value as VerificationStatusValue | 'all'
              setApplied((current) => ({ ...current, status, page: 1 }))
            }}
          >
            {statusFilters.map((status) => (
              <option key={status} value={status}>
                {t(`admin.verifications.filter.${status}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor={`${kind}-search`}>{t('admin.verifications.search')}</Label>
          <Input
            id={`${kind}-search`}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('admin.verifications.searchPlaceholder')}
          />
        </div>
      </FilterBar>

      {listQuery.isError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-danger-soft p-4">
          <p className="text-sm text-destructive">
            {listQuery.error instanceof ApiRequestError ? listQuery.error.message : t('admin.verifications.loadError')}
          </p>
          <Button type="button" variant="outline" onClick={() => void listQuery.refetch()}>
            {t('common.retry')}
          </Button>
        </div>
      ) : null}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.userId}
        caption={t(titleKey)}
        isLoading={listQuery.isLoading}
        loadingRows={applied.pageSize ?? 10}
        emptyMessage={t('admin.verifications.empty')}
        selectable
        rowLabel={(row) => row.name}
        csv={{
          fileName: `admin-${kind}-verifications`,
          columns: [
            { header: t('admin.verifications.columns.name'), value: (row) => row.name },
            { header: t('auth.phone'), value: (row) => row.phone },
            { header: t('auth.email'), value: (row) => row.email },
            { header: t('agent.nrc'), value: (row) => row.nrc },
            { header: extraHeader, value: (row) => row.extra },
            { header: t('admin.verifications.columns.submitted'), value: (row) => formatDate(row.submittedAt) },
            { header: t('admin.verifications.columns.status'), value: (row) => row.verificationStatus },
          ],
        }}
        toolbar={
          listQuery.data ? (
            <span className="text-sm text-muted-foreground">
              {t('admin.verifications.records', { count: listQuery.data.total })}
            </span>
          ) : null
        }
        footer={
          listQuery.data && listQuery.data.totalPages > 1 ? (
            <Pagination
              page={listQuery.data.page}
              totalPages={listQuery.data.totalPages}
              status={t('admin.verifications.pageOf', {
                page: listQuery.data.page,
                totalPages: listQuery.data.totalPages,
              })}
              onPageChange={(page) => setApplied((current) => ({ ...current, page }))}
            />
          ) : null
        }
      />
    </section>
  )
}
