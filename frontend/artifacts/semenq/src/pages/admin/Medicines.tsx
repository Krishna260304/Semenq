import { AdminLayout } from "@/layouts/AdminLayout";
import { TopBar } from "@/components/TopBar";
import { Search, Pill, Plus, Edit3, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { motion } from "framer-motion";
import { useListMedicines } from "@workspace/api-client-react";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AdminMedicines() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", generic_name: "", composition: "", manufacturer: "", category_name: "General", strength: "", dosage_form: "tablet", prescription_required: false, average_price: "" });
  const queryClient = useQueryClient();
  const { data } = useListMedicines();
  const list = (Array.isArray(data) ? data : []) as any[];

  const categories = ["all", ...Array.from(new Set(list.map(m => m.category || m.category_name || "General")))];
  const filtered = list.filter(m => {
    const name = m.name || "";
    const generic = m.genericName || m.generic_name || "";
    const itemCategory = m.category || m.category_name || "General";
    const match = name.toLowerCase().includes(query.toLowerCase()) || generic.toLowerCase().includes(query.toLowerCase());
    return match && (category === "all" || itemCategory === category);
  });

  const openNew = () => {
    setEditingId(null);
    setForm({ name: "", generic_name: "", composition: "", manufacturer: "", category_name: "General", strength: "", dosage_form: "tablet", prescription_required: false, average_price: "" });
    setEditorOpen(true);
  };

  const openEdit = (medicine: any) => {
    setEditingId(medicine.id);
    setForm({
      name: medicine.name || "",
      generic_name: medicine.genericName || medicine.generic_name || "",
      composition: medicine.composition || "",
      manufacturer: medicine.manufacturer || "",
      category_name: medicine.category || medicine.category_name || "General",
      strength: medicine.strength || "",
      dosage_form: medicine.dosage_form || "tablet",
      prescription_required: Boolean(medicine.requiresPrescription ?? medicine.prescription_required),
      average_price: String(medicine.price ?? medicine.average_price ?? ""),
    });
    setEditorOpen(true);
  };

  const saveMedicine = async () => {
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(editingId ? `/api/medicines/${editingId}` : "/api/medicines", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ ...form, average_price: form.average_price ? Number(form.average_price) : null }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Could not save medicine.");
      await queryClient.invalidateQueries();
      setEditorOpen(false);
      toast.success(editingId ? "Medicine updated." : "Medicine created.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save medicine.");
    } finally {
      setSaving(false);
    }
  };

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
          <Button onClick={openNew} className="h-10 rounded-[16px] gap-2 shrink-0">
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
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={() => openEdit(m)}>
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="rounded-[20px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
            <DialogDescription>Save this medicine to the live catalog used by search and pharmacy inventory.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {[
              ["name", "Medicine name"], ["generic_name", "Generic name"], ["composition", "Composition"], ["manufacturer", "Manufacturer"], ["category_name", "Category"], ["strength", "Strength"], ["average_price", "Average price"],
            ].map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label>{label}</Label>
                <Input value={(form as any)[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Dosage form</Label>
              <select value={form.dosage_form} onChange={event => setForm(previous => ({ ...previous, dosage_form: event.target.value }))} className="w-full h-10 rounded-[12px] border border-input bg-background px-3 text-sm">
                {['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'other'].map(value => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm mt-7">
              <input type="checkbox" checked={form.prescription_required} onChange={event => setForm(previous => ({ ...previous, prescription_required: event.target.checked }))} /> Prescription required
            </label>
          </div>
          <Button className="w-full rounded-[16px]" onClick={saveMedicine} disabled={saving}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Create medicine"}
          </Button>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
