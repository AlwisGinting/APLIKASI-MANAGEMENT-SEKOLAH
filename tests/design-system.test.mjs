import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const context = { user: { id: 'test', email: 'pengguna@example.invalid' }, profile: { full_name: 'Pengguna Sekolah dengan Nama Panjang' }, membership: { status: 'active', role: null }, school: { name: 'KB DEVFANTA MELATI' }, details: {}, academicYear: null, semester: null };
function load(file, mocks = {}, globals = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, ...(file.endsWith('.tsx') ? { jsx: ts.JsxEmit.ReactJSX } : {}), target: ts.ScriptTarget.ES2022 } }).outputText;
  const resolve = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    if (id === 'next/navigation') return { usePathname: () => '/dashboard', useRouter: () => ({}), redirect: p => { throw Error(`redirect:${p}`); } };
    if (id === '@/lib/auth') return { requireCapability: async () => context, getAccountState: async () => ({ ...context, state: 'pending' }) };
    if (id === '@/lib/academic') return { getAcademicContext: async () => context };
    if (id === '@/lib/school') return { getSchoolContext: async () => context };
    if (id.endsWith('/actions') || id.endsWith('/google-actions') || id.endsWith('/form-actions')) return new Proxy({}, { get: () => async () => ({ success: false, message: '' }) });
    if (id.startsWith('@/') || id.startsWith('.')) {
      const base = id.startsWith('@/') ? `src/${id.slice(2)}` : path.resolve(path.dirname(file), id);
      const target = [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (target?.endsWith('.json')) return { default: JSON.parse(fs.readFileSync(target, 'utf8')) };
      if (target) return load(target, mocks, globals);
    }
    return require(id);
  };
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: resolve, process: { env: {} }, URL, URLSearchParams, setTimeout, clearTimeout, ...globals }, { filename: file });
  return loaded.exports;
}
const ui = load('src/components/ui/index.tsx');
const h = React.createElement;
const render = (component, props) => renderToStaticMarkup(h(component, props));

test('button variants retain native semantics, disabled state and loading announcement', () => {
  for (const variant of ['primary', 'secondary', 'outline', 'ghost', 'destructive']) {
    const html = render(ui.Button, { variant, children: 'Simpan' });
    assert.match(html, /type="button"/);
    assert.match(html, new RegExp(`ui-button-${variant}`));
  }
  const html = render(ui.Button, { type: 'submit', loading: true, children: 'Menyimpan' });
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Menyimpan/);
});
test('field associates label, description and error with the input', () => {
  const html = render(ui.Field, { id: 'email', label: 'Email', description: 'Email akun', error: 'Periksa email', children: props => h(ui.Input, { ...props, name: 'email' }) });
  assert.match(html, /for="email"/);
  assert.match(html, /aria-describedby="email-description email-error"/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /id="email-error"/);
});
test('F5 fields expose required, validation, descriptions and accessible error feedback', () => {
  const html = render(ui.Field, { id: 'amount', label: 'Jumlah', required: true, error: 'Angka tidak valid.', children: props => h(ui.Input, { ...props, name: 'amount', type: 'number' }) });
  assert.match(html, /Jumlah<span> \(wajib\)<\/span>/);
  assert.match(html, /required=""/);
  assert.match(html, /aria-invalid="true"/);
  assert.match(html, /aria-describedby="amount-error"/);
  const feedback = load('src/components/forms/form-feedback.tsx');
  const errors = { status: 'validation', message: 'Periksa isian.', fieldErrors: { amount: ['Angka tidak valid.'], unknown: ['Jangan tampilkan'] } };
  const summary = renderToStaticMarkup(h(feedback.FormFeedback, { result: errors, fields: { amount: { id: 'amount', label: 'Jumlah' } } }));
  assert.match(summary, /role="alert"/);
  assert.match(summary, /href="#amount"/);
  assert.doesNotMatch(summary, /Jangan tampilkan|unknown/);
  const success = renderToStaticMarkup(h(feedback.FormFeedback, { result: { status: 'success', message: 'Data berhasil disimpan.' }, fields: {} }));
  assert.match(success, /role="status"/);
});
test('alerts announce errors urgently and informational results politely', () => {
  assert.match(render(ui.Alert, { tone: 'destructive', children: 'Coba lagi' }), /role="alert"/);
  assert.match(render(ui.Alert, { tone: 'success', children: 'Tersimpan' }), /role="status"/);
});

