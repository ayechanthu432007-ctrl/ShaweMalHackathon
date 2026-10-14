import { MovingRequestStatus, MovingStatusEventType, Prisma } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import {
  geocodeAddress,
  haversineKm,
  isWithinYangon,
  parseOptionalGeoPoint,
  type GeoPoint
} from './geocode.service';
import { calculateEstimatedPrice, suggestVehicleType } from './moving-quote';
import { toMyReview } from './review.service';

interface AuthActor {
  userId: string;
  roles: string[];
}

interface CreateMovingRequestInventoryItemInput {
  inventoryItemTypeId: string;
  count: number;
}

interface QuoteMovingRequestInput {
  pickupAddress: string;
  dropoffAddress: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  pickupFloorLevelId: string;
  dropoffFloorLevelId: string;
  inventoryItems: CreateMovingRequestInventoryItemInput[];
  vehicleTypeId?: string;
}

interface CreateMovingRequestInput extends QuoteMovingRequestInput {
  moveInDate: Date;
  remarks?: string;
  damageChecklist?: string;
  photos: string[];
}

interface RejectMovingRequestInput {
  movingRequestId: string;
  driverUserId: string;
  notes?: string;
}

interface AddMovingEtaInput {
  movingRequestId: string;
  driverUserId: string;
  stage: string;
  etaAt: Date;
  notes?: string;
}

interface UpdateMovingStatusInput {
  movingRequestId: string;
  driverUserId: string;
  status:
    | 'DRIVER_COMING'
    | 'DRIVER_ARRIVED'
    | 'LOADING'
    | 'ON_THE_WAY'
    | 'UNLOADING'
    | 'COMPLETED'
    | 'CANCELLED';
  notes?: string;
}

const DRIVER_STATUS_SEQUENCE: UpdateMovingStatusInput['status'][] = [
  MovingRequestStatus.DRIVER_COMING,
  MovingRequestStatus.DRIVER_ARRIVED,
  MovingRequestStatus.LOADING,
  MovingRequestStatus.ON_THE_WAY,
  MovingRequestStatus.UNLOADING,
  MovingRequestStatus.COMPLETED
];

interface AssignMovingRequestInput {
  movingRequestId: string;
  driverUserId: string;
  actorUserId: string;
}

