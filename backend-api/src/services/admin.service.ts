import { Prisma, VerificationStatus } from '@prisma/client';

import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';
import { hashPassword } from '../utils/password';
import { writeAuditLog } from './audit.service';
import { createUserWithDefaultRole, getUserById, replaceUserRoles, toSafeUser } from './user.service';

interface AdminCreateUserInput {
  actorUserId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'normal' | 'agent' | 'driver' | 'admin';
}

interface UpdateRolesInput {
  actorUserId: string;
  userId: string;
  roles: Array<'normal' | 'agent' | 'driver' | 'admin'>;
}

interface UpdateVerificationInput {
  actorUserId: string;
  userId: string;
  role: 'agent' | 'driver';
  status: 'pending' | 'approve' | 'reject';
  rejectionReason?: string | null;
}

export interface ListVerificationsInput {
  status?: VerificationStatus | 'all';
  q?: string;
  page: number;
  pageSize: number;
}

const hasRole = (roles: string[], target: string): boolean => {
  return roles.includes(target);
};

const normalizeVerificationStatus = (status: UpdateVerificationInput['status']): VerificationStatus => {
  if (status === 'approve') {
    return 'VERIFIED';
  }

  if (status === 'reject') {
    return 'REJECTED';
  }

  return 'PENDING';
};

const containsQuery = (q: string) => ({
  contains: q
});

const resolveListStatus = (status?: VerificationStatus | 'all'): VerificationStatus | undefined => {
  if (!status || status === 'PENDING') {
    return 'PENDING';
  }

  if (status === 'all') {
    return undefined;
  }

  return status;
};

const paginated = <T>(items: T[], page: number, pageSize: number, total: number) => ({
  items,
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize))
});

const notifyVerificationDecision = async (
  userId: string,
  role: 'agent' | 'driver',
  status: VerificationStatus,
  rejectionReason?: string | null
) => {
  if (status === 'PENDING') {
    return;
  }

  const roleLabel = role === 'agent' ? 'Agent' : 'Driver';
  const approvedMessage =
    role === 'agent'
      ? 'Your agent registration was approved. You can now post housing listings.'
      : 'Your driver registration was approved. You are now eligible for assigned moving jobs.';
  const rejectedMessage = rejectionReason?.trim()
    ? `Your ${role} registration was rejected. Reason: ${rejectionReason.trim()}`
    : `Your ${role} registration was rejected.`;

  await prisma.notification.create({
    data: {
      userId,
      title: `${roleLabel} Registration ${status === 'VERIFIED' ? 'Approved' : 'Rejected'}`,
      message: status === 'VERIFIED' ? approvedMessage : rejectedMessage
    }
  });
};

export const adminCreateUser = async (input: AdminCreateUserInput) => {
  const passwordHash = await hashPassword(input.password);

  const user = await createUserWithDefaultRole({
    name: input.name,
    email: input.email,
    phone: input.phone,
    passwordHash,
    roles: [input.role]
  });

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: 'ADMIN_USER_CREATED',
    targetType: 'User',
    targetId: user.id,
    metadata: {
      role: input.role
    }
  });

  return user;
};

export const adminUpdateUserRoles = async (input: UpdateRolesInput) => {
  const targetUser = await getUserById(input.userId);
  if (!targetUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const updated = await replaceUserRoles(input.userId, input.roles);

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: 'ADMIN_ROLE_UPDATED',
    targetType: 'User',
    targetId: input.userId,
    metadata: {
      roles: input.roles
    }
  });

  return updated;
};

