import {injectable} from "tsyringe";import createHttpError from "http-errors";import prisma from "../../config/database";
@injectable() export class TrackingService{
 async update(vendorId:string,d:any){const v=await prisma.vendor.findUnique({where:{id:vendorId}});if(!v||v.deletedAt)throw createHttpError(404,"Vendor not found.");await prisma.vendor.update({where:{id:vendorId},data:{latitude:d.latitude,longitude:d.longitude}});return prisma.vendorLocation.create({data:{vendorId,latitude:d.latitude,longitude:d.longitude,accuracy:d.accuracy}});}
 async current(vendorId:string){const v=await prisma.vendor.findUnique({where:{id:vendorId},select:{id:true,fullName:true,latitude:true,longitude:true,updatedAt:true}});if(!v)throw createHttpError(404,"Vendor not found.");return v;}
 async history(vendorId:string,limit=100){return prisma.vendorLocation.findMany({where:{vendorId},orderBy:{capturedAt:"desc"},take:Math.min(limit,500)});}
 async admin(vendorId:string,limit=100){return this.history(vendorId,limit);}
}
