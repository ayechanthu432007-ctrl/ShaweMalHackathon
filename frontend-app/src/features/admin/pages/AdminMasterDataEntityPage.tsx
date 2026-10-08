import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'

import { BackLink } from '@/components/common/BackButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiRequestError } from '@/lib/api/client'

import { adminMasterDataApi } from '../api/admin-master-data-api'
import {
  ADMIN_MASTER_DATA_ENTITIES,
  MASTER_DATA_FIELD_CONFIG,
  getMasterDataDisplayLabel,
  type MasterDataFieldConfig,
} from '../constants/master-data-entities'
import type { AdminMasterDataEntity, AdminMasterDataItem } from '../types'

const selectClassName =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function isAdminMasterDataEntity(value: string): value is AdminMasterDataEntity {
  return (ADMIN_MASTER_DATA_ENTITIES as string[]).includes(value)
}

function buildDefaultValues(fields: MasterDataFieldConfig[], item?: AdminMasterDataItem | null) {
  const values: Record<string, string | boolean> = {}
  for (const field of fields) {
    if (field.type === 'boolean') {
      values[field.name] = item ? Boolean(item[field.name] ?? true) : true
      continue
    }
    const raw = item?.[field.name]
    values[field.name] = raw === null || raw === undefined ? '' : String(raw)
  }
  return values
}

function buildPayload(fields: MasterDataFieldConfig[], values: Record<string, string | boolean>) {
  const payload: Record<string, unknown> = {}

  for (const field of fields) {
    const value = values[field.name]
    if (field.type === 'boolean') {
      payload[field.name] = Boolean(value)
      continue
    }

    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (!trimmed) {
      if (field.required) {
        payload[field.name] = trimmed
      }
      continue
    }

    if (field.type === 'number') {
      payload[field.name] = Number(trimmed)
    } else {
      payload[field.name] = trimmed
    }
  }

  return payload
}

