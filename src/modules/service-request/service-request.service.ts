import { injectable, inject } from "tsyringe";
import createHttpError from "http-errors";
import { ServiceRequestRepository } from "./service-request.repository";
import { ServiceRequestStatus, VendorProfileStatus, VendorVerificationStatus } from "../../generated/prisma/enums";
import prisma from "../../config/database";

@injectable()
export class ServiceRequestService {
  constructor(@inject(ServiceRequestRepository) private readonly repo: ServiceRequestRepository) {}

  async create(customerId:string,input:any){
    const service=await prisma.service.findUnique({where:{id:input.serviceId}});
    if(!service) throw createHttpError(404,"Service not found.");
    const customer=await prisma.user.findUnique({where:{id:customerId}});
    if(!customer || customer.role!=="CLIENT") throw createHttpError(403,"Customer access required.");
    const request=await this.repo.create({customerId,serviceId:input.serviceId,status:ServiceRequestStatus.NEW,priority:input.priority??0,scheduledAt:input.scheduledAt?new Date(input.scheduledAt):undefined,notes:input.notes,branchId:(service as any).branchId??undefined});
    return this.autoAssign(request.id);
  }

  async autoAssign(id:string){
    const request=await this.repo.find(id); if(!request) throw createHttpError(404,"Service request not found.");
    if(request.assignedVendorId) return request;
    const vendors=await this.repo.technicians();
    if(!vendors.length) return request;
    const assigned=vendors[0];
    return this.repo.update(id,{assignedVendor:{connect:{id:assigned.id}},status:ServiceRequestStatus.ASSIGNED});
  }

  listForCustomer(customerId:string,page=1,limit=20){const where={customerId}; return Promise.all([this.repo.list(where,(page-1)*limit,limit),this.repo.count(where)]).then(([data,total])=>({data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}));}
  async detailForCustomer(customerId:string,id:string){const r=await this.repo.find(id);if(!r||r.customerId!==customerId)throw createHttpError(404,"Service request not found.");return r;}
  async listVendor(vendorId:string,page=1,limit=20){const where={assignedVendorId:vendorId};return Promise.all([this.repo.list(where,(page-1)*limit,limit),this.repo.count(where)]).then(([data,total])=>({data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}));}
  async updateVendor(vendorId:string,id:string,action:"accept"|"start"|"complete"|"deny"){
    const r=await this.repo.find(id);if(!r||r.assignedVendorId!==vendorId)throw createHttpError(404,"Service request not found.");
    const map:any={accept:{status:ServiceRequestStatus.ACCEPTED,acceptedAt:new Date()},start:{status:ServiceRequestStatus.ONGOING},complete:{status:ServiceRequestStatus.COMPLETED,completedAt:new Date()},deny:{status:ServiceRequestStatus.DENIED,deniedAt:new Date()}};
    if(!map[action])throw createHttpError(400,"Unsupported action.");
    return this.repo.update(id,map[action]);
  }
  async assign(adminId:string,id:string,vendorId:string){const vendor=await prisma.vendor.findUnique({where:{id:vendorId}});if(!vendor||vendor.role!=="TECHNICIAN"||vendor.verificationStatus!==VendorVerificationStatus.VERIFIED||vendor.profileStatus!==VendorProfileStatus.PUBLISHED)throw createHttpError(400,"Vendor is not eligible for assignment.");const r=await this.repo.find(id);if(!r)throw createHttpError(404,"Service request not found.");return this.repo.update(id,{assignedVendor:{connect:{id:vendorId}},status:ServiceRequestStatus.ASSIGNED});}
  async adminList(page=1,limit=20){const where={};return Promise.all([this.repo.list(where,(page-1)*limit,limit),this.repo.count(where)]).then(([data,total])=>({data,pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}}));}
}
