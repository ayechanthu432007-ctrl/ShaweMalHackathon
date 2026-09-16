import {
  availableContactMethods,
  buildContactLink,
  buildKeywordWhere,
  expandSearchToken,
  findProhibitedKeywords,
  resolveSellerContactValues,
  sellerBadges
} from '../../src/services/marketplace-shared';
import { marketplaceVariantPaths } from '../../src/services/upload.service';

jest.mock('../../src/prisma/client', () => ({ prisma: {} }));

describe('marketplace moderation keywords', () => {
  it('flags prohibited items as whole words', () => {
    expect(findProhibitedKeywords('Selling an air gun', 'barely used')).toEqual(['gun']);
    expect(findProhibitedKeywords('ယာဘ ရောင်းမည်')).toEqual(['ယာဘ']);
  });

  it('does not flag ordinary household items that contain a keyword inside a word', () => {
    expect(findProhibitedKeywords('Burgundy sofa', 'Bought at a drugstore, has a shotgun-house style frame')).toEqual([]);
    expect(findProhibitedKeywords('Rice cooker, 1.8L', 'Works perfectly')).toEqual([]);
  });
});

describe('marketplace search', () => {
  it('expands common synonyms so related item types match', () => {
    expect(expandSearchToken('Fridge')).toEqual(['fridge', 'refrigerator']);
    expect(expandSearchToken('lamp')).toEqual(expect.arrayContaining(['lamp', 'light', 'lighting']));
    expect(expandSearchToken('bicycle')).toEqual(['bicycle']);
  });

  it('matches every keyword against title, description, category, subcategory, and location', () => {
    const where = buildKeywordWhere('study desk');
    expect(where?.AND).toHaveLength(2);

    const firstTokenFields = (where?.AND as Array<{ OR: Array<Record<string, unknown>> }>)[0]?.OR.map((clause) => Object.keys(clause)[0]);
    expect(firstTokenFields).toEqual(
      expect.arrayContaining(['title', 'description', 'locationDetail', 'category', 'subcategory', 'city', 'state'])
    );
    expect(buildKeywordWhere('   ')).toBeUndefined();
  });
});

describe('seller contact', () => {
  it('falls back to the account phone and respects seller-level hide switches', () => {
    const values = resolveSellerContactValues(
      { phone: null, telegramUsername: 'shwe_seller', viberNumber: '09123456789', showPhone: true, showTelegram: true, showViber: false },
      '09999999999'
    );

    expect(values).toEqual({ phone: '09999999999', telegram: 'shwe_seller', viber: null });
    expect(availableContactMethods({ showPhone: true, showTelegram: false, showViber: true }, values)).toEqual(['phone']);
  });

  it('builds deep links for each contact method', () => {
    expect(buildContactLink('telegram', '@shwe_seller')).toBe('https://t.me/shwe_seller');
    expect(buildContactLink('viber', '09 123 456 789')).toBe('viber://chat?number=%2B959123456789');
    expect(buildContactLink('phone', '09-123-456')).toBe('tel:09123456');
  });
});

describe('seller badges', () => {
  it('lists each earned badge separately instead of a single "verified" label', () => {
    expect(sellerBadges({ phoneVerifiedAt: new Date(), identityVerifiedAt: null, trustedSellerAt: null })).toEqual(['PHONE_VERIFIED']);
    expect(sellerBadges({ phoneVerifiedAt: new Date(), identityVerifiedAt: new Date(), trustedSellerAt: new Date() })).toEqual([
      'PHONE_VERIFIED',
      'IDENTITY_VERIFIED',
      'TRUSTED_SELLER'
    ]);
  });
});

describe('marketplace image variants', () => {
  it('stores optimized and thumbnail copies next to the original', () => {
    expect(marketplaceVariantPaths('uploads/marketplace/abc.jpg')).toEqual({
      optimizedPath: 'uploads/marketplace/abc_lg.webp',
      thumbnailPath: 'uploads/marketplace/abc_th.webp'
    });
  });
});
