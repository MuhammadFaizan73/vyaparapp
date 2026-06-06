import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class AdminHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async record(endpoint: string, method: string, statusCode: number, responseMs: number, tenantId?: string) {
    await this.prisma.systemMetric.create({
      data: { endpoint, method, statusCode, responseMs, tenantId },
    });
  }

  async getStats() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const metrics = await this.prisma.systemMetric.findMany({
      where: { createdAt: { gte: since } },
      select: { statusCode: true, responseMs: true },
    });

    const total = metrics.length;
    const errors = metrics.filter((m) => m.statusCode >= 500).length;
    const responseTimes = metrics.map((m) => m.responseMs).sort((a, b) => a - b);

    const p50 = responseTimes[Math.floor(responseTimes.length * 0.5)] ?? 0;
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)] ?? 0;

    const errorRate = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";

    const activeSessions = await this.prisma.tenant.count({
      where: { lastActiveAt: { gte: since } },
    });

    return { total, errors, errorRate: `${errorRate}%`, p50Ms: p50, p95Ms: p95, activeSessions };
  }

  async getHourlyChart() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const metrics = await this.prisma.systemMetric.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true, responseMs: true, statusCode: true },
      orderBy: { createdAt: "asc" },
    });

    const hourlyMap: Record<string, { count: number; totalMs: number; errors: number }> = {};
    for (const m of metrics) {
      const hour = m.createdAt.toISOString().slice(0, 13);
      if (!hourlyMap[hour]) hourlyMap[hour] = { count: 0, totalMs: 0, errors: 0 };
      hourlyMap[hour].count++;
      hourlyMap[hour].totalMs += m.responseMs;
      if (m.statusCode >= 500) hourlyMap[hour].errors++;
    }

    return Object.entries(hourlyMap).map(([hour, v]) => ({
      hour,
      requests: v.count,
      avgMs: Math.round(v.totalMs / v.count),
      errors: v.errors,
    }));
  }
}
