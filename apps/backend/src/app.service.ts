import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  health() {
    return { status: "ok", service: "vyapar-backend", time: new Date().toISOString() };
  }
}
