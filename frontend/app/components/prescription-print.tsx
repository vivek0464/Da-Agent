"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { Prescription } from "@/app/(admin)/prescriptions/page";

interface Props {
  prescription: Prescription;
  onClose: () => void;
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  doctorName?: string;
  doctorSpecialization?: string;
}

export default function PrescriptionPrint({
  prescription, onClose,
  clinicName, clinicAddress, clinicPhone,
  doctorName, doctorSpecialization,
}: Props) {
  const { content, date, id } = prescription;
  const pi = content.patientInfo ?? {};

  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    const handleAfterPrint = () => onClose();
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [onClose]);

  return (
    <>
      <div className="print-only fixed inset-0 z-[200] overflow-auto bg-white p-8">
        <button
          onClick={onClose}
          className="no-print absolute right-4 top-4 rounded-full p-1.5 text-gray-500 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto max-w-[21cm] font-serif">

          {/* ── Clinic header ── */}
          <div className="mb-4 border-b-2 border-gray-800 pb-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900">{clinicName ?? "Clinic"}</h1>
            {(clinicAddress || clinicPhone) && (
              <p className="mt-0.5 text-sm text-gray-500">
                {[clinicAddress, clinicPhone].filter(Boolean).join("  |  ")}
              </p>
            )}
          </div>

          {/* ── Doctor + Rx meta row ── */}
          <div className="mb-4 flex items-start justify-between border-b pb-3">
            <div className="text-sm text-gray-700">
              <p className="font-semibold text-gray-900">
                Dr. {doctorName ?? "—"}
                {doctorSpecialization && (
                  <span className="ml-2 font-normal text-gray-500">({doctorSpecialization})</span>
                )}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500 space-y-0.5">
              <p><span className="font-medium text-gray-700">Rx #:</span> {id.slice(-8).toUpperCase()}</p>
              <p><span className="font-medium text-gray-700">Date:</span> {date}</p>
              <p><span className="font-medium text-gray-700">Status:</span> {prescription.status.toUpperCase()}</p>
            </div>
          </div>

          {/* ── Patient details ── */}
          <div className="mb-5 rounded border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm">
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gray-400">Patient</p>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-gray-800">
              <span><span className="font-medium">Name:</span> {pi.name ?? "—"}</span>
              {pi.age && <span><span className="font-medium">Age:</span> {pi.age} yrs</span>}
              {pi.gender && <span><span className="font-medium">Gender:</span> {pi.gender}</span>}
              {pi.phone && <span><span className="font-medium">Phone:</span> {pi.phone}</span>}
            </div>
          </div>

          {content.complaints.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-500">Chief Complaints</h2>
              <ul className="ml-4 list-disc text-gray-800">
                {content.complaints.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </section>
          )}

          {content.diagnosis.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-500">Diagnosis</h2>
              <ul className="ml-4 list-disc text-gray-800">
                {content.diagnosis.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
            </section>
          )}

          {content.medications.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-gray-500">℞ Medications</h2>
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="py-2 text-left font-semibold">Medicine</th>
                    <th className="py-2 text-left font-semibold">Dosage</th>
                    <th className="py-2 text-left font-semibold">Frequency</th>
                    <th className="py-2 text-left font-semibold">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {content.medications.map((m, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-2 font-medium">{m.name}</td>
                      <td className="py-2">{m.dosage}</td>
                      <td className="py-2">{m.frequency}</td>
                      <td className="py-2">{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {content.tests.length > 0 && (
            <section className="mb-5">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-500">Investigations</h2>
              <ul className="ml-4 list-disc text-gray-800">
                {content.tests.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </section>
          )}

          {content.followUp && (
            <section className="mb-5">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-500">Follow-up</h2>
              <p className="text-gray-800">{content.followUp}</p>
            </section>
          )}

          {content.notes && (
            <section className="mb-5">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-widest text-gray-500">Notes</h2>
              <p className="text-gray-800">{content.notes}</p>
            </section>
          )}

          <div className="mt-16 flex justify-end border-t pt-4">
            <div className="text-center">
              <div className="h-12" />
              <p className="text-sm font-semibold">Doctor&apos;s Signature</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
