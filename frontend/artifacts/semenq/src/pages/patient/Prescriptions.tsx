import { motion } from "framer-motion";
import { PatientLayout } from "@/layouts/PatientLayout";
import { TopBar } from "@/components/TopBar";
import { FileImage, Upload, CheckCircle2, Clock, Search, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useListPrescriptions } from "@workspace/api-client-react";
import { SkeletonCard } from "@/components/SkeletonCard";

export default function Prescriptions() {
  const { data, isLoading } = useListPrescriptions();
  const prescriptions = (Array.isArray(data) ? data : []) as any[];

  return (
    <PatientLayout>
      <TopBar title="My Prescriptions" userName="Guest" />

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
                      <p className="font-semibold text-foreground">Rx from {rx.doctorName}</p>
                      <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Parsed
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{rx.hospitalName}</p>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(rx.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>

                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-ai" />
                        <span className="text-xs text-muted-foreground">AI Confidence: <span className="font-semibold text-foreground">{rx.overallConfidence}%</span></span>
                      </div>
                      <Link href="/patient/search">
                        <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                          <Search className="w-3 h-3" /> Search all medicines
                        </button>
                      </Link>
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
    </PatientLayout>
  );
}
