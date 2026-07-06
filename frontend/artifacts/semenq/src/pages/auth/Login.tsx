import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { Activity, Eye, EyeOff, ArrowRight, Shield, Zap, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HumanCheck, createCaptchaChallenge, isCaptchaSolved } from "@/components/HumanCheck";
import { PhoneNumberField } from "@/components/PhoneNumberField";
import { auth } from "@/lib/firebase";
import {
  composePhoneNumber,
  getAuthErrorMessage,
  getRegisteredPhoneRole,
  getRegisteredUserRole,
  getRoleDashboardPath,
  isValidPhoneNumber,
  normalizeEmail,
  saveRegisteredPhoneRole,
} from "@/lib/auth";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signOut,
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
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpDialCode, setOtpDialCode] = useState("91");
  const [otpPhoneNumber, setOtpPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpConfirmation, setOtpConfirmation] = useState<ConfirmationResult | null>(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const refreshCaptcha = () => {
    setCaptcha(createCaptchaChallenge());
    setCaptchaAnswer("");
  };

  const getRecaptchaVerifier = () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(auth, "login-recaptcha-container", {
        size: "invisible",
      });
    }

    return recaptchaRef.current;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCaptchaSolved(captcha, captchaAnswer)) {
      toast.error("Captcha answer is incorrect. Please try the new challenge.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
      const registeredRole = getRegisteredUserRole(credential.user.uid, credential.user.email);

      if (registeredRole && registeredRole !== role) {
        await signOut(auth);
        toast.error(`This account is registered as ${registeredRole}. Select the correct role to continue.`);
        refreshCaptcha();
        return;
      }

      toast.success("Signed in successfully.");
      window.location.assign(getRoleDashboardPath(registeredRole || role));
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const normalizedPhone = composePhoneNumber(otpDialCode, otpPhoneNumber);

    if (!isValidPhoneNumber(normalizedPhone)) {
      toast.error("Enter a valid country code and phone number.");
      return;
    }

    const registeredRole = getRegisteredPhoneRole(normalizedPhone);
    if (!registeredRole) {
      toast.error("This phone number is not registered. Create an account first.");
      return;
    }

    if (registeredRole !== role) {
      toast.error(`This phone number is registered as ${registeredRole}. Select the correct role to continue.`);
      return;
    }

    setOtpSending(true);
    try {
      const confirmation = await signInWithPhoneNumber(auth, normalizedPhone, getRecaptchaVerifier());
      setOtpConfirmation(confirmation);
      toast.success("OTP sent by SMS.");
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast.error(getAuthErrorMessage(error));
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpConfirmation) {
      toast.error("Please request an OTP first.");
      return;
    }

    if (!otpCode.trim()) {
      toast.error("Enter the OTP sent to your phone.");
      return;
    }

    setOtpVerifying(true);
    try {
      const credential = await otpConfirmation.confirm(otpCode.trim());
      const phone = composePhoneNumber(otpDialCode, otpPhoneNumber);
      saveRegisteredPhoneRole(phone, role, credential.user.uid);
      toast.success("Signed in with OTP.");
      window.location.assign(getRoleDashboardPath(role));
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
    } finally {
      setOtpVerifying(false);
    }
  };

  const resetOtpDialog = (open: boolean) => {
    setOtpOpen(open);

    if (!open) {
      setOtpDialCode("91");
      setOtpPhoneNumber("");
      setOtpCode("");
      setOtpConfirmation(null);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div id="login-recaptcha-container" />
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
            AI-powered search across 18,000+ pharmacies — from your street to all of India.
          </p>

          <div className="space-y-4">
            {[
              { icon: Zap, text: "AI prescription parsing in seconds" },
              { icon: MapPin, text: "National medicine search network" },
              { icon: Shield, text: "CDSCO verified pharmacies only" },
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

        <div className="relative">
          <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20">
            <p className="text-white/70 text-xs mb-2 font-medium">WHAT OUR USERS SAY</p>
            <p className="text-white text-sm">"I used to spend hours finding medicines. Semenq makes the search quick and simple."</p>
            <p className="text-white/60 text-xs mt-2">— Pharmacy team member</p>
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
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
            <Button type="button" variant="outline" className="h-12 rounded-[16px]" onClick={() => toast.info("Google login coming soon")}>
              Google
            </Button>
            <Button type="button" variant="outline" className="h-12 rounded-[16px]" onClick={() => resetOtpDialog(true)}>
              OTP <span className="ml-1 text-xs text-muted-foreground">via SMS</span>
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
            <DialogTitle>Sign in with OTP</DialogTitle>
            <DialogDescription>
              Use the phone number from your registered Semenq account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <PhoneNumberField
                label="Phone"
                inputId="otp-phone"
                dialCode={otpDialCode}
                phoneNumber={otpPhoneNumber}
                onDialCodeChange={setOtpDialCode}
                onPhoneNumberChange={setOtpPhoneNumber}
                disabled={Boolean(otpConfirmation)}
              />
              {!otpConfirmation ? (
                <Button
                  type="button"
                  className="h-11 w-full rounded-[16px]"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                >
                  {otpSending ? "Sending" : "Send OTP"}
                </Button>
              ) : null}
            </div>

            {otpConfirmation && (
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

            {otpConfirmation ? (
              <Button
                type="button"
                className="w-full h-11 rounded-[16px] font-semibold"
                onClick={handleVerifyOtp}
                disabled={otpVerifying}
              >
                {otpVerifying ? "Verifying" : "Verify and sign in"}
              </Button>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
