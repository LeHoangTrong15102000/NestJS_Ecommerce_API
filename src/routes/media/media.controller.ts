import {
  Body,
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import { ZodResponse } from 'nestjs-zod'
import path from 'path'
import { PresignedUploadFileBodyDTO, PresignedUploadFileResDTO, UploadFilesResDTO } from 'src/routes/media/media.dto'
import { MediaService } from 'src/routes/media/media.service'
import { ParseFilePipeWithUnlink } from 'src/routes/media/parse-file-pipe-with-unlink.pipe'
import { UPLOAD_DIR } from 'src/shared/constants/other.constant'
import { IsPublic } from 'src/shared/decorators/auth.decorator'

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('images/upload')
  @ZodResponse({ type: UploadFilesResDTO })
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB;
      },
    }),
  )
  uploadFile(
    @UploadedFiles(
      new ParseFilePipeWithUnlink({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB;
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }), // jpg/ jpeg/png/webp
        ],
      }),
    )
    files: Array<Express.Multer.File>,
  ) {
    return this.mediaService.uploadFile(files)
  }

  // Cái route này dùng để test thử cái trường hợp nếu mà cái đường dẫn file được bảo vệ trong dự án thực tế thì sẽ như thế nào -> Custom Guard(accessTokenGuard) để mà chặn những cái request chưa được xác thực
  @Get('static/:filename')
  @IsPublic()
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // Security: Prevent path traversal — reject filenames containing directory separators
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      const notfound = new NotFoundException('File not found')
      return res.status(notfound.getStatus()).json(notfound.getResponse())
    }

    const filePath = path.resolve(UPLOAD_DIR, filename)
    // Verify resolved path is still within UPLOAD_DIR (defense in depth)
    if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
      const notfound = new NotFoundException('File not found')
      return res.status(notfound.getStatus()).json(notfound.getResponse())
    }

    const notfound = new NotFoundException('File not found')
    return res.sendFile(filePath, (error) => {
      if (error) {
        res.status(notfound.getStatus()).json(notfound.getResponse())
      }
    })
  }

  // getPresignedUrl — requires authentication to prevent anonymous uploads
  @Post('images/upload/presigned-url')
  @ZodResponse({ type: PresignedUploadFileResDTO })
  async createPresignedUrl(@Body() body: PresignedUploadFileBodyDTO) {
    return this.mediaService.getPresignedUrl(body)
  }
}
