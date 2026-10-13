import { HouseAvailabilityStatus } from '@prisma/client';

import { prisma } from '../prisma/client';
import { listHouses } from './house.service';
import { hasVerifiedBadge } from './subscription.service';

const HOME_AGENT_LIMIT = 8;

export const getHomePageContent = async () => {
  const now = new Date();
  const [featuredHouses, approvedAgents, serviceReviews] = await Promise.all([
    listHouses({
      page: 1,
      pageSize: 6
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        userRoles: {
          some: {
            role: {
              name: 'agent'
            }
          }
        },
        agentProfile: {
          is: {
            verificationStatus: 'VERIFIED'
          }
        }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profilePicturePath: true,
        agentProfile: {
          select: {
            verificationStatus: true,
            city: {
              select: {
                id: true,
                name: true
              }
            },
            serviceRegion: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        agentSubscriptions: {
          where: { startsAt: { lte: now }, endsAt: { gt: now } },
          select: { plan: true }
        }
      },
      take: 50,
      orderBy: {
        createdAt: 'desc'
      }
    }),
    prisma.ratingReview.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 6,
      select: {
        id: true,
        rating: true,
        comment: true,
        targetType: true,
        createdAt: true,
        reviewer: {
          select: {
            id: true,
            name: true
          }
        },
        targetUser: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })
  ]);

  const popularHouses = await prisma.house.findMany({
    where: {
      availability: HouseAvailabilityStatus.AVAILABLE
    },
    include: {
      images: {
        select: {
          imagePath: true,
          sortOrder: true
        },
        orderBy: {
          sortOrder: 'asc'
        },
        take: 1
      },
      propertyType: {
        select: {
          id: true,
          name: true
        }
      },
      city: {
        select: {
          id: true,
          name: true
        }
      }
    },
    orderBy: {
      bookings: {
        _count: 'desc'
      }
    },
    take: 6
  });

  const verifiedDrivers = await prisma.user.findMany({
    where: {
      isActive: true,
      userRoles: {
        some: {
          role: {
            name: 'driver'
          }
        }
      },
      driverProfile: {
        is: {
          verificationStatus: 'VERIFIED'
        }
      }
    },
    select: {
      id: true,
      name: true,
      driverProfile: {
        select: {
          companyName: true,
          vehicleType: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    take: 6,
    orderBy: {
      createdAt: 'desc'
    }
  });

  // Admin approval lets an agent publish; the public Verified Badge also needs a plan that includes it.
  const verifiedAgents = approvedAgents
    .map((agent) => {
      const plan = agent.agentSubscriptions.map((item) => item.plan).sort((a, b) => b.rank - a.rank)[0];
      return { ...agent, hasVerifiedBadge: plan ? hasVerifiedBadge(agent.agentProfile?.verificationStatus, plan) : false };
    })
    .sort((a, b) => Number(b.hasVerifiedBadge) - Number(a.hasVerifiedBadge))
    .slice(0, HOME_AGENT_LIMIT);

  return {
    featuredHouses: featuredHouses.items,
    popularRecommended: popularHouses.map((house) => ({
      id: house.id,
      title: house.title,
      monthlyFees: Number(house.monthlyFees),
      propertyType: house.propertyType,
      city: house.city,
      thumbnail: house.images[0]?.imagePath ?? null
    })),
    verifiedAgents: verifiedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      phone: agent.phone,
      profilePicturePath: agent.profilePicturePath ?? null,
      verificationStatus: agent.agentProfile?.verificationStatus ?? 'PENDING',
      hasVerifiedBadge: agent.hasVerifiedBadge,
      agentProfile: agent.agentProfile
        ? {
            city: agent.agentProfile.city,
            serviceRegion: agent.agentProfile.serviceRegion
          }
        : null
    })),
    partnerMovingServices: verifiedDrivers,
    serviceReviews,
    newsUpdates: [
      {
        id: 'news-welcome',
        title: 'Welcome to Shawe Mal',
        summary: 'Discover houses, moving services, and roommates in one place.',
        publishedAt: new Date().toISOString()
      }
    ]
  };
};
