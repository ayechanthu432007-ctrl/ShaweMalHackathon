import { MovingRequestStatus, MovingStatusEventType } from '@prisma/client';
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
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED';
  isActive: boolean;
  userRoles: Array<{ role: MockRole }>;
  driverProfile?: { verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' } | null;
}

interface MockVehicleType {
  id: string;
  name: string;
  isActive: boolean;
  capacityLabel?: string;
  maxLoadKg?: number;
  pointFrom?: number;
  pointTo?: number;
  pricePerKm?: number;
}

interface MockFloorLevel {
  id: string;
  name: string;
  levelNumber: number;
  surchargeAmount: number;
  isActive: boolean;
}

interface MockInventoryItemType {
  id: string;
  code: string;
  category: string;
  itemName: string;
  points: number;
  isActive: boolean;
}

interface MockMovingRequest {
  id: string;
  orderNumber: string;
  requesterUserId: string;
  assignedDriverUserId: string | null;
  vehicleTypeId: string;
  pickupFloorLevelId: string | null;
  dropoffFloorLevelId: string | null;
  status: MovingRequestStatus;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLatitude: number | null;
  pickupLongitude: number | null;
  dropoffLatitude: number | null;
  dropoffLongitude: number | null;
  distanceKm: number | null;
  moveInDate: Date;
  remarks: string | null;
  damageChecklist: string | null;
  totalInventoryPoints: number;
  estimatedPrice: number | null;
  pricePerKmUsed: number | null;
  pickupFloorSurcharge: number | null;
  dropoffFloorSurcharge: number | null;
  estimatedEarnings: number | null;
  acceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MockMovingRequestPhoto {
  id: string;
  movingRequestId: string;
  photoPath: string;
  sortOrder: number;
  createdAt: Date;
}

interface MockMovingInventoryItem {
  id: string;
  movingRequestId: string;
  inventoryItemTypeId: string | null;
  category: string;
  itemName: string;
  count: number;
  pointsPerItem: number;
  linePoints: number;
  createdAt: Date;
}

interface MockMovingStatusEvent {
  id: string;
  movingRequestId: string;
  actorUserId: string | null;
  eventType: MovingStatusEventType;
  status: MovingRequestStatus | null;
  notes: string | null;
  createdAt: Date;
}

interface MockMovingEtaEntry {
  id: string;
  movingRequestId: string;
  driverUserId: string;
  stage: string;
  etaAt: Date;
  notes: string | null;
  createdAt: Date;
}

const roles = new Map<string, MockRole>([
  ['normal', { id: 'role-normal', name: 'normal' }],
  ['driver', { id: 'role-driver', name: 'driver' }],
  ['admin', { id: 'role-admin', name: 'admin' }]
]);

const users = new Map<string, MockUser>();
const vehicleTypes = new Map<string, MockVehicleType>();
const floorLevels = new Map<string, MockFloorLevel>();
const inventoryItemTypes = new Map<string, MockInventoryItemType>();
const movingRequests = new Map<string, MockMovingRequest>();
const movingPhotos: MockMovingRequestPhoto[] = [];
const movingInventoryItems: MockMovingInventoryItem[] = [];
const movingStatusEvents: MockMovingStatusEvent[] = [];
const movingEtaEntries: MockMovingEtaEntry[] = [];
const notifications: Array<{ userId: string; title: string; message: string }> = [];
const driverProfiles: Array<{ userId: string; vehicleTypeId: string }> = [];

const getUserByRole = (name: string) => {
  return Array.from(users.values()).filter((user) => user.userRoles.some((entry) => entry.role.name === name));
};

const cloneUser = (user: MockUser): MockUser => ({
  ...user,
  userRoles: user.userRoles.map((entry) => ({ role: { ...entry.role } })),
  driverProfile: user.userRoles.some((entry) => entry.role.name === 'driver')
    ? { verificationStatus: user.verificationStatus }
    : null
});

const hydrateMovingRequest = (movingRequest: MockMovingRequest) => {
  const requester = users.get(movingRequest.requesterUserId);
  const assignedDriver = movingRequest.assignedDriverUserId ? users.get(movingRequest.assignedDriverUserId) : null;
  const vehicleType = vehicleTypes.get(movingRequest.vehicleTypeId);

  return {
    ...movingRequest,
    requester: {
      id: requester?.id ?? 'unknown-requester',
      name: requester?.name ?? 'Unknown Requester',
      phone: requester?.phone ?? '0000000',
      email: requester?.email ?? 'unknown@example.com'
    },
    assignedDriver: assignedDriver
      ? {
          id: assignedDriver.id,
          name: assignedDriver.name,
          phone: assignedDriver.phone,
          email: assignedDriver.email,
          driverProfile: {
            name: assignedDriver.name,
            phone: assignedDriver.phone,
            profilePhotoPath: 'uploads/profile/driver-photo.jpg',
            vehicleLicensePlateNumber: 'YGN 7J-1234'
          }
        }
      : null,
    vehicleType: {
      id: vehicleType?.id ?? 'vehicle-unknown',
      name: vehicleType?.name ?? 'Unknown Vehicle',
      capacityLabel: vehicleType?.capacityLabel ?? null,
      maxLoadKg: vehicleType?.maxLoadKg ?? null,
      pointFrom: vehicleType?.pointFrom ?? null,
      pointTo: vehicleType?.pointTo ?? null,
      pricePerKm: vehicleType?.pricePerKm ?? null
    },
    pickupFloorLevel: movingRequest.pickupFloorLevelId
      ? floorLevels.get(movingRequest.pickupFloorLevelId) ?? null
      : null,
    dropoffFloorLevel: movingRequest.dropoffFloorLevelId
      ? floorLevels.get(movingRequest.dropoffFloorLevelId) ?? null
      : null,
    photos: movingPhotos
      .filter((item) => item.movingRequestId === movingRequest.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
    inventoryItems: movingInventoryItems
      .filter((item) => item.movingRequestId === movingRequest.id)
      .sort((a, b) => {
        const byCategory = a.category.localeCompare(b.category);
        if (byCategory !== 0) {
          return byCategory;
        }

        return a.itemName.localeCompare(b.itemName);
      }),
    statusEvents: movingStatusEvents
      .filter((item) => item.movingRequestId === movingRequest.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    etaEntries: movingEtaEntries
      .filter((item) => item.movingRequestId === movingRequest.id)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  };
};

const projectMovingRequest = (record: MockMovingRequest, select?: Record<string, boolean>) => {
  if (!select) {
    return { ...record };
  }

  const projected: Record<string, unknown> = {};
  Object.entries(select).forEach(([key, enabled]) => {
    if (enabled) {
      projected[key] = (record as unknown as Record<string, unknown>)[key];
    }
  });

  return projected;
};

jest.mock('../../src/services/geocode.service', () => {
  const actual = jest.requireActual('../../src/services/geocode.service');
  return {
    ...actual,
    geocodeAddress: jest.fn(async (address: string) => {
      if (address.toLowerCase().includes('hledan')) {
        return { latitude: 16.825, longitude: 96.13 };
      }
      return { latitude: 16.81, longitude: 96.177 };
    })
  };
});

jest.mock('../../src/prisma/client', () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const user = users.get(where.id);
        return user ? cloneUser(user) : null;
      }),
      findMany: jest.fn(async ({ where }: { where: any }) => {
        const activeUsers = Array.from(users.values()).filter((user) => user.isActive);

        if (
          where?.driverProfile?.is?.verificationStatus === 'VERIFIED' &&
          where?.userRoles?.some?.role?.name === 'driver'
        ) {
          return getUserByRole('driver')
            .filter((user) => user.verificationStatus === 'VERIFIED' && user.isActive)
            .map((user) => ({
              ...cloneUser(user),
              driverProfile: {
                verificationStatus: user.verificationStatus,
                name: user.name,
                phone: user.phone,
                vehicleLicensePlateNumber: 'YGN 7J-1234',
                vehicleType: { id: 'vt-truck', name: vehicleTypes.get('vt-truck')?.name ?? '10 ft truck' }
              }
            }));
        }

        return activeUsers;
      })
    },
    vehicleType: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return vehicleTypes.get(where.id) ?? null;
      }),
      findMany: jest.fn(async ({ where }: { where: any }) => {
        return Array.from(vehicleTypes.values()).filter((item) => {
          if (where?.isActive === true && !item.isActive) {
            return false;
          }
          if (where?.id?.not && item.id === where.id.not) {
            return false;
          }
          return true;
        });
      })
    },
    floorLevel: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        return floorLevels.get(where.id) ?? null;
      }),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    movingInventoryItemType: {
      findMany: jest.fn(async ({ where }: { where: any }) => {
        const ids: string[] = where?.id?.in ?? Array.from(inventoryItemTypes.keys());
        return ids
          .map((id) => inventoryItemTypes.get(id))
          .filter((item): item is MockInventoryItemType => Boolean(item))
          .filter((item) => (where?.isActive === true ? item.isActive : true));
      }),
      findUnique: jest.fn(async ({ where }: { where: { id?: string; code?: string } }) => {
        if (where.id) {
          return inventoryItemTypes.get(where.id) ?? null;
        }
        return Array.from(inventoryItemTypes.values()).find((item) => item.code === where.code) ?? null;
      })
    },
    movingRequest: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const now = new Date();
        const id = `moving-${movingRequests.size + 1}`;

        const created: MockMovingRequest = {
          id,
          orderNumber: data.orderNumber,
          requesterUserId: data.requesterUserId,
          assignedDriverUserId: data.assignedDriverUserId ?? null,
          vehicleTypeId: data.vehicleTypeId,
          pickupFloorLevelId: data.pickupFloorLevelId ?? null,
          dropoffFloorLevelId: data.dropoffFloorLevelId ?? null,
          status: data.status ?? MovingRequestStatus.BOOKED,
          pickupAddress: data.pickupAddress,
          dropoffAddress: data.dropoffAddress,
          pickupLatitude: data.pickupLatitude ? Number(data.pickupLatitude) : null,
          pickupLongitude: data.pickupLongitude ? Number(data.pickupLongitude) : null,
          dropoffLatitude: data.dropoffLatitude ? Number(data.dropoffLatitude) : null,
          dropoffLongitude: data.dropoffLongitude ? Number(data.dropoffLongitude) : null,
          distanceKm: data.distanceKm ? Number(data.distanceKm) : null,
          moveInDate: new Date(data.moveInDate),
          remarks: data.remarks ?? null,
          damageChecklist: data.damageChecklist ?? null,
          totalInventoryPoints: data.totalInventoryPoints ?? 0,
          estimatedPrice: data.estimatedPrice ? Number(data.estimatedPrice) : null,
          pricePerKmUsed: data.pricePerKmUsed ? Number(data.pricePerKmUsed) : null,
          pickupFloorSurcharge: data.pickupFloorSurcharge ? Number(data.pickupFloorSurcharge) : null,
          dropoffFloorSurcharge: data.dropoffFloorSurcharge ? Number(data.dropoffFloorSurcharge) : null,
          estimatedEarnings: data.estimatedEarnings ? Number(data.estimatedEarnings) : null,
          acceptedAt: data.acceptedAt ?? null,
          createdAt: now,
          updatedAt: now
        };

        movingRequests.set(id, created);

        for (const [index, photo] of (data.photos?.create ?? []).entries()) {
          movingPhotos.push({
            id: `moving-photo-${movingPhotos.length + 1}`,
            movingRequestId: id,
            photoPath: photo.photoPath,
            sortOrder: photo.sortOrder ?? index + 1,
            createdAt: now
          });
        }

        for (const item of data.inventoryItems?.create ?? []) {
          movingInventoryItems.push({
            id: `moving-item-${movingInventoryItems.length + 1}`,
            movingRequestId: id,
            inventoryItemTypeId: item.inventoryItemTypeId ?? null,
            category: item.category,
            itemName: item.itemName,
            count: item.count,
            pointsPerItem: item.pointsPerItem ?? 0,
            linePoints: item.linePoints ?? 0,
            createdAt: now
          });
        }

        if (data.statusEvents?.create) {
          movingStatusEvents.push({
            id: `moving-event-${movingStatusEvents.length + 1}`,
            movingRequestId: id,
            actorUserId: data.statusEvents.create.actorUserId ?? null,
            eventType: data.statusEvents.create.eventType,
            status: data.statusEvents.create.status ?? null,
            notes: data.statusEvents.create.notes ?? null,
            createdAt: now
          });
        }

        return hydrateMovingRequest(created);
      }),
      findUnique: jest.fn(async ({ where, include, select }: { where: { id?: string; orderNumber?: string }; include?: any; select?: Record<string, boolean> }) => {
        const found = where.id
          ? movingRequests.get(where.id)
          : Array.from(movingRequests.values()).find((item) => item.orderNumber === where.orderNumber);
        if (!found) {
          return null;
        }

        if (include) {
          return hydrateMovingRequest(found);
        }

        return projectMovingRequest(found, select);
      }),
      count: jest.fn(async () => movingRequests.size),
      findMany: jest.fn(async ({ where }: { where: any }) => {
        const items = Array.from(movingRequests.values()).filter((item) => {
          if (where?.requesterUserId && item.requesterUserId !== where.requesterUserId) {
            return false;
          }

          if (where?.status) {
            if (typeof where.status === 'string') {
              if (item.status !== where.status) {
                return false;
              }
            } else if (Array.isArray(where.status.in) && !where.status.in.includes(item.status)) {
              return false;
            } else if (Array.isArray(where.status.notIn) && where.status.notIn.includes(item.status)) {
              return false;
            }
          }

          if (typeof where?.orderNumber === 'string' && item.orderNumber !== where.orderNumber) {
            return false;
          }

          if (
            typeof where?.orderNumber?.contains === 'string' &&
            !item.orderNumber.toLowerCase().includes(String(where.orderNumber.contains).toLowerCase())
          ) {
            return false;
          }

          if (where?.createdAt?.gte && item.createdAt < where.createdAt.gte) {
            return false;
          }

          if (where?.createdAt?.lte && item.createdAt > where.createdAt.lte) {
            return false;
          }

          if (where?.assignedDriverUserId === null && item.assignedDriverUserId !== null) {
            return false;
          }

          if (
            typeof where?.assignedDriverUserId === 'string' &&
            item.assignedDriverUserId !== where.assignedDriverUserId
          ) {
            return false;
          }

          const rejectedByDriver = where?.statusEvents?.none;
          if (rejectedByDriver) {
            const hasRejection = movingStatusEvents.some(
              (event) =>
                event.movingRequestId === item.id &&
                event.actorUserId === rejectedByDriver.actorUserId &&
                event.eventType === rejectedByDriver.eventType
            );

            if (hasRejection) {
              return false;
            }
          }

          return true;
        });

        return items.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).map((item) => hydrateMovingRequest(item));
      }),
      updateMany: jest.fn(async ({ where, data }: { where: any; data: any }) => {
        const found = movingRequests.get(where.id);
        if (!found) {
          return { count: 0 };
        }

        if (where.status && found.status !== where.status) {
          return { count: 0 };
        }

        if (where.assignedDriverUserId === null && found.assignedDriverUserId !== null) {
          return { count: 0 };
        }

        if (typeof where.assignedDriverUserId === 'string' && found.assignedDriverUserId !== where.assignedDriverUserId) {
          return { count: 0 };
        }

        if (where.requesterUserId && found.requesterUserId !== where.requesterUserId) {
          return { count: 0 };
        }

        const updated: MockMovingRequest = {
          ...found,
          status: data.status ?? found.status,
          assignedDriverUserId: data.assignedDriverUserId ?? found.assignedDriverUserId,
          acceptedAt: data.acceptedAt ?? found.acceptedAt,
          updatedAt: new Date()
        };

        movingRequests.set(found.id, updated);
        return { count: 1 };
      }),
      update: jest.fn(async ({ where, data, include }: { where: { id: string }; data: any; include?: any }) => {
        const found = movingRequests.get(where.id);
        if (!found) {
          throw new Error('Moving request not found');
        }

        const updated: MockMovingRequest = {
          ...found,
          status: data.status ?? found.status,
          assignedDriverUserId:
            data.assignedDriverUserId === undefined ? found.assignedDriverUserId : data.assignedDriverUserId,
          acceptedAt: data.acceptedAt ?? found.acceptedAt,
          updatedAt: new Date()
        };

        movingRequests.set(where.id, updated);

        if (include) {
          return hydrateMovingRequest(updated);
        }

        return updated;
      })
    },
    movingStatusEvent: {
      findFirst: jest.fn(async ({ where }: { where: any }) => {
        const found = movingStatusEvents.find((event) => {
          if (where?.movingRequestId && event.movingRequestId !== where.movingRequestId) {
            return false;
          }

          if (where?.actorUserId && event.actorUserId !== where.actorUserId) {
            return false;
          }

          if (where?.eventType && event.eventType !== where.eventType) {
            return false;
          }

          return true;
        });

        return found ? { id: found.id } : null;
      }),
      create: jest.fn(async ({ data }: { data: any }) => {
        const created: MockMovingStatusEvent = {
          id: `moving-event-${movingStatusEvents.length + 1}`,
          movingRequestId: data.movingRequestId,
          actorUserId: data.actorUserId ?? null,
          eventType: data.eventType,
          status: data.status ?? null,
          notes: data.notes ?? null,
          createdAt: new Date()
        };

        movingStatusEvents.push(created);
        return created;
      })
    },
    movingEtaEntry: {
      create: jest.fn(async ({ data }: { data: any }) => {
        const created: MockMovingEtaEntry = {
          id: `moving-eta-${movingEtaEntries.length + 1}`,
          movingRequestId: data.movingRequestId,
          driverUserId: data.driverUserId,
          stage: data.stage,
          etaAt: new Date(data.etaAt),
          notes: data.notes ?? null,
          createdAt: new Date()
        };

        movingEtaEntries.push(created);
        return created;
      })
    },
    driverProfile: {
      upsert: jest.fn(async ({ where, create, update }: { where: { userId: string }; create: any; update: any }) => {
        const existing = driverProfiles.find((item) => item.userId === where.userId);
        const vehicleTypeId = (existing ? update.vehicleTypeId : create.vehicleTypeId) as string;

        if (existing) {
          existing.vehicleTypeId = vehicleTypeId;
        } else {
          driverProfiles.push({ userId: where.userId, vehicleTypeId });
        }

        return {
          id: `driver-profile-${where.userId}`,
          ...create,
          ...update,
          userId: where.userId,
          vehicleType: {
            id: vehicleTypeId,
            name: vehicleTypes.get(vehicleTypeId)?.name ?? 'Unknown'
          }
        };
      })
    },
    notification: {
      create: jest.fn(async ({ data }: { data: { userId: string; title: string; message: string } }) => {
        notifications.push(data);
        return { id: `notification-${notifications.length}` };
      }),
      createMany: jest.fn(async ({ data }: { data: Array<{ userId: string; title: string; message: string }> }) => {
        notifications.push(...data);
        return { count: data.length };
      })
    },
    role: { upsert: jest.fn(), findMany: jest.fn() },
    userRole: { deleteMany: jest.fn(), createMany: jest.fn() },
    refreshSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
    propertyType: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    state: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    city: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    contractType: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    serviceRegion: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    occupation: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    amenity: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    statusCode: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    house: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    booking: { create: jest.fn() },
    wishlist: { upsert: jest.fn(), deleteMany: jest.fn(), findMany: jest.fn() },
    agentProfile: { upsert: jest.fn() },
    houseImage: { deleteMany: jest.fn() },
    houseAmenity: { deleteMany: jest.fn() },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> => callback(prisma))
  };

  return { prisma };
});

