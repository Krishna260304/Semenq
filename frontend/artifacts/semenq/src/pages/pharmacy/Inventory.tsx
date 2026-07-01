import { useState } from "react";
import { motion } from "framer-motion";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Filter, AlertTriangle, CheckCircle2, XCircle, Edit3, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetPharmacyInventory } from "@workspace/api-client-react";
import { StockBadge } from "@/components/StockBadge";
import { toast } from "sonner";
import { samplePharmacyUser } from "@/lib/mockData";

const mockInventory = [
  { id: 1, medicineId: 1, medicineName: "Amoxicillin 500mg", genericName: "Amoxicillin", quantity: 48, price: 98.5, mrp: 120, expiryDate: "2027-06-30", batchNumber: "BT2024A112", stockStatus: "inStock" as const, reorderLevel: 20, lastRestocked: "2026-06-15T10:00:00Z" },
  { id: 2, medicineId: 2, medicineName: "Paracetamol 650mg", genericName: "Paracetamol", quantity: 9, price: 24, mrp: 30, expiryDate: "2026-12-31", batchNumber: "BT2026P234", stockStatus: "lowStock" as const, reorderLevel: 30, lastRestocked: "2026-05-20T10:00:00Z" },
  { id: 3, medicineId: 3, medicineName: "Metformin 500mg", genericName: "Metformin HCl", quantity: 62, price: 42, mrp: 55, expiryDate: "2027-03-31", batchNumber: "BT2025M567", stockStatus: "inStock" as const, reorderLevel: 20, lastRestocked: "2026-06-01T10:00:00Z" },
  { id: 4, medicineId: 4, medicineName: "Atorvastatin 20mg", genericName: "Atorvastatin", quantity: 0, price: 85, mrp: 110, expiryDate: "2027-01-31", batchNumber: "BT2025A890", stockStatus: "outOfStock" as const, reorderLevel: 15, lastRestocked: "2026-04-10T10:00:00Z" },
  { id: 5, medicineId: 5, medicineName: "Pantoprazole 40mg", genericName: "Pantoprazole", quantity: 124, price: 62.5, mrp: 80, expiryDate: "2027-09-30", batchNumber: "BT2026P123", stockStatus: "inStock" as const, reorderLevel: 25, lastRestocked: "2026-06-18T10:00:00Z" },
  { id: 6, medicineId: 6, medicineName: "Azithromycin 500mg", genericName: "Azithromycin", quantity: 7, price: 68, mrp: 85, expiryDate: "2026-11-30", batchNumber: "BT2026AZ45", stockStatus: "lowStock" as const, reorderLevel: 15, lastRestocked: "2026-05-28T10:00:00Z" },
  { id: 7, medicineId: 7, medicineName: "Cetirizine 10mg", genericName: "Cetirizine HCl", quantity: 280, price: 18.5, mrp: 25, expiryDate: "2027-12-31", batchNumber: "BT2026C789", stockStatus: "inStock" as const, reorderLevel: 50, lastRestocked: "2026-06-20T10:00:00Z" },
  { id: 8, medicineId: 8, medicineName: "Losartan 50mg", genericName: "Losartan Potassium", quantity: 0, price: 78, mrp: 95, expiryDate: "2026-08-31", batchNumber: "BT2024L321", stockStatus: "outOfStock" as const, reorderLevel: 20, lastRestocked: "2026-03-15T10:00:00Z" },
];

const statusIcons = { inStock: CheckCircle2, lowStock: AlertTriangle, outOfStock: XCircle };
const statusColors = { inStock: "text-success", lowStock: "text-warning", outOfStock: "text-destructive" };

export default function Inventory() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, isLoading } = useGetPharmacyInventory(2);
  const inventory = (Array.isArray(data) ? data : mockInventory) as typeof mockInventory;

  const filtered = inventory.filter(item => {
    const matchSearch = item.medicineName.toLowerCase().includes(query.toLowerCase()) || item.genericName.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "all" || item.stockStatus === filter;
    return matchSearch && matchFilter;
  });

  const counts = { all: inventory.length, inStock: inventory.filter(i => i.stockStatus === "inStock").length, lowStock: inventory.filter(i => i.stockStatus === "lowStock").length, outOfStock: inventory.filter(i => i.stockStatus === "outOfStock").length };

  return (
    <PharmacyLayout>
      <TopBar title="Inventory Management" userName={samplePharmacyUser.name} />

      <div className="p-6 max-w-6xl space-y-4">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: "all", label: "All", count: counts.all, color: "bg-muted text-foreground" },
            { key: "inStock", label: "In Stock", count: counts.inStock, color: "bg-success/10 text-success" },
            { key: "lowStock", label: "Low Stock", count: counts.lowStock, color: "bg-warning/10 text-warning" },
            { key: "outOfStock", label: "Out of Stock", count: counts.outOfStock, color: "bg-destructive/10 text-destructive" },
          ].map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)} className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${filter === tab.key ? `${tab.color} border-current/20` : "bg-card border-border text-muted-foreground hover:text-foreground"}`}>
              {tab.label} <span className="ml-1.5 font-bold">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search medicine name or generic..." className="pl-10 h-10 rounded-[16px]" />
          </div>
          <Button onClick={() => toast.info("Add medicine — coming soon")} className="h-10 rounded-[16px] gap-2 shrink-0">
            <Plus className="w-4 h-4" /> Add Medicine
          </Button>
        </div>

        <div className="bg-card border border-card-border rounded-[24px] overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border bg-muted/30">
            <span>Medicine</span>
            <span>Quantity</span>
            <span>Price / MRP</span>
            <span>Expiry</span>
            <span>Status</span>
            <span></span>
          </div>
          <div className="divide-y divide-border">
            {filtered.map((item, i) => {
              const Icon = statusIcons[item.stockStatus];
              return (
                <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }} className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.medicineName}</p>
                    <p className="text-xs text-muted-foreground">{item.genericName} · Batch: {item.batchNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.quantity}</p>
                    <p className="text-xs text-muted-foreground">Reorder @ {item.reorderLevel}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">₹{item.price}</p>
                    <p className="text-xs text-muted-foreground line-through">₹{item.mrp}</p>
                  </div>
                  <p className="text-sm text-foreground">{item.expiryDate}</p>
                  <div className="flex items-center gap-1.5">
                    <Icon className={`w-3.5 h-3.5 ${statusColors[item.stockStatus]}`} />
                    <StockBadge status={item.stockStatus} quantity={item.quantity || undefined} />
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => toast.info("Edit inventory item")}>
                    <Edit3 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </PharmacyLayout>
  );
}
