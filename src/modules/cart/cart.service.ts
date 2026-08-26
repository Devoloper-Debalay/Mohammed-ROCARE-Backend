import { injectable } from "tsyringe";
import createHttpError from "http-errors";
import prisma from "../../config/database";

@injectable()
export class CartService {
  async get(userId: string) {
    let cart = await prisma.cart.findUnique({ where: { userId }, include: { items: { include: { product: true } } } });
    if (!cart) cart = await prisma.cart.create({ data: { userId }, include: { items: { include: { product: true } } } });
    return cart;
  }
  async add(userId: string, productId: string, quantity: number) {
    if (quantity < 1) throw createHttpError(400, "Quantity must be at least 1.");
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) throw createHttpError(404, "Product not found.");
    const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
    const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
    const next = (existing?.quantity ?? 0) + quantity;
    if (next > product.stock) throw createHttpError(400, "Requested quantity exceeds stock.");
    if (existing) await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: next } });
    else await prisma.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
    return this.get(userId);
  }
  async update(userId: string, productId: string, quantity: number) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw createHttpError(404, "Cart not found.");
    const item = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } }, include: { product: true } });
    if (!item) throw createHttpError(404, "Cart item not found.");
    if (quantity < 1) return this.remove(userId, productId);
    if (quantity > item.product.stock) throw createHttpError(400, "Requested quantity exceeds stock.");
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
    return this.get(userId);
  }
  async remove(userId: string, productId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    return this.get(userId);
  }
  async clear(userId: string) {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    return this.get(userId);
  }
}
