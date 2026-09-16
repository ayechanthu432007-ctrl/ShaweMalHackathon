import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

import { resolveDatabaseUrls, toPrismaPgConfig } from '../src/config/database';

const { databaseUrl, target } = resolveDatabaseUrls();
const adapter = new PrismaPg(toPrismaPgConfig(databaseUrl, target));
const prisma = new PrismaClient({ adapter });

const seedRoles = async (): Promise<void> => {
  const roles = [
    { name: 'normal', description: 'Registered user with standard portal access.' },
    { name: 'agent', description: 'Housing agent who can publish listings after verification.' },
    { name: 'driver', description: 'Moving service driver who can accept jobs after verification.' },
    { name: 'admin', description: 'Administrator with access to the admin portal.' }
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        code: role.name,
        description: role.description,
        isActive: true
      },
      create: {
        name: role.name,
        code: role.name,
        description: role.description,
        isActive: true
      }
    });
  }
};

const seedStatusCodes = async (): Promise<void> => {
  const records = [
    { entityType: 'Agent', code: 'PENDING', label: 'Pending', color: '#f59e0b' },
    { entityType: 'Agent', code: 'VERIFIED', label: 'Verified', color: '#10b981' },
    { entityType: 'Agent', code: 'REJECTED', label: 'Rejected', color: '#ef4444' },
    { entityType: 'Driver', code: 'PENDING', label: 'Pending', color: '#f59e0b' },
    { entityType: 'Driver', code: 'VERIFIED', label: 'Verified', color: '#10b981' },
    { entityType: 'Driver', code: 'REJECTED', label: 'Rejected', color: '#ef4444' },
    { entityType: 'MovingRequest', code: 'BOOKED', label: 'Booked', color: '#f59e0b' },
    { entityType: 'MovingRequest', code: 'ACCEPTED', label: 'Accepted', color: '#3b82f6' },
    { entityType: 'MovingRequest', code: 'ASSIGNED', label: 'Assigned', color: '#8b5cf6' },
    { entityType: 'MovingRequest', code: 'DRIVER_COMING', label: 'Driver Coming', color: '#06b6d4' },
    { entityType: 'MovingRequest', code: 'DRIVER_ARRIVED', label: 'Driver Arrived', color: '#0ea5e9' },
    { entityType: 'MovingRequest', code: 'LOADING', label: 'Loading', color: '#14b8a6' },
    { entityType: 'MovingRequest', code: 'ON_THE_WAY', label: 'On the Way', color: '#22c55e' },
    { entityType: 'MovingRequest', code: 'UNLOADING', label: 'Unloading', color: '#84cc16' },
    { entityType: 'MovingRequest', code: 'COMPLETED', label: 'Completed', color: '#10b981' },
    { entityType: 'MovingRequest', code: 'CANCELLED', label: 'Cancelled', color: '#ef4444' }
  ];

  for (const record of records) {
    await prisma.statusCode.upsert({
      where: {
        entityType_code: {
          entityType: record.entityType,
          code: record.code
        }
      },
      update: {
        label: record.label,
        color: record.color,
        isActive: true
      },
      create: {
        entityType: record.entityType,
        code: record.code,
        label: record.label,
        color: record.color,
        isActive: true
      }
    });
  }

  await prisma.statusCode.updateMany({
    where: {
      entityType: 'MovingRequest',
      code: { in: ['PENDING', 'IN_PROGRESS'] }
    },
    data: { isActive: false }
  });
};

const YANGON_COUNTRY_CODE = 'MM';
const YANGON_STATE_NAME = 'Yangon';

const YANGON_TOWNSHIPS = [
  'Ahlon',
  'Bahan',
  'Botataung',
  'Dagon Seikkan',
  'Dagon',
  'Dala',
  'Dawbon',
  'East Dagon',
  'Hlaing',
  'Hlaingthaya East',
  'Hlaingthaya',
  'Insein',
  'Kamayut',
  'Kyauktada',
  'Kyimyindaing',
  'Lanmadaw',
  'Latha',
  'Mayangon',
  'Mingala Taungnyunt',
  'Mingaladon',
  'North Dagon',
  'North Okkalapa',
  'Pabedan',
  'Pazundaung',
  'Sanchaung',
  'Seikkan',
  'Seikkyi Kanaungto',
  'Shwepyitha',
  'South Dagon',
  'South Okkalapa',
  'Tamwe',
  'Thaketa',
  'Thingangyun',
  'Yankin'
] as const;

