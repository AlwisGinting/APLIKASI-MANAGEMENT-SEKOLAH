import { Alert, Button } from "@/components/ui";
import type { MutationResult } from "@/lib/form-engine";

export function FormFeedback({ result, fields }: { result: MutationResult | null; fields: Readonly<Record<string, { id: string; label: string }>> }) {
  if (!result) return null;
  return <Alert tone={result.status === "success" ? "success" : "destructive"}>
    <p>{result.message}</p>
    {result.status === "validation" && <ul className="form-error-summary">{Object.entries(result.fieldErrors).flatMap(([name, errors]) =>
      Object.hasOwn(fields, name) ? errors?.map((error, index) => <li key={`${name}-${index}`}><a href={`#${fields[name].id}`}>{fields[name].label}: {error}</a></li>) ?? [] : [])}</ul>}
  </Alert>;
}
export function FormSubmit({ pending, disabled = false }: { pending: boolean; disabled?: boolean }) {
  return <Button type="submit" loading={pending} disabled={disabled}>{pending ? "Menyimpan..." : "Simpan"}</Button>;
}
