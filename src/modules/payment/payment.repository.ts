// import{injectable,inject}from"tsyringe";import type{PrismaClient}from"../../generated/prisma/client";@injectable()export class PaymentRepository{constructor(@inject("PrismaClient")private readonly prisma:PrismaClient){}create(data:any){return this.prisma.payment.create({data});}find(id:string){return this.prisma.payment.findUnique({where:{id},include:{order:true,serviceRequest:true,lead:true}});}findByTransactionId(transactionId:string){return this.prisma.payment.findUnique({where:{transactionId},include:{order:true,serviceRequest:true,lead:true}});}update(id:string,data:any){return this.prisma.payment.update({where:{id},data});}markPaid(id:string,transactionId:string){return this.prisma.$transaction(async tx=>{const p=await tx.payment.update({where:{id},data:{status:"PAID",transactionId}});if(p.orderId)await tx.order.update({where:{id:p.orderId},data:{paymentStatus:"PAID"}});if(p.serviceRequestId){/* payment status is authoritative; service workflow remains separate */}return p;});}setStatus(id:string,status:"PAID"|"FAILED",transactionId?:string){return this.prisma.$transaction(async tx=>{const p=await tx.payment.update({where:{id},data:{status,transactionId}});if(p.orderId)await tx.order.update({where:{id:p.orderId},data:{paymentStatus:status}});return p;});}webhook(data:any){return this.prisma.paymentWebhook.create({data});}webhookByEvent(eventId:string){return this.prisma.paymentWebhook.findUnique({where:{eventId}});}}
import { injectable, inject } from "tsyringe";
import type { PrismaClient } from "../../generated/prisma/client";
import { LeadStatus, PaymentStatus, ServiceRequestStatus } from "../../generated/prisma/enums";

@injectable()
export class PaymentRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  create(data: any) {
    return this.prisma.payment.create({ data });
  }

  find(id: string) {
    return this.prisma.payment.findUnique({
      where: { id },
      include: { order: true, serviceRequest: true, lead: true },
    });
  }

  findByTransactionId(transactionId: string) {
    return this.prisma.payment.findUnique({
      where: { transactionId },
      include: { order: true, serviceRequest: true, lead: true },
    });
  }

  update(id: string, data: any) {
    return this.prisma.payment.update({ where: { id }, data });
  }

  /**
   * Dummy-payment success handler.
   * For a lead payment it completes the lead and its linked service request.
   */
  markPaid(id: string, transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } });
      if (!payment) throw new Error("Payment not found.");

      const paidPayment = await tx.payment.update({
        where: { id },
        data: { status: PaymentStatus.PAID, transactionId },
      });

      if (payment.orderId) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: "PAID" },
        });
      }

      if (payment.leadId) {
        const lead = await tx.lead.update({
          where: { id: payment.leadId },
          data: {
            status: LeadStatus.COMPLETED,
            completedAt: new Date(),
          },
        });

        if (lead.serviceRequestId) {
          await tx.serviceRequest.update({
            where: { id: lead.serviceRequestId },
            data: {
              status: ServiceRequestStatus.COMPLETED,
              completedAt: lead.completedAt,
            },
          });
        }
      }

      return paidPayment;
    });
  }

  setStatus(id: string, status: "PAID" | "FAILED", transactionId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.update({
        where: { id },
        data: { status, transactionId },
      });
      if (payment.orderId) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: status },
        });
      }
      return payment;
    });
  }

  webhook(data: any) {
    return this.prisma.paymentWebhook.create({ data });
  }

  webhookByEvent(eventId: string) {
    return this.prisma.paymentWebhook.findUnique({ where: { eventId } });
  }
}
