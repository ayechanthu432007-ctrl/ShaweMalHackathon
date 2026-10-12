import request from 'supertest';
import sharp from 'sharp';

import { app } from '../../src/app';
import { prisma } from '../../src/prisma/client';
import { ensureUploadDirectories, toAbsoluteUploadPath } from '../../src/services/upload.service';
import { signJwt } from '../../src/utils/jwt';

jest.mock('../../src/prisma/client', () => {
  const model = () => ({
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn()
  });

  return {
    prisma: {
      user: model(),
      listing: model(),
      listingImage: model(),
      listingContactReveal: model(),
      listingReport: model(),
      marketplaceCategory: model(),
      city: model(),
      sellerContact: model(),
      ratingReview: model(),
      notification: model(),
      auditLog: model(),
      wishlist: model(),
      movingOutSale: model(),
      refreshSession: model(),
      $transaction: jest.fn()
    }
  };
});

const db = prisma as any;

const bearer = (userId: string, roles: string[] = ['normal']) =>
  `Bearer ${signJwt({ sub: userId, email: `${userId}@example.com`, roles }, '1h')}`;

const activeUser = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `User ${id}`,
  phone: '09111111111',
  accountStatus: 'ACTIVE',
  phoneVerifiedAt: new Date('2026-09-01'),
  identityVerifiedAt: null,
  trustedSellerAt: null,
  ...overrides
});

const validListingBody = {
  title: 'Wooden study desk',
  description: 'Solid wood desk, used for one year, no scratches.',
  categoryId: 'cat-study',
  subcategoryId: 'sub-desk',
  price: 85000,
  condition: 'GOOD',
  cityId: 'city-tamwe',
  locationDetail: 'Near Junction 8',
  pickupMethod: 'MEET_UP',
  images: ['uploads/marketplace/desk-1.jpg', 'uploads/marketplace/desk-2.jpg'],
  coverIndex: 1,
  showPhone: true,
  showTelegram: false,
  showViber: false,
  policyAccepted: true
};

beforeEach(() => {
  jest.resetAllMocks();
  db.notification.create.mockResolvedValue({});
  db.auditLog.create.mockResolvedValue({});
  db.ratingReview.groupBy.mockResolvedValue([]);
});

