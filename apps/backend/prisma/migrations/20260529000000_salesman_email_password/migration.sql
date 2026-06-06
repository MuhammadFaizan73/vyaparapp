-- AlterTable TeamMember: add email, passwordHash; make contact optional with default; change status default to active
ALTER TABLE "TeamMember" ADD COLUMN "email" TEXT;
ALTER TABLE "TeamMember" ADD COLUMN "passwordHash" TEXT;

-- Create unique index on email
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");
