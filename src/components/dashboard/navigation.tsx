"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { APP_CONFIG, type AppRole } from "@/config/app";
import { roleLabels } from "@/lib/shell";
import { logoutSession } from "@/app/dashboard/settings/actions";
import { navigationForRole } from "@/config/navigation";
import { Avatar } from "./ui";
const R = APP_CONFIG.routes;

export function Navigation({ name, school, role }: { name: string; school: string; role: AppRole | null }) {
  const pathname = usePathname();
  const mobile = useRef<HTMLDialogElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const userMenu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) mobile.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const links = <nav aria-label="Navigasi dashboard" className="space-y-5">{navigationForRole(role).map((group) => <section key={group.label} aria-label={group.label}>
    <h2 className="muted mb-2 px-4 text-xs font-semibold uppercase tracking-wider">{group.label}</h2>
    {group.items.map(({ href, label }) => {
      const selected = pathname === href || (href !== R.dashboard && pathname.startsWith(href + "/"));
      return <Link key={href} href={href} aria-current={selected ? "page" : undefined} onClick={() => mobile.current?.close()} className={`block rounded-xl px-4 py-3 text-sm font-medium ${selected ? "bg-[#20584c] text-white" : "nav-link"}`}>{label}</Link>;
    })}
  </section>)}</nav>;
  return <>
    <aside className="surface fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto border-r p-5 lg:block"><Link href={R.dashboard} className="mb-8 block text-lg font-semibold">{school}</Link>{links}</aside>
    <header className="surface sticky top-0 z-30 border-b px-4 py-3 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <button ref={mobileTrigger} type="button" aria-haspopup="dialog" aria-controls="mobile-navigation" onClick={() => mobile.current?.showModal()} className="rounded-xl border px-4 py-3 text-sm font-semibold lg:hidden">Menu</button>
        <dialog ref={mobile} id="mobile-navigation" aria-labelledby="mobile-navigation-title" onClose={() => mobileTrigger.current?.focus()} className="surface fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-72 max-w-[90vw] overflow-y-auto border-r p-4 text-inherit shadow-xl backdrop:bg-black/40">
          <div className="mb-6 flex items-start justify-between gap-3"><h2 id="mobile-navigation-title" className="font-semibold">{school}</h2><button type="button" aria-label="Tutup navigasi" onClick={() => mobile.current?.close()} className="min-h-11 min-w-11 rounded-lg text-xl">×</button></div>{links}
        </dialog>
        <p className="muted hidden truncate text-sm lg:block">Ruang kerja sekolah</p>
        <details ref={userMenu} className="relative ml-auto min-w-0" onKeyDown={(event) => { if (event.key === "Escape" && userMenu.current) { userMenu.current.open = false; userMenu.current.querySelector("summary")?.focus(); } }}>
          <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-1"><Avatar name={name} /><span className="min-w-0"><span className="block max-w-40 truncate text-sm font-semibold sm:max-w-64">{name}</span><span className="muted block text-xs">{role ? roleLabels[role] : "Anggota"}</span></span><span aria-hidden="true">⌄</span></summary>
          <div className="surface absolute right-0 top-full mt-3 w-56 rounded-2xl border p-2 shadow-xl">{[[R.profile, "Profil"], [R.settings, "Pengaturan"], [R.help, "Bantuan"]].map(([href, label]) => <Link onClick={() => { if (userMenu.current) userMenu.current.open = false; }} key={href} href={href} className="nav-link block rounded-lg px-4 py-3 text-sm">{label}</Link>)}<form action={logoutSession}><button className="nav-link w-full rounded-lg px-4 py-3 text-left text-sm" type="submit">Logout perangkat ini</button></form></div>
        </details>
      </div>
    </header>
  </>;
}
