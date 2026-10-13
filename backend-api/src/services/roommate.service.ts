import { Prisma, RoommateGender } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { PREFERENCE_INCLUDE, loadViewerFacts, matchRoommatePost } from './recommendation.service';

interface ListRoommatePostsInput {
  gender?: RoommateGender;
  occupationId?: string;
  city?: string;
  state?: string;
  cityId?: string;
  stateId?: string;
}

interface CreateRoommatePostInput {
  userId: string;
  houseId: string;
  title: string;
  budgetCostSharing: string;
  gender: RoommateGender;
  occupationId: string;
  isLgbtqFriendly?: boolean;
  isCannabisFriendly?: boolean;
  isSmokingFriendly?: boolean;
  isNoSmoking?: boolean;
  isCatFriendly?: boolean;
  isDogFriendly?: boolean;
  isAlcoholFriendly?: boolean;
  likesNightOut?: boolean;
  likesHangoutEveryday?: boolean;
  hobbyPlayingGame?: boolean;
  hobbyWatchingMovies?: boolean;
  hobbySinging?: boolean;
  hobbyPlayingFootball?: boolean;
  hobbyRunning?: boolean;
  hobbyCooking?: boolean;
  hobbyReading?: boolean;
  hobbyFoodie?: boolean;
  hobbyChillWithOthers?: boolean;
  hobbyRelaxSilent?: boolean;
  hobbyPlayingGym?: boolean;
  photos: string[];
}

interface UpdateRoommatePostInput extends CreateRoommatePostInput {
  id: string;
}

const ROOMMATE_INCLUDE = {
  user: {
    select: {
      id: true,
      name: true,
      phone: true,
      profilePicturePath: true,
      // Only ever used to calculate a match; it is never sent to the browser.
      housingPreference: { include: PREFERENCE_INCLUDE }
    }
  },
  occupation: {
    select: {
      id: true,
      name: true
    }
  },
  house: {
    select: {
      id: true,
      title: true,
      cityId: true,
      stateId: true,
      city: {
        select: {
          id: true,
          name: true
        }
      },
      state: {
        select: {
          id: true,
          name: true
        }
      }
    }
  }
} as const;

