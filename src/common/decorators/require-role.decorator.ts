import { SetMetadata } from '@nestjs/common';

export const RequireRole = (roles: string[]) => SetMetadata('roles', roles);
