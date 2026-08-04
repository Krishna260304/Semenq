import { useState } from "react";
import { Link } from "wouter";
import { Activity, Eye, EyeOff, ArrowRight, Loader2, Zap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HumanCheck, createCaptchaChallenge, isCaptchaSolved } from "@/components/HumanCheck";
import { auth } from "@/lib/firebase";
import {
  getAuthErrorMessage,
  getRegisteredUserRole,
  getRoleDashboardPath,
  normalizeEmail,
  saveRegisteredUserRole,
} from "@/lib/auth";
import {
  signInWithPopup,
  signInWithCustomToken,
  signOut,
  GoogleAuthProvider,
} from "firebase/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"patient" | "pharmacy" | "admin">("patient");
  const [captcha, setCaptcha] = useState(createCaptchaChallenge);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpMode, setOtpMode] = useState<"login" | "two_factor">("login");
  const [otpEmail, setOtpEmail] = useState("");
  const [otpRole, setOtpRole] = useState<"patient" | "pharmacy" | "admin">("patient");
  const [otpCode, setOtpCode] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "code" | "password">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [resetSending, setResetSending] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  const refreshCaptcha = () => {
    setCaptcha(createCaptchaChallenge());
    setCaptchaAnswer("");
  };

  const resetPasswordDialog = (open: boolean) => {
    setResetOpen(open);

    if (!open) {
      setResetStep("request");
      setResetEmail("");
      setResetCode("");
      setResetPassword("");
      setResetConfirmPassword("");
      setShowResetPassword(false);
      setResetSending(false);
      setResetSubmitting(false);
    }
  };

  const openPasswordResetDialog = () => {
    setResetEmail(normalizeEmail(email));
    setResetStep("request");
    setResetCode("");
    setResetPassword("");
    setResetConfirmPassword("");
    setShowResetPassword(false);
    setResetOpen(true);
  };

  const apiJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> || {}),
    };

    const currentUser = auth.currentUser;
    if (currentUser) {
      headers.Authorization = `Bearer ${await currentUser.getIdToken()}`;
    }

    const response = await fetch(path, { ...init, headers });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.success === false) {
      throw new Error(body?.message || body?.detail || `Request failed (${response.status})`);
    }
    return body as T;
  };

  const openSupportOtpDialog = async (mode: "login" | "two_factor", targetEmail: string, targetRole: "patient" | "pharmacy" | "admin") => {
    const normalizedEmail = normalizeEmail(targetEmail);
    if (!normalizedEmail) {
      throw new Error("Please enter your email address first.");
    }

    setOtpSending(true);
    try {
      setOtpRequested(false);
      await apiJson("/api/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({
          email: normalizedEmail,
          role: targetRole,
          purpose: mode,
        }),
      });
      setOtpMode(mode);
      setOtpEmail(normalizedEmail);
      setOtpRole(targetRole);
      setOtpCode("");
      setOtpRequested(true);
      setOtpOpen(true);
    } finally {
      setOtpSending(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const registeredRole = getRegisteredUserRole(credential.user.uid, credential.user.email);

      if (registeredRole && registeredRole !== role) {
        await signOut(auth);
        toast.error(`This account is registered as ${registeredRole}. Select the correct role to continue.`);
        return;
      }

      const selectedRole = registeredRole || role;
      saveRegisteredUserRole(credential.user.uid, credential.user.email || "", selectedRole);
      toast.success("Signed in with Google.");
      window.location.assign(getRoleDashboardPath(selectedRole));
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    setFieldErrors({});

    if (!isCaptchaSolved(captcha, captchaAnswer)) {
      setFieldErrors({ general: "Captcha answer is incorrect. Please try the new challenge." });
      refreshCaptcha();
      return;
    }

    // basic client-side validation
    if (!email.trim()) {
      setFieldErrors({ email: "Please enter your email address." });
      return;
    }

    if (!password) {
      setFieldErrors({ password: "Please enter your password." });
      return;
    }

    setLoading(true);
    try {
      const registeredRole = getRegisteredUserRole("", email);

      if (registeredRole && registeredRole !== role) {
        toast.error(`This account is registered as ${registeredRole}. Select the correct role to continue.`);
        refreshCaptcha();
        return;
      }

      const result = await apiJson<{ data: { access_token: string; refresh_token: string; firebase_custom_token?: string; role: string; email: string; full_name: string } }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          identifier: normalizeEmail(email),
          password,
        }),
      });

      const selectedRole = (result.data.role as typeof role) || registeredRole || role;
      const customToken = result.data.firebase_custom_token;
      if (!customToken) {
        throw new Error("Could not start a Firebase session. Please contact support.");
      }

      const userCred = await signInWithCustomToken(auth, customToken);
      saveRegisteredUserRole(userCred.user.uid, result.data.email || email, selectedRole);

      const profileResponse = await apiJson<{ data?: { twoFactorEnabled?: boolean } }>("/api/users/me");
      const needsTwoFactor = Boolean(profileResponse?.data?.twoFactorEnabled);

      if (needsTwoFactor) {
        await openSupportOtpDialog("two_factor", result.data.email || email, selectedRole);
        return;
      }

      toast.success("Signed in successfully.");
      window.location.assign(getRoleDashboardPath(selectedRole));
    } catch (error) {
      const message = error instanceof Error ? error.message : getAuthErrorMessage(error);
      if (message.toLowerCase().includes("invalid email/phone or password")) {
        setFieldErrors({ password: "Incorrect email or password. Please try again." });
      } else if (message.toLowerCase().includes("verify your email")) {
        setFieldErrors({ general: message });
      } else {
        setFieldErrors({ general: message });
      }
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const registeredRole = getRegisteredUserRole("", email);
    if (registeredRole && registeredRole !== role) {
      toast.error(`This account is registered as ${registeredRole}. Select the correct role to continue.`);
      return;
    }

    try {
      await openSupportOtpDialog("login", email, registeredRole || role);
      toast.success("OTP sent to your registered email address.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the OTP.");
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpRequested) {
      toast.error("Please request an OTP first.");
      return;
    }

    if (!otpCode.trim()) {
      toast.error("Enter the OTP sent to your email.");
      return;
    }

    setOtpVerifying(true);
    try {
      const result = await apiJson<{ data: { firebase_custom_token?: string; user_id: string; role: string; email: string; full_name: string } }>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({
          email: otpEmail || normalizeEmail(email),
          otp: otpCode.trim(),
          role: otpRole,
          purpose: otpMode,
        }),
      });

      if (otpMode === "login") {
        const customToken = result.data.firebase_custom_token;
        if (!customToken) {
          throw new Error("OTP verification did not return a sign-in token.");
        }

        const credential = await signInWithCustomToken(auth, customToken);
        saveRegisteredUserRole(credential.user.uid, credential.user.email || otpEmail || normalizeEmail(email), otpRole);
        toast.success("Signed in with OTP.");
        window.location.assign(getRoleDashboardPath(otpRole));
        return;
      }

      toast.success("Two-factor verification complete.");
      window.location.assign(getRoleDashboardPath(otpRole));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That verification code is invalid or expired.");
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    const targetEmail = normalizeEmail(resetEmail || email);
    if (!targetEmail) {
      toast.error("Enter your email address first.");
      return;
    }

    setResetSending(true);
    try {
      await apiJson("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: targetEmail }),
      });
      setResetEmail(targetEmail);
      setResetStep("code");
      toast.success("Reset code sent to your email.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reset code.");
    } finally {
      setResetSending(false);
    }
  };

  const handleVerifyPasswordResetCode = async () => {
    const targetEmail = normalizeEmail(resetEmail || email);
    if (!targetEmail) {
      toast.error("Enter your email address first.");
      return;
    }

    if (!/^\d{6}$/.test(resetCode.trim())) {
      toast.error("Enter the 6-digit reset code from your email.");
      return;
    }

    setResetSubmitting(true);
    try {
      await apiJson("/api/auth/verify-password-reset", {
        method: "POST",
        body: JSON.stringify({
          token: resetCode.trim(),
        }),
      });

      setResetStep("password");
      toast.success("Reset code verified. Enter a new password.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify the reset code.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    const targetEmail = normalizeEmail(resetEmail || email);
    if (!targetEmail) {
      toast.error("Enter your email address first.");
      return;
    }

    if (resetPassword.length < 8) {
      toast.error("New password must be at least 8 characters long.");
      return;
    }

    if (resetPassword !== resetConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setResetSubmitting(true);
    try {
      await apiJson("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token: resetCode.trim(),
          new_password: resetPassword,
          confirm_password: resetConfirmPassword,
        }),
      });

      toast.success("Password reset successfully. Please sign in again.");
      resetPasswordDialog(false);
      setPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reset the password.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const resetOtpDialog = (open: boolean) => {
    setOtpOpen(open);

    if (!open) {
      setOtpCode("");
      setOtpRequested(false);
      setOtpEmail("");
      setOtpRole("patient");
      setOtpMode("login");
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-[#1e40af] via-primary to-ai flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>

        <Link href="/">
          <div className="flex items-center gap-3 relative cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-2xl">Semenq</span>
          </div>
        </Link>

        <div className="relative">
          <h2 className="text-4xl font-bold text-white mb-4 leading-tight">
            Your medicines,<br />found instantly.
          </h2>
          <p className="text-white/70 text-lg mb-10">
            AI-powered search across the Semenq pharmacy network — from your street to all of India.
          </p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: "AI prescription parsing in seconds" },
              { icon: MapPin, text: "National medicine search network" },
            ].map(item => {
              const Icon = item.icon;
              return (
                <div key={item.text} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-white/90 text-sm font-medium">{item.text}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <Link href="/" className="lg:hidden">
            <div className="flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl">Semenq</span>
            </div>
          </Link>

          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back</h1>
            <p className="text-muted-foreground">Sign in to continue to Semenq</p>
          </div>

          <div className="flex gap-2 mb-6 p-1 bg-muted rounded-xl">
            {(["patient", "pharmacy", "admin"] as const).map(r => (
              <button
                key={r}
                onClick={() => setRole(r)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium capitalize transition-all ${role === r ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {fieldErrors.general ? (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">{fieldErrors.general}</div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-12 rounded-[16px]"
                required
              />
              {fieldErrors.email ? <p className="text-destructive text-sm mt-1">{fieldErrors.email}</p> : null}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={openPasswordResetDialog}
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="h-12 rounded-[16px] pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password ? <p className="text-destructive text-sm mt-1">{fieldErrors.password}</p> : null}
            </div>

            <HumanCheck
              inputId="login-captcha"
              challenge={captcha}
              answer={captchaAnswer}
              onAnswerChange={setCaptchaAnswer}
              onRefresh={refreshCaptcha}
            />

            <Button
              type="submit"
              className="w-full h-12 rounded-[18px] font-semibold gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground bg-background px-3">
              or continue with
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" className="h-12 rounded-[16px]" onClick={handleGoogleLogin} disabled={loading}>
              Google
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-[16px]" onClick={handleSendOtp} disabled={loading || otpSending}>
              OTP <span className="ml-1 text-xs text-muted-foreground">via email</span>
            </Button>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link href="/register">
              <span className="text-primary font-medium hover:underline cursor-pointer">Create one free</span>
            </Link>
          </p>
        </div>
      </div>

      <Dialog open={otpOpen} onOpenChange={resetOtpDialog}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{otpMode === "two_factor" ? "Two-factor verification" : "Sign in with OTP"}</DialogTitle>
            <DialogDescription>
              OTPs are delivered to your registered email address. Enter the code to continue.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
              Verification code sent for <span className="font-medium text-foreground">{otpEmail || normalizeEmail(email) || "your account"}</span>.
            </div>

            {otpRequested && (
              <div className="space-y-2">
                <Label htmlFor="otp-code">OTP code</Label>
                <Input
                  id="otp-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="6-digit code"
                  value={otpCode}
                  onChange={e => setOtpCode(e.target.value)}
                  className="h-11 rounded-[16px] tracking-[0.25em]"
                />
              </div>
            )}

            <Button
              type="button"
              className="w-full h-11 rounded-[16px] font-semibold"
              onClick={handleVerifyOtp}
              disabled={otpVerifying || !otpRequested}
            >
              {otpVerifying ? "Verifying" : otpMode === "two_factor" ? "Verify and continue" : "Verify and sign in"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={resetPasswordDialog}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              We will send a 6-digit reset code to your email, then you can set a new password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="name@example.com"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                className="h-11 rounded-[16px]"
                autoComplete="email"
              />
            </div>

            {resetStep === "password" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="reset-password"
                      type={showResetPassword ? "text" : "password"}
                      placeholder="Enter a new password"
                      value={resetPassword}
                      onChange={e => setResetPassword(e.target.value)}
                      className="h-11 rounded-[16px] pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(value => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm new password</Label>
                  <Input
                    id="reset-confirm-password"
                    type={showResetPassword ? "text" : "password"}
                    placeholder="Re-enter the new password"
                    value={resetConfirmPassword}
                    onChange={e => setResetConfirmPassword(e.target.value)}
                    className="h-11 rounded-[16px]"
                    autoComplete="new-password"
                  />
                </div>
              </>
            ) : resetStep === "code" ? (
              <>
                <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Enter the 6-digit code we sent to{" "}
                  <span className="font-medium text-foreground">{normalizeEmail(resetEmail || email) || "your email"}</span>.
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reset-code">Reset code</Label>
                  <Input
                    id="reset-code"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="6-digit code"
                    value={resetCode}
                    onChange={e => setResetCode(e.target.value.replace(/\D/g, ""))}
                    className="h-11 rounded-[16px] tracking-[0.25em]"
                    autoComplete="one-time-code"
                  />
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Enter your email address and we will send a 6-digit reset code.
              </div>
            )}

            <div className="flex gap-3">
              {resetStep !== "request" ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1 rounded-[16px]"
                  onClick={() => {
                    setResetStep("request");
                    setResetCode("");
                    setResetPassword("");
                    setResetConfirmPassword("");
                  }}
                  disabled={resetSubmitting || resetSending}
                >
                  Change email
                </Button>
              ) : null}

              <Button
                type="button"
                className="h-11 flex-1 rounded-[16px] font-semibold"
                onClick={
                  resetStep === "request"
                    ? handleRequestPasswordReset
                    : resetStep === "code"
                      ? handleVerifyPasswordResetCode
                      : handleResetPassword
                }
                disabled={resetSending || resetSubmitting}
              >
                {resetSending || resetSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {resetStep === "request" ? "Sending" : resetStep === "code" ? "Verifying" : "Resetting"}
                  </>
                ) : resetStep === "request" ? (
                  "Send reset code"
                ) : resetStep === "code" ? (
                  "Verify code"
                ) : (
                  "Reset password"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
