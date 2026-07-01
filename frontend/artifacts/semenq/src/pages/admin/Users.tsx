import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Users, CheckCircle2, Shield, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const mockUsers = [
  { id: 1, name: "Arjun Mehta", email: "arjun.mehta@gmail.com", phone: "+91 98765 43210", role: "patient", city: "Mumbai", state: "Maharashtra", isVerified: true, createdAt: "2024-03-15T10:00:00Z", orders: 14 },
  { id: 2, name: "Sunita Sharma", email: "sunita@apollopharmacy.in", phone: "+91 87654 32109", role: "pharmacy", city: "Mumbai", state: "Maharashtra", isVerified: true, createdAt: "2023-11-20T10:00:00Z", orders: 0 },
  { id: 3, name: "Rajan Mehta", email: "rajan.mehta@yahoo.com", phone: "+91 76543 21098", role: "patient", city: "Pune", state: "Maharashtra", isVerified: true, createdAt: "2024-05-10T10:00:00Z", orders: 8 },
  { id: 4, name: "Karthik Reddy", email: "karthik@netmeds.com", phone: "+91 65432 10987", role: "pharmacy", city: "Bengaluru", state: "Karnataka", isVerified: true, createdAt: "2024-01-08T10:00:00Z", orders: 0 },
  { id: 5, name: "Priya Nair", email: "priya.nair@hotmail.com", phone: "+91 54321 09876", role: "patient", city: "Thiruvananthapuram", state: "Kerala", isVerified: false, createdAt: "2025-06-20T10:00:00Z", orders: 2 },
  { id: 6, name: "Dr. Vikram Bose", email: "vikram.bose@apollo.com", phone: "+91 43210 98765", role: "patient", city: "Kolkata", state: "West Bengal", isVerified: true, createdAt: "2024-09-12T10:00:00Z", orders: 31 },
];

const roleColors: Record<string, string> = {
  patient: "bg-primary/10 text-primary",
  pharmacy: "bg-ai/10 text-ai",
  admin: "bg-warning/10 text-warning",
};

export default function AdminUsers() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = mockUsers.filter(u => {
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
            ["Total Users", mockUsers.length, "bg-primary/10 text-primary"],
            ["Patients", mockUsers.filter(u => u.role === "patient").length, "bg-success/10 text-success"],
            ["Pharmacies", mockUsers.filter(u => u.role === "pharmacy").length, "bg-ai/10 text-ai"],
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

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
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
                {!user.isVerified && (
                  <Button size="sm" className="h-6 text-xs px-2 rounded-lg bg-success hover:bg-success/90 gap-1" onClick={() => toast.success(`${user.name} verified`)}>
                    <Shield className="w-3 h-3" /> Verify
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No users match your search</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
