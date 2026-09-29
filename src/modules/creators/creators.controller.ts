import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CreatorsService } from './creators.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/types/enums';

@ApiTags('Creators')
@Controller('creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get public creator profile and available tiers by slug' })
  async getBySlug(@Param('slug') slug: string) {
    return this.creatorsService.getCreatorBySlug(slug);
  }

  @Get(':id/tiers')
  @ApiOperation({ summary: 'Get available subscription tiers for a creator' })
  async getTiers(@Param('id') creatorId: string) {
    return this.creatorsService.getTiers(creatorId);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update creator public profile' })
  async updateProfile(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Body() dto: UpdateCreatorDto,
  ) {
    return this.creatorsService.updateProfile(creatorProfileId, dto);
  }

  @Post('tiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new subscription tier for current creator' })
  async createTier(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
    @Body() dto: CreateTierDto,
  ) {
    return this.creatorsService.createTier(creatorProfileId, dto);
  }

  @Get('analytics/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get creator subscribers, documents, and query metrics' })
  async getAnalytics(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
  ) {
    return this.creatorsService.getAnalytics(creatorProfileId);
  }

  @Get('analytics/student-activity')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get comprehensive student learning activity, progress, and AI interaction analytics for creator',
  })
  async getStudentActivityAnalytics(
    @CurrentUser('creatorProfileId') creatorProfileId: string,
  ) {
    return this.creatorsService.getStudentActivityAnalytics(creatorProfileId);
  }
}
