// Browser-only helpers with no storage, network, logging or global interception.
// Only explicitly opted-in, non-sensitive, uncontrolled controls are tracked.
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
function controls(form: HTMLFormElement, names: readonly string[]): Control[] {
  return Array.from(form.elements).filter((element): element is Control => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return false;
    return names.includes(element.name) && !element.disabled && !element.hasAttribute("data-sensitive") &&
      !/password|one-time-code/.test(element.autocomplete) &&
      !(element instanceof HTMLInputElement && ["password", "hidden", "file", "submit", "reset", "button"].includes(element.type));
  });
}
export function formSnapshot(form: HTMLFormElement, names: readonly string[]): string {
  return JSON.stringify(controls(form, names).map(control => [control.name,
    control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type) ? control.checked : control.value]));
}
export function acceptFormDefaults(form: HTMLFormElement, names: readonly string[]): void {
  for (const control of controls(form, names)) {
    if (control instanceof HTMLInputElement && ["checkbox", "radio"].includes(control.type)) control.defaultChecked = control.checked;
    else if (control instanceof HTMLSelectElement) for (const option of control.options) option.defaultSelected = option.selected;
    else control.defaultValue = control.value;
  }
}
export function clearSensitiveControls(form: HTMLFormElement): void {
  for (const control of Array.from(form.elements)) {
    if (!(control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement)) continue;
    if (control.hasAttribute("data-sensitive") || /password|one-time-code/.test(control.autocomplete) || (control instanceof HTMLInputElement && control.type === "password")) control.value = "";
  }
}
export function warnBeforeUnload(event: BeforeUnloadEvent): void { event.preventDefault(); event.returnValue = ""; }
export function submissionGate() {
  let locked = false;
  return { enter() { if (locked) return false; locked = true; return true; }, leave() { locked = false; } };
}