const requesterToken = signJwt({ sub: 'user-requester', email: 'requester@example.com', roles: ['normal'] }, '1h');
const outsiderToken = signJwt({ sub: 'user-outsider', email: 'outsider@example.com', roles: ['normal'] }, '1h');
const driver1Token = signJwt({ sub: 'driver-1', email: 'driver1@example.com', roles: ['driver'] }, '1h');
const driver2Token = signJwt({ sub: 'driver-2', email: 'driver2@example.com', roles: ['driver'] }, '1h');
const unverifiedDriverToken = signJwt({ sub: 'driver-pending', email: 'driver.pending@example.com', roles: ['driver'] }, '1h');
const adminToken = signJwt({ sub: 'admin-1', email: 'admin@example.com', roles: ['admin'] }, '1h');

const seedData = () => {
  users.clear();
  vehicleTypes.clear();
  floorLevels.clear();
  inventoryItemTypes.clear();
  movingRequests.clear();
  movingPhotos.length = 0;
  movingInventoryItems.length = 0;
  movingStatusEvents.length = 0;
  movingEtaEntries.length = 0;
  notifications.length = 0;
  driverProfiles.length = 0;

  users.set('user-requester', {
    id: 'user-requester',
    name: 'Requester User',
    email: 'requester@example.com',
    phone: '0911111111',
    verificationStatus: 'VERIFIED',
    isActive: true,
    userRoles: [{ role: roles.get('normal') as MockRole }]
  });

  users.set('user-outsider', {
    id: 'user-outsider',
    name: 'Outsider User',
    email: 'outsider@example.com',
    phone: '0922222222',
    verificationStatus: 'VERIFIED',
    isActive: true,
    userRoles: [{ role: roles.get('normal') as MockRole }]
  });

  users.set('driver-1', {
    id: 'driver-1',
    name: 'Driver One',
    email: 'driver1@example.com',
    phone: '0933333333',
    verificationStatus: 'VERIFIED',
    isActive: true,
    userRoles: [{ role: roles.get('driver') as MockRole }]
  });

  users.set('driver-2', {
    id: 'driver-2',
    name: 'Driver Two',
    email: 'driver2@example.com',
    phone: '0944444444',
    verificationStatus: 'VERIFIED',
    isActive: true,
    userRoles: [{ role: roles.get('driver') as MockRole }]
  });

  users.set('driver-pending', {
    id: 'driver-pending',
    name: 'Pending Driver',
    email: 'driver.pending@example.com',
    phone: '0955555555',
    verificationStatus: 'PENDING',
    isActive: true,
    userRoles: [{ role: roles.get('driver') as MockRole }]
  });

  users.set('admin-1', {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@example.com',
    phone: '0966666666',
    verificationStatus: 'VERIFIED',
    isActive: true,
    userRoles: [{ role: roles.get('admin') as MockRole }]
  });

  vehicleTypes.set('vt-truck', {
    id: 'vt-truck',
    name: 'Light Truck',
    isActive: true,
    capacityLabel: '1.5 Ton',
    maxLoadKg: 1500,
    pointFrom: 0,
    pointTo: 200,
    pricePerKm: 1100
  });

  floorLevels.set('floor-1', {
    id: 'floor-1',
    name: '1st Floor',
    levelNumber: 1,
    surchargeAmount: 5000,
    isActive: true
  });
  floorLevels.set('floor-2', {
    id: 'floor-2',
    name: '2nd Floor',
    levelNumber: 2,
    surchargeAmount: 10000,
    isActive: true
  });

  inventoryItemTypes.set('inv-wardrobe', {
    id: 'inv-wardrobe',
    code: 'bedroom_wardrobe',
    category: 'bedroom',
    itemName: 'Wardrobe',
    points: 14,
    isActive: true
  });
  inventoryItemTypes.set('inv-fridge', {
    id: 'inv-fridge',
    code: 'kitchen_refrigerator',
    category: 'kitchen',
    itemName: 'Refrigerator',
    points: 14,
    isActive: true
  });
  inventoryItemTypes.set('inv-boxes', {
    id: 'inv-boxes',
    code: 'other_boxes',
    category: 'other',
    itemName: 'Boxes',
    points: 2,
    isActive: true
  });
};

