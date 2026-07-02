import { Injectable, NotFoundException, ConflictException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import * as bcrypt from "bcryptjs";

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { role?: string; status?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters?.role && { role: filters.role as any }),
        ...(filters?.status && { status: filters.status as any }),
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, avatarUrl: true, createdAt: true, updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, avatarUrl: true, createdAt: true, updatedAt: true,
        _count: { select: { incidents: true, agentRuns: true } },
      },
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role?: string;
  }) {
    const existing = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new ConflictException("Email already in use");

    const passwordHash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: (data.role as any) ?? "ENGINEER",
        status: "ACTIVE",
      },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, createdAt: true,
      },
    });
  }

  async update(id: string, data: Partial<{
    firstName: string;
    lastName: string;
    role: string;
    status: string;
    avatarUrl: string;
  }>) {
    await this.findOne(id);
    return this.prisma.user.update({
      where: { id },
      data: data as any,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, status: true, updatedAt: true,
      },
    });
  }

  async deactivate(id: string) {
    return this.update(id, { status: "INACTIVE" });
  }

  async getStats() {
    const [total, byRole, active] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
      this.prisma.user.count({ where: { status: "ACTIVE" } }),
    ]);
    return {
      total,
      active,
      byRole: Object.fromEntries(byRole.map((r) => [r.role, r._count.id])),
    };
  }
}
