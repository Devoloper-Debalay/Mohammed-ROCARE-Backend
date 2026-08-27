import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";
import { Role } from "../../generated/prisma/enums";

type AdminScope = { role: Role; branchId?: string | null };

@injectable()
export class ProductsService {
  async products(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      prisma.product.findMany({ where: { isActive: true }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { inventory: { include: { branch: true } } } }),
      prisma.product.count({ where: { isActive: true } }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createProduct(data: any, scope: AdminScope) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) throw createHttpError(403, "Admin is not assigned to a branch.");
    const { stock = 0, branchId: _ignored, ...catalog } = data;
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: catalog });
      if (branchId) await tx.inventory.create({ data: { productId: product.id, branchId, quantity: stock } });
      return product;
    });
  }

  async updateProduct(id: string, data: any) { const { stock, branchId, ...catalog } = data; return prisma.product.update({ where: { id }, data: catalog }); }

  async parts(page = 1, limit = 20) {
    const [data, total] = await Promise.all([
      prisma.part.findMany({ where: { isActive: true }, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" }, include: { inventory: { include: { branch: true } } } }),
      prisma.part.count({ where: { isActive: true } }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPart(data: any, scope: AdminScope) {
    const branchId = scope.role === Role.ADMIN ? scope.branchId : data.branchId;
    if (scope.role === Role.ADMIN && !branchId) throw createHttpError(403, "Admin is not assigned to a branch.");
    const { stock = 0, branchId: _ignored, ...catalog } = data;
    return prisma.$transaction(async (tx) => {
      const part = await tx.part.create({ data: catalog });
      if (branchId) await tx.inventory.create({ data: { partId: part.id, branchId, quantity: stock } });
      return part;
    });
  }

  async updatePart(id: string, data: any) { const { stock, branchId, ...catalog } = data; return prisma.part.update({ where: { id }, data: catalog }); }

  async inventory(scope: AdminScope, page = 1, limit = 50) {
    const where = scope.role === Role.SADMIN ? {} : { branchId: scope.branchId! };
    const [data, total] = await Promise.all([
      prisma.inventory.findMany({ where, include: { product: true, part: true, branch: true }, skip: (page - 1) * limit, take: limit, orderBy: { updatedAt: "desc" } }),
      prisma.inventory.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async adjust(inventoryId: string, quantity: number, note: string | undefined, scope: AdminScope) {
    return prisma.$transaction(async (tx) => {
      const inv = await tx.inventory.findUnique({ where: { id: inventoryId } });
      if (!inv) throw createHttpError(404, "Inventory not found.");
      if (scope.role === Role.ADMIN && inv.branchId !== scope.branchId) throw createHttpError(403, "Resource is outside your branch scope.");
      const next = inv.quantity + quantity;
      if (next < inv.reserved || next < 0) throw createHttpError(400, "Insufficient available inventory.");
      const updated = await tx.inventory.update({ where: { id: inventoryId }, data: { quantity: next } });
      await tx.inventoryTransaction.create({ data: { inventoryId, type: "ADJUSTMENT", quantity: Math.abs(quantity), note } });
      return updated;
    });
  }
}
