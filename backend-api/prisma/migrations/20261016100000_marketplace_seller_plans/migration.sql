-- Marketplace seller plans, product boosts, product views and buyer inquiries.
-- Additive only: no existing rows are changed or removed.

-- AlterTable
ALTER TABLE "SubscriptionPlan" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'AGENT',
ADD COLUMN "activeListingLimit" INTEGER,
ADD COLUMN "homepageFeatured" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN "listingId" TEXT;

-- CreateTable
CREATE TABLE "SellerSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingMonths" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SellerSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingBoost" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingEvent" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "signedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingInquiry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "message" VARCHAR(1000) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "sellerReply" VARCHAR(1000),
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SellerSubscription_paymentOrderId_key" ON "SellerSubscription"("paymentOrderId");
CREATE INDEX "SellerSubscription_userId_endsAt_idx" ON "SellerSubscription"("userId", "endsAt");
CREATE UNIQUE INDEX "ListingBoost_paymentOrderId_key" ON "ListingBoost"("paymentOrderId");
CREATE INDEX "ListingBoost_listingId_endsAt_idx" ON "ListingBoost"("listingId", "endsAt");
CREATE INDEX "ListingBoost_userId_endsAt_idx" ON "ListingBoost"("userId", "endsAt");
CREATE INDEX "ListingBoost_subscriptionId_idx" ON "ListingBoost"("subscriptionId");
CREATE UNIQUE INDEX "ListingEvent_listingId_type_visitorKey_day_key" ON "ListingEvent"("listingId", "type", "visitorKey", "day");
CREATE INDEX "ListingEvent_sellerId_day_idx" ON "ListingEvent"("sellerId", "day");
CREATE INDEX "ListingEvent_listingId_day_idx" ON "ListingEvent"("listingId", "day");
CREATE UNIQUE INDEX "ListingInquiry_listingId_buyerId_key" ON "ListingInquiry"("listingId", "buyerId");
CREATE INDEX "ListingInquiry_sellerId_status_createdAt_idx" ON "ListingInquiry"("sellerId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerSubscription" ADD CONSTRAINT "SellerSubscription_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "SellerSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingBoost" ADD CONSTRAINT "ListingBoost_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ListingEvent" ADD CONSTRAINT "ListingEvent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInquiry" ADD CONSTRAINT "ListingInquiry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInquiry" ADD CONSTRAINT "ListingInquiry_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingInquiry" ADD CONSTRAINT "ListingInquiry_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the two Marketplace seller plans (reference: Free Seller 0 MMK, Premium Seller 90,000 MMK / month).
INSERT INTO "SubscriptionPlan" ("id", "code", "name", "rank", "monthlyPriceMmk", "quarterlyPriceMmk", "monthlyListingLimit", "freeBoostDays", "badgeEligible", "performanceLevel", "audience", "activeListingLimit", "homepageFeatured", "updatedAt") VALUES
  ('plan_seller_free',    'SELLER_FREE',    'Free Seller',    0,     0, 0, NULL, 0, false, 'BASIC',    'SELLER', 5,    false, CURRENT_TIMESTAMP),
  ('plan_seller_premium', 'SELLER_PREMIUM', 'Premium Seller', 1, 90000, 0, NULL, 3, true,  'DETAILED', 'SELLER', NULL, true,  CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Paid product boost price per day in MMK. Demo value: set the real price before launch.
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('LISTING_BOOST_PRICE_PER_DAY_MMK', '2000', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