const seedYangonLocations = async (): Promise<void> => {
  const yangonState = await prisma.state.upsert({
    where: {
      name_countryCode: {
        name: YANGON_STATE_NAME,
        countryCode: YANGON_COUNTRY_CODE
      }
    },
    update: {
      isActive: true
    },
    create: {
      name: YANGON_STATE_NAME,
      countryCode: YANGON_COUNTRY_CODE,
      isActive: true
    }
  });

  for (const township of YANGON_TOWNSHIPS) {
    await prisma.city.updateMany({
      where: {
        name: `${township} Township`,
        stateId: yangonState.id
      },
      data: {
        name: township
      }
    });

    await prisma.city.upsert({
      where: {
        name_stateId: {
          name: township,
          stateId: yangonState.id
        }
      },
      update: {
        countryCode: YANGON_COUNTRY_CODE,
        isActive: true
      },
      create: {
        name: township,
        stateId: yangonState.id,
        countryCode: YANGON_COUNTRY_CODE,
        isActive: true
      }
    });
  }

  console.log(`Yangon locations seeded: 1 state, ${YANGON_TOWNSHIPS.length} townships`);
};

const seedPropertyTypes = async (): Promise<void> => {
  const propertyTypes = [
    'Apartment',
    'Condominium (Condo)',
    'Bungalow',
    'Detached House',
    'Semi-Detached House',
    'Townhouse',
    'Villa',
    'Duplex',
    'Terrace House',
    'Studio Apartment'
  ];

  for (const name of propertyTypes) {
    await prisma.propertyType.upsert({
      where: { name },
      update: {
        isActive: true
      },
      create: {
        name,
        isActive: true
      }
    });
  }

  console.log(`Property types seeded: ${propertyTypes.length}`);
};