const createMovingPayload = () => ({
  pickupAddress: 'Hledan, Yangon',
  dropoffAddress: 'Tamwe, Yangon',
  pickupFloorLevelId: 'floor-1',
  dropoffFloorLevelId: 'floor-2',
  moveInDate: '2026-09-01T09:00:00.000Z',
  vehicleTypeId: 'vt-truck',
  remarks: 'Handle fragile items carefully',
  damageChecklist: 'Existing small scratch on wardrobe',
  photos: ['uploads/moving/photo-1.jpg', 'uploads/moving/photo-2.jpg'],
  inventoryItems: [
    { inventoryItemTypeId: 'inv-wardrobe', count: 1 },
    { inventoryItemTypeId: 'inv-fridge', count: 1 },
    { inventoryItemTypeId: 'inv-boxes', count: 8 }
  ]
});

describe('Moving and driver workflow integration', () => {
  beforeEach(() => {
    seedData();
  });

  it('quotes estimated price from floors, points, and geocoded distance', async () => {
    const quoteResponse = await request(app)
      .post('/api/v1/moving/quote')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        pickupAddress: 'Hledan, Yangon',
        dropoffAddress: 'Tamwe, Yangon',
        pickupFloorLevelId: 'floor-1',
        dropoffFloorLevelId: 'floor-2',
        inventoryItems: [
          { inventoryItemTypeId: 'inv-wardrobe', count: 1 },
          { inventoryItemTypeId: 'inv-fridge', count: 1 },
          { inventoryItemTypeId: 'inv-boxes', count: 8 }
        ]
      });

    expect(quoteResponse.status).toBe(200);
    expect(quoteResponse.body.data.quote.suggestedVehicleType.id).toBe('vt-truck');
    expect(quoteResponse.body.data.quote.totalInventoryPoints).toBe(44);
    expect(quoteResponse.body.data.quote.pickupFloorSurcharge).toBe(5000);
    expect(quoteResponse.body.data.quote.dropoffFloorSurcharge).toBe(10000);
    expect(quoteResponse.body.data.quote.estimatedPrice).toBeGreaterThan(15000);
  });

  it('creates moving request, notifies drivers, and lists available requests for verified driver', async () => {
    const createResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.data.movingRequest.status).toBe('BOOKED');
    expect(createResponse.body.data.movingRequest.orderNumber).toMatch(/^MOV-/);
    expect(createResponse.body.data.movingRequest.inventoryItems.length).toBe(3);
    expect(createResponse.body.data.movingRequest.estimatedPrice).toBeGreaterThan(0);
    expect(notifications.filter((item) => item.title === 'New Moving Request').length).toBe(2);

    const availableResponse = await request(app)
      .get('/api/v1/driver/requests/available')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(availableResponse.status).toBe(200);
    expect(availableResponse.body.data.items.length).toBe(1);

    const unverifiedResponse = await request(app)
      .get('/api/v1/driver/requests/available')
      .set('Authorization', `Bearer ${unverifiedDriverToken}`);

    expect(unverifiedResponse.status).toBe(403);

    const movingRequestId = createResponse.body.data.movingRequest.id as string;

    const driverDetailView = await request(app)
      .get(`/api/v1/moving/requests/${movingRequestId}`)
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(driverDetailView.status).toBe(200);
    expect(driverDetailView.body.data.movingRequest.id).toBe(movingRequestId);

    const unverifiedDetailView = await request(app)
      .get(`/api/v1/moving/requests/${movingRequestId}`)
      .set('Authorization', `Bearer ${unverifiedDriverToken}`);

    expect(unverifiedDetailView.status).toBe(403);
  });

  it('lists only the requester moving bookings for Moving Status', async () => {
    const first = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const second = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    const listResponse = await request(app)
      .get('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.items).toHaveLength(2);
    expect(listResponse.body.data.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([first.body.data.movingRequest.id, second.body.data.movingRequest.id])
    );

    const driverList = await request(app)
      .get('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(driverList.status).toBe(200);
    expect(driverList.body.data.items).toHaveLength(0);
  });

  it('allows first driver accept and rejects second accept attempt', async () => {
    const createResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    const movingRequestId = createResponse.body.data.movingRequest.id as string;

    const firstAccept = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    expect(firstAccept.status).toBe(200);
    expect(firstAccept.body.data.movingRequest.status).toBe('ACCEPTED');
    expect(firstAccept.body.data.movingRequest.assignedDriver.id).toBe('driver-1');

    const secondAccept = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/accept`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({});

    expect(secondAccept.status).toBe(409);
    expect(secondAccept.body.errors.code).toBe('MOVING_REQUEST_ALREADY_ACCEPTED');

    const requesterView = await request(app)
      .get(`/api/v1/moving/requests/${movingRequestId}`)
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(requesterView.status).toBe(200);
    expect(requesterView.body.data.movingRequest.assignedDriver.id).toBe('driver-1');

    const outsiderView = await request(app)
      .get(`/api/v1/moving/requests/${movingRequestId}`)
      .set('Authorization', `Bearer ${outsiderToken}`);

    expect(outsiderView.status).toBe(403);
  });

  it('lists assigned in-progress jobs and hides completed, cancelled, and rejected work', async () => {
    const first = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const second = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const third = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const fourth = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    const acceptedId = first.body.data.movingRequest.id as string;
    const cancelledId = second.body.data.movingRequest.id as string;
    const rejectedId = third.body.data.movingRequest.id as string;
    const adminAssignedId = fourth.body.data.movingRequest.id as string;

    await request(app)
      .post(`/api/v1/driver/requests/${acceptedId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    const assignedAfterAccept = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(assignedAfterAccept.status).toBe(200);
    expect(assignedAfterAccept.body.data.items.map((item: { id: string }) => item.id)).toEqual([acceptedId]);

    const availableAfterAccept = await request(app)
      .get('/api/v1/driver/requests/available')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(availableAfterAccept.body.data.items.map((item: { id: string }) => item.id)).not.toContain(acceptedId);

    const otherDriverAssigned = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver2Token}`);

    expect(otherDriverAssigned.body.data.items).toHaveLength(0);

    await request(app)
      .post(`/api/v1/driver/requests/${acceptedId}/status`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ status: 'driver_coming' });

    const assignedInProgress = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(assignedInProgress.body.data.items.map((item: { id: string }) => item.id)).toEqual([acceptedId]);

    for (const status of ['driver_arrived', 'loading', 'on_the_way', 'unloading', 'completed'] as const) {
      await request(app)
        .post(`/api/v1/driver/requests/${acceptedId}/status`)
        .set('Authorization', `Bearer ${driver1Token}`)
        .send({ status });
    }

    const assignedAfterComplete = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(assignedAfterComplete.body.data.items).toHaveLength(0);

    await request(app)
      .post(`/api/v1/driver/requests/${cancelledId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});
    await request(app)
      .post(`/api/v1/driver/requests/${cancelledId}/status`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ status: 'cancelled', notes: 'Vehicle unavailable today' });

    const assignedAfterCancel = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(assignedAfterCancel.body.data.items).toHaveLength(0);

    await request(app)
      .post(`/api/v1/driver/requests/${rejectedId}/reject`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    const availableAfterReject = await request(app)
      .get('/api/v1/driver/requests/available')
      .set('Authorization', `Bearer ${driver1Token}`);
    const assignedAfterReject = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(availableAfterReject.body.data.items.map((item: { id: string }) => item.id)).not.toContain(rejectedId);
    expect(assignedAfterReject.body.data.items.map((item: { id: string }) => item.id)).not.toContain(rejectedId);

    await request(app)
      .post(`/api/v1/admin/moving/requests/${adminAssignedId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverUserId: 'driver-1' });

    const assignedAfterAdmin = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${driver1Token}`);

    expect(assignedAfterAdmin.body.data.items.map((item: { id: string }) => item.id)).toEqual([adminAssignedId]);

    const unverifiedAssigned = await request(app)
      .get('/api/v1/driver/requests/assigned')
      .set('Authorization', `Bearer ${unverifiedDriverToken}`);

    expect(unverifiedAssigned.status).toBe(403);
  });

  it('lists all moving requests for admin report with date and status filters (FR-ADMIN-008)', async () => {
    const firstResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const firstId = firstResponse.body.data.movingRequest.id as string;

    const secondResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const secondId = secondResponse.body.data.movingRequest.id as string;

    await request(app)
      .post(`/api/v1/admin/moving/requests/${secondId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverUserId: 'driver-1' });

    const denied = await request(app)
      .get('/api/v1/admin/reports/moving')
      .set('Authorization', `Bearer ${requesterToken}`);

    expect(denied.status).toBe(403);

    const allResponse = await request(app)
      .get('/api/v1/admin/reports/moving')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(allResponse.status).toBe(200);
    expect(allResponse.body.data.items).toHaveLength(2);
    expect(allResponse.body.data.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([firstId, secondId])
    );

    const bookedResponse = await request(app)
      .get('/api/v1/admin/reports/moving')
      .query({ status: 'BOOKED' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(bookedResponse.status).toBe(200);
    expect(bookedResponse.body.data.items).toHaveLength(1);
    expect(bookedResponse.body.data.items[0].id).toBe(firstId);
    expect(bookedResponse.body.data.items[0].status).toBe('BOOKED');
    expect(bookedResponse.body.data.items[0].requester.name).toBe('Requester User');

    const assignedResponse = await request(app)
      .get('/api/v1/admin/reports/moving')
      .query({ status: 'ASSIGNED' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(assignedResponse.body.data.items).toHaveLength(1);
    expect(assignedResponse.body.data.items[0].id).toBe(secondId);

    const futureFrom = await request(app)
      .get('/api/v1/admin/reports/moving')
      .query({ from: '2099-01-01' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(futureFrom.status).toBe(200);
    expect(futureFrom.body.data.items).toHaveLength(0);

    const invalidStatus = await request(app)
      .get('/api/v1/admin/reports/moving')
      .query({ status: 'PENDING' })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(invalidStatus.status).toBe(400);
  });

  it('supports admin fallback assignment only when pending and unassigned', async () => {
    const createResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    const movingRequestId = createResponse.body.data.movingRequest.id as string;

    const assignResponse = await request(app)
      .post(`/api/v1/admin/moving/requests/${movingRequestId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverUserId: 'driver-2' });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data.movingRequest.status).toBe('ASSIGNED');
    expect(assignResponse.body.data.movingRequest.assignedDriver.id).toBe('driver-2');

    const secondAssign = await request(app)
      .post(`/api/v1/admin/moving/requests/${movingRequestId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverUserId: 'driver-1' });

    expect(secondAssign.status).toBe(409);
    expect(secondAssign.body.errors.code).toBe('MOVING_REQUEST_NOT_ASSIGNABLE');
  });

  it('lists assignable jobs and verified drivers for admin jobs assign (FR-MOVE-005)', async () => {
    const bookedResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const bookedId = bookedResponse.body.data.movingRequest.id as string;
    const bookedOrder = bookedResponse.body.data.movingRequest.orderNumber as string;

    const acceptedResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const acceptedId = acceptedResponse.body.data.movingRequest.id as string;
    await request(app)
      .post(`/api/v1/driver/requests/${acceptedId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    const cancelledResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());
    const cancelledId = cancelledResponse.body.data.movingRequest.id as string;
    await request(app)
      .post(`/api/v1/driver/requests/${cancelledId}/accept`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({});
    await request(app)
      .post(`/api/v1/driver/requests/${cancelledId}/status`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({ status: 'cancelled', notes: 'Vehicle breakdown' });

    const denied = await request(app)
      .get('/api/v1/admin/moving/assignable-requests')
      .set('Authorization', `Bearer ${requesterToken}`);
    expect(denied.status).toBe(403);

    const jobsResponse = await request(app)
      .get('/api/v1/admin/moving/assignable-requests')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(jobsResponse.status).toBe(200);
    const jobIds = jobsResponse.body.data.items.map((item: { id: string }) => item.id);
    expect(jobIds).toEqual(expect.arrayContaining([bookedId, cancelledId]));
    expect(jobIds).not.toContain(acceptedId);

    const searchResponse = await request(app)
      .get('/api/v1/admin/moving/assignable-requests')
      .query({ orderNumber: bookedOrder })
      .set('Authorization', `Bearer ${adminToken}`);

    expect(searchResponse.body.data.items).toHaveLength(1);
    expect(searchResponse.body.data.items[0].id).toBe(bookedId);

    const driversResponse = await request(app)
      .get('/api/v1/admin/moving/assignable-drivers')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(driversResponse.status).toBe(200);
    const driverIds = driversResponse.body.data.items.map((item: { userId: string }) => item.userId);
    expect(driverIds).toEqual(expect.arrayContaining(['driver-1', 'driver-2']));
    expect(driverIds).not.toContain('driver-pending');
    expect(driversResponse.body.data.items[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        phone: expect.any(String)
      })
    );

    const reassignResponse = await request(app)
      .post(`/api/v1/admin/moving/requests/${cancelledId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ driverUserId: 'driver-1' });

    expect(reassignResponse.status).toBe(200);
    expect(reassignResponse.body.data.movingRequest.status).toBe('ASSIGNED');
    expect(reassignResponse.body.data.movingRequest.assignedDriver.id).toBe('driver-1');
  });

  it('enforces ETA/status authorization and allows assigned driver lifecycle updates', async () => {
    const createResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    const movingRequestId = createResponse.body.data.movingRequest.id as string;

    await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    const forbiddenEta = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/eta`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({ stage: 'loading', etaAt: '2026-09-01T08:30:00.000Z' });

    expect(forbiddenEta.status).toBe(403);

    const etaResponse = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/eta`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ stage: 'loading', etaAt: '2026-09-01T10:00:00.000Z' });

    expect(etaResponse.status).toBe(200);
    expect(etaResponse.body.data.etaEntry.stage).toBe('loading');

    const etaBeforeMoveIn = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/eta`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ stage: 'driver_coming', etaAt: '2026-08-31T10:00:00.000Z' });

    expect(etaBeforeMoveIn.status).toBe(400);
    expect(etaBeforeMoveIn.body.errors.code).toBe('MOVING_ETA_BEFORE_MOVE_IN');

    const forbiddenStatus = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/status`)
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({ status: 'driver_coming' });

    expect(forbiddenStatus.status).toBe(403);

    const skipAhead = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/status`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ status: 'loading' });

    expect(skipAhead.status).toBe(409);

    const operationalStatuses = [
      'driver_coming',
      'driver_arrived',
      'loading',
      'on_the_way',
      'unloading',
      'completed'
    ] as const;

    for (const status of operationalStatuses) {
      const response = await request(app)
        .post(`/api/v1/driver/requests/${movingRequestId}/status`)
        .set('Authorization', `Bearer ${driver1Token}`)
        .send({ status });

      expect(response.status).toBe(200);
      expect(response.body.data.movingRequest.status).toBe(status.toUpperCase());
    }

    const completionNotification = notifications.find((item) => item.title === 'Moving Request Completed');
    expect(completionNotification).toBeDefined();
  });

  it('requires cancellation reason and rejects ETA before move-in date', async () => {
    const createResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send(createMovingPayload());

    const movingRequestId = createResponse.body.data.movingRequest.id as string;

    await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/accept`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({});

    const cancelWithoutReason = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/status`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ status: 'cancelled' });

    expect(cancelWithoutReason.status).toBe(400);

    const cancelWithReason = await request(app)
      .post(`/api/v1/driver/requests/${movingRequestId}/status`)
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({ status: 'cancelled', notes: 'Customer rescheduled' });

    expect(cancelWithReason.status).toBe(200);
    expect(cancelWithReason.body.data.movingRequest.status).toBe('CANCELLED');
  });

  it('validates moving request payload with non-negative inventory counts and required fields', async () => {
    const invalidResponse = await request(app)
      .post('/api/v1/moving/requests')
      .set('Authorization', `Bearer ${requesterToken}`)
      .send({
        pickupAddress: '',
        dropoffAddress: '',
        pickupFloorLevelId: '',
        dropoffFloorLevelId: '',
        moveInDate: 'not-a-date',
        vehicleTypeId: '',
        photos: [],
        inventoryItems: [{ inventoryItemTypeId: '', count: -1 }]
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
  });

  describe('customer cancellation', () => {
    const createBooking = async () => {
      const response = await request(app)
        .post('/api/v1/moving/requests')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send(createMovingPayload());
      return response.body.data.movingRequest.id as string;
    };
    const cancel = (id: string, token = requesterToken) =>
      request(app).post(`/api/v1/moving/requests/${id}/cancel`).set('Authorization', `Bearer ${token}`).send();

    it('cancels a booking that is still waiting for a driver and keeps the record', async () => {
      const id = await createBooking();

      const response = await cancel(id);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Your booking has been cancelled successfully.');
      expect(response.body.data.movingRequest.status).toBe('CANCELLED');
      expect(response.body.data.movingRequest.orderNumber).toBeTruthy();
      const events = response.body.data.movingRequest.statusEvents as Array<{ status: string; actorUserId?: string }>;
      expect(events.at(-1)).toMatchObject({ status: MovingRequestStatus.CANCELLED });

      // A second request changes nothing.
      const again = await cancel(id);
      expect(again.status).toBe(409);
      expect(again.body.errors.code).toBe('MOVING_REQUEST_ALREADY_CANCELLED');
    });

    it('refuses once a driver has accepted, even through a direct API call', async () => {
      const id = await createBooking();
      await request(app).post(`/api/v1/driver/requests/${id}/accept`).set('Authorization', `Bearer ${driver1Token}`).send();

      const response = await cancel(id);

      expect(response.status).toBe(409);
      expect(response.body.errors.code).toBe('MOVING_REQUEST_NOT_CANCELLABLE');
      const after = await request(app).get(`/api/v1/moving/requests/${id}`).set('Authorization', `Bearer ${requesterToken}`);
      expect(after.body.data.movingRequest.status).toBe('ACCEPTED');
    });

    it('does not let another user cancel the booking', async () => {
      const id = await createBooking();

      const response = await cancel(id, outsiderToken);

      expect(response.status).toBe(403);
      const after = await request(app).get(`/api/v1/moving/requests/${id}`).set('Authorization', `Bearer ${requesterToken}`);
      expect(after.body.data.movingRequest.status).toBe('BOOKED');
    });

    it('keeps a cancelled booking away from drivers and admin assignment', async () => {
      const id = await createBooking();
      await cancel(id);

      const accept = await request(app).post(`/api/v1/driver/requests/${id}/accept`).set('Authorization', `Bearer ${driver1Token}`).send();
      expect(accept.status).toBe(409);

      const assign = await request(app)
        .post(`/api/v1/admin/moving/requests/${id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ driverUserId: 'driver-2' });
      expect(assign.status).toBe(409);
      expect(assign.body.errors.code).toBe('MOVING_REQUEST_NOT_ASSIGNABLE');
    });
  });

});
