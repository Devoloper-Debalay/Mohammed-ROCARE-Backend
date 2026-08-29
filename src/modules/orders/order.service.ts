import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";
import { OrderStatus } from "../../generated/prisma/enums";
import { logActivity, sendMailSafe, simpleEmail } from "../../utils/serviceEvents";

@injectable()
export class OrderService {
  private async priceItems(items: { productId: string; quantity: number }[]) {
    if (!items.length) throw createHttpError(400, "Cart is empty.");

    const products = await prisma.product.findMany({
      where: {
        id: { in: items.map((x) => x.productId) },
        isActive: true,
      },
    });

    const map = new Map(products.map((p) => [p.id, p]));
    let total = 0;

    for (const i of items) {
      const p = map.get(i.productId);

      if (!p) throw createHttpError(404, `Product ${i.productId} not found.`);
      if (i.quantity < 1 || i.quantity > p.stock)
        throw createHttpError(400, `Insufficient stock for ${p.name}.`);

      const price =
        Number(p.price) * (1 - Number(p.discountPercent || 0) / 100);

      total += price * i.quantity;
    }

    return { products, map, total };
  }

  async checkout(
    userId: string,
    input: { deliveryAddress?: string; branchId?: string }
  ) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart || !cart.items.length)
      throw createHttpError(400, "Cart is empty.");

    const { map, total } = await this.priceItems(cart.items);

    const order = await prisma.$transaction(async (tx) => {
      for (const i of cart.items) {
        const p = await tx.product.findUnique({
          where: { id: i.productId },
        });

        if (!p || p.stock < i.quantity)
          throw createHttpError(
            409,
            "Stock changed. Please review your cart."
          );

        await tx.product.update({
          where: { id: p.id },
          data: {
            stock: { decrement: i.quantity },
          },
        });
      }

      const created = await tx.order.create({
        data: {
          customerId: userId,
          totalAmount: total,
          deliveryAddress: input.deliveryAddress,
          branchId: input.branchId,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: map.get(i.productId)!.price,
            })),
          },
        },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });

      await tx.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      return created;
    });

    await logActivity(userId, "ORDER_CREATED", {
      orderId: order.id,
      total: Number(order.totalAmount),
    });

    await sendMailSafe({
      to: (order as any).customer?.email,
      subject: "ROCARE order created",
      html: simpleEmail(
        "Order created",
        `Your order ${order.id} has been created successfully.`
      ),
    });

    return order;
  }

  async buyNow(userId: string, input: any) {
    const { products, map, total } = await this.priceItems([
      {
        productId: input.productId,
        quantity: input.quantity,
      },
    ]);

    const order = await prisma.$transaction(async (tx) => {
      const p = products[0];

      const fresh = await tx.product.findUnique({
        where: { id: p.id },
      });

      if (!fresh || fresh.stock < input.quantity)
        throw createHttpError(409, "Insufficient stock.");

      await tx.product.update({
        where: { id: p.id },
        data: {
          stock: { decrement: input.quantity },
        },
      });

      return tx.order.create({
        data: {
          customerId: userId,
          totalAmount: total,
          deliveryAddress: input.deliveryAddress,
          branchId: input.branchId,
          items: {
            create: {
              productId: p.id,
              quantity: input.quantity,
              price: p.price,
            },
          },
        },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
        },
      });
    });

    await logActivity(userId, "ORDER_CREATED", {
      orderId: order.id,
      total: Number(order.totalAmount),
      mode: "BUY_NOW",
    });

    await sendMailSafe({
      to: (order as any).customer?.email,
      subject: "ROCARE order created",
      html: simpleEmail(
        "Order created",
        `Your order ${order.id} has been created successfully.`
      ),
    });

    return order;
  }

  listMine(userId: string, page = 1, limit = 20) {
    const where = { customerId: userId };

    return Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: true } },
          payments: true,
          assignedVendor: true,
        },
      }),
      prisma.order.count({ where }),
    ]).then(([data, total]) => ({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }));
  }

  async detailMine(userId: string, id: string) {
    const o = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
        assignedVendor: true,
      },
    });

    if (!o || o.customerId !== userId)
      throw createHttpError(404, "Order not found.");

    return o;
  }

  async cancel(userId: string, id: string) {
    const o = await this.detailMine(userId, id);

    if (
      !([OrderStatus.PENDING, OrderStatus.ACCEPTED] as OrderStatus[]).includes(
        o.status
      )
    )
      throw createHttpError(
        409,
        "Order can no longer be cancelled."
      );

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.CANCELLED,
      },
      include: {
        customer: true,
      },
    });

    await logActivity(userId, "ORDER_CANCELLED", {
      orderId: id,
    });

    await sendMailSafe({
      to: (updated as any).customer?.email,
      subject: "ROCARE order cancelled",
      html: simpleEmail(
        "Order cancelled",
        `Your order ${id} has been cancelled.`
      ),
    });

    return updated;
  }

  adminList(page = 1, limit = 20, branchId?: string) {
    const where = branchId ? { branchId } : {};

    return Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: true } },
          payments: true,
          customer: true,
          assignedVendor: true,
          branch: true,
        },
      }),
      prisma.order.count({ where }),
    ]).then(([data, total]) => ({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }));
  }

  async adminStatus(
    id: string,
    status: OrderStatus,
    completionPhoto?: string
  ) {
    const o = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
      },
    });

    if (!o) throw createHttpError(404, "Order not found.");

    if (
      status === OrderStatus.COMPLETED &&
      !completionPhoto &&
      !o.completionPhoto
    )
      throw createHttpError(
        400,
        "Completion photo is required."
      );

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        completionPhoto,
      },
      include: {
        customer: true,
      },
    });

    await logActivity(o.customerId, "ORDER_STATUS_UPDATED", {
      orderId: id,
      status,
    });

    await sendMailSafe({
      to: (updated as any).customer?.email,
      subject: "ROCARE order update",
      html: simpleEmail(
        "Order status updated",
        `Your order ${id} is now ${status}.`
      ),
    });

    return updated;
  }

  async assignVendor(id: string, vendorId: string) {
    const [o, v] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        include: {
          customer: true,
        },
      }),
      prisma.vendor.findUnique({
        where: { id },
      }),
    ]);

    if (!o) throw createHttpError(404, "Order not found.");

    if (
      !v ||
      (v.role !== "AGENT" && v.role !== "TECHNICIAN") ||
      v.deletedAt ||
      v.verificationStatus !== "VERIFIED" ||
      v.profileStatus !== "PUBLISHED"
    )
      throw createHttpError(
        400,
        "Vendor is not eligible."
      );

    const updated = await prisma.order.update({
      where: { id },
      data: {
        assignedVendorId: vendorId,
        status: OrderStatus.ACCEPTED,
      },
    });

    await logActivity(o.customerId, "ORDER_VENDOR_ASSIGNED", {
      orderId: id,
      vendorId,
    });

    await sendMailSafe({
      to: (o as any).customer?.email,
      subject: "ROCARE order accepted",
      html: simpleEmail(
        "Order accepted",
        `Your order ${id} has been accepted and assigned for processing.`
      ),
    });

    await sendMailSafe({
      to: v.email,
      subject: "New ROCARE order assigned",
      html: simpleEmail(
        "New order assigned",
        `You have been assigned order ${id}.`
      ),
    });

    return updated;
  }

  async vendorList(vendorId: string, page = 1, limit = 20) {
    const where = { assignedVendorId: vendorId };

    return Promise.all([
      prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      }),
      prisma.order.count({ where }),
    ]).then(([data, total]) => ({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }));
  }
}