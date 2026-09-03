import { Router } from "express";
import "../../container";
import { container } from "tsyringe";
import { ProductsController } from "./products.controller";
import { requireAdminAuth, requireAdminRole } from "../../middlewares/admin-auth.middleware";
import { requireCustomerAuth } from "../customer/customer.middleware";
import { dtoValidation } from "../../middlewares/dtoValidation";
import { ProductDto, PartDto, InventoryAdjustDto, CategoryDto, ProductReviewDto } from "./products.dto";
import { Role } from "../../generated/prisma/enums";

const r = Router();
const c = container.resolve(ProductsController);

// Public / Customer Catalog Endpoints
r.get("/products", c.products);
r.get("/products/:id", c.productDetail);
r.get("/products/:id/reviews", c.productReviews);
r.post("/products/:id/reviews", requireCustomerAuth, dtoValidation(ProductReviewDto), c.addReview);

// Public Categories & Service Catalogue
r.get("/categories", c.categories);
r.get("/service", c.catalogue);

// Spare Parts (Public list - vendor purchasing handled at checkout)
r.get("/parts", c.parts);

// Admin Category, Product & Inventory Management
r.use("/admin", requireAdminAuth, requireAdminRole(Role.ADMIN, Role.SADMIN));
r.post("/admin/categories", dtoValidation(CategoryDto), c.createCategory);
r.patch("/admin/categories/:id", dtoValidation(CategoryDto), c.updateCategory);
r.delete("/admin/categories/:id", c.deleteCategory);

r.post("/admin/products", dtoValidation(ProductDto), c.createProduct);
r.patch("/admin/products/:id", dtoValidation(ProductDto), c.updateProduct);
r.delete("/admin/products/:id", c.deleteProduct);

r.post("/admin/parts", dtoValidation(PartDto), c.createPart);
r.patch("/admin/parts/:id", dtoValidation(PartDto), c.updatePart);

r.get("/admin/inventory", c.inventory);
r.patch("/admin/inventory/:id", dtoValidation(InventoryAdjustDto), c.adjust);

export default r;
