import {
  Controller, Post, Get, Patch, Param, Body, Query,
  UseGuards, Req, ForbiddenException,
} from "@nestjs/common";

import { JwtGuard, AuthedRequest } from "../auth/jwt.guard";
import { LocationService } from "./location.service";
import { PingLocationDto, CheckInDto, CheckOutDto, ShopCheckInDto } from "./location.dto";

@Controller("location")
@UseGuards(JwtGuard)
export class LocationController {
  constructor(private readonly svc: LocationService) {}

  @Post("ping")
  ping(@Req() req: AuthedRequest, @Body() dto: PingLocationDto) {
    if (!req.memberId) throw new ForbiddenException("Only team members can ping location");
    return this.svc.ping(req.tenantId, req.memberId, dto);
  }

  @Post("check-in")
  checkIn(@Req() req: AuthedRequest, @Body() dto: CheckInDto) {
    if (!req.memberId) throw new ForbiddenException("Only team members can check in");
    return this.svc.checkIn(req.tenantId, req.memberId, dto);
  }

  @Post("check-out/:visitId")
  checkOut(
    @Req() req: AuthedRequest,
    @Param("visitId") visitId: string,
    @Body() dto: CheckOutDto,
  ) {
    if (!req.memberId) throw new ForbiddenException("Only team members can check out");
    return this.svc.checkOut(req.tenantId, req.memberId, visitId, dto);
  }

  @Get("my-visits")
  myVisits(@Req() req: AuthedRequest) {
    if (!req.memberId) throw new ForbiddenException("Only team members have visits");
    return this.svc.getMyVisits(req.tenantId, req.memberId);
  }

  @Get("office-checkin-today")
  officeCheckInToday(@Req() req: AuthedRequest) {
    if (!req.memberId) throw new ForbiddenException("Only team members can check this");
    return this.svc.getOfficeCheckInToday(req.tenantId, req.memberId);
  }

  @Post("shop-checkin")
  shopCheckIn(@Req() req: AuthedRequest, @Body() dto: ShopCheckInDto) {
    if (!req.memberId) throw new ForbiddenException("Only team members can check in at shops");
    return this.svc.shopCheckIn(req.tenantId, req.memberId, dto);
  }

  @Get("my-route")
  myRoute(@Req() req: AuthedRequest) {
    if (!req.memberId) throw new ForbiddenException("Only team members have routes");
    return this.svc.getMyRoute(req.tenantId, req.memberId);
  }

  @Get("admin/route/:memberId")
  adminMemberRoute(
    @Req() req: AuthedRequest,
    @Param("memberId") memberId: string,
    @Query("date") date: string,
  ) {
    if (req.memberId && (req as any).memberRole !== "secondary_admin") throw new ForbiddenException("Admin only");
    return this.svc.getAdminMemberRoute(req.tenantId, memberId, date ?? new Date().toISOString().slice(0, 10));
  }

  @Get("admin/pings/:memberId")
  adminMemberPings(
    @Req() req: AuthedRequest,
    @Param("memberId") memberId: string,
    @Query("date") date: string,
  ) {
    if (req.memberId && (req as any).memberRole !== "secondary_admin") throw new ForbiddenException("Admin only");
    return this.svc.getMemberPingsForDate(req.tenantId, memberId, date ?? new Date().toISOString().slice(0, 10));
  }

  // Office location — readable by all, writable by owner/admin
  @Get("office")
  getOffice(@Req() req: AuthedRequest) {
    return this.svc.getOfficeLocation(req.tenantId);
  }

  @Patch("office")
  setOffice(
    @Req() req: AuthedRequest,
    @Body() body: { lat: number; lng: number; label?: string },
  ) {
    if (req.memberId) throw new ForbiddenException("Only admin can set office location");
    return this.svc.setOfficeLocation(req.tenantId, body.lat, body.lng, body.label);
  }

  // Admin-only endpoints (owner has no memberId)
  @Get("live")
  liveLocations(@Req() req: AuthedRequest) {
    return this.svc.getLiveLocations(req.tenantId);
  }

  @Get("visits/:memberId")
  memberVisits(
    @Req() req: AuthedRequest,
    @Param("memberId") memberId: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    return this.svc.getMemberVisits(req.tenantId, memberId, from, to);
  }
}
