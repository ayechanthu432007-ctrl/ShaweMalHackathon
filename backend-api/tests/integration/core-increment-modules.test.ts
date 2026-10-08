import request from 'supertest';

import { app } from '../../src/app';
import { signJwt } from '../../src/utils/jwt';

interface MockRole {
  id: string;
  name: string;
}

interface MockUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  profilePicturePath: string | null;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  userRoles: Array<{ role: MockRole }>;
}

interface MockHouse {
  id: string;
  title: string;
  cityId: string;
  stateId: string;
  propertyTypeId: string;
  availability: 'AVAILABLE' | 'NOT_AVAILABLE';
  agentId?: string;
}

interface MockRoommatePost {
  id: string;
  userId: string;
  houseId: string;
  title: string;
  budgetCostSharing: string;
  gender: 'MALE' | 'FEMALE' | 'ANY';
  occupationId: string;
  isLgbtqFriendly: boolean;
  isCannabisFriendly: boolean;
  isSmokingFriendly: boolean;
  isNoSmoking: boolean;
  isCatFriendly: boolean;
  isDogFriendly: boolean;
  isAlcoholFriendly: boolean;
  likesNightOut: boolean;
  likesHangoutEveryday: boolean;
  hobbyPlayingGame: boolean;
  hobbyWatchingMovies: boolean;
  hobbySinging: boolean;
  hobbyPlayingFootball: boolean;
  hobbyRunning: boolean;
  hobbyCooking: boolean;
  hobbyReading: boolean;
  hobbyFoodie: boolean;
  hobbyChillWithOthers: boolean;
  hobbyRelaxSilent: boolean;
  hobbyPlayingGym: boolean;
  photoPaths?: string[];
  createdAt: Date;
  updatedAt: Date;
}

interface MockReview {
  id: string;
  reviewerUserId: string;
  targetType: 'AGENT' | 'DRIVER';
  targetUserId: string;
  rating: number;
  comment: string | null;
  bookingId?: string | null;
  movingRequestId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}

interface MockBooking {
  id: string;
  userId: string;
  houseId: string;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
  createdAt: Date;
}

