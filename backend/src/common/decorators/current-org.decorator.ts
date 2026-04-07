import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentOrg = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const orgId = request.user?.organizationId;
    // Super admins may not have an organizationId — return empty string
    // Services should handle empty orgId gracefully (no filtering)
    if (!orgId && request.user?.role === 'super_admin') return '';
    if (!orgId) throw new Error('Organization ID not found in request');
    return orgId;
  },
);
