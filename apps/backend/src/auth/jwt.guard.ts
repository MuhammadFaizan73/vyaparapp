import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";

export type AuthedRequest = {
  headers: { authorization?: string };
  tenantId: string;
  memberId?: string;
  memberRole?: string;
  // null = owner/legacy token → unrestricted (mirrors the mobile client's getPermissions()
  // convention exactly, so "null means unrestricted" never has two different meanings
  // between client and server).
  permissions: string[] | null;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; memberId?: string; role?: string; permissions?: string[] }>(auth.slice(7));
      req.tenantId = payload.sub;
      req.memberId = payload.memberId;
      req.memberRole = payload.role;
      req.permissions = Array.isArray(payload.permissions) ? payload.permissions : null;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
