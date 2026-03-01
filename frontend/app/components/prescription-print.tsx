"use client";
import { useEffect } from "react";
import { X } from "lucide-react";
import type { Prescription } from "@/app/(admin)/prescriptions/page";

interface Props {
  prescription: Prescription;
  onClose: () => void;
}

export default function PrescriptionPrint({ prescription, onClose }: Props) {
  const { content, date, id } = prescription;

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
          <div className="mb-6 border-b-2 border-gray-800 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">Medical Prescription</h1>
            <div className="mt-1 flex gap-6 text-sm text-gray-600">
              <span>Rx ID: {id.slice(-8).toUpperCase()}</span>
              <span>Date: {date}</span>
              <span>Status: {prescription.status.toUpperCase()}</span>
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
