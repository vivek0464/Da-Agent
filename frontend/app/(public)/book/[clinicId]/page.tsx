"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/app/components/ui/card";
import { Stethoscope, CheckCircle2, Clock, Calendar } from "lucide-react";
import { format } from "date-fns";

interface Doctor { id: string; name: string; specialization?: string; }
interface Clinic { id: string; name: string; address: string; phone: string; }
interface Appointment { id: string; queuePosition: number; estimatedTime: string; timeSlot: string; date: string; }

export default function BookingPage() {
  const { clinicId } = useParams<{ clinicId: string }>();
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [form, setForm] = useState({
    patientName: "",
    patientPhone: "",
    patientEmail: "",
    doctorId: "",
    date: format(new Date(), "yyyy-MM-dd"),
    timeSlot: "",
  });
  const [loading, setLoading] = useState(false);
  const [booked, setBooked] = useState<Appointment | null>(null);
  const [fetchingSlots, setFetchingSlots] = useState(false);

  useEffect(() => {
    if (!clinicId) return;
    api.get<Clinic>(`/api/clinics/${clinicId}`).then(setClinic).catch(() => {});
    api.get<Doctor[]>(`/api/clinics/${clinicId}/doctors`).then(setDoctors).catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    if (!form.doctorId || !form.date || !clinicId) return;
    setFetchingSlots(true);
    api.get<string[]>(
      `/api/clinics/${clinicId}/availability/slots?doctor_id=${form.doctorId}&date=${form.date}`
    )
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setFetchingSlots(false));
  }, [form.doctorId, form.date, clinicId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clinicId) return;
    setLoading(true);
    try {
      const appt = await api.post<Appointment>(`/api/clinics/${clinicId}/appointments/`, {
        ...form,
        clinicId,
      });
      setBooked(appt);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (booked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-md text-center shadow-xl">
          <CardContent className="pt-8 pb-6 space-y-4">
            <CheckCircle2 className="mx-auto h-16 w-16 text-green-500" />
            <h2 className="text-2xl font-bold text-green-800">Appointment Confirmed!</h2>
            <div className="rounded-lg bg-green-50 p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-green-600" />
                <span>{booked.date} at {booked.timeSlot}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-green-600" />
                <span>Queue #{booked.queuePosition} · {booked.estimatedTime}</span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              You will receive an SMS confirmation shortly.
            </p>
            <Button className="w-full" onClick={() => setBooked(null)}>
              Book Another Appointment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Stethoscope className="h-6 w-6 text-white" />
          </div>
          <CardTitle>{clinic?.name ?? "Book Appointment"}</CardTitle>
          {clinic?.address && (
            <CardDescription>{clinic.address}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                required
                placeholder="Your full name"
                value={form.patientName}
                onChange={(e) => setForm({ ...form, patientName: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mobile Number *</Label>
              <Input
                required
                type="tel"
                placeholder="+91 98765 43210"
                value={form.patientPhone}
                onChange={(e) => setForm({ ...form, patientPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email (optional)</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={form.patientEmail}
                onChange={(e) => setForm({ ...form, patientEmail: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Doctor *</Label>
              <select
                required
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.doctorId}
                onChange={(e) => setForm({ ...form, doctorId: e.target.value, timeSlot: "" })}
              >
                <option value="">Select a doctor…</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name}{d.specialization ? ` — ${d.specialization}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input
                required
                type="date"
                min={format(new Date(), "yyyy-MM-dd")}
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value, timeSlot: "" })}
              />
            </div>
            {form.doctorId && form.date && (
              <div className="space-y-1.5">
                <Label>Time Slot *</Label>
                {fetchingSlots ? (
                  <p className="text-sm text-muted-foreground">Loading available slots…</p>
                ) : slots.length === 0 ? (
                  <p className="text-sm text-amber-600">No slots available for this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setForm({ ...form, timeSlot: slot })}
                        className={`rounded-md border px-2 py-2 text-xs font-medium transition-colors ${
                          form.timeSlot === slot
                            ? "border-primary bg-primary text-white"
                            : "hover:border-primary hover:bg-primary/5"
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !form.timeSlot}
            >
              {loading ? "Booking…" : "Confirm Appointment"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
