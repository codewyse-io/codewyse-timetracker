import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Res,
  UseGuards,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { S3Service } from '../s3/s3.service';
import { EmailService } from '../email/email.service';
import { UsersService } from '../users/users.service';

const RELEASE_PREFIX = 'desktop-releases';

@ApiTags('Downloads')
@Controller('downloads')
export class DownloadsController {
  private readonly logger = new Logger(DownloadsController.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  // ── Public endpoints for electron-updater ─────────────────────────

  /**
   * Serves latest.yml / latest-mac.yml from S3.
   * electron-updater calls this to check for new versions.
   * No auth required — the yml only contains version metadata.
   */
  @Get('update/:filename')
  @ApiOperation({ summary: 'Get update metadata file (public, for electron-updater)' })
  async getUpdateFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    // Only allow yml files
    if (!filename.endsWith('.yml')) {
      throw new NotFoundException();
    }

    try {
      // Find the latest version folder
      const objects = await this.s3Service.listObjects(`${RELEASE_PREFIX}/`);
      const versions = new Set<string>();
      for (const obj of objects) {
        const parts = obj.key.replace(`${RELEASE_PREFIX}/`, '').split('/');
        if (parts[0]) versions.add(parts[0]);
      }

      const latestVersion = Array.from(versions).sort().pop();
      if (!latestVersion) throw new NotFoundException('No releases found');

      const key = `${RELEASE_PREFIX}/${latestVersion}/${filename}`;
      const content = await this.s3Service.getObjectContent(key);

      if (!content) throw new NotFoundException('File not found');

      // Rewrite download URLs in the yml to point to our presigned endpoint
      const baseUrl = `/downloads/update/file`;
      const rewritten = content.replace(
        /url: (.+)/g,
        (_, name) => {
          const encodedName = encodeURIComponent(name.trim());
          return `url: ${baseUrl}/${latestVersion}/${encodedName}`;
        },
      );

      res.setHeader('Content-Type', 'text/yaml');
      res.send(rewritten);
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      this.logger.error(`Failed to serve update file ${filename}: ${err.message}`);
      throw new NotFoundException('Update file not found');
    }
  }

  /**
   * Redirects to a presigned S3 URL for the actual installer file.
   * electron-updater calls this to download the update.
   */
  @Get('update/file/:version/:filename')
  @ApiOperation({ summary: 'Download a release file via presigned URL (public)' })
  async downloadFile(
    @Param('version') version: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const decodedFilename = decodeURIComponent(filename);
      const key = `${RELEASE_PREFIX}/${version}/${decodedFilename}`;
      const url = await this.s3Service.getPresignedUrl(key, 3600);
      res.redirect(302, url);
    } catch (err) {
      this.logger.error(`Failed to generate download URL: ${err.message}`);
      throw new NotFoundException('File not found');
    }
  }

  // ── Admin endpoints ───────────────────────────────────────────────

  @Post('notify/:version')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Email all employees about a new version (admin)' })
  async notifyNewVersion(@Param('version') version: string) {
    const employees = await this.usersService.findByRole('employee');
    const downloadUrl = `https://backend.codewyse.site/downloads/update/file/${version}`;

    let sent = 0;
    for (const emp of employees) {
      try {
        await this.emailService.sendNewVersionEmail(emp.email, version.replace(/^v/, ''), downloadUrl);
        sent++;
      } catch (err) {
        this.logger.error(`Failed to email ${emp.email} about new version: ${err.message}`);
      }
    }

    return { sent, total: employees.length };
  }

  @Get('releases')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all desktop app releases (admin)' })
  async listReleases() {
    const objects = await this.s3Service.listObjects(`${RELEASE_PREFIX}/`);

    const versionMap = new Map<
      string,
      { files: { name: string; key: string; size: number }[]; date: Date }
    >();

    for (const obj of objects) {
      const parts = obj.key.replace(`${RELEASE_PREFIX}/`, '').split('/');
      const version = parts[0];
      const filename = parts.slice(1).join('/');
      if (!filename) continue;

      if (!versionMap.has(version)) {
        versionMap.set(version, { files: [], date: obj.lastModified });
      }
      const entry = versionMap.get(version)!;
      entry.files.push({ name: filename, key: obj.key, size: obj.size });
      if (obj.lastModified > entry.date) entry.date = obj.lastModified;
    }

    return Array.from(versionMap.entries())
      .map(([version, data]) => ({
        version,
        date: data.date.toISOString(),
        files: data.files.filter((f) => /\.(exe|dmg)$/i.test(f.name)),
      }))
      .sort((a, b) => b.version.localeCompare(a.version));
  }

  @Get('presigned')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get presigned download URL for a release file' })
  async getDownloadUrl(@Query('key') key: string) {
    const url = await this.s3Service.getPresignedUrl(key, 3600);
    return { url, expiresIn: 3600 };
  }
}
