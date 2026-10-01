import { Button, Select } from "@/components/ui";

type School = { id: string; name: string };
// Presentation only: the server layout supplies validated options and action.
export function SchoolContext({ school, schools, switchSchool, period }: {
  school: School; schools: School[]; switchSchool: (data: FormData) => Promise<void>; period?: string;
}) {
  return <section aria-label="Konteks sekolah" className="surface shell-school-context border-b px-4 py-3 sm:px-7">
    <p className="muted text-xs font-semibold uppercase tracking-wide">Sekolah aktif</p>
    <p className="mt-1 break-words font-semibold">{school.name}</p>
    {period && <p className="muted mt-1 break-words text-sm">{period}</p>}
    {schools.length > 1 && <form action={switchSchool} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="min-w-0 flex-1"><label htmlFor="active-school" className="ui-label">Ganti sekolah</label>
        <Select id="active-school" name="school_id" defaultValue={school.id}>{schools.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      </div><Button type="submit">Ganti sekolah</Button>
    </form>}
  </section>;
}
