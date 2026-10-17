import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * Loads a page component (a named export) only when its route is first visited, so each area of the
 * site ships as its own chunk instead of one large bundle. Navigations run in a transition, so the
 * current page stays on screen while the next chunk loads; the layouts' <Suspense> covers first loads.
 *
 * Fully typed: `name` must be an export of the module that is a component, and the result keeps that
 * component's own props, so `<AdminVerificationQueuePage kind="agent" />` is still checked.
 */
// `any` only bounds which exports qualify; the returned type is the export's own (fully typed) component.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<K extends string, M extends Record<K, ComponentType<any>>>(
  load: () => Promise<M>,
  name: K,
): LazyExoticComponent<M[K]> {
  return lazy(async () => ({ default: (await load())[name] }))
}
