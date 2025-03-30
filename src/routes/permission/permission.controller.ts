import { Controller } from '@nestjs/common'
import { PermissionService } from 'src/routes/permission/permission.service'

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}
}
