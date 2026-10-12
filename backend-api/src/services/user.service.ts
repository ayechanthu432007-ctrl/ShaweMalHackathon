import { prisma } from '../prisma/client';
import { ApiError } from '../utils/api-error';

interface CreateUserInput {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  /** Chosen at sign-up; accounts created by an admin may not have one. */
  occupationId?: string;
  roles?: string[];
}

type UserCreateTransaction = {
  role: {
    upsert: typeof prisma.role.upsert;
    findMany: typeof prisma.role.findMany;
  };
  user: {
    create: typeof prisma.user.create;
    update: typeof prisma.user.update;
  };
  userRole: {
    deleteMany: typeof prisma.userRole.deleteMany;
    createMany: typeof prisma.userRole.createMany;
  };
};

const USER_WITH_ROLES_INCLUDE = {
  userRoles: {
    include: {
      role: true
    }
  },
  agentProfile: {
    select: {
      verificationStatus: true
    }
  },
  driverProfile: {
    select: {
      verificationStatus: true
    }
  }
} as const;

export type UserWithRoles = {
  id: string;
  name: string;
  email: string;
  phone: string;
  userRoles: Array<{ role: { name: string } }>;
  agentProfile?: { verificationStatus: string } | null;
  driverProfile?: { verificationStatus: string } | null;
};

export const toSafeUser = (user: UserWithRoles) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  roles: user.userRoles.map((item) => item.role.name),
  agentVerificationStatus: user.agentProfile?.verificationStatus ?? null,
  driverVerificationStatus: user.driverProfile?.verificationStatus ?? null
});

export const getUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    include: USER_WITH_ROLES_INCLUDE
  });
};

export const getUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: USER_WITH_ROLES_INCLUDE
  });
};

export const createUserWithDefaultRole = async (input: CreateUserInput) => {
  const roleNames = input.roles && input.roles.length > 0 ? input.roles : ['normal'];

  return prisma.$transaction(async (tx) => {
    const transaction = tx as unknown as UserCreateTransaction;

    for (const roleName of roleNames) {
      await transaction.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName, code: roleName, isActive: true }
      });
    }

    const roles = await transaction.role.findMany({
      where: {
        name: {
          in: roleNames
        }
      }
    });

    if (roles.length !== roleNames.length) {
      throw new ApiError(400, 'ROLE_NOT_FOUND', 'One or more requested roles were not found.');
    }

    return transaction.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        passwordHash: input.passwordHash,
        ...(input.occupationId ? { occupationId: input.occupationId } : {}),
        userRoles: {
          create: roles.map((role) => ({ roleId: role.id }))
        }
      },
      include: USER_WITH_ROLES_INCLUDE
    });
  });
};

export const updateUserPassword = async (userId: string, passwordHash: string) => {
  return prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
    include: USER_WITH_ROLES_INCLUDE
  });
};

export const replaceUserRoles = async (userId: string, roleNames: string[]) => {
  return prisma.$transaction(async (tx) => {
    const transaction = tx as unknown as UserCreateTransaction;

    for (const roleName of roleNames) {
      await transaction.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName, code: roleName, isActive: true }
      });
    }

    const roles = await transaction.role.findMany({
      where: {
        name: {
          in: roleNames
        }
      }
    });

    if (roles.length !== roleNames.length) {
      throw new ApiError(400, 'ROLE_NOT_FOUND', 'One or more requested roles were not found.');
    }

    await transaction.userRole.deleteMany({
      where: { userId }
    });

    if (roles.length > 0) {
      await transaction.userRole.createMany({
        data: roles.map((role) => ({
          userId,
          roleId: role.id
        }))
      });
    }

    return transaction.user.update({
      where: { id: userId },
      data: {},
      include: USER_WITH_ROLES_INCLUDE
    });
  });
};

export const addUserRole = async (userId: string, roleName: string) => {
  const user = await getUserById(userId);
  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found.');
  }

  const hasRole = user.userRoles.some((item) => item.role.name === roleName);
  if (hasRole) {
    return user;
  }

  const role = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: { name: roleName, code: roleName, isActive: true }
  });

  return prisma.user.update({
    where: { id: userId },
    data: {
      userRoles: {
        create: {
          roleId: role.id
        }
      }
    },
    include: USER_WITH_ROLES_INCLUDE
  });
};