const movingRequestArgs = Prisma.validator<Prisma.MovingRequestDefaultArgs>()({
  include: {
    requester: {
      select: {
        id: true,
        name: true,
        phone: true,
        email: true
      }
    },
    assignedDriver: {
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        driverProfile: {
          select: {
            name: true,
            phone: true,
            profilePhotoPath: true,
            vehicleLicensePlateNumber: true
          }
        }
      }
    },
    vehicleType: {
      select: {
        id: true,
        name: true,
        capacityLabel: true,
        maxLoadKg: true,
        pointFrom: true,
        pointTo: true,
        pricePerKm: true
      }
    },
    pickupFloorLevel: {
      select: {
        id: true,
        name: true,
        levelNumber: true,
        surchargeAmount: true
      }
    },
    dropoffFloorLevel: {
      select: {
        id: true,
        name: true,
        levelNumber: true,
        surchargeAmount: true
      }
    },
    photos: {
      select: {
        id: true,
        photoPath: true,
        sortOrder: true,
        createdAt: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    },
    inventoryItems: {
      select: {
        id: true,
        inventoryItemTypeId: true,
        category: true,
        itemName: true,
        count: true,
        pointsPerItem: true,
        linePoints: true,
        createdAt: true
      },
      orderBy: [{ category: 'asc' }, { itemName: 'asc' }]
    },
    statusEvents: {
      select: {
        id: true,
        actorUserId: true,
        eventType: true,
        status: true,
        notes: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    },
    etaEntries: {
      select: {
        id: true,
        driverUserId: true,
        stage: true,
        etaAt: true,
        notes: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    },
    ratingReview: {
      select: {
        id: true,
        rating: true,
        comment: true,
        reviewerUserId: true
      }
    }
  }
});

type MovingRequestWithDetails = Prisma.MovingRequestGetPayload<typeof movingRequestArgs>;

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
};

const normalizeMovingRequest = (request: MovingRequestWithDetails, viewerUserId?: string) => ({
  id: request.id,
  orderNumber: request.orderNumber,
  status: request.status,
  pickupAddress: request.pickupAddress,
  dropoffAddress: request.dropoffAddress,
  pickupLatitude: decimalToNumber(request.pickupLatitude),
  pickupLongitude: decimalToNumber(request.pickupLongitude),
  dropoffLatitude: decimalToNumber(request.dropoffLatitude),
  dropoffLongitude: decimalToNumber(request.dropoffLongitude),
  distanceKm: decimalToNumber(request.distanceKm),
  moveInDate: request.moveInDate,
  remarks: request.remarks,
  damageChecklist: request.damageChecklist,
  totalInventoryPoints: request.totalInventoryPoints,
  estimatedPrice: decimalToNumber(request.estimatedPrice),
  pricePerKmUsed: decimalToNumber(request.pricePerKmUsed),
  pickupFloorSurcharge: decimalToNumber(request.pickupFloorSurcharge),
  dropoffFloorSurcharge: decimalToNumber(request.dropoffFloorSurcharge),
  estimatedEarnings: decimalToNumber(request.estimatedEarnings),
  acceptedAt: request.acceptedAt,
  requester: request.requester,
  assignedDriver: request.assignedDriver,
  vehicleType: request.vehicleType
    ? {
        ...request.vehicleType,
        pricePerKm: decimalToNumber(request.vehicleType.pricePerKm)
      }
    : request.vehicleType,
  pickupFloorLevel: request.pickupFloorLevel
    ? {
        ...request.pickupFloorLevel,
        surchargeAmount: decimalToNumber(request.pickupFloorLevel.surchargeAmount)
      }
    : request.pickupFloorLevel,
  dropoffFloorLevel: request.dropoffFloorLevel
    ? {
        ...request.dropoffFloorLevel,
        surchargeAmount: decimalToNumber(request.dropoffFloorLevel.surchargeAmount)
      }
    : request.dropoffFloorLevel,
  photos: request.photos,
  inventoryItems: request.inventoryItems,
  statusEvents: request.statusEvents,
  etaEntries: request.etaEntries,
  myReview: viewerUserId ? toMyReview(request.ratingReview, viewerUserId) : null,
  createdAt: request.createdAt,
  updatedAt: request.updatedAt
});

const ensureDriverVerified = async (driverUserId: string): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: {
      id: driverUserId
    },
    include: {
      userRoles: {
        include: {
          role: true
        }
      },
      driverProfile: {
        select: {
          verificationStatus: true
        }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'DRIVER_NOT_FOUND', 'Driver user not found.');
  }

  const roles = user.userRoles.map((item) => item.role.name);
  if (!roles.includes('driver')) {
    throw new ApiError(403, 'DRIVER_ROLE_REQUIRED', 'Driver role is required.');
  }

  if (user.driverProfile?.verificationStatus !== 'VERIFIED') {
    throw new ApiError(403, 'DRIVER_NOT_VERIFIED', 'Driver must be verified to perform this action.');
  }
};

const ensureRequestAssignedToDriver = async (movingRequestId: string, driverUserId: string) => {
  const movingRequest = await prisma.movingRequest.findUnique({
    where: {
      id: movingRequestId
    },
    select: {
      id: true,
      status: true,
      assignedDriverUserId: true,
      moveInDate: true
    }
  });

  if (!movingRequest) {
    throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
  }

  if (movingRequest.assignedDriverUserId !== driverUserId) {
    throw new ApiError(403, 'MOVING_REQUEST_DRIVER_FORBIDDEN', 'Only the assigned driver can update this moving request.');
  }

  return movingRequest;
};

const notifyVerifiedDriversForNewRequest = async (movingRequestId: string) => {
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
      id: true
    }
  });

  if (verifiedDrivers.length === 0) {
    return;
  }

  await prisma.notification.createMany({
    data: verifiedDrivers.map((driver) => ({
      userId: driver.id,
      title: 'New Moving Request',
      message: `New moving request ${movingRequestId} is available for acceptance.`
    }))
  });
};

const notifyRequester = async (requesterUserId: string, title: string, message: string) => {
  await prisma.notification.create({
    data: {
      userId: requesterUserId,
      title,
      message
    }
  });
};

const calculateEstimatedEarnings = (
  inventoryItems: Array<{ count: number }>,
  vehicleType: { maxLoadKg: number | null; name: string }
): number => {
  const itemCount = inventoryItems.reduce((sum, item) => sum + item.count, 0);
  const baseRate = vehicleType.maxLoadKg ? Math.max(vehicleType.maxLoadKg / 10, 5000) : 8000;
  return Math.round(baseRate + itemCount * 1500);
};

const toDecimalNumber = (value: Prisma.Decimal | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
};