describe('marketplace listings - seller', () => {
  it('requires sign-in to create a listing', async () => {
    const response = await request(app).post('/api/v1/marketplace/me/listings').send(validListingBody);
    expect(response.status).toBe(401);
  });

  it('rejects a listing when the policy was not accepted', async () => {
    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send({ ...validListingBody, policyAccepted: false });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body.errors)).toContain('marketplace policy');
  });

  it('rejects more than 10 photos', async () => {
    const images = Array.from({ length: 11 }, (_, index) => `uploads/marketplace/p${index}.jpg`);
    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send({ ...validListingBody, images });

    expect(response.status).toBe(400);
  });

  it('still blocks suspended accounts from selling', async () => {
    db.user.findUnique.mockResolvedValue(activeUser('seller-1', { accountStatus: 'SUSPENDED' }));

    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send(validListingBody);

    expect(response.status).toBe(403);
    expect(response.body.errors.code).toBe('MARKETPLACE_ACCOUNT_RESTRICTED');
  });

  it('requires login to sell', async () => {
    const response = await request(app).post('/api/v1/marketplace/me/listings').send(validListingBody);

    expect(response.status).toBe(401);
  });

  const mockValidCatalog = () => {
    db.user.findUnique.mockResolvedValue(activeUser('seller-1'));
    db.marketplaceCategory.findFirst.mockResolvedValue({ id: 'cat-study', children: [{ id: 'sub-desk' }] });
    db.city.findFirst.mockResolvedValue({ id: 'city-tamwe', stateId: 'state-yangon' });
    db.sellerContact.findUnique.mockResolvedValue(null);
  };

  it('publishes a valid listing as ACTIVE with the chosen cover photo and image variants', async () => {
    mockValidCatalog();
    db.listing.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'listing-1',
      title: data.title,
      status: data.status,
      moderationStatus: data.moderationStatus
    }));

    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send(validListingBody);

    expect(response.status).toBe(201);
    expect(response.body.data.listing).toEqual({ id: 'listing-1', status: 'ACTIVE', moderationStatus: 'APPROVED' });

    const data = db.listing.create.mock.calls[0][0].data;
    expect(data.stateId).toBe('state-yangon');
    expect(data.publishedAt).toBeInstanceOf(Date);
    expect(data.images.create).toEqual([
      expect.objectContaining({ imagePath: 'uploads/marketplace/desk-1.jpg', displayOrder: 0, isCover: false }),
      expect.objectContaining({
        imagePath: 'uploads/marketplace/desk-2.jpg',
        thumbnailPath: 'uploads/marketplace/desk-2_th.webp',
        displayOrder: 1,
        isCover: true
      })
    ]);
  });

  it('lets a user without a verified phone publish immediately', async () => {
    mockValidCatalog();
    db.user.findUnique.mockResolvedValue(activeUser('seller-1', { phoneVerifiedAt: null }));
    db.listing.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'listing-3',
      title: data.title,
      status: data.status,
      moderationStatus: data.moderationStatus
    }));

    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send(validListingBody);

    expect(response.status).toBe(201);
    expect(response.body.data.listing).toEqual({ id: 'listing-3', status: 'ACTIVE', moderationStatus: 'APPROVED' });
    expect(db.listing.create.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
  });

  it('publishes listings mentioning prohibited items and flags them to admins', async () => {
    mockValidCatalog();
    db.user.findMany.mockResolvedValue([{ id: 'admin-1' }]);
    db.listing.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 'listing-2',
      title: data.title,
      status: data.status,
      moderationStatus: data.moderationStatus
    }));

    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send({ ...validListingBody, title: 'Desk and a spare pistol' });

    expect(response.status).toBe(201);
    expect(response.body.data.listing.moderationStatus).toBe('APPROVED');
    expect(db.listing.create.mock.calls[0][0].data.publishedAt).toBeInstanceOf(Date);
    expect(db.notification.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: 'admin-1', title: 'Marketplace listing flagged' })]
    });
  });

  it("refuses to edit or delete another user's listing", async () => {
    mockValidCatalog();
    db.user.findUnique.mockResolvedValue(activeUser('intruder-1'));
    db.listing.findUnique.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      status: 'ACTIVE',
      moderationStatus: 'APPROVED',
      publishedAt: new Date(),
      review: null
    });

    const edit = await request(app)
      .put('/api/v1/marketplace/me/listings/listing-1')
      .set('Authorization', bearer('intruder-1'))
      .send(validListingBody);
    expect(edit.status).toBe(403);
    expect(edit.body.errors.code).toBe('LISTING_FORBIDDEN');

    const remove = await request(app)
      .delete('/api/v1/marketplace/me/listings/listing-1')
      .set('Authorization', bearer('intruder-1'));
    expect(remove.status).toBe(403);

    expect(db.listing.update).not.toHaveBeenCalled();
    expect(db.listing.delete).not.toHaveBeenCalled();
  });

  it('requires a subcategory from the chosen category', async () => {
    mockValidCatalog();

    const response = await request(app)
      .post('/api/v1/marketplace/me/listings')
      .set('Authorization', bearer('seller-1'))
      .send({ ...validListingBody, subcategoryId: 'sub-fridge' });

    expect(response.status).toBe(400);
    expect(response.body.errors.code).toBe('LISTING_SUBCATEGORY_INVALID');
  });

  it("does not let a seller delete someone else's listing", async () => {
    db.listing.findUnique.mockResolvedValue({ id: 'listing-9', sellerId: 'other-seller', status: 'ACTIVE', moderationStatus: 'APPROVED', review: null });

    const response = await request(app)
      .delete('/api/v1/marketplace/me/listings/listing-9')
      .set('Authorization', bearer('seller-1'));

    expect(response.status).toBe(403);
    expect(db.listing.delete).not.toHaveBeenCalled();
  });

  it('only accepts a buyer who actually contacted the seller when marking sold', async () => {
    db.user.findUnique.mockResolvedValue(activeUser('seller-1'));
    db.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'ACTIVE', moderationStatus: 'APPROVED', review: null });
    db.listingContactReveal.findFirst.mockResolvedValue(null);

    const rejected = await request(app)
      .patch('/api/v1/marketplace/me/listings/listing-1/status')
      .set('Authorization', bearer('seller-1'))
      .send({ status: 'SOLD', buyerId: 'random-user' });

    expect(rejected.status).toBe(400);
    expect(rejected.body.errors.code).toBe('LISTING_BUYER_INVALID');

    db.listingContactReveal.findFirst.mockResolvedValue({ id: 'reveal-1' });
    db.listing.update.mockResolvedValue({});

    const accepted = await request(app)
      .patch('/api/v1/marketplace/me/listings/listing-1/status')
      .set('Authorization', bearer('seller-1'))
      .send({ status: 'SOLD', buyerId: 'buyer-1' });

    expect(accepted.status).toBe(200);
    expect(db.listing.update).toHaveBeenCalledWith({
      where: { id: 'listing-1' },
      data: expect.objectContaining({ status: 'SOLD', buyerId: 'buyer-1', soldAt: expect.any(Date) })
    });
  });
});

