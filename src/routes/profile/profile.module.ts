import { Module } from '@nestjs/common'
import { ProfileController } from 'src/routes/profile/profile.controller'
import { ProfileService } from 'src/routes/profile/profile.service'

@Module({
  providers: [ProfileService],
  controllers: [ProfileController],
})
export class ProfileModule {}
