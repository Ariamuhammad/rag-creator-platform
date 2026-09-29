import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { CoursesService } from './courses.service';
import type { UploadedDocFile } from '../knowledge-base/knowledge-base.service';
import {
  CreateCourseDto,
  CreateModuleDto,
  CreateLessonDto,
  UpdateProgressDto,
  CreateFullCourseDto,
} from './dto/course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '../../common/types/enums';

@ApiTags('Courses & Syllabus')
@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Post('generate-from-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Generate structured course syllabus with modules, lessons, and rich markdown from an uploaded PDF using AI',
  })
  async generateFromPdf(
    @UploadedFile() file: UploadedDocFile,
    @Body('instructions') instructions?: string,
    @Body('targetLevel') targetLevel?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File PDF wajib diunggah.');
    }
    return this.coursesService.generateSyllabusFromPdf(
      file.buffer,
      file.originalname,
      instructions,
      targetLevel,
    );
  }

  @Post('full')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Unified Curriculum Builder: Creator creates course, modules, lessons, and assigns RAG docs in one request',
  })
  async createFullCourse(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateFullCourseDto,
  ) {
    return this.coursesService.createFullCourse(userId, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator creates a new course' })
  async createCourse(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.coursesService.createCourse(userId, dto);
  }

  @Get('my-courses')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Creator gets all courses created by them with full modules, lessons, and assigned RAG documents',
  })
  async getMyCourses(@CurrentUser('id') userId: string) {
    return this.coursesService.getMyCourses(userId);
  }

  @Get()
  @ApiOperation({ summary: 'List all published courses with creator info' })
  async listPublishedCourses() {
    return this.coursesService.listPublishedCourses();
  }

  @Get('students/enrolled')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Master Silabus: Get enrolled courses, completion %, tier name, & credits for student',
  })
  async getEnrolledCourses(@CurrentUser('id') studentId: string) {
    return this.coursesService.getEnrolledCourses(studentId);
  }

  @Get('slug/:slug')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get course curriculum and syllabus by slug (authenticated student sees progress)' })
  async getCourseBySlug(
    @Param('slug') slug: string,
    @CurrentUser('id') studentId?: string,
  ) {
    return this.coursesService.getCourseBySlug(slug, studentId);
  }

  @Post(':id/modules')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator adds a module/chapter to course' })
  async createModule(
    @CurrentUser('id') userId: string,
    @Param('id') courseId: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.coursesService.createModule(userId, courseId, dto);
  }

  @Post('modules/:id/lessons')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CREATOR, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Creator adds a lesson to a module' })
  async createLesson(
    @CurrentUser('id') userId: string,
    @Param('id') moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.coursesService.createLesson(userId, moduleId, dto);
  }

  @Patch('lessons/:id/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Student toggles completion of a lesson' })
  async updateLessonProgress(
    @CurrentUser('id') studentId: string,
    @Param('id') lessonId: string,
    @Body() dto: UpdateProgressDto,
  ) {
    return this.coursesService.updateLessonProgress(
      studentId,
      lessonId,
      dto.completed,
    );
  }
}
