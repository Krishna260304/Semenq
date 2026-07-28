import { FirebaseError } from "firebase/app";

export type UserRole = "patient" | "pharmacy" | "admin";

const ROLE_BY_UID_PREFIX = "semenq:user-role:uid:";
const ROLE_BY_EMAIL_PREFIX = "semenq:user-role:email:";
const ROLE_BY_PHONE_PREFIX = "semenq:user-role:phone:";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeDialCode(dialCode: string): string {
  return dialCode.trim().replace(/\D/g, "");
}

export function normalizePhoneNumber(phone: string): string {
  const compact = phone.trim().replace(/[\s\-()]/g, "");
  if (!compact) return "";
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  if (/^\d{10}$/.test(compact)) return `+91${compact}`;
  if (/^\d+$/.test(compact)) return `+${compact}`;
  return compact;
}

export function composePhoneNumber(dialCode: string, phoneNumber: string): string {
  const normalizedDialCode = normalizeDialCode(dialCode);
  const normalizedPhoneNumber = phoneNumber.trim().replace(/\D/g, "");
  return normalizedDialCode && normalizedPhoneNumber ? `+${normalizedDialCode}${normalizedPhoneNumber}` : "";
}

export function isValidPhoneNumber(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhoneNumber(phone));
}

export function getRoleDashboardPath(role: UserRole): string {
  if (role === "patient") return "/patient/dashboard";
  if (role === "pharmacy") return "/pharmacy/dashboard";
  return "/admin/dashboard";
}

export function saveRegisteredUserRole(uid: string, email: string, role: UserRole, phone?: string): void {
  if (typeof window === "undefined") return;

  const normalizedEmail = normalizeEmail(email);
  window.localStorage.setItem(`${ROLE_BY_UID_PREFIX}${uid}`, role);
  window.localStorage.setItem(`${ROLE_BY_EMAIL_PREFIX}${normalizedEmail}`, role);

  if (phone) {
    saveRegisteredPhoneRole(phone, role, uid);
  }
}

export function saveRegisteredPhoneRole(phone: string, role: UserRole, uid?: string): void {
  if (typeof window === "undefined") return;

  if (uid) {
    window.localStorage.setItem(`${ROLE_BY_UID_PREFIX}${uid}`, role);
  }
  window.localStorage.setItem(`${ROLE_BY_PHONE_PREFIX}${normalizePhoneNumber(phone)}`, role);
}

export function getRegisteredPhoneRole(phone: string): UserRole | null {
  if (typeof window === "undefined") return null;

  const byPhone = window.localStorage.getItem(`${ROLE_BY_PHONE_PREFIX}${normalizePhoneNumber(phone)}`);
  return isUserRole(byPhone) ? byPhone : null;
}

export function getRegisteredUserRole(uid: string, email: string | null): UserRole | null {
  if (typeof window === "undefined") return null;

  const byUid = window.localStorage.getItem(`${ROLE_BY_UID_PREFIX}${uid}`);
  if (isUserRole(byUid)) return byUid;

  if (!email) return null;
  const byEmail = window.localStorage.getItem(`${ROLE_BY_EMAIL_PREFIX}${normalizeEmail(email)}`);
  return isUserRole(byEmail) ? byEmail : null;
}

export function isUserRole(value: unknown): value is UserRole {
  return value === "patient" || value === "pharmacy" || value === "admin";
}

export function getAuthErrorMessage(error: unknown): string {
  if (!(error instanceof FirebaseError)) {
    return "Authentication failed. Please try again.";
  }

  switch (error.code) {
    case "auth/email-already-in-use":
      return "This email is already registered. Please sign in instead.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "No registered account matched those credentials.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password must be at least 6 characters for Firebase authentication.";
    case "auth/invalid-phone-number":
      return "Please enter a valid phone number with country code.";
    case "auth/missing-phone-number":
      return "Please enter your phone number.";
    case "auth/code-expired":
      return "That OTP has expired. Please request a new code.";
    case "auth/invalid-verification-code":
      return "The OTP code is incorrect. Please try again.";
    case "auth/captcha-check-failed":
      return "Firebase captcha verification failed. Please try again.";
    case "auth/network-request-failed":
      return "Network error while contacting Firebase. Please check your connection.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a moment and try again.";
    default:
      return error.message || "Authentication failed. Please try again.";
  }
}