describe('marketplace listings - buyer', () => {
  it('requires sign-in before revealing seller contact details', async () => {
    const response = await request(app).get('/api/v1/marketplace/listings/listing-1/contact?method=phone');
    expect(response.status).toBe(401);
  });

  it('reveals contact through a button and records the interested buyer', async () => {
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'buyer-1' ? activeUser('buyer-1') : { phone: '09222222222', sellerContact: { phone: null, telegramUsername: 'desk_seller', viberNumber: null, showPhone: true, showTelegram: true, showViber: true } }
    );
    db.user.findUniqueOrThrow.mockResolvedValue({
      phone: '09222222222',
      sellerContact: { phone: null, telegramUsername: 'desk_seller', viberNumber: null, showPhone: true, showTelegram: true, showViber: true }
    });
    db.listing.findFirst.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'ACTIVE', showPhone: true, showTelegram: true, showViber: true });
    db.listingContactReveal.upsert.mockResolvedValue({});

    const response = await request(app)
      .get('/api/v1/marketplace/listings/listing-1/contact?method=telegram')
      .set('Authorization', bearer('buyer-1'));

    expect(response.status).toBe(200);
    expect(response.body.data.contact).toEqual({ method: 'telegram', value: 'desk_seller', link: 'https://t.me/desk_seller' });
    expect(db.listingContactReveal.upsert).toHaveBeenCalled();
  });

  it('does not reveal contact details for sold items', async () => {
    db.user.findUnique.mockResolvedValue(activeUser('buyer-1'));
    db.listing.findFirst.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', status: 'SOLD', showPhone: true, showTelegram: true, showViber: true });

    const response = await request(app)
      .get('/api/v1/marketplace/listings/listing-1/contact?method=phone')
      .set('Authorization', bearer('buyer-1'));

    expect(response.status).toBe(409);
    expect(response.body.errors.code).toBe('LISTING_SOLD');
  });

  it('only lets the recorded buyer of a sold item review the seller', async () => {
    db.user.findUnique.mockResolvedValue(activeUser('stranger'));
    db.listing.findUnique.mockResolvedValue({ id: 'listing-1', sellerId: 'seller-1', buyerId: 'buyer-1', status: 'SOLD', review: null });

    const response = await request(app)
      .post('/api/v1/marketplace/listings/listing-1/review')
      .set('Authorization', bearer('stranger'))
      .send({ rating: 1, comment: 'never bought this' });

    expect(response.status).toBe(403);
    expect(db.ratingReview.create).not.toHaveBeenCalled();
  });

  it('requires details when reporting with the Other reason', async () => {
    const response = await request(app)
      .post('/api/v1/marketplace/reports')
      .set('Authorization', bearer('buyer-1'))
      .send({ listingId: 'listing-1', reason: 'OTHER' });

    expect(response.status).toBe(400);
  });

  it('files a listing report against the listing seller', async () => {
    db.listing.findUnique.mockResolvedValue({ sellerId: 'seller-1' });
    db.listingReport.create.mockResolvedValue({ id: 'report-1', status: 'OPEN', createdAt: new Date() });

    const response = await request(app)
      .post('/api/v1/marketplace/reports')
      .set('Authorization', bearer('buyer-1'))
      .send({ listingId: 'listing-1', reason: 'SUSPICIOUS_PAYMENT', description: 'Asked me to pay a deposit first.' });

    expect(response.status).toBe(201);
    expect(db.listingReport.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ listingId: 'listing-1', reportedUserId: 'seller-1', reason: 'SUSPICIOUS_PAYMENT' })
    });
  });
});

