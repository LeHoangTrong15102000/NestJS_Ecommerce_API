import {
  Controller,
  FileTypeValidator,
  Get,
  MaxFileSizeValidator,
  NotFoundException,
  Param,
  ParseFilePipe,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Response } from 'express'
import path from 'path'
import envConfig from 'src/shared/config'
import { UPLOAD_DIR } from 'src/shared/constants/other.constant'
import { IsPublic } from 'src/shared/decorators/auth.decorator'

@Controller('media')
export class MediaController {
  contrucstor() {}

  @Post('images/upload')
  @UseInterceptors(
    FilesInterceptor('files', 100, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 2MB;
      },
    }),
  )
  uploadFile(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 2MB;
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }), // jpg/ jpeg/png/webp
        ],
      }),
    )
    files: Array<Express.Multer.File>,
  ) {
    console.log('object files', files)
    return files.map((file) => ({
      url: `${envConfig.PREFIX_STATIC_ENDPOINT}/${file.filename}`,
    }))
  }

  @Get('static/:filename')
  @IsPublic()
  serveFile(@Param('filename') filename: string, @Res() res: Response) {
    // console.log(filename)
    // Truyền vào cái đường dẫn mà dẫn đến cái  file đó là được -> Thì là sự kết hợp của UPLOAD_DIR và filename
    const notfound = new NotFoundException('File not found')
    return res.sendFile(path.resolve(UPLOAD_DIR, filename), (error) => {
      if (error) {
        // Trả về như này cho nó quy chuẩn lại lỗi trả về
        res.status(notfound.getStatus()).json(notfound.getResponse())
      }
    })
  }
}
