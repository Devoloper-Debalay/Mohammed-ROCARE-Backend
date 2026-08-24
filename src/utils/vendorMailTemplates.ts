interface MailContent {
  subject: string;
  html: string;
}

const wrap = (title: string, bodyHtml: string) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #0f4c81;">${title}</h2>
    ${bodyHtml}
    <p style="color: #888; font-size: 12px; margin-top: 32px;">— ROCARE Vendor Platform</p>
  </div>
`;

export function otpEmail(code: string, purpose: string): MailContent {
  const purposeLabel: Record<string, string> = {
    SIGNUP: "verify your phone number",
    LOGIN: "log in",
    RESET_PASSWORD: "reset your password",
  };
  return {
    subject: `Your ROCARE OTP: ${code}`,
    html: wrap(
      "Your OTP Code",
      `<p>Use the code below to ${purposeLabel[purpose] ?? "continue"}:</p>
       <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
       <p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`
    ),
  };
}

export function registrationReceivedEmail(fullName: string, vendorCode: string): MailContent {
  return {
    subject: "Welcome to ROCARE — Registration Received",
    html: wrap(
      "Registration Received",
      `<p>Hi ${fullName},</p>
       <p>Thanks for signing up as a ROCARE vendor. Your vendor code is <b>${vendorCode}</b>.</p>
       <p>Next, verify your phone number, then complete your KYC and bank details before submitting your profile for admin verification.</p>`
    ),
  };
}

export function loginSuccessEmail(fullName: string, method: "PASSWORD" | "PHONE_OTP"): MailContent {
  const methodLabel = method === "PHONE_OTP" ? "phone OTP" : "password";
  return {
    subject: "ROCARE Vendor Login Successful",
    html: wrap(
      "Login Successful",
      `<p>Hi ${fullName},</p>
       <p>Your ROCARE vendor account was successfully signed in using <b>${methodLabel}</b>.</p>
       <p>If this was not you, please reset your password and contact support immediately.</p>`
    ),
  };
}

 export function otpEmailTemplate(code: string, purpose: string): MailContent {
  const purposeLabel: Record<string, string> = {
    SIGNUP: "verify your phone number",
    LOGIN: "log in",
    RESET_PASSWORD: "reset your password",
  };
  return {
    subject: `Your ROCARE OTP: ${code}`,
    html: wrap(
      "Your OTP Code",
      `<p>Use the code below to ${purposeLabel[purpose] ?? "continue"}:</p>
       <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">${code}</p>
       <p>This code expires in 5 minutes. If you didn't request this, you can ignore this email.</p>`
    ),
  };
}

export function submittedForReviewEmail(fullName: string): MailContent {
  return {
    subject: "Your ROCARE Profile is Under Review",
    html: wrap(
      "Profile Submitted",
      `<p>Hi ${fullName},</p>
       <p>Your profile has been submitted for admin verification. We'll notify you once it's reviewed and published — you'll be able to log in as soon as that happens.</p>`
    ),
  };
}

export function profileVerifiedEmail(fullName: string): MailContent {
  return {
    subject: "Your ROCARE Profile Has Been Verified",
    html: wrap(
      "Profile Verified",
      `<p>Hi ${fullName},</p>
       <p>Your KYC has been verified by our admin team. Your profile will be published shortly, after which you'll be able to log in.</p>`
    ),
  };
}

export function profilePublishedEmail(fullName: string): MailContent {
  return {
    subject: "You're Live on ROCARE!",
    html: wrap(
      "Profile Published",
      `<p>Hi ${fullName},</p>
       <p>Your profile is now published. You can log in and start accepting leads right away.</p>`
    ),
  };
}

export function profileRejectedEmail(fullName: string, reason: string): MailContent {
  return {
    subject: "ROCARE Profile Verification — Action Needed",
    html: wrap(
      "Verification Update",
      `<p>Hi ${fullName},</p>
       <p>Your profile verification was not approved for the following reason:</p>
       <p style="background:#fff3f3; padding:12px; border-left:3px solid #d33;">${reason}</p>
       <p>Please update your details and resubmit for review.</p>`
    ),
  };
}

export function accountRestrictedEmail(fullName: string, contactEmail: string, contactPhone: string): MailContent {
  return {
    subject: "Your ROCARE Account Has Been Restricted",
    html: wrap(
      "Account Restricted",
      `<p>Hi ${fullName},</p>
       <p>Your technician account has been temporarily restricted due to a pattern of low customer ratings.</p>
       <p>Please contact your local admin to resolve this: <b>${contactEmail}</b> / <b>${contactPhone}</b>.</p>`
    ),
  };
}

export function deletionRequestedEmail(fullName: string): MailContent {
  return {
    subject: "ROCARE Account Deletion Request Received",
    html: wrap(
      "Deletion Request Received",
      `<p>Hi ${fullName},</p>
       <p>We've received your account deletion request. An admin will review it shortly.</p>`
    ),
  };
}

export function passwordChangedEmail(fullName: string): MailContent {
  return {
    subject: "Your ROCARE Password Was Changed",
    html: wrap(
      "Password Changed",
      `<p>Hi ${fullName},</p>
       <p>This is a confirmation that your password was just changed. If this wasn't you, contact support immediately.</p>`
    ),
  };
}
