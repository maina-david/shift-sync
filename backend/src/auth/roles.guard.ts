import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/roles.decorator';
import { UserRole } from '../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) return true;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { user } = context.switchToHttp().getRequest();
    if (!user) return false;

    // Admins bypass all role checks
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (user.role === UserRole.ADMIN) return true;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
