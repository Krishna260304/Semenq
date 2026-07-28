import { useState } from "react";
import { Link } from "wouter";
import { Activity, ArrowRight, ArrowLeft, Check, User, Building2, Eye, EyeOff, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HumanCheck, createCaptchaChallenge, isCaptchaSolved } from "@/components/HumanCheck";
import { PhoneNumberField } from "@/components/PhoneNumberField";
import { auth } from "@/lib/firebase";
import { composePhoneNumber, getAuthErrorMessage, getRoleDashboardPath, isValidPhoneNumber, normalizeEmail, saveRegisteredUserRole } from "@/lib/auth";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "firebase/auth";
import { toast } from "sonner";

type Role = "patient" | "pharmacy" | null;

const indianStates = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fetchingLocation, setFetchingLocation] = useState(false);

  const fetchLiveLocation = () => {
    setFetchingLocation(true);

    const fallbackToIP = async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        if (data && !data.error) {
          setForm(prev => ({
            ...prev,
            city: data.city || prev.city,
            state: data.region || prev.state,
            pincode: data.postal || prev.pincode
          }));
          toast.success("Location estimated from IP address");
        } else {
          toast.error("Could not determine location");
        }
      } catch (e) {
        toast.error("Failed to get location");
      } finally {
        setFetchingLocation(false);
      }
    };

    if (!navigator.geolocation || window.isSecureContext === false) {
      toast.info("Precise location unavailable, estimating from network...");
      fallbackToIP();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json`);
          const data = await res.json();
          if (data && data.address) {
            const { road, suburb, city, state, postcode, county } = data.address;
            const addressParts = [road, suburb, county].filter(Boolean);
            setForm(prev => ({ 
              ...prev, 
              address: addressParts.join(", "),
              city: city || prev.city,
              state: state || prev.state,
              pincode: postcode || prev.pincode
            }));
            toast.success("Location fetched successfully");
          } else {
            toast.error("Could not determine address from location");
          }
        } catch (error) {
          toast.error("Failed to fetch address details");
        } finally {
          setFetchingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.info("Location access denied, estimating from network...");
        fallbackToIP();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const update = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));
  const refreshCaptcha = () => {
    setCaptcha(createCaptchaChallenge());
    setCaptchaAnswer("");
  };

  const totalSteps = role === "patient" ? 3 : 3;

  const validateCurrentStep = () => {
    setFieldErrors({});
    if (!role) return false;

    if (step === 1) {
      const phone = composePhoneNumber(form.phoneDialCode, form.phoneNumber);
      const phoneIsValid = isValidPhoneNumber(phone);
      if (role === "patient") {
        if (!form.name.trim()) {
          setFieldErrors({ name: "Please enter your full name." });
          return false;
        }
        if (!form.email.trim()) {
          setFieldErrors({ email: "Please enter your email address." });
          return false;
        }
        if (!phoneIsValid) {
          setFieldErrors({ phone: "Please enter a valid phone number with country code." });
          return false;
        }
      }

      if (role === "pharmacy") {
        if (!form.businessName.trim()) {
          setFieldErrors({ businessName: "Please enter your business name." });
          return false;
        }
        if (!form.name.trim()) {
          setFieldErrors({ name: "Please enter the owner name." });
          return false;
        }
        if (!form.licenseNumber.trim()) {
          setFieldErrors({ licenseNumber: "Please enter your license number." });
          return false;
        }
        if (!form.email.trim()) {
          setFieldErrors({ email: "Please enter your email address." });
          return false;
        }
        if (!phoneIsValid) {
          setFieldErrors({ phone: "Please enter a valid phone number with country code." });
          return false;
        }
      }
    }

    if (step === 2) {
      if (!form.address.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
        setFieldErrors({ address: "Please complete your address details." });
        return false;
      }
    }

    if (step === 3) {
      if (form.password.length < 8) {
        setFieldErrors({ password: "Password must be at least 8 characters." });
        return false;
      }

      if (form.password !== confirmPassword) {
        setFieldErrors({ password: "Passwords do not match." });
        return false;
      }

      if (!termsAccepted) {
        setFieldErrors({ terms: "Please accept the Terms of Service and Privacy Policy." });
        return false;
      }

      if (!captchaAnswer.trim()) {
        setFieldErrors({ captcha: "Enter the answer to the human check." });
        return false;
      }

      if (!isCaptchaSolved(captcha, captchaAnswer)) {
        setFieldErrors({ captcha: "That answer is incorrect. Please try again." });
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
      const email = normalizeEmail(form.email);
      let credential;

      try {
        credential = await createUserWithEmailAndPassword(auth, email, form.password);
      } catch (error) {
        // If a previous attempt created the Firebase credential but the API was
        // unavailable, allow this retry to finish syncing that account.
        if ((error as { code?: string })?.code !== "auth/email-already-in-use") {
          throw error;
        }
        credential = await signInWithEmailAndPassword(auth, email, form.password);
      }

      const displayName = role === "patient" ? form.name.trim() : form.businessName.trim();
      const phone = composePhoneNumber(form.phoneDialCode, form.phoneNumber);

      await updateProfile(credential.user, { displayName });

      // Force the client to mint a fresh Firebase ID token after profile updates.
      await credential.user.reload();

      const submitRegistration = async (idToken: string) =>
        fetch("/api/auth/register/firebase", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_token: idToken,
            full_name: displayName,
            email,
            phone,
            role,
            address: form.address,
            street: form.address,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
            license_number: role === "pharmacy" ? form.licenseNumber : undefined,
          }),
        });

      const idToken = await credential.user.getIdToken(true);
      let response = await submitRegistration(idToken);
      let result = await response.json().catch(() => null);

      if (
        response.status === 401 &&
        typeof result?.detail === "string" &&
        result.detail.toLowerCase().includes("firebase id token")
      ) {
        const refreshedToken = await credential.user.getIdToken(true);
        response = await submitRegistration(refreshedToken);
        result = await response.json().catch(() => null);
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || result?.detail || "Unable to finish setting up your account. Please try again.");
      }

      saveRegisteredUserRole(credential.user.uid, form.email, role, phone);
      toast.success("Account created successfully.");
      window.location.assign(getRoleDashboardPath(role));
    } catch (error) {
      const code = (error as any)?.code;
      if (code === "auth/invalid-email") {
        setFieldErrors({ email: "Please enter a valid email address." });
      } else {
        setFieldErrors({
          general: error instanceof Error && !code ? error.message : getAuthErrorMessage(error),
        });
      }
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
            {role === "patient" ? "Find medicines and manage your prescriptions with confidence." : "Grow your pharmacy with AI-powered intelligence."}
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
          {fieldErrors.general ? (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm">{fieldErrors.general}</div>
          ) : null}
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
                  {fieldErrors.name ? <p className="text-destructive text-sm mt-1">{fieldErrors.name}</p> : null}
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="name@example.com" value={form.email} onChange={e => update("email", e.target.value)} className="h-11 rounded-[16px]" />
                  {fieldErrors.email ? <p className="text-destructive text-sm mt-1">{fieldErrors.email}</p> : null}
                </div>
                <PhoneNumberField
                  label="Phone"
                  inputId="patient-phone"
                  dialCode={form.phoneDialCode}
                  phoneNumber={form.phoneNumber}
                  onDialCodeChange={value => update("phoneDialCode", value)}
                  onPhoneNumberChange={value => update("phoneNumber", value)}
                />
                {fieldErrors.phone ? <p className="text-destructive text-sm mt-1">{fieldErrors.phone}</p> : null}
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
                  {fieldErrors.email ? <p className="text-destructive text-sm mt-1">{fieldErrors.email}</p> : null}
                </div>
                <PhoneNumberField
                  label="Phone"
                  inputId="pharmacy-phone"
                  dialCode={form.phoneDialCode}
                  phoneNumber={form.phoneNumber}
                  onDialCodeChange={value => update("phoneDialCode", value)}
                  onPhoneNumberChange={value => update("phoneNumber", value)}
                />
                {fieldErrors.phone ? <p className="text-destructive text-sm mt-1">{fieldErrors.phone}</p> : null}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Full Address</Label>
                  <div className="relative">
                    <Input placeholder="Full address" value={form.address} onChange={e => update("address", e.target.value)} className="h-11 rounded-[16px] pr-12" />
                    <button 
                      type="button" 
                      onClick={fetchLiveLocation} 
                      disabled={fetchingLocation}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-primary hover:text-primary/80 disabled:opacity-50"
                      title="Fetch live location"
                    >
                      {fetchingLocation ? <Loader2 className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                    </button>
                  </div>
                  {fieldErrors.address ? <p className="text-destructive text-sm mt-1">{fieldErrors.address}</p> : null}
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
                  {fieldErrors.password ? <p className="text-destructive text-sm mt-1">{fieldErrors.password}</p> : null}
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
                {fieldErrors.terms ? <p className="text-destructive text-sm mt-1">{fieldErrors.terms}</p> : null}
                <HumanCheck
                  inputId="register-captcha"
                  challenge={captcha}
                  answer={captchaAnswer}
                  onAnswerChange={setCaptchaAnswer}
                  onRefresh={refreshCaptcha}
                  error={fieldErrors.captcha}
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
