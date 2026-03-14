import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      password: hashed,
      role: dto.role,
      notificationPreferences: { inApp: true, email: false },
    });
    const saved = await this.userRepo.save(user);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...safe } = saved as User & { password: string };
    return safe;
  }

  /** Called by LocalStrategy — validates credentials, returns user without password or null */
  async validateUser(email: string, password: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.password')
      .where('u.email = :email AND u.isActive = true', { email })
      .getOne();

    if (!user) return null;
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return null;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _p, ...safe } = user as User & { password: string };
    return safe;
  }

  /** Called by controller after Passport has validated credentials via LocalStrategy */
  async login(user: Omit<User, 'password'>, res: Response) {
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user.id);
    await this.userRepo.update(user.id, { refreshTokenHash: hashToken(refreshToken) });
    this.setRefreshCookie(res, refreshToken);
    return { token: accessToken, user };
  }

  /** Verify the refresh token cookie, validate against stored hash, rotate token, issue new access token */
  async refresh(refreshToken: string, res: Response): Promise<{ token: string; user: User }> {
    let payload: { sub: string };
    try {
      payload = this.jwtService.verify<{ sub: string }>(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.userRepo
      .createQueryBuilder('u')
      .addSelect('u.refreshTokenHash')
      .where('u.id = :id AND u.isActive = true', { id: payload.sub })
      .leftJoinAndSelect('u.skills', 'skills')
      .leftJoinAndSelect('u.certifiedLocations', 'certifiedLocations')
      .leftJoinAndSelect('u.managedLocations', 'managedLocations')
      .getOne();

    if (!user) throw new UnauthorizedException('User not found');
    if (!user.refreshTokenHash || user.refreshTokenHash !== hashToken(refreshToken)) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Rotate: issue new refresh token and update stored hash
    const newRefreshToken = this.signRefreshToken(user.id);
    await this.userRepo.update(user.id, { refreshTokenHash: hashToken(newRefreshToken) });
    this.setRefreshCookie(res, newRefreshToken);

    const accessToken = this.signAccessToken(user);
    return { token: accessToken, user };
  }

  async logout(res: Response, userId?: string) {
    if (userId) {
      await this.userRepo.update(userId, { refreshTokenHash: null });
    }
    res.clearCookie(REFRESH_COOKIE, { httpOnly: true, sameSite: 'strict', path: '/auth/refresh' });
  }

  async profile(userId: string) {
    return this.userRepo.findOne({
      where: { id: userId },
      relations: ['skills', 'certifiedLocations', 'managedLocations'],
    });
  }

  private signAccessToken(user: Pick<User, 'id' | 'email' | 'role'>): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      {
        secret: this.config.get<string>('jwt.secret'),
        expiresIn: this.config.get('jwt.expiresIn') as any,
      },
    );
  }

  private signRefreshToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshExpiresIn') as any,
      },
    );
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}

/** SHA-256 hex digest of a token string — fast, non-reversible, suitable for stored token fingerprinting */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
