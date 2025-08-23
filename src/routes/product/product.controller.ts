import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ZodResponse } from 'nestjs-zod'
import {
  CreateProductBodyDTO,
  GetProductDetailResDTO,
  GetProductParamsDTO,
  GetProductsQueryDTO,
  GetProductsResDTO,
  ProductDTO,
  UpdateProductBodyDTO,
} from 'src/routes/product/product.dto'
import { ProductService } from 'src/routes/product/product.service'
import { IsPublic } from 'src/shared/decorators/auth.decorator'

@Controller('products')
@IsPublic()
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  @ZodResponse({ type: GetProductsResDTO })
  list(@Query() query: GetProductsQueryDTO) {
    return this.productService.list({
      query,
    })
  }

  @Get(':productId')
  @ZodResponse({ type: GetProductDetailResDTO })
  findById(@Param() params: GetProductParamsDTO) {
    return this.productService.getDetail({
      productId: params.productId,
    })
  }
}
