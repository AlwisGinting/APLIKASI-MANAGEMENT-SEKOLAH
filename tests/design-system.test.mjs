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
  assert.match(html, /Simpan role/);
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
  const shell = dashboard ? `<div class="dashboard-shell min-h-dvh lg:pl-60" data-theme="light">${render(Navigation, { name: context.profile.full_name, school: context.school.name, role: null })}${html}</div>` : html;
  fs.writeFileSync(path.join(folder, `${name}.html`), `<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><body>${shell}</body></html>`);
}
