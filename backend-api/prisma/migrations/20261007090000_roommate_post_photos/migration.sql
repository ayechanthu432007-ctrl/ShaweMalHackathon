-- AlterTable
-- Backward compatible: existing roommate posts keep working with an empty photo list.
ALTER TABLE "RoommatePost" ADD COLUMN     "photoPaths" TEXT[] DEFAULT ARRAY[]::TEXT[];
