import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth } from "@/lib/firebase";
import { Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

async function api(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) throw new Error(payload?.message || "Request failed.");
  return payload.data;
}

export default function AdminProfile() {
  const client = useQueryClient();
  const { data: profile, isLoading } = useQuery({ queryKey: ["admin-profile"], queryFn: () => api("/api/users/me") });
  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (profile) setForm({ name: profile.name || "", phone: profile.phone || "" });
  }, [profile]);

  const save = useMutation({
    mutationFn: () => api("/api/users/me", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["admin-profile"] });
      toast.success("Profile updated.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update profile."),
  });

  return (
    <AdminLayout>
      <TopBar title="Admin Profile" subtitle="Manage your account details" />
      <div className="p-6 max-w-2xl space-y-6">
        <section className="bg-card border border-card-border rounded-[24px] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center"><UserRound className="w-5 h-5 text-primary" /></div>
            <div><h2 className="font-semibold">Account information</h2><p className="text-sm text-muted-foreground">These details are used across the admin portal.</p></div>
          </div>
          {isLoading ? <p className="text-sm text-muted-foreground">Loading profile…</p> : <div className="space-y-4">
            <div><Label htmlFor="admin-name">Full name</Label><Input id="admin-name" className="mt-1.5" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div><Label>Email</Label><Input className="mt-1.5" value={profile?.email || ""} disabled /></div>
            <div><Label htmlFor="admin-phone">Phone</Label><Input id="admin-phone" className="mt-1.5" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
            <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name.trim()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
          </div>}
        </section>
        <section className="bg-card border border-card-border rounded-[24px] p-6 flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary mt-0.5" />
          <div><h2 className="font-semibold">Access level</h2><p className="text-sm text-muted-foreground mt-1">{profile?.role === "super_admin" ? "Super administrator" : "Administrator"}. Administrative permissions are controlled by the backend.</p></div>
        </section>
      </div>
    </AdminLayout>
  );
}
