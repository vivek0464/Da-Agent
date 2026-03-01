"use client";
import { useEffect, useState } from "react";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "@/app/components/ui/toaster";
import { Building2, UserPlus, QrCode, ChevronDown, ChevronRight, Link2, Copy, ExternalLink } from "lucide-react";

interface Clinic { id: string; name: string; slug?: string; address: string; phone: string; qrCodeUrl?: string; bookingUrl?: string; }
interface Doctor { id: string; name: string; email: string; phone?: string; specialization?: string; firebaseUid?: string; }
interface Staff  { id: string; name: string; email: string; firebaseUid?: string; }

const EMPTY_CLINIC = { name: "", address: "", phone: "" };
const EMPTY_FIRST_DOCTOR = { name: "", email: "", specialization: "" };
const EMPTY_DOCTOR = { name: "", email: "", phone: "", specialization: "" };
const EMPTY_STAFF  = { name: "", email: "" };

export default function PlatformAdminPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [selectedClinic, setSelectedClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [tab, setTab] = useState<"doctors" | "staff">("doctors");
  const [showClinicForm, setShowClinicForm] = useState(false);
  const [showDoctorForm, setShowDoctorForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [clinicForm, setClinicForm] = useState(EMPTY_CLINIC);
  const [firstDoctorForm, setFirstDoctorForm] = useState(EMPTY_FIRST_DOCTOR);
  const [doctorForm, setDoctorForm] = useState(EMPTY_DOCTOR);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.get<Clinic[]>("/api/clinics/").then(setClinics).catch(() => {}); }, []);

  const loadClinic = async (clinic: Clinic) => {
    if (selectedClinic?.id === clinic.id) { setSelectedClinic(null); return; }
    setSelectedClinic(clinic);
    const [docs, st] = await Promise.all([
      api.get<Doctor[]>(`/api/clinics/${clinic.id}/doctors`),
      api.get<Staff[]>(`/api/clinics/${clinic.id}/staff`).catch(() => [] as Staff[]),
    ]);
    setDoctors(docs);
    setStaff(st);
  };

  const handleCreateClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstDoctorForm.name.trim() || !firstDoctorForm.email.trim()) {
      toast({ title: "First doctor required", description: "Add at least one doctor to create the clinic.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const clinic = await api.post<Clinic & { bookingUrl?: string }>("/api/clinics/", clinicForm);
      // Add first doctor immediately
      await api.post(`/api/clinics/${clinic.id}/doctors`, { ...firstDoctorForm, phone: "" });
      setClinics((prev) => [...prev, clinic]);
      setClinicForm(EMPTY_CLINIC);
      setFirstDoctorForm(EMPTY_FIRST_DOCTOR);
      setShowClinicForm(false);
      toast({ title: "Clinic created", description: `${clinic.name} — QR page live at ${clinic.bookingUrl ?? ""}` });
    } catch (err: unknown) {
      toast({ title: "Error", description: (err as Error).message || "Failed to create clinic", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;
    setSaving(true);
    try {
      const doc = await api.post<Doctor>(`/api/clinics/${selectedClinic.id}/doctors`, doctorForm);
      setDoctors((p) => [...p, doc]);
      setDoctorForm(EMPTY_DOCTOR);
      setShowDoctorForm(false);
      toast({ title: "Doctor added", description: `${doc.name} — they can now sign in with Google using ${doc.email}` });
    } catch {
      toast({ title: "Error", description: "Failed to add doctor", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClinic) return;
    setSaving(true);
    try {
      const s = await api.post<Staff>(`/api/clinics/${selectedClinic.id}/staff`, staffForm);
      setStaff((p) => [...p, s]);
      setStaffForm(EMPTY_STAFF);
      setShowStaffForm(false);
      toast({ title: "Staff added", description: `${s.name} — they can sign in with Google using ${s.email}` });
    } catch {
      toast({ title: "Error", description: "Failed to add staff", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!" }); };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Platform Admin</h1>
          <p className="text-muted-foreground text-sm">Manage clinics, doctors and staff. Doctors sign in with Google.</p>
        </div>
        <Button onClick={() => setShowClinicForm(!showClinicForm)}>
          <Building2 className="mr-2 h-4 w-4" /> New Clinic
        </Button>
      </div>

      {showClinicForm && (
        <Card className="max-w-lg border-primary/30">
          <CardHeader><CardTitle className="text-base">Create Clinic</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreateClinic} className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinic Details</p>
                <div className="space-y-1.5">
                  <Label>Clinic Name *</Label>
                  <Input required value={clinicForm.name} onChange={(e) => setClinicForm({ ...clinicForm, name: e.target.value })} placeholder="City Medical Clinic" />
                </div>
                <div className="space-y-1.5">
                  <Label>Address</Label>
                  <Input value={clinicForm.address} onChange={(e) => setClinicForm({ ...clinicForm, address: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input value={clinicForm.phone} onChange={(e) => setClinicForm({ ...clinicForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                </div>
              </div>

              <div className="space-y-3 rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">First Doctor (required)</p>
                <p className="text-xs text-blue-600">Doctor will sign in with Google using this email — no password needed.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Doctor Name *</Label>
                    <Input required value={firstDoctorForm.name} onChange={(e) => setFirstDoctorForm({ ...firstDoctorForm, name: e.target.value })} placeholder="Dr. Ramesh Kumar" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Doctor Google Email *</Label>
                    <Input required type="email" value={firstDoctorForm.email} onChange={(e) => setFirstDoctorForm({ ...firstDoctorForm, email: e.target.value })} placeholder="doctor@gmail.com" />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Specialization</Label>
                    <Input value={firstDoctorForm.specialization} onChange={(e) => setFirstDoctorForm({ ...firstDoctorForm, specialization: e.target.value })} placeholder="General Medicine" />
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Clinic + Doctor"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowClinicForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {clinics.map((clinic) => (
          <Card key={clinic.id} className="overflow-hidden">
            <div className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50" onClick={() => loadClinic(clinic)}>
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-primary shrink-0" />
                <div>
                  <p className="font-semibold">{clinic.name}</p>
                  <p className="text-xs text-muted-foreground">{clinic.address}{clinic.phone ? ` · ${clinic.phone}` : ""}</p>
                  {clinic.slug && <p className="text-xs text-primary font-mono">/clinic/{clinic.slug}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {clinic.qrCodeUrl && <Badge variant="success"><QrCode className="h-3 w-3 mr-1" />QR Ready</Badge>}
                {selectedClinic?.id === clinic.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>

            {selectedClinic?.id === clinic.id && (
              <div className="border-t bg-gray-50 p-4 space-y-4">
                {/* QR + Booking URL */}
                {(clinic.qrCodeUrl || clinic.bookingUrl) && (
                  <div className="flex flex-wrap items-start gap-6">
                    {clinic.qrCodeUrl && (
                      <div>
                        <p className="text-xs font-medium mb-1.5">Patient QR Code</p>
                        <img src={clinic.qrCodeUrl} alt="QR" className="h-28 w-28 rounded border bg-white" />
                      </div>
                    )}
                    {clinic.bookingUrl && (
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-xs font-medium">Patient Booking URL</p>
                        <div className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-mono truncate flex-1">{clinic.bookingUrl}</span>
                          <button onClick={() => copy(clinic.bookingUrl!)} className="shrink-0">
                            <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </button>
                          <a href={clinic.bookingUrl} target="_blank" rel="noopener" className="shrink-0">
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                          </a>
                        </div>
                        <p className="text-xs text-muted-foreground">Share this link or print the QR code for the waiting room.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1 border-b">
                  {(["doctors", "staff"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-1.5 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                      {t} ({t === "doctors" ? doctors.length : staff.length})
                    </button>
                  ))}
                </div>

                {/* Doctors tab */}
                {tab === "doctors" && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setShowDoctorForm(!showDoctorForm)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Doctor
                      </Button>
                    </div>
                    {showDoctorForm && (
                      <form onSubmit={handleAddDoctor} className="rounded-lg border bg-white p-3 space-y-3">
                        <p className="text-xs text-muted-foreground">Doctor will sign in with Google using their email — no password needed.</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2 space-y-1"><Label className="text-xs">Name *</Label>
                            <Input required value={doctorForm.name} onChange={(e) => setDoctorForm({ ...doctorForm, name: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Google Email *</Label>
                            <Input required type="email" value={doctorForm.email} onChange={(e) => setDoctorForm({ ...doctorForm, email: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Specialization</Label>
                            <Input value={doctorForm.specialization} onChange={(e) => setDoctorForm({ ...doctorForm, specialization: e.target.value })} /></div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" type="submit" disabled={saving}>{saving ? "Adding…" : "Add Doctor"}</Button>
                          <Button size="sm" type="button" variant="outline" onClick={() => setShowDoctorForm(false)}>Cancel</Button>
                        </div>
                      </form>
                    )}
                    <div className="space-y-2">
                      {doctors.map((d) => (
                        <div key={d.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{d.name.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{d.name}</p>
                            <p className="text-xs text-muted-foreground">{d.email}{d.specialization ? ` · ${d.specialization}` : ""}</p>
                          </div>
                          <Badge variant={d.firebaseUid ? "success" : "outline"} className="shrink-0">
                            {d.firebaseUid ? "Linked" : "Pending login"}
                          </Badge>
                        </div>
                      ))}
                      {doctors.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No doctors yet.</p>}
                    </div>
                  </div>
                )}

                {/* Staff tab */}
                {tab === "staff" && (
                  <div className="space-y-3">
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => setShowStaffForm(!showStaffForm)}>
                        <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Staff
                      </Button>
                    </div>
                    {showStaffForm && (
                      <form onSubmit={handleAddStaff} className="rounded-lg border bg-white p-3 space-y-3">
                        <p className="text-xs text-muted-foreground">Staff will sign in with Google (read-only access).</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1"><Label className="text-xs">Name *</Label>
                            <Input required value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} /></div>
                          <div className="space-y-1"><Label className="text-xs">Google Email *</Label>
                            <Input required type="email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} /></div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" type="submit" disabled={saving}>{saving ? "Adding…" : "Add Staff"}</Button>
                          <Button size="sm" type="button" variant="outline" onClick={() => setShowStaffForm(false)}>Cancel</Button>
                        </div>
                      </form>
                    )}
                    <div className="space-y-2">
                      {staff.map((s) => (
                        <div key={s.id} className="flex items-center gap-3 rounded-lg border bg-white p-3">
                          <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">{s.name.charAt(0)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{s.name}</p>
                            <p className="text-xs text-muted-foreground">{s.email}</p>
                          </div>
                          <Badge variant="warning">Staff</Badge>
                          <Badge variant={s.firebaseUid ? "success" : "outline"} className="shrink-0">
                            {s.firebaseUid ? "Linked" : "Pending login"}
                          </Badge>
                        </div>
                      ))}
                      {staff.length === 0 && <p className="text-xs text-muted-foreground py-2 text-center">No staff yet.</p>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
        {clinics.length === 0 && (
          <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
            No clinics yet. Create your first clinic above.
          </div>
        )}
      </div>
    </div>
  );
}
