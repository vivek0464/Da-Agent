"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/auth-context";
import { useDoctorContext } from "@/app/lib/doctor-context";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { toast } from "@/app/components/ui/toaster";
import { Search, UserPlus, X, Phone, Mail, FileText, User } from "lucide-react";

interface Patient {
  id: string;
  name: string;
  phone?: string;
  gender?: string;
  age?: number;
  email?: string;
  notes?: string;
  visits: number;
  createdAt?: string;
}

interface PastRx {
  id: string;
  date: string;
  status: string;
  content: { complaints?: string[]; diagnosis?: string[]; medications?: { name: string }[] };
}

const EMPTY_FORM = { name: "", phone: "", gender: "", age: "", email: "", notes: "" };
const GENDERS = ["Male", "Female", "Other"];


export default function PatientsPage() {
  const { clinicId } = useAuth();
  const { selectedDoctorId } = useDoctorContext();
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [selected, setSelected] = useState<Patient | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [pastRx, setPastRx] = useState<PastRx[]>([]);
  const [loadingRx, setLoadingRx] = useState(false);

  // Real-time Firestore listener for patients
  useEffect(() => {
    if (!clinicId || !db) return;
    const q = query(collection(db, "clinics", clinicId, "patients"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setAllPatients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Patient)));
    });
  }, [clinicId]);

  const patients = useMemo(() => {
    let list = allPatients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.phone ?? "").includes(q));
    }
    if (dateFilter) {
      list = list.filter((p) => p.createdAt?.startsWith(dateFilter));
    }
    return list;
  }, [allPatients, search, dateFilter]);

  const loadPastRx = useCallback(async (patientId: string) => {
    if (!clinicId) return;
    setLoadingRx(true);
    try {
      const data = await api.get<PastRx[]>(`/api/clinics/${clinicId}/prescriptions/?patient_id=${patientId}`);
      setPastRx(data.sort((a, b) => b.date.localeCompare(a.date)));
    } catch { setPastRx([]); }
    finally { setLoadingRx(false); }
  }, [clinicId]);

  const openPatient = (p: Patient) => {
    setSelected(p);
    setForm({ name: p.name, phone: p.phone ?? "", gender: p.gender ?? "", age: p.age != null ? String(p.age) : "", email: p.email ?? "", notes: p.notes ?? "" });
    setShowForm(false);
    loadPastRx(p.id);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    setSaving(true);
    try {
      const qs = selectedDoctorId ? `?doctor_id=${selectedDoctorId}` : "";
      await api.post<Patient>(`/api/clinics/${clinicId}/patients/${qs}`, {
        ...form,
        age: form.age ? parseInt(form.age, 10) : null,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      toast({ title: "Patient added", description: `${form.name} added and queued for today.` });
    } catch {
      toast({ title: "Error", description: "Failed to create patient", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId || !selected) return;
    setSaving(true);
    try {
      const updated = await api.patch<Patient>(`/api/clinics/${clinicId}/patients/${selected.id}`, {
        ...form,
        age: form.age ? parseInt(form.age, 10) : null,
      });
      setSelected(updated);
      toast({ title: "Updated" });
    } catch {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-72 flex-col border-r bg-white">
        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Patients</h2>
            <Button size="sm" onClick={() => { setShowForm(true); setSelected(null); setForm(EMPTY_FORM); }}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name or phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="text-sm" placeholder="Filter by added date" />
          {dateFilter && <button onClick={() => setDateFilter("")} className="text-xs text-primary underline">Clear date filter</button>}
        </div>
        <div className="flex-1 overflow-y-auto">
          {patients.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">No patients found.</div>
          ) : (
            patients.map((p) => (
              <button key={p.id} onClick={() => openPatient(p)}
                className={`w-full border-b p-3 text-left transition-colors hover:bg-gray-50 ${selected?.id === p.id ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}
              >
                <p className="font-medium text-sm">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.age != null ? `${p.age}y` : ""}{p.gender ? ` · ${p.gender}` : ""} · {p.visits} visit{p.visits !== 1 ? "s" : ""}
                </p>
                {p.phone && <p className="text-xs text-muted-foreground">{p.phone}</p>}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 overflow-auto p-6">
        {showForm && (
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                New Patient
                <button onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <Label>Full Name *</Label>
                    <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Phone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                      <option value="">Select…</option>
                      {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Age (years)</Label>
                    <Input type="number" min={0} max={150} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 35" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Add Patient"}</Button>
                  <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {selected && !showForm && (
          <div className="max-w-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{selected.name}</h1>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                  {selected.age != null && <span><User className="inline h-3.5 w-3.5 mr-1" />{selected.age} yrs</span>}
                  {selected.gender && <span>{selected.gender}</span>}
                  {selected.phone && <span><Phone className="inline h-3.5 w-3.5 mr-1" />{selected.phone}</span>}
                  {selected.email && <span><Mail className="inline h-3.5 w-3.5 mr-1" />{selected.email}</span>}
                  <span><FileText className="inline h-3.5 w-3.5 mr-1" />{selected.visits} visits</span>
                </div>
              </div>
              <button onClick={() => { setSelected(null); setPastRx([]); }}><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Edit Record</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleUpdate} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                      <Label>Full Name</Label>
                      <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Phone</Label>
                      <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Gender</Label>
                      <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        <option value="">Select…</option>
                        {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Age (years)</Label>
                      <Input type="number" min={0} max={150} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 35" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                  </div>
                  <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
                </form>
              </CardContent>
            </Card>

            {/* Past Prescriptions */}
            <Card>
              <CardHeader><CardTitle className="text-base">Past Prescriptions</CardTitle></CardHeader>
              <CardContent>
                {loadingRx ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : pastRx.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prescriptions on record.</p>
                ) : (
                  <div className="space-y-2">
                    {pastRx.map((rx) => (
                      <div key={rx.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{rx.date}</span>
                          <Badge variant={rx.status === "final" ? "success" : "warning"}>{rx.status}</Badge>
                        </div>
                        {rx.content.complaints?.length ? <p className="text-muted-foreground">Complaints: {rx.content.complaints.join(", ")}</p> : null}
                        {rx.content.diagnosis?.length ? <p className="text-muted-foreground">Diagnosis: {rx.content.diagnosis.join(", ")}</p> : null}
                        {rx.content.medications?.length ? <p className="text-muted-foreground">Meds: {rx.content.medications.map((m) => m.name).join(", ")}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {!selected && !showForm && (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a patient or add a new one
          </div>
        )}
      </div>
    </div>
  );
}
