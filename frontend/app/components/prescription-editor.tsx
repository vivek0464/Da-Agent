"use client";
import { useState, useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Textarea } from "@/app/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Plus, X, Save } from "lucide-react";
import type { Prescription, PrescriptionContent } from "@/app/(admin)/prescriptions/page";

interface Props {
  prescription: Prescription;
  onSave: (content: PrescriptionContent) => Promise<void>;
  readOnly?: boolean;
}

const EMPTY_MED = { name: "", dosage: "", frequency: "", duration: "" };

export default function PrescriptionEditor({ prescription, onSave, readOnly = false }: Props) {
  const [content, setContent] = useState<PrescriptionContent>(prescription.content);
  const [saving, setSaving] = useState(false);
  const [newMed, setNewMed] = useState(EMPTY_MED);
  const [complaint, setComplaint] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [test, setTest] = useState("");

  useEffect(() => {
    setContent(prescription.content);
  }, [prescription.id, prescription.updatedAt]);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(content); } finally { setSaving(false); }
  };

  const addComplaint = () => {
    if (!complaint.trim()) return;
    setContent((c) => ({ ...c, complaints: [...c.complaints, complaint.trim()] }));
    setComplaint("");
  };

  const addDiagnosis = () => {
    if (!diagnosis.trim()) return;
    setContent((c) => ({ ...c, diagnosis: [...c.diagnosis, diagnosis.trim()] }));
    setDiagnosis("");
  };

  const addMedication = () => {
    if (!newMed.name || !newMed.dosage) return;
    setContent((c) => ({ ...c, medications: [...c.medications, { ...newMed }] }));
    setNewMed(EMPTY_MED);
  };

  const addTest = () => {
    if (!test.trim()) return;
    setContent((c) => ({ ...c, tests: [...c.tests, test.trim()] }));
    setTest("");
  };

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Complaints / Symptoms</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {content.complaints.map((c, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800">
                {c}
                {!readOnly && (
                  <button onClick={() => setContent((ct) => ({ ...ct, complaints: ct.complaints.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Input
                placeholder="Add complaint…"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addComplaint())}
              />
              <Button type="button" size="sm" onClick={addComplaint}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Diagnosis</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {content.diagnosis.map((d, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-800">
                {d}
                {!readOnly && (
                  <button onClick={() => setContent((ct) => ({ ...ct, diagnosis: ct.diagnosis.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Input
                placeholder="Add diagnosis…"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addDiagnosis())}
              />
              <Button type="button" size="sm" onClick={addDiagnosis}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Medications</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {content.medications.length > 0 && (
            <div className="divide-y rounded-lg border">
              {content.medications.map((m, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2">
                  <div>
                    <span className="font-medium text-sm">{m.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{m.dosage} — {m.frequency} for {m.duration}</span>
                  </div>
                  {!readOnly && (
                    <button onClick={() => setContent((c) => ({ ...c, medications: c.medications.filter((_, j) => j !== i) }))}>
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {!readOnly && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Drug name *" value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} className="col-span-2" />
              <Input placeholder="Dosage (e.g. 500mg)" value={newMed.dosage} onChange={(e) => setNewMed({ ...newMed, dosage: e.target.value })} />
              <Input placeholder="Frequency (e.g. TID)" value={newMed.frequency} onChange={(e) => setNewMed({ ...newMed, frequency: e.target.value })} />
              <Input placeholder="Duration (e.g. 5 days)" value={newMed.duration} onChange={(e) => setNewMed({ ...newMed, duration: e.target.value })} />
              <Button type="button" size="sm" onClick={addMedication} className="col-span-1">
                <Plus className="mr-1.5 h-4 w-4" /> Add Medication
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tests Ordered</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {content.tests.map((t, i) => (
              <span key={i} className="flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1 text-sm text-orange-800">
                {t}
                {!readOnly && (
                  <button onClick={() => setContent((c) => ({ ...c, tests: c.tests.filter((_, j) => j !== i) }))}>
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {!readOnly && (
            <div className="flex gap-2">
              <Input
                placeholder="Add test (e.g. CBC, CRP)…"
                value={test}
                onChange={(e) => setTest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTest())}
              />
              <Button type="button" size="sm" onClick={addTest}><Plus className="h-4 w-4" /></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Follow-up &amp; Notes</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4">
          <div className="space-y-1.5">
            <Label>Follow-up Instructions</Label>
            <Input
              placeholder="e.g. Review after 5 days"
              value={content.followUp}
              onChange={(e) => setContent((c) => ({ ...c, followUp: e.target.value }))}
              readOnly={readOnly}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Additional Notes</Label>
            <Textarea
              placeholder="Any additional clinical notes…"
              value={content.notes}
              onChange={(e) => setContent((c) => ({ ...c, notes: e.target.value }))}
              readOnly={readOnly}
              rows={3}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
