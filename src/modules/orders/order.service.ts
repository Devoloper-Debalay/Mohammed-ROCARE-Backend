import { injectable, inject } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";
import { OrderStatus, PaymentStatus } from "../../generated/prisma/enums";
import { logActivity, sendMailSafe, simpleEmail } from "../../utils/serviceEvents";
import { MlmService } from "../mlm/mlm.service";

@injectable()
export class OrderService {
  constructor(@inject(MlmService) private readonly mlmService: MlmService) {}

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

  private async priceItems(
    userId: string,
    items: { productId: string; quantity: number }[],
    referralCode?: string
  ) {
    if (!items.length) throw createHttpError(400, "Cart is empty.");

    const isVendor = await this.isVendorUser(userId);
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
      if (i.quantity < 1 || i.quantity > p.stock) {
        throw createHttpError(400, `Insufficient stock for ${p.name}.`);
      }

      // Check vendor-only restriction for parts
      if (p.isPartOnlyForVendor && !isVendor) {
        throw createHttpError(
          403,
          `Item ${p.name} is only available for registered technicians and vendors.`
        );
      }

      let unitPrice = Number(p.price) * (1 - Number(p.discountPercent || 0) / 100);

      // Bulk Wholesale / Vendor Price
      if (isVendor && p.vendorWholesalePrice) {
        unitPrice = Number(p.vendorWholesalePrice);
      } else if (p.bulkMinQty && i.quantity >= p.bulkMinQty && p.bulkDiscountPercent) {
        unitPrice = unitPrice * (1 - Number(p.bulkDiscountPercent) / 100);
      }

      // Referral Discount
      if (referralCode && p.referralDiscountPercent) {
        unitPrice = unitPrice * (1 - Number(p.referralDiscountPercent) / 100);
      }

      total += unitPrice * i.quantity;
    }

