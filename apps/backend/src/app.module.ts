import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { LicenseModule } from "./license/license.module";
import { PartiesModule } from "./parties/parties.module";
import { ImportSessionsModule } from "./import-sessions/import-sessions.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { ItemsModule } from "./items/items.module";
import { TeamModule } from "./team/team.module";
import { ReportsModule } from "./reports/reports.module";
import { CashBankModule } from "./cash-bank/cash-bank.module";
import { LoanAccountsModule } from "./loan-accounts/loan-accounts.module";
import { PartyGroupsModule } from "./party-groups/party-groups.module";
import { LocationModule } from "./location/location.module";
import { PartyAssignmentsModule } from "./party-assignments/party-assignments.module";
import { AdminModule } from "./admin/admin.module";
import { DevicesModule } from "./devices/devices.module";
import { BulkImportModule } from "./bulk-import/bulk-import.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "public", "admin"),
      serveRoot: "/admin",
      serveStaticOptions: { index: "index.html", fallthrough: true },
    }),
    PrismaModule,
    AuthModule,
    LicenseModule,
    PartiesModule,
    ImportSessionsModule,
    TransactionsModule,
    ItemsModule,
    TeamModule,
    ReportsModule,
    CashBankModule,
    LoanAccountsModule,
    PartyGroupsModule,
    LocationModule,
    PartyAssignmentsModule,
    AdminModule,
    DevicesModule,
    BulkImportModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
