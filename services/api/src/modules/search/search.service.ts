import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { MemoryService } from "../memory/memory.service";

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService, private memory: MemoryService) {}

  async search(query: string, limit = 20) {
    if (!query?.trim()) return { results: [], total: 0 };

    const q = query.toLowerCase();

    const [assets, incidents, stations, lessons] = await Promise.all([
      this.prisma.asset.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { assetCode: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { station: { select: { name: true } } },
        take: 5,
      }),
      this.prisma.incident.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { incidentNumber: { contains: query, mode: "insensitive" } },
            { rootCause: { contains: query, mode: "insensitive" } },
          ],
        },
        include: { asset: { select: { assetCode: true } } },
        take: 5,
      }),
      this.prisma.station.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { stationCode: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
      this.prisma.lessonLearned.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { content: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 3,
      }),
    ]);

    // Also do semantic search
    let semanticResults: any[] = [];
    try {
      const mem = await this.memory.search(query, { limit: 5 });
      semanticResults = mem.items;
    } catch { /* graceful */ }

    const results = [
      ...assets.map((a) => ({ type: "ASSET", id: a.id, title: `${a.assetCode} — ${a.name}`, subtitle: a.station?.name, status: a.status, url: `/assets/${a.id}` })),
      ...incidents.map((i) => ({ type: "INCIDENT", id: i.id, title: i.title, subtitle: `${i.incidentNumber} · ${i.severity}`, status: i.status, url: `/incidents/${i.id}` })),
      ...stations.map((s) => ({ type: "STATION", id: s.id, title: s.name, subtitle: s.stationCode, url: `/twin?station=${s.id}` })),
      ...lessons.map((l) => ({ type: "LESSON", id: l.id, title: l.title, subtitle: "Lesson Learned", url: `/memory?lesson=${l.id}` })),
      ...semanticResults.map((r) => ({ type: r.type, id: r.id, title: r.title, subtitle: `Semantic match (${r.relevanceScore}%)`, url: `/memory` })),
    ];

    return { results: results.slice(0, limit), total: results.length };
  }
}