const seedVehicleTypes = async (): Promise<void> => {
  const vehicleTypes = [
    { name: 'Motorcycle', size: 'Very Small', capacityLabel: '1–2 boxes', maxLoadKg: 100, pointFrom: 0, pointTo: 10, pricePerKm: 400 },
    { name: 'Motorbike with Trailer', size: 'Small', capacityLabel: '3–5 boxes', maxLoadKg: 200, pointFrom: 11, pointTo: 20, pricePerKm: 500 },
    { name: 'Tuk-Tuk / Three-Wheeler', size: 'Small', capacityLabel: '5–8 boxes', maxLoadKg: 300, pointFrom: 21, pointTo: 35, pricePerKm: 600 },
    { name: 'Mini Pickup', size: 'Small', capacityLabel: '8–12 boxes', maxLoadKg: 500, pointFrom: 36, pointTo: 50, pricePerKm: 700 },
    { name: 'Pickup Truck', size: 'Small', capacityLabel: '10–15 boxes', maxLoadKg: 750, pointFrom: 51, pointTo: 70, pricePerKm: 800 },
    { name: 'Small Van', size: 'Small', capacityLabel: '15–25 boxes', maxLoadKg: 1000, pointFrom: 71, pointTo: 95, pricePerKm: 900 },
    { name: 'Mini Truck', size: 'Medium', capacityLabel: '20–35 boxes', maxLoadKg: 1500, pointFrom: 96, pointTo: 130, pricePerKm: 1000 },
    { name: 'Light Truck', size: 'Medium', capacityLabel: '30–50 boxes', maxLoadKg: 2000, pointFrom: 131, pointTo: 170, pricePerKm: 1100 },
    { name: 'Box Truck', size: 'Medium', capacityLabel: '40–60 boxes', maxLoadKg: 2500, pointFrom: 171, pointTo: 210, pricePerKm: 1200 },
    { name: '10-ft Truck', size: 'Medium', capacityLabel: '50–70 boxes', maxLoadKg: 3000, pointFrom: 211, pointTo: 260, pricePerKm: 1300 },
    { name: '12-ft Truck', size: 'Large', capacityLabel: '60–90 boxes', maxLoadKg: 4000, pointFrom: 261, pointTo: 320, pricePerKm: 1400 },
    { name: '14-ft Truck', size: 'Large', capacityLabel: '70–100 boxes', maxLoadKg: 5000, pointFrom: 321, pointTo: 390, pricePerKm: 1500 },
    { name: '16-ft Truck', size: 'Large', capacityLabel: '80–120 boxes', maxLoadKg: 6000, pointFrom: 391, pointTo: 470, pricePerKm: 1600 },
    { name: '18-ft Truck', size: 'Large', capacityLabel: '100–140 boxes', maxLoadKg: 7000, pointFrom: 471, pointTo: 560, pricePerKm: 1700 },
    { name: '20-ft Truck', size: 'Extra Large', capacityLabel: '120–180 boxes', maxLoadKg: 8000, pointFrom: 561, pointTo: 660, pricePerKm: 1800 },
    { name: '22-ft Truck', size: 'Extra Large', capacityLabel: '140–200 boxes', maxLoadKg: 10000, pointFrom: 661, pointTo: 780, pricePerKm: 1900 },
    { name: '24-ft Truck', size: 'Extra Large', capacityLabel: '160–220 boxes', maxLoadKg: 12000, pointFrom: 781, pointTo: 920, pricePerKm: 2000 },
    { name: '26-ft Truck', size: 'Extra Large', capacityLabel: '180–250 boxes', maxLoadKg: 14000, pointFrom: 921, pointTo: 1080, pricePerKm: 2100 },
    { name: '30-ft Truck', size: 'Heavy Duty', capacityLabel: '220–300 boxes', maxLoadKg: 18000, pointFrom: 1081, pointTo: 1300, pricePerKm: 2200 },
    { name: 'Container Truck', size: 'Heavy Duty', capacityLabel: '250–350+ boxes', maxLoadKg: 20000, pointFrom: 1301, pointTo: 9999, pricePerKm: 2500 }
  ];

  for (const vehicleType of vehicleTypes) {
    await prisma.vehicleType.upsert({
      where: { name: vehicleType.name },
      update: {
        capacityLabel: vehicleType.capacityLabel,
        maxLoadKg: vehicleType.maxLoadKg,
        description: vehicleType.size,
        pointFrom: vehicleType.pointFrom,
        pointTo: vehicleType.pointTo,
        pricePerKm: vehicleType.pricePerKm,
        isActive: true
      },
      create: {
        name: vehicleType.name,
        capacityLabel: vehicleType.capacityLabel,
        maxLoadKg: vehicleType.maxLoadKg,
        description: vehicleType.size,
        pointFrom: vehicleType.pointFrom,
        pointTo: vehicleType.pointTo,
        pricePerKm: vehicleType.pricePerKm,
        isActive: true
      }
    });
  }

  console.log(`Vehicle types seeded: ${vehicleTypes.length}`);
};

/** §8.3 / MD-009 Amenities & Facilities */
const AMENITIES = [
  { name: 'AIR CONDITIONER', category: 'Utility' },
  { name: 'PARKING', category: 'Building' },
  { name: 'FURNISHED', category: 'General' },
  { name: 'WATER HEATER', category: 'Utility' },
  { name: 'FAN', category: 'General' },
  { name: 'TELEVISION', category: 'General' },
  { name: 'REFRIGERATOR', category: 'General' },
  { name: 'SOFA', category: 'General' },
  { name: 'DESK', category: 'General' },
  { name: 'KITCHEN STOVE', category: 'General' },
  { name: 'WIFI', category: 'Utility' },
  { name: 'PETS', category: 'General' },
  { name: 'SMOKING', category: 'General' },
  { name: 'LIFT', category: 'Building' },
  { name: 'POOL', category: 'Building' },
  { name: 'FITNESS', category: 'Building' },
  { name: 'SECURITY GUARD', category: 'Building' },
  { name: 'KEYCARD', category: 'Building' },
  { name: 'FINGERPRINT', category: 'Building' },
  { name: 'CCTV', category: 'Building' },
  { name: 'LAUNDRY', category: 'General' },
  { name: 'EV CHARGER', category: 'Utility' }
] as const;

