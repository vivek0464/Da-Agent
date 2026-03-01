"use client";
import { useEffect } from "react";
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
} from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { DoctorProvider, useDoctorContext } from "@/app/lib/doctor-context";
import { cn } from "@/app/lib/utils";
import VoiceButton from "@/app/components/voice-button";

const BASE_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/appointments", label: "Appointments", icon: CalendarClock },
  { href: "/patients", label: "Patients", icon: Users },
  { href: "/prescriptions", label: "Prescriptions", icon: FileText },
];

function DoctorSwitcher() {
  const { doctorId } = useAuth();
  const { selectedDoctorId, setSelectedDoctorId, clinicDoctors } = useDoctorContext();
  if (clinicDoctors.length <= 1) return null;
  return (
    <div className="px-3 pb-2">
      <p className="text-xs text-muted-foreground mb-1">Viewing queue for</p>
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
  const router = useRouter();
  const pathname = usePathname();

  const navItems = [
    ...BASE_NAV,
    ...(isPlatformAdmin
      ? [{ href: "/admin", label: "Platform Admin", icon: Building2 }]
      : role === "doctor"
        ? [{ href: "/clinic-admin", label: "Clinic Admin", icon: Settings }]
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
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Stethoscope className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold tracking-tight">Dia</span>
          <span className="text-xs text-muted-foreground font-normal">Doctor Assistant</span>
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
            onClick={() => signOut().then(() => router.push("/login"))}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
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
    <DoctorProvider>
      <LayoutInner>{children}</LayoutInner>
    </DoctorProvider>
  );
}
