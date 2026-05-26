import { Brand, Category, PrismaClient, Product, SKU, User } from '@prisma/client'
import { UserFactory } from './user.factory'

export interface ProductFactoryOptions {
  name?: string
  basePrice?: number
  virtualPrice?: number
  images?: string[]
  publishedAt?: Date | null
  createdById?: number
  brandId?: number
  categoryIds?: number[]
}

export interface ProductFactoryResult {
  product: Product
  sku: SKU
  brand: Brand
  category: Category
  createdBy: User
}

/**
 * DB-writing factory for Product records.
 * Auto-creates all required relations: User (createdBy), Brand, Category, SKU.
 * Uses global.__GLOBAL_PRISMA__ to write directly to the test database.
 */
export const ProductFactory = {
  /**
   * Create a product with all required relations.
   * Returns the product, its first SKU, brand, category, and creator user.
   */
  async create(overrides: ProductFactoryOptions = {}): Promise<ProductFactoryResult> {
    const prisma = global.__GLOBAL_PRISMA__ as PrismaClient

    // Create or reuse creator user (seller)
    let createdById = overrides.createdById
    let createdBy: User
    if (!createdById) {
      createdBy = await UserFactory.createSeller({
        email: `seller-${Date.now()}-${Math.floor(Math.random() * 10000)}@factory.test`,
      })
      createdById = createdBy.id
    } else {
      createdBy = (await prisma.user.findUniqueOrThrow({ where: { id: createdById } })) as User
    }

    // Create or reuse brand
    let brandId = overrides.brandId
    let brand: Brand
    if (!brandId) {
      brand = await prisma.brand.create({
        data: {
          name: `Brand-${Date.now()}`,
          logo: 'https://example.com/brand-logo.png',
          createdById,
        },
      })
      brandId = brand.id
    } else {
      brand = (await prisma.brand.findUniqueOrThrow({ where: { id: brandId } })) as Brand
    }

    // Create category
    let category: Category
    if (overrides.categoryIds && overrides.categoryIds.length > 0) {
      category = (await prisma.category.findUniqueOrThrow({ where: { id: overrides.categoryIds[0] } })) as Category
    } else {
      category = await prisma.category.create({
        data: {
          name: `Category-${Date.now()}`,
          createdById,
        },
      })
    }

    const categoryIds = overrides.categoryIds ?? [category.id]

    // Create product
    const product = await prisma.product.create({
      data: {
        name: overrides.name ?? `Product-${Date.now()}`,
        basePrice: overrides.basePrice ?? 100000,
        virtualPrice: overrides.virtualPrice ?? (overrides.basePrice ? overrides.basePrice * 1.2 : 120000),
        brandId,
        images: overrides.images ?? ['https://example.com/product-image.jpg'],
        variants: [{ value: 'Default', options: ['Standard'] }],
        createdById,
        publishedAt: overrides.publishedAt !== undefined ? overrides.publishedAt : new Date(),
        categories: {
          connect: categoryIds.map((id) => ({ id })),
        },
      },
    })

    // Create SKU
    const sku = await prisma.sKU.create({
      data: {
        value: 'Standard',
        price: overrides.basePrice ?? 100000,
        stock: 100,
        image: 'https://example.com/sku-image.jpg',
        productId: product.id,
        createdById,
      },
    })

    return { product, sku, brand, category, createdBy }
  },
}
