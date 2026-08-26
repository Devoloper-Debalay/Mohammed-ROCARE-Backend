import {injectable,inject} from "tsyringe";import type {PrismaClient} from "../../generated/prisma/client";
@injectable() export class PaymentRepository{
 constructor(@inject("PrismaClient") private readonly prisma:PrismaClient){}
 create(data:any){return this.prisma.payment.create({data});}
 find(id:string){return this.prisma.payment.findUnique({where:{id},include:{order:true,serviceRequest:true,lead:true}});}
 update(id:string,data:any){return this.prisma.payment.update({where:{id},data});}
 webhook(data:any){return this.prisma.paymentWebhook.create({data});}
 webhookByEvent(eventId:string){return this.prisma.paymentWebhook.findUnique({where:{eventId}});}
}
