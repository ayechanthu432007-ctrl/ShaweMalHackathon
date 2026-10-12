-- Backward compatible: existing accounts keep working without an occupation or preferences.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "occupationId" TEXT;

-- CreateTable
CREATE TABLE "HousingPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "preferredCityId" TEXT,
    "propertyTypeId" TEXT,
    "bedroomsMin" INTEGER,
    "wantsFurnished" BOOLEAN,
    "needsInternet" BOOLEAN,
    "needsQuiet" BOOLEAN,
    "amenityIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "moveInDate" TIMESTAMP(3),
    "leaseMonths" INTEGER,
    "roomArrangement" TEXT,
    "cleanliness" TEXT,
    "sleepSchedule" TEXT,
    "smoking" TEXT,
    "noiseTolerance" TEXT,
    "socialLevel" TEXT,
    "guests" TEXT,
    "sharesChores" BOOLEAN,
    "visibleToAgents" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousingPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HousingPreference_userId_key" ON "HousingPreference"("userId");

-- CreateIndex
CREATE INDEX "HousingPreference_visibleToAgents_preferredCityId_idx" ON "HousingPreference"("visibleToAgents", "preferredCityId");

-- CreateIndex
CREATE INDEX "HousingPreference_budgetMax_idx" ON "HousingPreference"("budgetMax");

-- CreateIndex
CREATE INDEX "User_occupationId_idx" ON "User"("occupationId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_occupationId_fkey" FOREIGN KEY ("occupationId") REFERENCES "Occupation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousingPreference" ADD CONSTRAINT "HousingPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousingPreference" ADD CONSTRAINT "HousingPreference_preferredCityId_fkey" FOREIGN KEY ("preferredCityId") REFERENCES "City"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousingPreference" ADD CONSTRAINT "HousingPreference_propertyTypeId_fkey" FOREIGN KEY ("propertyTypeId") REFERENCES "PropertyType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Sign-up needs a choice for people outside the listed occupations.
INSERT INTO "Occupation" ("id", "name", "isActive", "createdAt", "updatedAt")
VALUES ('occ_other', 'Other', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
