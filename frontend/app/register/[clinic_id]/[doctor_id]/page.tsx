"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Stethoscope, CheckCircle2, Loader2 } from "lucide-react";

interface ClinicInfo {
  clinicName: string;
  doctorName: string;
  doctorSpecialization?: string;
}

type Step = "form" | "submitting" | "success" | "error";

export default function RegisterPage() {
  const params = useParams<{ clinic_id: string; doctor_id: string }>();
  const { clinic_id, doctor_id } = params;

  const [info, setInfo] = useState<ClinicInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [step, setStep] = useState<Step>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [patientName, setPatientName] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
    age: "",
    gender: "",
  });

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/api/register/${clinic_id}/${doctor_id}`);
        if (!res.ok) throw new Error("Clinic or doctor not found");
        setInfo(await res.json());
      } catch {
        setErrorMsg("This registration link is invalid or expired.");
        setStep("error");
      } finally {
        setLoadingInfo(false);
      }
    };
    load();
  }, [clinic_id, doctor_id, apiBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setStep("submitting");
    try {
      const body: Record<string, string | number> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      if (form.age) body.age = parseInt(form.age, 10);
      if (form.gender) body.gender = form.gender;

      const res = await fetch(`${apiBase}/api/register/${clinic_id}/${doctor_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Registration failed");
      }
      const data = await res.json();
      setQueuePosition(data.queuePosition ?? null);
      setPatientName(form.name.trim());
      setStep("success");
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "Something went wrong. Please try again.");
      setStep("error");
    }
  };

  if (loadingInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Clinic header */}
        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Stethoscope className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold text-primary">Dia</span>
          </div>
          {info && (
            <>
              <h1 className="text-2xl font-bold">{info.clinicName}</h1>
              <p className="text-muted-foreground text-sm">
                Dr. {info.doctorName}
                {info.doctorSpecialization && ` · ${info.doctorSpecialization}`}
              </p>
            </>
          )}
        </div>

        {/* Success state */}
        {step === "success" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold text-green-800">You&apos;re registered!</h2>
              <p className="text-green-700">
                Welcome, <span className="font-medium">{patientName}</span>!
              </p>
              {queuePosition && (
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <p className="text-sm text-muted-foreground">Your queue position</p>
                  <p className="text-3xl font-bold text-primary">#{queuePosition}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated wait: ~{queuePosition * 15} minutes
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Please wait to be called. You may close this page.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {step === "error" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center space-y-3">
              <p className="text-red-700 font-medium">{errorMsg}</p>
              {errorMsg.includes("invalid") ? null : (
                <Button variant="outline" size="sm" onClick={() => setStep("form")}>
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Registration form */}
        {(step === "form" || step === "submitting") && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Register for Today&apos;s Queue</CardTitle>
              <p className="text-xs text-muted-foreground">
                Fill in your details to join the queue. Name and phone are required.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="Ramesh Kumar"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    required
                    disabled={step === "submitting"}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    required
                    disabled={step === "submitting"}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Age</label>
                    <Input
                      type="number"
                      placeholder="35"
                      min={0}
                      max={120}
                      value={form.age}
                      onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                      disabled={step === "submitting"}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Gender</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                      disabled={step === "submitting"}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={step === "submitting" || !form.name.trim() || !form.phone.trim()}
                >
                  {step === "submitting" ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering…</>
                  ) : (
                    "Join Queue"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
