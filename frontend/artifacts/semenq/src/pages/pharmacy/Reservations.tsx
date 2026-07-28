import { useState } from "react";
import { motion } from "framer-motion";
import { PharmacyLayout } from "@/layouts/PharmacyLayout";
import { TopBar } from "@/components/TopBar";
import { CheckCircle2, XCircle, Clock, Truck, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useUpdateReservation } from "@workspace/api-client-react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { QRCode } from "@/components/QRCode";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/20",
  confirmed: "bg-primary/10 text-primary border-primary/20",
  ready: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  expired: "bg-muted text-muted-foreground border-border",
};

const tabs = ["All", "Pending", "Confirmed", "Ready", "Cancelled"];

export default function PharmacyReservations() {
  const [activeTab, setActiveTab] = useState("All");
  const [showQR, setShowQR] = useState<number | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["pharmacy-reservations"],
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/reservations/pharmacy", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Unable to load reservations.");
      return response.json();
    },
  });
  const reservations = (((data as any)?.data || []) as any[]).map(item => ({
    ...item,
    medicineName: item.medicineName || item.medicine_name || "Reservation",
    quantity: item.quantity ?? item.medicine_count ?? 0,
    totalAmount: item.totalAmount ?? item.grand_total ?? 0,
    deliveryType: item.deliveryType || item.pickup_method || "pickup",
    expiresAt: item.expiresAt || item.expires_at,
    prescriptionId: item.prescriptionId || item.prescription_id,
  }));
  const updateReservation = useUpdateReservation();

  const handleAction = async (id: number, status: "confirmed" | "cancelled" | "ready") => {
    try {
      await updateReservation.mutateAsync({ id, data: { status } });
      await refetch();
      toast.success(`Reservation ${status === "confirmed" ? "approved" : status === "ready" ? "marked ready" : "rejected"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update reservation.");
    }
  };

  const filtered = reservations.filter(r =>
    activeTab === "All" || r.status.toLowerCase() === activeTab.toLowerCase()
  );

  const pendingCount = reservations.filter(r => r.status === "pending").length;

  return (
    <PharmacyLayout>
      <TopBar title="Reservations" subtitle={pendingCount > 0 ? `${pendingCount} pending approval` : undefined} userName="Pharmacy" />

      <div className="p-6 max-w-4xl space-y-4">
        <div className="flex gap-2 p-1 bg-muted rounded-xl w-fit">
          {tabs.map(tab => {
            const count = tab === "All" ? reservations.length : reservations.filter(r => r.status.toLowerCase() === tab.toLowerCase()).length;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === tab ? "bg-white shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {tab}
                {count > 0 && <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab ? (tab === "Pending" ? "bg-warning text-white" : "bg-primary/10 text-primary") : "bg-muted-foreground/20"}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        <div className="space-y-3">
          {filtered.map((r, i) => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="bg-card border border-card-border rounded-[24px] p-5">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${r.deliveryType === "courier" ? "bg-ai/10" : "bg-primary/10"}`}>
                  {r.deliveryType === "courier" ? <Truck className="w-5 h-5 text-ai" /> : <MapPin className="w-5 h-5 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-foreground">{r.medicineName}</p>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${statusColors[r.status] || ""} shrink-0`}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span>Qty: <span className="font-semibold text-foreground">{r.quantity}</span></span>
                    <span>·</span>
                    <span>Total: <span className="font-semibold text-foreground">₹{r.totalAmount}</span></span>
                    <span>·</span>
                    <span className="capitalize">{r.deliveryType}</span>
                    {r.prescriptionId && <><span>·</span><span className="text-ai font-medium">Rx #{r.prescriptionId}</span></>}
                  </div>
                  {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {r.status === "cancelled" || r.status === "expired"
                      ? "Expired"
                      : `Expires ${new Date(r.expiresAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                {r.status === "pending" && (
                  <>
                    <Button size="sm" className="flex-1 h-8 text-xs rounded-[14px] gap-1 bg-success hover:bg-success/90" onClick={() => handleAction(r.id, "confirmed")}>
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs rounded-[14px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={() => handleAction(r.id, "cancelled")}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </Button>
                  </>
                )}
                {r.status === "confirmed" && (
                  <Button size="sm" className="h-8 text-xs rounded-[14px] gap-1 bg-success hover:bg-success/90" onClick={() => handleAction(r.id, "ready")}>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark Ready for Pickup
                  </Button>
                )}
                {r.qrCode && (r.status === "confirmed" || r.status === "ready") && (
                  <Button size="sm" variant="outline" className="h-8 text-xs rounded-[14px] gap-1 ml-auto" onClick={() => setShowQR(showQR === r.id ? null : r.id)}>
                    <QrCode className="w-3.5 h-3.5" /> {showQR === r.id ? "Hide QR" : "Scan QR"}
                  </Button>
                )}
              </div>

              {showQR === r.id && r.qrCode && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 pt-4 border-t border-border flex flex-col items-center gap-2">
                  <p className="text-xs text-muted-foreground font-medium">Scan to verify pickup</p>
                  <div className="p-3 bg-white rounded-xl border border-muted shadow-sm">
                    <QRCode value={r.qrCode} size={120} />
                  </div>
                  <p className="text-xs font-mono text-muted-foreground/60">{r.qrCode}</p>
                </motion.div>
              )}
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <MapPin className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {activeTab.toLowerCase()} reservations</p>
            </div>
          )}
        </div>
      </div>
    </PharmacyLayout>
  );
}
