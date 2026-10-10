import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { formatDate, formatMmk, type PaymentOrder, type Plan } from '@/features/agent/api/agent-plan-api'
import { apiRequest } from '@/lib/api/client'

type Person = { id: string; name: string; email: string }
type Overview = {
  plans: Plan[]
  orders: Array<PaymentOrder & { user: Person }>
  activeSubscriptions: Array<{ id: string; user: Person; plan: { code: string; name: string }; billingMonths: number; startsAt: string; endsAt: string }>
}

const headCell = 'px-3 py-2 font-medium'
const cell = 'px-3 py-2'

export function AdminSubscriptionsPage() {
  const { t } = useTranslation()
  const query = useQuery({ queryKey: ['admin', 'subscriptions'], queryFn: () => apiRequest<Overview>('/admin/subscriptions') })
  const data = query.data

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t('admin.subscriptions.title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('admin.subscriptions.subtitle')}</p>
      </div>

      {query.isLoading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {query.isError ? (
        <div className="space-y-2">
          <p className="text-sm text-destructive" role="alert">{t('agentDash.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('common.retry')}</Button>
        </div>
      ) : null}

      {data ? (
        <>
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{t('admin.subscriptions.plans')}</h2>
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full min-w-[36rem] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th scope="col" className={headCell}>{t('admin.subscriptions.plan')}</th>
                    <th scope="col" className={`${headCell} text-right`}>{t('agentDash.monthly')}</th>
                    <th scope="col" className={`${headCell} text-right`}>{t('agentDash.threeMonths')}</th>
                    <th scope="col" className={`${headCell} text-right`}>{t('admin.subscriptions.listingLimit')}</th>
                    <th scope="col" className={`${headCell} text-right`}>{t('agentDash.freeBoostDays')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.plans.map((plan) => (
                    <tr key={plan.code} className="border-b last:border-0">
                      <td className={`${cell} font-medium`}>{plan.name}</td>
                      <td className={`${cell} text-right tabular-nums`}>{formatMmk(plan.monthlyPriceMmk)}</td>
                      <td className={`${cell} text-right tabular-nums`}>{formatMmk(plan.quarterlyPriceMmk)}</td>
                      <td className={`${cell} text-right tabular-nums`}>{plan.monthlyListingLimit ?? t('admin.subscriptions.unlimited')}</td>
                      <td className={`${cell} text-right tabular-nums`}>{plan.freeBoostDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{t('admin.subscriptions.active')}</h2>
            {data.activeSubscriptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.subscriptions.noneActive')}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className={headCell}>{t('admin.subscriptions.agent')}</th>
                      <th scope="col" className={headCell}>{t('admin.subscriptions.plan')}</th>
                      <th scope="col" className={headCell}>{t('admin.subscriptions.period')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.activeSubscriptions.map((item) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className={cell}>
                          {item.user.name}
                          <span className="block text-xs text-muted-foreground">{item.user.email}</span>
                        </td>
                        <td className={cell}>{item.plan.name}</td>
                        <td className={cell}>{formatDate(item.startsAt)} – {formatDate(item.endsAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-semibold">{t('admin.subscriptions.orders')}</h2>
            {data.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('agentDash.noOrders')}</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[42rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th scope="col" className={headCell}>{t('agentDash.orderRef')}</th>
                      <th scope="col" className={headCell}>{t('admin.subscriptions.agent')}</th>
                      <th scope="col" className={headCell}>{t('agentDash.item')}</th>
                      <th scope="col" className={`${headCell} text-right`}>{t('agentDash.amount')}</th>
                      <th scope="col" className={headCell}>{t('agentDash.status')}</th>
                      <th scope="col" className={headCell}>{t('agentDash.date')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr key={order.reference} className="border-b last:border-0">
                        <td className={cell}>
                          <span className="font-mono text-xs">{order.reference}</span>
                          {order.isDemo ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">DEMO</span> : null}
                        </td>
                        <td className={cell}>{order.user.name}</td>
                        <td className={cell}>
                          {order.kind === 'SUBSCRIPTION' ? `${order.plan?.name ?? ''} · ${t('agentDash.monthsCount', { count: order.billingMonths ?? 0 })}` : t('agentDash.boostDaysCount', { count: order.boostDays ?? 0 })}
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>{formatMmk(order.amountMmk)}</td>
                        <td className={cell}>{t(`agentDash.orderStatus.${order.status}`)}</td>
                        <td className={`${cell} text-muted-foreground`}>{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </section>
  )
}
