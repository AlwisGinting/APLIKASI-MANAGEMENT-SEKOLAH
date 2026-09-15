import { getSchoolContext } from "@/lib/school";
import { Page, Card, Info } from "@/components/dashboard/ui";
import { AppInfo } from "@/components/dashboard/app-info";
export default async function AboutPage() {
  const { school, details } = await getSchoolContext();
  return <Page title={`Tentang ${school.name}`} description="Informasi sekolah dan aplikasi yang Anda gunakan."><Card title="Profil sekolah"><p className="whitespace-pre-wrap leading-7">{details?.description || "Belum diisi"}</p></Card><div className="grid gap-5 sm:grid-cols-2"><Card title="Visi"><p className="whitespace-pre-wrap leading-7">{details?.vision || "Belum diisi"}</p></Card><Card title="Misi"><p className="whitespace-pre-wrap leading-7">{details?.mission || "Belum diisi"}</p></Card></div><Card title="Kontak"><dl className="grid gap-5 sm:grid-cols-2"><Info label="Alamat" value={details?.address} /><Info label="Telepon sekolah" value={details?.phone} /><Info label="Email sekolah" value={details?.email} /><Info label="Kepala sekolah" value={details?.principal_name} /></dl></Card><AppInfo /></Page>;
}
