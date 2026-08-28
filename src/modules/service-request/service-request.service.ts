import { injectable, inject } from "tsyringe";
import createHttpError from "http-errors";

import { ServiceRequestRepository } from "./service-request.repository";

import {
  ServiceRequestStatus,
  LeadStatus,
  VendorProfileStatus,
  VendorVerificationStatus,
} from "../../generated/prisma/enums";

import prisma from "../../config/database";


@injectable()
export class ServiceRequestService {
  constructor(
    @inject(ServiceRequestRepository)
    private readonly repo: ServiceRequestRepository,
  ) {}


  /**
   * =====================================================
   * CREATE SERVICE REQUEST
   * =====================================================
   *
   * This is the central creation method.
   *
   * Every ServiceRequest created through this method
   * automatically creates exactly one linked Lead.
   *
   * Initial state:
   *
   * ServiceRequest -> NEW
   * Lead           -> NEW
   *
   * No vendor is automatically assigned.
   *
   * The vendor discovers the NEW lead through:
   *
   * GET /vendor/leads
   */
  async create(
    customerId: string,
    input: any,
  ) {
    const service = await prisma.service.findUnique({
      where: {
        id: input.serviceId,
      },
    });

    if (!service || !service.isActive) {
      throw createHttpError(
        404,
        "Service not found.",
      );
    }


    const customer = await prisma.user.findUnique({
      where: {
        id: customerId,
      },

      include: {
        customerProfile: {
          include: {
            addresses: true,
          },
        },
      },
    });

    if (
      !customer ||
      customer.role !== "CLIENT" ||
      customer.deletedAt
    ) {
      throw createHttpError(
        403,
        "Customer access required.",
      );
    }


    /**
     * Resolve customer address.
     */
    let address: any = null;

    if (input.addressId) {
      address =
        await prisma.customerAddress.findFirst({
          where: {
            id: input.addressId,

            customer: {
              userId: customerId,
            },
          },
        });

      if (!address) {
        throw createHttpError(
          404,
          "Address not found.",
        );
      }
    }


    address =
      address ||
      customer.customerProfile?.addresses.find(
        (item: any) => item.isDefault,
      ) ||
      customer.customerProfile?.addresses[0] ||
      null;


    /**
     * =====================================================
     * RESOLVE BRANCH
     * =====================================================
     *
     * Priority:
     *
     * 1. Explicit branchId from request
     * 2. Branch configured on service
     * 3. Branch resolved from customer address
     */
    let branchId =
      input.branchId ||
      (service as any).branchId ||
      null;


    if (!branchId && address) {
      const branch =
        await prisma.branch.findFirst({
          where: {
            city: {
              equals: address.city,
              mode: "insensitive",
            },

            state: {
              equals: address.state,
              mode: "insensitive",
            },

            isActive: true,
          },
        });

      branchId =
        branch?.id ||
        null;
    }


    if (!branchId) {
      throw createHttpError(
        400,
        "Unable to resolve an active branch for this service request.",
      );
    }


    /**
     * Verify branch exists.
     */
    const branch =
      await prisma.branch.findFirst({
        where: {
          id: branchId,
          isActive: true,
        },
      });


    if (!branch) {
      throw createHttpError(
        400,
        "Selected branch is invalid or inactive.",
      );
    }


    /**
     * =====================================================
     * CREATE REQUEST + LEAD ATOMICALLY
     * =====================================================
     */
    return prisma.$transaction(
      async (tx) => {

        /**
         * STEP 1
         *
         * Create ServiceRequest.
         */
        const request =
          await tx.serviceRequest.create({
            data: {
              customerId,

              serviceId:
                input.serviceId,

              status:
                ServiceRequestStatus.NEW,

              priority:
                input.priority ?? 0,

              scheduledAt:
                input.scheduledAt
                  ? new Date(input.scheduledAt)
                  : undefined,

              notes:
                input.notes ?? null,

              branchId,

              /**
               * IMPORTANT:
               *
               * New services are NOT automatically assigned.
               */
              assignedVendorId:
                null,
            },
          });


        /**
         * STEP 2
         *
         * Create the corresponding Lead.
         *
         * This Lead uses exactly the same branchId.
         */
        const lead =
          await tx.lead.create({
            data: {
              customerName:
                `${customer.firstName ?? ""} ${
                  customer.lastName ?? ""
                }`.trim(),

              phone:
                customer.phone || "",

              email:
                customer.email || null,

              address:
                address
                  ? [
                      address.line1,
                      address.line2,
                      address.city,
                      address.state,
                      address.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null,

              latitude:
                address?.latitude ?? null,

              longitude:
                address?.longitude ?? null,

              area:
                address?.city ?? null,

              issue:
                input.notes ||
                service.description ||
                null,

              serviceType:
                service.name,

              estimatedAmount:
                service.price,

              source:
                "ALL",

              /**
               * Initial Lead state.
               */
              status:
                LeadStatus.NEW,

              /**
               * No automatic vendor assignment.
               */
              assignedVendorId:
                null,

              serviceId:
                service.id,

              serviceRequestId:
                request.id,

              /**
               * MUST match ServiceRequest.branchId.
               */
              branchId,

              notes:
                input.notes ?? null,
            },
          });


        return {
          request,
          lead,
        };
      },
    );
  }


  /**
   * =====================================================
   * AUTO ASSIGN
   * =====================================================
   *
   * Do not use this automatically if your business flow is:
   *
   * NEW -> Vendor buys/accepts -> ACCEPTED
   *
   * This remains available only for explicit system/admin
   * assignment flows.
   */
  async autoAssign(
    id: string,
  ) {
    const request =
      await this.repo.find(id);

    if (!request) {
      throw createHttpError(
        404,
        "Service request not found.",
      );
    }

    if (request.assignedVendorId) {
      return request;
    }

    if (!request.branchId) {
      return request;
    }


    const vendors =
      await this.repo.technicians(
        request.branchId,
      );

    if (!vendors.length) {
      return request;
    }


    const address =
      (request as any)
        .customer
        ?.customerProfile
        ?.addresses
        ?.find((item: any) => item.isDefault)
      ||
      (request as any)
        .customer
        ?.customerProfile
        ?.addresses?.[0];


    const score =
      (vendor: any) => {
        if (
          address?.latitude == null ||
          address?.longitude == null ||
          vendor.latitude == null ||
          vendor.longitude == null
        ) {
          return Number.MAX_SAFE_INTEGER;
        }

        return Math.hypot(
          vendor.latitude -
            address.latitude,

          vendor.longitude -
            address.longitude,
        );
      };


    const selected =
      [...vendors]
        .sort(
          (a, b) =>
            score(a) -
            score(b),
        )[0];


    return prisma.$transaction(
      async (tx) => {

        const updatedRequest =
          await tx.serviceRequest.update({
            where: {
              id,
            },

            data: {
              assignedVendorId:
                selected.id,

              status:
                ServiceRequestStatus.ASSIGNED,
            },
          });


        const lead =
          await tx.lead.findFirst({
            where: {
              serviceRequestId:
                id,
            },
          });


        if (lead) {
          await tx.lead.update({
            where: {
              id: lead.id,
            },

            data: {
              assignedVendorId:
                selected.id,
            },
          });

          await tx.leadAssignment.create({
            data: {
              leadId:
                lead.id,

              vendorId:
                selected.id,
            },
          });
        }


        return updatedRequest;
      },
    );
  }


  /**
   * CUSTOMER REQUEST LIST.
   */
  async listForCustomer(
    customerId: string,
    page = 1,
    limit = 20,
  ) {
    const where = {
      customerId,
    };

    const [
      data,
      total,
    ] =
      await Promise.all([
        this.repo.list(
          where,
          (page - 1) * limit,
          limit,
        ),

        this.repo.count(
          where,
        ),
      ]);


    return {
      data,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }


  /**
   * CUSTOMER REQUEST DETAIL.
   */
  async detailForCustomer(
    customerId: string,
    id: string,
  ) {
    const request =
      await this.repo.find(id);

    if (
      !request ||
      request.customerId !== customerId
    ) {
      throw createHttpError(
        404,
        "Service request not found.",
      );
    }

    return request;
  }


  /**
   * =====================================================
   * VENDOR SERVICE REQUEST LIST
   * =====================================================
   *
   * Only requests already accepted/assigned to this vendor
   * should appear here.
   *
   * Available NEW work comes from /vendor/leads.
   */
  async listVendor(
    vendorId: string,
    page = 1,
    limit = 20,
  ) {
    const where = {
      assignedVendorId:
        vendorId,
    };


    const [
      data,
      total,
    ] =
      await Promise.all([
        this.repo.list(
          where,
          (page - 1) * limit,
          limit,
        ),

        this.repo.count(
          where,
        ),
      ]);


    return {
      data,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }


  /**
   * =====================================================
   * VENDOR SERVICE STATUS FLOW
   * =====================================================
   *
   * ACCEPTED
   *     ↓
   * ONGOING
   *     ↓
   * COMPLETED
   *
   * Or:
   *
   * ACCEPTED / ONGOING
   *     ↓
   * DENIED
   */
  async updateVendor(
    vendorId: string,
    id: string,
    action:
      | "accept"
      | "start"
      | "complete"
      | "deny",
  ) {
    const request =
      await this.repo.find(id);

    if (!request) {
      throw createHttpError(
        404,
        "Service request not found.",
      );
    }


    /**
     * Vendor may accept an unassigned request
     * only if it belongs to the vendor's branch.
     */
    if (
      action === "accept" &&
      !request.assignedVendorId
    ) {
      const vendor =
        await prisma.vendor.findUnique({
          where: {
            id: vendorId,
          },
        });

      if (!vendor) {
        throw createHttpError(
          404,
          "Vendor not found.",
        );
      }

      if (
        !vendor.branchId ||
        vendor.branchId !== request.branchId
      ) {
        throw createHttpError(
          403,
          "Service request is outside your branch.",
        );
      }


      return prisma.$transaction(
        async (tx) => {

          const updatedRequest =
            await tx.serviceRequest.update({
              where: {
                id,
              },

              data: {
                assignedVendorId:
                  vendorId,

                status:
                  ServiceRequestStatus.ACCEPTED,

                acceptedAt:
                  new Date(),
              },
            });


          const lead =
            await tx.lead.findFirst({
              where: {
                serviceRequestId:
                  id,
              },
            });


          if (lead) {
            await tx.lead.update({
              where: {
                id: lead.id,
              },

              data: {
                assignedVendorId:
                  vendorId,

                status:
                  LeadStatus.ACCEPTED,

                acceptedAt:
                  new Date(),
              },
            });

            await tx.leadAssignment.create({
              data: {
                leadId:
                  lead.id,

                vendorId,
              },
            });
          }


          return updatedRequest;
        },
      );
    }


    /**
     * Other actions require ownership.
     */
    if (
      request.assignedVendorId !== vendorId
    ) {
      throw createHttpError(
        403,
        "Service request is not assigned to this vendor.",
      );
    }


    const allowed: Record<
      string,
      string[]
    > = {
      NEW: [
        "accept",
      ],

      ASSIGNED: [
        "accept",
        "deny",
      ],

      ACCEPTED: [
        "start",
        "deny",
      ],

      ONGOING: [
        "complete",
        "deny",
      ],
    };


    if (
      !allowed[request.status]
        ?.includes(action)
    ) {
      throw createHttpError(
        409,
        `Cannot ${action} a request in ${request.status} state.`,
      );
    }


    const statusData: Record<
      string,
      any
    > = {
      accept: {
        status:
          ServiceRequestStatus.ACCEPTED,

        acceptedAt:
          new Date(),
      },

      start: {
        status:
          ServiceRequestStatus.ONGOING,
      },

      complete: {
        status:
          ServiceRequestStatus.COMPLETED,

        completedAt:
          new Date(),
      },

      deny: {
        status:
          ServiceRequestStatus.DENIED,

        deniedAt:
          new Date(),
      },
    };


    return prisma.$transaction(
      async (tx) => {

        const updated =
          await tx.serviceRequest.update({
            where: {
              id,
            },

            data:
              statusData[action],
          });


        const lead =
          await tx.lead.findFirst({
            where: {
              serviceRequestId:
                id,
            },
          });


        if (lead) {
          const leadStatusMap: Record<
            string,
            LeadStatus
          > = {
            start:
              LeadStatus.ONGOING,

            complete:
              LeadStatus.COMPLETED,

            deny:
              LeadStatus.DENIED,
          };


          if (
            leadStatusMap[action]
          ) {
            await tx.lead.update({
              where: {
                id: lead.id,
              },

              data: {
                status:
                  leadStatusMap[action],
              },
            });
          }
        }


        return updated;
      },
    );
  }

  /**
   * =====================================================
   * ADMIN MANUAL ASSIGNMENT
   * =====================================================
   */
  async assign(
    adminId: string,
    id: string,
    vendorId: string,
  ) {
    const vendor =
      await prisma.vendor.findUnique({
        where: {
          id: vendorId,
        },
      });


    if (
      !vendor ||
      vendor.role !== "TECHNICIAN" ||
      vendor.verificationStatus !==
        VendorVerificationStatus.VERIFIED ||
      vendor.profileStatus !==
        VendorProfileStatus.PUBLISHED ||
      vendor.deletedAt
    ) {
      throw createHttpError(
        400,
        "Vendor is not eligible for assignment.",
      );
    }


    const request =
      await this.repo.find(id);

    if (!request) {
      throw createHttpError(
        404,
        "Service request not found.",
      );
    }


    if (
      !request.branchId ||
      vendor.branchId !== request.branchId
    ) {
      throw createHttpError(
        403,
        "Vendor is outside the service request branch.",
      );
    }


    return prisma.$transaction(
      async (tx) => {

        const updatedRequest =
          await tx.serviceRequest.update({
            where: {
              id,
            },

            data: {
              assignedVendorId:
                vendorId,

              status:
                ServiceRequestStatus.ASSIGNED,
            },
          });


        const lead =
          await tx.lead.findFirst({
            where: {
              serviceRequestId:
                id,
            },
          });


        if (!lead) {
          throw createHttpError(
            409,
            "Linked lead is missing for this service request.",
          );
        }


        if (
          lead.assignedVendorId &&
          lead.assignedVendorId !== vendorId
        ) {
          throw createHttpError(
            409,
            "Linked lead is already assigned to another vendor.",
          );
        }


        /**
         * Assignment is NOT acceptance.
         *
         * Keep Lead in NEW state.
         *
         * Vendor can then accept it.
         */
        await tx.lead.update({
          where: {
            id: lead.id,
          },

          data: {
            assignedVendorId:
              vendorId,
          },
        });


        await tx.leadAssignment.create({
          data: {
            leadId:
              lead.id,

            vendorId,
          },
        });


        return updatedRequest;
      },
    );
  }


  /**
   * ADMIN LIST.
   */
  async adminList(
    page = 1,
    limit = 20,
  ) {
    const where = {};

    const [
      data,
      total,
    ] =
      await Promise.all([
        this.repo.list(
          where,
          (page - 1) * limit,
          limit,
        ),

        this.repo.count(
          where,
        ),
      ]);


    return {
      data,

      pagination: {
        page,
        limit,
        total,

        totalPages:
          Math.ceil(
            total / limit,
          ),
      },
    };
  }
}