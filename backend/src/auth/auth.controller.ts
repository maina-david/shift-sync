import {
  Controller, Post, Get, Body, UseGuards, HttpCode, Request, Res, UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from '../common/roles.decorator';
import { CurrentUser } from '../common/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ short: { ttl: 60_000, limit: 5 }, medium: { ttl: 60_000, limit: 5 }, long: { ttl: 60_000, limit: 5 } })
  @Post('register')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user account (admin only)' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Throttle({ short: { ttl: 60_000, limit: 5 }, medium: { ttl: 60_000, limit: 5 }, long: { ttl: 60_000, limit: 5 } })
  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Login — receive short-lived access token + httpOnly refresh cookie' })
  @ApiBody({ type: LoginDto })
  login(
    @Request() req: { user: Omit<User, 'password'> },
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.login(req.user, res);
  }

  @Throttle({ short: { ttl: 60_000, limit: 10 }, medium: { ttl: 60_000, limit: 10 }, long: { ttl: 60_000, limit: 10 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Exchange refresh token cookie for a new access token — rotates the refresh token on every use' })
  refresh(
    @Request() req: { cookies: Record<string, string> },
    @Res({ passthrough: true }) res: Response,
  ) {
    const token: string | undefined = req.cookies?.['refresh_token'];
    if (!token) throw new UnauthorizedException('No refresh token');
    return this.authService.refresh(token, res);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke refresh token and clear the cookie' })
  logout(@Res({ passthrough: true }) res: Response, @CurrentUser() user: User) {
    return this.authService.logout(res, user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  me(@CurrentUser() user: User) {
    return this.authService.profile(user.id);
  }
}
