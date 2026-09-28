import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCreatorBySlug(slug: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        subscriptionTiers: {
          where: { isActive: true },
          orderBy: { price: 'asc' },
        },
        _count: {
          select: {
            documents: true,
            subscriptions: true,
          },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with slug '${slug}' not found.`);
    }

    return creator;
  }

  async getCreatorById(id: string) {
    const creator = await this.prisma.creatorProfile.findUnique({
      where: { id },
      include: {
        subscriptionTiers: {
          where: { isActive: true },
        },
      },
    });

    if (!creator) {
      throw new NotFoundException(`Creator with ID '${id}' not found.`);
    }

    return creator;
  }

  async updateProfile(creatorProfileId: string, dto: UpdateCreatorDto) {
    return this.prisma.creatorProfile.update({
      where: { id: creatorProfileId },
      data: {
        ...dto,
      },
    });
  }

  async createTier(creatorProfileId: string, dto: CreateTierDto) {
    return this.prisma.subscriptionTier.create({
      data: {
        creatorProfileId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        monthlyCreditQuota: dto.monthlyCreditQuota,
      },
    });
  }

  async getTiers(creatorProfileId: string) {
    return this.prisma.subscriptionTier.findMany({
      where: { creatorProfileId, isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getAnalytics(creatorProfileId: string) {
    const totalSubscribers = await this.prisma.subscription.count({
      where: { creatorProfileId, status: 'ACTIVE' },
    });

    const totalDocuments = await this.prisma.document.count({
      where: { creatorProfileId, status: 'COMPLETED' },
    });

    const totalQueries = await this.prisma.creditLedger.count({
      where: { creatorProfileId, eventType: 'CHAT_QUERY' },
    });

    return {
      totalActiveSubscribers: totalSubscribers,
      totalKnowledgeDocuments: totalDocuments,
      totalQueriesHandled: totalQueries,
    };
  }
}
