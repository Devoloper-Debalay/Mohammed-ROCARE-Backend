import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";
import { CategoryType, Role } from "../../generated/prisma/enums";
import { ProductQueryDto } from "./products.dto";

type AdminScope = { role: Role; branchId?: string | null };

@injectable()
export class ProductsService {
  /**
   * Search & browse products with Amazon-style filtering, sorting, pagination
   */
  async products(query: ProductQueryDto) {
    const {
      page = 1,
      limit = 20,
      search,
      category,
      categoryId,
      brand,
      minPrice,
      maxPrice,
      sort,
      isVendorOnly,
    } = query;

    const where: any = { isActive: true };

    if (isVendorOnly !== undefined) {
      where.isPartOnlyForVendor = isVendorOnly;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    } else if (category) {
      where.OR = [
        { category: category as any },
        { dynamicCategory: { slug: category } },
      ];
    }

    if (brand) {
      where.brand = { contains: brand, mode: "insensitive" };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    let orderBy: any = { createdAt: "desc" };
    if (sort === "price_asc") orderBy = { price: "asc" };
    else if (sort === "price_desc") orderBy = { price: "desc" };
    else if (sort === "rating") orderBy = { rating: "desc" };
    else if (sort === "newest") orderBy = { createdAt: "desc" };

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
        include: {
          dynamicCategory: true,
          inventory: { include: { branch: true } },
          _count: { select: { reviews: true } },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single product detail with reviews
   */
  async getProductById(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        dynamicCategory: true,
        reviews: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                profilePhoto: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        inventory: { include: { branch: true } },
      },
    });

    if (!product || !product.isActive) {
      throw createHttpError(404, "Product not found.");
    }

    return product;
  }

  /**
   * Add a product review and update product average rating
   */
  async addReview(
    productId: string,
    userId: string,
    data: { rating: number; title?: string; comment?: string; images?: string[] }
  ) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw createHttpError(404, "Product not found.");

    // Check if user actually ordered the product (verified purchase)
    const orderCount = await prisma.orderItem.count({
      where: {
        productId,
        order: { customerId: userId, status: "COMPLETED" },
      },
    });

    const review = await prisma.productReview.create({
      data: {
        productId,
        userId,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        images: data.images || [],
        verifiedPurchase: orderCount > 0,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Recalculate average rating for product
    const stats = await prisma.productReview.aggregate({
      where: { productId },
      _avg: { rating: true },
      _count: true,
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        rating: stats._avg.rating || data.rating,
        ratingCount: stats._count,
      },
    });

    return review;
  }

  /**
   * List reviews of a product
   */
  async getProductReviews(productId: string, page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      prisma.productReview.findMany({
        where: { productId },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, profilePhoto: true } },
        },
      }),
      prisma.productReview.count({ where: { productId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Dynamic Categories
   */
  async categories(type?: CategoryType) {
    const where = type ? { type, isActive: true } : { isActive: true };
    return prisma.category.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: true, services: true } },
      },
    });
  }

  async createCategory(data: any) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return prisma.category.create({
      data: {
        ...data,
        slug,
      },
    });
  }

  async updateCategory(id: string, data: any) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  async deleteCategory(id: string) {
    return prisma.category.delete({
      where: { id },
    });
  }

  /**
   * Services / Catalogue
   */
  async catalogue(categoryId?: string) {
    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    return prisma.service.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { dynamicCategory: true },
    });
  }

  /**
   * Admin Product CRUD
   */
  async createProduct(data: any, scope: AdminScope) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }
    const { stock = 0, branchId: _ignored, ...catalog } = data;

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...catalog,
          branchId,
          stock,
        },
      });
      if (branchId) {
        await tx.inventory.create({
          data: { productId: product.id, branchId, quantity: stock },
        });
      }
      return product;
    });
  }

  async updateProduct(id: string, data: any) {
    const { stock, branchId, ...catalog } = data;
    return prisma.product.update({
      where: { id },
      data: {
        ...catalog,
        ...(stock !== undefined ? { stock } : {}),
      },
    });
  }

  async deleteProduct(id: string) {
    return prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Spare Parts Catalog (restricted to vendors)
   */
  async parts(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      prisma.part.findMany({
        where: { isActive: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: { inventory: { include: { branch: true } } },
      }),
      prisma.part.count({ where: { isActive: true } }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPart(data: any, scope: AdminScope) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }
    const { stock = 0, branchId: _ignored, ...catalog } = data;
    return prisma.$transaction(async (tx) => {
      const part = await tx.part.create({ data: catalog });
      if (branchId) {
        await tx.inventory.create({
          data: { partId: part.id, branchId, quantity: stock },
        });
      }
      return part;
    });
  }

  async updatePart(id: string, data: any) {
    const { stock, branchId, ...catalog } = data;
    return prisma.part.update({ where: { id }, data: catalog });
  }

  async inventory(scope: AdminScope, page = 1, limit = 50) {
    const where = scope.role === Role.SADMIN ? {} : { branchId: scope.branchId! };
    const [data, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: { product: true, part: true, branch: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: "desc" },
      }),
      prisma.inventory.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async adjust(inventoryId: string, quantity: number, note: string | undefined, scope: AdminScope) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { id: inventoryId } });
      if (!inv) throw createHttpError(404, "Inventory not found.");
      if (scope.role === Role.ADMIN && inv.branchId !== scope.branchId) {
        throw createHttpError(403, "Resource is outside your branch scope.");
      }
      const next = inv.quantity + quantity;
      if (next < inv.reserved || next < 0) {
        throw createHttpError(400, "Insufficient available inventory.");
      }
      const updated = await tx.inventory.update({
        where: { id: inventoryId },
        data: { quantity: next },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryId,
          type: "ADJUSTMENT",
          quantity: Math.abs(quantity),
          note,
        },
      });
      return updated;
    });
  }
}