const seedAmenities = async (): Promise<void> => {
  for (const amenity of AMENITIES) {
    await prisma.amenity.upsert({
      where: { name: amenity.name },
      update: {
        category: amenity.category,
        isActive: true
      },
      create: {
        name: amenity.name,
        category: amenity.category,
        isActive: true
      }
    });
  }

  console.log(`Amenities seeded: ${AMENITIES.length}`);
};

/** MD-007 Floor Level (Ground Floor through 20th Floor) */
const FLOOR_LEVELS = [
  { levelNumber: 0, name: 'Ground Floor' },
  { levelNumber: 1, name: '1st Floor' },
  { levelNumber: 2, name: '2nd Floor' },
  { levelNumber: 3, name: '3rd Floor' },
  { levelNumber: 4, name: '4th Floor' },
  { levelNumber: 5, name: '5th Floor' },
  { levelNumber: 6, name: '6th Floor' },
  { levelNumber: 7, name: '7th Floor' },
  { levelNumber: 8, name: '8th Floor' },
  { levelNumber: 9, name: '9th Floor' },
  { levelNumber: 10, name: '10th Floor' },
  { levelNumber: 11, name: '11th Floor' },
  { levelNumber: 12, name: '12th Floor' },
  { levelNumber: 13, name: '13th Floor' },
  { levelNumber: 14, name: '14th Floor' },
  { levelNumber: 15, name: '15th Floor' },
  { levelNumber: 16, name: '16th Floor' },
  { levelNumber: 17, name: '17th Floor' },
  { levelNumber: 18, name: '18th Floor' },
  { levelNumber: 19, name: '19th Floor' },
  { levelNumber: 20, name: '20th Floor' }
] as const;

const seedFloorLevels = async (): Promise<void> => {
  for (const floor of FLOOR_LEVELS) {
    await prisma.floorLevel.upsert({
      where: { name: floor.name },
      update: {
        levelNumber: floor.levelNumber,
        surchargeAmount: floor.levelNumber * 5000,
        isActive: true
      },
      create: {
        name: floor.name,
        levelNumber: floor.levelNumber,
        surchargeAmount: floor.levelNumber * 5000,
        isActive: true
      }
    });
  }

  console.log(`Floor levels seeded: ${FLOOR_LEVELS.length}`);
};