test('F5 server composer is pending-safe, responsive, and action results never expose exception details', () => {
  const { RecordForm } = load('src/components/forms/record-form.tsx');
  const action = async () => { throw new Error('PRIVATE_DATABASE_DETAIL'); };
  const html = renderToStaticMarkup(h(RecordForm, {
    action, fields: { name: { id: 'name', label: 'Nama' } }, dirtyFields: ['name'],
    children: () => h(ui.Field, { id: 'name', label: 'Nama', children: props => h(ui.Input, { ...props, name: 'name', defaultValue: 'Contoh' }) }),
  }));
  assert.match(html, /method="post"/);
  assert.match(html, /aria-busy="false"/);
  assert.match(html, /<fieldset[^>]*disabled=""/);
  assert.match(html, /Aktifkan JavaScript/);
  assert.match(html, /Reset perubahan/);
  assert.doesNotMatch(html, /PRIVATE_DATABASE_DETAIL/);
  const css = fs.readFileSync('src/app/design-system.css', 'utf8');
  assert.match(css, /\.record-form, \.form-fields[^\{]*\{[^}]*min-width: 0[^}]*max-width: 100%/s);
  assert.match(css, /\.form-actions[^\{]*\{[^}]*flex-wrap: wrap/s);
  assert.match(css, /\.form-error-summary a[^\{]*\{[^}]*min-height: 2\.75rem/s);
  const source = fs.readFileSync('src/components/forms/record-form.tsx', 'utf8');
  assert.match(source, /gate\.current\.enter\(\)/);
  assert.match(source, /finally \{ clearSensitiveControls\(element\); gate\.current\.leave\(\); setPending\(false\); \}/);
  assert.match(source, /window\.addEventListener\("beforeunload"/);
  assert.match(source, /window\.confirm\("Perubahan belum disimpan/);
  assert.match(source, /if \(next\.status === "success"\)/);
  assert.match(source, /catch \{ setResult\(mutationFailure\(\)\); \}/);
});

test('F5 parser normalizes text and email without inventing local-part rules', () => {
  const form = load('src/lib/form-engine.ts');
  assert.equal(form.normalText('  Nama  '), 'Nama');
  assert.equal(form.optionalText('  '), null);
  assert.equal(form.normalizeEmail('  Some.User+tag@EXAMPLE.INVALID  '), 'Some.User+tag@example.invalid');
  assert.equal(form.readSingleText(new FormData(), 'name').value, null);
  const repeated = new FormData(); repeated.append('name', 'a'); repeated.append('name', 'b');
  assert.equal(form.readSingleText(repeated, 'name').ok, false);
  const file = new FormData(); file.append('name', new Blob(['x']), 'x.txt');
  assert.equal(form.readSingleText(file, 'name').ok, false);
});

test('F5 number and date parsing rejects invalid, overflowing, and silently rounded data', () => {
  const form = load('src/lib/form-engine.ts');
  assert.deepEqual(JSON.parse(JSON.stringify(form.parseNumber(null))), { ok: true, value: null });
  assert.equal(form.parseNumber('  ').value, null);
  assert.equal(form.parseNumber('.5').value, 0.5);
  assert.equal(form.parseNumber('-0.125').value, -0.125);
  assert.equal(form.parseNumber('1e3').ok, false);
  assert.equal(form.parseNumber('Infinity').ok, false);
  assert.equal(form.parseNumber('9007199254740992').ok, false);
  assert.equal(form.parseNumber('9007199254740990.5').ok, false);
  assert.equal(form.parseNumber('0.100000000000000000001').ok, false);
  assert.equal(form.parseCalendarDate('2024-02-29').value, '2024-02-29');
  assert.equal(form.parseCalendarDate('2025-02-29').ok, false);
  assert.equal(form.parseCalendarDate('  ').value, null);
  assert.equal(form.parseCalendarDate('2024-02-29T00:00:00Z').ok, false);
  assert.equal(form.parseCheckbox(new FormData(), 'active').value, false);
  const checked = new FormData(); checked.set('active', 'on');
  assert.equal(form.parseCheckbox(checked, 'active').value, true);
  checked.set('active', 'true');
  assert.equal(form.parseCheckbox(checked, 'active').ok, false);
});

test('F5 validation and mutation contracts return only safe typed feedback', () => {
  const form = load('src/lib/form-engine.ts');
  const invalid = form.validated(null, { date: ['Tanggal tidak valid.'] }, 'Periksa tanggal.');
  assert.deepEqual(JSON.parse(JSON.stringify(form.mutationInvalid(invalid))), {
    status: 'validation', message: 'Periksa tanggal.', fieldErrors: { date: ['Tanggal tidak valid.'] },
  });
  assert.deepEqual(JSON.parse(JSON.stringify(form.mutationFailure())), {
    status: 'error', message: 'Data belum dapat disimpan. Silakan coba kembali.',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(form.mutationSuccess())), {
    status: 'success', message: 'Data berhasil disimpan.',
  });
  assert.doesNotMatch(JSON.stringify([invalid, form.mutationFailure()]), /PRIVATE|password|token|stack/i);
});

test('F5 dirty snapshots exclude sensitive controls and reset defaults track successful saves', () => {
  class Input { constructor(name, type, value, extra = {}) { Object.assign(this, { name, type, value, checked: false, defaultValue: '', defaultChecked: false, disabled: false, autocomplete: '', attrs: new Set(), ...extra }); } hasAttribute(name) { return this.attrs.has(name); } }
  class TextArea { constructor(name, value, extra = {}) { Object.assign(this, { name, value, defaultValue: '', disabled: false, autocomplete: '', attrs: new Set(), ...extra }); } hasAttribute(name) { return this.attrs.has(name); } }
  class Select { constructor(name, value, options = [], extra = {}) { Object.assign(this, { name, value, options, disabled: false, attrs: new Set(), ...extra }); } hasAttribute(name) { return this.attrs.has(name); } }
  const helpers = load('src/lib/form-interaction.ts', {}, { HTMLInputElement: Input, HTMLTextAreaElement: TextArea, HTMLSelectElement: Select });
  const name = new Input('name', 'text', 'Alice');
  const active = new Input('active', 'checkbox', '', { checked: true });
  const password = new Input('password', 'password', 'do-not-snapshot', { autocomplete: 'current-password' });
  const secret = new Input('secret', 'text', 'do-not-snapshot', { attrs: new Set(['data-sensitive']) });
  const date = new Input('date', 'date', '2026-10-01');
  const ignored = new Input('other', 'text', 'ignored');
  const form = { elements: [name, active, password, secret, date, ignored] };
  const fields = ['name', 'active', 'password', 'secret', 'date'];
  const initial = helpers.formSnapshot(form, fields);
  assert.doesNotMatch(initial, /do-not-snapshot|password|secret/);
  name.value = 'Changed'; assert.notEqual(helpers.formSnapshot(form, fields), initial);
  helpers.acceptFormDefaults(form, fields); const accepted = helpers.formSnapshot(form, fields);
  name.value = 'Other'; assert.notEqual(helpers.formSnapshot(form, fields), accepted);
  helpers.clearSensitiveControls(form);
  assert.equal(password.value, ''); assert.equal(secret.value, ''); assert.equal(name.value, 'Other');
  const gate = helpers.submissionGate(); assert.equal(gate.enter(), true); assert.equal(gate.enter(), false); gate.leave(); assert.equal(gate.enter(), true);
  let prevented = false; const unload = { preventDefault() { prevented = true; }, returnValue: 'old' };
  helpers.warnBeforeUnload(unload); assert.equal(prevented, true); assert.equal(unload.returnValue, '');
});
test('auth states retain distinct copy and redirect active/basic accounts', async () => {
  for (const [state, text] of [['pending', 'Menunggu persetujuan'], ['rejected', 'Permintaan akses belum disetujui'], ['suspended', 'Akses dinonaktifkan'], ['no_membership', 'Akses sekolah belum tersedia']]) {
    const page = load('src/app/pending-approval/page.tsx', { '@/lib/auth': { getAccountState: async () => ({ ...context, state }) } }).default;
    const html = renderToStaticMarkup(await page());
    assert.ok(html.includes(text));
    assert.match(html, /Keluar/);
    assert.doesNotMatch(html, /NULL|stack|SQL/);
    preview(state, html);
  }
  for (const state of ['active', 'basic']) {
    const page = load('src/app/pending-approval/page.tsx', { '@/lib/auth': { getAccountState: async () => ({ ...context, state }) } }).default;
    await assert.rejects(page(), /redirect:\/dashboard/);
  }
});
test('rendered basic navigation excludes privileged links and marks the current page', () => {
  const Navigation = load('src/components/dashboard/navigation.tsx').Navigation;
  const html = render(Navigation, { name: context.profile.full_name, school: context.school.name, role: null });
  assert.match(html, /aria-current="page"/);
  assert.match(html, /Akses Dasar/);
  for (const route of ['users', 'master', 'system', 'feedback', 'activity', 'notifications']) assert.ok(!html.includes(`href="/dashboard/${route}"`));
  assert.match(html, /aria-labelledby="mobile-navigation-title"/);
});
test('existing pages compose shared UI with basic account context', async () => {
  for (const route of ['dashboard', 'dashboard/settings', 'dashboard/settings/security', 'dashboard/help', 'dashboard/system', 'login']) {
    const Page = load(`src/app/${route}/page.tsx`).default;
    const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    assert.match(html, /<h1/);
    if (route === 'login') assert.ok(html.indexOf('Lanjutkan dengan Google') < html.indexOf('name="email"'));
    if (route === 'dashboard') { assert.match(html, /Akses Dasar/); assert.doesNotMatch(html, /Periode akademik/); }
    preview(route.replaceAll('/', '-'), html, route.startsWith('dashboard'));
  }
});

test('users remain readable with long identity fields and active basic membership', async () => {
  const query = { select() { return this; }, eq() { return this; }, in() { return this; }, order() { return this; }, then(resolve) { return Promise.resolve({ data: [
    { id: 'target', user_id: 'target', full_name: 'NamaPenggunaPanjang'.repeat(8), status: 'active', role: null },
    { id: context.user.id, user_id: context.user.id, full_name: context.profile.full_name, status: 'active', role: 'super_admin' },
  ], error: null }).then(resolve); } };
  const Page = load('src/app/dashboard/users/page.tsx', {
    '@/lib/auth': { APP_ROLES: ['super_admin', 'operator'], requireCapability: async () => ({ ...context, membership: { role: 'super_admin', status: 'active' }, supabase: { from: () => query } }) },
    '@/utils/supabase/admin': { getAuthEmails: async () => new Map([['target', 'emailpanjang'.repeat(8) + '@example.invalid']]) },
  }).default;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ success: '1' }) }));
  assert.match(html, /Akses Dasar/);
  assert.match(html, /Simpan peran/);
  assert.match(html, /class="mt-1 text-xs font-semibold text-foreground">Akun Anda<\/p>/);
  preview('dashboard-users', html, true);
});

