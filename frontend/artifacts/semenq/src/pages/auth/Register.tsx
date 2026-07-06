import { useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowRight, ArrowLeft, Check, User, Building2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HumanCheck, createCaptchaChallenge, isCaptchaSolved } from "@/components/HumanCheck";
import { PhoneNumberField } from "@/components/PhoneNumberField";
import { auth } from "@/lib/firebase";
import { composePhoneNumber, getAuthErrorMessage, getRoleDashboardPath, isValidPhoneNumber, normalizeEmail, saveRegisteredUserRole } from "@/lib/auth";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { toast } from "sonner";

type Role = "patient" | "pharmacy" | null;

const indianStates = ["Andhra Pradesh", "Delhi", "Gujarat", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal"];

export default function Register() {
  const [role, setRole] = useState<Role>(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [captcha, setCaptcha] = useState(createCaptchaChallenge);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneDialCode: "91",
    phoneNumber: "",
    city: "",
    state: "",
    pincode: "",
    address: "",
    password: "",
    businessName: "",
    licenseNumber: "",
  });

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const refreshCaptcha = () => {
    setCaptcha(createCaptchaChallenge());
    setCaptchaAnswer("");
  };

  const totalSteps = role === "patient" ? 3 : 3;

  const validateCurrentStep = () => {
    if (!role) return false;

    if (step === 1) {
      const phone = composePhoneNumber(form.phoneDialCode, form.phoneNumber);
      const phoneIsValid = isValidPhoneNumber(phone);
      const missingPatientInfo = role === "patient" && (!form.name.trim() || !form.email.trim() || !phoneIsValid);
      const missingPharmacyInfo = role === "pharmacy" && (!form.businessName.trim() || !form.name.trim() || !form.licenseNumber.trim() || !form.email.trim() || !phoneIsValid);

      if (missingPatientInfo || missingPharmacyInfo) {
        toast.error("Please complete all required account details.");
        return false;
      }
    }

    if (step === 2 && (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim())) {
      toast.error("Please complete your address details.");
      return false;
    }

    if (step === 3) {
      if (form.password.length < 8) {
        toast.error("Password must be at least 8 characters.");
        return false;
      }

      if (form.password !== confirmPassword) {
        toast.error("Passwords do not match.");
        return false;
      }

      if (!termsAccepted) {
        toast.error("Please accept the Terms of Service and Privacy Policy.");
        return false;
      }

      if (!isCaptchaSolved(captcha, captchaAnswer)) {
        toast.error("Captcha answer is incorrect. Please try the new challenge.");
        refreshCaptcha();
        return false;
      }
    }

    return true;
  };

  const handleContinue = () => {
    if (validateCurrentStep()) {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    if (!role || !validateCurrentStep()) return;

    setLoading(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(form.email), form.password);
      const displayName = role === "patient" ? form.name.trim() : form.businessName.trim();
      const phone = composePhoneNumber(form.phoneDialCode, form.phoneNumber);

      await updateProfile(credential.user, { displayName });
      saveRegisteredUserRole(credential.user.uid, form.email, role, phone);

      toast.success("Account created successfully.");
      window.location.assign(getRoleDashboardPath(role));
    } catch (error) {
      toast.error(getAuthErrorMessage(error));
      refreshCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const ProgressStep = ({ num, label }: { num: number; label: string }) => (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= num ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
        {step > num ? <Check className="w-3.5 h-3.5" /> : num}
      </div>
      <span className={`text-sm font-medium hidden sm:block ${step >= num ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="w-full max-w-lg">
          <Link href="/">
            <div className="flex items-center gap-2 mb-10 cursor-pointer">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-xl">Semenq</span>
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">How will you be using Semenq?</p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { value: "patient" as Role, icon: User, title: "I'm a Patient", desc: "Find prescribed medicines, upload prescriptions, and track orders.", color: "border-primary/30 hover:border-primary bg-primary/5" },
              { value: "pharmacy" as Role, icon: Building2, title: "I'm a Pharmacy", desc: "Manage inventory, process reservations, and access AI demand forecasting.", color: "border-ai/30 hover:border-ai bg-ai/5" },
            ].map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => { setRole(option.value); setStep(1); }}
                  className={`p-6 border-2 rounded-[24px] text-left transition-all group ${option.color}`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${option.value === "patient" ? "bg-primary/10" : "bg-ai/10"}`}>
                    <Icon className={`w-6 h-6 ${option.value === "patient" ? "text-primary" : "text-ai"}`} />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{option.title}</h3>
                  <p className="text-xs text-muted-foreground">{option.desc}</p>
                </button>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/login">
              <span className="text-primary font-medium hover:underline cursor-pointer">Sign in</span>
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const patientSteps = [
    { label: "Personal Info" },
    { label: "Address" },
    { label: "Security" },
  ];

  const pharmacySteps = [
    { label: "Business Info" },
    { label: "Location" },
    { label: "Security" },
  ];

  const steps = role === "patient" ? patientSteps : pharmacySteps;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-2/5 bg-gradient-to-br from-[#1e40af] via-primary to-ai flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-0 w-48 h-48 bg-white rounded-full blur-3xl" />
        </div>
        <Link href="/">
          <div className="flex items-center gap-3 relative cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-2xl">Semenq</span>
          </div>
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold text-white mb-4">
            {role === "patient" ? "Join 2.4 million patients who never worry about medicines." : "Grow your pharmacy with AI-powered intelligence."}
          </h2>
          <p className="text-white/70">
            {role === "patient" ? "Find any medicine, anywhere in India. Upload prescriptions, reserve, and get delivered." : "Real-time demand forecasting, automated reservations, and national reach."}
          </p>
        </div>
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/20 relative">
          <p className="text-white/60 text-xs mb-1">GETTING STARTED</p>
          <p className="text-white text-sm font-medium">Step {step} of {totalSteps}: {steps[step - 1]?.label}</p>
          <div className="flex gap-1.5 mt-3">
            {steps.map((_, i) => (
              <div key={i} className={`h-1 rounded-full transition-all flex-1 ${step > i ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-4 mb-8">
            {steps.map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <ProgressStep num={i + 1} label={s.label} />
                {i < steps.length - 1 && <div className={`h-0.5 flex-1 min-w-[20px] ${step > i + 1 ? "bg-primary" : "bg-border"}`} />}
              </div>
            ))}
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-1">
            {role === "patient" ? patientSteps[step - 1]?.label : pharmacySteps[step - 1]?.label}
          </h1>
          <p className="text-muted-foreground mb-6">
            {step === 1 ? (role === "patient" ? "Tell us about yourself" : "Tell us about your pharmacy") : step === 2 ? "Where are you located?" : "Keep your account secure"}
          </p>

          <div className="space-y-4">
            {step === 1 && role === "patient" && (
              <>
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input placeholder="Full name" value={form.name} onChange={e => update("name", e.target.value)} className="h-11 rounded-[16px]" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="name@example.com" value={form.email} onChange={e => update("email", e.target.value)} className="h-11 rounded-[16px]" />
                </div>
                <PhoneNumberField
                  label="Phone"
                  inputId="patient-phone"
                  dialCode={form.phoneDialCode}
                  phoneNumber={form.phoneNumber}
                  onDialCodeChange={value => update("phoneDialCode", value)}
                  onPhoneNumberChange={value => update("phoneNumber", value)}
                />
              </>
            )}

            {step === 1 && role === "pharmacy" && (
              <>
                <div className="space-y-2">
                  <Label>Pharmacy / Business Name</Label>
                  <Input placeholder="Business name" value={form.businessName} onChange={e => update("businessName", e.target.value)} className="h-11 rounded-[16px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Owner Name</Label>
                    <Input placeholder="Owner name" value={form.name} onChange={e => update("name", e.target.value)} className="h-11 rounded-[16px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>License Number</Label>
                    <Input placeholder="License number" value={form.licenseNumber} onChange={e => update("licenseNumber", e.target.value)} className="h-11 rounded-[16px]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="name@example.com" value={form.email} onChange={e => update("email", e.target.value)} className="h-11 rounded-[16px]" />
                </div>
                <PhoneNumberField
                  label="Phone"
                  inputId="pharmacy-phone"
                  dialCode={form.phoneDialCode}
                  phoneNumber={form.phoneNumber}
                  onDialCodeChange={value => update("phoneDialCode", value)}
                  onPhoneNumberChange={value => update("phoneNumber", value)}
                />
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Full Address</Label>
                  <Input placeholder="Full address" value={form.address} onChange={e => update("address", e.target.value)} className="h-11 rounded-[16px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input placeholder="City" value={form.city} onChange={e => update("city", e.target.value)} className="h-11 rounded-[16px]" />
                  </div>
                  <div className="space-y-2">
                    <Label>State</Label>
                    <select value={form.state} onChange={e => update("state", e.target.value)} className="w-full h-11 rounded-[16px] border border-input bg-background px-3 text-sm">
                      <option value="">Select State</option>
                      {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>PIN Code</Label>
                    <Input placeholder="PIN code" value={form.pincode} onChange={e => update("pincode", e.target.value)} className="h-11 rounded-[16px]" />
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Input type={showPassword ? "text" : "password"} placeholder="Min. 8 characters" value={form.password} onChange={e => update("password", e.target.value)} className="h-11 rounded-[16px] pr-10" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {form.password && (
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length >= i * 3 ? i <= 1 ? "bg-destructive" : i <= 2 ? "bg-warning" : i <= 3 ? "bg-primary" : "bg-success" : "bg-muted"}`} />
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    placeholder="Confirm password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="h-11 rounded-[16px]"
                  />
                </div>
                <div className="text-xs text-muted-foreground flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={e => setTermsAccepted(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>I agree to Semenq's Terms of Service and Privacy Policy.</span>
                </div>
                <HumanCheck
                  inputId="register-captcha"
                  challenge={captcha}
                  answer={captchaAnswer}
                  onAnswerChange={setCaptchaAnswer}
                  onRefresh={refreshCaptcha}
                />
              </>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-12 rounded-[18px]">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}
            {step < totalSteps ? (
              <Button onClick={handleContinue} className="flex-1 h-12 rounded-[18px] font-semibold">
                Continue <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} className="flex-1 h-12 rounded-[18px] font-semibold" disabled={loading}>
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Create Account <ArrowRight className="w-4 h-4 ml-2" /></>}
              </Button>
            )}
          </div>

          {step === 1 && (
            <p className="text-center text-sm text-muted-foreground mt-4">
              Already have an account? <Link href="/login"><span className="text-primary font-medium hover:underline cursor-pointer">Sign in</span></Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
