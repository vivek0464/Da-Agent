"use client";
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/auth-context";
import { api } from "@/app/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { CalendarClock, Users, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  timeSlot: string;
  status: string;
  queuePosition: number;
  estimatedTime: string;
  doctorId: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  scheduled: { label: "Waiting", variant: "warning" },
  "in-progress": { label: "In Progress", variant: "default" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export default function DashboardPage() {
  const { clinicId } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clinicName, setClinicName] = useState<string | null>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    if (!clinicId) return;
    api.get<{ name: string }>(`/api/clinics/${clinicId}`)
      .then((c) => setClinicName(c.name))
      .catch(() => {});
  }, [clinicId]);

  useEffect(() => {
    if (!clinicId || !db) return;

    const q = query(
      collection(db, "clinics", clinicId, "appointments"),
      where("date", "==", today)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Appointment))
        .sort((a, b) => a.queuePosition - b.queuePosition);
      setAppointments(data);
    });

    return unsub;
  }, [clinicId, today]);

  const stats = {
    total: appointments.length,
    waiting: appointments.filter((a) => a.status === "scheduled").length,
    inProgress: appointments.filter((a) => a.status === "in-progress").length,
    completed: appointments.filter((a) => a.status === "completed").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          {clinicName && <p className="text-sm text-muted-foreground">{clinicName}</p>}
        </div>
        <div className="flex items-center gap-2 rounded-lg border bg-white px-4 py-2 shadow-sm">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{format(new Date(), "EEEE, MMMM d, yyyy")}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Today</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Waiting</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.waiting}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Live Queue — {today}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No appointments scheduled for today.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((appt) => {
                const cfg = STATUS_CONFIG[appt.status] ?? { label: appt.status, variant: "outline" as const };
                return (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        #{appt.queuePosition}
                      </span>
                      <div>
                        <p className="font-medium">{appt.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {appt.timeSlot} · {appt.patientPhone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{appt.estimatedTime}</span>
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