const mapRoommatePost = (item: Prisma.RoommatePostGetPayload<{ include: typeof ROOMMATE_INCLUDE }>) => ({
  id: item.id,
  title: item.title,
  budgetCostSharing: item.budgetCostSharing,
  gender: item.gender,
  occupation: item.occupation,
  preferences: {
    isLgbtqFriendly: item.isLgbtqFriendly,
    isCannabisFriendly: item.isCannabisFriendly,
    isSmokingFriendly: item.isSmokingFriendly,
    isNoSmoking: item.isNoSmoking,
    isCatFriendly: item.isCatFriendly,
    isDogFriendly: item.isDogFriendly,
    isAlcoholFriendly: item.isAlcoholFriendly,
    likesNightOut: item.likesNightOut,
    likesHangoutEveryday: item.likesHangoutEveryday
  },
  hobbies: {
    hobbyPlayingGame: item.hobbyPlayingGame,
    hobbyWatchingMovies: item.hobbyWatchingMovies,
    hobbySinging: item.hobbySinging,
    hobbyPlayingFootball: item.hobbyPlayingFootball,
    hobbyRunning: item.hobbyRunning,
    hobbyCooking: item.hobbyCooking,
    hobbyReading: item.hobbyReading,
    hobbyFoodie: item.hobbyFoodie,
    hobbyChillWithOthers: item.hobbyChillWithOthers,
    hobbyRelaxSilent: item.hobbyRelaxSilent,
    hobbyPlayingGym: item.hobbyPlayingGym
  },
  // Posts created before photos were introduced have no photo list.
  photos: item.photoPaths ?? [],
  user: { id: item.user.id, name: item.user.name, phone: item.user.phone, profilePicturePath: item.user.profilePicturePath },
  house: { id: item.house.id, title: item.house.title, city: item.house.city, state: item.house.state },
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const buildWhere = (input: ListRoommatePostsInput): Prisma.RoommatePostWhereInput => {
  const where: Prisma.RoommatePostWhereInput = {};

  if (input.gender) {
    where.gender = input.gender;
  }

  if (input.occupationId) {
    where.occupationId = input.occupationId;
  }

  const houseWhere: Prisma.HouseWhereInput = {};

  if (input.cityId) {
    houseWhere.cityId = input.cityId;
  }

  if (input.stateId) {
    houseWhere.stateId = input.stateId;
  }

  if (input.city) {
    houseWhere.city = {
      name: {
        contains: input.city
      }
    };
  }

  if (input.state) {
    houseWhere.state = {
      name: {
        contains: input.state
      }
    };
  }

  if (Object.keys(houseWhere).length > 0) {
    where.house = houseWhere;
  }

  return where;
};

/**
 * Every roommate post that passes the filters, once each. For a signed-in viewer each post
 * carries their personal compatibility and the list is ordered best match first; posts that
 * cannot be scored (and the viewer's own posts) follow, newest first. Nothing is hidden.
 */
export const listRoommatePosts = async (input: ListRoommatePostsInput, viewerId?: string) => {
  const [items, viewer] = await Promise.all([
    prisma.roommatePost.findMany({
      where: buildWhere(input),
      include: ROOMMATE_INCLUDE,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    viewerId ? loadViewerFacts(viewerId) : Promise.resolve(null)
  ]);

  const posts = items.map((item) => ({
    ...mapRoommatePost(item),
    match: viewer && item.userId !== viewerId ? matchRoommatePost(item, viewer.person) : null
  }));

  if (viewer) {
    // A post without a usable score has nothing to rank by, so it keeps its place after the scored ones.
    const rank = (post: (typeof posts)[number]) => (post.match && post.match.confidence !== 'INCOMPLETE' ? post.match.score : -1);
    posts.sort((a, b) => rank(b) - rank(a) || b.createdAt.getTime() - a.createdAt.getTime());
  }

  return {
    items: posts,
    viewer: { signedIn: Boolean(viewer), hasPreferences: viewer?.hasPreferences ?? false }
  };
};

const assertHouseAndOccupation = async (input: Pick<CreateRoommatePostInput, 'houseId' | 'occupationId'>) => {
  const [house, occupation] = await Promise.all([
    prisma.house.findUnique({
      where: {
        id: input.houseId
      },
      select: {
        id: true
      }
    }),
    prisma.occupation.findUnique({
      where: {
        id: input.occupationId
      },
      select: {
        id: true,
        isActive: true
      }
    })
  ]);

  if (!house) {
    throw new ApiError(404, 'HOUSE_NOT_FOUND', 'House not found.');
  }

  if (!occupation || !occupation.isActive) {
    throw new ApiError(400, 'OCCUPATION_NOT_AVAILABLE', 'Occupation is invalid or inactive.');
  }
};

const toPostData = (input: CreateRoommatePostInput) => ({
  houseId: input.houseId,
  title: input.title,
  budgetCostSharing: input.budgetCostSharing,
  gender: input.gender,
  occupationId: input.occupationId,
  isLgbtqFriendly: Boolean(input.isLgbtqFriendly),
  isCannabisFriendly: Boolean(input.isCannabisFriendly),
  isSmokingFriendly: Boolean(input.isSmokingFriendly),
  isNoSmoking: Boolean(input.isNoSmoking),
  isCatFriendly: Boolean(input.isCatFriendly),
  isDogFriendly: Boolean(input.isDogFriendly),
  isAlcoholFriendly: Boolean(input.isAlcoholFriendly),
  likesNightOut: Boolean(input.likesNightOut),
  likesHangoutEveryday: Boolean(input.likesHangoutEveryday),
  hobbyPlayingGame: Boolean(input.hobbyPlayingGame),
  hobbyWatchingMovies: Boolean(input.hobbyWatchingMovies),
  hobbySinging: Boolean(input.hobbySinging),
  hobbyPlayingFootball: Boolean(input.hobbyPlayingFootball),
  hobbyRunning: Boolean(input.hobbyRunning),
  hobbyCooking: Boolean(input.hobbyCooking),
  hobbyReading: Boolean(input.hobbyReading),
  hobbyFoodie: Boolean(input.hobbyFoodie),
  hobbyChillWithOthers: Boolean(input.hobbyChillWithOthers),
  hobbyRelaxSilent: Boolean(input.hobbyRelaxSilent),
  hobbyPlayingGym: Boolean(input.hobbyPlayingGym),
  photoPaths: input.photos
});

export const createRoommatePost = async (input: CreateRoommatePostInput) => {
  await assertHouseAndOccupation(input);

  const created = await prisma.roommatePost.create({
    data: {
      userId: input.userId,
      ...toPostData(input)
    },
    include: ROOMMATE_INCLUDE
  });

  return mapRoommatePost(created);
};

/** Only the user who created a roommate post may change or remove it. */
const findOwnedRoommatePost = async (userId: string, postId: string) => {
  const post = await prisma.roommatePost.findUnique({
    where: { id: postId },
    select: { id: true, userId: true }
  });

  if (!post) {
    throw new ApiError(404, 'ROOMMATE_POST_NOT_FOUND', 'Roommate post not found.');
  }

  if (post.userId !== userId) {
    throw new ApiError(403, 'ROOMMATE_POST_FORBIDDEN', 'You can only manage your own roommate posts.');
  }

  return post;
};

export const updateRoommatePost = async (input: UpdateRoommatePostInput) => {
  await findOwnedRoommatePost(input.userId, input.id);
  await assertHouseAndOccupation(input);

  const updated = await prisma.roommatePost.update({
    where: { id: input.id },
    data: toPostData(input),
    include: ROOMMATE_INCLUDE
  });

  return mapRoommatePost(updated);
};

export const deleteRoommatePost = async (userId: string, postId: string) => {
  await findOwnedRoommatePost(userId, postId);
  await prisma.roommatePost.delete({ where: { id: postId } });
};
