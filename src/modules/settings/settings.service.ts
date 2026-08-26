import{injectable}from"tsyringe";import createHttpError from"http-errors";import prisma from"../../config/database";
@injectable()export class SettingsService{
 list(){return prisma.platformSetting.findMany({orderBy:{key:"asc"}});}get(key:string){return prisma.platformSetting.findUnique({where:{key}});}
 upsert(adminId:string,d:any){return prisma.platformSetting.upsert({where:{key:d.key},create:{key:d.key,value:d.value,description:d.description,updatedBy:adminId},update:{value:d.value,description:d.description,updatedBy:adminId}});}
 async getNumber(key:string,fallback:number){const s=await this.get(key);const n=s?Number((s.value as any)?.value??s.value):NaN;return Number.isFinite(n)?n:fallback;}
}
