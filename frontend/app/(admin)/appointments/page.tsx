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
import { GripVertical, ChevronRight, CalendarPlus, Trash2 } from "lucide-react";
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
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-yellow-100 text-yellow-800",
  "in-progress": "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function SortableItem({ appt, onStatusChange, onRemove }: { appt: Appointment; onStatusChange: (id: string, status: string) => void; onRemove: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: appt.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const nextStatus: Record<string, string> = {
    scheduled: "in-progress",
    "in-progress": "completed",
  };

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
        <p className="text-xs text-muted-foreground">{appt.timeSlot} · {appt.patientPhone}</p>
      </div>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-800"}`}>
        {appt.status}
      </span>
      {nextStatus[appt.status] && (
        <Button size="sm" variant="outline" onClick={() => onStatusChange(appt.id, nextStatus[appt.status])}>
          <ChevronRight className="h-3 w-3 mr-1" />
          {nextStatus[appt.status] === "in-progress" ? "Start" : "Done"}
        </Button>
      )}
      {appt.status === "scheduled" && (
        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => onStatusChange(appt.id, "cancelled")}>
          Cancel
        </Button>
      )}
      <Button size="sm" variant="ghost" className="text-gray-400 hover:text-red-600" title="Remove from queue" onClick={() => onRemove(appt.id)}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export default function AppointmentsPage() {
  const { clinicId } = useAuth();
  const { selectedDoctorId, selectedDoctor } = useDoctorContext();
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
                  {appointments.map((appt) => (
                    <SortableItem key={appt.id} appt={appt} onStatusChange={handleStatusChange} onRemove={handleRemove} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
