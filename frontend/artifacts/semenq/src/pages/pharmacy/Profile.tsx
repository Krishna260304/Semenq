import { useState, useEffect, useCallback } from "react";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import {
  Building2, Phone, Mail, ShieldCheck, MapPin, Clock, Truck, Bell, Shield,
  ChevronRight, Edit3, Save, X, Navigation, Loader2, Monitor, LogOut, CheckCircle2
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
  { id: "business", icon: Building2, label: "Business & Owner Info" },
  { id: "operations", icon: Clock, label: "Store & Operating Details" },
  { id: "location", icon: MapPin, label: "Location & Address" },
  { id: "notifications", icon: Bell, label: "Notification Preferences" },
  { id: "security", icon: Shield, label: "Security & Sessions" },
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
  const result = await res.json().catch(() => null);
  if (!res.ok) throw new Error(result?.message || `API error ${res.status}`);
  return result;
}

export default function PharmacyProfile() {
  const { user, loading: authLoading } = useAuth();
  const [activeSection, setActiveSection] = useState("business");
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [editingOps, setEditingOps] = useState(false);

  // Business form
  const [bizForm, setBizForm] = useState({
    pharmacyName: "",
    ownerName: "",
    phone: "",
    alternatePhone: "",
    licenseNumber: "",
    gstNumber: "",
  });

  // Location form
  const [locForm, setLocForm] = useState({
    street: "",
    area: "",
    city: "",
    state: "",
    pincode: "",
    landmark: "",
    latitude: null as number | null,
    longitude: null as number | null,
  });

  // Operations form
  const [opsForm, setOpsForm] = useState({
    homeDeliveryEnabled: true,
    courierEnabled: false,
    deliveryRadiusKm: 5.0,
    is24Hours: false,
    openTime: "08:00",
    closeTime: "22:00",
  });

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    order_alerts: true,
    reservation_alerts: true,
    low_stock_alerts: true,
    ai_demand_forecast: true,
    promotions: false,
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [securityDialog, setSecurityDialog] = useState<"password" | "twoFactor" | "delete" | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityLoading, setSecurityLoading] = useState(false);
  const [twoFactorOtpSent, setTwoFactorOtpSent] = useState(false);
  const [twoFactorOtpInput, setTwoFactorOtpInput] = useState("");
  const [twoFactorOtpLoading, setTwoFactorOtpLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const queryClient = useQueryClient();

  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ["pharmacy-profile"],
    queryFn: () => apiFetch("/api/pharmacies/me"),
    enabled: !authLoading && !!user,
    retry: 1,
  });

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["active-sessions"],
    queryFn: () => apiFetch("/api/auth/sessions"),
    enabled: sessionsOpen && !authLoading && !!user,
    retry: 1,
  });

  const profile = (profileData as any)?.data || {};
  const profileComplete = Boolean(profile.profileComplete ?? true);
  const displayName = profile.pharmacyName || profile.ownerName || user?.displayName || "Pharmacy Account";

  useEffect(() => {
    if (!profile) return;
    setBizForm({
      pharmacyName: profile.pharmacyName || "",
      ownerName: profile.ownerName || "",
      phone: profile.phone || "",
      alternatePhone: profile.alternatePhone || "",
      licenseNumber: profile.licenseNumber || "",
      gstNumber: profile.gstNumber || "",
    });
    setLocForm({
      street: profile.street || "",
      area: profile.area || "",
      city: profile.city || "",
      state: profile.state || "",
      pincode: profile.pincode || "",
      landmark: profile.landmark || "",
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
    });
    const wh = profile.workingHours || {};
    setOpsForm({
      homeDeliveryEnabled: profile.homeDeliveryEnabled ?? true,
      courierEnabled: profile.courierEnabled ?? false,
      deliveryRadiusKm: profile.deliveryRadiusKm ?? 5.0,
      is24Hours: wh.is_24_hours ?? false,
      openTime: wh.monday_open || "08:00",
      closeTime: wh.monday_close || "22:00",
    });
  }, [profileData]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) =>
      apiFetch("/api/pharmacies/me", { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pharmacy-profile"] });
      toast.success("Pharmacy profile updated successfully.");
      setEditingBusiness(false);
      setEditingLocation(false);
      setEditingOps(false);
    },
    onError: (err: any) => toast.error(err.message || "Failed to update pharmacy profile."),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiFetch(`/api/auth/sessions/${sessionId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-sessions"] });
      toast.success("Session revoked.");
    },
    onError: () => toast.error("Could not revoke that session."),
  });

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocForm(prev => ({ ...prev, latitude, longitude }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const geo = await res.json();
          const addr = geo.address || {};
          setLocForm(prev => ({
            ...prev,
            latitude,
            longitude,
            street: addr.road || addr.pedestrian || addr.suburb || prev.street,
            area: addr.suburb || addr.neighbourhood || addr.quarter || prev.area,
            city: addr.city || addr.town || addr.village || addr.county || prev.city,
            state: addr.state || prev.state,
            pincode: addr.postcode || prev.pincode,
            landmark: addr.amenity || addr.building || prev.landmark,
          }));
          toast.success("GPS Location detected and address updated.");
        } catch {
          toast.success(`Location detected: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        toast.error("Could not access your location. Please check browser permissions.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const closeSecurityDialog = () => {
    setSecurityDialog(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setTwoFactorOtpSent(false);
    setTwoFactorOtpInput("");
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
    } catch (err: any) {
      toast.error(err?.code === "auth/requires-recent-login" ? "Enter your current password to verify identity." : "Could not update password.");
    } finally {
      setSecurityLoading(false);
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
      toast.error("Could not delete account. Please re-authenticate and try again.");
    } finally {
      setSecurityLoading(false);
    }
  };

  const savedSessions: any[] = (sessionsData as any)?.data || [];
  const sessions = savedSessions.length > 0
    ? savedSessions
    : user
      ? [{ id: "current-browser", deviceName: "This browser", deviceOs: navigator.platform, current: true }]
      : [];

  return (
    <PharmacyLayout>
      <TopBar title="Pharmacy Profile" subtitle="Manage store details, operating parameters, and security" userName={displayName} />

      <div className="p-6 max-w-5xl">
        <div className="grid lg:grid-cols-[270px_1fr] gap-6">
          {/* Sidebar */}
          <div className="space-y-1">
            <div className="bg-card border border-card-border rounded-[24px] p-5 text-center mb-4 shadow-sm">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Building2 className="w-10 h-10 text-primary" />
              </div>
              <p className="font-bold text-foreground truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground truncate">{profile.ownerName || profile.email || user?.email || ""}</p>
              <span
                className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                  profileComplete
                    ? "bg-success/10 text-success"
                    : "bg-warning/10 text-warning-foreground"
                }`}
              >
                {profile.verificationStatus || (profileComplete ? "Verified Pharmacy" : "Incomplete Profile")}
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
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 text-left">{section.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 opacity-70" />
                </button>
              );
            })}
          </div>

          {/* Main Content Area */}
          <div className="bg-card border border-card-border rounded-[24px] p-6 shadow-sm">
            {/* Section 1: Business & Owner Info */}
            {activeSection === "business" && (
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Business & Owner Information</h2>
                    <p className="text-xs text-muted-foreground">Manage your pharmacy business details and official registration numbers</p>
                  </div>
                  {editingBusiness ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingBusiness(false)} className="gap-1.5 rounded-[14px]">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateProfileMutation.mutate({
                          pharmacyName: bizForm.pharmacyName,
                          ownerName: bizForm.ownerName,
                          phone: bizForm.phone,
                          alternatePhone: bizForm.alternatePhone,
                          licenseNumber: bizForm.licenseNumber,
                          gstNumber: bizForm.gstNumber,
                        })}
                        className="gap-1.5 rounded-[14px]"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Changes
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingBusiness(true)} className="gap-1.5 rounded-[18px]">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Details
                    </Button>
                  )}
                </div>

                {profileLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" /> Loading pharmacy details...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-5">
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pharmacy Name</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.pharmacyName}
                          onChange={e => setBizForm(p => ({ ...p, pharmacyName: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="e.g. Apollo Pharmacy"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.pharmacyName || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Owner Full Name</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.ownerName}
                          onChange={e => setBizForm(p => ({ ...p, ownerName: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="Owner full name"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.ownerName || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Email</Label>
                      <p className="text-sm font-semibold text-foreground py-2 border-b border-border opacity-70 bg-muted/20 px-3 rounded-lg">
                        {profile.email || user?.email || "—"}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Phone</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.phone}
                          onChange={e => setBizForm(p => ({ ...p, phone: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="+91 9876543210"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.phone || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Drug License Number</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.licenseNumber}
                          onChange={e => setBizForm(p => ({ ...p, licenseNumber: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="e.g. DL-12345678"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border font-mono">{profile.licenseNumber || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">GST Identification Number</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.gstNumber}
                          onChange={e => setBizForm(p => ({ ...p, gstNumber: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="e.g. 21AAAAA0000A1Z5"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border font-mono">{profile.gstNumber || "Not registered"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Alternate Contact Phone</Label>
                      {editingBusiness ? (
                        <Input
                          value={bizForm.alternatePhone}
                          onChange={e => setBizForm(p => ({ ...p, alternatePhone: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="Secondary contact phone number"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.alternatePhone || "None"}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Store & Operating Details */}
            {activeSection === "operations" && (
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Store & Operating Details</h2>
                    <p className="text-xs text-muted-foreground">Configure delivery radiuses, fulfillment modes, and store opening hours</p>
                  </div>
                  {editingOps ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingOps(false)} className="gap-1.5 rounded-[14px]">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateProfileMutation.mutate({
                          homeDeliveryEnabled: opsForm.homeDeliveryEnabled,
                          courierEnabled: opsForm.courierEnabled,
                          deliveryRadiusKm: opsForm.deliveryRadiusKm,
                          workingHours: {
                            is_24_hours: opsForm.is24Hours,
                            monday_open: opsForm.openTime,
                            monday_close: opsForm.closeTime,
                          },
                        })}
                        className="gap-1.5 rounded-[14px]"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Settings
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingOps(true)} className="gap-1.5 rounded-[18px]">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Operations
                    </Button>
                  )}
                </div>

                <div className="space-y-6">
                  {/* Fulfillment options */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-primary" />
                          <p className="text-sm font-bold">Local Home Delivery</p>
                        </div>
                        {editingOps ? (
                          <input
                            type="checkbox"
                            checked={opsForm.homeDeliveryEnabled}
                            onChange={e => setOpsForm(p => ({ ...p, homeDeliveryEnabled: e.target.checked }))}
                            className="w-4 h-4 rounded text-primary"
                          />
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.homeDeliveryEnabled !== false ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            {profile.homeDeliveryEnabled !== false ? "Enabled" : "Disabled"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Deliver medicines directly to customers within your local radius.</p>
                    </div>

                    <div className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <p className="text-sm font-bold">Courier Shipping</p>
                        </div>
                        {editingOps ? (
                          <input
                            type="checkbox"
                            checked={opsForm.courierEnabled}
                            onChange={e => setOpsForm(p => ({ ...p, courierEnabled: e.target.checked }))}
                            className="w-4 h-4 rounded text-primary"
                          />
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${profile.courierEnabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                            {profile.courierEnabled ? "Enabled" : "Disabled"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Ship medicines across city/state using third-party courier services.</p>
                    </div>
                  </div>

                  {/* Delivery Radius */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Delivery Radius (Kilometers)
                    </Label>
                    {editingOps ? (
                      <div className="flex items-center gap-4">
                        <Input
                          type="number"
                          step="0.5"
                          min="1"
                          max="50"
                          value={opsForm.deliveryRadiusKm}
                          onChange={e => setOpsForm(p => ({ ...p, deliveryRadiusKm: parseFloat(e.target.value) || 1 }))}
                          className="h-11 w-32 rounded-[14px]"
                        />
                        <span className="text-sm font-medium text-muted-foreground">km around your pharmacy store</span>
                      </div>
                    ) : (
                      <p className="text-sm font-semibold text-foreground py-2 border-b border-border">
                        {profile.deliveryRadiusKm || 5.0} KM delivery range
                      </p>
                    )}
                  </div>

                  {/* Operating Hours */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Operating Hours & Schedule</Label>
                      {editingOps && (
                        <label className="flex items-center gap-2 text-xs cursor-pointer font-medium text-primary">
                          <input
                            type="checkbox"
                            checked={opsForm.is24Hours}
                            onChange={e => setOpsForm(p => ({ ...p, is24Hours: e.target.checked }))}
                          />
                          Open 24/7 (Always Open)
                        </label>
                      )}
                    </div>

                    {opsForm.is24Hours ? (
                      <div className="p-4 rounded-xl bg-success/10 text-success border border-success/20 flex items-center gap-2 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> This pharmacy is configured as open 24 hours a day, 7 days a week.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Opening Time</Label>
                          {editingOps ? (
                            <Input
                              type="time"
                              value={opsForm.openTime}
                              onChange={e => setOpsForm(p => ({ ...p, openTime: e.target.value }))}
                              className="h-10 rounded-[12px]"
                            />
                          ) : (
                            <p className="text-sm font-semibold py-1.5 border-b border-border">{opsForm.openTime || "08:00"}</p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Closing Time</Label>
                          {editingOps ? (
                            <Input
                              type="time"
                              value={opsForm.closeTime}
                              onChange={e => setOpsForm(p => ({ ...p, closeTime: e.target.value }))}
                              className="h-10 rounded-[12px]"
                            />
                          ) : (
                            <p className="text-sm font-semibold py-1.5 border-b border-border">{opsForm.closeTime || "22:00"}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 3: Location & Address */}
            {activeSection === "location" && (
              <div>
                <div className="flex items-center justify-between mb-6 border-b border-border pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">Location & Store Address</h2>
                    <p className="text-xs text-muted-foreground">Set your precise physical store address and live GPS coordinates for customer discovery</p>
                  </div>
                  {editingLocation ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingLocation(false)} className="gap-1.5 rounded-[14px]">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => updateProfileMutation.mutate({
                          street: locForm.street,
                          area: locForm.area,
                          city: locForm.city,
                          state: locForm.state,
                          pincode: locForm.pincode,
                          landmark: locForm.landmark,
                          latitude: locForm.latitude,
                          longitude: locForm.longitude,
                        })}
                        className="gap-1.5 rounded-[14px]"
                        disabled={updateProfileMutation.isPending}
                      >
                        {updateProfileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save Location
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditingLocation(true)} className="gap-1.5 rounded-[18px]">
                      <Edit3 className="w-3.5 h-3.5" /> Edit Location
                    </Button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Live Geolocation Button */}
                  <div className="p-4 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-foreground">Live GPS Location</p>
                      <p className="text-xs text-muted-foreground">
                        {locForm.latitude && locForm.longitude
                          ? `Coordinates: ${locForm.latitude.toFixed(5)}, ${locForm.longitude.toFixed(5)}`
                          : "No GPS coordinates set yet"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleUseMyLocation}
                      disabled={geoLoading}
                      className="gap-1.5 rounded-[14px] text-xs border-primary/30 text-primary hover:bg-primary hover:text-white"
                    >
                      {geoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5" />}
                      Use My Live Location
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Street / Flat / Building Name</Label>
                    {editingLocation ? (
                      <Input
                        value={locForm.street}
                        onChange={e => setLocForm(p => ({ ...p, street: e.target.value }))}
                        className="h-11 rounded-[14px]"
                        placeholder="e.g. Shop 12, Main Market, MG Road"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.street || "—"}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Area / Locality</Label>
                    {editingLocation ? (
                      <Input
                        value={locForm.area}
                        onChange={e => setLocForm(p => ({ ...p, area: e.target.value }))}
                        className="h-11 rounded-[14px]"
                        placeholder="e.g. Ward 24, Sahid Nagar"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.area || "—"}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">City</Label>
                      {editingLocation ? (
                        <Input
                          value={locForm.city}
                          onChange={e => setLocForm(p => ({ ...p, city: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="Bhubaneswar"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.city || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">State</Label>
                      {editingLocation ? (
                        <select
                          value={locForm.state}
                          onChange={e => setLocForm(p => ({ ...p, state: e.target.value }))}
                          className="w-full h-11 rounded-[14px] border border-input bg-background px-3 text-sm"
                        >
                          <option value="">Select State</option>
                          {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.state || "—"}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">PIN Code</Label>
                      {editingLocation ? (
                        <Input
                          value={locForm.pincode}
                          onChange={e => setLocForm(p => ({ ...p, pincode: e.target.value }))}
                          className="h-11 rounded-[14px]"
                          placeholder="751003"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.pincode || "—"}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Landmark (Optional)</Label>
                    {editingLocation ? (
                      <Input
                        value={locForm.landmark}
                        onChange={e => setLocForm(p => ({ ...p, landmark: e.target.value }))}
                        className="h-11 rounded-[14px]"
                        placeholder="e.g. Near City Hospital"
                      />
                    ) : (
                      <p className="text-sm font-semibold text-foreground py-2 border-b border-border">{profile.landmark || "None"}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Section 4: Notification Preferences */}
            {activeSection === "notifications" && (
              <div>
                <div className="mb-6 border-b border-border pb-4">
                  <h2 className="text-lg font-bold text-foreground">Notification Preferences</h2>
                  <p className="text-xs text-muted-foreground">Control how and when you receive real-time operational alerts</p>
                </div>
                <div className="space-y-4">
                  {[
                    { key: "order_alerts", label: "New Order Alerts", desc: "Get instant notifications when customers place medicine orders" },
                    { key: "reservation_alerts", label: "Reservation Requests", desc: "Notifications when patients reserve stock for pickup" },
                    { key: "low_stock_alerts", label: "Low Inventory Stock Warnings", desc: "Alerts when inventory quantity drops below threshold" },
                    { key: "ai_demand_forecast", label: "AI Demand Insights", desc: "Weekly AI predictions on upcoming medicine demand surges" },
                    { key: "promotions", label: "System Announcements", desc: "Updates on Semenq platform features and guidelines" },
                  ].map(pref => (
                    <div key={pref.key} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-bold text-foreground">{pref.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                      </div>
                      <button
                        onClick={() => {
                          setNotifPrefs(p => ({ ...p, [pref.key]: !p[pref.key as keyof typeof p] }));
                          toast.success("Notification preference updated");
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

            {/* Section 5: Security & Sessions */}
            {activeSection === "security" && (
              <div>
                <div className="mb-6 border-b border-border pb-4">
                  <h2 className="text-lg font-bold text-foreground">Security & Account Sessions</h2>
                  <p className="text-xs text-muted-foreground">Manage your credentials, multi-factor authentication, and connected devices</p>
                </div>
                <div className="space-y-3">
                  {[
                    { label: "Change Password", desc: "Update your account sign-in password", action: () => setSecurityDialog("password") },
                    { label: "Two-Factor Authentication (2FA)", desc: "Add extra security with Email ID OTP verification", action: () => setSecurityDialog("twoFactor") },
                    { label: "Active Sessions & Devices", desc: "View connected browsers and revoke active sessions", action: () => setSessionsOpen(true) },
                    { label: "Delete Pharmacy Account", desc: "Permanently delete your pharmacy store account and data", danger: true, action: () => setSecurityDialog("delete") },
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
                        <p className={`text-sm font-bold ${(item as any).danger ? "text-destructive" : "text-foreground"}`}>
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

      {/* Active Sessions Modal */}
      <Dialog open={sessionsOpen} onOpenChange={setSessionsOpen}>
        <DialogContent className="rounded-[20px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Active Devices & Sessions</DialogTitle>
            <DialogDescription>Review browsers and devices logged in to your pharmacy account.</DialogDescription>
          </DialogHeader>

          {sessionsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" /> Loading sessions...
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
                    <p className="text-sm font-semibold text-foreground">{session.deviceName || "Browser Session"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {session.deviceOs || session.operatingSystem || "Web client"}
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

      {/* Change Password Modal */}
      <Dialog open={securityDialog === "password"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Account Password</DialogTitle>
            <DialogDescription>Enter your current password and choose a new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Current Password</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                className="h-10 rounded-[12px]"
                placeholder="••••••••"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">New Password</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="h-10 rounded-[12px]"
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="h-10 rounded-[12px]"
                placeholder="Confirm password"
              />
            </div>
            <div className="flex gap-2 pt-3">
              <Button onClick={handleChangePassword} className="w-full rounded-[14px]" disabled={securityLoading}>
                {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Update Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 2FA Modal */}
      <Dialog open={securityDialog === "twoFactor"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Email Two-Factor Authentication</DialogTitle>
            <DialogDescription>Enhance your pharmacy account security using your registered Email ID.</DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Registered Email ID</p>
                <p className="text-sm font-bold text-foreground truncate">{profile.email || user?.email || "No email linked"}</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${profile.twoFactorEnabled || (user as any)?.twoFactorEnabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                {profile.twoFactorEnabled || (user as any)?.twoFactorEnabled ? "Active" : "Disabled"}
              </span>
            </div>

            {profile.twoFactorEnabled || (user as any)?.twoFactorEnabled ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Email Two-Factor Authentication is currently <strong className="text-success">active</strong>. Every sign-in request will require a 6-digit OTP sent to your Email ID.
                </p>
                <Button
                  variant="outline"
                  onClick={async () => {
                    setTwoFactorOtpLoading(true);
                    try {
                      await apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify({ two_factor_enabled: false }) });
                      queryClient.invalidateQueries({ queryKey: ["pharmacy-profile"] });
                      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                      toast.success("Email Two-Factor Authentication disabled.");
                      closeSecurityDialog();
                    } catch {
                      toast.error("Could not update 2FA status.");
                    } finally {
                      setTwoFactorOtpLoading(false);
                    }
                  }}
                  disabled={twoFactorOtpLoading}
                  className="w-full rounded-[14px] text-destructive hover:text-destructive border-destructive/30"
                >
                  {twoFactorOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Disable Email 2FA"}
                </Button>
              </div>
            ) : !twoFactorOtpSent ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground text-center">
                  Click below to receive a 6-digit verification OTP on <strong>{profile.email || user?.email}</strong> to verify and enable 2FA.
                </p>
                <Button
                  onClick={async () => {
                    setTwoFactorOtpLoading(true);
                    try {
                      await apiFetch("/api/auth/request-otp", {
                        method: "POST",
                        body: JSON.stringify({
                          email: profile.email || user?.email,
                          purpose: "email_2fa",
                          role: "pharmacy"
                        })
                      });
                      setTwoFactorOtpSent(true);
                      toast.success(`6-digit OTP code sent to ${profile.email || user?.email}`);
                    } catch {
                      toast.error("Failed to send OTP code. Try again.");
                    } finally {
                      setTwoFactorOtpLoading(false);
                    }
                  }}
                  disabled={twoFactorOtpLoading}
                  className="w-full rounded-[14px]"
                >
                  {twoFactorOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send 6-Digit OTP Code to Email"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Enter 6-Digit Verification Code</Label>
                  <Input
                    maxLength={6}
                    value={twoFactorOtpInput}
                    onChange={e => setTwoFactorOtpInput(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="h-11 rounded-[14px] text-center font-mono text-lg tracking-widest"
                  />
                </div>
                <Button
                  onClick={async () => {
                    if (twoFactorOtpInput.length !== 6) {
                      toast.error("Please enter the full 6-digit code.");
                      return;
                    }
                    setTwoFactorOtpLoading(true);
                    try {
                      await apiFetch("/api/auth/verify-otp", {
                        method: "POST",
                        body: JSON.stringify({
                          email: profile.email || user?.email,
                          otp: twoFactorOtpInput,
                          purpose: "email_2fa",
                          role: "pharmacy"
                        }),
                      });
                      await apiFetch("/api/users/me", { method: "PATCH", body: JSON.stringify({ two_factor_enabled: true }) });
                      queryClient.invalidateQueries({ queryKey: ["pharmacy-profile"] });
                      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
                      toast.success("Email Two-Factor Authentication enabled successfully!");
                      closeSecurityDialog();
                    } catch {
                      toast.error("Could not enable 2FA.");
                    } finally {
                      setTwoFactorOtpLoading(false);
                    }
                  }}
                  disabled={twoFactorOtpLoading || twoFactorOtpInput.length !== 6}
                  className="w-full rounded-[14px]"
                >
                  {twoFactorOtpLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify OTP & Enable Email 2FA"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Modal */}
      <Dialog open={securityDialog === "delete"} onOpenChange={open => !open && closeSecurityDialog()}>
        <DialogContent className="rounded-[20px] sm:max-w-md border-destructive/30">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Pharmacy Account</DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone. All your store inventory, orders, and records will be deleted.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Type DELETE to confirm</Label>
              <Input
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                className="h-10 rounded-[12px]"
                placeholder="DELETE"
              />
            </div>
            {user?.providerData.some(provider => provider.providerId === "password") && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Current Password</Label>
                <Input
                  type="password"
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="h-10 rounded-[12px]"
                  placeholder="Enter current password"
                />
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button variant="ghost" onClick={closeSecurityDialog} className="w-full rounded-[14px]">
                Cancel
              </Button>
              <Button variant="destructive" onClick={deleteAccount} disabled={deleteConfirmation !== "DELETE" || securityLoading} className="w-full rounded-[14px]">
                {securityLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Account"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PharmacyLayout>
  );
}
