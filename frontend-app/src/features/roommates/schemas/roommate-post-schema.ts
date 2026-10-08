import type { RoommateGender, RoommatePost } from '../types'

export const ROOMMATE_INTEREST_FLAGS = [
  'isLgbtqFriendly',
  'isCannabisFriendly',
  'isSmokingFriendly',
  'isNoSmoking',
  'isCatFriendly',
  'isDogFriendly',
  'isAlcoholFriendly',
  'likesNightOut',
  'likesHangoutEveryday',
] as const

export const ROOMMATE_HOBBY_FLAGS = [
  'hobbyPlayingGame',
  'hobbyWatchingMovies',
  'hobbySinging',
  'hobbyPlayingFootball',
  'hobbyRunning',
  'hobbyCooking',
  'hobbyReading',
  'hobbyFoodie',
  'hobbyChillWithOthers',
  'hobbyRelaxSilent',
  'hobbyPlayingGym',
] as const

export type RoommateFlagKey =
  | (typeof ROOMMATE_INTEREST_FLAGS)[number]
  | (typeof ROOMMATE_HOBBY_FLAGS)[number]

export type RoommatePostFormValues = {
  houseId: string
  title: string
  budgetCostSharing: string
  gender: RoommateGender
  occupationId: string
  /** Photo 1 is required, photo 2 is optional. */
  photo1: string
  photo2: string
} & Record<RoommateFlagKey, boolean>

export function defaultRoommatePostFormValues(): RoommatePostFormValues {
  const flags = Object.fromEntries(
    [...ROOMMATE_INTEREST_FLAGS, ...ROOMMATE_HOBBY_FLAGS].map((key) => [key, false]),
  ) as Record<RoommateFlagKey, boolean>

  return {
    houseId: '',
    title: '',
    budgetCostSharing: '',
    gender: 'ANY',
    occupationId: '',
    photo1: '',
    photo2: '',
    ...flags,
  }
}

export function roommatePostToFormValues(post: RoommatePost): RoommatePostFormValues {
  const selected = { ...post.preferences, ...post.hobbies }
  const flags = Object.fromEntries(
    [...ROOMMATE_INTEREST_FLAGS, ...ROOMMATE_HOBBY_FLAGS].map((key) => [key, Boolean(selected[key])]),
  ) as Record<RoommateFlagKey, boolean>

  return {
    houseId: post.house?.id ?? '',
    title: post.title,
    budgetCostSharing: post.budgetCostSharing,
    gender: (['MALE', 'FEMALE', 'ANY'] as const).find((value) => value === post.gender) ?? 'ANY',
    occupationId: post.occupation?.id ?? '',
    photo1: post.photos?.[0] ?? '',
    photo2: post.photos?.[1] ?? '',
    ...flags,
  }
}

export function validateRoommatePostForm(
  values: RoommatePostFormValues,
  t: (key: string) => string,
) {
  const errors: Partial<Record<keyof RoommatePostFormValues, string>> = {}

  if (!values.houseId.trim()) errors.houseId = t('auth.required')
  if (!values.title.trim()) errors.title = t('auth.required')
  if (!values.budgetCostSharing.trim()) errors.budgetCostSharing = t('auth.required')
  if (!values.occupationId.trim()) errors.occupationId = t('auth.required')
  if (!values.gender) errors.gender = t('auth.required')
  if (!values.photo1.trim()) errors.photo1 = t('roommates.photoRequired')

  return errors
}
