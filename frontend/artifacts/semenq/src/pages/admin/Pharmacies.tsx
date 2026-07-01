import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Building2, CheckCircle2, Clock, MapPin, Star, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { useListPharmacies } from "@workspace/api-client-react";
import { toast } from "sonner";

export default function AdminPharmacies() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { data } = useListPharmacies();
  const list = (Array.isArray(data) ? data : []) as any[];

  const filtered = list.filter(p => {
    const match = p.name.toLowerCase().includes(query.toLowerCase()) || p.city.toLowerCase().includes(query.toLowerCase());
    if (filter === "verified") return match && p.isVerified;
    if (filter === "pending") return match && !p.isVerified;
    return match;
  });

  return (
    <AdminLayout>
      <TopBar title="Pharmacy Management" />

      <div className="p-6 max-w-6xl space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[["Total Pharmacies", list.length], ["Verified", list.filter(p => p.isVerified).length], ["Pending Review", list.filter(p => !p.isVerified).length]].map(([label, count]) => (
            <div key={label} className="bg-card border border-card-border rounded-[20px] p-4">
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search pharmacy or city..." className="pl-10 h-10 rounded-[16px]" />
          </div>
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            {[["all", "All"], ["verified", "Verified"], ["pending", "Pending"]].map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${filter === val ? "bg-white shadow-sm text-foreground" : "text-muted-foreground"}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((ph, i) => (
            <motion.div key={ph.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-card border border-card-border rounded-[24px] p-5 card-lift">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground text-sm">{ph.name}</p>
                    {ph.isVerified ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Verified</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-warning bg-warning/10 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> Pending</span>
                    )}
                    {ph.offersCourier && <span className="flex items-center gap-1 text-xs font-medium text-ai bg-ai/10 px-2 py-0.5 rounded-full"><Truck className="w-3 h-3" /> Courier</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" />{ph.city}, {ph.state}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3 fill-warning text-warning" />{ph.rating}</span>
                    <span>{ph.reviewCount} reviews</span>
                    <span>{ph.totalInventory.toLocaleString()} items</span>
                  </div>
                  {!ph.isVerified && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="h-7 text-xs rounded-[12px] bg-success hover:bg-success/90" onClick={() => toast.success(`${ph.name} verified`)}>Approve</Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs rounded-[12px] text-destructive border-destructive/30" onClick={() => toast.error("Pharmacy rejected")}>Reject</Button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
