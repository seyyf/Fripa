import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AccountService } from './account.service';
import { AccountGuard } from './account.guard';

@Controller('account')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('request-otp')
  requestOtp(@Body() body: { phone: string }) {
    return this.account.requestOtp(body?.phone);
  }

  @Post('verify-otp')
  verifyOtp(@Body() body: { phone: string; code: string }) {
    return this.account.verifyOtp(body?.phone, body?.code);
  }

  @UseGuards(AccountGuard)
  @Get('me')
  me(@Req() req: { userId: string }) {
    return this.account.me(req.userId);
  }

  @UseGuards(AccountGuard)
  @Patch('me')
  updateMe(@Req() req: { userId: string }, @Body() body: { name?: string; address?: string; email?: string }) {
    return this.account.updateMe(req.userId, body);
  }

  @UseGuards(AccountGuard)
  @Get('orders')
  orders(@Req() req: { userId: string }) {
    return this.account.orders(req.userId);
  }

  @UseGuards(AccountGuard)
  @Get('favorites')
  favorites(@Req() req: { userId: string }) {
    return this.account.favorites(req.userId);
  }

  @UseGuards(AccountGuard)
  @Post('favorites')
  addFavorite(@Req() req: { userId: string }, @Body() body: { itemId: string }) {
    return this.account.addFavorite(req.userId, body?.itemId);
  }

  @UseGuards(AccountGuard)
  @Delete('favorites/:itemId')
  removeFavorite(@Req() req: { userId: string }, @Param('itemId') itemId: string) {
    return this.account.removeFavorite(req.userId, itemId);
  }

  @UseGuards(AccountGuard)
  @Post('favorites/sync')
  sync(@Req() req: { userId: string }, @Body() body: { itemIds: string[] }) {
    return this.account.syncFavorites(req.userId, body?.itemIds);
  }
}
