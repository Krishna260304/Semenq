import { useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import {
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Plus,
  Camera,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StockBadge } from "@/components/StockBadge";
import { toast } from "sonner";
import { useGetMyProfile } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";

const statusIcons = { inStock: CheckCircle2, lowStock: AlertTriangle, outOfStock: XCircle };
const statusColors = { inStock: "text-success", lowStock: "text-warning", outOfStock: "text-destructive" };

type BatchForm = {
  medicineName: string;
  batch_number: string;
  expiry_date: string;
  quantity: string;
  mrp: string;
  unit_price: string;
  purchase_price: string;
  supplier_name: string;
};

type RankedMedicineCandidate = {
  medicine: any;
  score: number;
};

const emptyBatchForm: BatchForm = {
  medicineName: "",
  batch_number: "",
  expiry_date: "",
  quantity: "",
  mrp: "",
  unit_price: "",
  purchase_price: "",
  supplier_name: "",
};

async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

function normalizeMedicineText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(?<=\d)(?=[a-z])/g, " ")
    .replace(/(?<=[a-z])(?=\d)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(tablet|tablets|tab|tabs|capsule|capsules|cap|caps|strip|pack|bottle|blister|ip|usp|bp|ltd|limited|pvt|private|co|company|inc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreMedicineCandidate(query: string, medicine: any): number {
  const queryNorm = normalizeMedicineText(query);
  if (!queryNorm) return 0;

  const fields = [
    medicine?.name,
    medicine?.generic_name,
    medicine?.composition,
    medicine?.brand_name,
    medicine?.manufacturer,
  ]
    .filter(Boolean)
    .map((value: string) => normalizeMedicineText(value))
    .filter(Boolean);

  if (fields.length === 0) return 0;
  if (fields.some(field => field === queryNorm)) return 1;

  const queryTokens = new Set(queryNorm.split(" "));
  let best = 0;

  for (const field of fields) {
    const fieldTokens = new Set(field.split(" "));
    const shared = [...queryTokens].filter(token => fieldTokens.has(token));
    const precision = shared.length / Math.max(queryTokens.size, 1);
    const recall = shared.length / Math.max(fieldTokens.size, 1);
    const overlap = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    const ratio = queryNorm.length && field.length
      ? Math.max(
          queryNorm.includes(field) || field.includes(queryNorm) ? 0.9 : 0,
          overlap,
        )
      : overlap;
    best = Math.max(best, ratio);
  }

  return best;
}

export default function Inventory() {
  const { data: profile } = useGetMyProfile();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [batchForm, setBatchForm] = useState<BatchForm>(emptyBatchForm);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["pharmacy-inventory"],
    queryFn: async () => {
      const token = await getAuthToken();
      const response = await fetch("/api/pharmacies/me/inventory", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || "Unable to load inventory.");
      }
      return result;
    },
  });

  const inventory = (((data as any)?.data || []) as any[]).map(item => ({
    ...item,
    medicineName: item.medicineName || item.medicine_name || "Unknown medicine",
    genericName: item.genericName || item.medicine_generic_name || "",
    batchNumber: item.batchNumber || item.batch_number || "",
    quantity: item.quantity ?? item.available_quantity ?? 0,
    reorderLevel: item.reorderLevel ?? item.reorder_level ?? 0,
    price: item.price ?? item.unit_price ?? 0,
    mrp: item.mrp ?? 0,
    expiryDate: item.expiryDate || item.expiry_date || "N/A",
    stockStatus:
      item.stockStatus ||
      (item.available_quantity > 0
        ? item.available_quantity <= item.reorder_level
          ? "lowStock"
          : "inStock"
        : "outOfStock"),
  }));

  const filtered = inventory.filter(item => {
    const matchSearch =
      item.medicineName.toLowerCase().includes(query.toLowerCase()) ||
      item.genericName.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "all" || item.stockStatus === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: inventory.length,
    inStock: inventory.filter(i => i.stockStatus === "inStock").length,
    lowStock: inventory.filter(i => i.stockStatus === "lowStock").length,
    outOfStock: inventory.filter(i => i.stockStatus === "outOfStock").length,
  };

  const resetBatchForm = () => setBatchForm(emptyBatchForm);

  const resolveMedicine = async (medicineName: string) => {
    const search = medicineName.trim();
    if (!search) return null;

    const token = await getAuthToken();
    const response = await fetch(`/api/medicines?query=${encodeURIComponent(search)}&page_size=10`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(result?.message || "Unable to search the medicine database.");
    }

    const medicines = Array.isArray(result?.data) ? result.data : [];
    if (medicines.length === 0) return null;

    const ranked: RankedMedicineCandidate[] = medicines
      .map((medicine: any) => ({
        medicine,
        score: scoreMedicineCandidate(search, medicine),
      }))
      .sort((left: RankedMedicineCandidate, right: RankedMedicineCandidate) => right.score - left.score);

    const exactMatch = ranked.find((item: RankedMedicineCandidate) => item.score >= 0.98);
    const bestMatch = exactMatch || ranked[0];
    if (!bestMatch || bestMatch.score < 0.35) {
      return null;
    }

    return bestMatch.medicine;
  };

  const applyScannedImage = async (file: File) => {
    setOcrScanning(true);
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/inventory/scan-medicine", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || "OCR scan failed.");
      }

      const scan = result?.data || {};
      const bestMatch = scan.best_match || scan.suggestions?.[0];
      const suggestedName =
        bestMatch?.name ||
        scan.queries?.[0] ||
        scan.raw_text?.split(/\r?\n/).find((line: string) => line.trim()) ||
        "";

      if (!suggestedName) {
        throw new Error("OCR could not detect a medicine name.");
      }

      setBatchForm(previous => ({ ...previous, medicineName: suggestedName.trim() }));
      toast.success(bestMatch?.name ? `Matched ${bestMatch.name}` : "Medicine name extracted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not scan the image.");
    } finally {
      setOcrScanning(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleCameraClick = () => {
    fileInputRef.current?.click();
  };

  const handleCameraChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await applyScannedImage(file);
    }
  };

  const saveBatch = async (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (!batchForm.medicineName || !batchForm.batch_number || !batchForm.expiry_date) {
      toast.error("Type a medicine name and complete the batch details.");
      return;
    }

    setBatchSaving(true);
    try {
      const medicine = await resolveMedicine(batchForm.medicineName);
      if (!medicine) {
        throw new Error("No medicine in the database matched that name. Try a clearer name or scan a label.");
      }

      const token = await getAuthToken();
      const response = await fetch(`/api/inventory/${medicine.id}/batches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          batch_number: batchForm.batch_number,
          expiry_date: `${batchForm.expiry_date}T00:00:00Z`,
          quantity: Number(batchForm.quantity),
          mrp: Number(batchForm.mrp),
          unit_price: Number(batchForm.unit_price),
          purchase_price: Number(batchForm.purchase_price),
          supplier_name: batchForm.supplier_name || undefined,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.message || "Could not add inventory batch.");
      }

      setBatchOpen(false);
      resetBatchForm();
      toast.success("Inventory batch added.");
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add inventory batch.");
    } finally {
      setBatchSaving(false);
    }
  };

  return (
    <PharmacyLayout>
      <TopBar
        title="Inventory Management"
        userName={(profile as any)?.pharmacyName || (profile as any)?.name || "Pharmacy"}
      />

      <div className="p-6 max-w-6xl space-y-4">
        <div className="flex gap-3 flex-wrap">
          {[
            { key: "all", label: "All", count: counts.all, color: "bg-muted text-foreground" },
            { key: "inStock", label: "In Stock", count: counts.inStock, color: "bg-success/10 text-success" },
            { key: "lowStock", label: "Low Stock", count: counts.lowStock, color: "bg-warning/10 text-warning" },
            { key: "outOfStock", label: "Out of Stock", count: counts.outOfStock, color: "bg-destructive/10 text-destructive" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                filter === tab.key
                  ? `${tab.color} border-current/20`
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label} <span className="ml-1.5 font-bold">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search medicine name or generic..."
              className="pl-10 h-10 rounded-[16px]"
            />
          </div>
          <Button onClick={() => setBatchOpen(true)} className="h-10 rounded-[16px] gap-2 shrink-0">
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
            <span />
          </div>

          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading inventory...</div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((item, i) => {
                const Icon = statusIcons[item.stockStatus as keyof typeof statusIcons];
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_80px] gap-4 px-5 py-4 items-center hover:bg-muted/20 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.medicineName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.genericName || "Generic not listed"} - Batch: {item.batchNumber || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.quantity}</p>
                      <p className="text-xs text-muted-foreground">Reorder @ {item.reorderLevel}</p>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Rs. {item.price}</p>
                      <p className="text-xs text-muted-foreground line-through">Rs. {item.mrp}</p>
                    </div>
                    <p className="text-sm text-foreground">{item.expiryDate}</p>
                    <div className="flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${statusColors[item.stockStatus as keyof typeof statusColors]}`} />
                      <StockBadge status={item.stockStatus} quantity={item.quantity || undefined} />
                    </div>
                    <span className="text-xs text-muted-foreground">Manage batches</span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={batchOpen} onOpenChange={open => {
        setBatchOpen(open);
        if (!open) {
          resetBatchForm();
        }
      }}>
        <DialogContent className="rounded-[20px] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Inventory Batch</DialogTitle>
            <DialogDescription>Type the medicine name or scan the label to fill it automatically.</DialogDescription>
          </DialogHeader>

          <form onSubmit={saveBatch} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="medicine-name">Medicine</Label>
                <div className="flex gap-2">
                  <Input
                    id="medicine-name"
                    value={batchForm.medicineName}
                    onChange={event => setBatchForm(previous => ({ ...previous, medicineName: event.target.value }))}
                    placeholder="Type the medicine name"
                    className="h-10 rounded-[12px]"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-[12px] px-3 shrink-0"
                    onClick={handleCameraClick}
                    disabled={ocrScanning}
                    title="Scan medicine label"
                  >
                    {ocrScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCameraChange}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Scan a package label or type manually. We will match it against the medicine database when you save.
                </p>
              </div>

              {[
                ["batch_number", "Batch number"],
                ["expiry_date", "Expiry date"],
                ["quantity", "Quantity"],
                ["mrp", "MRP"],
                ["unit_price", "Selling price"],
                ["purchase_price", "Purchase price"],
                ["supplier_name", "Supplier"],
              ].map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label>{label}</Label>
                  <Input
                    type={key === "expiry_date" ? "date" : key === "quantity" || key.includes("price") ? "number" : "text"}
                    value={(batchForm as any)[key]}
                    onChange={event => setBatchForm(previous => ({ ...previous, [key]: event.target.value }))}
                  />
                </div>
              ))}
            </div>

            <Button type="submit" className="w-full rounded-[16px]" disabled={batchSaving}>
              {batchSaving ? "Saving..." : "Add batch"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </PharmacyLayout>
  );
}
