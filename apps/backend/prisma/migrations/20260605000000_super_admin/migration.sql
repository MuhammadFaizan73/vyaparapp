-- Add lastActiveAt + isActive to Tenant
ALTER TABLE "Tenant" ADD COLUMN "lastActiveAt" DATETIME;
ALTER TABLE "Tenant" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT 1;

-- AdminUser
CREATE TABLE "AdminUser" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "name"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         TEXT NOT NULL DEFAULT 'support',
    "lastLoginAt"  DATETIME,
    "isActive"     BOOLEAN NOT NULL DEFAULT 1,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- SupportTicket
CREATE TABLE "SupportTicket" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "tenantId"     TEXT NOT NULL,
    "issueType"    TEXT NOT NULL DEFAULT 'other',
    "subject"      TEXT NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'open',
    "assignedToId" TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- TicketMessage
CREATE TABLE "TicketMessage" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "ticketId"   TEXT NOT NULL,
    "sender"     TEXT NOT NULL,
    "senderId"   TEXT,
    "body"       TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT 0,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Announcement
CREATE TABLE "Announcement" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'info',
    "target"      TEXT NOT NULL DEFAULT 'all',
    "targetValue" TEXT,
    "scheduledAt" DATETIME,
    "sentAt"      DATETIME,
    "expiresAt"   DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- AnnouncementRead
CREATE TABLE "AnnouncementRead" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "announcementId" TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "readAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_tenantId_key" ON "AnnouncementRead"("announcementId", "tenantId");

-- AuditLog
CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "adminId"    TEXT,
    "action"     TEXT NOT NULL,
    "targetType" TEXT,
    "targetId"   TEXT,
    "meta"       TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- SystemMetric
CREATE TABLE "SystemMetric" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "endpoint"   TEXT NOT NULL,
    "method"     TEXT NOT NULL DEFAULT 'GET',
    "statusCode" INTEGER NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "tenantId"   TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
