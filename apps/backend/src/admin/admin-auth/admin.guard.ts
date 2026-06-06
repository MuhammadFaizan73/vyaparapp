import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export type AdminRequest = {
  headers: { authorization?: string };
  adminId: string;
  adminRole: string;
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role: string;
        isAdmin?: boolean;
      }>(auth.slice(7));

      if (!payload.isAdmin) throw new ForbiddenException("Admin access only");

      req.adminId = payload.sub;
      req.adminRole = payload.role;
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException("Invalid token");
    }
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AdminRequest>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) throw new UnauthorizedException("Missing bearer token");
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        role: string;
        isAdmin?: boolean;
      }>(auth.slice(7));

      if (!payload.isAdmin) throw new ForbiddenException("Admin access only");
      if (payload.role !== "superadmin") throw new ForbiddenException("Superadmin access only");

      req.adminId = payload.sub;
      req.adminRole = payload.role;
      return true;
    } catch (e) {
      if (e instanceof ForbiddenException) throw e;
      throw new UnauthorizedException("Invalid token");
    }
  }
}
