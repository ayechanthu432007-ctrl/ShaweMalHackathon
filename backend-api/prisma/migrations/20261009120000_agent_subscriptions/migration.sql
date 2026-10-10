-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 0,
    "monthlyPriceMmk" INTEGER NOT NULL DEFAULT 0,
    "quarterlyPriceMmk" INTEGER NOT NULL DEFAULT 0,
    "monthlyListingLimit" INTEGER,
    "freeBoostDays" INTEGER NOT NULL DEFAULT 0,
    "badgeEligible" BOOLEAN NOT NULL DEFAULT false,
    "performanceLevel" TEXT NOT NULL DEFAULT 'BASIC',
    "audienceInsights" BOOLEAN NOT NULL DEFAULT false,
    "monthlyReport" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingMonths" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "paymentOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "planId" TEXT,
    "billingMonths" INTEGER,
    "houseId" TEXT,
    "boostDays" INTEGER,
    "amountMmk" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MMK',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "amountMmk" INTEGER NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "result" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseBoost" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "subscriptionId" TEXT,
    "paymentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseEvent" (
    "id" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "visitorKey" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "hour" INTEGER NOT NULL,
    "signedIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AgentSubscription_paymentOrderId_key" ON "AgentSubscription"("paymentOrderId");

-- CreateIndex
CREATE INDEX "AgentSubscription_userId_endsAt_idx" ON "AgentSubscription"("userId", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_reference_key" ON "PaymentOrder"("reference");

-- CreateIndex
CREATE INDEX "PaymentOrder_userId_createdAt_idx" ON "PaymentOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_idx" ON "PaymentOrder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentTransaction_eventId_key" ON "PaymentTransaction"("eventId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_orderId_idx" ON "PaymentTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseBoost_paymentOrderId_key" ON "HouseBoost"("paymentOrderId");

-- CreateIndex
CREATE INDEX "HouseBoost_houseId_endsAt_idx" ON "HouseBoost"("houseId", "endsAt");

-- CreateIndex
CREATE INDEX "HouseBoost_userId_endsAt_idx" ON "HouseBoost"("userId", "endsAt");

-- CreateIndex
CREATE INDEX "HouseBoost_subscriptionId_idx" ON "HouseBoost"("subscriptionId");

-- CreateIndex
CREATE INDEX "HouseEvent_agentId_day_idx" ON "HouseEvent"("agentId", "day");

-- CreateIndex
CREATE INDEX "HouseEvent_houseId_day_idx" ON "HouseEvent"("houseId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "HouseEvent_houseId_type_visitorKey_day_key" ON "HouseEvent"("houseId", "type", "visitorKey", "day");

-- AddForeignKey
ALTER TABLE "AgentSubscription" ADD CONSTRAINT "AgentSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSubscription" ADD CONSTRAINT "AgentSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSubscription" ADD CONSTRAINT "AgentSubscription_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "PaymentOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseBoost" ADD CONSTRAINT "HouseBoost_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseBoost" ADD CONSTRAINT "HouseBoost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseBoost" ADD CONSTRAINT "HouseBoost_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AgentSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseBoost" ADD CONSTRAINT "HouseBoost_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseEvent" ADD CONSTRAINT "HouseEvent_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the plan catalogue. Safe to re-run; existing rows are left untouched.
INSERT INTO "SubscriptionPlan" ("id", "code", "name", "rank", "monthlyPriceMmk", "quarterlyPriceMmk", "monthlyListingLimit", "freeBoostDays", "badgeEligible", "performanceLevel", "audienceInsights", "monthlyReport", "updatedAt") VALUES
  ('plan_free',   'FREE',   'Free Basic',     0,      0,      0,    5,  0, false, 'BASIC',    false, false, CURRENT_TIMESTAMP),
  ('plan_silver', 'SILVER', 'Silver Partner', 1,  90000, 243000,   15,  3, true,  'OVERVIEW', false, false, CURRENT_TIMESTAMP),
  ('plan_gold',   'GOLD',   'Gold Premium',   2, 160000, 432000, NULL, 10, true,  'DETAILED', true,  true,  CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Per-Day Boost price in MMK. Demo value: set the real price before launch.
INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES ('BOOST_PRICE_PER_DAY_MMK', '5000', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