export const adminUpdateVerification = async (input: UpdateVerificationInput) => {
  const targetUser = await getUserById(input.userId);
  if (!targetUser) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const targetRoles = targetUser.userRoles.map((item) => item.role.name);
  if (!hasRole(targetRoles, input.role)) {
    throw new ApiError(400, 'USER_ROLE_MISMATCH', `Target user does not have ${input.role} role.`);
  }

  const verificationStatus = normalizeVerificationStatus(input.status);
  const rejectionReason =
    verificationStatus === 'REJECTED' ? input.rejectionReason?.trim() || null : null;
  const reviewedAt = verificationStatus === 'PENDING' ? null : new Date();

  if (input.role === 'agent') {
    const profile = await prisma.agentProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true }
    });

    if (!profile) {
      throw new ApiError(404, 'AGENT_PROFILE_NOT_FOUND', 'Agent registration profile was not found for this user.');
    }

    await prisma.agentProfile.update({
      where: { userId: input.userId },
      data: {
        verificationStatus,
        rejectionReason,
        reviewedAt
      }
    });
  } else {
    const profile = await prisma.driverProfile.findUnique({
      where: { userId: input.userId },
      select: { id: true }
    });

    if (!profile) {
      throw new ApiError(404, 'DRIVER_PROFILE_NOT_FOUND', 'Driver registration profile was not found for this user.');
    }

    await prisma.driverProfile.update({
      where: { userId: input.userId },
      data: {
        verificationStatus,
        rejectionReason,
        reviewedAt
      }
    });
  }

  const updated = await getUserById(input.userId);
  if (!updated) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  await writeAuditLog({
    actorUserId: input.actorUserId,
    action: `ADMIN_${input.role.toUpperCase()}_VERIFICATION_UPDATED`,
    targetType: 'User',
    targetId: input.userId,
    metadata: {
      role: input.role,
      verificationStatus,
      rejectionReason
    }
  });

  await notifyVerificationDecision(input.userId, input.role, verificationStatus, rejectionReason);

  return updated;
};

export const listAdminAgentRegistrations = async (input: ListVerificationsInput) => {
  const status = resolveListStatus(input.status);
  const q = input.q?.trim();
  const skip = (input.page - 1) * input.pageSize;

  const where: Prisma.AgentProfileWhereInput = {
    ...(status ? { verificationStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { name: containsQuery(q) },
            { nrc: containsQuery(q) },
            { email: containsQuery(q) },
            { phone: containsQuery(q) },
            { user: { name: containsQuery(q) } },
            { user: { email: containsQuery(q) } },
            { user: { phone: containsQuery(q) } }
          ]
        }
      : {})
  };

  const [profiles, total] = await Promise.all([
    prisma.agentProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        city: { select: { id: true, name: true } },
        state: { select: { id: true, name: true } },
        serviceRegion: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.pageSize
    }),
    prisma.agentProfile.count({ where })
  ]);

  return paginated(
    profiles.map((profile) => ({
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      phone: profile.user.phone,
      nrc: profile.nrc,
      city: profile.city,
      state: profile.state,
      serviceRegion: profile.serviceRegion,
      hasRentingExperience: profile.hasRentingExperience,
      submittedAt: profile.createdAt,
      verificationStatus: profile.verificationStatus
    })),
    input.page,
    input.pageSize,
    total
  );
};

export const listAdminDriverRegistrations = async (input: ListVerificationsInput) => {
  const status = resolveListStatus(input.status);
  const q = input.q?.trim();
  const skip = (input.page - 1) * input.pageSize;

  const where: Prisma.DriverProfileWhereInput = {
    ...(status ? { verificationStatus: status } : {}),
    ...(q
      ? {
          OR: [
            { name: containsQuery(q) },
            { nrc: containsQuery(q) },
            { phone: containsQuery(q) },
            { vehicleLicensePlateNumber: containsQuery(q) },
            { user: { name: containsQuery(q) } },
            { user: { email: containsQuery(q) } },
            { user: { phone: containsQuery(q) } }
          ]
        }
      : {})
  };

  const [profiles, total] = await Promise.all([
    prisma.driverProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        vehicleType: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: input.pageSize
    }),
    prisma.driverProfile.count({ where })
  ]);

  return paginated(
    profiles.map((profile) => ({
      userId: profile.userId,
      name: profile.user.name,
      email: profile.user.email,
      phone: profile.user.phone,
      nrc: profile.nrc,
      companyName: profile.companyName,
      vehicleType: profile.vehicleType,
      vehicleLicensePlateNumber: profile.vehicleLicensePlateNumber,
      submittedAt: profile.createdAt,
      verificationStatus: profile.verificationStatus
    })),
    input.page,
    input.pageSize,
    total
  );
};

