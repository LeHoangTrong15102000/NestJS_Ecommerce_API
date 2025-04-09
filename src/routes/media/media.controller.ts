import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  ParseFilePipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'

@Controller('media')
export class MediaController {
  contrucstor() {}

  @Post('images/upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 }), // 2MB;
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }), // jpg/ jpeg/png/webp
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    console.log('object file', file)
  }
}
