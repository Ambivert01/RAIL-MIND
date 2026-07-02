import { Controller, Get, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { SearchService } from "./search.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Search")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly svc: SearchService) {}

  @Get()
  search(@Query("q") query: string, @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    return this.svc.search(query, limit);
  }
}
