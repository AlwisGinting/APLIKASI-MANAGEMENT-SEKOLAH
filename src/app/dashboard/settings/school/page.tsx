import { requireCapability } from "@/lib/auth";
import { getSchoolContext } from "@/lib/school";
import { canManageSchool } from "@/lib/shell";
import { Page, Card, Info, Avatar } from "@/components/dashboard/ui";
import { SettingsForm, type Field } from "@/components/dashboard/settings-form";
import { saveSchool } from "../actions";
export default async function SchoolPage() {
  const { membership } = await requireCapability("school.read");
  const { school, details } = await getSchoolContext();
  const fields: Field[] = [
    { name: "name", label: "Nama sekolah", value: school.name, required: true, maxLength: 200 },
    { name: "address", label: "Alamat", type: "textarea", value: details?.address ?? "", maxLength: 1000 },
    { name: "phone", label: "Telepon sekolah", type: "tel", value: details?.phone ?? "", maxLength: 40 },
    { name: "email", label: "Email sekolah", type: "email", value: details?.email ?? "", maxLength: 254 },
    { name: "principal_name", label: "Nama kepala sekolah", value: details?.principal_name ?? "", maxLength: 200 },
    { name: "npsn", label: "NPSN (opsional, 8 angka)", value: details?.npsn ?? "", maxLength: 8 },
    { name: "description", label: "Profil singkat", type: "textarea", value: details?.description ?? "", maxLength: 3000 },
    { name: "vision", label: "Visi", type: "textarea", value: details?.vision ?? "", maxLength: 3000 },
    { name: "mission", label: "Misi", type: "textarea", value: details?.mission ?? "", maxLength: 3000 },
  ];
  return <Page title="Profil sekolah" description="Informasi organisasi untuk sekolah yang sedang aktif."><Card><div className="mb-6 flex items-center gap-4"><Avatar name={school.name} /><div><h2 className="text-xl font-semibold">{school.name}</h2><p className="muted text-sm">Logo belum diisi; menggunakan inisial sekolah.</p></div></div><dl className="grid gap-5 sm:grid-cols-2"><Info label="Slug" value={school.slug} /><Info label="Status sekolah" value={school.is_active ? "Aktif" : "Nonaktif"} />{fields.slice(1, 6).map((field) => <Info key={field.name} label={field.label} value={field.value} />)}</dl></Card>
    {canManageSchool(membership.role) && details ? <Card title="Edit informasi sekolah"><SettingsForm action={saveSchool} fields={fields} /><p className="muted mt-4 text-sm">Slug, identitas tenant, dan status sekolah tidak dapat diubah dari formulir ini.</p></Card> : <Card title="Informasi sekolah"><p className="muted">{!details ? "Pengaturan profil sekolah belum tersedia. Hubungi pengelola aplikasi untuk mengaktifkannya." : "Anda memiliki akses baca. Perubahan profil sekolah dilakukan oleh super admin atau kepala sekolah."}</p></Card>}
  </Page>;
}
