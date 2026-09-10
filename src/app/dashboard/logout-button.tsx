import { signOut } from "@/app/auth/actions";

export function LogoutButton() {
  return <form action={signOut}><button type="submit" className="text-sm font-semibold text-[#2f7162] transition hover:text-[#e98a6a]">Keluar</button></form>;
}
