import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { selectClassName } from '@/components/ui/field-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'

import { adminApi } from '../api/admin-api'
import type { AdminRole, AdminSafeUser } from '../types'

const ROLES: AdminRole[] = ['normal', 'agent', 'driver', 'admin']

type CreateUserFormValues = {
  name: string
  email: string
  phone: string
  password: string
  role: AdminRole
}

type RolesFormValues = {
  userId: string
  roles: AdminRole[]
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<AdminSafeUser | null>(null)
  const [rolesError, setRolesError] = useState<string | null>(null)
  const [rolesSuccess, setRolesSuccess] = useState<AdminSafeUser | null>(null)

  const createForm = useForm<CreateUserFormValues>({
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      role: 'normal',
    },
  })

  const rolesForm = useForm<RolesFormValues>({
    defaultValues: {
      userId: '',
      roles: ['normal'],
    },
  })

  const onCreate = createForm.handleSubmit(async (values) => {
    setCreateError(null)
    setCreateSuccess(null)

    try {
      const result = await adminApi.createUser({
        name: values.name.trim(),
        email: values.email.trim(),
        phone: values.phone.trim(),
        password: values.password,
        role: values.role,
      })
      setCreateSuccess(result.user)
      createForm.reset({
        name: '',
        email: '',
        phone: '',
        password: '',
        role: values.role,
      })
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setCreateError(error.message)
      } else {
        setCreateError(t('admin.users.createFailed'))
      }
    }
  })

  const onUpdateRoles = rolesForm.handleSubmit(async (values) => {
    const userId = values.userId.trim()
    if (!userId) return
    if (!values.roles.length) {
      setRolesError(t('admin.users.rolesRequired'))
      return
    }

    setRolesError(null)
    setRolesSuccess(null)

    try {
      const result = await adminApi.updateUserRoles(userId, { roles: values.roles })
      setRolesSuccess(result.user)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        setRolesError(error.message)
      } else {
        setRolesError(t('admin.users.rolesFailed'))
      }
    }
  })

  const selectedRoles = rolesForm.watch('roles')

  const toggleRole = (role: AdminRole) => {
    const current = rolesForm.getValues('roles')
    if (current.includes(role)) {
      rolesForm.setValue(
        'roles',
        current.filter((item) => item !== role),
        { shouldDirty: true },
      )
      return
    }
    rolesForm.setValue('roles', [...current, role], { shouldDirty: true })
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('admin.users.title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{t('admin.users.subtitle')}</p>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{t('admin.users.listGap')}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.users.createTitle')}</CardTitle>
            <CardDescription>{t('admin.users.createDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onCreate} noValidate>
              <div className="space-y-2">
                <Label htmlFor="create-name">{t('auth.name')}</Label>
                <Input id="create-name" {...createForm.register('name', { required: t('auth.required') })} />
                {createForm.formState.errors.name ? (
                  <p className="text-sm text-destructive" role="alert">
                    {createForm.formState.errors.name.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-email">{t('auth.email')}</Label>
                <Input
                  id="create-email"
                  type="email"
                  {...createForm.register('email', { required: t('auth.required') })}
                />
                {createForm.formState.errors.email ? (
                  <p className="text-sm text-destructive" role="alert">
                    {createForm.formState.errors.email.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-phone">{t('auth.phone')}</Label>
                <Input id="create-phone" {...createForm.register('phone', { required: t('auth.required') })} />
                {createForm.formState.errors.phone ? (
                  <p className="text-sm text-destructive" role="alert">
                    {createForm.formState.errors.phone.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-password">{t('auth.password')}</Label>
                <Input
                  id="create-password"
                  type="password"
                  {...createForm.register('password', {
                    required: t('auth.required'),
                    minLength: { value: 8, message: t('auth.minPassword') },
                  })}
                />
                {createForm.formState.errors.password ? (
                  <p className="text-sm text-destructive" role="alert">
                    {createForm.formState.errors.password.message}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-role">{t('admin.users.role')}</Label>
                <select id="create-role" className={selectClassName} {...createForm.register('role')}>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`admin.users.roles.${role}`)}
                    </option>
                  ))}
                </select>
              </div>

              {createError ? (
                <p className="text-sm text-destructive" role="alert">
                  {createError}
                </p>
              ) : null}
              {createSuccess ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
                  {t('admin.users.createSuccess', {
                    name: createSuccess.name,
                    id: createSuccess.id,
                  })}
                </p>
              ) : null}

              <Button type="submit" disabled={createForm.formState.isSubmitting}>
                {createForm.formState.isSubmitting ? t('common.loading') : t('admin.users.createSubmit')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.users.rolesTitle')}</CardTitle>
            <CardDescription>{t('admin.users.rolesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onUpdateRoles} noValidate>
              <div className="space-y-2">
                <Label htmlFor="roles-userId">{t('admin.users.userId')}</Label>
                <Input
                  id="roles-userId"
                  {...rolesForm.register('userId', { required: t('auth.required') })}
                  placeholder={t('admin.users.userIdPlaceholder')}
                />
                {rolesForm.formState.errors.userId ? (
                  <p className="text-sm text-destructive" role="alert">
                    {rolesForm.formState.errors.userId.message}
                  </p>
                ) : null}
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t('admin.users.rolesLabel')}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role)}
                        onChange={() => toggleRole(role)}
                      />
                      {t(`admin.users.roles.${role}`)}
                    </label>
                  ))}
                </div>
              </fieldset>

              {rolesError ? (
                <p className="text-sm text-destructive" role="alert">
                  {rolesError}
                </p>
              ) : null}
              {rolesSuccess ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
                  {t('admin.users.rolesSuccess', {
                    name: rolesSuccess.name,
                    roles: rolesSuccess.roles.join(', '),
                  })}
                </p>
              ) : null}

              <Button type="submit" disabled={rolesForm.formState.isSubmitting}>
                {rolesForm.formState.isSubmitting ? t('common.loading') : t('admin.users.rolesSubmit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
