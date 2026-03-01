"use client";
import { useEffect, useState, useCallback } from "react";
import { addDays, format, startOfWeek, isSameDay } from "date-fns";
import { useAuth } from "@/app/lib/auth-context";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { toast } from "@/app/components/ui/toaster";
import { ChevronLeft, ChevronRight, Plus, Trash2, Clock, RefreshCw, RotateCcw, UserPlus, Users, CalendarDays, Eye, EyeOff, Copy } from "lucide-react";

interface TimeSlot { start: string; end: string; }
interface DayEntry { slots: TimeSlot[]; isRecurring: boolean; }
interface Doctor { id: string; name: string; email: string; phone: string; specialization?: string; firebaseUid?: string; }
interface Staff { id: string; name: string; email: string; phone: string; firebaseUid?: string; }

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOW_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DEFAULT_SLOT: TimeSlot = { start: "09:00", end: "17:00" };
type Tab = "schedule" | "doctors" | "staff";

export default function ClinicAdminPage() {
  const { clinicId, doctorId } = useAuth();
  const [tab, setTab] = useState<Tab>("schedule");

  // ── Doctors ────────────────────────────────────────────────────────────────
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [doctorForm, setDoctorForm] = useState({ name: "", email: "", phone: "", specialization: "", password: "" });
  const [showDoctorPwd, setShowDoctorPwd] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);

  // ── Staff ──────────────────────────────────────────────────────────────────
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffForm, setStaffForm] = useState({ name: "", email: "", phone: "" });
  const [savingStaff, setSavingStaff] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string } | null>(null);

  const fetchDoctors = useCallback(async () => {
    if (!clinicId) return;
    try { setDoctors(await api.get<Doctor[]>(`/api/clinics/${clinicId}/doctors`)); } catch { /* ignore */ }
  }, [clinicId]);

  const fetchStaff = useCallback(async () => {
    if (!clinicId) return;
    try { setStaffList(await api.get<Staff[]>(`/api/clinics/${clinicId}/staff`)); } catch { /* ignore */ }
  }, [clinicId]);

  useEffect(() => { fetchDoctors(); fetchStaff(); }, [fetchDoctors, fetchStaff]);

  const handleAddDoctor = async () => {
    if (!clinicId || !doctorForm.name || !doctorForm.email || !doctorForm.phone) {
      toast({ title: "Missing fields", description: "Name, email and phone are required.", variant: "destructive" }); return;
    }
    setSavingDoctor(true);
    try {
      const res = await api.post<Doctor & { tempPassword?: string }>(`/api/clinics/${clinicId}/doctors`, doctorForm);
      setDoctors((prev) => [...prev, res]);
      if (res.tempPassword) setCreatedCreds({ email: doctorForm.email, password: res.tempPassword });
      setDoctorForm({ name: "", email: "", phone: "", specialization: "", password: "" });
      setAddingDoctor(false);
      toast({ title: "Doctor added", description: `${res.name} created.` });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message || "Failed to add doctor", variant: "destructive" });
    } finally { setSavingDoctor(false); }
  };

  const handleAddStaff = async () => {
    if (!clinicId || !staffForm.name || !staffForm.email || !staffForm.phone) {
      toast({ title: "Missing fields", description: "Name, email and phone are required.", variant: "destructive" }); return;
    }
    setSavingStaff(true);
    try {
      const res = await api.post<Staff & { tempPassword?: string }>(`/api/clinics/${clinicId}/staff`, staffForm);
      setStaffList((prev) => [...prev, res]);
      if (res.tempPassword) setCreatedCreds({ email: staffForm.email, password: res.tempPassword });
      setStaffForm({ name: "", email: "", phone: "" });
      setAddingStaff(false);
      toast({ title: "Staff added", description: `${res.name} created with read-only access.` });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message || "Failed to add staff", variant: "destructive" });
    } finally { setSavingStaff(false); }
  };

  // ── Schedule ───────────────────────────────────────────────────────────────
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  // week-view: date string → {slots, isRecurring}
  const [weekData, setWeekData] = useState<Record<string, DayEntry>>({});
  // recurring schedule: dayOfWeek (0-6) → slots
  const [recurring, setRecurring] = useState<Record<number, TimeSlot[]>>({});
  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savingDow, setSavingDow] = useState<number | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Load recurring schedule (day-of-week entries)
  const fetchRecurring = useCallback(async () => {
    if (!clinicId || !doctorId) return;
    try {
      const data = await api.get<{ recurring: boolean; dayOfWeek: number; slots: TimeSlot[] }[]>(
        `/api/clinics/${clinicId}/availability/?doctor_id=${doctorId}`
      );
      const rec: Record<number, TimeSlot[]> = {};
      data.filter((e) => e.recurring).forEach((e) => { rec[e.dayOfWeek] = e.slots; });
      setRecurring(rec);
    } catch { /* no recurring set yet */ }
  }, [clinicId, doctorId]);

  // Load week-specific availability; fall back to recurring for days without override
  const fetchWeek = useCallback(async () => {
    if (!clinicId || !doctorId) return;
    const results: Record<string, DayEntry> = {};
    await Promise.all(
      weekDays.map(async (day) => {
        const date = format(day, "yyyy-MM-dd");
        const dow = (day.getDay() + 6) % 7; // convert JS 0=Sun to 0=Mon
        try {
          const data = await api.get<{ slots: TimeSlot[]; recurring: boolean }[]>(
            `/api/clinics/${clinicId}/availability/?doctor_id=${doctorId}&date=${date}`
          );
          const specific = data.find((e) => !e.recurring);
          if (specific) {
            results[date] = { slots: specific.slots, isRecurring: false };
          } else {
            // fall back to recurring schedule for this day-of-week
            const recSlots = recurring[dow] ?? [];
            results[date] = { slots: [...recSlots], isRecurring: recSlots.length > 0 };
          }
        } catch {
          results[date] = { slots: [...(recurring[dow] ?? [])], isRecurring: false };
        }
      })
    );
    setWeekData(results);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId, doctorId, weekStart, recurring]);

  useEffect(() => { fetchRecurring(); }, [fetchRecurring]);
  useEffect(() => { fetchWeek(); }, [fetchWeek]);

  // ── Recurring schedule helpers ──────────────────────────────────────────────
  const addRecurringSlot = (dow: number) =>
    setRecurring((prev) => ({ ...prev, [dow]: [...(prev[dow] ?? []), { ...DEFAULT_SLOT }] }));

  const removeRecurringSlot = (dow: number, idx: number) =>
    setRecurring((prev) => ({ ...prev, [dow]: prev[dow].filter((_, i) => i !== idx) }));

  const updateRecurringSlot = (dow: number, idx: number, field: "start" | "end", val: string) =>
    setRecurring((prev) => ({
      ...prev,
      [dow]: prev[dow].map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
    }));

  const saveRecurring = async (dow: number) => {
    if (!clinicId || !doctorId) return;
    setSavingDow(dow);
    // Use a placeholder date; backend identifies by doctorId+recurring+dayOfWeek
    const placeholderDate = format(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), dow), "yyyy-MM-dd");
    try {
      await api.post(`/api/clinics/${clinicId}/availability/`, {
        clinicId, doctorId,
        date: placeholderDate,
        slots: recurring[dow] ?? [],
        recurring: true,
        dayOfWeek: dow,
      });
      toast({ title: "Recurring schedule saved", description: `${DOW_LABELS[dow]} default updated.` });
      // Refresh week to reflect new recurring defaults
      fetchWeek();
    } catch {
      toast({ title: "Error", description: "Failed to save recurring schedule", variant: "destructive" });
    } finally { setSavingDow(null); }
  };

  // ── Week-specific helpers ───────────────────────────────────────────────────
  const addSlot = (date: string) =>
    setWeekData((prev) => ({
      ...prev,
      [date]: { slots: [...(prev[date]?.slots ?? []), { ...DEFAULT_SLOT }], isRecurring: false },
    }));

  const removeSlot = (date: string, idx: number) =>
    setWeekData((prev) => ({
      ...prev,
      [date]: { ...prev[date], slots: prev[date].slots.filter((_, i) => i !== idx), isRecurring: false },
    }));

  const updateSlot = (date: string, idx: number, field: "start" | "end", val: string) =>
    setWeekData((prev) => ({
      ...prev,
      [date]: {
        ...prev[date],
        slots: prev[date].slots.map((s, i) => (i === idx ? { ...s, [field]: val } : s)),
        isRecurring: false,
      },
    }));

  const resetToRecurring = (date: string, dow: number) =>
    setWeekData((prev) => ({
      ...prev,
      [date]: { slots: [...(recurring[dow] ?? [])], isRecurring: true },
    }));

  const saveDay = async (date: string) => {
    if (!clinicId || !doctorId) return;
    setSavingDate(date);
    try {
      await api.post(`/api/clinics/${clinicId}/availability/`, {
        clinicId, doctorId, date,
        slots: weekData[date]?.slots ?? [],
        recurring: false,
      });
      setWeekData((prev) => ({ ...prev, [date]: { ...prev[date], isRecurring: false } }));
      toast({ title: "Saved", description: `Availability for ${date} saved.` });
    } catch {
      toast({ title: "Error", description: "Failed to save", variant: "destructive" });
    } finally { setSavingDate(null); }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Clinic Admin</h1>
        <p className="text-muted-foreground text-sm">Manage doctors, staff, and availability schedule.</p>
      </div>

      {/* Credentials modal */}
      {createdCreds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-sm mx-4">
            <CardHeader><CardTitle className="text-base">Login Credentials</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">Share these credentials with the new user. They can change the password after logging in.</p>
              <div className="rounded-md bg-muted p-3 font-mono text-sm space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{createdCreds.email}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Password:</span>
                  <span className="font-medium">{createdCreds.password}</span>
                </div>
              </div>
              <Button size="sm" className="w-full" onClick={() => {
                navigator.clipboard.writeText(`Email: ${createdCreds.email}\nPassword: ${createdCreds.password}`);
                toast({ title: "Copied to clipboard" });
              }}>
                <Copy className="h-3.5 w-3.5 mr-1.5" />Copy credentials
              </Button>
              <Button size="sm" variant="outline" className="w-full" onClick={() => setCreatedCreds(null)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {(["schedule", "doctors", "staff"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "schedule" && <CalendarDays className="h-3.5 w-3.5" />}
            {t === "doctors" && <Users className="h-3.5 w-3.5" />}
            {t === "staff" && <UserPlus className="h-3.5 w-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* ── Doctors Tab ─────────────────────────────────────────────────────── */}
      {tab === "doctors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{doctors.length} doctor(s) in this clinic</p>
            <Button size="sm" onClick={() => setAddingDoctor(true)} disabled={addingDoctor}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Doctor
            </Button>
          </div>

          {addingDoctor && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">New Doctor</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <Input placeholder="Dr. Ramesh Kumar" value={doctorForm.name} onChange={(e) => setDoctorForm(f => ({...f, name: e.target.value}))} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                    <Input type="email" placeholder="doctor@clinic.com" value={doctorForm.email} onChange={(e) => setDoctorForm(f => ({...f, email: e.target.value}))} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                    <Input placeholder="+91 98765 43210" value={doctorForm.phone} onChange={(e) => setDoctorForm(f => ({...f, phone: e.target.value}))} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Specialization</label>
                    <Input placeholder="General Physician" value={doctorForm.specialization} onChange={(e) => setDoctorForm(f => ({...f, specialization: e.target.value}))} /></div>
                  <div className="col-span-2"><label className="text-xs text-muted-foreground mb-1 block">Password (optional — auto-generated if blank)</label>
                    <div className="relative">
                      <Input type={showDoctorPwd ? "text" : "password"} placeholder="Leave blank to auto-generate" value={doctorForm.password} onChange={(e) => setDoctorForm(f => ({...f, password: e.target.value}))} />
                      <button onClick={() => setShowDoctorPwd(p => !p)} className="absolute right-2 top-2.5 text-muted-foreground">
                        {showDoctorPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddDoctor} disabled={savingDoctor}>{savingDoctor ? "Adding…" : "Add Doctor"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingDoctor(false); setDoctorForm({ name: "", email: "", phone: "", specialization: "", password: "" }); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {doctors.map((d) => (
              <Card key={d.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.email} · {d.phone}</p>
                  {d.specialization && <p className="text-xs text-muted-foreground">{d.specialization}</p>}
                </div>
                <Badge variant={d.firebaseUid ? "success" : "warning"} className="text-xs shrink-0">
                  {d.firebaseUid ? "Active" : "No login"}
                </Badge>
              </Card>
            ))}
            {doctors.length === 0 && !addingDoctor && (
              <p className="text-sm text-muted-foreground text-center py-8">No doctors added yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Staff Tab ────────────────────────────────────────────────────────── */}
      {tab === "staff" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{staffList.length} staff member(s) · read-only access</p>
            <Button size="sm" onClick={() => setAddingStaff(true)} disabled={addingStaff}>
              <Plus className="h-3.5 w-3.5 mr-1" />Add Staff
            </Button>
          </div>

          {addingStaff && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">New Staff Member</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Staff can view all clinic data but cannot make any updates.</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                    <Input placeholder="Priya Sharma" value={staffForm.name} onChange={(e) => setStaffForm(f => ({...f, name: e.target.value}))} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Email *</label>
                    <Input type="email" placeholder="staff@clinic.com" value={staffForm.email} onChange={(e) => setStaffForm(f => ({...f, email: e.target.value}))} /></div>
                  <div><label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                    <Input placeholder="+91 98765 43210" value={staffForm.phone} onChange={(e) => setStaffForm(f => ({...f, phone: e.target.value}))} /></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddStaff} disabled={savingStaff}>{savingStaff ? "Adding…" : "Add Staff"}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setAddingStaff(false); setStaffForm({ name: "", email: "", phone: "" }); }}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {staffList.map((s) => (
              <Card key={s.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.email} · {s.phone}</p>
                </div>
                <Badge variant="secondary" className="text-xs shrink-0">Read-only</Badge>
                <Badge variant={s.firebaseUid ? "success" : "warning"} className="text-xs shrink-0">
                  {s.firebaseUid ? "Active" : "No login"}
                </Badge>
              </Card>
            ))}
            {staffList.length === 0 && !addingStaff && (
              <p className="text-sm text-muted-foreground text-center py-8">No staff members added yet.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Schedule Tab ─────────────────────────────────────────────────────── */}
      {tab === "schedule" && <div className="space-y-8">

      {/* ── Recurring Schedule ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4 text-primary" />
            Recurring Weekly Schedule
            <span className="text-xs font-normal text-muted-foreground ml-1">— default hours for each day of week</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
            {DOW_LABELS.map((_label, dow) => (
              <div key={dow} className="rounded-lg border bg-muted/30 p-3 space-y-2 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{WEEKDAYS[dow]}</p>
                {(recurring[dow] ?? []).length === 0 ? (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Off
                  </p>
                ) : (
                  (recurring[dow] ?? []).map((slot, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center gap-1">
                        <Input type="time" value={slot.start}
                          onChange={(e) => updateRecurringSlot(dow, idx, "start", e.target.value)}
                          className="h-7 text-xs px-2 min-w-0" />
                        <button onClick={() => removeRecurringSlot(dow, idx)}
                          className="text-red-400 hover:text-red-600 shrink-0 ml-auto">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                      <Input type="time" value={slot.end}
                        onChange={(e) => updateRecurringSlot(dow, idx, "end", e.target.value)}
                        className="h-7 text-xs px-2" />
                    </div>
                  ))
                )}
                <div className="flex gap-1 pt-1">
                  <Button size="sm" variant="ghost" className="h-6 flex-1 text-xs px-1"
                    onClick={() => addRecurringSlot(dow)}>
                    <Plus className="h-3 w-3 mr-0.5" />Add
                  </Button>
                  <Button size="sm" variant="outline" className="h-6 flex-1 text-xs px-1"
                    disabled={savingDow === dow} onClick={() => saveRecurring(dow)}>
                    {savingDow === dow ? "…" : "Save"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Week View ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Weekly Schedule</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekStart((d) => addDays(d, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[200px] text-center">
              {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              This Week
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {weekDays.map((day) => {
            const date = format(day, "yyyy-MM-dd");
            const dow = (day.getDay() + 6) % 7;
            const isToday = isSameDay(day, new Date());
            const entry = weekData[date] ?? { slots: [], isRecurring: false };
            const hasRecurring = (recurring[dow] ?? []).length > 0;

            return (
              <Card key={date} className={isToday ? "border-primary shadow-md" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className={`font-semibold ${isToday ? "text-primary" : ""}`}>
                      {WEEKDAYS[dow]} {format(day, "MMM d")}
                      {isToday && <span className="ml-1 text-[10px] bg-primary text-white rounded px-1">Today</span>}
                      {entry.isRecurring && (
                        <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 rounded px-1">recurring</span>
                      )}
                    </span>
                    <div className="flex gap-1">
                      {hasRecurring && !entry.isRecurring && (
                        <button title="Reset to recurring" onClick={() => resetToRecurring(date, dow)}
                          className="text-muted-foreground hover:text-primary">
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => addSlot(date)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {entry.slots.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" /> No hours set
                    </p>
                  ) : (
                    entry.slots.map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-1">
                        <Input type="time" value={slot.start}
                          onChange={(e) => updateSlot(date, idx, "start", e.target.value)}
                          className="h-7 text-xs px-2" />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input type="time" value={slot.end}
                          onChange={(e) => updateSlot(date, idx, "end", e.target.value)}
                          className="h-7 text-xs px-2" />
                        <button onClick={() => removeSlot(date, idx)} className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs mt-1"
                    disabled={savingDate === date} onClick={() => saveDay(date)}>
                    {savingDate === date ? "Saving…" : "Save for this date"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      </div>}
    </div>
  );
}
