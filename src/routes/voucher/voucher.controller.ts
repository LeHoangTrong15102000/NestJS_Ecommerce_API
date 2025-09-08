import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { VoucherService } from './voucher.service'
import { ActiveUser } from '../../shared/decorators/active-user.decorator'
import { Auth } from '../../shared/decorators/auth.decorator'
import { AuthType } from '../../shared/constants/auth.constant'
import ZodValidationPipe from '../../shared/pipes/custom-zod-validation.pipe'
import {
  CreateVoucherBodySchema,
  CreateVoucherBody,
  CreateVoucherResponse,
  UpdateVoucherParamsSchema,
  UpdateVoucherParams,
  UpdateVoucherBodySchema,
  UpdateVoucherBody,
  UpdateVoucherResponse,
  ListVouchersQuerySchema,
  ListVouchersQuery,
  ListVouchersResponse,
  ListAvailableVouchersQuerySchema,
  ListAvailableVouchersQuery,
  ListAvailableVouchersResponse,
  GetVoucherDetailParamsSchema,
  GetVoucherDetailParams,
  GetVoucherDetailResponse,
  GetVoucherByCodeParamsSchema,
  GetVoucherByCodeParams,
  GetVoucherByCodeResponse,
  CollectVoucherParamsSchema,
  CollectVoucherParams,
  CollectVoucherResponse,
  ListMyVouchersQuerySchema,
  ListMyVouchersQuery,
  ListMyVouchersResponse,
  ApplyVoucherBodySchema,
  ApplyVoucherBody,
  ApplyVoucherResponse,
  DeleteVoucherParamsSchema,
  DeleteVoucherParams,
  DeleteVoucherResponse,
  GetVoucherStatsResponse,
} from './voucher.dto'
import { ActiveRolePermissions } from '../../shared/decorators/active-role-permissions.decorator'
import { Roles } from '../../shared/decorators/roles.decorator'

@Controller('vouchers')
export class VoucherController {
  constructor(private readonly voucherService: VoucherService) {}

  // ===== PUBLIC ENDPOINTS =====

