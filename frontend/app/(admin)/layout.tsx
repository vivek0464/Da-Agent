"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  CalendarClock,
  Users,
  FileText,
  LogOut,
  Stethoscope,
  Building2,
  Settings,
  ChevronDown,
  Printer,
} from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { DoctorProvider, useDoctorContext } from "@/app/lib/doctor-context";
import { LanguageProvider, useLang } from "@/app/lib/language-context";
import { cn } from "@/app/lib/utils";
import dynamic from "next/dynamic";
const VoiceButton = dynamic(() => import("@/app/components/voice-button"), { ssr: false, loading: () => null });

function DoctorSwitcher() {
  const { doctorId } = useAuth();
  const { selectedDoctorId, setSelectedDoctorId, clinicDoctors } = useDoctorContext();
  const { t } = useLang();
  if (clinicDoctors.length <= 1) return null;
  return (
    <div className="px-3 pb-2">
      <p className="text-xs text-muted-foreground mb-1">{t("nav_viewing_queue")}</p>
      <div className="relative">
        <select
          value={selectedDoctorId}
          onChange={(e) => setSelectedDoctorId(e.target.value)}
          className="w-full appearance-none rounded-lg border bg-gray-50 px-3 py-1.5 pr-7 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {clinicDoctors.map((d) => (
            <option key={d.id} value={d.id}>
              Dr. {d.name}{d.id === doctorId ? " (me)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, clinicId, doctorId, isPlatformAdmin, role } = useAuth();
  const { selectedDoctorId } = useDoctorContext();
  const { t, lang, setLang } = useLang();
  const router = useRouter();
  const pathname = usePathname();
  const [clinicName, setClinicName] = useState<string | null>(null);

  useEffect(() => {
    if (!clinicId) return;
    const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    fetch(`${API}/api/clinics/${clinicId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data?.name && setClinicName(data.name))
      .catch(() => {});
  }, [clinicId]);

  const navItems = [
    { href: "/dashboard", label: t("nav_dashboard"), icon: LayoutDashboard },
    { href: "/appointments", label: t("nav_appointments"), icon: CalendarClock },
    { href: "/patients", label: t("nav_patients"), icon: Users },
    { href: "/prescriptions", label: t("nav_prescriptions"), icon: FileText },
    { href: "/print-queue", label: t("nav_print_queue"), icon: Printer },
    ...(isPlatformAdmin
      ? [{ href: "/admin", label: t("nav_platform_admin"), icon: Building2 }]
      : role === "doctor"
        ? [{ href: "/clinic-admin", label: t("nav_clinic_admin"), icon: Settings }]
        : []),
  ];

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-64 flex-col border-r bg-white shadow-sm">
        <div className="flex flex-col justify-center border-b px-6 py-3 min-h-[4rem]">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary shrink-0" />
            <span className="text-base font-bold tracking-tight">Dia</span>
            <span className="text-xs text-muted-foreground font-normal">Doctor Assistant</span>
          </div>
          {clinicName && (
            <p className="text-xs font-medium text-primary truncate mt-0.5 pl-7">{clinicName}</p>
          )}
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                pathname === href || pathname.startsWith(href + "/")
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        {role !== "platform_admin" && <DoctorSwitcher />}
        <div className="border-t p-4">
          <div className="mb-2 px-3 text-xs text-muted-foreground truncate">{user.email}</div>
          <button
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors mb-1"
          >
            <span className="text-base leading-none">🌐</span>
            {t("lang_toggle")}
          </button>
          <button
            onClick={() => signOut().then(() => router.push("/login"))}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("nav_sign_out")}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>

      {clinicId && role === "doctor" && (
        <VoiceButton clinicId={clinicId} doctorId={selectedDoctorId || doctorId || ""} userId={user.uid} />
      )}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <DoctorProvider>
        <LayoutInner>{children}</LayoutInner>
      </DoctorProvider>
    </LanguageProvider>
  );
}
