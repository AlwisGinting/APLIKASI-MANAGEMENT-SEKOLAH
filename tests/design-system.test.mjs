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
function load(file, mocks = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
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
      if (target) return load(target, mocks);
    }
    return require(id);
  };
  vm.runInNewContext(source, { module: loaded, exports: loaded.exports, require: resolve, process: { env: {} }, URL, setTimeout, clearTimeout }, { filename: file });
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
test('alerts announce errors urgently and informational results politely', () => {
  assert.match(render(ui.Alert, { tone: 'destructive', children: 'Coba lagi' }), /role="alert"/);
  assert.match(render(ui.Alert, { tone: 'success', children: 'Tersimpan' }), /role="status"/);
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
