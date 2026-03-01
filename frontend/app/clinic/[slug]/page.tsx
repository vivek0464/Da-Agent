"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { format, addDays } from "date-fns";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/card";
import { Stethoscope, CheckCircle2, Loader2, MapPin, Phone, ChevronRight } from "lucide-react";

interface DoctorInfo { id: string; name: string; specialization?: string; }
interface ClinicInfo {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  doctors: DoctorInfo[];
}

type Step = "select-doctor" | "form" | "submitting" | "success" | "error";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// Build next 7 selectable dates (today + 6)
const DATES = Array.from({ length: 7 }, (_, i) => {
  const d = addDays(new Date(), i);
  return { value: format(d, "yyyy-MM-dd"), label: i === 0 ? "Today" : format(d, "EEE, MMM d") };
});

export default function ClinicPage() {
  const { slug } = useParams<{ slug: string }>();
  const [info, setInfo] = useState<ClinicInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [step, setStep] = useState<Step>("select-doctor");
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedDoctor, setSelectedDoctor] = useState<DoctorInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState(DATES[0].value);
  const [form, setForm] = useState({ name: "", phone: "", age: "", gender: "" });
  const [result, setResult] = useState<{ name: string; doctor: string; queue: number | null; date: string; estimatedTime?: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API}/api/register/clinic/${slug}`);
        if (!res.ok) throw new Error("Clinic not found");
        setInfo(await res.json());
      } catch {
        setErrorMsg("This clinic page is unavailable or does not exist.");
        setStep("error");
      } finally {
        setLoadingInfo(false);
      }
    };
    load();
  }, [slug]);

  const handleDoctorSelect = (doc: DoctorInfo) => {
    setSelectedDoctor(doc);
    setStep("form");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !selectedDoctor) return;
    setStep("submitting");
    try {
      const body: Record<string, string | number> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        date: selectedDate,
      };
      if (form.age) body.age = parseInt(form.age, 10);
      if (form.gender) body.gender = form.gender;

      const res = await fetch(
        `${API}/api/register/clinic/${slug}?doctor_id=${selectedDoctor.id}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Registration failed");
      }
      const data = await res.json();
      const qPos = data.queuePosition ?? null;
      setResult({
        name: form.name.trim(),
        doctor: selectedDoctor.name,
        queue: qPos,
        date: selectedDate,
        estimatedTime: qPos ? `~${qPos * 5} min wait` : undefined,
      });
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
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-5">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="h-6 w-6 text-primary shrink-0" />
            <span className="font-bold text-primary text-lg">Dia</span>
            <span className="text-xs text-muted-foreground">by Doctor Assistant</span>
          </div>
          {info && (
            <>
              <h1 className="text-2xl font-bold mt-1">{info.clinicName}</h1>
              <div className="flex flex-col gap-0.5 mt-1">
                {info.clinicAddress && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />{info.clinicAddress}
                  </p>
                )}
                {info.clinicPhone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 shrink-0" />{info.clinicPhone}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Error state */}
        {step === "error" && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-5 text-center space-y-3">
              <p className="text-red-700 font-medium">{errorMsg}</p>
              {!errorMsg.includes("unavailable") && (
                <Button variant="outline" size="sm" onClick={() => { setStep("form"); setErrorMsg(""); }}>
                  Try Again
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success state */}
        {step === "success" && result && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center space-y-3">
              <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto" />
              <h2 className="text-xl font-semibold text-green-800">You&apos;re registered!</h2>
              <p className="text-green-700 text-sm">Welcome, <span className="font-medium">{result.name}</span></p>
              <div className="bg-white rounded-xl p-4 border border-green-200 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Doctor</span>
                  <span className="font-medium">Dr. {result.doctor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{result.date}</span>
                </div>
                {result.queue && (
                  <>
                    <div className="flex justify-between items-center pt-1 border-t">
                      <span className="text-muted-foreground">Queue position</span>
                      <span className="text-2xl font-bold text-primary">#{result.queue}</span>
                    </div>
                    {result.estimatedTime && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Estimated wait</span>
                        <span className="font-medium text-orange-600">{result.estimatedTime}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Please arrive on time. You may close this page.
              </p>
              <Button variant="outline" size="sm" className="w-full" onClick={() => {
                setStep("select-doctor"); setSelectedDoctor(null);
                setForm({ name: "", phone: "", age: "", gender: "" }); setSelectedDate(DATES[0].value);
              }}>
                Register another patient
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Doctor selection */}
        {step === "select-doctor" && info && (
          <div className="space-y-3">
            <h2 className="font-semibold text-base px-1">Select a Doctor</h2>
            {info.doctors.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">No doctors available at this clinic.</p>
            )}
            {info.doctors.map((doc) => (
              <Card key={doc.id} className="cursor-pointer hover:border-primary hover:shadow-sm transition-all"
                onClick={() => handleDoctorSelect(doc)}>
                <CardContent className="flex items-center gap-3 py-4 px-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">Dr. {doc.name}</p>
                    {doc.specialization && (
                      <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Registration form */}
        {(step === "form" || step === "submitting") && selectedDoctor && (
          <Card>
            <CardHeader className="pb-3">
              <button onClick={() => setStep("select-doctor")}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
                ← Change doctor
              </button>
              <CardTitle className="text-base">Register with Dr. {selectedDoctor.name}</CardTitle>
              {selectedDoctor.specialization && (
                <p className="text-xs text-muted-foreground">{selectedDoctor.specialization}</p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date selector */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Visit Date</label>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {DATES.map((d) => (
                      <button key={d.value} type="button"
                        onClick={() => setSelectedDate(d.value)}
                        className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium border transition-colors ${
                          selectedDate === d.value
                            ? "bg-primary text-white border-primary"
                            : "bg-white text-foreground border-border hover:border-primary"
                        }`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <Input placeholder="Ramesh Kumar" value={form.name}
                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                    required disabled={step === "submitting"} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <Input type="tel" placeholder="+91 98765 43210" value={form.phone}
                    onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                    required disabled={step === "submitting"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Age</label>
                    <Input type="number" placeholder="35" min={0} max={120} value={form.age}
                      onChange={(e) => setForm(f => ({ ...f, age: e.target.value }))}
                      disabled={step === "submitting"} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Gender</label>
                    <select value={form.gender}
                      onChange={(e) => setForm(f => ({ ...f, gender: e.target.value }))}
                      disabled={step === "submitting"}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50">
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full"
                  disabled={step === "submitting" || !form.name.trim() || !form.phone.trim()}>
                  {step === "submitting"
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Registering…</>
                    : "Join Queue"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
