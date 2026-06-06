import {
  Controller, Post, Get, Body, Param, UseGuards, Req, HttpCode, Res,
} from "@nestjs/common";
import { Response } from "express";
import { networkInterfaces } from "os";
import { JwtGuard } from "../auth/jwt.guard";
import { ImportSessionsService } from "./import-sessions.service";

@Controller("import-sessions")
export class ImportSessionsController {
  constructor(private readonly svc: ImportSessionsService) {}

  /** Return machine's LAN IP so the frontend can build the QR URL */
  @Get("lan-ip")
  lanIp() {
    const nets = networkInterfaces();
    for (const iface of Object.values(nets)) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) return { ip: addr.address };
      }
    }
    return { ip: "localhost" };
  }

  /** Authenticated: create a new session tied to this tenant */
  @UseGuards(JwtGuard)
  @Post()
  create(@Req() req: any) {
    return this.svc.create(req.tenantId);
  }

  /** Authenticated: poll for status */
  @UseGuards(JwtGuard)
  @Get(":id/status")
  status(@Req() req: any, @Param("id") id: string) {
    return this.svc.getStatus(id, req.tenantId);
  }

  /** Unauthenticated (mobile): submit contacts using session ID as token */
  @Post(":id/contacts")
  @HttpCode(200)
  submitContacts(
    @Param("id") id: string,
    @Body() body: { contacts: Array<{ name: string; phone?: string; email?: string }> },
  ) {
    return this.svc.submitContacts(id, body.contacts ?? []);
  }

  /** Serve the mobile picker page */
  @Get(":id/pick")
  pickPage(@Param("id") id: string, @Res() res: Response) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(this.svc.getMobileHtml(id));
  }
}
