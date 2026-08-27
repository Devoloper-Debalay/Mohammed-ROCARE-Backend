import { injectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { ProductsService } from "./products.service";
import { sendSuccess } from "../../shared/response";

@injectable()
export class ProductsController {
  constructor(@inject(ProductsService) private readonly s: ProductsService) {}
  private scope(res: Response) { return { role: res.locals.adminRole, branchId: res.locals.adminBranchId }; }
  products = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.products(Number(req.query.page) || 1, Number(req.query.limit) || 20), "Products."); } catch (e) { next(e); } };
  createProduct = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.createProduct(req.body, this.scope(res)), "Product created.", 201); } catch (e) { next(e); } };
  updateProduct = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.updateProduct(req.params.id as string, req.body), "Product updated."); } catch (e) { next(e); } };
  parts = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.parts(Number(req.query.page) || 1, Number(req.query.limit) || 20), "Parts."); } catch (e) { next(e); } };
  createPart = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.createPart(req.body, this.scope(res)), "Part created.", 201); } catch (e) { next(e); } };
  updatePart = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.updatePart(req.params.id as string, req.body), "Part updated."); } catch (e) { next(e); } };
  inventory = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.inventory(this.scope(res), Number(req.query.page) || 1, Number(req.query.limit) || 50), "Inventory."); } catch (e) { next(e); } };
  adjust = async (req: Request, res: Response, next: NextFunction) => { try { sendSuccess(res, await this.s.adjust(req.params.id as string, req.body.quantity, req.body.note, this.scope(res)), "Inventory adjusted."); } catch (e) { next(e); } };
}
