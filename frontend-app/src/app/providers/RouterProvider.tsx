import { Suspense, type ReactNode } from 'react'
import { RouterProvider as ReactRouterProvider } from 'react-router'

import { router } from '@/app/router'
import { PageSkeleton } from '@/components/common/PageStates'

type RouterProviderProps = {
  children?: ReactNode
}

export function RouterProvider({ children }: RouterProviderProps) {
  if (children) {
    return <>{children}</>
  }
  // Pages load on demand; this covers the very first chunk (layouts have their own boundaries).
  return (
    <Suspense fallback={<PageSkeleton className="p-6" />}>
      <ReactRouterProvider router={router} />
    </Suspense>
  )
}
