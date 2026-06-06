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
      const payload = await this.jwt.verifyAsync<{ sub: string; memberId?: string; role?: string }>(auth.slice(7));
      req.tenantId = payload.sub;
      req.memberId = payload.memberId;
      req.memberRole = payload.role;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
