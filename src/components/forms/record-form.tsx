"use client";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { mutationFailure, type MutationResult } from "@/lib/form-engine";
import { acceptFormDefaults, clearSensitiveControls, formSnapshot, submissionGate, warnBeforeUnload } from "@/lib/form-interaction";
import { FormFeedback, FormSubmit } from "./form-feedback";
const subscribeHydration = () => () => {};
const hydrated = () => true;
const serverRendered = () => false;

// Opt-in client composer for future non-sensitive record forms. Existing auth
// forms retain their own flow. Only return-style actions belong here (no redirect).
export function RecordForm({ action, fields, dirtyFields, children, onCancel }: {
  action: (data: FormData) => Promise<MutationResult>;
  fields: Readonly<Record<string, { id: string; label: string }>>;
  dirtyFields: readonly string[];
  children: (result: MutationResult | null) => ReactNode;
  onCancel?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const baseline = useRef("");
  const gate = useRef(submissionGate());
  const ready = useSyncExternalStore(subscribeHydration, hydrated, serverRendered);
  const initialDirtyFields = useRef(dirtyFields);
  const [pending, setPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [result, setResult] = useState<MutationResult | null>(null);
  useEffect(() => {
    if (form.current) baseline.current = formSnapshot(form.current, initialDirtyFields.current);
    // Caller remounts using key=record/version when trusted defaults change.
  }, []);
  useEffect(() => {
    if (!dirty) return;
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);
  const updateDirty = () => { if (form.current) setDirty(formSnapshot(form.current, dirtyFields) !== baseline.current); };
  const confirmDiscard = () => !dirty || window.confirm("Perubahan belum disimpan. Buang perubahan?");
  return <form ref={form} method="post" className="record-form" aria-busy={pending} onInput={updateDirty} onChange={updateDirty}
    onReset={event => {
      if (pending || !confirmDiscard()) { event.preventDefault(); return; }
      setResult(null);
      // Native reset runs after the event handler; measure afterwards.
      queueMicrotask(updateDirty);
    }}
    onSubmit={async event => {
      event.preventDefault();
      if (!ready || !gate.current.enter()) return;
      const element = event.currentTarget;
      const data = new FormData(element); // Capture BEFORE disabling controls.
      setPending(true);
      setResult(null);
      try {
        const next = await action(data);
        setResult(next);
        if (next.status === "success") {
          acceptFormDefaults(element, dirtyFields);
          baseline.current = formSnapshot(element, dirtyFields);
          setDirty(false);
        }
      } catch { setResult(mutationFailure()); }
      finally { clearSensitiveControls(element); gate.current.leave(); setPending(false); }
    }}>
    <FormFeedback result={result} fields={fields} />
    <fieldset disabled={!ready || pending} className="form-fields"><legend className="sr-only">Isian data</legend>{children(result)}
      <div className="form-actions"><FormSubmit pending={pending} disabled={!ready} /><Button type="reset" variant="outline">Reset perubahan</Button>{onCancel && <Button variant="outline" onClick={() => { if (confirmDiscard()) onCancel(); }}>Batal</Button>}</div>
    </fieldset>
    {dirty && <p className="muted">Ada perubahan yang belum disimpan.</p>}
    <noscript>Aktifkan JavaScript untuk menggunakan formulir ini.</noscript>
  </form>;
}
