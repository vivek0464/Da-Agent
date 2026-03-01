"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "./auth-context";

export interface DoctorOption { id: string; name: string; specialization?: string; }

interface DoctorContextValue {
  selectedDoctorId: string;
  setSelectedDoctorId: (id: string) => void;
  clinicDoctors: DoctorOption[];
  selectedDoctor: DoctorOption | null;
}

const DoctorContext = createContext<DoctorContextValue>({
  selectedDoctorId: "",
  setSelectedDoctorId: () => {},
  clinicDoctors: [],
  selectedDoctor: null,
});

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function DoctorProvider({ children }: { children: ReactNode }) {
  const { clinicId, doctorId, user, role } = useAuth();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>("");
  const [clinicDoctors, setClinicDoctors] = useState<DoctorOption[]>([]);

  // Default selection = logged-in doctor
  useEffect(() => {
    if (doctorId) setSelectedDoctorId(doctorId);
  }, [doctorId]);

  // Load all doctors for this clinic (so we can offer a switcher)
  useEffect(() => {
    if (!clinicId || !user || role === "platform_admin") return;
    user.getIdToken().then((token) => {
      fetch(`${API}/api/clinics/${clinicId}/doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => r.json())
        .then((data: DoctorOption[]) => setClinicDoctors(Array.isArray(data) ? data : []))
        .catch(() => {});
    });
  }, [clinicId, user, role]);

  const selectedDoctor = clinicDoctors.find((d) => d.id === selectedDoctorId) ?? null;

  return (
    <DoctorContext.Provider value={{ selectedDoctorId, setSelectedDoctorId, clinicDoctors, selectedDoctor }}>
      {children}
    </DoctorContext.Provider>
  );
}

export function useDoctorContext() {
  return useContext(DoctorContext);
}