export const getAdminAgentRegistration = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: true } },
      agentProfile: {
        include: {
          city: { select: { id: true, name: true } },
          state: { select: { id: true, name: true } },
          serviceRegion: { select: { id: true, name: true } }
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
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (!user.agentProfile) {
    throw new ApiError(404, 'AGENT_PROFILE_NOT_FOUND', 'Agent registration profile was not found for this user.');
  }

  return {
    user: toSafeUser(user),
    profile: {
      id: user.agentProfile.id,
      name: user.agentProfile.name,
      nrc: user.agentProfile.nrc,
      nrcFrontPhotoPath: user.agentProfile.nrcFrontPhotoPath,
      nrcBackPhotoPath: user.agentProfile.nrcBackPhotoPath,
      profilePhotoPath: user.profilePicturePath,
      email: user.agentProfile.email,
      phone: user.agentProfile.phone,
      telegram: user.agentProfile.telegram,
      viber: user.agentProfile.viber,
      address1: user.agentProfile.address1,
      address2: user.agentProfile.address2,
      cityId: user.agentProfile.cityId,
      stateId: user.agentProfile.stateId,
      serviceRegionId: user.agentProfile.serviceRegionId,
      city: user.agentProfile.city,
      state: user.agentProfile.state,
      serviceRegion: user.agentProfile.serviceRegion,
      hasRentingExperience: user.agentProfile.hasRentingExperience,
      verificationStatus: user.agentProfile.verificationStatus,
      rejectionReason: user.agentProfile.rejectionReason,
      reviewedAt: user.agentProfile.reviewedAt,
      submittedAt: user.agentProfile.createdAt
    }
  };
};

export const getAdminDriverRegistration = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: { include: { role: true } },
      driverProfile: {
        include: {
          vehicleType: { select: { id: true, name: true } }
        }
      },
      agentProfile: {
        select: {
          verificationStatus: true
        }
      }
    }
  });

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  if (!user.driverProfile) {
    throw new ApiError(404, 'DRIVER_PROFILE_NOT_FOUND', 'Driver registration profile was not found for this user.');
  }

  return {
    user: toSafeUser(user),
    profile: {
      id: user.driverProfile.id,
      name: user.driverProfile.name,
      companyName: user.driverProfile.companyName,
      nrc: user.driverProfile.nrc,
      nrcFrontPhotoPath: user.driverProfile.nrcFrontPhotoPath,
      nrcBackPhotoPath: user.driverProfile.nrcBackPhotoPath,
      drivingLicensePhotoPath: user.driverProfile.drivingLicensePhotoPath,
      profilePhotoPath: user.driverProfile.profilePhotoPath,
      phone: user.driverProfile.phone,
      currentAddress: user.driverProfile.currentAddress,
      vehicleTypeId: user.driverProfile.vehicleTypeId,
      vehicleType: user.driverProfile.vehicleType,
      vehicleLicensePlateNumber: user.driverProfile.vehicleLicensePlateNumber,
      vehiclePhotoPath: user.driverProfile.vehiclePhotoPath,
      wheelTaxPhotoPath: user.driverProfile.wheelTaxPhotoPath,
      verificationStatus: user.driverProfile.verificationStatus,
      rejectionReason: user.driverProfile.rejectionReason,
      reviewedAt: user.driverProfile.reviewedAt,
      submittedAt: user.driverProfile.createdAt
    }
  };
};
