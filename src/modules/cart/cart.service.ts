import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";

@injectable()
export class CartService {
  private async isVendorUser(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true, phone: true },
    });
    if (user?.role === "VENDOR") return true;
    const vendor = await prisma.vendor.findFirst({
      where: {
        OR: [
          { email: user?.email || undefined },
          { phone: user?.phone || undefined },
        ],
      },
    });
    return !!vendor;
  }

  async get(userId: string) {
    let cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: { dynamicCategory: true },
            },
          },
        },
      },
    });

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId },
        include: {
          items: {
            include: {
              product: {
                include: { dynamicCategory: true },
              },
            },
          },
        },
      });
    }

    const isVendor = await this.isVendorUser(userId);

    // Calculate cart summary (MRP, discount, bulk discounts, total)
    let subtotal = 0;
    let mrpTotal = 0;
    let savings = 0;

    const itemsWithPricing = cart.items.map((item) => {
      const p = item.product;
      const mrp = Number(p.mrp || p.price);
      let unitPrice = Number(p.price) * (1 - Number(p.discountPercent || 0) / 100);

      // Vendor / Bulk Quantity wholesale price check
      if (isVendor && p.vendorWholesalePrice) {
        unitPrice = Number(p.vendorWholesalePrice);
      } else if (p.bulkMinQty && item.quantity >= p.bulkMinQty && p.bulkDiscountPercent) {
        unitPrice = unitPrice * (1 - Number(p.bulkDiscountPercent) / 100);
      }

      const itemTotal = unitPrice * item.quantity;
      subtotal += itemTotal;
      mrpTotal += mrp * item.quantity;

      return {
        ...item,
        unitPrice,
        mrp,
        itemTotal,
      };
    });

    savings = Math.max(0, mrpTotal - subtotal);

    return {
      id: cart.id,
      userId: cart.userId,
      items: itemsWithPricing,
      summary: {
        itemCount: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        mrpTotal: Math.round(mrpTotal * 100) / 100,
        subtotal: Math.round(subtotal * 100) / 100,
        savings: Math.round(savings * 100) / 100,
      },
    };
  }

  async add(userId: string, productId: string, quantity: number) {
    if (quantity < 1) throw createHttpError(400, "Quantity must be at least 1.");

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw createHttpError(404, "Product not found.");

    // Check vendor-only restriction for parts
    if (product.isPartOnlyForVendor) {
      const isVendor = await this.isVendorUser(userId);
      if (!isVendor) {
        throw createHttpError(
          403,
          "This product or spare part is restricted to registered technicians/vendors only."
        );
      }
    }

    const cart = await prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const existing = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
    });

    const next = (existing?.quantity ?? 0) + quantity;
    if (next > product.stock) {
      throw createHttpError(400, `Requested quantity exceeds available stock (${product.stock}).`);
    }

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: next },
      });
    } else {
      await prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }

    return this.get(userId);
  }

  async update(userId: string, productId: string, quantity: number) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw createHttpError(404, "Cart not found.");

    const item = await prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId: cart.id, productId } },
      include: { product: true },
    });

    if (!item) throw createHttpError(404, "Cart item not found.");
    if (quantity < 1) return this.remove(userId, productId);
    if (quantity > item.product.stock) {
      throw createHttpError(400, `Requested quantity exceeds available stock (${item.product.stock}).`);
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: { quantity },
    });

    return this.get(userId);
  }

  async remove(userId: string, productId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    return this.get(userId);
  }

  async clear(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }
    return this.get(userId);
  }
}
