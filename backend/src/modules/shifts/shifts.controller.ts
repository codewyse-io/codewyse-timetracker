import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ShiftsService } from './shifts.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Shift } from './entities/shift.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentOrg } from '../../common/decorators/current-org.decorator';

@ApiTags('Shifts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new shift (admin only)' })
  async create(@Body() dto: CreateShiftDto, @CurrentOrg() orgId: string): Promise<Shift> {
    return this.shiftsService.create(dto, orgId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active shifts' })
  async findAll(@CurrentOrg() orgId: string): Promise<Shift[]> {
    return this.shiftsService.findAll(orgId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a shift by ID' })
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Shift> {
    return this.shiftsService.findById(id);
  }

  @Patch(':id')
  @Roles('admin')
  @ApiOperation({ summary: 'Update a shift (admin only)' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<Shift> {
    return this.shiftsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a shift (admin only, blocked if users assigned)' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.shiftsService.softDelete(id);
  }
}
