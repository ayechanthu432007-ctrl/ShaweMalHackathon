import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { notificationsApi } from '../api/notifications-api'

export function NotificationsMenu() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const unreadCount = notificationsQuery.data?.unreadCount ?? 0
  const items = notificationsQuery.data?.items ?? []

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('nav.notifications')}
          className="relative"
        >
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel>{t('nav.notifications')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notificationsQuery.isLoading ? (
          <DropdownMenuItem disabled>{t('common.loading')}</DropdownMenuItem>
        ) : null}
        {notificationsQuery.isError ? (
          <DropdownMenuItem disabled>{t('notifications.loadError')}</DropdownMenuItem>
        ) : null}
        {!notificationsQuery.isLoading && !notificationsQuery.isError && items.length === 0 ? (
          <DropdownMenuItem disabled>{t('notifications.empty')}</DropdownMenuItem>
        ) : null}
        {items.slice(0, 8).map((item) => (
          <DropdownMenuItem
            key={item.id}
            className="flex cursor-pointer flex-col items-start gap-1 whitespace-normal"
            onSelect={() => {
              if (!item.isRead) {
                void markReadMutation.mutateAsync(item.id)
              }
            }}
          >
            <span className={item.isRead ? 'font-normal' : 'font-semibold'}>{item.title}</span>
            <span className="text-xs text-muted-foreground">{item.message}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