// Optional offline visual fixtures. They contain synthetic data and cannot call a database.
function preview(name, html, dashboard = false) {
  if (!process.env.F2_PREVIEW) return;
  const folder = path.join(os.tmpdir(), 'f2-ui-preview');
  fs.mkdirSync(folder, { recursive: true });
  const css = fs.readdirSync('.next/static/chunks').filter(f => f.endsWith('.css')).map(f => fs.readFileSync(`.next/static/chunks/${f}`, 'utf8')).join('\n');
  const Navigation = load('src/components/dashboard/navigation.tsx').Navigation;
  const SchoolContext = load('src/components/dashboard/school-context.tsx').SchoolContext;
  const school = { id: 'preview', name: 'SekolahUjiDenganNamaPanjangTanpaSpasi'.repeat(3) };
  const shell = dashboard ? `<div class="dashboard-shell min-h-dvh lg:pl-60" data-theme="light">${render(Navigation, { name: context.profile.full_name, school: school.name, role: null })}${render(SchoolContext, { school, schools: [school], switchSchool: async () => {} })}<div id="dashboard-content" tabindex="-1" class="pb-24">${html}</div></div>` : html;
  fs.writeFileSync(path.join(folder, `${name}.html`), `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${shell}</body></html>`);
}


test('F3 desktop/mobile navigation parity for every role and basic access', () => {
  const Navigation = load('src/components/dashboard/navigation.tsx').Navigation;
  const registry = load('src/config/navigation.ts');
  const config = load('src/config/app.ts');
  for (const role of [null, ...config.AUTH_ROLES]) {
    const html = render(Navigation, { name: 'Akun', school: 'Sekolah', role });
    const navs = [...html.matchAll(/<nav aria-label="Navigasi dashboard"[^>]*>([\s\S]*?)<\/nav>/g)].map(match => match[1]);
    assert.equal(navs.length, 2);
    assert.equal(navs[0], navs[1]);
    const hrefs = [...navs[0].matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(hrefs, Array.from(registry.navigationForRole(role).flatMap(group => group.items.map(item => item.href))));
  }
});

test('F3 active route chooses the deepest boundary match, never a similarly named URL', () => {
  const registry = load('src/config/navigation.ts');
  const items = registry.navigationForRole('super_admin').flatMap(group => group.items);
  assert.equal(registry.activeNavigationHref('/dashboard/settings/security', items), '/dashboard/settings/security');
  assert.equal(registry.activeNavigationHref('/dashboard/master/semesters', items), '/dashboard/master');
  assert.equal(registry.activeNavigationHref('/dashboard/settings-unknown', items), undefined);
  const Navigation = load('src/components/dashboard/navigation.tsx', { 'next/navigation': { usePathname: () => '/dashboard/master/semesters' } }).Navigation;
  const html = render(Navigation, { name: 'Akun', school: 'Sekolah', role: 'guru' });
  assert.match(html, /href="\/dashboard\/master" aria-current="location"/);
  assert.doesNotMatch(html, /aria-current="page"/);
});

test('F3 application identity and school context are distinct and escaped', () => {
  const Navigation = load('src/components/dashboard/navigation.tsx').Navigation;
  const html = render(Navigation, { name: 'Akun', school: 'Sekolah <Uji> sangat panjang', role: null });
  assert.match(html, /SIM KB DEVFANTA MELATI/);
  assert.match(html, /Sekolah aktif/);
  assert.match(html, /Sekolah &lt;Uji&gt;/);
  assert.doesNotMatch(html, /<Uji>/);
});

test('F3 account destinations derive from registry and expose optional password settings', () => {
  const registry = load('src/config/navigation.ts');
  const account = registry.accountNavigationForRole(null);
  assert.deepEqual(Array.from(account, item => item.href), ['/dashboard/profile', '/dashboard/settings', '/dashboard/settings/security', '/dashboard/help']);
  assert.ok(account.some(item => item.label === 'Keamanan / Atur Kata Sandi'));
  const html = render(load('src/components/dashboard/navigation.tsx').Navigation, { name: 'Akun', school: 'Sekolah', role: null });
  assert.match(html, /Logout perangkat ini/);
  assert.match(html, /aria-label="Akun Akun"/);
  assert.match(html, /aria-expanded="false"/);
});

test('F3 role labels are human-readable without turning NULL into Orang Tua', () => {
  const labels = load('src/lib/shell.ts').roleLabels;
  assert.deepEqual(Object.values(labels), ['Super Admin','Kepala Sekolah','Operator','Guru','Orang Tua']);
  const TenantContext = load('src/components/dashboard/ui.tsx').TenantContext;
  for (const [role, label] of Object.entries(labels)) assert.ok(render(TenantContext, { role, school: 'Sekolah', status: 'active' }).includes(label));
  assert.match(render(TenantContext, { role: null, school: 'Sekolah', status: 'active' }), /Akses Dasar/);
  assert.doesNotMatch(render(TenantContext, { role: null, school: 'Sekolah', status: 'pending' }), /Akses Dasar|Orang Tua/);
});

test('F3 school context avoids selector for one school and submits validated-option identity for many', () => {
  const SchoolContext = load('src/components/dashboard/school-context.tsx').SchoolContext;
  const school = { id: 'a', name: 'Sekolah Aktif' };
  const one = render(SchoolContext, { school, schools: [school], switchSchool: async () => {} });
  assert.match(one, /Sekolah aktif/);
  assert.doesNotMatch(one, /<select|<form/);
  const many = render(SchoolContext, { school, schools: [school, { id: 'b', name: 'Sekolah Kedua' }], switchSchool: async () => {} });
  assert.match(many, /name="school_id"/);
  assert.match(many, /value="a" selected=""/);
  assert.match(many, /value="b"/);
  assert.match(many, /for="active-school"/);
  assert.match(many, /type="submit"/);
});

test('F3 nested settings breadcrumbs have one non-link current page', async () => {
  const Page = load('src/app/dashboard/settings/security/page.tsx').default;
  const html = renderToStaticMarkup(await Page());
  const nav = html.match(/<nav aria-label="Jejak halaman"[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.match(nav, /<ol/);
  assert.match(nav, /href="\/dashboard"/);
  assert.match(nav, /href="\/dashboard\/settings"/);
  assert.match(nav, /<span aria-current="page">Keamanan<\/span>/);
  assert.doesNotMatch(nav, /href="\/dashboard\/settings\/security"/);
  const dashboard = renderToStaticMarkup(await load('src/app/dashboard/page.tsx').default({ searchParams: Promise.resolve({}) }));
  assert.doesNotMatch(dashboard, /Jejak halaman/);
});

test('F3 error boundary and loading state use safe feedback without exception details', () => {
  const error = new Error('PRIVATE_SQL_TOKEN');
  error.digest = 'PRIVATE_DIGEST';
  const html = render(load('src/app/error.tsx').default, { error, retry() {} });
  assert.match(html, /Layanan sedang tidak tersedia/);
  assert.match(html, /Coba lagi/);
  assert.doesNotMatch(html, /PRIVATE_SQL_TOKEN|PRIVATE_DIGEST/);
  const loading = render(load('src/app/dashboard/loading.tsx').default, {});
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /role="status"/);
});

const dataQuery = load('src/lib/data-query.ts');
const dataUI = load('src/components/data/data-table.tsx');
const dataConfig = { sorts: ['name', 'created'], defaultSort: 'name', filters: [{ key: 'kind', label: 'Jenis data contoh dengan keterangan panjang', options: [{ value: 'a', label: 'Kelompok contoh A' }, { value: 'b', label: 'Kelompok contoh B' }] }] };
const parse = params => dataQuery.parseDataQuery(params, dataConfig);
const dataColumns = [{ id: 'name', header: 'Nama data contoh', sortKey: 'name', cell: row => row.name }, { id: 'value', header: 'Keterangan', cell: row => row.value }];
const tableProps = { caption: 'Data contoh pengujian', columns: dataColumns, rowKey: row => row.id, query: parse({}) };

test('F4 query defaults and malformed pages use a bounded safe window', () => {
  const query = parse({});
  assert.equal(query.page, 1); assert.equal(query.pageSize, 25); assert.equal(query.sort, 'name'); assert.equal(query.direction, 'asc');
  for (const page of ['0', '-2', '1.5', '1e3', 'Infinity', '999999999999999999', ['2','3']]) assert.equal(parse({ page }).page, 1);
  assert.equal(parse({ page: '2' }).page, 2);
});
test('F4 page sizes and sort input cannot select unbounded or arbitrary fields', () => {
  for (const pageSize of ['0', '-1', '1000000', 'abc']) assert.equal(parse({ pageSize }).pageSize, 25);
  for (const pageSize of ['10','25','50']) assert.equal(parse({ pageSize }).pageSize, Number(pageSize));
  assert.equal(parse({ sort: 'name; DROP TABLE x', direction: 'DESC NULLS FIRST' }).sort, 'name');
  assert.equal(parse({ direction: 'sideways' }).direction, 'asc');
  assert.equal(parse({ sort: 'created', direction: 'desc' }).direction, 'desc');
});
test('F4 search normalization and allowlisted filters reject ambiguous inputs', () => {
  assert.equal(parse({ q: '  satu\n  dua\u0000 ' }).q, 'satu dua');
  assert.equal(parse({ q: 'x'.repeat(500) }).q.length, 200);
  assert.equal(parse({ q: ['a','b'] }).q, '');
  assert.equal(parse({ 'filter.kind': 'a' }).filters.kind, 'a');
  assert.equal(Object.keys(parse({ 'filter.kind': 'unknown', 'filter.tenant': 'foreign' }).filters).length, 0);
});
test('F4 URL round-trip preserves data state while removing unknown parameters', () => {
  const query = parse({ page: '3', pageSize: '10', q: 'Satu & Dua', sort: 'created', direction: 'desc', 'filter.kind': 'b', token: 'NEVER_COPY' });
  const url = dataQuery.queryHref(query, { page: 4 });
  assert.ok(!url.includes('NEVER_COPY'));
  const back = parse(Object.fromEntries(new URLSearchParams(url.slice(1))));
  assert.equal(back.page, 4); assert.equal(back.q, query.q); assert.equal(back.filters.kind, 'b'); assert.equal(back.sort, 'created'); assert.equal(back.direction, 'desc');
});
test('F4 server contract maps identifiers and adds a deterministic unique tie-break', () => {
  const result = dataQuery.serverQuery({ page: '3', pageSize: '10', sort: 'created', direction: 'desc' }, dataConfig, { name: 'display_name', created: 'created_at' }, 'id');
  assert.equal(result.offset, 20); assert.equal(result.limit, 10);
  assert.equal(JSON.stringify(result.order), JSON.stringify([{ field: 'created_at', direction: 'desc' }, { field: 'id', direction: 'asc' }]));
  assert.throws(() => dataQuery.serverQuery({}, dataConfig, {}, 'id'));
  assert.throws(() => dataQuery.parseDataQuery({}, { ...dataConfig, defaultSort: 'bad' }));
});
test('F4 table renders semantic columns, escaped cells, zero and missing values', () => {
  const html = render(dataUI.DataTable, { ...tableProps, rows: [{ id:'1',name:'<script>private</script>',value:0 }, { id:'2',name:'B',value:null }] });
  assert.match(html, /<caption>Data contoh pengujian<\/caption>/); assert.match(html, /scope="col"/); assert.match(html, /<tbody>/);
  assert.match(html, />0<\/td>/); assert.match(html, /Belum diisi/); assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script>/);
});
test('F4 sortable headers expose active direction and preserve filter state', () => {
  const html = render(dataUI.DataTable, { ...tableProps, query: parse({page:'3',q:'cari','filter.kind':'a'}), rows:[{id:'1',name:'A'}] });
  assert.match(html, /aria-sort="ascending"/); assert.match(html, /direction=desc/); assert.match(html, /page=1/); assert.match(html, /filter.kind=a/);
  assert.match(html, /scope="col" style="text-align:left">Keterangan<\/th>/);
});
test('F4 row actions are explicit caller-owned links with no destructive default', () => {
  const props = { ...tableProps, rows:[{id:'1',name:'A'}] };
  assert.doesNotMatch(render(dataUI.DataTable, props), /Tindakan/);
  const html = render(dataUI.DataTable, { ...props, actions: row => h('a', {href:`?record=${row.id}`, 'aria-label':`Lihat ${row.name}`}, 'Lihat') });
  assert.match(html, /Tindakan/); assert.match(html, /aria-label="Lihat A"/); assert.doesNotMatch(html, /Hapus|onClick/);
});
test('F4 empty dataset and filtered no-results have distinct safe feedback', () => {
  assert.match(render(dataUI.DataTable, {...tableProps,rows:[]}), /Belum ada data/);
  assert.match(render(dataUI.DataTable, {...tableProps,query:parse({q:'cari'}),rows:[]}), /Tidak ada hasil yang cocok/);
  assert.match(render(dataUI.DataFeedback, {state:'error', error:new Error('PRIVATE_SQL')}), /role="alert"/);
  assert.doesNotMatch(render(dataUI.DataFeedback, {state:'error', error:new Error('PRIVATE_SQL')}), /PRIVATE_SQL/);
  const html = render(dataUI.DataFeedback, {state:'loading'}); assert.match(html, /aria-busy="true"/); assert.match(html, /ui-skeleton/); assert.match(html, /role="status"/);
});
test('F4 GET toolbar labels controls, resets page and keeps sorting', () => {
  const html = render(dataUI.DataToolbar, {id:'example',query:parse({page:'4',q:'cari',direction:'desc','filter.kind':'a'}),filters:dataConfig.filters});
  assert.match(html, /method="get"/); assert.match(html, /for="example-q"/); assert.match(html, /for="example-kind"/); assert.match(html, /name="page" value="1"/);
  assert.match(html, /name="direction" value="desc"/); assert.match(html, /filter aktif/); assert.match(html, /Hapus pencarian dan filter/);
});
test('F4 pagination disables first and last boundaries including zero totals', () => {
  const first = render(dataUI.DataPagination, {query:parse({}),total:51});
  assert.match(first, /disabled=""[^>]*>Sebelumnya/); assert.match(first, /rel="next"/);
  const last = render(dataUI.DataPagination, {query:parse({page:'3'}),total:51});
  assert.match(last, /rel="prev"/); assert.match(last, /disabled=""[^>]*>Berikutnya/);
  const zero = render(dataUI.DataPagination, {query:parse({}),total:0}); assert.doesNotMatch(zero, /rel="next"|rel="prev"/);
});
test('F4 pagination preserves query state and recovers an out-of-range page honestly', () => {
  const html = render(dataUI.DataPagination, {query:parse({page:'8',q:'cari','filter.kind':'b',sort:'created'}),total:30});
  assert.match(html, /Halaman 8 dari 2/); assert.match(html, /Kembali ke halaman pertama/); assert.match(html, /q=cari/); assert.match(html, /filter.kind=b/); assert.match(html, /sort=created/);
  assert.throws(() => render(dataUI.DataPagination, {query:parse({}),total:-1}));
  assert.match(render(dataUI.DataTable, {...tableProps,query:parse({page:'8'}),rows:[]}), /Halaman ini tidak tersedia/);
  assert.doesNotMatch(render(dataUI.DataPagination, {query:parse({page:'100000'}),total:3000000}), /rel="next"/);
});
test('F4 calendar dates preserve dates and timestamps require an explicit timezone', () => {
  const format = load('src/lib/data-format.ts');
  assert.match(format.calendarDate('2024-02-29'), /29/); assert.equal(format.calendarDate('2025-02-29'), 'Belum diisi');
  assert.equal(format.dateTime('2026-01-01T12:00:00'), 'Belum diisi');
  assert.match(format.dateTime('2026-01-01T00:00:00Z'), /07.00.*WIB/);
});
test('F4 isolated reference composes server-sized records with reusable controls', () => {
  const query = parse({ q:'contoh','filter.kind':'a' });
  const rows = [{id:'1',name:'NamaContohSangatPanjangTanpaSpasi'.repeat(6),value:'Keterangan panjang dalam bahasa Indonesia untuk pemeriksaan layout'}, {id:'2',name:'Contoh kedua',value:null}];
  const html = renderToStaticMarkup(h('main', {className:'workspace-page'}, h(ui.PageHeader,{title:'Referensi data (fixture)'}), h(dataUI.DataToolbar,{id:'fixture',query,filters:dataConfig.filters}), h(dataUI.DataTable,{...tableProps,query,rows,actions:row=>h('a',{href:`?record=${row.id}`},'Lihat rincian')}),h(dataUI.DataPagination,{query,total:60})));
  assert.equal((html.match(/<tbody>/g)||[]).length,1);
  preview('f4-data',html,true);
  for (const state of ['loading','empty','no-results','error']) preview(`f4-${state}`,render(dataUI.DataFeedback,{state}),true);
});
