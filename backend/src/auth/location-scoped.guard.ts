import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../users/entities/user.entity';

/** Guard that allows ADMIN through, checks MANAGER/AREA_MANAGER has the locationId in their managedLocations */
@Injectable()
export class LocationScopedGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;
    if (user.role === UserRole.ADMIN) return true;

    const locationId = request.params?.locationId ?? request.query?.locationId ?? request.body?.locationId;
    if (!locationId) return true; // no locationId param — let role guard handle it

    if (user.role === UserRole.MANAGER || user.role === UserRole.AREA_MANAGER) {
      const managed = (user.managedLocations ?? []) as { id: string }[];
      if (!managed.some((l) => l.id === locationId)) {
        throw new ForbiddenException('You do not manage this location.');
      }
    }
    return true;
  }
}