    return { products, map, total: Math.round(total * 100) / 100 };
  }

  async checkout(
    userId: string,
    input: { deliveryAddress?: string; branchId?: string; referralCode?: string }
  ) {
    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: { items: true },
    });

    if (!cart || !cart.items.length) {
      throw createHttpError(400, "Cart is empty.");
    }

    // Attach sponsor if referral code provided and user doesn't have sponsor
    if (input.referralCode) {
      const sponsorId = await this.resolveSponsorId(input.referralCode, userId);
      if (sponsorId) {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser && !currentUser.sponsorId) {
          await prisma.user.update({
            where: { id: userId },
            data: { sponsorId },
          });
        }
      }
    }

    const { map, total } = await this.priceItems(userId, cart.items, input.referralCode);

    const order = await prisma.$transaction(async (tx) => {
      for (const i of cart.items) {
        const p = await tx.product.findUnique({ where: { id: i.productId } });
        if (!p || p.stock < i.quantity) {
          throw createHttpError(409, "Stock changed. Please review your cart.");
        }

        await tx.product.update({
          where: { id: p.id },
          data: { stock: { decrement: i.quantity } },
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
          items: true,
          customer: true,
        },
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return created;
    });

    await logActivity(userId, "ORDER_CREATED", {
      orderId: order.id,
      total: Number(order.totalAmount),
    });

    await sendMailSafe({
      to: (order as any).customer?.email,
      subject: "Just24You order created",
      html: simpleEmail(
        "Order created",
        `Your order ${order.id} has been created successfully. Total: ₹${order.totalAmount}`
      ),
    });

    return order;
  }

  private async resolveSponsorId(
    referralCode: string,
    currentUserId: string
  ): Promise<string | undefined> {
    const trimmed = referralCode.trim();
    const sponsorUser = await prisma.user.findFirst({
      where: { referralCode: trimmed },
    });
    if (sponsorUser && sponsorUser.id !== currentUserId) {
      return sponsorUser.id;
    }
    const sponsorVendor = await prisma.vendor.findFirst({
      where: { referralCode: trimmed },
    });
    if (sponsorVendor) {
      let linkedUser = await prisma.user.findFirst({
        where: {
          OR: [
            ...(sponsorVendor.email ? [{ email: sponsorVendor.email }] : []),
            { phone: sponsorVendor.phone },
          ],
        },
      });
      if (!linkedUser) {
        linkedUser = await prisma.user.create({
          data: {
            firstName: sponsorVendor.fullName.split(" ")[0] || "Vendor",
            lastName: sponsorVendor.fullName.split(" ").slice(1).join(" ") || "",
            email:
              sponsorVendor.email ||
              `${sponsorVendor.phone.replace(/\D/g, "")}@vendor.just24you.local`,
            phone: sponsorVendor.phone,
            password: sponsorVendor.password,
            role: "VENDOR" as any,
            referralCode: sponsorVendor.referralCode,
          },
        });
      }
      if (linkedUser.id !== currentUserId) {
        return linkedUser.id;
      }
    }
    return undefined;
  }

  async buyNow(userId: string, input: any) {
    if (input.referralCode) {
      const sponsorId = await this.resolveSponsorId(input.referralCode, userId);
      if (sponsorId) {
        const currentUser = await prisma.user.findUnique({ where: { id: userId } });
        if (currentUser && !currentUser.sponsorId) {
          await prisma.user.update({
            where: { id: userId },
            data: { sponsorId },
          });
        }
      }
    }

    const { products, total } = await this.priceItems(
      userId,
      [{ productId: input.productId, quantity: input.quantity }],
      input.referralCode
    );

    const order = await prisma.$transaction(async (tx) => {
      const p = products[0];
      const fresh = await tx.product.findUnique({ where: { id: p.id } });

      if (!fresh || fresh.stock < input.quantity) {
        throw createHttpError(409, "Insufficient stock.");
      }

      await tx.product.update({
        where: { id: p.id },
        data: { stock: { decrement: input.quantity } },
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
      subject: "Just24You order created",
      html: simpleEmail(
        "Order created",
        `Your order ${order.id} has been created successfully. Total: ₹${order.totalAmount}`
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

    if (!o || o.customerId !== userId) {
      throw createHttpError(404, "Order not found.");
    }

    return o;
  }

  async cancel(userId: string, id: string) {
    const o = await this.detailMine(userId, id);

    if (!([OrderStatus.PENDING, OrderStatus.ACCEPTED] as OrderStatus[]).includes(o.status)) {
      throw createHttpError(409, "Order can no longer be cancelled.");
    }

    // Restore stock
    await prisma.$transaction(async (tx) => {
      for (const item of o.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    await logActivity(userId, "ORDER_CANCELLED", { orderId: id });
    await sendMailSafe({
      to: (o as any).customer?.email,
      subject: "Just24You order cancelled",
      html: simpleEmail("Order cancelled", `Your order ${id} has been cancelled.`),
    });

    return { id, status: OrderStatus.CANCELLED };
  }

  async adminList(query: {
    page?: number;
    limit?: number;
    branchId?: string;
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    search?: string;
  }) {
    const { page = 1, limit = 20, branchId, status, paymentStatus, search } = query;
    const where: any = {};

    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { customer: { firstName: { contains: search, mode: "insensitive" } } },
        { customer: { lastName: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [data, total] = await Promise.all([
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

  async adminDetail(id: string) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        payments: true,
        customer: true,
        assignedVendor: true,
        branch: true,
        mlmCommissions: { include: { user: true, vendor: true } },
      },
    });

    if (!order) throw createHttpError(404, "Order not found.");
    return order;
  }

  async adminStatus(id: string, status: OrderStatus, completionPhoto?: string) {
    const o = await prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!o) throw createHttpError(404, "Order not found.");

    if (status === OrderStatus.COMPLETED && !completionPhoto && !o.completionPhoto) {
      // Optional if admin is completing, but let's allow
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        status,
        completionPhoto: completionPhoto || o.completionPhoto,
      },
      include: { customer: true },
    });

    // When status changes to COMPLETED, trigger MLM commission distribution!
    if (status === OrderStatus.COMPLETED) {
      await this.mlmService.distributeOrderCommissions(id).catch((err) => {
        console.error("[MLM Error on order complete]", err);
      });
    }

    await logActivity(o.customerId, "ORDER_STATUS_UPDATED", {
      orderId: id,
      status,
    });

    await sendMailSafe({
      to: (updated as any).customer?.email,
      subject: "Just24You order update",
      html: simpleEmail("Order status updated", `Your order ${id} is now ${status}.`),
    });

    return updated;
  }

  async adminPaymentStatus(id: string, paymentStatus: PaymentStatus, transactionId?: string) {
    const o = await prisma.order.findUnique({ where: { id } });
    if (!o) throw createHttpError(404, "Order not found.");

    const updated = await prisma.order.update({
      where: { id },
      data: { paymentStatus },
    });

    if (paymentStatus === PaymentStatus.PAID && o.status === OrderStatus.COMPLETED) {
      await this.mlmService.distributeOrderCommissions(id).catch((err) => {
        console.error("[MLM Error on payment paid]", err);
      });
    }

    return updated;
  }

  async assignVendor(id: string, vendorId: string) {
    const [o, v] = await Promise.all([
      prisma.order.findUnique({
        where: { id },
        include: { customer: true },
      }),
      prisma.vendor.findUnique({
        where: { id: vendorId },
      }),
    ]);

    if (!o) throw createHttpError(404, "Order not found.");
    if (
      !v ||
      (v.role !== "AGENT" && v.role !== "TECHNICIAN") ||
      v.deletedAt ||
      v.verificationStatus !== "VERIFIED" ||
      v.profileStatus !== "PUBLISHED"
    ) {
      throw createHttpError(400, "Vendor is not eligible or not verified.");
    }

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
      subject: "Just24You order accepted",
      html: simpleEmail(
        "Order accepted",
        `Your order ${id} has been accepted and assigned for processing.`
      ),
    });

    if (v.email) {
      await sendMailSafe({
        to: v.email,
        subject: "New Just24You order assigned",
        html: simpleEmail("New order assigned", `You have been assigned order ${id}.`),
      });
    }

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