interface MockMovingRequest {
  id: string;
  orderNumber?: string;
  requesterUserId: string;
  assignedDriverUserId: string | null;
  vehicleTypeId: string;
  status: 'BOOKED' | 'ACCEPTED' | 'ASSIGNED' | 'DRIVER_COMING' | 'COMPLETED' | 'CANCELLED';
  pickupAddress: string;
  dropoffAddress: string;
  moveInDate: Date;
  remarks: string | null;
  damageChecklist: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const roles = new Map<string, MockRole>([
  ['normal', { id: 'role-normal', name: 'normal' }],
  ['agent', { id: 'role-agent', name: 'agent' }],
  ['driver', { id: 'role-driver', name: 'driver' }],
  ['admin', { id: 'role-admin', name: 'admin' }]
]);

const users = new Map<string, MockUser>();
const houses = new Map<string, MockHouse>();
const cities = new Map<string, { id: string; name: string }>();
const states = new Map<string, { id: string; name: string }>();
const propertyTypes = new Map<string, { id: string; name: string }>();
const occupations = new Map<string, { id: string; name: string; isActive: boolean }>();
const roommatePosts: MockRoommatePost[] = [];
const reviews: MockReview[] = [];
const notifications: MockNotification[] = [];
const bookings: MockBooking[] = [];
const movingRequests: MockMovingRequest[] = [];

const authHeader = (userId: string, rolesList: string[]) => {
  const token = signJwt({ sub: userId, email: `${userId}@example.com`, roles: rolesList }, '1h');
  return `Bearer ${token}`;
};

const cloneUser = (user: MockUser) => ({
  ...user,
  userRoles: user.userRoles.map((entry) => ({ role: { ...entry.role } })),
  agentProfile: user.userRoles.some((entry) => entry.role.name === 'agent')
    ? { verificationStatus: user.verificationStatus }
    : null,
  driverProfile: user.userRoles.some((entry) => entry.role.name === 'driver')
    ? { verificationStatus: user.verificationStatus }
    : null
});

const hydrateRoommatePost = (item: MockRoommatePost) => {
  const user = users.get(item.userId);
  const house = houses.get(item.houseId);

  return {
    ...item,
    user: {
      id: user?.id ?? 'unknown-user',
      name: user?.name ?? 'Unknown',
      phone: user?.phone ?? null,
      profilePicturePath: user?.profilePicturePath ?? null
    },
    occupation: occupations.get(item.occupationId)
      ? {
          id: item.occupationId,
          name: occupations.get(item.occupationId)?.name ?? 'Unknown'
        }
      : { id: item.occupationId, name: 'Unknown' },
    house: {
      id: house?.id ?? 'unknown-house',
      title: house?.title ?? 'Unknown',
      city: {
        id: house?.cityId ?? 'unknown-city',
        name: cities.get(house?.cityId ?? '')?.name ?? 'Unknown'
      },
      state: {
        id: house?.stateId ?? 'unknown-state',
        name: states.get(house?.stateId ?? '')?.name ?? 'Unknown'
      }
    }
  };
};

const hydrateReview = (item: MockReview) => {
  const reviewer = users.get(item.reviewerUserId);

  return {
    ...item,
    reviewer: {
      id: reviewer?.id ?? 'unknown-user',
      name: reviewer?.name ?? 'Unknown',
      profilePicturePath: reviewer?.profilePicturePath ?? null
    }
  };
};

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where, include }: { where: { id: string }; include?: any }) => {
        const user = users.get(where.id);
        if (!user) {
          return null;
        }

        if (include?.userRoles) {
          return cloneUser(user);
        }

        return { ...user };
      }),
      update: jest.fn(async ({ where, data, include }: { where: { id: string }; data: any; include?: any }) => {
        const found = users.get(where.id);
        if (!found) {
          throw new Error('User not found');
        }

        if (data.phone && Array.from(users.values()).some((item) => item.id !== where.id && item.phone === data.phone)) {
          const duplicate = new Error('Duplicate') as Error & { code?: string };
          duplicate.code = 'P2002';
          throw duplicate;
        }

        const updated: MockUser = {
          ...found,
          name: data.name ?? found.name,
          phone: data.phone ?? found.phone,
          profilePicturePath: data.profilePicturePath === undefined ? found.profilePicturePath : data.profilePicturePath
        };

        users.set(where.id, updated);

        if (include?.userRoles) {
          return cloneUser(updated);
        }

        return { ...updated };
      }),
      findMany: jest.fn(async ({ where, select }: { where?: any; select?: any }) => {
        let items = Array.from(users.values());

        if (where?.id?.in) {
          const set = new Set<string>(where.id.in);
          items = items.filter((item) => set.has(item.id));
        }

        if (select?.id && select?.name) {
          return items.map((item) => ({ id: item.id, name: item.name }));
        }

        return items.map((item) => cloneUser(item));
      }),
      groupBy: jest.fn(async () => [])
    },
    agentProfile: {
      groupBy: jest.fn(async () => {
        const items = Array.from(users.values()).filter((item) =>
          item.userRoles.some((entry) => entry.role.name === 'agent')
        );
        const grouped = new Map<string, number>();
        for (const item of items) {
          grouped.set(item.verificationStatus, (grouped.get(item.verificationStatus) ?? 0) + 1);
        }
        return Array.from(grouped.entries()).map(([verificationStatus, count]) => ({
          verificationStatus,
          _count: { _all: count }
        }));
      })
    },
    driverProfile: {
      groupBy: jest.fn(async () => {
        const items = Array.from(users.values()).filter((item) =>
          item.userRoles.some((entry) => entry.role.name === 'driver')
        );
        const grouped = new Map<string, number>();
        for (const item of items) {
          grouped.set(item.verificationStatus, (grouped.get(item.verificationStatus) ?? 0) + 1);
        }
        return Array.from(grouped.entries()).map(([verificationStatus, count]) => ({
          verificationStatus,
          _count: { _all: count }
        }));
      })
    },
    house: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = houses.get(where.id);
        if (!found) {
          return null;
        }

        return { id: found.id };
      }),
      groupBy: jest.fn(async ({ by }: { by: string[] }) => {
        if (by.includes('cityId')) {
          const grouped = new Map<string, number>();
          Array.from(houses.values()).forEach((house) => {
            grouped.set(house.cityId, (grouped.get(house.cityId) ?? 0) + 1);
          });

          return Array.from(grouped.entries()).map(([cityId, count]) => ({ cityId, _count: { _all: count } }));
        }

        if (by.includes('propertyTypeId')) {
          const grouped = new Map<string, number>();
          Array.from(houses.values()).forEach((house) => {
            grouped.set(house.propertyTypeId, (grouped.get(house.propertyTypeId) ?? 0) + 1);
          });

          return Array.from(grouped.entries()).map(([propertyTypeId, count]) => ({ propertyTypeId, _count: { _all: count } }));
        }

        const grouped = new Map<string, number>();
        Array.from(houses.values()).forEach((house) => {
          grouped.set(house.availability, (grouped.get(house.availability) ?? 0) + 1);
        });

        return Array.from(grouped.entries()).map(([availability, count]) => ({ availability, _count: { _all: count } }));
      })
    },
    city: {
      findMany: jest.fn(async () => Array.from(cities.values()))
    },
    propertyType: {
      findMany: jest.fn(async () => Array.from(propertyTypes.values()))
    },
    occupation: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return occupations.get(where.id) ?? null;
      })
    },
    roommatePost: {
      findMany: jest.fn(async ({ where }: { where: any }) => {
        return roommatePosts
          .filter((item) => {
            if (where.gender && item.gender !== where.gender) {
              return false;
            }

            if (where.occupationId && item.occupationId !== where.occupationId) {
              return false;
            }

            const house = houses.get(item.houseId);
            if (!house) {
              return false;
            }

            if (where.house?.cityId && house.cityId !== where.house.cityId) {
              return false;
            }

            if (where.house?.stateId && house.stateId !== where.house.stateId) {
              return false;
            }

            if (where.house?.city?.name?.contains) {
              const expected = String(where.house.city.name.contains).toLowerCase();
              const cityName = cities.get(house.cityId)?.name.toLowerCase() ?? '';
              if (!cityName.includes(expected)) {
                return false;
              }
            }

            if (where.house?.state?.name?.contains) {
              const expected = String(where.house.state.name.contains).toLowerCase();
              const stateName = states.get(house.stateId)?.name.toLowerCase() ?? '';
              if (!stateName.includes(expected)) {
                return false;
              }
            }

            return true;
          })
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((item) => hydrateRoommatePost(item));
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        const now = new Date();
        const created: MockRoommatePost = {
          id: `roommate-${roommatePosts.length + 1}`,
          userId: data.userId,
          houseId: data.houseId,
          title: data.title,
          budgetCostSharing: data.budgetCostSharing,
          gender: data.gender,
          occupationId: data.occupationId,
          isLgbtqFriendly: data.isLgbtqFriendly,
          isCannabisFriendly: data.isCannabisFriendly,
          isSmokingFriendly: data.isSmokingFriendly,
          isNoSmoking: data.isNoSmoking,
          isCatFriendly: data.isCatFriendly,
          isDogFriendly: data.isDogFriendly,
          isAlcoholFriendly: data.isAlcoholFriendly,
          likesNightOut: data.likesNightOut,
          likesHangoutEveryday: data.likesHangoutEveryday,
          hobbyPlayingGame: data.hobbyPlayingGame,
          hobbyWatchingMovies: data.hobbyWatchingMovies,
          hobbySinging: data.hobbySinging,
          hobbyPlayingFootball: data.hobbyPlayingFootball,
          hobbyRunning: data.hobbyRunning,
          hobbyCooking: data.hobbyCooking,
          hobbyReading: data.hobbyReading,
          hobbyFoodie: data.hobbyFoodie,
          hobbyChillWithOthers: data.hobbyChillWithOthers,
          hobbyRelaxSilent: data.hobbyRelaxSilent,
          hobbyPlayingGym: data.hobbyPlayingGym,
          photoPaths: data.photoPaths,
          createdAt: now,
          updatedAt: now
        };

        roommatePosts.push(created);
        return hydrateRoommatePost(created);
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return roommatePosts.find((item) => item.id === where.id) ?? null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const existing = roommatePosts.find((item) => item.id === where.id) as MockRoommatePost;
        Object.assign(existing, data, { updatedAt: new Date() });
        return hydrateRoommatePost(existing);
      }),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const index = roommatePosts.findIndex((item) => item.id === where.id);
        const [removed] = roommatePosts.splice(index, 1);
        return removed;
      })
    },
    ratingReview: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const now = new Date();
        const created: MockReview = {
          id: `review-${reviews.length + 1}`,
          reviewerUserId: data.reviewerUserId,
          targetType: data.targetType,
          targetUserId: data.targetUserId,
          rating: data.rating,
          comment: data.comment ?? null,
          bookingId: data.bookingId ?? null,
          movingRequestId: data.movingRequestId ?? null,
          createdAt: now,
          updatedAt: now
        };

        reviews.push(created);
        return hydrateReview(created);
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: string; bookingId?: string; movingRequestId?: string } }) => {
        const found = reviews.find((item) => {
          if (where.id) {
            return item.id === where.id;
          }

          if (where.bookingId) {
            return item.bookingId === where.bookingId;
          }

          if (where.movingRequestId) {
            return item.movingRequestId === where.movingRequestId;
          }

          return false;
        });

        return found ? hydrateReview(found) : null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: any }) => {
        const found = reviews.find((item) => item.id === where.id);
        if (!found) {
          throw new Error('Review not found');
        }

        found.rating = data.rating ?? found.rating;
        found.comment = data.comment === undefined ? found.comment : data.comment;
        found.updatedAt = new Date();
        return hydrateReview(found);
      }),
      findMany: jest.fn(async ({ where }: { where: { targetType: 'AGENT' | 'DRIVER'; targetUserId: string } }) => {
        return reviews
          .filter((item) => item.targetType === where.targetType && item.targetUserId === where.targetUserId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((item) => hydrateReview(item));
      }),
      aggregate: jest.fn(async ({ where }: { where: { targetType: 'AGENT' | 'DRIVER'; targetUserId: string } }) => {
        const filtered = reviews.filter((item) => item.targetType === where.targetType && item.targetUserId === where.targetUserId);
        const sum = filtered.reduce((acc, item) => acc + item.rating, 0);

        return {
          _avg: {
            rating: filtered.length > 0 ? sum / filtered.length : null
          },
          _count: {
            _all: filtered.length
          }
        };
      }),
      groupBy: jest.fn(async ({ where, take }: { where: { targetType: 'AGENT' | 'DRIVER' }; take: number }) => {
        const grouped = new Map<string, { sum: number; count: number }>();

        reviews
          .filter((item) => item.targetType === where.targetType)
          .forEach((item) => {
            const current = grouped.get(item.targetUserId) ?? { sum: 0, count: 0 };
            grouped.set(item.targetUserId, { sum: current.sum + item.rating, count: current.count + 1 });
          });

        return Array.from(grouped.entries())
          .map(([targetUserId, aggregate]) => ({
            targetUserId,
            _avg: { rating: aggregate.count > 0 ? aggregate.sum / aggregate.count : null },
            _count: { rating: aggregate.count }
          }))
          .sort((a, b) => {
            const avgDiff = (b._avg.rating ?? 0) - (a._avg.rating ?? 0);
            if (avgDiff !== 0) {
              return avgDiff;
            }

            return b._count.rating - a._count.rating;
          })
          .slice(0, take);
      })
    },
    notification: {
      findMany: jest.fn(async ({ where, orderBy, take }: { where: any; orderBy?: any; take?: number }) => {
        let items = notifications.filter((item) => item.userId === where.userId);

        if (orderBy?.createdAt === 'desc') {
          items = items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        if (typeof take === 'number') {
          items = items.slice(0, take);
        }

        return items;
      }),
      count: jest.fn(async ({ where }: { where: any }) => {
        return notifications.filter((item) => {
          if (item.userId !== where.userId) {
            return false;
          }

          if (where.isRead !== undefined && item.isRead !== where.isRead) {
            return false;
          }

          return true;
        }).length;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: any; data: { isRead: boolean } }) => {
        let count = 0;

        notifications.forEach((item) => {
          if (item.id === where.id && item.userId === where.userId) {
            item.isRead = data.isRead;
            count += 1;
          }
        });

        return { count };
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return notifications.find((item) => item.id === where.id) ?? null;
      })
    },
    booking: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = bookings.find((item) => item.id === where.id);
        if (!found) {
          return null;
        }

        const house = houses.get(found.houseId);
        return {
          ...found,
          house: {
            id: house?.id ?? 'unknown-house',
            title: house?.title ?? 'Unknown',
            agentId: house?.agentId ?? 'user-agent',
            availability: house?.availability ?? 'AVAILABLE',
            city: {
              id: house?.cityId ?? 'unknown-city',
              name: cities.get(house?.cityId ?? '')?.name ?? 'Unknown'
            },
            state: {
              id: house?.stateId ?? 'unknown-state',
              name: states.get(house?.stateId ?? '')?.name ?? 'Unknown'
            },
            agent: {
              id: house?.agentId ?? 'user-agent',
              name: users.get(house?.agentId ?? 'user-agent')?.name ?? 'Agent User'
            }
          },
          ratingReview: reviews.find((item) => item.bookingId === found.id) ?? null
        };
      }),
      findMany: jest.fn(async ({ where }: { where: { userId: string } }) => {
        return bookings
          .filter((item) => item.userId === where.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((item) => {
            const house = houses.get(item.houseId);
            return {
              ...item,
              house: {
                id: house?.id ?? 'unknown-house',
                title: house?.title ?? 'Unknown',
                availability: house?.availability ?? 'AVAILABLE',
                agentId: house?.agentId ?? 'user-agent',
                city: {
                  id: house?.cityId ?? 'unknown-city',
                  name: cities.get(house?.cityId ?? '')?.name ?? 'Unknown'
                },
                state: {
                  id: house?.stateId ?? 'unknown-state',
                  name: states.get(house?.stateId ?? '')?.name ?? 'Unknown'
                },
                agent: {
                  id: house?.agentId ?? 'user-agent',
                  name: users.get(house?.agentId ?? 'user-agent')?.name ?? 'Agent User'
                }
              },
              ratingReview: reviews.find((review) => review.bookingId === item.id) ?? null
            };
          });
      }),
      groupBy: jest.fn(async () => {
        const grouped = new Map<string, number>();
        bookings.forEach((item) => {
          grouped.set(item.status, (grouped.get(item.status) ?? 0) + 1);
        });

        return Array.from(grouped.entries()).map(([status, count]) => ({ status, _count: { _all: count } }));
      })
    },
    movingRequest: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const found = movingRequests.find((item) => item.id === where.id);
        if (!found) {
          return null;
        }

        return {
          ...found,
          ratingReview: reviews.find((item) => item.movingRequestId === found.id) ?? null
        };
      }),
      findMany: jest.fn(async ({ where }: { where: { requesterUserId: string } }) => {
        return movingRequests
          .filter((item) => item.requesterUserId === where.requesterUserId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((item) => ({
            ...item,
            vehicleType: {
              id: item.vehicleTypeId,
              name: item.vehicleTypeId === 'vt-1' ? 'Truck' : 'Van'
            },
            assignedDriver: item.assignedDriverUserId
              ? {
                  id: item.assignedDriverUserId,
                  name: users.get(item.assignedDriverUserId)?.name ?? 'Unknown Driver',
                  phone: users.get(item.assignedDriverUserId)?.phone ?? '0000000'
                }
              : null,
            ratingReview: reviews.find((review) => review.movingRequestId === item.id) ?? null
          }));
      }),
      groupBy: jest.fn(async () => {
        const grouped = new Map<string, number>();
        movingRequests.forEach((item) => {
          grouped.set(item.status, (grouped.get(item.status) ?? 0) + 1);
        });

        return Array.from(grouped.entries()).map(([status, count]) => ({ status, _count: { _all: count } }));
      })
    },
    role: {
      findMany: jest.fn(async () => {
        return Array.from(roles.values()).map((role) => ({
          name: role.name,
          userRoles: Array.from(users.values())
            .filter((user) => user.userRoles.some((entry) => entry.role.name === role.name))
            .map((_, index) => ({ id: `user-role-${role.name}-${index}` }))
        }));
      })
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma))
  };

  return { prisma };
});

