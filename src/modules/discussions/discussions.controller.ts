import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DiscussionsService } from './discussions.service';
import { CreateDiscussionDto, ReplyDiscussionDto } from './dto/discussion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Lesson Discussions & Q&A Forum')
@Controller('discussions')
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Get('lesson/:lessonId')
  @ApiOperation({ summary: 'Get all discussion threads for a lesson' })
  async getDiscussionsByLesson(@Param('lessonId') lessonId: string) {
    return this.discussionsService.getDiscussionsByLesson(lessonId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Post a question / discussion topic to a lesson' })
  async createDiscussion(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDiscussionDto,
  ) {
    return this.discussionsService.createDiscussion(userId, dto);
  }

  @Post(':id/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a discussion thread' })
  async replyDiscussion(
    @CurrentUser('id') userId: string,
    @Param('id') parentId: string,
    @Body() dto: ReplyDiscussionDto,
  ) {
    return this.discussionsService.replyDiscussion(userId, parentId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete own discussion message' })
  async deleteDiscussion(
    @CurrentUser('id') userId: string,
    @Param('id') discussionId: string,
  ) {
    return this.discussionsService.deleteDiscussion(userId, discussionId);
  }
}
