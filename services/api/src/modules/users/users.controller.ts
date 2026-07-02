import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: "List all users (admin only)" })
  @Roles("ADMINISTRATOR")
  @Get()
  findAll(
    @Query("role") role?: string,
    @Query("status") status?: string,
  ) {
    return this.usersService.findAll({ role, status });
  }

  @ApiOperation({ summary: "User stats summary (admin only)" })
  @Roles("ADMINISTRATOR")
  @Get("stats")
  getStats() { return this.usersService.getStats(); }

  @ApiOperation({ summary: "Get single user" })
  @Roles("ADMINISTRATOR")
  @Get(":id")
  findOne(@Param("id") id: string) { return this.usersService.findOne(id); }

  @ApiOperation({ summary: "Create a new user (admin only)" })
  @Roles("ADMINISTRATOR")
  @Post()
  create(@Body() body: any) { return this.usersService.create(body); }

  @ApiOperation({ summary: "Update user profile/role (admin only)" })
  @Roles("ADMINISTRATOR")
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @ApiOperation({ summary: "Deactivate a user (admin only)" })
  @Roles("ADMINISTRATOR")
  @Delete(":id")
  deactivate(@Param("id") id: string) { return this.usersService.deactivate(id); }
}