const MOVING_INVENTORY_ITEMS = [
  { code: 'bedroom_single_bed', category: 'bedroom', itemName: 'Single bed', points: 8 },
  { code: 'bedroom_couple_bed', category: 'bedroom', itemName: 'Couple bed', points: 12 },
  { code: 'bedroom_king_bed', category: 'bedroom', itemName: 'King bed', points: 15 },
  { code: 'bedroom_mattress', category: 'bedroom', itemName: 'Mattress', points: 6 },
  { code: 'bedroom_wardrobe', category: 'bedroom', itemName: 'Wardrobe', points: 14 },
  { code: 'bedroom_dressing_table', category: 'bedroom', itemName: 'Dressing table', points: 8 },
  { code: 'bedroom_bedside_table', category: 'bedroom', itemName: 'Bedside table', points: 4 },
  { code: 'bedroom_chair', category: 'bedroom', itemName: 'Chair', points: 3 },
  { code: 'bedroom_study_table', category: 'bedroom', itemName: 'Study table', points: 6 },
  { code: 'bedroom_bookshelf', category: 'bedroom', itemName: 'Bookshelf', points: 7 },
  { code: 'living_sofa_2', category: 'living', itemName: 'Sofa (2 seats)', points: 12 },
  { code: 'living_sofa_1', category: 'living', itemName: 'Sofa (1 seat)', points: 8 },
  { code: 'living_coffee_table', category: 'living', itemName: 'Coffee table', points: 5 },
  { code: 'living_tv', category: 'living', itemName: 'TV', points: 6 },
  { code: 'living_tv_stand', category: 'living', itemName: 'TV Stand', points: 5 },
  { code: 'living_shelf', category: 'living', itemName: 'Shelf', points: 5 },
  { code: 'living_fan', category: 'living', itemName: 'Fan', points: 3 },
  { code: 'living_air_conditioner', category: 'living', itemName: 'Air conditioner', points: 10 },
  { code: 'kitchen_refrigerator', category: 'kitchen', itemName: 'Refrigerator', points: 14 },
  { code: 'kitchen_microwave', category: 'kitchen', itemName: 'Microwave', points: 4 },
  { code: 'kitchen_rice_cooker', category: 'kitchen', itemName: 'Rice cooker', points: 2 },
  { code: 'kitchen_washing_machine', category: 'kitchen', itemName: 'Washing Machine', points: 12 },
  { code: 'kitchen_water_dispenser', category: 'kitchen', itemName: 'Water Dispenser', points: 6 },
  { code: 'kitchen_stove', category: 'kitchen', itemName: 'Stove', points: 5 },
  { code: 'kitchen_dining_table', category: 'kitchen', itemName: 'Dining table', points: 8 },
  { code: 'kitchen_dining_chair', category: 'kitchen', itemName: 'Dining chair', points: 2 },
  { code: 'office_desktop', category: 'office', itemName: 'Desktop Computers', points: 6 },
  { code: 'office_laptop', category: 'office', itemName: 'Laptop', points: 2 },
  { code: 'office_printer', category: 'office', itemName: 'Printer', points: 4 },
  { code: 'office_chair', category: 'office', itemName: 'Office chair', points: 3 },
  { code: 'office_desk', category: 'office', itemName: 'Office Desk', points: 7 },
  { code: 'other_bicycles', category: 'other', itemName: 'Bicycles', points: 8 },
  { code: 'other_motorcycle', category: 'other', itemName: 'Motorcycle', points: 16 },
  { code: 'other_plants', category: 'other', itemName: 'Plants', points: 2 },
  { code: 'other_boxes', category: 'other', itemName: 'Boxes', points: 2 }
] as const;

const seedMovingInventoryItems = async (): Promise<void> => {
  for (const [index, item] of MOVING_INVENTORY_ITEMS.entries()) {
    await prisma.movingInventoryItemType.upsert({
      where: { code: item.code },
      update: {
        category: item.category,
        itemName: item.itemName,
        points: item.points,
        sortOrder: index + 1,
        isActive: true
      },
      create: {
        code: item.code,
        category: item.category,
        itemName: item.itemName,
        points: item.points,
        sortOrder: index + 1,
        isActive: true
      }
    });
  }

  console.log(`Moving inventory items seeded: ${MOVING_INVENTORY_ITEMS.length}`);
};

const MARKETPLACE_CATEGORIES: Array<{ name: string; nameMy: string; slug: string; children: string[] }> = [
  {
    name: 'Furniture',
    nameMy: 'ပရိဘောဂ',
    slug: 'furniture',
    children: ['Bed', 'Mattress', 'Wardrobe', 'Table', 'Chair', 'Sofa', 'Shelf', 'Desk']
  },
  {
    name: 'Electronics',
    nameMy: 'လျှပ်စစ်ပစ္စည်း',
    slug: 'electronics',
    children: ['Laptop', 'Monitor', 'Phone', 'Refrigerator', 'TV', 'Fan', 'Washing machine', 'Rice cooker', 'Other electronics']
  },
  {
    name: 'Bedroom',
    nameMy: 'အိပ်ခန်းသုံးပစ္စည်း',
    slug: 'bedroom',
    children: ['Bedding', 'Pillow', 'Blanket', 'Curtains', 'Storage']
  },
  {
    name: 'Kitchen',
    nameMy: 'မီးဖိုချောင်သုံးပစ္စည်း',
    slug: 'kitchen',
    children: ['Cooking equipment', 'Kitchenware', 'Refrigerator', 'Microwave', 'Rice cooker']
  },
  {
    name: 'Study',
    nameMy: 'စာကြည့်ပစ္စည်း',
    slug: 'study',
    children: ['Desk', 'Chair', 'Books', 'Stationery', 'Bookshelf']
  },
  {
    name: 'Home Essentials',
    nameMy: 'အိမ်သုံးပစ္စည်း',
    slug: 'home-essentials',
    children: ['Lighting', 'Cleaning supplies', 'Storage', 'Decoration']
  },
  {
    name: 'Bags & Relocation',
    nameMy: 'အိတ်နှင့် အိမ်ပြောင်းပစ္စည်း',
    slug: 'bags-relocation',
    children: ['Suitcases', 'Travel bags', 'Moving boxes', 'Storage boxes']
  },
  {
    name: 'Other',
    nameMy: 'အခြား',
    slug: 'other',
    children: []
  }
];

