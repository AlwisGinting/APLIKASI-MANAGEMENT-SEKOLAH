"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { APP_CONFIG, type AppRole } from "@/config/app";
import { roleLabels } from "@/lib/shell";
import { logoutSession } from "@/app/dashboard/settings/actions";
import { accountNavigationForRole, activeNavigationHref, navigationForRole } from "@/config/navigation";
import { Avatar } from "./ui";
const R = APP_CONFIG.routes;

export function Navigation({ name, school, role }: { name: string; school: string; role: AppRole | null }) {
  const pathname = usePathname();
  const mobile = useRef<HTMLDialogElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const userMenu = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  const groups = navigationForRole(role);
  const selectedHref = activeNavigationHref(pathname, groups.flatMap(group => group.items));
  useEffect(() => {
    mobile.current?.close();
    if (userMenu.current) userMenu.current.open = false;
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) mobile.current?.close(); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  const links = <nav aria-label="Navigasi dashboard" className="space-y-5">{groups.map((group) => <section key={group.label} aria-label={group.label}>
    <h2 className="muted mb-2 px-4 text-xs font-semibold uppercase tracking-wider">{group.label}</h2>
    {group.items.map(({ href, label }) => {
      const selected = selectedHref === href;
      return <Link key={href} href={href} aria-current={selected ? pathname === href ? "page" : "location" : undefined} onClick={() => mobile.current?.close()} className={`nav-link shell-nav-link ${selected ? "nav-link-active" : "nav-link"}`}>{label}</Link>;
    })}
  </section>)}</nav>;
  return <>
    <aside aria-label="Navigasi utama desktop" className="surface fixed inset-y-0 left-0 z-30 hidden w-60 overflow-y-auto border-r p-5 lg:block"><p className="muted text-xs">Aplikasi</p><Link href={R.dashboard} className="shell-brand">{APP_CONFIG.name}</Link><div className="my-5 border-b pb-4"><p className="muted text-xs">Sekolah aktif</p><p className="mt-1 break-words text-sm">{school}</p></div>{links}</aside>
    <header className="surface shell-header sticky top-0 z-30 border-b px-4 py-3 sm:px-7">
      <div className="flex items-center justify-between gap-4">
        <button ref={mobileTrigger} type="button" aria-label="Buka navigasi" aria-expanded={open} aria-haspopup="dialog" aria-controls="mobile-navigation" onClick={() => { mobile.current?.showModal(); setOpen(true); }} className="ui-button ui-button-outline shrink-0 lg:hidden">Menu</button>
        <dialog ref={mobile} id="mobile-navigation" aria-labelledby="mobile-navigation-title" onClose={() => { setOpen(false); if (mobileTrigger.current?.getClientRects().length) mobileTrigger.current.focus(); }} className="surface shell-drawer fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-72 max-w-[90vw] overflow-y-auto border-r p-4 text-inherit shadow-xl backdrop:bg-black/40">
          <div className="mb-6 flex items-start justify-between gap-3"><h2 id="mobile-navigation-title" className="font-semibold">Navigasi aplikasi</h2><button type="button" aria-label="Tutup navigasi" onClick={() => mobile.current?.close()} className="min-h-11 min-w-11 rounded-lg text-xl">×</button></div><p className="muted text-xs">Aplikasi</p><Link href={R.dashboard} onClick={() => mobile.current?.close()} className="shell-brand">{APP_CONFIG.name}</Link><div className="my-5 border-b pb-4"><p className="muted text-xs">Sekolah aktif</p><p className="mt-1 break-words text-sm">{school}</p></div>{links}
        </dialog>
        <p className="muted hidden truncate text-sm lg:block">{APP_CONFIG.name}</p>
        <details ref={userMenu} className="relative ml-auto min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false; }} onKeyDown={(event) => { if (event.key === "Escape" && userMenu.current) { userMenu.current.open = false; userMenu.current.querySelector("summary")?.focus(); } }}>
          <summary aria-label={`Akun ${name}`} className="flex cursor-pointer list-none items-center gap-3 rounded-xl p-1"><Avatar name={name} /><span className="min-w-0"><span className="block max-w-28 truncate text-sm font-semibold sm:max-w-64">{name}</span><span className="muted block text-xs">{role ? roleLabels[role] : "Akses Dasar"}</span></span><span aria-hidden="true">⌄</span></summary>
          <div className="surface shell-account-panel absolute right-0 top-full mt-3 rounded-2xl border p-2 shadow-xl">{accountNavigationForRole(role).map(({href, label}) => <Link onClick={() => { if (userMenu.current) userMenu.current.open = false; }} key={href} href={href} className="nav-link shell-nav-link">{label}</Link>)}<form action={logoutSession}><button className="nav-link shell-nav-link w-full text-left" type="submit">Logout perangkat ini</button></form></div>
        </details>
      </div>
      <p className="mt-2 break-words text-xs font-semibold lg:hidden">{APP_CONFIG.name}</p>
    </header>
  </>;
}
