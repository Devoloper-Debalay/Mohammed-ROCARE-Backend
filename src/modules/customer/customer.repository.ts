import { injectable, inject } from "tsyringe";
import type { PrismaClient, Prisma } from "../../generated/prisma/client";

@injectable()
export class CustomerRepository {
  constructor(@inject("PrismaClient") private readonly prisma: PrismaClient) {}

  findUser(identifier: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
      include: { customerProfile: true, serviceRequests: { orderBy: { createdAt: "desc" } } },
    });
  }

  findUserById(id: string) {
    return this.prisma.user.findUnique({ where: { id }, include: { customerProfile: { include: { addresses: true } } } });
  }

  createCustomer(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data: {
        ...data,
        role: "CLIENT",
        customerProfile: { create: {} },
      },
      include: { customerProfile: true },
    });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data });
  }

  addresses(customerId: string) {
    return this.prisma.customerAddress.findMany({ where: { customerId }, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
  }

  createAddress(customerId: string, data: Prisma.CustomerAddressUncheckedCreateInput) {
    return this.prisma.$transaction(async tx => {
      if (data.isDefault) await tx.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } });
      return tx.customerAddress.create({ data });
    });
  }

  updateAddress(customerId: string, id: string, data: Prisma.CustomerAddressUpdateInput) {
    return this.prisma.customerAddress.updateMany({ where: { id, customerId }, data });
  }

  deleteAddress(customerId: string, id: string) {
    return this.prisma.customerAddress.deleteMany({ where: { id, customerId } });
  }
}
