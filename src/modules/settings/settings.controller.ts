import{injectable,inject}from"tsyringe";import{Request,Response,NextFunction}from"express";import{SettingsService}from"./settings.service";import{sendSuccess}from"../../shared/response";
@injectable()export class SettingsController{constructor(@inject(SettingsService)private readonly s:SettingsService){}
 list=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.list(),"Platform settings.")}catch(e){next(e)}};get=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.get(req.params.key as string),"Platform setting.")}catch(e){next(e)}};upsert=async(req:Request,res:Response,next:NextFunction)=>{try{sendSuccess(res,await this.s.upsert(res.locals.adminId,req.body),"Platform setting saved.")}catch(e){next(e)}};
}
