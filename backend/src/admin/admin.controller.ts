import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from './admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // Exchange the admin password for a JWT. Returns 401 on a bad password.
  @Post('login')
  login(@Body() body: { password?: string }) {
    return this.admin.login(body?.password ?? '');
  }

  // Lightweight probe the frontend uses to confirm a stored token is still valid.
  @Get('me')
  @UseGuards(AdminGuard)
  me() {
    return { ok: true, role: 'admin' };
  }
}
