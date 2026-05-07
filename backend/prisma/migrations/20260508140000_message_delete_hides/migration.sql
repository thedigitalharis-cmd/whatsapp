-- Per-user "delete for me" + audit fields for "delete for everyone" in CRM
CREATE TABLE "message_user_hides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_user_hides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "message_user_hides_userId_messageId_key" ON "message_user_hides"("userId", "messageId");

ALTER TABLE "message_user_hides" ADD CONSTRAINT "message_user_hides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "message_user_hides" ADD CONSTRAINT "message_user_hides_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "messages" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "messages" ADD COLUMN "deletedByUserId" TEXT;

ALTER TABLE "messages" ADD CONSTRAINT "messages_deletedByUserId_fkey" FOREIGN KEY ("deletedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
