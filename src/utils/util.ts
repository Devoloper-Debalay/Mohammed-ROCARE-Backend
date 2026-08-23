import type { User, VendorProfile, Role } from "../generated/prisma/client";

export interface IUserDetails {
  id: string;
  googleId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  isActive: boolean;
  createdBy: string;
  updatedBy: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: Date | null;
  email: string;
  phone: string | null;
  homeTown: string;
  currentCity: string;
  gender: string;
  role: Role;
  profilePhoto: string;
  vendorProfile: VendorProfile | null;
}

export function getUserResponse(
  user: User & { vendorProfile?: VendorProfile | null }
): IUserDetails {
  return {
    id: user.id,
    googleId: user.googleId ?? null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    deletedAt: user.deletedAt ?? null,
    isActive: user.isActive,
    createdBy: user.createdBy ?? "",
    updatedBy: user.updatedBy ?? "",
    firstName: user.firstName,
    middleName: user.middleName ?? "",
    lastName: user.lastName,
    dob: user.dob ?? null,
    email: user.email,
    phone: user.phone ?? null,
    homeTown: user.homeTown ?? "",
    currentCity: user.currentCity ?? "",
    gender: user.gender,
    role: user.role,
    profilePhoto: user.profilePhoto ?? "",

    // full vendor profile when present (role === VENDOR); null otherwise
    vendorProfile: user.vendorProfile ?? null,
  };
}

// Deliberately excluded from IUserDetails / getUserResponse: `password`.
// Never spread a raw Prisma User into an API response elsewhere in the
// codebase without stripping it first — this mapper is the safe boundary.