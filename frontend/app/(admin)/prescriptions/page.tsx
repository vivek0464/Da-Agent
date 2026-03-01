"use client";
import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/auth-context";
import { useDoctorContext } from "@/app/lib/doctor-context";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "@/app/components/ui/toaster";
import PrescriptionEditor from "@/app/components/prescription-editor";
import PrescriptionPrint from "@/app/components/prescription-print";
import { FilePlus, Printer, Lock, Search, X } from "lucide-react";
import { format } from "date-fns";

export interface PrescriptionContent {
  patientInfo: Record<string, string>;
  complaints: string[];
  diagnosis: string[];
  medications: { name: string; dosage: string; frequency: string; duration: string }[];
  tests: string[];
  followUp: string;
  notes: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  clinicId: string;
  date: string;
  status: string;
  content: PrescriptionContent;
  createdAt?: string;
  updatedAt?: string;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

export default function PrescriptionsPage() {
  const { clinicId, role } = useAuth();
  const isStaff = role === "staff";
  const { selectedDoctorId } = useDoctorContext();
  const [allRx, setAllRx] = useState<Prescription[]>([]);
  const [selected, setSelected] = useState<Prescription | null>(null);
  const [printing, setPrinting] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState(TODAY);
  const [dateTo, setDateTo] = useState(TODAY);

  // Real-time Firestore listener — filter doctorId client-side to avoid composite index
  useEffect(() => {
    if (!clinicId || !db) return;
    const col = collection(db, "clinics", clinicId, "prescriptions");
    const q = query(col, orderBy("date", "desc"));
    return onSnapshot(q, (snap) => {
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Prescription));
      if (selectedDoctorId) data = data.filter((r) => r.doctorId === selectedDoctorId);
      setAllRx(data);
      setSelected((prev) => prev ? (data.find((r) => r.id === prev.id) ?? prev) : null);
    });
  }, [clinicId, selectedDoctorId]);

  const prescriptions = useMemo(() => {
    let list = allRx;
    if (dateFrom) list = list.filter((r) => r.date >= dateFrom);
    if (dateTo) list = list.filter((r) => r.date <= dateTo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        r.content.patientInfo?.name?.toLowerCase().includes(q) ||
        r.patientId.toLowerCase().includes(q)
      );
    }
    return list;
  }, [allRx, dateFrom, dateTo, search]);

  const handleCreate = async () => {
    if (!clinicId || !selectedDoctorId) {
      toast({ title: "Error", description: "Clinic or doctor not configured", variant: "destructive" });
      return;
    }
    try {
      const rx = await api.post<Prescription>(`/api/clinics/${clinicId}/prescriptions/`, {
        clinicId, patientId: "unknown", doctorId: selectedDoctorId, status: "draft",
        content: { patientInfo: {}, complaints: [], diagnosis: [], medications: [], tests: [], followUp: "", notes: "" },
      });
      setSelected(rx);
      toast({ title: "Created", description: `Draft prescription created.` });
    } catch {
      toast({ title: "Error", description: "Failed to create prescription", variant: "destructive" });
    }
  };

  const handleSave = async (content: PrescriptionContent) => {
    if (!clinicId || !selected) return;
    try {
      const updated = await api.patch<Prescription>(`/api/clinics/${clinicId}/prescriptions/${selected.id}`, { content });
      setSelected(updated);
      toast({ title: "Saved" });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    }
  };

  const handleFinalize = async () => {
    if (!clinicId || !selected) return;
    if (!confirm("Finalize this prescription? This will lock it from further edits.")) return;
    try {
      const updated = await api.patch<Prescription>(`/api/clinics/${clinicId}/prescriptions/${selected.id}`, { status: "final" });
      setSelected(updated);
      toast({ title: "Finalized", description: "Prescription is now locked." });
    } catch {
      toast({ title: "Error", description: "Failed to finalize", variant: "destructive" });
    }
  };

  const patientLabel = (rx: Prescription) => {
    const pi = rx.content.patientInfo;
    if (pi?.name) {
      const parts = [pi.name];
      if (pi.age) parts.push(`${pi.age}y`);
      if (pi.gender) parts.push(pi.gender);
      return parts.join(", ");
    }
    return `Patient #${rx.patientId.slice(-6)}`;
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-72 flex-col border-r bg-white">
        <div className="p-3 space-y-2 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Prescriptions</h2>
            {!isStaff && <Button size="sm" onClick={handleCreate}><FilePlus className="h-4 w-4" /></Button>}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search patient name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">From</p>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 text-xs" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">To</p>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 text-xs" />
            </div>
          </div>
          {(dateFrom !== TODAY || dateTo !== TODAY) && (
            <button onClick={() => { setDateFrom(TODAY); setDateTo(TODAY); }} className="text-xs text-primary underline">Reset to today</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          {prescriptions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No prescriptions found.</div>
          ) : (
            prescriptions.map((rx) => (
              <button key={rx.id} onClick={() => setSelected(rx)}
                className={`w-full border-b p-3 text-left transition-colors hover:bg-gray-50 ${selected?.id === rx.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="text-sm font-medium truncate">{patientLabel(rx)}</p>
                  <Badge variant={rx.status === "final" ? "success" : "warning"} className="shrink-0 text-xs">{rx.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{rx.date} · #{rx.id.slice(-6)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        {selected ? (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b bg-white px-6 py-3">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="font-semibold">{patientLabel(selected)}</h2>
                  <p className="text-xs text-muted-foreground">{selected.date} · #{selected.id.slice(-8)}</p>
                </div>
                <Badge variant={selected.status === "final" ? "success" : "warning"}>{selected.status}</Badge>
              </div>
              <div className="flex items-center gap-2">
                {selected.status !== "final" && !isStaff && (
                  <Button size="sm" variant="outline" onClick={handleFinalize}>
                    <Lock className="mr-1.5 h-3.5 w-3.5" />Finalize
                  </Button>
                )}
                {selected.status === "final" ? (
                  <Button size="sm" variant="outline" onClick={() => setPrinting(true)}>
                    <Printer className="mr-1.5 h-3.5 w-3.5" />Print
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" disabled title="Finalize first to print">
                    <Printer className="mr-1.5 h-3.5 w-3.5 opacity-40" />Print
                  </Button>
                )}
                <button onClick={() => setSelected(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <PrescriptionEditor prescription={selected} onSave={handleSave} readOnly={selected.status === "final" || isStaff} />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a prescription or create a new one
          </div>
        )}
      </div>

      {printing && selected && (
        <PrescriptionPrint prescription={selected} onClose={() => setPrinting(false)} />
      )}
    </div>
  );
}
