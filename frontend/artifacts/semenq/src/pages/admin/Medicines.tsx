import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Pill, Plus, Edit3, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { useListMedicines } from "@workspace/api-client-react";
import { toast } from "sonner";
import { medicines } from "@/lib/mockData";

export default function AdminMedicines() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { data } = useListMedicines();
  const list = (Array.isArray(data) ? data : medicines) as typeof medicines;

  const categories = ["all", ...Array.from(new Set(list.map(m => m.category)))];
  const filtered = list.filter(m => {
    const match = m.name.toLowerCase().includes(query.toLowerCase()) || m.genericName.toLowerCase().includes(query.toLowerCase());
    return match && (category === "all" || m.category === category);
  });

  return (
    <AdminLayout>
      <TopBar title="Medicine Catalog" />

      <div className="p-6 max-w-6xl space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {[["Total Medicines", list.length], ["Requires Prescription", list.filter(m => m.requiresPrescription).length], ["OTC Medicines", list.filter(m => !m.requiresPrescription).length], ["Categories", new Set(list.map(m => m.category)).size]].map(([label, count]) => (
            <div key={label} className="bg-card border border-card-border rounded-[20px] p-4">
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search medicine or generic name..." className="pl-10 h-10 rounded-[16px]" />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} className="h-10 rounded-[16px] border border-input bg-background px-3 text-sm">
            {categories.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>)}
          </select>
          <Button onClick={() => toast.info("Add medicine — coming soon")} className="h-10 rounded-[16px] gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Medicine
          </Button>
        </div>

        <div className="bg-card border border-card-border rounded-[24px] overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border bg-muted/30">
            <span>Medicine</span>
            <span>Category</span>
            <span>Price / MRP</span>
            <span>Rx Required</span>
            <span></span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((m, i) => (
              <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="grid grid-cols-[2fr_1fr_1fr_1fr_80px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Pill className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.genericName} · {m.manufacturer}</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-foreground bg-muted px-2.5 py-1 rounded-full w-fit">{m.category}</span>
                <div>
                  <p className="text-sm font-semibold text-foreground">₹{m.price}</p>
                  <p className="text-xs text-muted-foreground line-through">₹{m.mrp}</p>
                </div>
                <div>
                  {m.requiresPrescription ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-ai bg-ai/10 px-2 py-0.5 rounded-full w-fit"><Shield className="w-3 h-3" /> Yes</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">OTC</span>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => toast.info("Edit medicine")}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
