import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useAuth } from '@/app/providers/AuthProvider'
import { masterDataApi } from '@/features/master-data/api/master-data-api'

import { marketplaceApi } from '../api/marketplace-api'

export function useMarketplaceCategories() {
  return useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: () => marketplaceApi.categories(),
    staleTime: 10 * 60 * 1000,
    select: (data) => data.items,
  })
}

/** Townships are the existing City master data (Yangon townships are seeded as cities). */
export function useTownships() {
  return useQuery({
    queryKey: ['master-data', 'cities'],
    queryFn: () => masterDataApi.list('cities'),
    staleTime: 10 * 60 * 1000,
    select: (data) => [...data.items].filter((item) => item.isActive !== false).sort((a, b) => a.name.localeCompare(b.name)),
  })
}

export function useSellerStatus() {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: ['marketplace', 'seller-status'],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.sellerStatus(),
  })
}

export function useSavedListings() {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()

  const savedQuery = useQuery({
    queryKey: ['wishlist', 'listings'],
    enabled: isAuthenticated,
    queryFn: () => marketplaceApi.listSaved(),
  })

  const savedIds = useMemo(
    () => new Set((savedQuery.data?.items ?? []).map((item) => item.listingId)),
    [savedQuery.data?.items],
  )

  const invalidate = async (listingId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['wishlist', 'listings'] }),
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'listing', listingId] }),
    ])
  }

  const saveMutation = useMutation({
    mutationFn: (listingId: string) => marketplaceApi.save(listingId),
    onSuccess: (_data, listingId) => invalidate(listingId),
  })

  const unsaveMutation = useMutation({
    mutationFn: (listingId: string) => marketplaceApi.unsave(listingId),
    onSuccess: (_data, listingId) => invalidate(listingId),
  })

  return {
    savedQuery,
    savedIds,
    save: saveMutation.mutateAsync,
    unsave: unsaveMutation.mutateAsync,
    isToggling: saveMutation.isPending || unsaveMutation.isPending,
  }
}
