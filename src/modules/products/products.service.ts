import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";
import { CategoryType, Role } from "../../generated/prisma/enums";
import { ProductQueryDto } from "./products.dto";
import {
  uploadMultipleImages,
  uploadProductImage,
  uploadPartImage,
} from "../../utils/uploadProductImage";

type AdminScope = { role: Role; branchId?: string | null };

function parseBoolean(val: any): boolean | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  if (val === true || val === "true" || val === 1 || val === "1") return true;
  if (val === false || val === "false" || val === 0 || val === "0") return false;
  return Boolean(val);
}

function parseNumber(val: any): number | undefined {
  if (val === undefined || val === null || val === "") return undefined;
  const num = Number(val);
  return isNaN(num) ? undefined : num;
}

function parseArray(val: any): string[] | undefined {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [val];
    } catch {
      return [val];
    }
  }
  return [String(val)];
}

function parseJson(val: any): Record<string, any> | undefined {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "object") return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cleanProductInput(input: any): any {
  if (!input || typeof input !== "object") return {};
  const result: any = {};

  if (input.name !== undefined) result.name = String(input.name);
  if (input.category !== undefined) result.category = input.category || null;
  if (input.categoryId !== undefined) result.categoryId = input.categoryId || null;
  if (input.brand !== undefined) result.brand = input.brand ? String(input.brand) : null;
  if (input.description !== undefined) result.description = input.description ? String(input.description) : null;
  if (input.mrp !== undefined) result.mrp = parseNumber(input.mrp);
  if (input.price !== undefined) result.price = parseNumber(input.price);
  if (input.discountPercent !== undefined) result.discountPercent = parseNumber(input.discountPercent);
  if (input.vendorWholesalePrice !== undefined) result.vendorWholesalePrice = parseNumber(input.vendorWholesalePrice);
  if (input.bulkMinQty !== undefined) result.bulkMinQty = parseNumber(input.bulkMinQty) ?? 1;
  if (input.bulkDiscountPercent !== undefined) result.bulkDiscountPercent = parseNumber(input.bulkDiscountPercent);
  if (input.referralDiscountPercent !== undefined) result.referralDiscountPercent = parseNumber(input.referralDiscountPercent);
  if (input.isPartOnlyForVendor !== undefined) result.isPartOnlyForVendor = parseBoolean(input.isPartOnlyForVendor) ?? false;
  if (input.bulkQtyDiscount !== undefined) result.bulkQtyDiscount = parseBoolean(input.bulkQtyDiscount) ?? false;
  if (input.pv !== undefined) result.pv = parseNumber(input.pv) ?? 0;
  if (input.bv !== undefined) result.bv = parseNumber(input.bv) ?? 0;

  const stockVal = input.stock ?? input.stockQuantity ?? input.quantity;
  if (stockVal !== undefined) result.stock = parseNumber(stockVal) ?? 0;

  if (input.images !== undefined) result.images = parseArray(input.images) ?? [];
  if (input.features !== undefined) result.features = parseArray(input.features);
  if (input.specifications !== undefined) result.specifications = parseJson(input.specifications);
  if (input.isActive !== undefined) result.isActive = parseBoolean(input.isActive) ?? true;
  if (input.branchId !== undefined) result.branchId = input.branchId || null;

  return result;
}

function cleanPartInput(input: any): any {
  if (!input || typeof input !== "object") return {};
  const result: any = {};

  if (input.name !== undefined) result.name = String(input.name);
  if (input.description !== undefined) result.description = input.description ? String(input.description) : null;
  if (input.price !== undefined) result.price = parseNumber(input.price);

  const stockVal = input.stock ?? input.stockQuantity ?? input.quantity;
  if (stockVal !== undefined) result.stock = parseNumber(stockVal) ?? 0;

  if (input.images !== undefined) result.images = parseArray(input.images) ?? [];
  if (input.isActive !== undefined) result.isActive = parseBoolean(input.isActive) ?? true;

  return result;
}

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
  async createProduct(data: any, scope: AdminScope, imageBuffers?: Buffer[]) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }

    const cleanedData = cleanProductInput(data);
    let images: string[] = Array.isArray(cleanedData.images) ? [...cleanedData.images] : [];
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "rocare/products");
      images = [...images, ...uploadedUrls];
    }

    const { stock = 0, branchId: _ignored, ...catalog } = cleanedData;

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...catalog,
          images,
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

  async updateProduct(id: string, data: any, imageBuffers?: Buffer[]) {
    const cleanedData = cleanProductInput(data);
    let images = cleanedData.images as string[] | undefined;
    if (imageBuffers && imageBuffers.length > 0) {
      const existing = await prisma.product.findUnique({ where: { id } });
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "rocare/products");
      const baseImages = images !== undefined ? (Array.isArray(images) ? images : []) : existing?.images ?? [];
      images = [...baseImages, ...uploadedUrls];
    }

    const { stock, branchId, ...catalog } = cleanedData;
    const updateData: any = {
      ...catalog,
      ...(stock !== undefined ? { stock } : {}),
    };
    if (images !== undefined) {
      updateData.images = images;
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
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

  async createPart(data: any, scope: AdminScope, imageBuffers?: Buffer[]) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) {
      throw createHttpError(403, "Admin is not assigned to a branch.");
    }

    const cleanedData = cleanPartInput(data);
    let images: string[] = Array.isArray(cleanedData.images) ? [...cleanedData.images] : [];
    if (imageBuffers && imageBuffers.length > 0) {
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "rocare/parts");
      images = [...images, ...uploadedUrls];
    }

    const { stock = 0, branchId: _ignored, ...catalog } = cleanedData;
    return prisma.$transaction(async (tx) => {
      const part = await tx.part.create({ data: { ...catalog, images } });
      if (branchId) {
        await tx.inventory.create({
          data: { partId: part.id, branchId, quantity: stock },
        });
      }
      return part;
    });
  }

  async updatePart(id: string, data: any, imageBuffers?: Buffer[]) {
    const cleanedData = cleanPartInput(data);
    let images = cleanedData.images as string[] | undefined;
    if (imageBuffers && imageBuffers.length > 0) {
      const existing = await prisma.part.findUnique({ where: { id } });
      const uploadedUrls = await uploadMultipleImages(imageBuffers, "rocare/parts");
      const baseImages = images !== undefined ? (Array.isArray(images) ? images : []) : existing?.images ?? [];
      images = [...baseImages, ...uploadedUrls];
    }

    const updateData: any = { ...cleanedData };
    if (images !== undefined) {
      updateData.images = images;
    }
    return prisma.part.update({ where: { id }, data: updateData });
  }

  async uploadProductImage(fileBuffer: Buffer) {
    return uploadProductImage(fileBuffer, "rocare/products");
  }

  async uploadPartImage(fileBuffer: Buffer) {
    return uploadPartImage(fileBuffer, "rocare/parts");
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
