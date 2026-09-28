import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../../common/types/enums';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered.');
    }

    // Check slug availability if CREATOR
    if (dto.role === UserRole.CREATOR && dto.slug) {
      const existingSlug = await this.prisma.creatorProfile.findUnique({
        where: { slug: dto.slug.toLowerCase() },
      });
      if (existingSlug) {
        throw new ConflictException('Creator slug is already taken.');
      }
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(dto.password, saltRounds);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: dto.email.toLowerCase(),
            password: hashedPassword,
            fullName: dto.fullName,
            role: dto.role,
          },
        });

        let creatorProfile = null;
        if (dto.role === UserRole.CREATOR) {
          const slug =
            dto.slug?.toLowerCase() ||
            dto.fullName?.toLowerCase().replace(/\s+/g, '-') ||
            `creator-${user.id.slice(0, 8)}`;

          creatorProfile = await tx.creatorProfile.create({
            data: {
              userId: user.id,
              slug,
              displayName: dto.displayName || dto.fullName || 'Creator',
              commissionRate:
                parseFloat(process.env.PLATFORM_COMMISSION_PERCENT || '20') /
                100,
            },
          });
        }

        return { user, creatorProfile };
      });

      const token = this.generateToken(
        result.user.id,
        result.user.email,
        result.user.role,
        result.creatorProfile?.id,
      );

      return {
        message: 'Registration successful',
        user: {
          id: result.user.id,
          email: result.user.email,
          fullName: result.user.fullName,
          role: result.user.role,
          creatorProfile: result.creatorProfile,
        },
        accessToken: token,
      };
    } catch (error) {
      this.logger.error('Registration failed:', error);
      throw new InternalServerErrorException('Failed to complete registration.');
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { creatorProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const token = this.generateToken(
      user.id,
      user.email,
      user.role,
      user.creatorProfile?.id,
    );

    return {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        creatorProfile: user.creatorProfile,
      },
      accessToken: token,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        creatorProfile: true,
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: {
            creatorProfile: {
              select: {
                id: true,
                displayName: true,
                slug: true,
              },
            },
            tier: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found.');
    }

    return user;
  }

  private generateToken(
    userId: string,
    email: string,
    role: string,
    creatorProfileId?: string,
  ): string {
    const payload = {
      sub: userId,
      email,
      role,
      creatorProfileId,
    };

    return this.jwtService.sign(payload);
  }
}
