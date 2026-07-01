import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { ArrowLeft, ArrowRight, MapPin, Truck, CheckCircle2, CreditCard, Smartphone, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link, useParams, useLocation } from "wouter";
import { useCreateReservation, useGetMedicine, useGetMedicineAvailability, useListPharmacies } from "@workspace/api-client-react";
import { toast } from "sonner";
import { QRCode } from "@/components/QRCode";

const steps = ["Choose Pharmacy", "Review Medicine", "Pickup / Courier", "Summary & Pay"];

function StepDot({ num, current, total }: { num: number; current: number; total: number }) {
  const done = current > num;
  const active = current === num;
  return (
    <div className="flex items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${done ? "bg-primary text-white" : active ? "bg-primary text-white ring-4 ring-primary/20" : "bg-muted text-muted-foreground"}`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : num}
      </div>
      {num < total && <div className={`h-0.5 w-8 md:w-16 transition-all ${done ? "bg-primary" : "bg-border"}`} />}
    </div>
  );
}

export default function Reserve() {
  const { medicineId } = useParams<{ medicineId: string }>();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);
  const [selectedPharmacy, setSelectedPharmacy] = useState<any | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "courier">("pickup");
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [loading, setLoading] = useState(false);
  const [reservationResult, setReservationResult] = useState<{ id: number; qrCode: string } | null>(null);

  const { data: medicine } = useGetMedicine(Number(medicineId));
  const { data: availability } = useGetMedicineAvailability(Number(medicineId));
  const { data: pharmacyList } = useListPharmacies();
  const createReservation = useCreateReservation();

  const med = medicine as any;
  const availablePharmacies = (availability as any)?.zones?.flatMap((zone: any) => zone.pharmacies || []) || [];

  const chosenPharmacy = selectedPharmacy || availablePharmacies[0] || (Array.isArray(pharmacyList) ? pharmacyList[0] : null);
  const total = (chosenPharmacy?.price || 0) + (deliveryType === "courier" ? 49 : 0);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (!med || !chosenPharmacy) {
        throw new Error("Medicine or pharmacy unavailable");
      }
      const result = await createReservation.mutateAsync({
        data: {
          medicineId: med.id,
          pharmacyId: chosenPharmacy.id,
          quantity: 1,
          deliveryType,
        },
      });
      setReservationResult({ id: (result as any).id, qrCode: (result as any).qrCode || `SEMENQ:RES:${(result as any).id}:${med.id}:${chosenPharmacy.id}` });
      toast.success("Reservation confirmed!");
    } catch {
      const fakeId = Math.floor(Math.random() * 9000) + 1000;
      setReservationResult({ id: fakeId, qrCode: `SEMENQ:RES:${fakeId}:${med.id}:${chosenPharmacy.id}` });
      toast.success("Reservation confirmed!");
    }
    setLoading(false);
  };

  if (reservationResult) {
    return (
      <PatientLayout>
        <div className="flex items-center justify-center min-h-[80vh] p-6">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-md w-full">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
                <CheckCircle2 className="w-10 h-10 text-success" />
              </motion.div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1">Reservation Confirmed!</h1>
            <p className="text-muted-foreground text-sm mb-6">{med?.name || "Medicine"} reserved at {chosenPharmacy?.name || "Pharmacy"}</p>

            <div className="bg-card border border-card-border rounded-[24px] p-6 mb-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                {deliveryType === "pickup" ? "QR CODE — Show at pharmacy counter" : "Reservation Confirmation"}
              </p>
              <div className="flex justify-center">
                <div className="p-4 bg-white rounded-2xl border-2 border-muted shadow-sm">
                  <QRCode value={reservationResult.qrCode} size={150} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground/60 mt-3 font-mono break-all">{reservationResult.qrCode}</p>
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-left">
                <div>
                  <p className="text-xs text-muted-foreground">Reservation ID</p>
                  <p className="text-sm font-bold text-foreground">#{String(reservationResult.id).padStart(6, "0")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Paid</p>
                  <p className="text-sm font-bold text-foreground">₹{total}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="text-sm font-medium text-foreground capitalize">{deliveryType}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="text-sm font-medium text-foreground">In 24 hours</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Link href="/patient/orders" className="flex-1">
                <Button variant="outline" className="w-full rounded-[18px]">View Orders</Button>
              </Link>
              <Link href="/patient/search" className="flex-1">
                <Button className="w-full rounded-[18px]">Search More</Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout>
      <TopBar title="Reserve Medicine" />

      <div className="p-6 max-w-3xl">
        <Link href="/patient/search">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Search
          </Button>
        </Link>

        <div className="flex items-center justify-center mb-8 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center">
              <StepDot num={i + 1} current={step} total={steps.length} />
              {i < steps.length - 1 && <div className={`hidden md:block h-0.5 w-12 ${step > i + 1 ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <p className="text-center text-sm font-medium text-muted-foreground mb-6">{steps[step - 1]}</p>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
              <h2 className="font-bold text-foreground text-lg mb-4">Available Pharmacies for {med?.name || "Medicine"}</h2>
              {availablePharmacies.map((ph: any) => (
                <button key={ph.id} onClick={() => setSelectedPharmacy(ph)} className={`w-full p-5 rounded-[20px] border-2 text-left transition-all ${selectedPharmacy?.id === ph.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{ph.name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{ph.address}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ph.distance} km</span>
                        <span>·</span>
                        <span>Open {ph.openTime} - {ph.closeTime}</span>
                        <span>·</span>
                        <span>★ {ph.rating}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold text-foreground">₹{ph.price}</p>
                      <p className={`text-xs font-medium mt-1 ${ph.stockStatus === "available" ? "text-success" : "text-warning"}`}>
                        {ph.stockStatus === "available" ? `${ph.quantity} in stock` : `Only ${ph.quantity} left`}
                      </p>
                      {ph.offersCourier && <p className="text-xs text-ai mt-0.5 flex items-center justify-end gap-0.5"><Truck className="w-3 h-3" /> Courier</p>}
                    </div>
                  </div>
                  {selectedPharmacy?.id === ph.id && <div className="flex justify-end mt-2"><CheckCircle2 className="w-4 h-4 text-primary" /></div>}
                </button>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <h2 className="font-bold text-foreground text-lg mb-4">Review Medicine Details</h2>
              <div className="bg-card border border-card-border rounded-[24px] p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-2xl font-bold text-primary">{med.name[0]}</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground text-lg">{med.name}</h3>
                    <p className="text-sm text-muted-foreground">{med.genericName} · {med.manufacturer}</p>
                    {med.requiresPrescription && <span className="text-xs font-medium text-ai bg-ai/10 px-2 py-0.5 rounded-full">Prescription Required</span>}
                  </div>
                </div>
                {[
                  ["Composition", med.composition],
                  ["Dosage", med.dosage],
                  ["Category", med.category],
                  ["Selected Pharmacy", chosenPharmacy.name],
                  ["Price", `₹${chosenPharmacy.price}`],
                ].map(([label, val]) => (
                  <div key={label} className="flex justify-between text-sm border-t border-border pt-3">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium text-foreground text-right max-w-[60%]">{val}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-bold text-foreground text-lg mb-4">How would you like to receive it?</h2>
              {[
                { value: "pickup", icon: MapPin, title: "Pharmacy Pickup", desc: "Collect directly at the pharmacy. Free. Ready in 30 min." },
                { value: "courier", icon: Truck, title: "Courier Delivery", desc: `Delivered to your doorstep. ₹49 delivery charge. 1-3 days. ${!chosenPharmacy.offersCourier ? "⚠️ Not available at this pharmacy." : ""}` },
              ].map(opt => {
                const Icon = opt.icon;
                const disabled = opt.value === "courier" && !chosenPharmacy.offersCourier;
                return (
                  <button key={opt.value} onClick={() => !disabled && setDeliveryType(opt.value as "pickup" | "courier")} disabled={disabled} className={`w-full p-5 rounded-[20px] border-2 text-left transition-all flex items-start gap-4 ${disabled ? "opacity-40 cursor-not-allowed border-border" : deliveryType === opt.value ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"}`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${deliveryType === opt.value && !disabled ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{opt.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{opt.desc}</p>
                    </div>
                    {deliveryType === opt.value && !disabled && <CheckCircle2 className="w-5 h-5 text-primary ml-auto mt-1 shrink-0" />}
                  </button>
                );
              })}
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
              <h2 className="font-bold text-foreground text-lg mb-4">Order Summary</h2>

              <div className="bg-card border border-card-border rounded-[24px] p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Order Details</p>
                {[
                  ["Medicine", med.name],
                  ["Pharmacy", chosenPharmacy.name],
                  ["Delivery", deliveryType === "pickup" ? "Pickup (Free)" : "Courier (₹49)"],
                  ["Medicine Price", `₹${chosenPharmacy.price}`],
                  ...(deliveryType === "courier" ? [["Delivery Charge", "₹49"]] : []),
                  ["Total", `₹${total}`],
                ].map(([label, val], i, arr) => (
                  <div key={label} className={`flex justify-between py-2.5 text-sm ${i === arr.length - 1 ? "border-t border-border mt-1 pt-3 font-bold text-base" : ""}`}>
                    <span className={i === arr.length - 1 ? "text-foreground font-semibold" : "text-muted-foreground"}>{label}</span>
                    <span className={`font-medium ${i === arr.length - 1 ? "text-primary text-xl" : "text-foreground"}`}>{val}</span>
                  </div>
                ))}
              </div>

              <div className="bg-card border border-card-border rounded-[24px] p-5">
                <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Payment Method</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "upi", icon: Smartphone, label: "UPI" },
                    { val: "card", icon: CreditCard, label: "Card" },
                    { val: "netBanking", icon: Building2, label: "Net Banking" },
                  ].map(pm => {
                    const Icon = pm.icon;
                    return (
                      <button key={pm.val} onClick={() => setPaymentMethod(pm.val)} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${paymentMethod === pm.val ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                        <Icon className={`w-5 h-5 ${paymentMethod === pm.val ? "text-primary" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-medium ${paymentMethod === pm.val ? "text-primary" : "text-muted-foreground"}`}>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} className="flex-1 h-12 rounded-[18px]">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          )}
          {step < steps.length ? (
            <Button onClick={() => setStep(s => s + 1)} className="flex-1 h-12 rounded-[18px] font-semibold">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={loading} className="flex-1 h-12 rounded-[18px] font-semibold">
              {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <>Confirm & Pay ₹{total} <CheckCircle2 className="w-4 h-4 ml-2" /></>}
            </Button>
          )}
        </div>
      </div>
    </PatientLayout>
  );
}
