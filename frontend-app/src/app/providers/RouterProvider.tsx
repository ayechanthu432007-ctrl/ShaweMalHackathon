import { Suspense, type ReactNode } from 'react'
import { RouterProvider as ReactRouterProvider } from 'react-router'

import { router } from '@/app/router'
import { LoadingState } from '@/components/common/PageStates'

type RouterProviderProps = {
  children?: ReactNode
}

export function RouterProvider({ children }: RouterProviderProps) {
  if (children) {
    return <>{children}</>
  }
  // Pages load on demand; this covers the very first chunk (layouts have their own boundaries).
  return (
    <Suspense fallback={<LoadingState className="p-6" />}>
      <ReactRouterProvider router={router} />
    </Suspense>
  )
}
