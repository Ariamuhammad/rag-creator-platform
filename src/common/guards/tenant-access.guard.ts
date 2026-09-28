import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { UserRole } from '../types/enums';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  private readonly logger = new Logger(TenantAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User must be authenticated for tenant access verification.');
    }

    // Extract creatorProfileId / tenantId from route param, body, query, or custom header
    const creatorProfileId =
      request.params?.creatorProfileId ||
      request.body?.creatorProfileId ||
      request.query?.creatorProfileId ||
      request.headers['x-tenant-id'];

    if (!creatorProfileId) {
      throw new BadRequestException(
        'Missing creatorProfileId parameter or x-tenant-id header.',
      );
    }

    // 1. ADMIN has global access across all tenants
    if (user.role === UserRole.ADMIN) {
      request.tenantId = creatorProfileId;
      return true;
    }

    // 2. CREATOR has access if this is their own profile
    if (user.role === UserRole.CREATOR) {
      if (user.creatorProfileId === creatorProfileId) {
        request.tenantId = creatorProfileId;
        return true;
      }
    }

    // 3. STUDENT must hold an ACTIVE subscription to this specific creator
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        studentId: user.id,
        creatorProfileId: creatorProfileId,
        status: 'ACTIVE',
        currentPeriodEnd: {
          gte: new Date(),
        },
      },
      include: {
        tier: true,
      },
    });

    if (!activeSubscription) {
      this.logger.warn(
        `Unauthorized tenant access attempt by user ${user.id} to creator ${creatorProfileId}`,
      );
      throw new ForbiddenException(
        'Access denied: You do not have an active subscription to this Creator knowledge base.',
      );
    }

    // Attach verified subscription and tenantId to request object for downstream controllers
    request.tenantId = creatorProfileId;
    request.subscription = activeSubscription;

    return true;
  }
}