  // Lấy danh sách voucher available (không cần đăng nhập)
  @Get('available')
  async getAvailableVouchers(
    @Query(new ZodValidationPipe(ListAvailableVouchersQuerySchema)) query: ListAvailableVouchersQuery,
    @ActiveUser('userId') userId?: number,
  ): Promise<ListAvailableVouchersResponse> {
    const result = await this.voucherService.getAvailableVouchers(query, userId)
    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  // Lấy voucher theo code (không cần đăng nhập)
  @Get('code/:code')
  async getVoucherByCode(
    @Param(new ZodValidationPipe(GetVoucherByCodeParamsSchema)) params: GetVoucherByCodeParams,
    @ActiveUser('userId') userId?: number,
  ): Promise<GetVoucherByCodeResponse> {
    const data = await this.voucherService.getVoucherByCode(params.code, userId)
    return { data }
  }

  // ===== USER AUTHENTICATED ENDPOINTS =====

  // Lưu voucher
  @Post(':id/collect')
  @Auth([AuthType.Bearer])
  async collectVoucher(
    @ActiveUser('userId') userId: number,
    @Param(new ZodValidationPipe(CollectVoucherParamsSchema)) params: CollectVoucherParams,
  ): Promise<CollectVoucherResponse> {
    const data = await this.voucherService.collectVoucher(userId, params.id)
    return { data }
  }

  // Lấy danh sách voucher của tôi
  @Get('my')
  @Auth([AuthType.Bearer])
  async getMyVouchers(
    @ActiveUser('userId') userId: number,
    @Query(new ZodValidationPipe(ListMyVouchersQuerySchema)) query: ListMyVouchersQuery,
  ): Promise<ListMyVouchersResponse> {
    const result = await this.voucherService.getMyVouchers(userId, query)
    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  // Áp dụng voucher
  @Post('apply')
  @Auth([AuthType.Bearer])
  async applyVoucher(
    @ActiveUser('userId') userId: number,
    @Body(new ZodValidationPipe(ApplyVoucherBodySchema)) body: ApplyVoucherBody,
  ): Promise<ApplyVoucherResponse> {
    const data = await this.voucherService.applyVoucher(userId, body)
    return { data }
  }

  // Thống kê voucher của user
  @Get('my/stats')
  @Auth([AuthType.Bearer])
  async getMyVoucherStats(@ActiveUser('userId') userId: number): Promise<GetVoucherStatsResponse> {
    const data = await this.voucherService.getUserVoucherStats(userId)
    return { data }
  }

  // ===== ADMIN/SELLER MANAGEMENT ENDPOINTS =====

  // Tạo voucher (Admin hoặc Seller)
  @Post('manage')
  @Auth([AuthType.Bearer])
  @Roles('ADMIN', 'SELLER')
  async createVoucher(
    @ActiveUser('userId') userId: number,
    @ActiveUser('roleId') roleId: number,
    @Body(new ZodValidationPipe(CreateVoucherBodySchema)) body: CreateVoucherBody,
  ): Promise<CreateVoucherResponse> {
    // Nếu là seller thì sellerId = userId, admin có thể tạo platform voucher
    const sellerId = roleId === 2 ? userId : undefined // Assuming roleId 2 is SELLER
    const data = await this.voucherService.createVoucher(body, userId, sellerId)
    return { data }
  }

  // Lấy danh sách voucher (management)
  @Get('manage')
  @Auth([AuthType.Bearer])
  @Roles('ADMIN', 'SELLER')
  async getVouchers(
    @ActiveUser('userId') userId: number,
    @ActiveUser('roleId') roleId: number,
    @Query(new ZodValidationPipe(ListVouchersQuerySchema)) query: ListVouchersQuery,
  ): Promise<ListVouchersResponse> {
    // Nếu là seller thì chỉ lấy voucher của mình
    const sellerId = roleId === 2 ? userId : query.sellerId
    const result = await this.voucherService.getVouchers(query, sellerId)
    return {
      data: result.data,
      pagination: result.pagination,
    }
  }

  // Thống kê voucher (management)
  @Get('manage/stats')
  @Auth([AuthType.Bearer])
  @Roles('ADMIN', 'SELLER')
  async getVoucherStats(
    @ActiveUser('userId') userId: number,
    @ActiveUser('roleId') roleId: number,
  ): Promise<GetVoucherStatsResponse> {
    const sellerId = roleId === 2 ? userId : undefined
    const data = await this.voucherService.getVoucherStats(sellerId)
    return { data }
  }

  // Lấy chi tiết voucher
  @Get(':id')
  async getVoucherDetail(
    @Param(new ZodValidationPipe(GetVoucherDetailParamsSchema)) params: GetVoucherDetailParams,
    @ActiveUser('userId') userId?: number,
  ): Promise<GetVoucherDetailResponse> {
    const data = await this.voucherService.getVoucherDetail(params.id, userId)
    return { data }
  }

  // Cập nhật voucher
  @Put('manage/:id')
  @Auth([AuthType.Bearer])
  @Roles('ADMIN', 'SELLER')
  async updateVoucher(
    @ActiveUser('userId') userId: number,
    @ActiveUser('roleId') roleId: number,
    @Param(new ZodValidationPipe(UpdateVoucherParamsSchema)) params: UpdateVoucherParams,
    @Body(new ZodValidationPipe(UpdateVoucherBodySchema)) body: UpdateVoucherBody,
  ): Promise<UpdateVoucherResponse> {
    const sellerId = roleId === 2 ? userId : undefined
    const data = await this.voucherService.updateVoucher(params.id, body, userId, sellerId)
    return { data }
  }

  // Xóa voucher
  @Delete('manage/:id')
  @Auth([AuthType.Bearer])
  @Roles('ADMIN', 'SELLER')
  async deleteVoucher(
    @ActiveUser('userId') userId: number,
    @ActiveUser('roleId') roleId: number,
    @Param(new ZodValidationPipe(DeleteVoucherParamsSchema)) params: DeleteVoucherParams,
  ): Promise<DeleteVoucherResponse> {
    const sellerId = roleId === 2 ? userId : undefined
    return this.voucherService.deleteVoucher(params.id, userId, sellerId)
  }
}
