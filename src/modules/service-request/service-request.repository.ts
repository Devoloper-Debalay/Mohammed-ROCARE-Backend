import { injectable, inject } from "tsyringe";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";
import { ServiceRequestStatus } from "../../generated/prisma/enums";

@injectable()
export class ServiceRequestRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}
  create(data: Prisma.ServiceRequestUncheckedCreateInput) { return this.prisma.serviceRequest.create({ data, include: { service: true, assignedVendor: true, customer: true } }); }
  find(id: string) { return this.prisma.serviceRequest.findUnique({ where: { id }, include: { service: true, customer: true, assignedVendor: true, payments: true } }); }
  list(where: Prisma.ServiceRequestWhereInput, skip:number, take:number) { return this.prisma.serviceRequest.findMany({ where, skip, take, orderBy:[{priority:"desc"},{createdAt:"desc"}], include:{service:true, assignedVendor:true} }); }
  count(where: Prisma.ServiceRequestWhereInput) { return this.prisma.serviceRequest.count({ where }); }
  update(id:string,data:Prisma.ServiceRequestUpdateInput){ return this.prisma.serviceRequest.update({where:{id},data,include:{service:true,assignedVendor:true}}); }
  technicians() { return this.prisma.vendor.findMany({ where:{ role:"TECHNICIAN", verificationStatus:"VERIFIED", profileStatus:"PUBLISHED", deletedAt:null }, select:{id:true,fullName:true,phone:true,latitude:true,longitude:true} }); }
}
