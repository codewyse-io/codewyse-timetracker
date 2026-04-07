import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@Controller('organizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  // ── Current org endpoints (for org admins) ──

  @Get('current')
  async getCurrent(@CurrentOrg() orgId: string) {
    return this.service.getWithResolvedLogo(orgId);
  }

  @Patch('current')
  @Roles('admin')
  async updateCurrent(@CurrentOrg() orgId: string, @Body() body: any) {
    const { name, primaryColor, emailFromName, currency, currencySymbol } = body;
    return this.service.update(orgId, { name, primaryColor, emailFromName, currency, currencySymbol });
  }

  @Post('current/logo')
  @Roles('admin')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentOrg() orgId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.service.uploadLogo(orgId, file);
  }

  // ── Super admin CRUD ──

  @Get()
  @Roles('super_admin')
  async findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @Roles('super_admin')
  async findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('super_admin')
  async create(@Body() body: { name: string; slug: string; emailFromName?: string; primaryColor?: string }) {
    return this.service.create(body);
  }

  @Patch(':id')
  @Roles('super_admin')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @Roles('super_admin')
  async remove(@Param('id') id: string) {
    return this.service.remove(id);
  }

  @Get(':id/stats')
  @Roles('super_admin')
  async getStats(@Param('id') id: string) {
    return this.service.getOrgStats(id);
  }
}
