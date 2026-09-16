import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { getSellerRatings, LISTING_CARD_INCLUDE, mapListingCard, PUBLIC_LISTING_WHERE } from './marketplace-shared';

const WISHLIST_ITEM_INCLUDE = {
  house: {
    include: {
      images: {
        select: {
          imagePath: true,
          sortOrder: true
        },
        orderBy: {
          sortOrder: 'asc' as const
        }
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

const mapWishlistItem = (
  item: {
    id: string;
    houseId: string;
    createdAt: Date;
    house: {
      id: string;
      title: string;
      monthlyFees: { toString: () => string };
      depositAmount: { toString: () => string };
      availability: string;
      propertyType: { id: string; name: string };
      city: { id: string; name: string };
      state: { id: string; name: string };
      images: Array<{ imagePath: string }>;
    };
  }
) => ({
  id: item.id,
  houseId: item.houseId,
  createdAt: item.createdAt,
  house: {
    id: item.house.id,
    title: item.house.title,
    monthlyFees: Number(item.house.monthlyFees.toString()),
    depositAmount: Number(item.house.depositAmount.toString()),
    availability: item.house.availability,
    propertyType: item.house.propertyType,
    city: item.house.city,
    state: item.house.state,
    thumbnail: item.house.images[0]?.imagePath ?? null
  }
});

export const addToWishlist = async (userId: string, houseId: string) => {
  return prisma.wishlist.upsert({
    where: {
      userId_houseId: {
        userId,
        houseId
      }
    },
    update: {},
    create: {
      userId,
      houseId
    }
  });
};

export const removeFromWishlist = async (userId: string, houseId: string) => {
  return prisma.wishlist.deleteMany({
    where: {
      userId,
      houseId
    }
  });
};

export const listWishlist = async (userId: string) => {
  const items = await prisma.wishlist.findMany({
    where: {
      userId,
      houseId: { not: null }
    },
    include: WISHLIST_ITEM_INCLUDE,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return items.flatMap((item) => (item.houseId && item.house ? [mapWishlistItem({ ...item, houseId: item.houseId, house: item.house })] : []));
};

export const addListingToWishlist = async (userId: string, listingId: string) => {
  const listing = await prisma.listing.findFirst({ where: { AND: [{ id: listingId }, PUBLIC_LISTING_WHERE] }, select: { id: true } });
  if (!listing) {
    throw new ApiError(404, 'LISTING_NOT_FOUND', 'Listing not found.');
  }

  return prisma.wishlist.upsert({
    where: { userId_listingId: { userId, listingId } },
    update: {},
    create: { userId, listingId }
  });
};

export const removeListingFromWishlist = async (userId: string, listingId: string) => {
  return prisma.wishlist.deleteMany({ where: { userId, listingId } });
};

export const listListingWishlist = async (userId: string) => {
  const items = await prisma.wishlist.findMany({
    where: { userId, listing: PUBLIC_LISTING_WHERE },
    include: { listing: { include: LISTING_CARD_INCLUDE } },
    orderBy: { createdAt: 'desc' }
  });

  const listings = items.flatMap((item) => (item.listing ? [item.listing] : []));
  const ratings = await getSellerRatings(listings.map((listing) => listing.sellerId));

  return items.flatMap((item) =>
    item.listing
      ? [{ id: item.id, listingId: item.listing.id, createdAt: item.createdAt, listing: mapListingCard(item.listing, ratings) }]
      : []
  );
};
