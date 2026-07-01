import { useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { User, MapPin, CreditCard, Bell, Shield, ChevronRight, Edit3, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useGetMyProfile, useUpdateMyProfile } from "@workspace/api-client-react";
import { sampleUser } from "@/lib/mockData";

const sections = [
  { id: "personal", icon: User, label: "Personal Information" },
  { id: "addresses", icon: MapPin, label: "Addresses" },
  { id: "payment", icon: CreditCard, label: "Payment Methods" },
  { id: "notifications", icon: Bell, label: "Notifications" },
  { id: "security", icon: Shield, label: "Security" },
];

export default function Profile() {
  const [activeSection, setActiveSection] = useState("personal");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: sampleUser.name, email: sampleUser.email, phone: sampleUser.phone, city: sampleUser.city, state: sampleUser.state, pincode: sampleUser.pincode, address: sampleUser.address });
  const { data: profile } = useGetMyProfile();
  const updateMutation = useUpdateMyProfile();

  const save = () => {
    updateMutation.mutate({ data: { name: form.name, phone: form.phone, city: form.city, state: form.state, pincode: form.pincode, address: form.address } });
    setEditing(false);
    toast.success("Profile updated successfully");
  };

  return (
    <PatientLayout>
      <TopBar title="Profile Settings" userName={sampleUser.name} />

      <div className="p-6 max-w-5xl">
        <div className="grid lg:grid-cols-[260px_1fr] gap-6">
          <div className="space-y-1">
            <div className="bg-card border border-card-border rounded-[24px] p-5 text-center mb-4">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl font-bold text-primary">{sampleUser.name[0]}</span>
              </div>
              <p className="font-semibold text-foreground">{sampleUser.name}</p>
              <p className="text-sm text-muted-foreground">{sampleUser.email}</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-success/10 text-success text-xs font-medium">Verified Patient</span>
            </div>

            {sections.map(section => {
              const Icon = section.icon;
              return (
                <button key={section.id} onClick={() => setActiveSection(section.id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeSection === section.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
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
                      <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="gap-1.5"><X className="w-3.5 h-3.5" /> Cancel</Button>
                      <Button size="sm" onClick={save} className="gap-1.5 rounded-[18px]"><Save className="w-3.5 h-3.5" /> Save</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="gap-1.5 rounded-[18px]"><Edit3 className="w-3.5 h-3.5" /> Edit</Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: "Full Name", key: "name", type: "text" },
                    { label: "Email", key: "email", type: "email", disabled: true },
                    { label: "Phone", key: "phone", type: "tel" },
                    { label: "City", key: "city", type: "text" },
                    { label: "State", key: "state", type: "text" },
                    { label: "PIN Code", key: "pincode", type: "text" },
                  ].map(field => (
                    <div key={field.key} className={`space-y-1.5 ${field.key === "name" ? "col-span-2" : ""}`}>
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.label}</Label>
                      {editing && !field.disabled ? (
                        <Input type={field.type} value={form[field.key as keyof typeof form]} onChange={e => setForm(prev => ({ ...prev, [field.key]: e.target.value }))} className="h-11 rounded-[14px]" />
                      ) : (
                        <p className="text-sm font-medium text-foreground py-2.5 px-0 border-b border-border">{form[field.key as keyof typeof form] || "—"}</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-1.5 col-span-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Full Address</Label>
                  {editing ? (
                    <Input value={form.address} onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))} className="h-11 rounded-[14px]" />
                  ) : (
                    <p className="text-sm font-medium text-foreground py-2.5 border-b border-border">{form.address || "—"}</p>
                  )}
                </div>
              </div>
            )}

            {activeSection === "payment" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Payment Methods</h2>
                <div className="space-y-3">
                  {[
                    { type: "UPI", detail: "arjun.mehta@okicici", default: true },
                    { type: "Credit Card", detail: "•••• •••• •••• 4832 · HDFC Bank", default: false },
                  ].map(pm => (
                    <div key={pm.type} className="flex items-center gap-4 p-4 rounded-xl border border-border">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-foreground text-sm">{pm.type}</p>
                        <p className="text-xs text-muted-foreground">{pm.detail}</p>
                      </div>
                      {pm.default && <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">Default</span>}
                    </div>
                  ))}
                  <Button variant="outline" className="w-full rounded-[18px] h-11">Add Payment Method</Button>
                </div>
              </div>
            )}

            {activeSection === "notifications" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Notification Preferences</h2>
                <div className="space-y-4">
                  {[
                    { label: "Reservation reminders", desc: "Get notified before reservations expire", enabled: true },
                    { label: "Order updates", desc: "Track your order status in real-time", enabled: true },
                    { label: "AI medicine insights", desc: "Personalised medicine recommendations", enabled: true },
                    { label: "Low stock alerts", desc: "Know when your medicines are running low", enabled: false },
                    { label: "Promotional offers", desc: "Discounts and offers from partner pharmacies", enabled: false },
                  ].map(pref => (
                    <div key={pref.label} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{pref.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{pref.desc}</p>
                      </div>
                      <button onClick={() => toast.success("Preference updated")} className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${pref.enabled ? "bg-primary" : "bg-muted"}`}>
                        <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${pref.enabled ? "left-6" : "left-1"}`} />
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
                    { label: "Change Password", desc: "Last changed 3 months ago" },
                    { label: "Two-Factor Authentication", desc: "Add an extra layer of security via SMS OTP" },
                    { label: "Active Sessions", desc: "2 active sessions" },
                    { label: "Delete Account", desc: "Permanently delete your Semenq account", danger: true },
                  ].map(item => (
                    <button key={item.label} onClick={() => toast.info(`${item.label} — coming soon`)} className={`w-full flex items-center justify-between p-4 rounded-xl border transition-colors text-left ${(item as any).danger ? "border-destructive/20 hover:bg-destructive/5" : "border-border hover:bg-muted/40"}`}>
                      <div>
                        <p className={`text-sm font-medium ${(item as any).danger ? "text-destructive" : "text-foreground"}`}>{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeSection === "addresses" && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-6">Saved Addresses</h2>
                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-primary/30 bg-primary/5">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">Home <span className="ml-2 text-xs font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Default</span></p>
                        <p className="text-xs text-muted-foreground mt-1">402, Shree Sai Apartments, Andheri West, Mumbai - 400053, Maharashtra</p>
                      </div>
                      <button className="p-1.5 hover:bg-muted rounded-lg"><Edit3 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  </div>
                  <Button variant="outline" className="w-full rounded-[18px] h-11">Add New Address</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
