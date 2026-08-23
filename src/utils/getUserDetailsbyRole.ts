import { Role } from "../generated/prisma/enums";

export default function getUserIncludeByRole(role: Role) {
  switch (role) {
    case Role.CLIENT:
      return {
        orders: true,
        serviceRequests: true,
        complaints: true,
        notifications: true,
        siteFeedbacks: true,
        chatRooms: true,
        activityLogs: true,
      };

    case Role.VENDOR:
      return {
        vendorProfile: true,
        leadsAssigned: true,
        orders: true,
        serviceRequests: true,
        notifications: true,
        chatRooms: true,
        activityLogs: true,
      };

    case Role.ADMIN:
      return {
        leadsCreated: true,
        complaints: true,
        notifications: true,
        activityLogs: true,
      };

    case Role.SADMIN:
      return {
        leadsCreated: true,
        complaints: true,
        notifications: true,
        activityLogs: true,
        siteFeedbacks: true,
      };

    default:
      return {};
  }
}