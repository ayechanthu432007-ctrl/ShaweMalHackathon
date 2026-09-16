import { UserRound } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'

import { useAuth } from '@/app/providers/AuthProvider'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const onLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <UserRound className="size-4" />
          <span className="max-w-[10rem] truncate">{user?.name ?? t('nav.profile')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="space-y-0.5">
            <p className="truncate font-medium">{user?.name}</p>
            <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/profile">{t('nav.profile')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile/wishlist">{t('nav.wishlist')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile/history">{t('nav.history')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/marketplace/my">{t('nav.myMarketplace')}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/agent-register">{t('nav.agentRegister')}</Link>
        </DropdownMenuItem>
        {user?.roles?.includes('agent') ? (
          <>
            <DropdownMenuItem asChild>
              <Link to="/agent/houses">{t('nav.agentHouses')}</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/agent/bookings">{t('nav.agentBookings')}</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link to="/driver-register">{t('nav.driverRegister')}</Link>
        </DropdownMenuItem>
        {user?.roles?.includes('admin') ? (
          <DropdownMenuItem asChild>
            <Link to="/admin/dashboard">{t('nav.admin')}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(event) => {
            event.preventDefault()
            void onLogout()
          }}
        >
          {t('auth.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
