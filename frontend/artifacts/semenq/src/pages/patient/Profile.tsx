import { useState, useEffect, useCallback, useRef } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import {
  User, MapPin, CreditCard, Bell, Shield, ChevronRight,
  Edit3, Save, X, Plus, Trash2, Navigation, Loader2, Monitor, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import {
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
  updatePassword,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from "firebase/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const indianStates = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat",
  "Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh",
  "Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab",
  "Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh",
  "Uttarakhand","West Bengal",
];

const sections = [
  { id: "personal", icon: User, label: "Personal Information" },
  { id: "addresses", icon: MapPin, label: "Addresses" },
  { id: "payment", icon: CreditCard, label: "Payment Methods" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
];

async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

export default function Profile() {
  const { user, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("personal");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", state: "", pincode: "", address: "" });
  const [notifPrefs, setNotifPrefs] = useState({
    reservation_reminders: true,
    order_updates: true,
    ai_insights: true,
    low_stock_alerts: false,
    promotions: false,
  });

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [addrForm, setAddrForm] = useState({
    address_name: "Home", street: "", area: "", city: "", state: "",
    pincode: "", landmark: "", address_type: "home", is_default: false,
    latitude: null as number | null, longitude: null as number | null,
  });
  const [geoLoading, setGeoLoading] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [securityDialog, setSecurityDialog] = useState<"password" | "twoFactor" | "delete" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [twoFactorPhone, setTwoFactorPhone] = useState("");
  const [twoFactorVerificationId, setTwoFactorVerificationId] = useState<string | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);
  const recaptchaRef = useRef<any>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const normalizePhoneNumber = (phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, "");
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.length === 10) return `+91${cleaned}`;
    return `+${cleaned}`;
  };

  const isValidPhoneNumber = (phone: string) => {
    return /^\+[1-9]\d{6,14}$/.test(phone);
  };

  const queryClient = useQueryClient();

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => apiFetch("/api/users/me"),
    enabled: !authLoading && !!user,
    retry: 1,
  });

  const { data: addressesData, isLoading: addressesLoading } = useQuery({
    queryKey: ["my-addresses"],
    queryFn: () => apiFetch("/api/users/me/addresses"),
    enabled: !authLoading && !!user,
    retry: 1,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: () => apiFetch("/api/auth/sessions"),
    enabled: sessionsOpen && !authLoading && !!user,
    retry: 1,
  });

  const profile = (profileData as any)?.data;
  const addresses: any[] = (addressesData as any)?.data || [];
  const twoFactorEnabled = Boolean(profile?.twoFactorEnabled);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      city: profile.city || "",
      state: profile.state || "",
      pincode: profile.pincode || "",
      address: profile.address || "",
    });
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Profile updated successfully.");
      setEditing(false);
    },
    onError: () => toast.error("Failed to update profile."),
  });

  const addAddressMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/users/me/addresses", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      toast.success("Address saved.");
      setShowAddressForm(false);
      resetAddrForm();
    },
    onError: () => toast.error("Failed to save address."),
  });

  const updateAddressMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiFetch(`/api/users/me/addresses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
      toast.success("Address updated.");
      setEditingAddrId(null);
      setShowAddressForm(false);
      resetAddrForm();
    },
    onError: () => toast.error("Failed to update address."),
  });

  const deleteAddressMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/users/me/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-addresses"] });
      toast.success("Address deleted.");
    },
    onError: () => toast.error("Failed to delete address."),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiFetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("Session revoked.");
    },
    onError: () => toast.error("Could not revoke that session."),
  });

  const resetAddrForm = () => {
    setAddrForm({
      address_name: "Home", street: "", area: "", city: "", state: "",
      pincode: "", landmark: "", address_type: "home", is_default: false,
      latitude: null, longitude: null,
    });
    setEditingAddrId(null);
  };

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setAddrForm(prev => ({ ...prev, latitude, longitude }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const geo = await res.json();
          const addr = geo.address || {};
          setAddrForm(prev => ({
            ...prev,
            latitude,
            longitude,
            street: addr.road || addr.pedestrian || addr.suburb || "",
            area: addr.suburb || addr.neighbourhood || addr.quarter || "",
            city: addr.city || addr.town || addr.village || addr.county || "",
            state: addr.state || "",
            pincode: addr.postcode || "",
            landmark: addr.amenity || addr.tourism || addr.building || "",
          }));
          toast.success("Location detected and address filled.");
        } catch {
          toast.success(`Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        toast.error("Could not get your location. Please allow location access.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const startEditAddress = (addr: any) => {
    setAddrForm({
      address_name: addr.address_name || "Home",
      street: addr.street || "",
      area: addr.area || "",
      city: addr.city || "",
      state: addr.state || "",
      pincode: addr.pincode || "",
      landmark: addr.landmark || "",
      address_type: addr.address_type || "home",
      is_default: addr.is_default || false,
      latitude: addr.latitude ?? null,
      longitude: addr.longitude ?? null,
    });
    setEditingAddrId(addr.id);
    setShowAddressForm(true);
  };

  const handleSaveAddress = () => {
    if (!addrForm.street || !addrForm.city || !addrForm.state || !addrForm.pincode) {
      toast.error("Please fill street, city, state and pincode.");
      return;
    }
    if (editingAddrId) {
      updateAddressMutation.mutate({ id: editingAddrId, data: addrForm });
    } else {
      addAddressMutation.mutate(addrForm);
    }
  };

  const displayName = profile?.name || user?.displayName || user?.email?.split("@")[0] || "Account";
  const savedSessions: any[] = (sessionsData as any)?.data || [];
  const sessions = savedSessions.length > 0
    ? savedSessions
    : user
      ? [{ id: "current-browser", deviceName: "This browser", deviceOs: navigator.platform, current: true }]
      : [];

  useEffect(() => {
    return () => {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    };
  }, []);

  const closeSecurityDialog = () => {
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
    setSecurityDialog(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTwoFactorCode("");
    setTwoFactorVerificationId(null);
    setDeleteConfirmation("");
    setDeletePassword("");
  };

  const handleChangePassword = async (): Promise<void> => {
    if (!user?.email) { toast.error("Your account does not have a password sign-in method."); return; }
    if (newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match."); return; }

    setSecurityLoading(true);
    try {
      if (currentPassword) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
      }
      await updatePassword(user, newPassword);
      toast.success("Password updated successfully.");
      closeSecurityDialog();
    } catch (error: any) {
      toast.error(error?.code === "auth/requires-recent-login" ? "Enter your current password to verify your identity first." : "Could not update your password.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const sendTwoFactorCode = async (): Promise<void> => {
    if (!user) return;
    const phone = normalizePhoneNumber(twoFactorPhone);
    if (!isValidPhoneNumber(phone)) { toast.error("Enter a valid phone number with country code."); return; }
    setTwoFactorLoading(true);
    try {
      const verifier = recaptchaRef.current || new RecaptchaVerifier(auth, "profile-2fa-recaptcha", { size: "invisible" });
      recaptchaRef.current = verifier;
      const session = await multiFactor(user).getSession();
      const verificationId = await new PhoneAuthProvider(auth).verifyPhoneNumber({ phoneNumber: phone, session }, verifier);
      setTwoFactorVerificationId(verificationId);
      toast.success("Verification code sent.");
    } catch (error) {
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
      toast.error("Could not send the verification code.");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const enableTwoFactor = async (): Promise<void> => {
    if (!user || !twoFactorVerificationId || !twoFactorCode.trim()) { toast.error("Enter the verification code."); return; }
    setTwoFactorLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(twoFactorVerificationId, twoFactorCode.trim());
      await multiFactor(user).enroll(PhoneMultiFactorGenerator.assertion(credential), "Semenq phone");
      toast.success("Two-factor authentication enabled.");
      closeSecurityDialog();
    } catch {
      toast.error("That verification code is invalid or expired.");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const disableTwoFactor = async (): Promise<void> => {
    if (!user) return;
    const factor = multiFactor(user).enrolledFactors[0];
    if (!factor) return;
    setTwoFactorLoading(true);
    try {
      await multiFactor(user).unenroll(factor);
      toast.success("Two-factor authentication disabled.");
      closeSecurityDialog();
    } catch {
      toast.error("Could not disable two-factor authentication.");
    } finally {
      setTwoFactorLoading(false);
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (!user || deleteConfirmation !== "DELETE") { toast.error("Type DELETE to confirm account deletion."); return; }
    if (user.providerData.some(provider => provider.providerId === "password") && !deletePassword) {
      toast.error("Enter your current password to confirm account deletion.");
      return;
    }
    setSecurityLoading(true);
    try {
      if (deletePassword && user.email) {
        await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, deletePassword));
      }
      await apiFetch("/api/users/me", { method: "DELETE" });
      await deleteUser(user);
      await signOut(auth);
      window.location.assign("/login");
    } catch {
      toast.error("Could not delete the account. Please re-authenticate and try again.");
    } finally {
      setSecurityLoading(false);
    }
  };

  return (
    <PatientLayout>
      <TopBar title="Profile Settings" userName={displayName} />

      <div className="p-6 max-w-5xl">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-1">
            <div className="bg-card border border-card-border rounded-[24px] p-5 text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-bold text-primary">{displayName[0]?.toUpperCase() || "U"}</span>
              </div>
              <p className="font-semibold text-foreground">{displayName}</p>
              <p className="text-sm text-muted-foreground">{profile?.email || user?.email || ""}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">
                Verified Patient
              </span>
            </div>

            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeSection === section.id
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                  <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                </button>
              );
            })}
          </div>

          <div className="bg-card border border-card-border rounded-[24px] p-6">
            {activeSection === "personal" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-foreground">Personal Information</h2>
                  {editing ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateProfileMutation.mutate({ name: form.name, phone: form.phone })}
                        className="gap-1.5 rounded-[18px]"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 rounded-[18px]">
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </Button>
                  )}
                </div>

                {profileLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Full Name", key: "name", type: "text", colSpan: true },
                      { label: "Email", key: "email", type: "email", disabled: true },
                      { label: "Phone", key: "phone", type: "tel" },
                      { label: "City", key: "city", type: "text", disabled: true },
                      { label: "State", key: "state", type: "text", disabled: true },
                      { label: "PIN Code", key: "pincode", type: "text", disabled: true },
                    ].map(field => (
                      <div key={field.key} className={`space-y-1.5 ${field.colSpan ? "col-span-2" : ""}`}>
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          {field.label}
                        </Label>
                        {editing && !field.disabled ? (
                          <Input
                            type={field.type}
                            value={form[field.key as keyof typeof form]}
                            onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                            className="h-11 rounded-[14px]"
                          />
                        ) : (
                          <p className="text-sm font-medium text-foreground py-2.5 px-0 border-b border-border">
                            {form[field.key as keyof typeof form] || "—"}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Address</Label>
                  <p className="text-sm font-medium text-foreground py-2.5 border-b border-border">
                    {form.address || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">Manage your addresses in the Addresses section.</p>
                </div>
              </div>
            )}

            {activeSection === "addresses" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-bold text-foreground">Saved Addresses</h2>
                  {!showAddressForm && (
                    <Button size="sm" onClick={() => { resetAddrForm(); setShowAddressForm(true); }} className="gap-1.5 rounded-[18px]">
                      <Plus className="w-3.5 h-3.5" /> Add Address
                    </Button>
                  )}
                </div>

                {showAddressForm && (
                  <div className="mb-6 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">{editingAddrId ? "Edit Address" : "New Address"}</h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleUseMyLocation}
                        disabled={geoLoading}
                        className="gap-1.5 rounded-[14px] text-xs"
                      >
                        {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                        Use My Live Location
                      </Button>
                    </div>

                    {addrForm.latitude !== null && addrForm.longitude !== null && (
                      <p className="text-xs text-success bg-success/10 px-3 py-1.5 rounded-lg">
                        Location: {addrForm.latitude?.toFixed(5)}, {addrForm.longitude?.toFixed(5)}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Label</Label>
                        <Input value={addrForm.address_name} onChange={e => setAddrForm(p => ({ ...p, address_name: e.target.value }))} className="h-10 rounded-[12px]" placeholder="Home / Office" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <select
                          value={addrForm.address_type}
                          onChange={e => setAddrForm(p => ({ ...p, address_type: e.target.value }))}
                          className="w-full h-10 rounded-[12px] border border-input bg-background px-3 text-sm"
                        >
                          <option value="home">Home</option>
                          <option value="office">Office</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Street / Flat / Building</Label>
                      <Input value={addrForm.street} onChange={e => setAddrForm(p => ({ ...p, street: e.target.value }))} className="h-10 rounded-[12px]" placeholder="102, Sunrise Apartments, MG Road" />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Area / Locality</Label>
                      <Input value={addrForm.area} onChange={e => setAddrForm(p => ({ ...p, area: e.target.value }))} className="h-10 rounded-[12px]" placeholder="Bandra West" />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">City</Label>
                        <Input value={addrForm.city} onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))} className="h-10 rounded-[12px]" placeholder="Mumbai" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">State</Label>
                        <select
                          value={addrForm.state}
                          onChange={e => setAddrForm(p => ({ ...p, state: e.target.value }))}
                          className="w-full h-10 rounded-[12px] border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select State</option>
                          {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">PIN Code</Label>
                        <Input value={addrForm.pincode} onChange={e => setAddrForm(p => ({ ...p, pincode: e.target.value }))} className="h-10 rounded-[12px]" placeholder="400050" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Landmark (optional)</Label>
                      <Input value={addrForm.landmark} onChange={e => setAddrForm(p => ({ ...p, landmark: e.target.value }))} className="h-10 rounded-[12px]" placeholder="Near Bandra Station" />
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addrForm.is_default}
                        onChange={e => setAddrForm(p => ({ ...p, is_default: e.target.checked }))}
                      />
                      Set as default address
                    </label>

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={handleSaveAddress}
                        className="rounded-[14px]"
                        disabled={addAddressMutation.isPending || updateAddressMutation.isPending}
                      >
                        {addAddressMutation.isPending || updateAddressMutation.isPending
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Save className="w-3.5 h-3.5" />}
                        Save Address
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setShowAddressForm(false); resetAddrForm(); }} className="rounded-[14px]">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {addressesLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading addresses...</div>
                ) : addresses.length === 0 && !showAddressForm ? (
                  <div className="text-center py-10">
                    <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No addresses saved yet.</p>
                    <Button size="sm" onClick={() => { resetAddrForm(); setShowAddressForm(true); }} className="mt-3 rounded-[14px] gap-1.5">
                      <Plus className="w-3.5 h-3.5" /> Add Your First Address
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr: any) => (
                      <div key={addr.id} className={`p-4 rounded-xl border ${addr.is_default ? "border-primary/30 bg-primary/5" : "border-border"}`}>
                        <div className="flex items-start gap-3">
                          <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${addr.is_default ? "text-primary" : "text-muted-foreground"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {addr.address_name}
                              {addr.is_default && (
                                <span className="ml-2 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Default</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {[addr.street, addr.area, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                            </p>
                            {addr.latitude && addr.longitude && (
                              <p className="text-xs text-success/80 mt-0.5">
                                📍 {addr.latitude.toFixed(5)}, {addr.longitude.toFixed(5)}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button className="p-1.5 hover:bg-muted rounded-lg" onClick={() => startEditAddress(addr)}>
                              <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button
                              className="p-1.5 hover:bg-destructive/10 rounded-lg"
                              onClick={() => deleteAddressMutation.mutate(addr.id)}
                              disabled={deleteAddressMutation.isPending}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === "payment" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Payment Methods</h2>
                <div className="text-center py-12">
                  <CreditCard className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground mb-1">No payment methods saved</p>
                  <p className="text-xs text-muted-foreground mb-5">Payment methods are selected securely when you place an order.</p>
                  <Button variant="outline" className="rounded-[18px] h-11 px-6" onClick={() => setActiveSection("personal")}>
                    Continue to profile
                  </Button>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { key: "reservation_reminders", label: "Reservation reminders", desc: "Get notified before reservations expire" },
                    { key: "order_updates", label: "Order updates", desc: "Track your order status in real-time" },
                    { key: "ai_insights", label: "AI medicine insights", desc: "Personalised medicine recommendations" },
                    { key: "low_stock_alerts", label: "Low stock alerts", desc: "Know when your medicines are running low" },
                    { key: "promotions", label: "Promotional offers", desc: "Discounts and offers from partner pharmacies" },
                  ].map(pref => (
                    <div key={pref.key} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{pref.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof p] }));
                          toast.success("Preference updated");
                        }}
                        className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${notifPrefs[pref.key as keyof typeof notifPrefs] ? "bg-primary" : "bg-muted"}`}
                      >
                        <div
                          className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${notifPrefs[pref.key as keyof typeof notifPrefs] ? "left-6" : "left-1"}`}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "security" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Security</h2>
                <div className="space-y-3">
                  {[
                    { label: "Change Password", desc: "Update your account password", action: () => setSecurityDialog("password") },
                    { label: "Two-Factor Authentication", desc: "Protect your account with Email ID OTP", action: () => setSecurityDialog("twoFactor") },
                    { label: "Active Sessions", desc: "View and manage your active sessions", action: () => setSessionsOpen(true) },
                    { label: "Delete Account", desc: "Permanently delete your Semenq account", danger: true, action: () => setSecurityDialog("delete") },
                  ].map(item => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left ${
                        (item as any).danger
                          ? "border-destructive/20 hover:bg-destructive/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${(item as any).danger ? "text-destructive" : "text-foreground"}`}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="rounded-[20px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Active Sessions</DialogTitle>
            <DialogDescription>Review the browsers currently signed in to your Semenq account.</DialogDescription>
          </DialogHeader>

          {sessionsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading sessions...
            </div>
          ) : sessions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No active sessions found.</p>
          ) : (
            <div className="space-y-3">
              {sessions.map((session: any) => (
                <div key={session.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Monitor className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{session.deviceName || "Unknown device"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.deviceOs || session.operatingSystem || "Browser session"}
                      {session.current ? " · Current session" : ""}
                    </p>
                  </div>
                  {!session.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive gap-1.5"
                      onClick={() => revokeSessionMutation.mutate(session.id)}
                      disabled={revokeSessionMutation.isPending}
                    >
                      <LogOut className="w-3.5 h-3.5" /> Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={securityDialog === "password"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Use a strong password that you do not reuse elsewhere.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current password</Label>
              <Input id="current-password" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" />
            </div>
            <Button className="w-full rounded-[16px]" onClick={handleChangePassword} disabled={securityLoading}>
              {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={securityDialog === "twoFactor"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>Require an SMS verification code whenever this account signs in.</DialogDescription>
          </DialogHeader>
          <div id="profile-2fa-recaptcha" />
          {user && multiFactor(user).enrolledFactors.length > 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-success/20 bg-success/5 p-4 text-sm text-success">Two-factor authentication is enabled for this account.</div>
              <Button variant="outline" className="w-full rounded-[16px] text-destructive hover:text-destructive" onClick={disableTwoFactor} disabled={twoFactorLoading}>
                Disable two-factor authentication
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="two-factor-phone">Phone number</Label>
                <Input id="two-factor-phone" type="tel" placeholder="+919876543210" value={twoFactorPhone} onChange={event => setTwoFactorPhone(event.target.value)} autoComplete="tel" />
              </div>
              {!twoFactorVerificationId ? (
                <Button className="w-full rounded-[16px]" onClick={sendTwoFactorCode} disabled={twoFactorLoading}>
                  {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send verification code"}
                </Button>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="two-factor-code">Verification code</Label>
                    <Input id="two-factor-code" inputMode="numeric" value={twoFactorCode} onChange={event => setTwoFactorCode(event.target.value)} autoComplete="one-time-code" />
                  </div>
                  <Button className="w-full rounded-[16px]" onClick={enableTwoFactor} disabled={twoFactorLoading}>
                    {twoFactorLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enable two-factor authentication"}
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={securityDialog === "delete"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Account</DialogTitle>
            <DialogDescription>This permanently disables your account and signs you out. Your order records are retained for legal and operational reasons.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {user?.providerData.some(provider => provider.providerId === "password") && (
              <div className="space-y-2">
                <Label htmlFor="delete-password">Current password</Label>
                <Input id="delete-password" type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} autoComplete="current-password" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">Type DELETE to confirm</Label>
              <Input id="delete-confirmation" value={deleteConfirmation} onChange={event => setDeleteConfirmation(event.target.value)} autoComplete="off" />
            </div>
            <Button variant="destructive" className="w-full rounded-[16px]" onClick={deleteAccount} disabled={securityLoading || deleteConfirmation !== "DELETE"}>
              {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete my account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
