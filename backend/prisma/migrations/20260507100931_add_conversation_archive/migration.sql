-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false;
