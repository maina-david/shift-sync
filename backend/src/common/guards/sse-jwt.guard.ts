import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class SseJwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const req = ctx.switchToHttp().getRequest<any>();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const token: string | undefined =
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      req.query?.token ?? req.headers?.authorization?.replace('Bearer ', '');

    if (!token) return false;

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      const user = await this.userRepo.findOne({
        where: { id: payload.sub, isActive: true },
        relations: ['managedLocations'],
      });
      if (!user) return false;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      req.user = user;
      return true;
    } catch {
      return false;
    }
  }
}
