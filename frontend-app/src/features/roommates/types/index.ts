import type { MatchSummary } from '@/features/recommendations/api/recommendations-api'

export type RoommateGender = 'MALE' | 'FEMALE' | 'ANY'

export type RoommateListFilters = {
  gender?: RoommateGender | ''
  occupationId?: string
  city?: string
  state?: string
  cityId?: string
  stateId?: string
}

export type RoommatePost = {
  id: string
  title: string
  budgetCostSharing: string
  gender: RoommateGender | string
  occupation?: { id: string; name: string } | null
  preferences?: Record<string, boolean>
  hobbies?: Record<string, boolean>
  photos?: string[]
  user?: { id: string; name: string; phone?: string | null; profilePicturePath?: string | null } | null
  house?: {
    id: string
    title: string
    city?: { id: string; name: string } | null
    state?: { id: string; name: string } | null
  } | null
  createdAt?: string
  /** The signed-in viewer's compatibility with this post; null for guests and for one's own post. */
  match?: MatchSummary | null
}

export type RoommateListResult = {
  items: RoommatePost[]
  viewer?: { signedIn: boolean; hasPreferences: boolean }
}

export type RoommateCreateInput = {
  houseId: string
  title: string
  budgetCostSharing: string
  gender: RoommateGender
  occupationId: string
  isLgbtqFriendly?: boolean
  isCannabisFriendly?: boolean
  isSmokingFriendly?: boolean
  isNoSmoking?: boolean
  isCatFriendly?: boolean
  isDogFriendly?: boolean
  isAlcoholFriendly?: boolean
  likesNightOut?: boolean
  likesHangoutEveryday?: boolean
  hobbyPlayingGame?: boolean
  hobbyWatchingMovies?: boolean
  hobbySinging?: boolean
  hobbyPlayingFootball?: boolean
  hobbyRunning?: boolean
  hobbyCooking?: boolean
  hobbyReading?: boolean
  hobbyFoodie?: boolean
  hobbyChillWithOthers?: boolean
  hobbyRelaxSilent?: boolean
  hobbyPlayingGym?: boolean
  photos: string[]
}
