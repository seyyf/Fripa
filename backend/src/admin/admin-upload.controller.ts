import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AdminGuard } from './admin.guard';

const UPLOAD_DIR = 'uploads';
const ALLOWED = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

@Controller('admin/upload')
@UseGuards(AdminGuard)
export class AdminUploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          const name = `img-${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
      fileFilter: (_req, file, cb) => {
        const ok = ALLOWED.includes(extname(file.originalname).toLowerCase());
        cb(ok ? null : new BadRequestException('Format d’image non supporté.'), ok);
      },
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    // Public path served by the static middleware in main.ts.
    return { url: `/api/uploads/${file.filename}` };
  }
}