const toSlug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const seedMarketplaceCategories = async (): Promise<void> => {
  let childCount = 0;

  for (const [parentIndex, category] of MARKETPLACE_CATEGORIES.entries()) {
    const parent = await prisma.marketplaceCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, nameMy: category.nameMy, sortOrder: parentIndex, parentId: null, isActive: true },
      create: { name: category.name, nameMy: category.nameMy, slug: category.slug, sortOrder: parentIndex, isActive: true }
    });

    for (const [childIndex, childName] of category.children.entries()) {
      // Subcategory slugs are prefixed with the parent because names repeat (e.g. Desk under Furniture and Study).
      const slug = `${category.slug}-${toSlug(childName)}`;
      await prisma.marketplaceCategory.upsert({
        where: { slug },
        update: { name: childName, parentId: parent.id, sortOrder: childIndex, isActive: true },
        create: { name: childName, slug, parentId: parent.id, sortOrder: childIndex, isActive: true }
      });
      childCount += 1;
    }
  }

  console.log(`Marketplace categories seeded: ${MARKETPLACE_CATEGORIES.length} categories, ${childCount} subcategories`);
};

const seedAdminUser = async (): Promise<void> => {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@shawemal.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123456';
  const name = process.env.SEED_ADMIN_NAME ?? 'ShweMal Admin';
  const phone = process.env.SEED_ADMIN_PHONE ?? '09000000001';
  const saltRounds = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

  if (!Number.isInteger(saltRounds) || saltRounds <= 0) {
    throw new Error('BCRYPT_SALT_ROUNDS must be a positive integer.');
  }

  const adminRole = await prisma.role.findUnique({
    where: { name: 'admin' }
  });

  if (!adminRole) {
    throw new Error('Admin role not found. seedRoles must run before seedAdminUser.');
  }

  const passwordHash = await bcrypt.hash(password, saltRounds);

  const existingUser = await prisma.user.findUnique({
    where: { email },
    include: {
      userRoles: true
    }
  });

  if (existingUser) {
    const hasAdminRole = existingUser.userRoles.some((entry) => entry.roleId === adminRole.id);

    if (!hasAdminRole) {
      await prisma.userRole.create({
        data: {
          userId: existingUser.id,
          roleId: adminRole.id
        }
      });
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        name,
        phone,
        passwordHash,
        isActive: true,
        accountStatus: 'ACTIVE',
        phoneVerifiedAt: existingUser.phoneVerifiedAt ?? new Date()
      }
    });

    console.log(`Admin user updated: ${email}`);
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      passwordHash,
      isActive: true,
      phoneVerifiedAt: new Date(),
      userRoles: {
        create: {
          roleId: adminRole.id
        }
      }
    }
  });

  console.log(`Admin user created: ${email}`);
};

const main = async (): Promise<void> => {
  await seedRoles();
  await seedStatusCodes();
  await seedYangonLocations();
  await seedPropertyTypes();
  await seedVehicleTypes();
  await seedAmenities();
  await seedFloorLevels();
  await seedMovingInventoryItems();
  await seedMarketplaceCategories();
  await seedAdminUser();
};

main()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
