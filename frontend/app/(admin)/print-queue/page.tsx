"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/auth-context";
import { useDoctorContext } from "@/app/lib/doctor-context";
import { useLang } from "@/app/lib/language-context";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Printer, CheckCheck, FileText } from "lucide-react";
import { toast } from "@/app/components/ui/toaster";
import dynamic from "next/dynamic";
import type { Prescription } from "@/app/(admin)/prescriptions/page";

const PrescriptionPrint = dynamic(
  () => import("@/app/components/prescription-print"),
  { ssr: false }
);

interface PrintQueueEntry extends Prescription {
  patientName?: string;
}

export default function PrintQueuePage() {
  const { clinicId, role } = useAuth();
  const { selectedDoctorId, selectedDoctor } = useDoctorContext();
  const { t } = useLang();

  const [queue, setQueue] = useState<PrintQueueEntry[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [clinicInfo, setClinicInfo] = useState<{ name?: string; address?: string; phone?: string } | null>(null);

  // Print state: sequential queue
  const [printList, setPrintList] = useState<PrintQueueEntry[]>([]);
  const [currentPrint, setCurrentPrint] = useState<PrintQueueEntry | null>(null);

  // Fetch clinic info for print header
  useEffect(() => {
    if (!clinicId) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/clinics/${clinicId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setClinicInfo({ name: d.name, address: d.address, phone: d.phone }))
      .catch(() => {});
  }, [clinicId]);

  // Real-time listener on prescriptions where printQueued == true
  useEffect(() => {
    if (!clinicId || !db) return;
    const col = collection(db, "clinics", clinicId, "prescriptions");
    const q = query(col, where("printQueued", "==", true));
    return onSnapshot(q, (snap) => {
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PrintQueueEntry));
      if (selectedDoctorId) data = data.filter((r) => r.doctorId === selectedDoctorId);
      // Sort newest first
      data.sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
      setQueue(data);
      // Clear selected entries that are no longer in queue
      setSelected((prev) => {
        const ids = new Set(data.map((r) => r.id));
        const next = new Set(Array.from(prev).filter((id) => ids.has(id)));
        return next;
      });
    });
  }, [clinicId, selectedDoctorId]);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected(selected.size === queue.length ? new Set() : new Set(queue.map((r) => r.id)));

  // Mark a single prescription as printed via API
  const markPrinted = useCallback(async (id: string) => {
    if (!clinicId) return;
    try {
      await api.post(`/api/clinics/${clinicId}/prescriptions/${id}/mark-printed`, {});
    } catch {
      toast({ title: "Error", description: "Failed to mark as printed", variant: "destructive" });
    }
  }, [clinicId]);

  // Mark selected as printed (no print dialog)
  const handleMarkPrinted = async () => {
    await Promise.all(Array.from(selected).map(markPrinted));
    setSelected(new Set());
    toast({ title: "Marked as printed", description: `${selected.size} prescription(s) marked.` });
  };

  // Sequential print handler
  const startPrint = (rxList: PrintQueueEntry[]) => {
    if (rxList.length === 0) return;
    setPrintList(rxList.slice(1));
    setCurrentPrint(rxList[0]);
  };

  const handlePrintClose = useCallback(async () => {
    if (currentPrint) {
      await markPrinted(currentPrint.id);
    }
    if (printList.length > 0) {
      setCurrentPrint(printList[0]);
      setPrintList((prev) => prev.slice(1));
    } else {
      setCurrentPrint(null);
    }
  }, [currentPrint, printList, markPrinted]);

  const handlePrintSelected = () => {
    const toPrint = queue.filter((r) => selected.has(r.id));
    startPrint(toPrint);
  };

  const handlePrintSingle = (rx: PrintQueueEntry) => startPrint([rx]);

  const patientName = (rx: PrintQueueEntry) =>
    rx.content?.patientInfo?.name ?? rx.patientName ?? "—";

  const medSummary = (rx: PrintQueueEntry) => {
    const meds = rx.content?.medications ?? [];
    if (meds.length === 0) return "—";
    return meds.map((m: { name: string }) => m.name).slice(0, 3).join(", ") + (meds.length > 3 ? `… +${meds.length - 3}` : "");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Printer className="h-6 w-6 text-primary" />
            {t("pq_title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("pq_subtitle")}</p>
        </div>
        {queue.length > 0 && (
          <div className="flex items-center gap-2">
            {selected.size > 0 && (
              <>
                <span className="text-xs text-muted-foreground">{selected.size} {t("pq_selected")}</span>
                <Button size="sm" variant="outline" onClick={handleMarkPrinted}>
                  <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
                  {t("pq_mark_printed")}
                </Button>
                <Button size="sm" onClick={handlePrintSelected}>
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  {t("pq_print_selected")}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {queue.length} {queue.length === 1 ? "prescription" : "prescriptions"} pending
            </span>
            {queue.length > 0 && (
              <label className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.size === queue.length && queue.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
                {t("pq_select_all")}
              </label>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCheck className="h-10 w-10 text-green-400 mx-auto" />
              <p className="text-muted-foreground">{t("pq_empty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((rx) => (
                <div
                  key={rx.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    selected.has(rx.id) ? "border-primary bg-primary/5" : "bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(rx.id)}
                    onChange={() => toggleSelect(rx.id)}
                    className="rounded shrink-0"
                  />
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="font-medium truncate">{patientName(rx)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {t("pq_medications")}: {medSummary(rx)}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{rx.date}</p>
                    <Badge variant="secondary" className="text-xs">
                      Rx #{rx.id.slice(-6).toUpperCase()}
                    </Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handlePrintSingle(rx)}>
                    <Printer className="h-3.5 w-3.5 mr-1" />
                    {t("pq_print")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {currentPrint && (
        <PrescriptionPrint
          prescription={currentPrint}
          onClose={handlePrintClose}
          clinicName={clinicInfo?.name}
          clinicAddress={clinicInfo?.address}
          clinicPhone={clinicInfo?.phone}
          doctorName={selectedDoctor?.name}
          doctorSpecialization={selectedDoctor?.specialization}
        />
      )}
    </div>
  );
}