describe('Core increment modules', () => {
  beforeEach(() => {
    users.clear();
    houses.clear();
    cities.clear();
    states.clear();
    propertyTypes.clear();
    occupations.clear();
    roommatePosts.length = 0;
    reviews.length = 0;
    notifications.length = 0;
    bookings.length = 0;
    movingRequests.length = 0;

    const normalRole = roles.get('normal') as MockRole;
    const agentRole = roles.get('agent') as MockRole;
    const driverRole = roles.get('driver') as MockRole;
    const adminRole = roles.get('admin') as MockRole;

    users.set('user-normal', {
      id: 'user-normal',
      name: 'Normal User',
      email: 'normal@example.com',
      phone: '091111111',
      profilePicturePath: null,
      verificationStatus: 'VERIFIED',
      userRoles: [{ role: normalRole }]
    });

    users.set('user-agent', {
      id: 'user-agent',
      name: 'Agent User',
      email: 'agent@example.com',
      phone: '092222222',
      profilePicturePath: null,
      verificationStatus: 'VERIFIED',
      userRoles: [{ role: normalRole }, { role: agentRole }]
    });

    users.set('user-driver', {
      id: 'user-driver',
      name: 'Driver User',
      email: 'driver@example.com',
      phone: '093333333',
      profilePicturePath: null,
      verificationStatus: 'PENDING',
      userRoles: [{ role: normalRole }, { role: driverRole }]
    });

    users.set('user-admin', {
      id: 'user-admin',
      name: 'Admin User',
      email: 'admin@example.com',
      phone: '094444444',
      profilePicturePath: null,
      verificationStatus: 'VERIFIED',
      userRoles: [{ role: adminRole }]
    });

    cities.set('city-1', { id: 'city-1', name: 'Yangon' });
    states.set('state-1', { id: 'state-1', name: 'Yangon Region' });
    propertyTypes.set('ptype-1', { id: 'ptype-1', name: 'Apartment' });
    occupations.set('occ-1', { id: 'occ-1', name: 'Engineer', isActive: true });

    houses.set('house-1', {
      id: 'house-1',
      title: 'Downtown Apartment',
      cityId: 'city-1',
      stateId: 'state-1',
      propertyTypeId: 'ptype-1',
      availability: 'AVAILABLE',
      agentId: 'user-agent'
    });

    roommatePosts.push({
      id: 'roommate-1',
      userId: 'user-normal',
      houseId: 'house-1',
      title: 'Looking for quiet roommate',
      budgetCostSharing: '50/50 monthly fees',
      gender: 'ANY',
      occupationId: 'occ-1',
      isLgbtqFriendly: true,
      isCannabisFriendly: false,
      isSmokingFriendly: false,
      isNoSmoking: true,
      isCatFriendly: false,
      isDogFriendly: false,
      isAlcoholFriendly: true,
      likesNightOut: false,
      likesHangoutEveryday: false,
      hobbyPlayingGame: true,
      hobbyWatchingMovies: true,
      hobbySinging: false,
      hobbyPlayingFootball: false,
      hobbyRunning: true,
      hobbyCooking: true,
      hobbyReading: true,
      hobbyFoodie: true,
      hobbyChillWithOthers: false,
      hobbyRelaxSilent: true,
      hobbyPlayingGym: false,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z')
    });

    reviews.push({
      id: 'review-1',
      reviewerUserId: 'user-normal',
      targetType: 'AGENT',
      targetUserId: 'user-agent',
      rating: 5,
      comment: 'Very helpful',
      createdAt: new Date('2026-08-11T00:00:00.000Z'),
      updatedAt: new Date('2026-08-11T00:00:00.000Z')
    });

    notifications.push(
      {
        id: 'notification-1',
        userId: 'user-normal',
        title: 'Booking Confirmation',
        message: 'Booked',
        isRead: false,
        createdAt: new Date('2026-08-11T02:00:00.000Z')
      },
      {
        id: 'notification-2',
        userId: 'user-normal',
        title: 'Status Updated',
        message: 'Updated',
        isRead: true,
        createdAt: new Date('2026-08-10T02:00:00.000Z')
      },
      {
        id: 'notification-3',
        userId: 'user-agent',
        title: 'Other User Noti',
        message: 'Other',
        isRead: false,
        createdAt: new Date('2026-08-09T02:00:00.000Z')
      }
    );

    bookings.push({
      id: 'booking-1',
      userId: 'user-normal',
      houseId: 'house-1',
      status: 'CONFIRMED',
      createdAt: new Date('2026-08-11T05:00:00.000Z')
    });

    movingRequests.push({
      id: 'moving-1',
      orderNumber: 'MOV-20260811-000001',
      requesterUserId: 'user-normal',
      assignedDriverUserId: 'user-driver',
      vehicleTypeId: 'vt-1',
      status: 'COMPLETED',
      pickupAddress: 'A Street',
      dropoffAddress: 'B Street',
      moveInDate: new Date('2026-08-12T00:00:00.000Z'),
      remarks: null,
      damageChecklist: null,
      acceptedAt: new Date('2026-08-11T08:00:00.000Z'),
      createdAt: new Date('2026-08-11T07:00:00.000Z'),
      updatedAt: new Date('2026-08-11T09:00:00.000Z')
    });
  });

  it('supports roommate browse and post with validation/auth checks', async () => {
    const listResponse = await request(app).get('/api/v1/roommates').query({ city: 'Yangon' });
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(1);
    expect(listResponse.body.data.items[0].user.phone).toBe('091111111');

    const invalidResponse = await request(app).get('/api/v1/roommates').query({ gender: 'INVALID' });
    expect(invalidResponse.status).toBe(400);

    const unauthorized = await request(app).post('/api/v1/roommates').send({
      houseId: 'house-1',
      title: 'Need roommate',
      budgetCostSharing: 'Split bills',
      gender: 'ANY',
      occupationId: 'occ-1'
    });
    expect(unauthorized.status).toBe(401);

    const createResponse = await request(app)
      .post('/api/v1/roommates')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        houseId: 'house-1',
        title: 'Need roommate',
        budgetCostSharing: 'Split bills',
        gender: 'ANY',
        occupationId: 'occ-1',
        hobbyReading: true,
        photos: ['uploads/profile/photo-1.jpg']
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.item.title).toBe('Need roommate');
    expect(createResponse.body.data.item.photos).toEqual(['uploads/profile/photo-1.jpg']);
  });

  it('requires one or two photos on roommate posts and keeps older posts readable', async () => {
    const owner = authHeader('user-normal', ['normal']);
    const payload = {
      houseId: 'house-1',
      title: 'Need roommate',
      budgetCostSharing: 'Split bills',
      gender: 'ANY',
      occupationId: 'occ-1'
    };
    const create = (photos?: unknown) =>
      request(app)
        .post('/api/v1/roommates')
        .set('Authorization', owner)
        .send(photos === undefined ? payload : { ...payload, photos });

    // Seeded post predates the photo column.
    const listResponse = await request(app).get('/api/v1/roommates');
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items[0].photos).toEqual([]);

    expect((await create()).status).toBe(400);
    expect((await create([])).status).toBe(400);
    expect(
      (await create(['uploads/profile/a.jpg', 'uploads/profile/b.jpg', 'uploads/profile/c.jpg'])).status
    ).toBe(400);
    expect((await create(['uploads/profile/a.jpg', 'uploads/profile/a.jpg'])).status).toBe(400);
    expect((await create(['https://example.com/a.jpg'])).status).toBe(400);
    expect((await create(['uploads/docs/a.jpg'])).status).toBe(400);
    expect(roommatePosts).toHaveLength(1);

    const two = await create(['uploads/profile/a.jpg', 'uploads/profile/b.png']);
    expect(two.status).toBe(201);
    expect(two.body.data.item.photos).toEqual(['uploads/profile/a.jpg', 'uploads/profile/b.png']);
  });

  it('lets only the owner edit or delete a roommate post', async () => {
    const owner = authHeader('user-normal', ['normal']);
    const other = authHeader('user-agent', ['agent']);
    const admin = authHeader('user-admin', ['admin']);
    const payload = {
      houseId: 'house-1',
      title: 'Updated title',
      budgetCostSharing: 'Split bills',
      gender: 'FEMALE',
      occupationId: 'occ-1',
      photos: ['uploads/profile/new-1.jpg', 'uploads/profile/new-2.jpg']
    };

    expect((await request(app).put('/api/v1/roommates/roommate-1').send(payload)).status).toBe(401);
    expect((await request(app).delete('/api/v1/roommates/roommate-1')).status).toBe(401);

    for (const intruder of [other, admin]) {
      const forbiddenEdit = await request(app)
        .put('/api/v1/roommates/roommate-1')
        .set('Authorization', intruder)
        .send(payload);
      expect(forbiddenEdit.status).toBe(403);

      const forbiddenDelete = await request(app).delete('/api/v1/roommates/roommate-1').set('Authorization', intruder);
      expect(forbiddenDelete.status).toBe(403);
    }
    expect(roommatePosts[0]?.title).toBe('Looking for quiet roommate');

    const missing = await request(app).put('/api/v1/roommates/nope').set('Authorization', owner).send(payload);
    expect(missing.status).toBe(404);

    // The photo rule also applies while editing.
    const noPhotos = await request(app)
      .put('/api/v1/roommates/roommate-1')
      .set('Authorization', owner)
      .send({ ...payload, photos: [] });
    expect(noPhotos.status).toBe(400);

    const edited = await request(app).put('/api/v1/roommates/roommate-1').set('Authorization', owner).send(payload);
    expect(edited.status).toBe(200);
    expect(edited.body.data.item.title).toBe('Updated title');
    expect(edited.body.data.item.gender).toBe('FEMALE');
    expect(edited.body.data.item.photos).toEqual(payload.photos);
    expect(roommatePosts[0]?.userId).toBe('user-normal');

    const removed = await request(app).delete('/api/v1/roommates/roommate-1').set('Authorization', owner);
    expect(removed.status).toBe(200);
    expect(roommatePosts).toHaveLength(0);

    const again = await request(app).delete('/api/v1/roommates/roommate-1').set('Authorization', owner);
    expect(again.status).toBe(404);
  });

  it('supports profile read/update/history and validates patch payload', async () => {
    const meResponse = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data.user.email).toBe('normal@example.com');

    const invalidPatch = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({});

    expect(invalidPatch.status).toBe(400);

    const patchResponse = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        name: 'Updated User',
        profilePicturePath: 'uploads/profile/u1.jpg'
      });

    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data.user.name).toBe('Updated User');

    const historyResponse = await request(app)
      .get('/api/v1/profile/history')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.bookingHistory).toHaveLength(1);
    expect(historyResponse.body.data.movingHistory).toHaveLength(1);
    expect(historyResponse.body.data.notifications.unread).toBe(1);
  });

  it('supports reviews submit/list with auth and validation', async () => {
    const unauthorized = await request(app).post('/api/v1/reviews').send({
      bookingId: 'booking-1',
      rating: 5
    });

    expect(unauthorized.status).toBe(401);

    const invalidPayload = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        bookingId: 'booking-1',
        rating: 7
      });

    expect(invalidPayload.status).toBe(400);

    const missingSource = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        rating: 4
      });

    expect(missingSource.status).toBe(400);

    const createResponse = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        bookingId: 'booking-1',
        rating: 4,
        comment: 'Good service'
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.item.targetType).toBe('AGENT');
    expect(createResponse.body.data.item.targetUserId).toBe('user-agent');
    expect(createResponse.body.data.item.bookingId).toBe('booking-1');

    const upsertResponse = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        bookingId: 'booking-1',
        rating: 5,
        comment: 'Updated comment'
      });

    expect(upsertResponse.status).toBe(200);
    expect(upsertResponse.body.data.item.rating).toBe(5);
    expect(upsertResponse.body.data.item.comment).toBe('Updated comment');

    const driverCreate = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        movingRequestId: 'moving-1',
        rating: 3
      });

    expect(driverCreate.status).toBe(201);
    expect(driverCreate.body.data.item.targetType).toBe('DRIVER');
    expect(driverCreate.body.data.item.targetUserId).toBe('user-driver');

    const notOwner = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-admin', ['admin']))
      .send({
        bookingId: 'booking-1',
        rating: 5
      });

    expect(notOwner.status).toBe(403);

    bookings.push({
      id: 'booking-cancelled',
      userId: 'user-normal',
      houseId: 'house-1',
      status: 'CANCELLED',
      createdAt: new Date('2026-08-11T06:00:00.000Z')
    });

    const cancelledBooking = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        bookingId: 'booking-cancelled',
        rating: 4
      });

    expect(cancelledBooking.status).toBe(400);

    movingRequests.push({
      id: 'moving-booked',
      orderNumber: 'MOV-20260811-000002',
      requesterUserId: 'user-normal',
      assignedDriverUserId: 'user-driver',
      vehicleTypeId: 'vt-1',
      status: 'BOOKED',
      pickupAddress: 'A',
      dropoffAddress: 'B',
      moveInDate: new Date('2026-08-20T00:00:00.000Z'),
      remarks: null,
      damageChecklist: null,
      acceptedAt: null,
      createdAt: new Date('2026-08-11T07:00:00.000Z'),
      updatedAt: new Date('2026-08-11T07:00:00.000Z')
    });

    const incompleteMove = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        movingRequestId: 'moving-booked',
        rating: 4
      });

    expect(incompleteMove.status).toBe(400);

    movingRequests.push({
      id: 'moving-no-driver',
      orderNumber: 'MOV-20260811-000003',
      requesterUserId: 'user-normal',
      assignedDriverUserId: null,
      vehicleTypeId: 'vt-1',
      status: 'COMPLETED',
      pickupAddress: 'A',
      dropoffAddress: 'B',
      moveInDate: new Date('2026-08-20T00:00:00.000Z'),
      remarks: null,
      damageChecklist: null,
      acceptedAt: null,
      createdAt: new Date('2026-08-11T08:00:00.000Z'),
      updatedAt: new Date('2026-08-11T08:00:00.000Z')
    });

    const missingDriver = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        movingRequestId: 'moving-no-driver',
        rating: 4
      });

    expect(missingDriver.status).toBe(400);

    const longComment = await request(app)
      .post('/api/v1/reviews')
      .set('Authorization', authHeader('user-normal', ['normal']))
      .send({
        bookingId: 'booking-1',
        rating: 5,
        comment: 'x'.repeat(1001)
      });

    expect(longComment.status).toBe(400);

    const listInvalid = await request(app).get('/api/v1/reviews');
    expect(listInvalid.status).toBe(400);

    const listResponse = await request(app).get('/api/v1/reviews').query({
      targetType: 'AGENT',
      targetUserId: 'user-agent'
    });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.summary.reviewCount).toBeGreaterThan(0);
  });

  it('supports notifications list and mark-as-read', async () => {
    const listResponse = await request(app)
      .get('/api/v1/notifications')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.unreadCount).toBe(1);

    const markResponse = await request(app)
      .patch('/api/v1/notifications/notification-1/read')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(markResponse.status).toBe(200);
    expect(markResponse.body.data.item.isRead).toBe(true);

    const notFoundResponse = await request(app)
      .patch('/api/v1/notifications/notification-3/read')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(notFoundResponse.status).toBe(404);
  });

  it('supports admin overview report with admin-only access', async () => {
    const forbidden = await request(app)
      .get('/api/v1/admin/reports/overview')
      .set('Authorization', authHeader('user-normal', ['normal']));

    expect(forbidden.status).toBe(403);

    const response = await request(app)
      .get('/api/v1/admin/reports/overview')
      .set('Authorization', authHeader('user-admin', ['admin']));

    expect(response.status).toBe(200);
    expect(response.body.data.userRegistrationsByRole).toBeDefined();
    expect(response.body.data.verification.agents).toBeDefined();
    expect(response.body.data.housing.byCity).toBeDefined();
    expect(response.body.data.bookingStatusSummary).toBeDefined();
    expect(response.body.data.movingRequestSummary).toBeDefined();
    expect(response.body.data.topPerformers.agents).toBeDefined();
  });
});
