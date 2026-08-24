import { VendorProfileStatus, VendorVerificationStatus } from "../../generated/prisma/enums";

/** Decoded vendor JWT payload — set on req.vendor by the vendor auth middleware. */
export interface VendorTokenPayload {
  vendorId: string;
  role: string;
}

export interface VendorPublicProfile {
  id: string;
  vendorCode: string;
  role: string;
  fullName: string;
  phone: string;
  email: string | null;
  profilePhoto: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  latitude: number | null;
  longitude: number | null;
  experienceYears: number | null;
  skills: string[];
  specialization: string | null;
  verificationStatus: VendorVerificationStatus;
  profileStatus: VendorProfileStatus;
  rejectionReason: string | null;
  referralCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  kyc: {
    aadhaarNumber: string | null;
    aadhaarFrontImage: string | null;
    aadhaarBackImage: string | null;
    panNumber: string | null;
    panImage: string | null;
  } | null;
  bankDetail: {
    bankAccount: string;
    ifsc: string;
    upiId: string | null;
  } | null;
}

export interface ProofInput {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  reason?: string;
  image?: Buffer;
}