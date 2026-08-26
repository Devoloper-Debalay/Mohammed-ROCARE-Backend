import {injectable}from"tsyringe";import createHttpError from"http-errors";import prisma from"../../config/database";
@injectable()export class ComplaintService{
 async createCustomer(userId:string,d:any){return prisma.complaint.create({data:{userId,subject:d.subject,description:d.description}});}
 async listCustomer(userId:string){return prisma.complaint.findMany({where:{userId},orderBy:{createdAt:"desc"}});}
 async listAdmin(){return prisma.complaint.findMany({include:{user:true},orderBy:{createdAt:"desc"}});}
 async reply(id:string,adminId:string,d:any){const c=await prisma.complaint.findUnique({where:{id}});if(!c)throw createHttpError(404,"Complaint not found.");return prisma.complaint.update({where:{id},data:{resolvedBy:adminId,status:d.status||"IN_REVIEW",description:`${c.description}\n\nAdmin: ${d.message}`}});}
}
