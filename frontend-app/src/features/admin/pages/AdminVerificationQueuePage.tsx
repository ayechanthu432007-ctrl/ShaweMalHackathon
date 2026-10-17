import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(titleKey)}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t(subtitleKey)}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.verifications.filtersTitle')}</CardTitle>
          <CardDescription>{t('admin.verifications.filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              setApplied((current) => ({
                ...current,
                q: searchInput.trim() || undefined,
                page: 1,
              }))
            }}
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
            <div className="min-w-[16rem] flex-1 space-y-2">
              <Label htmlFor={`${kind}-search`}>{t('admin.verifications.search')}</Label>
              <Input
                id={`${kind}-search`}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={t('admin.verifications.searchPlaceholder')}
              />
            </div>
            <Button type="submit">{t('admin.reports.apply')}</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSearchInput('')
                setApplied({ status: 'PENDING', page: 1, pageSize: 20 })
              }}
            >
              {t('common.clear')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('common.loading')}
        </p>
      ) : null}

      {listQuery.isError ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.verifications.loadError')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              {listQuery.error instanceof ApiRequestError
                ? listQuery.error.message
                : t('admin.verifications.loadError')}
            </p>
            <Button type="button" onClick={() => void listQuery.refetch()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {listQuery.data ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.verifications.records', { count: listQuery.data.total })}</CardTitle>
          </CardHeader>
          <CardContent>
            {listQuery.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.verifications.empty')}</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[48rem] text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-2 pr-3">{t('admin.verifications.columns.name')}</th>
                      <th className="py-2 pr-3">{t('admin.verifications.columns.contact')}</th>
                      <th className="py-2 pr-3">{t('agent.nrc')}</th>
                      {kind === 'agent' ? (
                        <th className="py-2 pr-3">{t('admin.verifications.columns.location')}</th>
                      ) : (
                        <th className="py-2 pr-3">{t('admin.verifications.columns.vehicle')}</th>
                      )}
                      <th className="py-2 pr-3">{t('admin.verifications.columns.submitted')}</th>
                      <th className="py-2 pr-3">{t('admin.verifications.columns.status')}</th>
                      <th className="py-2">{t('admin.verifications.columns.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listQuery.data.items.map((item) => (
                      <tr key={item.userId} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{item.name}</td>
                        <td className="py-2 pr-3">
                          {item.phone}
                          <div className="text-xs text-muted-foreground">{item.email}</div>
                        </td>
                        <td className="py-2 pr-3">{item.nrc}</td>
                        <td className="py-2 pr-3">{item.extra}</td>
                        <td className="py-2 pr-3">{formatDate(item.submittedAt)}</td>
                        <td className="py-2 pr-3">{item.verificationStatus}</td>
                        <td className="py-2">
                          <Button asChild size="sm" variant="outline">
                            <Link to={`${detailBase}/${item.userId}`}>{t('admin.verifications.review')}</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {listQuery.data.totalPages > 1 ? (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  {t('admin.verifications.pageOf', {
                    page: listQuery.data.page,
                    totalPages: listQuery.data.totalPages,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={listQuery.data.page <= 1}
                    onClick={() =>
                      setApplied((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))
                    }
                  >
                    {t('common.previous')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={listQuery.data.page >= listQuery.data.totalPages}
                    onClick={() =>
                      setApplied((current) => ({ ...current, page: (current.page ?? 1) + 1 }))
                    }
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}
