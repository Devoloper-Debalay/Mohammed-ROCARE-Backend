import{injectable}from"tsyringe";
import prisma from "../../../config/database";
@injectable()export class AnalyticsService{
 async dashboard(){const [customers,vendors,requests,paidPayments,walletTransactions,complaints]=await Promise.all([prisma.user.count({where:{role:"CLIENT",deletedAt:null}}),prisma.vendor.count({where:{deletedAt:null}}),prisma.serviceRequest.count(),prisma.payment.count({where:{status:"PAID"}}),prisma.walletTransaction.count(),prisma.complaint.count({where:{status:{not:"RESOLVED"}}})]);return {customers,vendors,serviceRequests:requests,paidPayments,walletTransactions,openComplaints:complaints};}
 async trends(){const [requests,payments,signups]=await Promise.all([prisma.serviceRequest.findMany({select:{createdAt:true,status:true},orderBy:{createdAt:"desc"},take:500}),prisma.payment.findMany({select:{createdAt:true,status:true,amount:true},orderBy:{createdAt:"desc"},take:500}),prisma.user.findMany({where:{role:"CLIENT"},select:{createdAt:true},orderBy:{createdAt:"desc"},take:500})]);return {requests,payments,signups};}
}
