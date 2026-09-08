import { injectable, inject } from "tsyringe";
import { createHmac, timingSafeEqual, createHash } from "crypto";
import createHttpError from "http-errors";
import razorpay from "../../config/razorpay";
import { PaymentRepository } from "./payment.repository";
import prisma from "../../config/database";

@injectable()
export class PaymentService {
  constructor(@inject(PaymentRepository) private readonly repo: PaymentRepository) {}

  async createOrder(userId: string, input: any) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw createHttpError(400, "Amount must be positive.");
    }

    if (input.serviceRequestId) {
      const sr = await prisma.serviceRequest.findUnique({ where: { id: input.serviceRequestId } });
      if (!sr || sr.customerId !== userId) {
        throw createHttpError(403, "Service request access denied.");
      }
    }

    if (input.orderId) {
      const order = await prisma.order.findUnique({ where: { id: input.orderId } });
      if (!order || order.customerId !== userId) {
        throw createHttpError(403, "Order access denied.");
      }
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: input.currency || "INR",
      // Razorpay caps `receipt` at 56 chars.
      receipt: `pay_${Date.now()}_${userId.slice(0, 8)}`,
      notes: {
        userId,
        serviceRequestId: input.serviceRequestId || "",
        orderId: input.orderId || "",
      },
    });

    const payment = await this.repo.create({
      amount,
      method: "RAZORPAY",
      status: "PENDING",
      transactionId: razorpayOrder.id,
      orderId: input.orderId || undefined,
      serviceRequestId: input.serviceRequestId || undefined,
      vendorId: input.vendorId || undefined,
    });

    return {
      paymentId: payment.id,
      orderId: razorpayOrder.id,
      amount,
      currency: razorpayOrder.currency,
      keyId: process.env.RAZORPAY_KEY_ID || "",
    };
  }

  async verify(userId: string, input: any) {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = input;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      throw createHttpError(400, "razorpayOrderId, razorpayPaymentId and razorpaySignature are required.");
    }

    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(razorpaySignature, "hex");
    const signatureValid = expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!signatureValid) {
      throw createHttpError(400, "Payment verification failed. Signature mismatch.");
    }

    const payment = paymentId ? await this.repo.find(paymentId) : await this.repo.findByTransactionId(razorpayOrderId);
    if (!payment) throw createHttpError(404, "Payment not found.");

    // Lead payments are generated after a vendor completes work. They do not
    // necessarily have orderId/serviceRequestId directly on the payment row.
    let hasAccess = payment.order?.customerId === userId || payment.serviceRequest?.customerId === userId;

    if (!hasAccess && payment.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: payment.leadId } });
      if (lead?.serviceRequestId) {
        const serviceRequest = await prisma.serviceRequest.findUnique({
          where: { id: lead.serviceRequestId },
        });
        hasAccess = serviceRequest?.customerId === userId;
      }
    }

    if (!hasAccess) {
      throw createHttpError(403, "Payment access denied.");
    }

    if (payment.status !== "PAID") {
      await this.repo.markPaid(payment.id, razorpayPaymentId);
    }

    return {
      verified: true,
      paymentId: payment.id,
      status: "PAID",
      leadCompleted: Boolean(payment.leadId),
    };
  }

  async webhook(rawBody: string, signature: string, payload: any) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      // No webhook configured yet — synchronous verify() via the checkout
      // callback is the primary path, so this is a safe no-op rather than a
      // hard failure.
      return { received: true, skipped: "RAZORPAY_WEBHOOK_SECRET not configured" };
    }

    const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expectedSignature, "hex");
    const actualBuf = Buffer.from(signature || "", "hex");
    const signatureValid = !!signature && expectedBuf.length === actualBuf.length && timingSafeEqual(expectedBuf, actualBuf);
    if (!signatureValid) {
      throw createHttpError(400, "Invalid webhook signature.");
    }

    const eventId = payload?.id || payload?.payload?.payment?.entity?.id || createHash("sha256").update(rawBody).digest("hex");
    if (await this.repo.webhookByEvent(eventId)) {
      return { received: true, duplicate: true };
    }

    const entity = payload?.payload?.payment?.entity;
    const status = payload?.event?.includes("failed") ? "FAILED" : payload?.event?.includes("captured") ? "PAID" : undefined;
    if (entity?.order_id && status) {
      const payment = await this.repo.findByTransactionId(entity.order_id);
      if (payment) await this.repo.setStatus(payment.id, status, entity.id);
    }

    await this.repo.webhook({ provider: "RAZORPAY", eventId, signature, payload, processed: true, processedAt: new Date() });
    return { received: true };
  }
}