const generateOrderNumber = async (): Promise<string> => {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const dayStart = new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
  const count = await prisma.movingRequest.count({
    where: {
      createdAt: {
        gte: dayStart
      }
    }
  });

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const sequence = String(count + 1 + attempt).padStart(6, '0');
    const orderNumber = `MOV-${ymd}-${sequence}`;
    const existing = await prisma.movingRequest.findUnique({
      where: { orderNumber },
      select: { id: true }
    });
    if (!existing) {
      return orderNumber;
    }
  }

  return `MOV-${ymd}-${Date.now().toString().slice(-6)}`;
};

const loadFloorLevel = async (floorLevelId: string, field: 'pickup' | 'dropoff') => {
  const floor = await prisma.floorLevel.findUnique({
    where: { id: floorLevelId },
    select: {
      id: true,
      name: true,
      levelNumber: true,
      surchargeAmount: true,
      isActive: true
    }
  });

  if (!floor || !floor.isActive) {
    throw new ApiError(
      400,
      'FLOOR_LEVEL_NOT_AVAILABLE',
      `${field === 'pickup' ? 'Pickup' : 'Drop-off'} floor level is invalid or inactive.`
    );
  }

  return floor;
};

const resolveInventoryLines = async (inventoryItems: CreateMovingRequestInventoryItemInput[]) => {
  const typeIds = [...new Set(inventoryItems.map((item) => item.inventoryItemTypeId))];
  const types = await prisma.movingInventoryItemType.findMany({
    where: {
      id: { in: typeIds },
      isActive: true
    }
  });
  const typesById = new Map(types.map((item) => [item.id, item]));

  const lines = inventoryItems
    .filter((item) => item.count > 0)
    .map((item) => {
      const catalogItem = typesById.get(item.inventoryItemTypeId);
      if (!catalogItem) {
        throw new ApiError(400, 'INVENTORY_ITEM_TYPE_NOT_AVAILABLE', 'Inventory item type is invalid or inactive.');
      }

      const pointsPerItem = catalogItem.points;
      const linePoints = pointsPerItem * item.count;
      return {
        inventoryItemTypeId: catalogItem.id,
        category: catalogItem.category,
        itemName: catalogItem.itemName,
        count: item.count,
        pointsPerItem,
        linePoints
      };
    });

  if (lines.length === 0) {
    throw new ApiError(400, 'INVENTORY_REQUIRED', 'Total inventory items must be greater than zero.');
  }

  const totalInventoryPoints = lines.reduce((sum, item) => sum + item.linePoints, 0);
  const totalItemCount = lines.reduce((sum, item) => sum + item.count, 0);

  return { lines, totalInventoryPoints, totalItemCount };
};

const resolveQuotePoint = async (
  address: string,
  latitude?: number | null,
  longitude?: number | null
): Promise<GeoPoint> => {
  const provided = parseOptionalGeoPoint(latitude ?? null, longitude ?? null);
  if (provided) {
    if (!isWithinYangon(provided)) {
      throw new ApiError(
        400,
        'ADDRESS_GEOCODE_FAILED',
        'Map pins must be inside the Yangon service area.'
      );
    }
    return provided;
  }

  return geocodeAddress(address);
};

