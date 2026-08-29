// import {injectable,inject} from "tsyringe";import axios from "axios";import crypto from "crypto";import createHttpError from "http-errors";import {PaymentRepository} from "./payment.repository";import prisma from "../../config/database";
// const key=()=>{if(!process.env.RAZORPAY_KEY_ID||!process.env.RAZORPAY_KEY_SECRET)throw createHttpError(500,"Razorpay keys are not configured.");return{id:process.env.RAZORPAY_KEY_ID,secret:process.env.RAZORPAY_KEY_SECRET}};
// @injectable()export class PaymentService{constructor(@inject(PaymentRepository)private readonly repo:PaymentRepository){}
//  async createOrder(userId:string,input:any){const cfg=key();if(!Number.isFinite(Number(input.amount))||Number(input.amount)<=0)throw createHttpError(400,"Amount must be positive.");if(input.serviceRequestId){const sr=await prisma.serviceRequest.findUnique({where:{id:input.serviceRequestId}});if(!sr||sr.customerId!==userId)throw createHttpError(403,"Service request access denied.");}if(input.orderId){const o=await prisma.order.findUnique({where:{id:input.orderId}});if(!o||o.customerId!==userId)throw createHttpError(403,"Order access denied.");}
//  const amount=Math.round(Number(input.amount)*100);const order=(await axios.post("https://api.razorpay.com/v1/orders",{amount,currency:input.currency||"INR",receipt:input.receipt||`ROCARE-${Date.now()}`,notes:{userId,serviceRequestId:input.serviceRequestId||"",orderId:input.orderId||""}},{auth:{username:cfg.id,password:cfg.secret}})).data;
//  const payment=await this.repo.create({amount:input.amount,method:"RAZORPAY",status:"PENDING",transactionId:order.id,orderId:input.orderId||undefined,serviceRequestId:input.serviceRequestId||undefined,vendorId:input.vendorId||undefined});return{paymentId:payment.id,orderId:order.id,amount:order.amount,currency:order.currency,keyId:cfg.id};}
//  async verify(userId:string,input:any){const cfg=key();const expected=crypto.createHmac("sha256",cfg.secret).update(`${input.razorpayOrderId}|${input.razorpayPaymentId}`).digest("hex");if(!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(input.razorpaySignature)))throw createHttpError(400,"Invalid Razorpay payment signature.");const p=input.paymentId?await this.repo.find(input.paymentId):await this.repo.findByTransactionId(input.razorpayOrderId);if(!p)throw createHttpError(404,"Payment not found.");if(p.order?.customerId!==userId&&p.serviceRequest?.customerId!==userId)throw createHttpError(403,"Payment access denied.");if(p.status!=="PAID")await this.repo.markPaid(p.id,input.razorpayPaymentId);return{verified:true,paymentId:p.id};}
//  async webhook(rawBody:string,signature:string,payload:any){const secret=process.env.RAZORPAY_WEBHOOK_SECRET;if(!secret)throw createHttpError(500,"RAZORPAY_WEBHOOK_SECRET is not configured.");const expected=crypto.createHmac("sha256",secret).update(rawBody).digest("hex");if(!signature||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(signature)))throw createHttpError(400,"Invalid webhook signature.");const eventId=payload?.id||payload?.payload?.payment?.entity?.id||crypto.createHash("sha256").update(rawBody).digest("hex");if(await this.repo.webhookByEvent(eventId))return{received:true,duplicate:true};const entity=payload?.payload?.payment?.entity;const status=payload?.event?.includes("failed")?"FAILED":payload?.event?.includes("captured")?"PAID":undefined;if(entity?.order_id){const payment=await this.repo.findByTransactionId(entity.order_id);if(payment&&status)await this.repo.setStatus(payment.id,status,entity.id);}
//  await this.repo.webhook({provider:"RAZORPAY",eventId,signature,payload,processed:true,processedAt:new Date()});return{received:true};}
// }

import { injectable, inject } from "tsyringe";
import crypto from "crypto";
import createHttpError from "http-errors";
import { PaymentRepository } from "./payment.repository";
import prisma from "../../config/database";

/**
 * Temporary dummy payment provider.
 * No external gateway, API key, webhook, or signature is required.
 */
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

    const dummyOrderId = `DUMMY_ORDER_${crypto.randomUUID()}`;
    const payment = await this.repo.create({
      amount,
      method: "UPI",
      status: "PENDING",
      transactionId: dummyOrderId,
      orderId: input.orderId || undefined,
      serviceRequestId: input.serviceRequestId || undefined,
      vendorId: input.vendorId || undefined,
    });

    return {
      dummy: true,
      paymentId: payment.id,
      orderId: dummyOrderId,
      dummyOrderId,
      amount,
      currency: input.currency || "INR",
      status: "PENDING",
      message: "Dummy payment created. Call /payment/verify with paymentId to mark it as paid.",
    };
  }

  async verify(userId: string, input: any) {
    const paymentId = input.paymentId;
    const orderId = input.dummyOrderId || input.orderId || input.razorpayOrderId;

    if (!paymentId && !orderId) {
      throw createHttpError(400, "paymentId or dummyOrderId is required.");
    }

    const payment = paymentId
      ? await this.repo.find(paymentId)
      : await this.repo.findByTransactionId(orderId);

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
      const dummyTransactionId = `DUMMY_PAYMENT_${crypto.randomUUID()}`;
      await this.repo.markPaid(payment.id, dummyTransactionId);
    }

    return {
      verified: true,
      dummy: true,
      paymentId: payment.id,
      status: "PAID",
      leadCompleted: Boolean(payment.leadId),
      message: payment.leadId
        ? "Dummy payment successful. Lead and service request marked as completed."
        : "Dummy payment marked as paid successfully.",
    };
  }

  async webhook() {
    return { received: true, dummy: true, ignored: true };
  }
}