PRAGMA foreign_keys=OFF;

ALTER TABLE "Tenant" RENAME TO "_Tenant_old";

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "trialStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trialExpiresAt" DATETIME NOT NULL,
    "desktopLicenseId" TEXT,
    "mobileLicenseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Tenant_desktopLicenseId_fkey" FOREIGN KEY ("desktopLicenseId") REFERENCES "License" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Tenant_mobileLicenseId_fkey" FOREIGN KEY ("mobileLicenseId") REFERENCES "License" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Tenant_phone_key" ON "Tenant"("phone");
CREATE UNIQUE INDEX "Tenant_desktopLicenseId_key" ON "Tenant"("desktopLicenseId");
CREATE UNIQUE INDEX "Tenant_mobileLicenseId_key" ON "Tenant"("mobileLicenseId");

INSERT INTO "Tenant" ("id","phone","countryCode","trialStartedAt","trialExpiresAt","createdAt","updatedAt")
SELECT "id","phone","countryCode","trialStartedAt","trialExpiresAt","createdAt","updatedAt" FROM "_Tenant_old";

DROP TABLE "_Tenant_old";

ALTER TABLE "License" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'desktop';

PRAGMA foreign_keys=ON;
