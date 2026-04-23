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
      const payload = await this.jwt.verifyAsync<{ sub: string }>(auth.slice(7));
      req.tenantId = payload.sub;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid token");
    }
  }
}
