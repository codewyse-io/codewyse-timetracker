import {
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoogleCalendarService } from './google-calendar.service';

@ApiTags('Google Calendar')
@Controller('google-calendar')
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get('auth-url')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getAuthUrl(@Req() req: any) {
    const url = await this.googleCalendarService.getAuthUrl(
      req.user.id,
      req.user.organizationId,
    );
    return { url };
  }

  @Get('callback')
  async handleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    await this.googleCalendarService.handleCallback(code, state);
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html>
        <head><title>Google Calendar Connected</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;font-family:sans-serif;">
          <div style="text-align:center;">
            <h2>Google Calendar Connected!</h2>
            <p>You can close this window now.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </div>
        </body>
      </html>
    `);
  }

  @Get('status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getStatus(@Req() req: any) {
    return this.googleCalendarService.getConnectionStatus(req.user.id);
  }

  @Post('disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnect(@Req() req: any) {
    await this.googleCalendarService.disconnect(req.user.id);
    return { message: 'Google Calendar disconnected successfully' };
  }

  @Post('sync')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async sync(@Req() req: any) {
    await this.googleCalendarService.syncCalendarEvents(req.user.id);
    return { message: 'Calendar sync completed' };
  }
}
