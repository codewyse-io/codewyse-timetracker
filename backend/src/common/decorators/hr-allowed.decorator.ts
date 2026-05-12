import { SetMetadata } from '@nestjs/common';

/**
 * Mark a route as accessible to HR users (users with `isHr=true`) in
 * addition to whoever is allowed by the route's `@Roles(...)` decorator.
 *
 * Usage:
 *   @Roles(Role.ADMIN)
 *   @HrAllowed()
 *   getStuff() { ... }
 *
 * The RolesGuard will allow access when:
 *   - user.role === 'super_admin'   (already)
 *   - user.role matches a required role  (already)
 *   - HR_ALLOWED metadata is set AND user.isHr === true   (new)
 */
export const HR_ALLOWED_KEY = 'hrAllowed';
export const HrAllowed = () => SetMetadata(HR_ALLOWED_KEY, true);
