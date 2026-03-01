"use client";
import { useEffect, useState, useCallback } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/lib/auth-context";
import { useDoctorContext } from "@/app/lib/doctor-context";
import { api } from "@/app/lib/api";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Badge } from "@/app/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronRight, CalendarPlus, Trash2, IndianRupee } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/app/components/ui/toaster";

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  timeSlot: string;
  status: string;
  queuePosition: number;
  estimatedTime: string;
  doctorId: string;
  date: string;
  paymentStatus: string;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function SortableItem({
  appt, waitMins, onStatusChange, onPaymentToggle, onRemove, isStaff,
}: {
  appt: Appointment;
  waitMins: number;
  onStatusChange: (id: string, status: string) => void;
  onPaymentToggle: (id: string, current: string) => void;
  onRemove: (id: string) => void;
  isStaff: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: appt.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const nextStatus: Record<string, string> = {
    scheduled: "in-progress",
    "in-progress": "completed",
  };

  const isPaid = appt.paymentStatus === "paid";
  const waitLabel = waitMins === 0 ? "Now" : `~${waitMins}m wait`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg border bg-white p-3 shadow-sm"
    >
      <button className="cursor-grab text-gray-400 hover:text-gray-600" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </button>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        #{appt.queuePosition}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{appt.patientName}</p>
        <p className="text-xs text-muted-foreground">{appt.patientPhone} · <span className="text-primary font-medium">{waitLabel}</span></p>
      </div>
      {/* Paid / Unpaid toggle */}
      <button
        onClick={() => onPaymentToggle(appt.id, appt.paymentStatus)}
        title={isPaid ? "Mark as Unpaid" : "Mark as Paid"}
        className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
          isPaid
            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            : "bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
        }`}
      >
        <IndianRupee className="h-3 w-3" />
        {isPaid ? "Paid" : "Unpaid"}
      </button>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-800"}`}>
        {appt.status}
      </span>
      {nextStatus[appt.status] && (
        <Button size="sm" variant="outline" onClick={() => onStatusChange(appt.id, nextStatus[appt.status])}>
          <ChevronRight className="h-3 w-3 mr-1" />
          {nextStatus[appt.status] === "in-progress" ? "Start" : "Done"}
        </Button>
      )}
      {appt.status === "scheduled" && !isStaff && (
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onStatusChange(appt.id, "cancelled")}>
          Cancel
        </Button>
      )}
      {!isStaff && (
        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-600" title="Remove from queue" onClick={() => onRemove(appt.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

export default function AppointmentsPage() {
  const { clinicId, role } = useAuth();
  const { selectedDoctorId, selectedDoctor } = useDoctorContext();
  const isStaff = role === "staff";
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (!clinicId || !db) return;
    const q = query(collection(db, "clinics", clinicId, "appointments"), where("date", "==", date));
    return onSnapshot(q, (snap) => {
      let data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Appointment));
      if (selectedDoctorId) data = data.filter((a) => a.doctorId === selectedDoctorId);
      setAppointments(data.sort((a, b) => a.queuePosition - b.queuePosition));
    });
  }, [clinicId, date, selectedDoctorId]);

  const handleStatusChange = useCallback(async (id: string, status: string) => {
    if (!clinicId) return;
    try {
      await api.patch(`/api/clinics/${clinicId}/appointments/${id}`, { status });
      toast({ title: "Updated", description: `Appointment marked as ${status}` });
    } catch {
      toast({ title: "Error", description: "Failed to update status", variant: "destructive" });
    }
  }, [clinicId]);

  const handlePaymentToggle = useCallback(async (id: string, current: string) => {
    if (!clinicId) return;
    const paymentStatus = current === "paid" ? "unpaid" : "paid";
    try {
      await api.patch(`/api/clinics/${clinicId}/appointments/${id}`, { paymentStatus });
    } catch {
      toast({ title: "Error", description: "Failed to update payment status", variant: "destructive" });
    }
  }, [clinicId]);

  const handleRemove = useCallback(async (id: string) => {
    if (!clinicId) return;
    if (!confirm("Remove this patient from the queue? (The patient record will not be deleted.)")) return;
    try {
      await api.delete(`/api/clinics/${clinicId}/appointments/${id}`);
      toast({ title: "Removed", description: "Patient removed from queue." });
    } catch {
      toast({ title: "Error", description: "Failed to remove from queue", variant: "destructive" });
    }
  }, [clinicId]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !clinicId) return;

    const oldIndex = appointments.findIndex((a) => a.id === active.id);
    const newIndex = appointments.findIndex((a) => a.id === over.id);
    const reordered = arrayMove(appointments, oldIndex, newIndex);
    setAppointments(reordered);

    try {
      await api.post(`/api/clinics/${clinicId}/appointments/reorder?date=${date}`, {
        orderedIds: reordered.map((a) => a.id),
      });
    } catch {
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
    }
  }, [appointments, clinicId, date]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-muted-foreground">Drag to reorder the queue</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5" />
            Queue for {date} ({appointments.length} appointments)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">No appointments for this date.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={appointments.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {appointments.map((appt, idx) => {
                    const ahead = appointments.slice(0, idx).filter((a) => a.status !== "completed" && a.status !== "cancelled").length;
                    const waitMins = ahead * 5;
                    return (
                      <SortableItem key={appt.id} appt={appt} waitMins={waitMins}
                        onStatusChange={handleStatusChange}
                        onPaymentToggle={handlePaymentToggle}
                        onRemove={handleRemove}
                        isStaff={isStaff}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
