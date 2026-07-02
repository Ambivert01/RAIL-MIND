import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async create(data: { userId: string; title: string; message: string; type?: string; relatedEntityType?: string; relatedEntityId?: string }) {
    return this.prisma.notification.create({
      data: { userId: data.userId, title: data.title, message: data.message, type: data.type ?? "INFO", relatedEntityType: data.relatedEntityType, relatedEntityId: data.relatedEntityId },
    });
  }

  async markRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markReadOwned(id: string, userId: string) {
    // CQ-007 fix: verify notification belongs to the requesting user
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!notification) return null; // silently ignore — prevents ID enumeration
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } });
  }
}