export function AdminMasterDataEntityPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const params = useParams()
  const entityParam = params.entity ?? ''
  const entity = isAdminMasterDataEntity(entityParam) ? entityParam : null

  const fields = useMemo(() => (entity ? MASTER_DATA_FIELD_CONFIG[entity] : []), [entity])
  const [editingItem, setEditingItem] = useState<AdminMasterDataItem | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const listQuery = useQuery({
    queryKey: ['admin', 'master-data', entity, activeFilter],
    enabled: Boolean(entity),
    queryFn: () =>
      adminMasterDataApi.list(
        entity!,
        activeFilter === 'all' ? undefined : activeFilter === 'active',
      ),
  })

  const form = useForm<Record<string, string | boolean>>({
    defaultValues: buildDefaultValues(fields, null),
  })

  useEffect(() => {
    form.reset(buildDefaultValues(fields, editingItem))
  }, [editingItem, fields, form])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin', 'master-data', entity] })
  }

  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string | boolean>) => {
      if (!entity) throw new Error('Invalid entity')
      const payload = buildPayload(fields, values)
      if (editingItem) {
        return adminMasterDataApi.update(entity, editingItem.id, payload)
      }
      return adminMasterDataApi.create(entity, payload)
    },
    onSuccess: async () => {
      setSuccessMessage(
        editingItem ? t('admin.masterData.updateSuccess') : t('admin.masterData.createSuccess'),
      )
      setFormError(null)
      setEditingItem(null)
      form.reset(buildDefaultValues(fields, null))
      await invalidate()
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
      } else {
        setFormError(t('admin.masterData.saveFailed'))
      }
    },
  })

  const deactivateMutation = useMutation({
    mutationFn: async (item: AdminMasterDataItem) => {
      if (!entity) throw new Error('Invalid entity')
      return adminMasterDataApi.deactivate(entity, item.id)
    },
    onSuccess: async () => {
      setSuccessMessage(t('admin.masterData.deactivateSuccess'))
      await invalidate()
    },
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setFormError(error.message)
      } else {
        setFormError(t('admin.masterData.deactivateFailed'))
      }
    },
  })

  if (!entity) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">{t('admin.masterData.invalidEntity')}</h1>
        <Button asChild variant="outline">
          <Link to="/admin/master-data">{t('admin.masterData.back')}</Link>
        </Button>
      </section>
    )
  }

  const items = listQuery.data?.items ?? []

  return (
    <section className="space-y-6">
      <BackLink to="/admin/master-data" label={t('admin.masterData.back')} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {t(`admin.masterData.entities.${entity}`)}
          </h1>
          <p className="mt-2 text-muted-foreground">{t('admin.masterData.entitySubtitle')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="active-filter">{t('admin.masterData.filterLabel')}</Label>
          <select
            id="active-filter"
            className={selectClassName}
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
          >
            <option value="all">{t('admin.masterData.filterAll')}</option>
            <option value="active">{t('admin.masterData.filterActive')}</option>
            <option value="inactive">{t('admin.masterData.filterInactive')}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingItem ? t('admin.masterData.editTitle') : t('admin.masterData.createTitle')}
            </CardTitle>
            <CardDescription>
              {editingItem
                ? t('admin.masterData.editDescription', { id: editingItem.id })
                : t('admin.masterData.createDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                setSuccessMessage(null)
                setFormError(null)
                saveMutation.mutate(values)
              })}
              noValidate
            >
              {fields.map((field) => {
                if (field.type === 'boolean') {
                  return (
                    <label key={field.name} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" {...form.register(field.name)} />
                      {t(field.labelKey)}
                    </label>
                  )
                }

                return (
                  <div key={field.name} className="space-y-2">
                    <Label htmlFor={field.name}>{t(field.labelKey)}</Label>
                    <Input
                      id={field.name}
                      type={field.type === 'number' ? 'number' : 'text'}
                      {...form.register(field.name, {
                        required: field.required ? t('auth.required') : false,
                      })}
                    />
                    {form.formState.errors[field.name] ? (
                      <p className="text-sm text-destructive" role="alert">
                        {String(form.formState.errors[field.name]?.message ?? '')}
                      </p>
                    ) : null}
                  </div>
                )
              })}

              {formError ? (
                <p className="text-sm text-destructive" role="alert">
                  {formError}
                </p>
              ) : null}
              {successMessage ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
                  {successMessage}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending
                    ? t('common.loading')
                    : editingItem
                      ? t('admin.masterData.updateSubmit')
                      : t('admin.masterData.createSubmit')}
                </Button>
                {editingItem ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingItem(null)
                      form.reset(buildDefaultValues(fields, null))
                    }}
                  >
                    {t('common.cancel')}
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.masterData.listTitle')}</CardTitle>
            <CardDescription>{t('admin.masterData.listDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {listQuery.isLoading ? (
              <p className="text-sm text-muted-foreground" role="status">
                {t('common.loading')}
              </p>
            ) : null}

            {listQuery.isError ? (
              <div className="space-y-3">
                <p className="text-sm text-destructive">{t('admin.masterData.listError')}</p>
                <Button type="button" variant="outline" onClick={() => void listQuery.refetch()}>
                  {t('common.retry')}
                </Button>
              </div>
            ) : null}

            {!listQuery.isLoading && !listQuery.isError && items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('admin.masterData.empty')}</p>
            ) : null}

            <ul className="space-y-3">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3"
                >
                  <div>
                    <p className="font-medium">{getMasterDataDisplayLabel(item)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.id}
                      {typeof item.isActive === 'boolean'
                        ? ` · ${item.isActive ? t('admin.masterData.active') : t('admin.masterData.inactive')}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingItem(item)
                        setFormError(null)
                        setSuccessMessage(null)
                      }}
                    >
                      {t('admin.masterData.edit')}
                    </Button>
                    {item.isActive !== false ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={deactivateMutation.isPending}
                        onClick={() => {
                          setFormError(null)
                          deactivateMutation.mutate(item)
                        }}
                      >
                        {t('admin.masterData.deactivate')}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
