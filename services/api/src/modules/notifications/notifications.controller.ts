import { Controller, Get, Post, Param, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { NotificationsService } from "./notifications.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  findAll(@Request() req) { return this.svc.findAll(req.user.id); }

  @Get("unread-count")
  unreadCount(@Request() req) { return this.svc.getUnreadCount(req.user.id); }

  @Post(":id/read")
  markRead(@Param("id") id: string, @Request() req) {
    return this.svc.markReadOwned(id, req.user.id);
  }

  @Post("read-all")
  markAllRead(@Request() req) { return this.svc.markAllRead(req.user.id); }
}
