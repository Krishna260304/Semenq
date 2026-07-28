import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Users, CheckCircle2, Shield, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";

const roleColors: Record<string, string> = {
  patient: "bg-primary/10 text-primary",
  pharmacy: "bg-ai/10 text-ai",
  admin: "bg-warning/10 text-warning",
};

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/users/admin-list", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Unable to load users.");
      return response.json();
    },
  });
  const users = ((data as any)?.data || []) as any[];

  const filtered = users.filter(u => {
    const match = u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase());
    const roleMatch = filter === "all" || u.role === filter;
    return match && roleMatch;
  });

  return (
    <AdminLayout>
      <TopBar title="User Management" />

      <div className="p-6 max-w-6xl space-y-5">
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Total Users", users.length, "bg-primary/10 text-primary"],
            ["Patients", users.filter(u => u.role === "patient").length, "bg-success/10 text-success"],
            ["Pharmacies", users.filter(u => u.role === "pharmacy").length, "bg-ai/10 text-ai"],
          ].map(([label, count, color]) => (
            <div key={label as string} className="bg-card border border-card-border rounded-[20px] p-5 flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email..." className="pl-10 h-10 rounded-[16px]" />
          </div>
          <div className="flex gap-1 p-1 bg-muted rounded-xl">
            {["all", "patient", "pharmacy"].map(r => (
              <button key={r} onClick={() => setFilter(r)} className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${filter === r ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {r === "all" ? "All" : r}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? <div className="py-16 text-center text-muted-foreground">Loading users…</div> : <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((user, i) => (
            <motion.div key={user.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-card-border rounded-[20px] p-5 card-lift">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-bold text-primary text-lg">{user.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-foreground text-sm truncate">{user.name}</p>
                    {user.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{user.email}</p>
                </div>
              </div>

              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3 h-3 shrink-0" />
                  <span>{user.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span>{user.city}, {user.state}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${roleColors[user.role]}`}>{user.role}</span>
                {user.role === "patient" && <span className="text-xs text-muted-foreground">{user.orders} orders</span>}
                {!user.isVerified && <span className="text-xs text-warning">Verification pending</span>}
              </div>
            </motion.div>
          ))}
        </div>}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No live users returned by the backend yet</p>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