const resolveQuote = async (input: QuoteMovingRequestInput) => {
  const { lines, totalInventoryPoints } = await resolveInventoryLines(input.inventoryItems);
  const pickupFloor = await loadFloorLevel(input.pickupFloorLevelId, 'pickup');
  const dropoffFloor = await loadFloorLevel(input.dropoffFloorLevelId, 'dropoff');

  const vehicleTypes = await prisma.vehicleType.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      isActive: true,
      capacityLabel: true,
      maxLoadKg: true,
      pointFrom: true,
      pointTo: true,
      pricePerKm: true
    }
  });

  let suggestion: ReturnType<typeof suggestVehicleType>;
  try {
    suggestion = suggestVehicleType(
      totalInventoryPoints,
      vehicleTypes.map((item) => ({
        id: item.id,
        name: item.name,
        pointFrom: item.pointFrom,
        pointTo: item.pointTo,
        pricePerKm: decimalToNumber(item.pricePerKm)
      }))
    );
  } catch {
    throw new ApiError(400, 'VEHICLE_TYPE_NOT_AVAILABLE', 'No vehicle types with point ranges are available.');
  }

  const selectedId = input.vehicleTypeId?.trim() || suggestion.vehicle.id;
  const selectedVehicle = vehicleTypes.find((item) => item.id === selectedId);
  if (!selectedVehicle || !selectedVehicle.isActive) {
    throw new ApiError(400, 'VEHICLE_TYPE_NOT_AVAILABLE', 'Vehicle type is invalid or inactive.');
  }

  const pricePerKm = decimalToNumber(selectedVehicle.pricePerKm);
  if (pricePerKm === null || !Number.isFinite(pricePerKm) || pricePerKm < 0) {
    throw new ApiError(400, 'VEHICLE_TYPE_NOT_AVAILABLE', 'Selected vehicle type is missing PricePerKM.');
  }

  const pickupPoint: GeoPoint = await resolveQuotePoint(
    input.pickupAddress,
    input.pickupLatitude,
    input.pickupLongitude
  );
  const dropoffPoint: GeoPoint = await resolveQuotePoint(
    input.dropoffAddress,
    input.dropoffLatitude,
    input.dropoffLongitude
  );
  const distanceKm = haversineKm(pickupPoint, dropoffPoint);
  const pickupFloorSurcharge = toDecimalNumber(pickupFloor.surchargeAmount);
  const dropoffFloorSurcharge = toDecimalNumber(dropoffFloor.surchargeAmount);
  const estimatedPrice = calculateEstimatedPrice({
    pickupFloorSurcharge,
    dropoffFloorSurcharge,
    pricePerKm,
    distanceKm
  });

  return {
    lines,
    totalInventoryPoints,
    pickupFloor,
    dropoffFloor,
    suggestedVehicleType: {
      id: suggestion.vehicle.id,
      name: suggestion.vehicle.name,
      pointFrom: suggestion.vehicle.pointFrom,
      pointTo: suggestion.vehicle.pointTo,
      pricePerKm: suggestion.vehicle.pricePerKm,
      match: suggestion.match
    },
    selectedVehicle,
    pricePerKm,
    pickupPoint,
    dropoffPoint,
    distanceKm,
    pickupFloorSurcharge,
    dropoffFloorSurcharge,
    estimatedPrice
  };
};

export const quoteMovingRequest = async (input: QuoteMovingRequestInput) => {
  const quote = await resolveQuote(input);

  return {
    pickupAddress: input.pickupAddress,
    dropoffAddress: input.dropoffAddress,
    pickupFloorLevel: {
      id: quote.pickupFloor.id,
      name: quote.pickupFloor.name,
      levelNumber: quote.pickupFloor.levelNumber,
      surchargeAmount: quote.pickupFloorSurcharge
    },
    dropoffFloorLevel: {
      id: quote.dropoffFloor.id,
      name: quote.dropoffFloor.name,
      levelNumber: quote.dropoffFloor.levelNumber,
      surchargeAmount: quote.dropoffFloorSurcharge
    },
    distanceKm: quote.distanceKm,
    totalInventoryPoints: quote.totalInventoryPoints,
    inventoryItems: quote.lines,
    suggestedVehicleType: quote.suggestedVehicleType,
    selectedVehicleType: {
      id: quote.selectedVehicle.id,
      name: quote.selectedVehicle.name,
      capacityLabel: quote.selectedVehicle.capacityLabel,
      maxLoadKg: quote.selectedVehicle.maxLoadKg,
      pointFrom: quote.selectedVehicle.pointFrom,
      pointTo: quote.selectedVehicle.pointTo,
      pricePerKm: quote.pricePerKm
    },
    pricePerKm: quote.pricePerKm,
    pickupFloorSurcharge: quote.pickupFloorSurcharge,
    dropoffFloorSurcharge: quote.dropoffFloorSurcharge,
    estimatedPrice: quote.estimatedPrice
  };
};

