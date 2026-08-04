import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { Upload, FileImage, X, Zap, CheckCircle2, AlertTriangle, Search, Edit3, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { useGetMyProfile } from "@workspace/api-client-react";
import { auth } from "@/lib/firebase";

type ScanStatus = "idle" | "uploading" | "scanning" | "done" | "error";

type ParsedMedicine = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  status: "confirmed" | "lowConfidence" | "unmatched";
  confidence: number;
};

const scanSteps = [
  "Preprocessing image...",
  "Detecting text regions...",
  "Extracting medicine names...",
  "Parsing dosage information...",
  "Verifying against drug database...",
  "Computing confidence scores...",
];

export default function PrescriptionUpload() {
  const { data: profile } = useGetMyProfile();
  const [, navigate] = useLocation();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanStep, setScanStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [parsedMedicines, setParsedMedicines] = useState<ParsedMedicine[]>([]);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [hospitalName, setHospitalName] = useState<string | null>(null);
  const [overallConfidence, setOverallConfidence] = useState<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ParsedMedicine | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [showContinue, setShowContinue] = useState(false);
  // Pharmacy selection intentionally lives in My Prescriptions. These
  // placeholders keep the legacy hidden block harmless during the transition.
  const selectedPharmacyId = "";
  const setSelectedPharmacyId = (_value: string) => undefined;
  const pharmacies: any[] = [];
  const inputRef = useRef<HTMLInputElement>(null);

  const resetUpload = () => {
    setFile(null);
    setPreview(null);
    setScanStatus("idle");
    setScanError(null);
    setParsedMedicines([]);
    setDoctorName(null);
    setHospitalName(null);
    setOverallConfidence(null);
    setCurrentPrescriptionId(null);
    setEditingIndex(null);
    setEditDraft(null);
    setShowContinue(false);
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) { toast.error("Please upload an image file (JPG or PNG)"); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setScanError(null);
    setParsedMedicines([]);
    setDoctorName(null);
    setHospitalName(null);
    setOverallConfidence(null);
    setCurrentPrescriptionId(null);
    setEditingIndex(null);
    setEditDraft(null);
    setShowContinue(false);
    setScanStatus("uploading");
    void startScanning(f);
  };

  const startEdit = (index: number) => {
    setEditingIndex(index);
    setEditDraft({ ...parsedMedicines[index] });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditDraft(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !editDraft) return;
    setParsedMedicines(previous => previous.map((item, index) => (index === editingIndex ? editDraft : item)));
    setEditingIndex(null);
    setEditDraft(null);
  };

  const confirmPrescription = async () => {
    if (!currentPrescriptionId || parsedMedicines.length === 0 || confirming) return;
    setConfirming(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in before continuing.");

      const response = await fetch(`/api/prescriptions/${currentPrescriptionId}/confirm`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          medicines: parsedMedicines.map((medicine) => ({
            medicine_name: medicine.name,
            dosage: medicine.dosage === "Not detected" ? null : medicine.dosage,
            frequency: medicine.frequency === "Not detected" ? null : medicine.frequency,
            duration: medicine.duration === "Not detected" ? null : medicine.duration,
            confidence: Number.isFinite(medicine.confidence) ? Math.max(0, Math.min(1, medicine.confidence / 100)) : 0,
          })),
        }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || "Could not confirm this prescription.");
      }
      setShowContinue(false);
      toast.success("Prescription confirmed. Choose a pharmacy from My Prescriptions.");
      navigate("/patient/prescriptions");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to confirm prescription.";
      toast.error(message);
    } finally {
      setConfirming(false);
    }
  };

  const startScanning = async (image: File) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please sign in before uploading a prescription.");

      const formData = new FormData();
      formData.append("file", image);
      const uploadResponse = await fetch("/api/prescriptions/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const uploadResult = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadResult?.success || !uploadResult.data?.id) {
        throw new Error(uploadResult?.message || "Prescription upload failed.");
      }

      const prescriptionId = uploadResult.data.id;
      setCurrentPrescriptionId(prescriptionId);
      setScanStatus("scanning");

      for (let attempt = 0; attempt < 90; attempt += 1) {
        const statusToken = await auth.currentUser?.getIdToken();
        if (!statusToken) throw new Error("Your session expired. Please sign in again.");

        const statusResponse = await fetch(`/api/prescriptions/${prescriptionId}`, {
          headers: { Authorization: `Bearer ${statusToken}` },
        });
        const statusResult = await statusResponse.json().catch(() => null);
        if (!statusResponse.ok || !statusResult?.success || !statusResult.data) {
          throw new Error(statusResult?.message || "Unable to read OCR results.");
        }

        const result = statusResult.data;
        const processingStatus = result.processing_status as string;
        const stepIndex = processingStatus === "ocr_processing" ? 1
          : processingStatus === "ai_processing" ? 3
            : processingStatus === "matching" ? 4
              : processingStatus === "completed" || processingStatus === "partial" ? 5
                : 0;
        setScanStep(stepIndex);
        setProgress(Math.min(95, Math.max(10, Math.round(((attempt + 1) / 90) * 100))));

        if (processingStatus === "failed") {
          throw new Error(result.last_error || "We could not read this prescription. Please try a clearer image.");
        }

        if (processingStatus === "completed" || processingStatus === "partial") {
          const medicines = Array.isArray(result.extracted_medicines) ? result.extracted_medicines : [];
          setParsedMedicines(medicines.map((medicine: any) => {
            const rawConfidence = Number(medicine.confidence || 0);
            const confidence = Math.round(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence);
            return {
              name: medicine.medicine_name || medicine.raw_text || "Unidentified medicine",
              dosage: medicine.dosage || "Not detected",
              frequency: medicine.frequency || "Not detected",
              duration: medicine.duration || "Not detected",
              status: confidence >= 90 ? "confirmed" : confidence >= 60 ? "lowConfidence" : "unmatched",
              confidence,
            };
          }));
          setDoctorName(result.doctor_name || null);
          setHospitalName(result.hospital_name || null);
          const rawOverallConfidence = Number(result.overall_confidence || 0);
          setOverallConfidence(Math.round(rawOverallConfidence <= 1 ? rawOverallConfidence * 100 : rawOverallConfidence));
          setProgress(100);
          setScanStep(scanSteps.length - 1);
          setScanStatus("done");
          setShowContinue(result.patient_confirmed !== true);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      throw new Error("OCR is taking longer than expected. Please check My Prescriptions shortly.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Prescription OCR failed.";
      setScanError(message);
      setScanStatus("error");
      toast.error(message);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const confidenceColor = (c: number) => c >= 85 ? "bg-success" : c >= 60 ? "bg-warning" : "bg-destructive";
  const statusColor = (s: string) => s === "confirmed" ? "text-success" : s === "lowConfidence" ? "text-warning" : "text-destructive";

  return (
    <PatientLayout>
      <TopBar title="Upload Prescription" subtitle="AI will extract your medicines automatically" userName={(profile as any)?.name || "Guest"} />

      <div className="p-6 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {!file ? (
              <motion.div
                onDrop={onDrop}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => inputRef.current?.click()}
                animate={{ borderColor: dragOver ? "#2563EB" : "#E2E8F0" }}
                className={`relative border-2 border-dashed rounded-[24px] p-12 cursor-pointer text-center transition-all pulse-border ${dragOver ? "bg-primary/5 border-primary" : "bg-card hover:bg-muted/30"}`}
              >
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Drop your prescription here</h3>
                <p className="text-sm text-muted-foreground mb-4">or click to browse files</p>
                <p className="text-xs text-muted-foreground">Supports JPG or PNG · Max 10MB</p>

                <div className="mt-6 flex items-center gap-2 justify-center">
                  <Zap className="w-4 h-4 text-ai" />
                  <span className="text-xs font-medium text-ai">AI will read and extract all medicines</span>
                </div>
              </motion.div>
            ) : (
              <div className="bg-card border border-card-border rounded-[24px] overflow-hidden">
                <div className="relative bg-muted flex justify-center overflow-hidden">
                  {preview && (
                    <img
                      src={preview}
                      alt="Prescription"
                      className="block w-full h-auto max-w-full object-contain"
                    />
                  )}

                  {scanStatus === "scanning" && (
                    <div className="absolute inset-0">
                      <div className="absolute inset-0 bg-primary/10" />
                      <div className="scan-line absolute left-0 right-0 h-0.5 bg-primary/80 shadow-[0_0_8px_2px_rgba(37,99,235,0.4)]" />
                    </div>
                  )}

                  {scanStatus === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-success/10">
                      <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-success" />
                        <span className="font-semibold text-success text-sm">Parsing complete</span>
                      </div>
                    </div>
                  )}

                  {scanStatus === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 p-6 text-center">
                      <div className="bg-white rounded-2xl p-4 shadow-lg">
                        <AlertTriangle className="w-5 h-5 text-destructive mx-auto mb-2" />
                        <p className="font-semibold text-destructive text-sm">OCR failed</p>
                        <p className="text-xs text-muted-foreground mt-1">{scanError}</p>
                      </div>
                    </div>
                  )}

                  <button onClick={resetUpload} className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-muted transition-colors">
                    <X className="w-4 h-4 text-foreground" />
                  </button>
                </div>

                {scanStatus !== "idle" && scanStatus !== "done" && scanStatus !== "error" && (
                  <div className="p-4 border-t border-border">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-muted-foreground font-medium">{scanSteps[scanStep]}</span>
                      <span className="font-semibold text-primary">{progress}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
                    </div>
                  </div>
                )}

                {scanStatus === "done" && (
                  <div className="p-4 border-t border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{doctorName || "Doctor not detected"}</p>
                      <p className="text-xs text-muted-foreground">{hospitalName || "Hospital not detected"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Overall confidence</p>
                      <p className="font-bold text-success">{overallConfidence ?? 0}%</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!file && (
              <button onClick={() => toast.info("Upload a prescription image to begin parsing")} className="w-full py-3 text-sm text-primary font-medium hover:underline">
                Try the upload flow
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg bg-ai/10 flex items-center justify-center">
                <Zap className="w-4 h-4 text-ai" />
              </div>
              <h2 className="font-semibold text-foreground">Detected Medicines</h2>
              {scanStatus === "done" && <span className="ml-auto text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">{parsedMedicines.length} found</span>}
            </div>

            {scanStatus === "idle" && (
              <div className="bg-card border border-card-border rounded-[24px] p-8 text-center">
                <FileImage className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Upload a prescription to see detected medicines here</p>
              </div>
            )}

            {(scanStatus === "scanning" || scanStatus === "uploading") && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-card border border-card-border rounded-[20px] p-4 animate-pulse">
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-xl bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                        <div className="h-2 bg-muted/60 rounded w-full" />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="text-center text-xs text-ai font-medium animate-pulse flex items-center justify-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" />
                  AI scanning in progress...
                </div>
              </div>
            )}

            <AnimatePresence>
              {scanStatus === "done" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {parsedMedicines.length === 0 && (
                    <div className="bg-card border border-card-border rounded-[20px] p-5 text-center">
                      <AlertTriangle className="w-5 h-5 text-warning mx-auto mb-2" />
                      <p className="text-sm font-medium text-foreground">No medicines detected</p>
                      <p className="text-xs text-muted-foreground mt-1">Try uploading a sharper, well-lit prescription image.</p>
                    </div>
                  )}
                  {parsedMedicines.map((med, i) => (
                    <motion.div key={med.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-card border border-card-border rounded-[20px] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          {editingIndex === i && editDraft ? (
                            <div className="space-y-2">
                              <input
                                value={editDraft.name}
                                onChange={(event) => setEditDraft((previous) => previous ? { ...previous, name: event.target.value } : previous)}
                                className="w-full border border-border rounded-lg px-2.5 py-1.5 text-sm"
                                placeholder="Medicine name"
                              />
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                  value={editDraft.dosage}
                                  onChange={(event) => setEditDraft((previous) => previous ? { ...previous, dosage: event.target.value } : previous)}
                                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs"
                                  placeholder="Dosage"
                                />
                                <input
                                  value={editDraft.frequency}
                                  onChange={(event) => setEditDraft((previous) => previous ? { ...previous, frequency: event.target.value } : previous)}
                                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs"
                                  placeholder="Frequency"
                                />
                                <input
                                  value={editDraft.duration}
                                  onChange={(event) => setEditDraft((previous) => previous ? { ...previous, duration: event.target.value } : previous)}
                                  className="w-full border border-border rounded-lg px-2.5 py-1.5 text-xs"
                                  placeholder="Duration"
                                />
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={cancelEdit}>Cancel</Button>
                                <Button type="button" className="h-8 px-3 text-xs" onClick={saveEdit}>Save</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground text-sm">{med.name}</p>
                                {med.status === "lowConfidence" && <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />}
                              </div>
                              <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                                <span>Dosage: <span className="font-medium text-foreground">{med.dosage}</span></span>
                                <span>·</span>
                                <span>Frequency: <span className="font-medium text-foreground">{med.frequency}</span></span>
                                <span>·</span>
                                <span>Duration: <span className="font-medium text-foreground">{med.duration}</span></span>
                              </div>
                            </>
                          )}
                        </div>
                        <button type="button" onClick={() => startEdit(i)} className="shrink-0 p-1.5 hover:bg-muted rounded-lg transition-colors" aria-label="Edit medicine">
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>

                      <div className="mt-3 pt-3 border-t border-border">
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${statusColor(med.status)}`}>
                            {med.status === "confirmed" ? "High confidence" : med.status === "lowConfidence" ? "Low confidence — please verify" : "Unmatched"}
                          </span>
                          <span className="font-semibold">{med.confidence}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${confidenceColor(med.confidence)}`} style={{ width: `${med.confidence}%` }} />
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {parsedMedicines.length > 0 && (
                    <div className="bg-card border border-card-border rounded-[20px] p-3 mt-2">
                      {showContinue && (
                        <div className="space-y-3">
                          {false && <div className="rounded-[16px] border border-primary/20 bg-primary/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Building2 className="w-4 h-4 text-primary" />
                              <p className="text-sm font-semibold text-foreground">Choose pharmacy for verification</p>
                            </div>
                            <select
                              value={selectedPharmacyId}
                              onChange={event => setSelectedPharmacyId(event.target.value)}
                              className="w-full h-10 rounded-xl border border-border bg-background px-3 text-sm"
                            >
                              <option value="">Select an available pharmacy</option>
                              {pharmacies.map(pharmacy => (
                                <option key={pharmacy.id} value={pharmacy.id}>
                                  {pharmacy.name} — {pharmacy.distance_text} — {pharmacy.available_medicines?.join(", ") || "Medicine available"}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-muted-foreground mt-2">
                              Only pharmacies with stock for this prescription are shown. The image will be sent privately for verification.
                            </p>
                            {pharmacies.length === 0 && <p className="text-xs text-warning mt-2">No pharmacy currently has a matched medicine in stock.</p>}
                          </div>}
                          <div className="grid grid-cols-2 gap-2">
                            <Button type="button" variant="outline" onClick={resetUpload} className="h-11 rounded-[14px] font-semibold">
                              Cancel
                            </Button>
                            <Button type="button" onClick={confirmPrescription} disabled={confirming} className="h-11 rounded-[14px] font-semibold">
                              {confirming ? "Confirming..." : "Continue"}
                            </Button>
                          </div>
                        </div>
                      )}

                      <Link href="/patient/search">
                        <Button className="w-full h-11 rounded-[14px] font-semibold mt-2 gap-2">
                          <Search className="w-4 h-4" />
                          Search All {parsedMedicines.length} Medicines
                        </Button>
                      </Link>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PatientLayout>
  );
}
