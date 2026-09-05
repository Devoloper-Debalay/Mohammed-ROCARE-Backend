import { injectable, inject } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import createHttpError from "http-errors";
import { ProductsService } from "./products.service";
import { sendSuccess } from "../../shared/response";
import { CategoryType } from "../../generated/prisma/enums";

function extractUploadedBuffers(req: Request): Buffer[] {
  const buffers: Buffer[] = [];
  if (req.file?.buffer) {
    buffers.push(req.file.buffer);
  }
  if (Array.isArray(req.files)) {
    for (const f of req.files) {
      if (f?.buffer) buffers.push(f.buffer);
    }
  } else if (req.files && typeof req.files === "object") {
    for (const key of Object.keys(req.files)) {
      const arr = (req.files as Record<string, Express.Multer.File[]>)[key];
      if (Array.isArray(arr)) {
        for (const f of arr) {
          if (f?.buffer) buffers.push(f.buffer);
        }
      }
    }
  }
  return buffers;
}

@injectable()
export class ProductsController {
  constructor(@inject(ProductsService) private readonly s: ProductsService) {}

  private scope(res: Response) {
    return { role: res.locals.adminRole, branchId: res.locals.adminBranchId };
  }

  products = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = {
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
        search: req.query.search as string,
        category: req.query.category as string,
        categoryId: req.query.categoryId as string,
        brand: req.query.brand as string,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        sort: req.query.sort as any,
        isVendorOnly: req.query.isVendorOnly !== undefined ? req.query.isVendorOnly === "true" : undefined,
      };
      sendSuccess(res, await this.s.products(query), "Products retrieved.");
    } catch (e) {
      next(e);
    }
  };

  productDetail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.getProductById(req.params.id as string), "Product details.");
    } catch (e) {
      next(e);
    }
  };

  addReview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId =
        res.locals.customerUserId ||
        res.locals.userId ||
        (req as any).user?.id ||
        (req as any).customerId;
      const review = await this.s.addReview(req.params.id as string, userId, req.body);
      sendSuccess(res, review, "Review added successfully.", 201);
    } catch (e) {
      next(e);
    }
  };

  productReviews = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;
      sendSuccess(res, await this.s.getProductReviews(req.params.id as string, page, limit), "Product reviews.");
    } catch (e) {
      next(e);
    }
  };

  categories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const type = req.query.type as CategoryType;
      sendSuccess(res, await this.s.categories(type), "Categories retrieved.");
    } catch (e) {
      next(e);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.createCategory(req.body), "Category created.", 201);
    } catch (e) {
      next(e);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.updateCategory(req.params.id as string, req.body), "Category updated.");
    } catch (e) {
      next(e);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.deleteCategory(req.params.id as string), "Category deleted.");
    } catch (e) {
      next(e);
    }
  };

  catalogue = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categoryId = req.query.categoryId as string;
      sendSuccess(res, await this.s.catalogue(categoryId), "Service catalogue.");
    } catch (e) {
      next(e);
    }
  };

  createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(res, await this.s.createProduct(req.body, this.scope(res), imageBuffers), "Product created.", 201);
    } catch (e) {
      next(e);
    }
  };

  updateProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(res, await this.s.updateProduct(req.params.id as string, req.body, imageBuffers), "Product updated.");
    } catch (e) {
      next(e);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.deleteProduct(req.params.id as string), "Product deleted.");
    } catch (e) {
      next(e);
    }
  };

  uploadProductImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffers = extractUploadedBuffers(req);
      if (buffers.length === 0) throw createHttpError(400, "Image file is required.");
      const url = await this.s.uploadProductImage(buffers[0]);
      sendSuccess(res, { url }, "Product image uploaded.", 201);
    } catch (e) {
      next(e);
    }
  };

  parts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.parts(Number(req.query.page) || 1, Number(req.query.limit) || 20), "Parts.");
    } catch (e) {
      next(e);
    }
  };

  createPart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(res, await this.s.createPart(req.body, this.scope(res), imageBuffers), "Part created.", 201);
    } catch (e) {
      next(e);
    }
  };

  updatePart = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const imageBuffers = extractUploadedBuffers(req);
      sendSuccess(res, await this.s.updatePart(req.params.id as string, req.body, imageBuffers), "Part updated.");
    } catch (e) {
      next(e);
    }
  };

  uploadPartImage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffers = extractUploadedBuffers(req);
      if (buffers.length === 0) throw createHttpError(400, "Image file is required.");
      const url = await this.s.uploadPartImage(buffers[0]);
      sendSuccess(res, { url }, "Part image uploaded.", 201);
    } catch (e) {
      next(e);
    }
  };

  inventory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.inventory(this.scope(res), Number(req.query.page) || 1, Number(req.query.limit) || 50), "Inventory.");
    } catch (e) {
      next(e);
    }
  };

  adjust = async (req: Request, res: Response, next: NextFunction) => {
    try {
      sendSuccess(res, await this.s.adjust(req.params.id as string, req.body.quantity, req.body.note, this.scope(res)), "Inventory adjusted.");
    } catch (e) {
      next(e);
    }
  };
}