export const createMovingRequest = async (requesterUserId: string, input: CreateMovingRequestInput) => {
  const quote = await resolveQuote(input);
  const estimatedEarnings = calculateEstimatedEarnings(quote.lines, quote.selectedVehicle);
  const orderNumber = await generateOrderNumber();

  const movingRequest = await prisma.movingRequest.create({
    data: {
      orderNumber,
      requesterUserId,
      status: MovingRequestStatus.BOOKED,
      vehicleTypeId: quote.selectedVehicle.id,
      pickupFloorLevelId: quote.pickupFloor.id,
      dropoffFloorLevelId: quote.dropoffFloor.id,
      pickupAddress: input.pickupAddress,
      dropoffAddress: input.dropoffAddress,
      pickupLatitude: new Prisma.Decimal(quote.pickupPoint.latitude),
      pickupLongitude: new Prisma.Decimal(quote.pickupPoint.longitude),
      dropoffLatitude: new Prisma.Decimal(quote.dropoffPoint.latitude),
      dropoffLongitude: new Prisma.Decimal(quote.dropoffPoint.longitude),
      distanceKm: new Prisma.Decimal(quote.distanceKm),
      moveInDate: input.moveInDate,
      remarks: input.remarks,
      damageChecklist: input.damageChecklist,
      totalInventoryPoints: quote.totalInventoryPoints,
      estimatedPrice: new Prisma.Decimal(quote.estimatedPrice),
      pricePerKmUsed: new Prisma.Decimal(quote.pricePerKm),
      pickupFloorSurcharge: new Prisma.Decimal(quote.pickupFloorSurcharge),
      dropoffFloorSurcharge: new Prisma.Decimal(quote.dropoffFloorSurcharge),
      estimatedEarnings: new Prisma.Decimal(estimatedEarnings),
      photos: {
        create: input.photos.map((photoPath, index) => ({
          photoPath,
          sortOrder: index + 1
        }))
      },
      inventoryItems: {
        create: quote.lines.map((item) => ({
          inventoryItemTypeId: item.inventoryItemTypeId,
          category: item.category,
          itemName: item.itemName,
          count: item.count,
          pointsPerItem: item.pointsPerItem,
          linePoints: item.linePoints
        }))
      },
      statusEvents: {
        create: {
          actorUserId: requesterUserId,
          eventType: MovingStatusEventType.CREATED,
          status: MovingRequestStatus.BOOKED,
          notes: 'Moving request created by requester.'
        }
      }
    },
    include: movingRequestArgs.include
  });

  await notifyVerifiedDriversForNewRequest(movingRequest.orderNumber);

  return normalizeMovingRequest(movingRequest, requesterUserId);
};

export const getMovingRequestById = async (movingRequestId: string, actor: AuthActor) => {
  const movingRequest = await prisma.movingRequest.findUnique({
    where: {
      id: movingRequestId
    },
    include: movingRequestArgs.include
  });

  if (!movingRequest) {
    throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
  }

  const isOwner = movingRequest.requesterUserId === actor.userId;
  const isAssignedDriver = movingRequest.assignedDriverUserId === actor.userId;
  const isAdmin = actor.roles.includes('admin');

  if (isOwner || isAssignedDriver || isAdmin) {
    return normalizeMovingRequest(movingRequest, actor.userId);
  }

  // Verified drivers can open available pending jobs (same pool as listAvailable).
  const isAvailableForDrivers =
    movingRequest.status === MovingRequestStatus.BOOKED && movingRequest.assignedDriverUserId === null;

  if (actor.roles.includes('driver') && isAvailableForDrivers) {
    await ensureDriverVerified(actor.userId);

    const rejectedByDriver = await prisma.movingStatusEvent.findFirst({
      where: {
        movingRequestId,
        actorUserId: actor.userId,
        eventType: MovingStatusEventType.REJECTED
      },
      select: { id: true }
    });

    if (!rejectedByDriver) {
      return normalizeMovingRequest(movingRequest, actor.userId);
    }
  }

  throw new ApiError(403, 'MOVING_REQUEST_FORBIDDEN', 'You are not allowed to view this moving request.');
};

