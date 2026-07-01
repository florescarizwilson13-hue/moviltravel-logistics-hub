"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Car,
  ClipboardList,
  Gauge,
  LogOut,
  MessageSquareText,
  Route,
  Truck
} from "lucide-react";
import { signOutAction } from "@/lib/auth/actions";
import type { AuthenticatedAppUser } from "@/lib/auth/roles";

const navItems = [
  { href: "/dashboard", label: "Panel operativo", icon: Gauge },
  { href: "/operacion", label: "Guía operativa", icon: ClipboardList },
  { href: "/requests", label: "Solicitudes", icon: Route },
  { href: "/drivers", label: "Conductores", icon: Car },
  { href: "/vehicles", label: "Vehículos", icon: Truck },
  { href: "/messages", label: "Mensajes", icon: MessageSquareText },
  { href: "/ai-capture", label: "Captura WhatsApp", icon: Bot }
];

const roleLabels: Record<AuthenticatedAppUser["role"], string> = {
  admin: "Admin",
  coordinator: "Coordinadora",
  viewer: "Lectura"
};

export function AppShell({
  children,
  currentUser
}: {
  children: React.ReactNode;
  currentUser: AuthenticatedAppUser;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card px-4 py-5 md:flex md:flex-col">
        <div>
          <div className="mb-8">
            <p className="text-sm font-medium text-muted-foreground">Moviltravel</p>
            <h1 className="text-xl font-semibold">Logistics Hub</h1>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                    isActive
                      ? "border-sky-200 bg-sky-50 font-medium text-sky-900"
                      : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto rounded-lg border bg-background p-3 text-sm">
          <p className="font-medium">{currentUser.fullName ?? currentUser.email}</p>
          <p className="mt-1 text-xs text-muted-foreground">{currentUser.email}</p>
          <span className="mt-3 inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-800">
            {roleLabels[currentUser.role]}
          </span>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="md:pl-64">
        <div className="border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Moviltravel Logistics Hub</p>
              <p className="text-xs text-muted-foreground">
                {currentUser.email} · {roleLabels[currentUser.role]}
              </p>
            </div>
            <form action={signOutAction}>
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md border px-2 text-sm font-medium hover:bg-muted"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
