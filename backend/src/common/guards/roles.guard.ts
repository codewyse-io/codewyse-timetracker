import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { HR_ALLOWED_KEY } from '../decorators/hr-allowed.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    // Super admin has access to everything
    if (user?.role === 'super_admin') return true;
    if (requiredRoles.includes(user?.role)) return true;

    // Routes marked @HrAllowed() additionally accept users with isHr=true
    const hrAllowed = this.reflector.getAllAndOverride<boolean>(HR_ALLOWED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (hrAllowed && user?.isHr) return true;

    return false;
  }
}