export const listMyMovingRequests = async (requesterUserId: string) => {
  const requests = await prisma.movingRequest.findMany({
    where: {
      requesterUserId
    },
    include: movingRequestArgs.include,
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return requests.map((request) => normalizeMovingRequest(request, requesterUserId));
};

interface AdminMovingRequestReportOptions {
  from?: Date;
  to?: Date;
  status?: MovingRequestStatus;
}

export const listAdminMovingRequests = async (options: AdminMovingRequestReportOptions = {}) => {
  const where: {
    createdAt?: { gte?: Date; lte?: Date };
    status?: MovingRequestStatus;
  } = {};

  if (options.from || options.to) {
    where.createdAt = {
      gte: options.from,
      lte: options.to
    };
  }

  if (options.status) {
    where.status = options.status;
  }

  const requests = await prisma.movingRequest.findMany({
    where,
    include: movingRequestArgs.include,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return requests.map((request) => normalizeMovingRequest(request));
};

type AdminAssignableRequestCandidate = {
  status: MovingRequestStatus;
  assignedDriverUserId: string | null;
  statusEvents?: Array<{
    status: MovingRequestStatus | null;
    actorUserId: string | null;
    createdAt: Date | string;
  }>;
};

const isDriverCancelledMovingRequest = (request: AdminAssignableRequestCandidate): boolean => {
  if (request.status !== MovingRequestStatus.CANCELLED || !request.assignedDriverUserId) {
    return false;
  }

  const cancelEvents = [...(request.statusEvents ?? [])]
    .filter((event) => event.status === MovingRequestStatus.CANCELLED)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
  const lastCancel = cancelEvents[cancelEvents.length - 1];

  return Boolean(lastCancel?.actorUserId && lastCancel.actorUserId === request.assignedDriverUserId);
};

export const isAdminAssignableMovingRequest = (request: AdminAssignableRequestCandidate): boolean => {
  if (request.status === MovingRequestStatus.BOOKED && request.assignedDriverUserId === null) {
    return true;
  }

  return isDriverCancelledMovingRequest(request);
};

export const listAdminAssignableMovingRequests = async (orderNumber?: string) => {
  const query = orderNumber?.trim();
  const requests = await prisma.movingRequest.findMany({
    where: {
      status: {
        in: [MovingRequestStatus.BOOKED, MovingRequestStatus.CANCELLED]
      },
      ...(query
        ? {
            orderNumber: {
              contains: query
            }
          }
        : {})
    },
    include: movingRequestArgs.include,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return requests.filter(isAdminAssignableMovingRequest).map((request) => normalizeMovingRequest(request));
};

export const listAdminAssignableDrivers = async () => {
  const drivers = await prisma.user.findMany({
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
      email: true,
      phone: true,
      driverProfile: {
        select: {
          name: true,
          phone: true,
          vehicleLicensePlateNumber: true,
          vehicleType: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }
    },
    orderBy: {
      name: 'asc'
    }
  });

  return drivers.map((driver) => ({
    userId: driver.id,
    name: driver.driverProfile?.name || driver.name,
    email: driver.email,
    phone: driver.driverProfile?.phone || driver.phone,
    vehicleTypeName: driver.driverProfile?.vehicleType?.name ?? null,
    vehicleLicensePlateNumber: driver.driverProfile?.vehicleLicensePlateNumber ?? null
  }));
};

export const listAvailableMovingRequestsForDriver = async (driverUserId: string) => {
  await ensureDriverVerified(driverUserId);

  const requests = await prisma.movingRequest.findMany({
    where: {
      status: MovingRequestStatus.BOOKED,
      assignedDriverUserId: null,
      statusEvents: {
        none: {
          actorUserId: driverUserId,
          eventType: MovingStatusEventType.REJECTED
        }
      }
    },
    include: movingRequestArgs.include,
    orderBy: {
      createdAt: 'desc'
    }
  });

  return requests.map((request) => normalizeMovingRequest(request, driverUserId));
};

const DRIVER_ASSIGNED_TERMINAL_STATUSES: MovingRequestStatus[] = [
  MovingRequestStatus.COMPLETED,
  MovingRequestStatus.CANCELLED
];

export const listAssignedMovingRequestsForDriver = async (driverUserId: string) => {
  await ensureDriverVerified(driverUserId);

  const requests = await prisma.movingRequest.findMany({
    where: {
      assignedDriverUserId: driverUserId,
      status: {
        notIn: DRIVER_ASSIGNED_TERMINAL_STATUSES
      }
    },
    include: movingRequestArgs.include,
    orderBy: {
      updatedAt: 'desc'
    }
  });

  return requests.map((request) => normalizeMovingRequest(request, driverUserId));
};

export const acceptMovingRequest = async (movingRequestId: string, driverUserId: string) => {
  await ensureDriverVerified(driverUserId);

  const movingRequest = await prisma.$transaction(async (tx) => {
    const updateResult = await tx.movingRequest.updateMany({
      where: {
        id: movingRequestId,
        status: MovingRequestStatus.BOOKED,
        assignedDriverUserId: null
      },
      data: {
        status: MovingRequestStatus.ACCEPTED,
        assignedDriverUserId: driverUserId,
        acceptedAt: new Date()
      }
    });

    if (updateResult.count === 0) {
      const existing = await tx.movingRequest.findUnique({
        where: {
          id: movingRequestId
        },
        select: {
          id: true,
          status: true,
          assignedDriverUserId: true
        }
      });

      if (!existing) {
        throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
      }

      throw new ApiError(
        409,
        'MOVING_REQUEST_ALREADY_ACCEPTED',
        'Moving request has already been accepted or assigned by another driver.'
      );
    }

    await tx.movingStatusEvent.create({
      data: {
        movingRequestId,
        actorUserId: driverUserId,
        eventType: MovingStatusEventType.ACCEPTED,
        status: MovingRequestStatus.ACCEPTED,
        notes: 'Moving request accepted by driver.'
      }
    });

    const updated = await tx.movingRequest.findUnique({
      where: {
        id: movingRequestId
      },
      include: movingRequestArgs.include
    });

    if (!updated) {
      throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
    }

    return updated;
  });

  await notifyRequester(
    movingRequest.requesterUserId,
    'Moving Request Accepted',
    `Your moving request ${movingRequest.orderNumber} has been accepted by a driver.`
  );

  return normalizeMovingRequest(movingRequest);
};

/**
 * The customer cancels their own booking. Allowed only while it is still waiting for a driver
 * (BOOKED with nobody assigned). The check and the change are one conditional update, so a driver
 * accepting at the same moment either wins (and the cancel is refused) or loses (and cannot accept).
 */
export const cancelMovingRequestByRequester = async (movingRequestId: string, requesterUserId: string) => {
  const existing = await prisma.movingRequest.findUnique({
    where: { id: movingRequestId },
    select: { id: true, requesterUserId: true, status: true }
  });

  if (!existing) {
    throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
  }
  if (existing.requesterUserId !== requesterUserId) {
    throw new ApiError(403, 'MOVING_REQUEST_FORBIDDEN', 'You can cancel only your own moving bookings.');
  }
  if (existing.status === MovingRequestStatus.CANCELLED) {
    throw new ApiError(409, 'MOVING_REQUEST_ALREADY_CANCELLED', 'This moving booking is already cancelled.');
  }

  const movingRequest = await prisma.$transaction(async (tx) => {
    const result = await tx.movingRequest.updateMany({
      where: {
        id: movingRequestId,
        requesterUserId,
        status: MovingRequestStatus.BOOKED,
        assignedDriverUserId: null
      },
      data: { status: MovingRequestStatus.CANCELLED }
    });

    if (result.count === 0) {
      throw new ApiError(
        409,
        'MOVING_REQUEST_NOT_CANCELLABLE',
        'A driver has already been assigned, so this booking can no longer be cancelled here.'
      );
    }

    await tx.movingStatusEvent.create({
      data: {
        movingRequestId,
        actorUserId: requesterUserId,
        eventType: MovingStatusEventType.STATUS_UPDATED,
        status: MovingRequestStatus.CANCELLED,
        notes: 'Cancelled by the customer before a driver was assigned.'
      }
    });

    const updated = await tx.movingRequest.findUnique({
      where: { id: movingRequestId },
      include: movingRequestArgs.include
    });
    if (!updated) {
      throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
    }
    return updated;
  });

  return normalizeMovingRequest(movingRequest);
};

export const rejectMovingRequest = async (input: RejectMovingRequestInput) => {
  await ensureDriverVerified(input.driverUserId);

  const movingRequest = await prisma.movingRequest.findUnique({
    where: {
      id: input.movingRequestId
    },
    select: {
      id: true
    }
  });

  if (!movingRequest) {
    throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
  }

  await prisma.movingStatusEvent.create({
    data: {
      movingRequestId: input.movingRequestId,
      actorUserId: input.driverUserId,
      eventType: MovingStatusEventType.REJECTED,
      status: null,
      notes: input.notes
    }
  });
};

export const addMovingEta = async (input: AddMovingEtaInput) => {
  await ensureDriverVerified(input.driverUserId);
  const current = await ensureRequestAssignedToDriver(input.movingRequestId, input.driverUserId);

  if (input.etaAt.getTime() < current.moveInDate.getTime()) {
    throw new ApiError(
      400,
      'MOVING_ETA_BEFORE_MOVE_IN',
      'ETA time cannot be earlier than the move-in date.'
    );
  }

  const etaEntry = await prisma.$transaction(async (tx) => {
    const created = await tx.movingEtaEntry.create({
      data: {
        movingRequestId: input.movingRequestId,
        driverUserId: input.driverUserId,
        stage: input.stage,
        etaAt: input.etaAt,
        notes: input.notes
      }
    });

    await tx.movingStatusEvent.create({
      data: {
        movingRequestId: input.movingRequestId,
        actorUserId: input.driverUserId,
        eventType: MovingStatusEventType.ETA_UPDATED,
        status: null,
        notes: `ETA updated for stage: ${input.stage}`
      }
    });

    return created;
  });

  return etaEntry;
};

const assertStatusTransition = (
  currentStatus: MovingRequestStatus,
  nextStatus: UpdateMovingStatusInput['status']
): void => {
  if (
    currentStatus === MovingRequestStatus.COMPLETED ||
    currentStatus === MovingRequestStatus.CANCELLED
  ) {
    throw new ApiError(409, 'MOVING_REQUEST_FINALIZED', 'Moving request is already finalized.');
  }

  if (nextStatus === MovingRequestStatus.CANCELLED) {
    return;
  }

  const expectedFromAccepted =
    (currentStatus === MovingRequestStatus.ACCEPTED || currentStatus === MovingRequestStatus.ASSIGNED) &&
    nextStatus === MovingRequestStatus.DRIVER_COMING;

  if (expectedFromAccepted) {
    return;
  }

  const currentIndex = DRIVER_STATUS_SEQUENCE.indexOf(currentStatus as UpdateMovingStatusInput['status']);
  const nextIndex = DRIVER_STATUS_SEQUENCE.indexOf(nextStatus);

  if (currentIndex === -1 || nextIndex !== currentIndex + 1) {
    throw new ApiError(
      409,
      'MOVING_STATUS_INVALID_TRANSITION',
      'Moving request status must advance one operational step at a time.'
    );
  }
};

export const updateMovingStatus = async (input: UpdateMovingStatusInput) => {
  await ensureDriverVerified(input.driverUserId);

  const current = await ensureRequestAssignedToDriver(input.movingRequestId, input.driverUserId);
  assertStatusTransition(current.status, input.status);

  if (input.status === MovingRequestStatus.CANCELLED) {
    const reason = input.notes?.trim();
    if (!reason) {
      throw new ApiError(
        400,
        'MOVING_CANCEL_REASON_REQUIRED',
        'Cancellation reason is required when cancelling a moving request.'
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const movingRequest = await tx.movingRequest.update({
      where: {
        id: input.movingRequestId
      },
      data: {
        status: input.status
      },
      include: movingRequestArgs.include
    });

    await tx.movingStatusEvent.create({
      data: {
        movingRequestId: input.movingRequestId,
        actorUserId: input.driverUserId,
        eventType: MovingStatusEventType.STATUS_UPDATED,
        status: input.status,
        notes: input.notes
      }
    });

    return movingRequest;
  });

  if (input.status === MovingRequestStatus.COMPLETED) {
    await notifyRequester(
      updated.requesterUserId,
      'Moving Request Completed',
      `Your moving request ${updated.orderNumber} has been marked as completed.`
    );
  }

  return normalizeMovingRequest(updated);
};

export const assignMovingRequestByAdmin = async (input: AssignMovingRequestInput) => {
  await ensureDriverVerified(input.driverUserId);

  const movingRequest = await prisma.$transaction(async (tx) => {
    const existing = await tx.movingRequest.findUnique({
      where: {
        id: input.movingRequestId
      },
      include: {
        statusEvents: {
          select: {
            status: true,
            actorUserId: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!existing) {
      throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
    }

    if (!isAdminAssignableMovingRequest(existing)) {
      throw new ApiError(
        409,
        'MOVING_REQUEST_NOT_ASSIGNABLE',
        'Admin assignment is allowed only for booked unassigned jobs or jobs cancelled by the assigned driver.'
      );
    }

    // Conditional on the state checked above, so a customer cancelling meanwhile is never overwritten.
    const assignResult = await tx.movingRequest.updateMany({
      where: {
        id: input.movingRequestId,
        status: existing.status,
        assignedDriverUserId: existing.assignedDriverUserId
      },
      data: {
        status: MovingRequestStatus.ASSIGNED,
        assignedDriverUserId: input.driverUserId
      }
    });

    if (assignResult.count === 0) {
      throw new ApiError(409, 'MOVING_REQUEST_NOT_ASSIGNABLE', 'This moving request changed before it could be assigned.');
    }

    await tx.movingStatusEvent.create({
      data: {
        movingRequestId: input.movingRequestId,
        actorUserId: input.actorUserId,
        eventType: MovingStatusEventType.ASSIGNED,
        status: MovingRequestStatus.ASSIGNED,
        notes: `Assigned by admin to driver ${input.driverUserId}.`
      }
    });

    const updated = await tx.movingRequest.findUnique({
      where: {
        id: input.movingRequestId
      },
      include: movingRequestArgs.include
    });

    if (!updated) {
      throw new ApiError(404, 'MOVING_REQUEST_NOT_FOUND', 'Moving request not found.');
    }

    return updated;
  });

  await Promise.all([
    notifyRequester(
      movingRequest.requesterUserId,
      'Moving Request Assigned',
      `Your moving request ${movingRequest.orderNumber} was assigned by admin.`
    ),
    prisma.notification.create({
      data: {
        userId: input.driverUserId,
        title: 'Moving Request Assigned',
        message: `You were assigned to moving request ${movingRequest.orderNumber}.`
      }
    })
  ]);

  return normalizeMovingRequest(movingRequest);
};
