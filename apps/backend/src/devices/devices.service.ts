import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDeviceDto } from "./devices.dto";

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async register(tenantId: string, dto: RegisterDeviceDto) {
    const session = await this.prisma.deviceSession.upsert({
      where: { tenantId_deviceId: { tenantId, deviceId: dto.deviceId } },
      update: { deviceName: dto.deviceName, deviceType: dto.deviceType, lastSeenAt: new Date() },
      create: {
        tenantId,
        deviceId: dto.deviceId,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        isActive: false,
      },
    });

    // Auto-activate if this is the only / first active device
    const activeCount = await this.prisma.deviceSession.count({
      where: { tenantId, isActive: true },
    });
    if (activeCount === 0) {
      await this.prisma.deviceSession.update({
        where: { id: session.id },
        data: { isActive: true },
      });
      return { ...session, isActive: true };
    }

    // Return current isActive status for this session
    const updated = await this.prisma.deviceSession.findUnique({ where: { id: session.id } });
    return updated!;
  }

  async list(tenantId: string) {
    return this.prisma.deviceSession.findMany({
      where: { tenantId },
      orderBy: { lastSeenAt: "desc" },
    });
  }

  async activate(tenantId: string, sessionId: string) {
    const session = await this.prisma.deviceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException("Device session not found");
    }
    // Deactivate all, then activate chosen
    await this.prisma.deviceSession.updateMany({ where: { tenantId }, data: { isActive: false } });
    return this.prisma.deviceSession.update({ where: { id: sessionId }, data: { isActive: true } });
  }

  async remove(tenantId: string, sessionId: string) {
    const session = await this.prisma.deviceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.tenantId !== tenantId) {
      throw new NotFoundException("Device session not found");
    }
    await this.prisma.deviceSession.delete({ where: { id: sessionId } });

    // If we deleted the active device, auto-activate the most recently seen one
    if (session.isActive) {
      const next = await this.prisma.deviceSession.findFirst({
        where: { tenantId },
        orderBy: { lastSeenAt: "desc" },
      });
      if (next) {
        await this.prisma.deviceSession.update({ where: { id: next.id }, data: { isActive: true } });
      }
    }
  }
}
