import { motion } from "framer-motion";
import { useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { FileImage, Upload, CheckCircle2, Clock, Search, Zap, Building2, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { auth } from "@/lib/firebase";
import { useGetMyProfile } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function Prescriptions() {
  const { data: profile } = useGetMyProfile();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["patient-prescriptions"],
    refetchInterval: 5000,
    queryFn: async () => {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/prescriptions", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Unable to load prescriptions.");
      return response.json();
    },
  });
  const prescriptions = ((data as any)?.data || []) as any[];
  const [selectedRx, setSelectedRx] = useState<any | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pharmacies, setPharmacies] = useState<any[]>([]);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState("");
  const [dialogLoading, setDialogLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const openPrescription = async (rx: any) => {
    setSelectedRx(rx);
    setPreviewUrl(null);
    setPharmacies([]);
    setSelectedPharmacyId(rx.pharmacy_id || "");
    setDialogLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const [imageResponse, pharmacyResponse] = await Promise.all([
        fetch(`/api/prescriptions/${rx.id}/image`, { headers }),
        fetch(`/api/prescriptions/${rx.id}/pharmacies`, { headers }),
      ]);
      if (imageResponse.ok) {
        const blob = await imageResponse.blob();
        setPreviewUrl(URL.createObjectURL(blob));
      }
      if (pharmacyResponse.ok) {
        const result = await pharmacyResponse.json();
        setPharmacies(Array.isArray(result?.data) ? result.data : []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load prescription details.");
    } finally {
      setDialogLoading(false);
    }
  };

  const sendToPharmacy = async () => {
    if (!selectedRx || !selectedPharmacyId || sending) return;
    setSending(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/prescriptions/${selectedRx.id}/request-pharmacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ pharmacy_id: selectedPharmacyId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || "Could not send prescription to pharmacy.");
      toast.success("Prescription sent for pharmacy verification.");
      setSelectedRx((previous: any) => previous ? { ...previous, pharmacy_id: selectedPharmacyId, pharmacy_status: "in_progress", pharmacy_name: pharmacies.find(item => item.id === selectedPharmacyId)?.name } : previous);
      await queryClient.invalidateQueries({ queryKey: ["patient-prescriptions"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send prescription.");
    } finally {
      setSending(false);
    }
  };

  return (
    <PatientLayout>
      <TopBar title="My Prescriptions" userName={(profile as any)?.name || "Patient"} />

      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <p className="text-muted-foreground text-sm">{prescriptions.length} prescriptions uploaded</p>
          <Link href="/patient/prescription">
            <Button className="rounded-[18px] gap-2">
              <Upload className="w-4 h-4" /> Upload New
            </Button>
          </Link>
        </div>

        {isLoading ? <SkeletonCard count={3} /> : (
          <div className="space-y-4">
            {prescriptions.map((rx, i) => (
              <motion.div key={rx.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="bg-card border border-card-border rounded-[24px] p-6 card-lift">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileImage className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">Rx from {rx.doctor_name || "Doctor not detected"}</p>
                      <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Parsed
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{rx.hospital_name || "Hospital not detected"}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rx.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-ai" />
                        <span className="text-xs text-muted-foreground">AI Confidence: <span className="font-semibold text-foreground">{Math.round((rx.overall_confidence || 0) <= 1 ? (rx.overall_confidence || 0) * 100 : rx.overall_confidence || 0)}%</span></span>
                      </div>
                      <Link href="/patient/search">
                        <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                          <Search className="w-3 h-3" /> Search all medicines
                        </button>
                      </Link>
                    </div>

                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-3">
                      {rx.pharmacy_name ? (<>
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-4 h-4 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">Verification pharmacy</p>
                            <p className="text-sm font-semibold text-foreground truncate">{rx.pharmacy_name}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                          rx.pharmacy_status === "confirmed"
                            ? "text-success bg-success/10"
                            : rx.pharmacy_status === "rejected"
                              ? "text-destructive bg-destructive/10"
                              : "text-warning bg-warning/10"
                        }`}>
                          {rx.pharmacy_status === "confirmed" ? "Confirmed" : rx.pharmacy_status === "rejected" ? "Rejected" : "In progress"}
                        </span>
                      </>) : (
                        <Button variant="outline" className="rounded-[14px] gap-2 text-xs" onClick={() => void openPrescription(rx)}>
                          <Building2 className="w-3.5 h-3.5" /> Choose pharmacy
                        </Button>
                      )}
                      {rx.pharmacy_name && <Button variant="outline" className="rounded-[14px] gap-2 text-xs" onClick={() => void openPrescription(rx)}><Building2 className="w-3.5 h-3.5" /> View prescription</Button>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            {prescriptions.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <FileImage className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-foreground mb-1">No prescriptions yet</p>
                <p className="text-sm text-muted-foreground mb-4">Upload a prescription to get started</p>
                <Link href="/patient/prescription"><Button className="rounded-[18px] gap-2"><Upload className="w-4 h-4" /> Upload Prescription</Button></Link>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedRx} onOpenChange={open => { if (!open) { setSelectedRx(null); if (previewUrl) URL.revokeObjectURL(previewUrl); setPreviewUrl(null); } }}>
        <DialogContent className="rounded-[20px] sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Prescription and pharmacy verification</DialogTitle>
            <DialogDescription>This prescription image is shared privately with the pharmacy you choose.</DialogDescription>
          </DialogHeader>
          {selectedRx && <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-[16px] bg-muted min-h-72 flex items-center justify-center overflow-hidden">
              {previewUrl ? <img src={previewUrl} alt="Prescription" className="max-h-[460px] w-full object-contain" /> : dialogLoading ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : <p className="text-sm text-muted-foreground">Prescription image unavailable.</p>}
            </div>
            <div className="space-y-3">
              <div className="rounded-[14px] border border-border p-3 text-sm">
                <p className="font-semibold">Detected medicines</p>
                <p className="text-muted-foreground mt-1">{(selectedRx.extracted_medicines || []).map((item: any) => item.medicine_name || item.raw_text).filter(Boolean).join(", ") || "See prescription image"}</p>
              </div>
              <label className="text-sm font-medium">Choose pharmacy with stock</label>
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {pharmacies.map(pharmacy => <button key={pharmacy.id} onClick={() => setSelectedPharmacyId(pharmacy.id)} className={`w-full text-left rounded-[14px] border p-3 transition-colors ${selectedPharmacyId === pharmacy.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm">{pharmacy.name}</span><span className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="w-3 h-3" />{pharmacy.distance_text}</span></div>
                  <p className="text-xs text-muted-foreground mt-1">{pharmacy.available_medicines?.join(", ")}</p>
                </button>)}
                {!dialogLoading && pharmacies.length === 0 && <p className="text-xs text-muted-foreground rounded-[14px] bg-muted p-3">No pharmacy currently has all matched medicines in stock.</p>}
              </div>
              <Button className="w-full rounded-[14px]" disabled={!selectedPharmacyId || sending || selectedRx.pharmacy_status === "confirmed"} onClick={() => void sendToPharmacy()}>{sending ? "Sending..." : selectedRx.pharmacy_status === "confirmed" ? "Pharmacy confirmed" : "Send to pharmacy"}</Button>
              {selectedRx.pharmacy_status && selectedRx.pharmacy_status !== "not_requested" && <p className="text-xs text-muted-foreground text-center">Status: <span className="font-semibold">{selectedRx.pharmacy_status === "in_progress" ? "In progress" : selectedRx.pharmacy_status}</span></p>}
            </div>
          </div>}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