describe('admin marketplace', () => {
  it('is restricted to admins', async () => {
    const response = await request(app).get('/api/v1/admin/marketplace/overview').set('Authorization', bearer('user-1'));
    expect(response.status).toBe(403);
  });

  it('returns the dashboard counters', async () => {
    db.listing.count.mockResolvedValueOnce(20).mockResolvedValueOnce(14).mockResolvedValueOnce(5).mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    db.user.count.mockResolvedValue(3);
    db.listingReport.count.mockResolvedValue(4);

    const response = await request(app).get('/api/v1/admin/marketplace/overview').set('Authorization', bearer('admin-1', ['admin']));

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      totalListings: 20,
      activeListings: 14,
      soldItems: 5,
      reportedListings: 2,
      suspendedSellers: 3,
      pendingReviews: 1,
      openReports: 4
    });
  });

  it('requires a reason when removing a listing', async () => {
    const response = await request(app)
      .patch('/api/v1/admin/marketplace/listings/listing-1/moderation')
      .set('Authorization', bearer('admin-1', ['admin']))
      .send({ action: 'remove' });

    expect(response.status).toBe(400);
  });

  it('refuses the Trusted Seller badge when the criteria are not met', async () => {
    db.user.findUnique.mockResolvedValue(activeUser('seller-1', { identityVerifiedAt: new Date() }));
    db.listing.count.mockResolvedValue(1);
    db.listingReport.count.mockResolvedValue(0);

    const response = await request(app)
      .patch('/api/v1/admin/marketplace/users/seller-1/verification')
      .set('Authorization', bearer('admin-1', ['admin']))
      .send({ trustedSeller: true });

    expect(response.status).toBe(400);
    expect(response.body.errors.code).toBe('TRUSTED_SELLER_NOT_ELIGIBLE');
    expect(response.body.errors.details.checks).toEqual({
      identityVerified: true,
      completedTransactions: false,
      goodReviews: false,
      noSeriousReports: true
    });
  });

  it('suspends an account, revokes sessions, and notifies the user', async () => {
    db.user.findUnique.mockResolvedValue({ ...activeUser('seller-1'), email: 's@example.com', profilePicturePath: null, createdAt: new Date(), sellerContact: null });
    db.user.update.mockResolvedValue({});
    db.refreshSession.updateMany.mockResolvedValue({ count: 1 });
    db.listing.findMany.mockResolvedValue([]);
    db.listing.count.mockResolvedValue(0);
    db.listingReport.findMany.mockResolvedValue([]);
    db.listingReport.count.mockResolvedValue(0);

    const response = await request(app)
      .patch('/api/v1/admin/marketplace/users/seller-1/status')
      .set('Authorization', bearer('admin-1', ['admin']))
      .send({ accountStatus: 'SUSPENDED', reason: 'Repeated scam reports' });

    expect(response.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'seller-1' },
      data: { accountStatus: 'SUSPENDED', trustedSellerAt: null }
    });
    expect(db.refreshSession.updateMany).toHaveBeenCalled();
    expect(db.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'seller-1', message: expect.stringContaining('Repeated scam reports') })
    });
  });
});

describe('marketplace photo uploads', () => {
  beforeAll(async () => {
    await ensureUploadDirectories();
  });

  it('stores the original plus optimized and thumbnail WebP copies', async () => {
    const photo = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: '#c08040' } }).jpeg().toBuffer();

    const response = await request(app)
      .post('/api/v1/uploads?category=marketplace')
      .set('Authorization', bearer('seller-1'))
      .attach('files', photo, { filename: 'desk.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(201);
    const original = response.body.data.paths[0] as string;
    expect(original).toMatch(/^uploads\/marketplace\/[a-f0-9-]+\.jpg$/);

    const optimized = await sharp(toAbsoluteUploadPath(original.replace('.jpg', '_lg.webp'))).metadata();
    const thumbnail = await sharp(toAbsoluteUploadPath(original.replace('.jpg', '_th.webp'))).metadata();
    expect(optimized).toMatchObject({ format: 'webp', width: 1600 });
    expect(thumbnail).toMatchObject({ format: 'webp', width: 400 });
  });

  it('rejects files that only claim to be images', async () => {
    const response = await request(app)
      .post('/api/v1/uploads?category=marketplace')
      .set('Authorization', bearer('seller-1'))
      .attach('files', Buffer.from('definitely not a jpeg'), { filename: 'fake.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body.errors.code).toBe('UPLOAD_INVALID_TYPE');
  });
});
