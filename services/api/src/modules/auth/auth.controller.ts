import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: "Login with email and password" })
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @ApiOperation({ summary: "Refresh access token" })
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body("refreshToken") refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user profile" })
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: "Change current user password" })
  @UseGuards(JwtAuthGuard)
  @Post("change-password")
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @Request() req,
    @Body("currentPassword") currentPassword: string,
    @Body("newPassword") newPassword: string,
  ) {
    if (!currentPassword || !newPassword) throw new BadRequestException("Both passwords required");
    if (newPassword.length < 8) throw new BadRequestException("New password must be at least 8 characters");
    return this.authService.changePassword(req.user.id, currentPassword, newPassword);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout() {
    // Stateless JWT — client discards tokens
    return;
  }
}
