import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { NextRequest } from 'next/server.js';
import { createServerClient } from '@supabase/ssr';
const loadDependency = createRequire(import.meta.url);

// Execute source with explicit dependency doubles: no env files or network.
function load(file, mocks = {}, globals = {}) {
  const loaded = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, {
    module: loaded, exports: loaded.exports, URL, URLSearchParams, Headers, Response, AbortSignal,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: 'https://test.invalid' } },
    require: (id) => Object.hasOwn(mocks, id) ? mocks[id] : id === "@/lib/capabilities" ? load("src/lib/capabilities.ts") : loadDependency(id), ...globals,
  }, { filename: file });
  return loaded.exports;
}
const redirect = load('src/lib/redirect.ts');
const recovery = load('src/lib/recovery.ts', { 'server-only': {} });
const errors = load('src/lib/errors.ts');
const authForm = load('src/lib/auth-form.ts');

test('redirects reject external, backslash, control and encoded bypasses', () => {
  for (const input of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', '/\nevil.example', '/a/..//evil.example', '/%255cevil.example']) {
    assert.equal(redirect.safeNextPath(input), '/dashboard', String(input));
  }
  for (const input of ['/', '/dashboard', '/reset-password', '/dashboard?tab=one#top']) assert.equal(redirect.safeNextPath(input), input);
});

function callback(auth, membership = { school_id: 'a', status: 'active', role: 'guru' }) {
  return load('src/app/auth/callback/route.ts', {
    '@/utils/supabase/server': { createClient: async () => ({ auth }) },
    '@/lib/auth': {
      getAccountState: async () => ({ state: membership ? membership.status === 'active' ? 'active' : membership.status : 'no_membership' }),
      accountStatePath: (state) => `/pending-approval?status=${state}`,
    },
    '@/lib/redirect': redirect, '@/lib/recovery': recovery,
  }).GET;
}
function authExchange(event, failure = false) {
  let notify;
  return {
    onAuthStateChange(fn) { notify = fn; return { data: { subscription: { unsubscribe() {} } } }; },
    async exchangeCodeForSession() {
      if (failure) throw new Error('sensitive backend failure');
      notify(event);
      return { data: { session: {}, user: { id: 'user-a' } }, error: null };
    },
  };
}
const req = (query) => new NextRequest(`https://school.example/auth/callback?${query}`);
test('callback needs a code and returns safe uncached errors', async () => {
  const response = await callback({})(req('next=/reset-password'));
  assert.equal(response.headers.get('location'), 'https://school.example/reset-password?error=recovery-service');
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
});
test('callback opens recovery only after the SDK recovery event', async () => {
  const response = await callback(authExchange('PASSWORD_RECOVERY'))(req('code=test&next=/reset-password'));
  assert.equal(response.headers.get('location'), 'https://school.example/reset-password');
  assert.equal(response.cookies.get(recovery.RECOVERY_COOKIE).value, 'user-a');
  assert.match(response.headers.get('set-cookie'), /HttpOnly/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
});
test('changing next does not turn a signup/login into recovery', async () => {
  const response = await callback(authExchange('SIGNED_IN'))(req('code=test&next=/reset-password'));
  assert.match(response.headers.get('location'), /error=recovery/);
  assert.equal(response.cookies.get(recovery.RECOVERY_COOKIE).value, '');
});
test('callback exception stays generic and removes any old recovery marker', async () => {
  const response = await callback(authExchange('', true))(req('code=test&next=/reset-password'));
  assert.match(response.headers.get('location'), /error=recovery/);
  assert.equal(response.cookies.get(recovery.RECOVERY_COOKIE).value, '');
});
test('callback preserves verification and safe default destinations', async () => {
  const response = await callback(authExchange('SIGNED_IN'))(req('code=test&next=//evil.example'));
  assert.equal(response.headers.get('location'), 'https://school.example/dashboard');
});

function resetFixture({ marker = 'user-a', user = 'user-a', updateError = null } = {}) {
  let updates = 0;
  const removed = [];
  const store = {
    get() { return marker ? { value: marker } : undefined; },
    delete(name) { removed.push(name); },
    getAll() { return [{ name: 'sb-test-auth-token.0' }, { name: 'unrelated' }]; },
  };
  const auth = {
    async getUser() { return { data: { user: user ? { id: user } : null }, error: null }; },
    async updateUser() { updates++; return { error: updateError }; },
    async signOut() { return { error: null }; },
  };
  const { resetPasswordAction } = load('src/app/reset-password/actions.ts', {
    'next/headers': { cookies: async () => store },
    '@/utils/supabase/server': { createClient: async () => ({ auth }) },
    '@/lib/recovery': recovery, '@/lib/errors': errors, '@/lib/auth-form': authForm,
    'next/navigation': { redirect(path) { throw new Error('REDIRECT:' + path); } },
  });
  const resetPassword = async (password, confirmation) => {
    const data = new FormData(); data.set('password', password); data.set('confirmation', confirmation);
    return resetPasswordAction(authForm.initialAuthState, data);
  };
  return { resetPassword, removed, updates: () => updates };
}
test('password validation runs server-side before mutation', async () => {
  const fixture = resetFixture();
  assert.match((await fixture.resetPassword('short', 'short')).fieldErrors.password, /8 karakter/);
  assert.match((await fixture.resetPassword('long-password', 'different')).fieldErrors.confirmation, /tidak sama/);
  assert.equal(fixture.updates(), 0);
});
test('missing recovery session or different authenticated user cannot reset', async () => {
  for (const options of [{ marker: '' }, { user: null }, { user: 'other-user' }]) {
    const fixture = resetFixture(options);
    assert.match((await fixture.resetPassword('long-password', 'long-password')).message, /browser/);
    assert.equal(fixture.updates(), 0);
  }
});
test('successful reset clears recovery and session cookies but preserves unrelated cookies', async () => {
  const fixture = resetFixture();
  await assert.rejects(fixture.resetPassword('long-password', 'long-password'), /REDIRECT:\/login\?reset=success/);
  assert.equal(fixture.updates(), 1);
  assert.deepEqual(fixture.removed, [recovery.RECOVERY_COOKIE, 'sb-test-auth-token.0']);
});
test('Supabase password error details never reach the form', async () => {
  const fixture = resetFixture({ updateError: { message: 'sensitive raw message' } });
  const result = await fixture.resetPassword('long-password', 'long-password');
  assert.equal(result.success, false);
  assert.doesNotMatch(result.message, /sensitive/);
  assert.equal(fixture.removed.length, 0);
});
test('backend fetch disables caching and sanitizes network exceptions', async () => {
  let options;
  const { supabaseFetch } = load('src/utils/supabase/fetch.ts', {}, {
    fetch: async (_input, init) => { options = init; throw new Error('private URL'); },
  });
  const response = await supabaseFetch('https://test.invalid');
  assert.equal(options.cache, 'no-store');
  assert.ok(options.signal);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private URL/);
});

test('installed SSR SDK emits PASSWORD_RECOVERY during server PKCE exchange', async () => {
  const jar = new Map();
  const events = [];
  const cookies = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)),
  };
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-a' })).toString('base64url');
  const options = { cookies, global: { fetch: async (url) => new Response(JSON.stringify(
    String(url).includes('/token') ? {
      access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: 'fake-refresh',
      token_type: 'bearer', expires_in: 3600, user: { id: 'user-a' },
    } : {},
  ), { headers: { 'content-type': 'application/json' } }) } };
  const first = createServerClient('https://test.invalid', 'test-publishable', options);
  await first.auth.resetPasswordForEmail('test@example.invalid');
  const second = createServerClient('https://test.invalid', 'test-publishable', options);
  const { data: listener } = second.auth.onAuthStateChange((event) => events.push(event));
  const result = await second.auth.exchangeCodeForSession('fake-code');
  listener.subscription.unsubscribe();
  assert.equal(result.error, null);
  assert.ok(events.includes('PASSWORD_RECOVERY'));
});

test('proxy preserves rotated cookies and cache headers across multiple writes', async () => {
  const { proxy } = load('src/proxy.ts', {
    '@supabase/ssr': { createServerClient(_url, _key, options) {
      return { auth: { async getUser() {
        options.cookies.setAll([{ name: 'first', value: 'one', options: { path: '/' } }], { 'Cache-Control': 'private, no-store', Pragma: 'no-cache' });
        options.cookies.setAll([{ name: 'second', value: 'two', options: { path: '/' } }], {});
        return { data: { user: null }, error: null };
      } } };
    } },
    '@/utils/supabase/fetch': { supabaseFetch: () => { throw new Error('no network'); } },
  });
  const response = await proxy(new NextRequest('https://school.example/dashboard'));
  assert.equal(response.cookies.get('first').value, 'one');
  assert.equal(response.cookies.get('second').value, 'two');
  assert.match(response.headers.get('x-middleware-request-cookie'), /second=two/);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('pragma'), 'no-cache');
});

test('health returns only app status and is outside the auth proxy matcher', async () => {
  const { GET } = load('src/app/api/health/route.ts');
  const response = GET();
  assert.deepEqual(await response.json(), { status: 'ok' });
  assert.match(response.headers.get('cache-control'), /no-store/);
  const { config } = load('src/proxy.ts', {
    '@supabase/ssr': {}, '@/utils/supabase/fetch': {},
  });
  assert.ok(config.matcher.every((path) => !path.startsWith('/api')));
});

function formData(values) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}
const validRegistration = { full_name: 'Test Person', email: 'test@example.invalid', password: 'test-password', confirmation: 'test-password' };
function formActions(auth, origin = 'https://school.example', accountState = 'pending') {
  const logs = [];
  const actions = load('src/app/auth/form-actions.ts', {
    '@/lib/auth-form': authForm,
    '@/lib/auth': { getAccountState: async () => ({ state: accountState }), accountStatePath: (state) => `/pending-approval?status=${state}` },
    '@/lib/auth-origin': { authOrigin: async () => origin },
    '@/utils/supabase/server': { createClient: async () => ({ auth }) },
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  }, { console: { info: (...args) => logs.push(args), error: (...args) => logs.push(args) } });
  return { ...actions, logs };
}

test('register server validation rejects missing fields, short passwords and mismatches before signup', async () => {
  let calls = 0;
  const actions = formActions({ signUp: async () => { calls++; } });
  for (const values of [{}, { ...validRegistration, password: 'short' }, { ...validRegistration, confirmation: 'different' }, { ...validRegistration, email: 'invalid' }]) {
    const state = await actions.registerAction(authForm.initialAuthState, formData(values));
    assert.equal(state.success, false);
    assert.ok(state.fieldErrors);
  }
  assert.equal(calls, 0);
  assert.equal(actions.logs[0][0], '[auth.register] action invoked');
});
test('register calls signup through the SSR client with runtime callback and only allowed metadata', async () => {
  let submitted;
  const actions = formActions({ signUp: async (input) => { submitted = input; return { data: { user: { id: 'test' }, session: null }, error: null }; } });
  const state = await actions.registerAction(authForm.initialAuthState, formData({ ...validRegistration, school_id: 'untrusted', user_id: 'untrusted' }));
  assert.equal(state.success, true);
  assert.equal(submitted.options.emailRedirectTo, 'https://school.example/auth/callback?next=/dashboard');
  assert.equal(submitted.options.data.full_name, validRegistration.full_name);
  assert.equal(submitted.options.data.school_id, undefined);
  assert.equal(submitted.options.data.user_id, undefined);
  assert.doesNotMatch(JSON.stringify(state), /test-password/);
  assert.doesNotMatch(JSON.stringify(actions.logs), /test-password|test@example.invalid/);
  assert.equal(actions.logs[1][0], '[auth.register] signup accepted');
});
test('immediate-session signup routes through current account state', async () => {
  const pending = formActions({ signUp: async () => ({ data: { user: { id: 'test' }, session: {} }, error: null }) }, 'https://school.example', 'pending');
  await assert.rejects(pending.registerAction(authForm.initialAuthState, formData(validRegistration)), /REDIRECT:\/pending-approval\?status=pending/);
  const active = formActions({ signUp: async () => ({ data: { user: { id: 'test' }, session: {} }, error: null }) }, 'https://school.example', 'active');
  await assert.rejects(active.registerAction(authForm.initialAuthState, formData(validRegistration)), /REDIRECT:\/dashboard/);
});
test('signup without an immediate session remains transitional and does not claim authentication', async () => {
  const actions = formActions({ signUp: async () => ({ data: { user: { id: 'test' }, session: null }, error: null }) });
  const state = await actions.registerAction(authForm.initialAuthState, formData(validRegistration));
  assert.equal(state.success, true);
  assert.match(state.message, /Jika diminta, selesaikan verifikasi email/);
});
test('register error logging removes raw messages and sensitive data', async () => {
  const actions = formActions({ signUp: async () => ({ data: {}, error: { status: 400, code: 'user_already_exists', message: 'private test@example.invalid test-password' } }) });
  const state = await actions.registerAction(authForm.initialAuthState, formData(validRegistration));
  assert.equal(state.success, false);
  assert.doesNotMatch(JSON.stringify([state, actions.logs]), /private|test@example.invalid|test-password/);
});
test('login errors for wrong credentials and unverified accounts are indistinguishable', async () => {
  const messages = [];
  for (const code of ['invalid_credentials', 'email_not_confirmed', 'user_not_found']) {
    const actions = formActions({ signInWithPassword: async () => ({ error: { status: 400, code } }) });
    messages.push((await actions.loginAction(authForm.initialAuthState, formData(validRegistration))).message);
  }
  assert.equal(new Set(messages).size, 1);
});
test('login success redirects after session setup without swallowing redirect', async () => {
  const actions = formActions({ signInWithPassword: async () => ({ error: null }) });
  await assert.rejects(actions.loginAction(authForm.initialAuthState, formData(validRegistration)), /REDIRECT:\/dashboard/);
});
test('forgot never distinguishes known/unknown email or auth rate-limiting', async () => {
  for (const error of [null, { status: 400, code: 'user_not_found' }, { status: 429 }]) {
    let url;
    const actions = formActions({ resetPasswordForEmail: async (_email, options) => { url = options.redirectTo; return { error }; } });
    const state = await actions.forgotPasswordAction(authForm.initialAuthState, formData(validRegistration));
    assert.equal(state.success, true);
    assert.equal(state.message, 'Jika email terdaftar, tautan pemulihan akan dikirim.');
    assert.equal(url, 'https://school.example/auth/callback?next=/reset-password');
  }
});
test('auth origin allows actual local/LAN/production hosts and rejects external or malformed origins', async () => {
  for (const [origin, host, accepted] of [
    ['http://localhost:3000', 'localhost:3000', true],
    ['http://10.10.33.202:3000', '10.10.33.202:3000', true],
    ['https://school.example', 'school.example', true],
    ['https://evil.example', 'school.example', false],
    ['https://school.example/path', 'school.example', false],
    ['null', 'school.example', false],
  ]) {
    const { authOrigin } = load('src/lib/auth-origin.ts', { 'server-only': {}, 'next/headers': { headers: async () => new Headers({ origin, host }) } });
    if (accepted) assert.equal(await authOrigin(), origin);
    else await assert.rejects(authOrigin());
  }
});

const settings = load('src/lib/settings.ts');
const appConfig = load('src/config/app.ts');
function settingsFixture({ admin = true, details = {}, updateError = null, saved = true } = {}) {
  const updates = [];
  const cookieWrites = [];
  const calls = [];
  const context = {
    user: { id: 'authenticated-user' }, membership: { school_id: 'active-school', role: admin ? 'super_admin' : 'operator' },
    supabase: {
      from(table) {
        let operation;
        const query = {
          update(payload) { operation = { table, payload, filters: [] }; updates.push(operation); return query; },
          eq(name, value) { operation.filters.push([name, value]); return query; },
          select() { return query; },
          async maybeSingle() { return { data: saved ? { id: 'saved' } : null, error: updateError }; },
        };
        return query;
      },
      auth: { async updateUser(payload) { calls.push(['updateUser', payload]); return { error: updateError }; }, async signOut(options) { calls.push(['signOut', options]); return { error: updateError }; } },
    },
  };
  const actions = load('src/app/dashboard/settings/actions.ts', {
    'next/headers': { cookies: async () => ({ set: (...args) => cookieWrites.push(args), delete: (name) => cookieWrites.push(['delete', name]) }) },
    'next/cache': { revalidatePath() {} },
    'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
    '@/lib/auth': { requireUser: async () => context, requireActiveMembership: async () => context, requireCapability: async (capability) => { if (capability === "school.update" && !admin) throw new Error('FORBIDDEN'); return context; } },
    '@/lib/school': { getSchoolContext: async () => ({ details }) },
    '@/config/app': appConfig, '@/lib/recovery': recovery, '@/lib/errors': errors, '@/lib/settings': settings,
  });
  return { ...actions, updates, cookieWrites, calls };
}
test('profile mutation uses only authenticated id and editable fields', async () => {
  const fixture = settingsFixture();
  const result = await fixture.saveProfile(settings.settingsInitial, formData({ full_name: 'New name', phone: '+62 800', user_id: 'attacker', id: 'other', role: 'super_admin', school_id: 'other-school', status: 'active' }));
  assert.equal(result.success, true);
  assert.deepEqual(fixture.updates[0].filters, [['id', 'authenticated-user']]);
  assert.deepEqual(Object.keys(fixture.updates[0].payload).sort(), ['full_name', 'phone', 'updated_at']);
});
test('profile rejects invalid input and never reports zero updated rows as success', async () => {
  const fixture = settingsFixture({ saved: false });
  assert.equal((await fixture.saveProfile(settings.settingsInitial, formData({ full_name: '', phone: 'invalid' }))).success, false);
  assert.equal(fixture.updates.length, 0);
  assert.equal((await fixture.saveProfile(settings.settingsInitial, formData({ full_name: 'Valid' }))).success, false);
});
test('school editing is admin-only, tenant-scoped and rejects identity fields', async () => {
  const blocked = settingsFixture({ admin: false });
  await assert.rejects(blocked.saveSchool(settings.settingsInitial, formData({ name: 'School' })), /FORBIDDEN/);
  assert.equal(blocked.updates.length, 0);
  const fixture = settingsFixture();
  const result = await fixture.saveSchool(settings.settingsInitial, formData({ name: 'School', id: 'other', slug: 'changed', is_active: 'false', logo_path: 'untrusted', school_id: 'other' }));
  assert.equal(result.success, true);
  assert.deepEqual(fixture.updates[0].filters, [['id', 'active-school']]);
  for (const key of ['id', 'slug', 'school_id', 'is_active', 'logo_path']) assert.equal(fixture.updates[0].payload[key], undefined);
});
test('school editing fails safely without details and validates supplied metadata', async () => {
  const fixture = settingsFixture({ details: null });
  assert.equal((await fixture.saveSchool(settings.settingsInitial, formData({ name: 'School' }))).success, false);
  assert.equal(fixture.updates.length, 0);
  const invalid = settings.schoolInput(formData({ name: '', npsn: 'abc', email: 'not-email', address: 'x'.repeat(1001) }));
  assert.ok(invalid.fieldErrors.name && invalid.fieldErrors.npsn && invalid.fieldErrors.email && invalid.fieldErrors.address);
});
test('password change validates confirmation and sends current password only to normal Auth', async () => {
  const fixture = settingsFixture();
  const invalid = await fixture.changePassword(settings.settingsInitial, formData({ current_password: 'old-pass', password: 'short', confirmation: 'different' }));
  assert.equal(invalid.success, false);
  assert.equal(fixture.calls.length, 0);
  const result = await fixture.changePassword(settings.settingsInitial, formData({ current_password: 'old-pass', password: 'new-password', confirmation: 'new-password', user_id: 'other' }));
  assert.equal(result.success, true);
  assert.equal(fixture.calls[0][0], 'updateUser');
  assert.equal(fixture.calls[0][1].current_password, 'old-pass');
  assert.equal(fixture.calls[0][1].user_id, undefined);
  assert.doesNotMatch(JSON.stringify(result), /new-password|old-pass/);
});
test('appearance only writes allowlisted non-sensitive cookies and never database data', async () => {
  const fixture = settingsFixture();
  assert.equal((await fixture.saveAppearance(settings.settingsInitial, formData({ theme: 'unsafe' }))).success, false);
  assert.equal(fixture.cookieWrites.length, 0);
  assert.equal((await fixture.saveAppearance(settings.settingsInitial, formData({ theme: 'dark', compact: 'on', school_id: 'other' }))).success, true);
  assert.deepEqual(fixture.cookieWrites.map((item) => item.slice(0, 2)), [['school-ui-theme', 'dark'], ['school-ui-compact', 'true']]);
  assert.equal(fixture.updates.length, 0);
});
test('global logout requires explicit confirmation and uses normal Auth global scope', async () => {
  const fixture = settingsFixture();
  assert.equal((await fixture.logoutAll(settings.settingsInitial, formData({}))).success, false);
  assert.equal(fixture.calls.length, 0);
  await assert.rejects(fixture.logoutAll(settings.settingsInitial, formData({ confirm: 'on' })), /REDIRECT:\/login/);
  assert.equal(fixture.calls[0][1].scope, 'global');
});
test('local logout does not revoke other sessions', async () => {
  const fixture = settingsFixture();
  await assert.rejects(fixture.logoutSession(), /REDIRECT:\/login/);
  assert.equal(fixture.calls[0][1].scope, 'local');
});

function schoolFixture(optionalError = null, feedbackError = null) {
  const filters = [];
  const context = { user: { id: 'me' }, membership: { school_id: 'school-a' }, supabase: { from(table) {
    let columns;
    const query = {
      select(value) { columns = value; return query; }, eq(name, value) { filters.push([table, name, value]); return query; }, order() { return query; },
      async maybeSingle() { return columns.startsWith('id,') ? { data: { id: 'school-a', name: 'School' }, error: null } : { data: null, error: optionalError }; },
      async limit(count) { filters.push(['limit', count]); return { data: [], error: feedbackError }; },
    }; return query;
  } } };
  const result = load('src/lib/school.ts', { 'server-only': {}, react: { cache: (fn) => fn }, '@/lib/auth': { requireCapability: async () => context }, '@/lib/errors': errors });
  return { ...result, filters };
}
test('school details reuse centralized tenant school without another query', async () => {
  const school = { id: 'school-a', name: 'School', address: null };
  const { getSchoolContext } = load('src/lib/school.ts', { 'server-only': {}, react: { cache: (fn) => fn }, '@/lib/auth': { requireCapability: async () => ({ school }) }, '@/lib/errors': errors });
  assert.equal((await getSchoolContext()).details, school);
});
test('activity feedback is user+tenant scoped and bounded; missing 005 is an empty state', async () => {
  const fixture = schoolFixture(null, { code: 'PGRST205' });
  assert.equal((await fixture.getOwnFeedback()).length, 0);
  assert.ok(fixture.filters.some((item) => item[1] === 'school_id' && item[2] === 'school-a'));
  assert.ok(fixture.filters.some((item) => item[1] === 'user_id' && item[2] === 'me'));
  assert.ok(fixture.filters.some((item) => item[0] === 'limit' && item[1] === 20));
  await assert.rejects(schoolFixture(null, { code: 'outage' }).getOwnFeedback(), /Layanan/);
});

const feedbackHelpers = load('src/lib/feedback.ts', { '@/config/app': appConfig, '@/lib/redirect': redirect });
test('feedback context stores only safe internal pathnames without sensitive query/fragment', () => {
  assert.equal(feedbackHelpers.feedbackPath('/dashboard/profile?token=secret#private'), '/dashboard/profile');
  for (const path of ['https://evil.example', '//evil.example', '/\\evil.example', '/%2f%2fevil.example', 'x'.repeat(1001), null]) assert.equal(feedbackHelpers.feedbackPath(path), null);
});
test('navigation keeps users admin-only and master data unavailable to parents', () => {
  const { navigationForRole } = load('src/config/navigation.ts', { './app': appConfig });
  for (const role of ['super_admin', 'kepala_sekolah', 'operator', 'guru', 'orang_tua']) {
    const groups = navigationForRole(role);
    const paths = groups.flatMap((group) => group.items.map((item) => item.href));
    assert.equal(paths.includes(appConfig.APP_CONFIG.routes.users), ['super_admin', 'kepala_sekolah'].includes(role));
    assert.equal(paths.includes(appConfig.APP_CONFIG.routes.master), role !== 'orang_tua');
    assert.ok(paths.includes(appConfig.APP_CONFIG.routes.profile));
    assert.ok(groups.every((group) => group.items.length > 0));
  }
});
test('feedback insertion is own-tenant scoped and missing 005 gives a safe actionable message', async () => {
  let payload;
  const { submitFeedback } = load('src/app/dashboard/feedback/actions.ts', {
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect() {} },
    '@/config/app': appConfig, '@/lib/feedback': feedbackHelpers,
    '@/lib/auth': { requireCapability: async () => ({ user: { id: 'me' }, membership: { school_id: 'mine' }, supabase: { from: () => ({ insert: async (input) => { payload = input; return { error: { code: 'PGRST205', message: 'raw detail' } }; } }) } }) },
  });
  const state = await submitFeedback({ success: false, error: '' }, formData({ type: 'suggestion', title: 'Test', message: 'Test message', current_path: '/dashboard?secret=hidden', user_id: 'other', school_id: 'other' }));
  assert.equal(payload.user_id, 'me');
  assert.equal(payload.school_id, 'mine');
  assert.equal(payload.current_path, '/dashboard');
  assert.equal(payload.status, 'open');
  assert.equal(state.success, false);
  assert.equal(state.error, feedbackHelpers.feedbackUnavailable);
  assert.doesNotMatch(state.error, /raw detail/);
});

test('feedback status update cannot report success when tenant-scoped update returns no row', async () => {
  const query = { update() { return query; }, eq() { return query; }, select() { return query; }, async maybeSingle() { return { data: null, error: null }; } };
  const { updateFeedbackStatus } = load('src/app/dashboard/feedback/actions.ts', {
    'next/cache': { revalidatePath() { throw new Error('must not revalidate failed update'); } },
    'next/navigation': { redirect: (path) => { throw new Error(path); } },
    '@/config/app': appConfig, '@/lib/feedback': feedbackHelpers,
    '@/lib/auth': { requireCapability: async () => ({ membership: { role: 'super_admin', school_id: 'mine' }, supabase: { from: () => query } }) },
  });
  await assert.rejects(updateFeedbackStatus(formData({ id: 'foreign-id', status: 'resolved' })), /error=update/);
});

test('school input normalizes optional blanks and trims values before validation', () => {
  const values = Object.fromEntries(settings.editableSchoolFields.map((key) => [key, '   ']));
  values.name = '  School  ';
  const blank = settings.schoolInput(formData(values));
  assert.equal(blank.payload.name, 'School');
  assert.equal(Object.keys(blank.fieldErrors).length, 0);
  for (const key of settings.editableSchoolFields.filter((key) => key !== 'name')) assert.equal(blank.payload[key], null, key);
  const trimmed = settings.schoolInput(formData({ name: ' School ', npsn: ' 12345678 ', email: ' Office@School.id ', phone: ' 021 ext 12 ' }));
  assert.equal(trimmed.payload.npsn, '12345678');
  assert.equal(trimmed.payload.email, 'Office@School.id');
  assert.equal(trimmed.payload.phone, '021 ext 12');
  assert.equal(Object.keys(trimmed.fieldErrors).length, 0);
  for (const name of ['', '   ', 'x'.repeat(201)]) assert.ok(settings.schoolInput(formData({ name })).fieldErrors.name);
  assert.ok(settings.schoolInput(formData({})).fieldErrors.name);
  assert.equal(settings.schoolInput(formData({ name: 'x'.repeat(200) })).fieldErrors.name, undefined);
});

test('school limits match database email, phone and NPSN constraints', () => {
  const email = 'a'.repeat(64) + '@' + 'b'.repeat(63) + '.' + 'c'.repeat(63) + '.' + 'd'.repeat(58) + '.id';
  assert.equal(email.length, 254);
  assert.equal(settings.schoolInput(formData({ name: 'School', email })).fieldErrors.email, undefined);
  assert.ok(settings.schoolInput(formData({ name: 'School', email: email + 'x' })).fieldErrors.email);
  assert.equal(settings.schoolInput(formData({ name: 'School', phone: '1'.repeat(40) })).fieldErrors.phone, undefined);
  assert.ok(settings.schoolInput(formData({ name: 'School', phone: '1'.repeat(41) })).fieldErrors.phone);
  for (const npsn of ['1234567', '123456789', 'abcdefgh', '1234 678']) assert.ok(settings.schoolInput(formData({ name: 'School', npsn })).fieldErrors.npsn);
});

test('school action sends normalized allowlisted payload and conceals database errors', async () => {
  const fixture = settingsFixture({ updateError: { message: 'PRIVATE DATABASE DETAILS', code: '42501' } });
  const result = await fixture.saveSchool(settings.settingsInitial, formData({ name: ' School ', npsn: ' ', role: 'super_admin', school_id: 'other', updated_at: '2099-01-01', created_at: '2099-01-01' }));
  assert.equal(result.success, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|42501/);
  assert.deepEqual(Object.keys(fixture.updates[0].payload).sort(), Array.from(settings.editableSchoolFields).sort());
  assert.equal(fixture.updates[0].payload.name, 'School');
  assert.equal(fixture.updates[0].payload.npsn, null);
  assert.deepEqual(fixture.updates[0].filters, [['id', 'active-school']]);
});

test('migration 006 statically preserves normalization, immutable columns and admin-only grants', () => {
  // Source assertions only: never connect to PostgreSQL or execute this migration.
  const sql = fs.readFileSync('supabase/migrations/202609150006_school_profile.sql', 'utf8');
  const trigger = sql.split('as $$')[1].split('$$;')[0];
  for (const key of settings.editableSchoolFields.filter((key) => key !== 'name')) {
    const assignment = `new.${key} := nullif(btrim(new.${key}), '');`;
    assert.ok(trigger.includes(assignment), key);
    assert.ok(trigger.indexOf(assignment) < trigger.indexOf('if new.'));
  }
  assert.match(trigger, /new\.name := btrim\(new\.name\);/);
  assert.match(trigger, /if new\.name is null or new\.name = '' or char_length\(new\.name\) > 200 then/);
  for (const key of ['id', 'slug', 'is_active', 'created_at', 'logo_path']) assert.ok(trigger.includes(`new.${key} is distinct from old.${key}`));
  assert.match(trigger, /new\.updated_at := now\(\);/);
  assert.match(sql, /revoke update on public\.schools from authenticated;/);
  const grants = [...sql.matchAll(/grant update \(([^)]+)\)\s+on public\.schools to authenticated;/g)];
  assert.equal(grants.length, 1);
  assert.deepEqual(grants[0][1].split(',').map((key) => key.trim()), Array.from(settings.editableSchoolFields));
  assert.match(sql, /alter table public\.schools enable row level security;/);
  const policy = sql.split('create policy "school admins can edit school profile"')[1].split(';')[0];
  const roles = [...policy.matchAll(/array\[([^\]]+)\]/g)].map((match) => match[1]);
  assert.deepEqual(roles, ["'super_admin', 'kepala_sekolah'", "'super_admin', 'kepala_sekolah'"]);
  assert.ok(sql.includes("npsn is null or npsn ~ '^[0-9]{8}$'"));
  assert.match(sql, /phone is null or char_length\(phone\) <= 40/);
  assert.match(sql, /email is null or char_length\(email\) <= 254/);
});

// In-memory database double applies query predicates; foreign rows really exist.
function tenantDatabase(rows, user = { id: 'user-a' }) {
  const calls = [];
  const client = { auth: { async getUser() { calls.push({ table: 'auth' }); return { data: { user }, error: null }; } }, from(table) {
    const call = { table, filters: [], operation: 'select' }; calls.push(call);
    const result = () => {
      const matched = (rows[table] ?? []).filter((row) => call.filters.every(([op, key, val]) => op === 'eq' ? row[key] === val : val.includes(row[key])));
      return { data: matched, error: null, count: matched.length };
    };
    const q = {
      select() { return q; }, eq(key, val) { call.filters.push(['eq', key, val]); return q; }, in(key, val) { call.filters.push(['in', key, val]); return q; }, order() { return q; },
      update(payload) { call.operation = 'update'; call.payload = payload; return q; }, delete() { call.operation = 'delete'; return q; }, insert(payload) { call.operation = 'insert'; call.payload = payload; return q; },
      async maybeSingle() { const r = result(); return { ...r, data: r.data[0] ?? null }; }, async single() { return q.maybeSingle(); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    }; return q;
  }, async rpc() { throw new Error('Unexpected RPC for rejected input'); } };
  return { client, calls };
}
const member = (school, status = 'active', user = 'user-a', role = 'super_admin') => ({ id: `m-${school}-${user}`, school_id: school, user_id: user, status, role });
const schoolRow = (id) => ({ id, name: id, is_active: true });
function tenantFixture(memberships, selected = '', extraSchools = [], cache = (fn) => fn) {
  const db = tenantDatabase({ profiles: [{ id: 'user-a' }], school_memberships: memberships, schools: [...new Set(memberships.map((m) => m.school_id))].map(schoolRow).concat(extraSchools) });
  const auth = load('src/lib/auth.ts', {
    'server-only': {}, react: { cache }, 'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: selected }) }) }, '@/config/app': appConfig, '@/lib/errors': errors,
    '@/utils/supabase/server': { createClient: async () => db.client },
  });
  return { ...auth, ...db };
}

test('tenant selection uses owned active memberships; stale or foreign cookie safely falls back', async () => {
  const memberships = [member('a'), member('b', 'active', 'user-b'), member('pending', 'pending'), member('suspended', 'suspended'), member('rejected', 'rejected')];
  for (const cookie of ['b', 'pending', 'suspended', 'rejected', 'invalid', '']) {
    const fixture = tenantFixture(memberships, cookie);
    const context = await fixture.getActiveTenantContext();
    assert.equal(context.school.id, 'a');
    assert.deepEqual(Array.from(context.tenantOptions, (item) => item.school.id), ['a']);
  }
});

test('multi-school selection honors selected membership role instead of first membership', async () => {
  const fixture = tenantFixture([member('a'), member('b', 'active', 'user-a', 'guru')], 'b');
  const context = await fixture.getActiveTenantContext();
  assert.equal(context.school.id, 'b');
  assert.equal(context.role, 'guru');
  await assert.rejects(fixture.requireCapability('users.manage'), /forbidden/);
});

test('account state resolves current memberships without relying on first membership', () => {
  const fixture = tenantFixture([member('a', 'pending')]);
  const activeTenant = [{ school: schoolRow('a'), membership: member('a') }];
  assert.equal(fixture.accountStateFromContext(null, [], []), 'unauthenticated');
  assert.equal(fixture.accountStateFromContext({ id: 'user-a' }, [member('a', 'pending')], []), 'pending');
  assert.equal(fixture.accountStateFromContext({ id: 'user-a' }, [member('a', 'rejected'), member('b', 'suspended')], []), 'suspended');
  assert.equal(fixture.accountStateFromContext({ id: 'user-a' }, [member('a', 'pending'), member('b', 'rejected')], []), 'rejected');
  assert.equal(fixture.accountStateFromContext({ id: 'user-a' }, [member('a', 'pending')], activeTenant), 'active');
  assert.equal(fixture.accountStateFromContext({ id: 'user-a' }, [], []), 'no_membership');
});

for (const status of ['pending', 'suspended', 'rejected']) test(`${status} membership alone never grants tenant access`, async () => {
  await assert.rejects(tenantFixture([member('a', status)], 'a').getActiveTenantContext(), /pending-approval/);
});

test('school switch action rejects foreign selection and writes only validated reference', async () => {
  const auth = tenantFixture([member('a'), member('b', 'active', 'user-a', 'guru'), member('c', 'suspended')]);
  const writes = [];
  const { switchSchool } = load('src/app/dashboard/tenant/actions.ts', {
    '@/lib/auth': auth, 'next/headers': { cookies: async () => ({ set: (...args) => writes.push(args) }) },
    'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } },
  });
  for (const school_id of ['foreign', 'c']) await assert.rejects(switchSchool(formData({ school_id, role: 'super_admin' })), /forbidden/);
  assert.equal(writes.length, 0);
  await assert.rejects(switchSchool(formData({ school_id: 'b', role: 'super_admin', next: 'https://evil.example' })), /^Error: REDIRECT:\/dashboard$/);
  assert.equal(writes[0][1], 'b');
  assert.equal(writes[0][2].httpOnly, true);
  assert.equal(writes[0][2].sameSite, 'lax');
});

const capabilities = load('src/lib/capabilities.ts');
test('capability matrix matches role restrictions and fails closed for inactive/unknown roles', () => {
  for (const role of appConfig.AUTH_ROLES) {
    const context = { membership: { role, status: 'active' } };
    const has = (cap) => capabilities.hasCapability(context, cap);
    assert.equal(has('school.update'), ['super_admin', 'kepala_sekolah'].includes(role));
    assert.equal(has('users.manage'), ['super_admin', 'kepala_sekolah'].includes(role));
    assert.equal(has('academic.manage'), ['super_admin', 'kepala_sekolah', 'operator'].includes(role));
    assert.equal(has('academic.delete'), ['super_admin', 'kepala_sekolah'].includes(role));
    assert.equal(has('feedback.manage'), ['super_admin', 'kepala_sekolah'].includes(role));
    assert.equal(has('feedback.delete'), role === 'super_admin');
    assert.equal(has('system.read'), role === 'super_admin');
    assert.equal(has('academic.read'), role !== 'orang_tua');
    assert.equal(has('profile.update_self'), true);
    assert.equal(has('unknown'), false);
    for (const status of ['pending', 'suspended', 'rejected']) assert.equal(capabilities.hasCapability({ membership: { role, status } }, 'dashboard.read'), false);
  }
  assert.equal(capabilities.hasCapability({ membership: { role: 'owner', status: 'active' } }, 'dashboard.read'), false);
});

test('System page is allowlisted, super-admin-only, and has no execution surface', () => {
  const systemSource = fs.readFileSync('src/app/dashboard/system/page.tsx', 'utf8');
  assert.match(systemSource, /requireCapability\("system\.read"\)/);
  assert.doesNotMatch(systemSource, /Object\.entries\(process\.env\)|SUPABASE_SECRET_KEY|DATABASE_PASSWORD|GOOGLE_CLIENT_SECRET/);
  assert.equal(fs.existsSync('src/app/api/terminal/route.ts'), false);
  assert.equal(fs.existsSync('src/app/api/exec/route.ts'), false);
  assert.equal(capabilities.hasCapability({ membership: { role: 'super_admin', status: 'active' } }, 'system.read'), true);
  for (const role of ['kepala_sekolah', 'operator', 'guru', 'orang_tua']) assert.equal(capabilities.hasCapability({ membership: { role, status: 'active' } }, 'system.read'), false);
  for (const status of ['pending', 'rejected', 'suspended']) assert.equal(capabilities.hasCapability({ membership: { role: 'super_admin', status } }, 'system.read'), false);
  const sourceFiles = fs.readdirSync('src', { recursive: true }).filter((file) => /\.(ts|tsx)$/.test(file));
  const source = sourceFiles.map((file) => fs.readFileSync(`src/${file}`, 'utf8')).join('\n');
  assert.doesNotMatch(source, /child_process|spawn\(|exec\(/i);
  assert.doesNotMatch(source, /localStorage|indexedDB|Cache API/i);
});

function academicFixture(role = 'guru', ownYear = true) {
  const db = tenantDatabase({ academic_years: [{ id: 'year-b', school_id: 'b', is_active: true }, ...(ownYear ? [{ id: 'year-a', school_id: 'a', is_active: true }] : [])], semesters: [{ id: 'term-b', school_id: 'b', academic_year_id: 'year-b', is_active: true }, { id: 'wrong-year', school_id: 'a', academic_year_id: 'old-year', is_active: true }, { id: 'term-a', school_id: 'a', academic_year_id: 'year-a', is_active: true }] });
  const context = { school: schoolRow('a'), membership: member('a', 'active', 'user-a', role), supabase: db.client };
  const academic = load('src/lib/academic.ts', { 'server-only': {}, react: { cache: (fn) => fn }, '@/lib/auth': { requireCapability: async () => context }, '@/lib/errors': errors });
  return { ...academic, ...db };
}
test('academic context binds year to school and semester to both school and selected year', async () => {
  const context = await academicFixture().getAcademicContext();
  assert.equal(context.academicYear.id, 'year-a');
  assert.equal(context.semester.id, 'term-a');
  const missing = await academicFixture('guru', false).getAcademicContext();
  assert.equal(missing.academicYear, null);
  assert.equal(missing.semester, null);
  const parent = academicFixture('orang_tua');
  assert.equal((await parent.getAcademicContext()).academicYear, null);
  assert.equal(parent.calls.length, 0);
});

function mutationFixture(role = 'super_admin') {
  const db = tenantDatabase({ academic_years: [{ id: 'year-a', school_id: 'a', start_date: '2026-01-01', end_date: '2026-12-31' }, { id: 'year-b', school_id: 'b' }], semesters: [{ id: 'term-b', school_id: 'b' }], classrooms: [{ id: 'class-b', school_id: 'b' }], feedbacks: [{ id: 'feedback-b', school_id: 'b' }], school_memberships: [member('b')] });
  const context = { user: { id: 'user-a' }, membership: member('a', 'active', 'user-a', role), supabase: db.client };
  const mocks = { '@/lib/auth': { ...appConfig, APP_ROLES: appConfig.AUTH_ROLES, requireCapability: async (cap) => { if (!capabilities.hasCapability(context, cap)) throw new Error('FORBIDDEN'); return context; } }, 'next/cache': { revalidatePath() {} }, 'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } }, '@/lib/feedback': feedbackHelpers, '@/config/app': appConfig, '@/lib/errors': errors, '@/lib/recovery': recovery, 'next/headers': {}, '@/utils/supabase/server': {} };
  return { ...db, ...load('src/app/dashboard/master/actions.ts', mocks), ...load('src/app/dashboard/feedback/actions.ts', mocks), ...load('src/app/auth/actions.ts', mocks) };
}
test('academic mutations reject foreign year, semester and classroom identifiers', async () => {
  const fixture = mutationFixture();
  const common = { name: 'Ganjil', start_date: '2026-02-01', end_date: '2026-06-01' };
  await assert.rejects(fixture.saveAcademicYear(formData({ ...common, id: 'year-b' })), /not-found/);
  await assert.rejects(fixture.saveSemester(formData({ ...common, academic_year_id: 'year-b' })), /date-range/);
  await assert.rejects(fixture.saveSemester(formData({ ...common, academic_year_id: 'year-a', id: 'term-b' })), /not-found/);
  await assert.rejects(fixture.saveClassroom(formData({ name: 'Class', academic_year_id: 'year-b' })), /year/);
  await assert.rejects(fixture.saveClassroom(formData({ name: 'Class', academic_year_id: 'year-a', id: 'class-b' })), /not-found/);
  assert.equal(fixture.calls.some((call) => call.operation !== 'select'), false);
});
test('foreign deletes and feedback updates cannot report success; membership target is tenant-checked', async () => {
  const fixture = mutationFixture();
  await assert.rejects(fixture.deleteAcademicYear(formData({ id: 'year-b' })), /error=delete/);
  await assert.rejects(fixture.deleteSemester(formData({ id: 'term-b' })), /error=delete/);
  await assert.rejects(fixture.deleteClassroom(formData({ id: 'class-b' })), /error=delete/);
  await assert.rejects(fixture.updateFeedbackStatus(formData({ id: 'feedback-b', status: 'closed' })), /error=update/);
  await assert.rejects(fixture.updateMembership(formData({ membership_id: 'm-b-user-a', status: 'active', role: 'super_admin' })), /not-found/);
  for (const call of fixture.calls.filter((item) => item.operation !== 'select')) assert.ok(call.filters.some(([, key, val]) => key === 'school_id' && val === 'a'));
});
test('administrative actions reject guru and parents; operator cannot delete', async () => {
  for (const role of ['guru', 'orang_tua', 'operator']) {
    const fixture = mutationFixture(role);
    await assert.rejects(fixture.deleteClassroom(formData({ id: 'class-b' })), /FORBIDDEN/);
    await assert.rejects(fixture.updateFeedbackStatus(formData({ id: 'feedback-b', status: 'closed' })), /FORBIDDEN/);
    if (role !== 'operator') await assert.rejects(fixture.saveClassroom(formData({ name: 'Class', academic_year_id: 'year-a' })), /FORBIDDEN/);
    assert.equal(fixture.calls.length, 0);
  }
});

test('request-scoped context deduplicates within render and rechecks identity and suspension next request', async () => {
  // Models React cache's per-request lifetime; no global memoization is used by app code.
  let requestCache = new Map();
  const cache = (fn) => (...args) => {
    if (!requestCache.has(fn)) requestCache.set(fn, fn(...args));
    return requestCache.get(fn);
  };
  let identity = { id: 'user-a' };
  const memberships = [member('a'), member('b', 'active', 'user-b')];
  const db = tenantDatabase({ profiles: [{ id: 'user-a' }, { id: 'user-b' }], school_memberships: memberships, schools: [schoolRow('a'), schoolRow('b')] });
  let authCalls = 0;
  db.client.auth.getUser = async () => { authCalls++; return { data: { user: identity }, error: null }; };
  const auth = load('src/lib/auth.ts', { 'server-only': {}, react: { cache }, 'next/navigation': { redirect: (path) => { throw new Error(`REDIRECT:${path}`); } }, 'next/headers': { cookies: async () => ({ get: () => ({ value: 'a' }) }) }, '@/config/app': appConfig, '@/lib/errors': errors, '@/utils/supabase/server': { createClient: async () => db.client } });
  const first = await auth.getActiveTenantContext();
  assert.equal(await auth.getActiveTenantContext(), first);
  assert.equal(authCalls, 1);
  assert.equal(db.calls.filter((call) => call.table === 'schools').length, 1);
  identity = { id: 'user-b' }; requestCache = new Map();
  const second = await auth.getActiveTenantContext();
  assert.equal(second.user.id, 'user-b');
  assert.equal(second.school.id, 'b');
  memberships[1].status = 'suspended'; requestCache = new Map();
  await assert.rejects(auth.getActiveTenantContext(), /pending-approval/);
  assert.equal(authCalls, 3);
});

test('inactive or deleted selected school cannot supply tenant context', async () => {
  const rows = { profiles: [{ id: 'user-a' }], school_memberships: [member('a'), member('inactive'), member('deleted')], schools: [schoolRow('a'), { ...schoolRow('inactive'), is_active: false }] };
  for (const selected of ['inactive', 'deleted']) {
    const db = tenantDatabase(rows);
    const auth = load('src/lib/auth.ts', { 'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': { redirect: (path) => { throw new Error(path); } }, 'next/headers': { cookies: async () => ({ get: () => ({ value: selected }) }) }, '@/config/app': appConfig, '@/lib/errors': errors, '@/utils/supabase/server': { createClient: async () => db.client } });
    assert.equal((await auth.getActiveTenantContext()).school.id, 'a');
  }
});
test('active academic year without an active semester returns a usable empty state', async () => {
  const db = tenantDatabase({ academic_years: [{ id: 'year-a', school_id: 'a', is_active: true }], semesters: [{ id: 'old', school_id: 'a', academic_year_id: 'year-a', is_active: false }] });
  const { getAcademicContext } = load('src/lib/academic.ts', { 'server-only': {}, react: { cache: (fn) => fn }, '@/lib/errors': errors, '@/lib/auth': { requireCapability: async () => ({ membership: member('a'), school: schoolRow('a'), supabase: db.client }) } });
  const context = await getAcademicContext();
  assert.equal(context.academicYear.id, 'year-a');
  assert.equal(context.semester, null);
});
test('Auth Admin email lookup fetches only supplied tenant-member IDs', async () => {
  const ids = [];
  const { getAuthEmails } = load('src/utils/supabase/admin.ts', { 'server-only': {}, './fetch': { supabaseFetch: async () => {} }, '@supabase/supabase-js': { createClient: () => ({ auth: { admin: { async getUserById(id) { ids.push(id); return { data: { user: { id, email: `${id}@test.invalid` } }, error: null }; } } } }) } }, { process: { env: { SUPABASE_SECRET_KEY: 'dummy-test-only', NEXT_PUBLIC_SUPABASE_URL: 'https://test.invalid' } } });
  assert.equal((await getAuthEmails(['one', 'one', 'two'])).size, 2);
  assert.deepEqual(ids, ['one', 'two']);
});

const auditFormat = load('src/lib/audit-format.ts');
test('audit metadata formatter only renders known fields and enum transitions', () => {
  const lines = auditFormat.auditMetadataLines({ changed_fields: ['full_name', 'password', 'access_token', 'full_name', 'cookie', 'description'], old_role: null, new_role: 'guru', old_status: 'pending', new_status: 'active', password: 'DO_NOT_RENDER', raw_session: { token: 'DO_NOT_RENDER' }, description: 'DO_NOT_RENDER' });
  assert.match(lines.join(' '), /Nama, Deskripsi/);
  assert.match(lines.join(' '), /Menunggu → Aktif/);
  assert.match(lines.join(' '), /Belum ditetapkan → Guru/);
  assert.doesNotMatch(lines.join(' '), /DO_NOT_RENDER|password|access_token|cookie|raw_session/);
  for (const value of [null, 'secret', ['secret'], 123]) assert.equal(auditFormat.auditMetadataLines(value).length, 0);
  assert.equal(auditFormat.auditActionLabel('raw secret action'), 'Perubahan tercatat');
  assert.equal(auditFormat.auditActionLabel('constructor'), 'Perubahan tercatat');
  assert.equal(auditFormat.auditEntityLabel('secret'), 'Entitas');
  assert.doesNotMatch(auditFormat.auditMetadataLines({ old_role: 'secret', new_role: { token: 'secret' } }).join(' '), /secret|token/);
});
function auditFixture({ role = 'super_admin', status = 'active', error = null, profileError = null, events = [], profiles = [] } = {}) {
  const calls = [];
  const context = { membership: member('a', status, 'user-a', role), supabase: { from(table) {
    const call = { table, filters: [], orders: [] }; calls.push(call);
    const query = { select(columns) { call.columns = columns; return query; }, eq(key, value) { call.filters.push([key, value]); return query; }, order(key, options) { call.orders.push([key, options]); return query; }, in(key, value) { call.filters.push([key, value]); return query; },
      async limit(count) { call.limit = count; return { data: events.filter((event) => call.filters.every(([key, value]) => event[key] === value)).slice(0, count), error }; },
      then(resolve, reject) { return Promise.resolve({ data: profiles, error: profileError }).then(resolve, reject); },
    }; return query;
  } } };
  const audit = load('src/lib/audit.ts', { 'server-only': {}, react: { cache: (fn) => fn }, '@/lib/errors': errors, '@/lib/auth': { requireCapability: async (cap) => { assert.equal(cap, 'audit.read'); if (!capabilities.hasCapability(context, cap)) throw new Error('FORBIDDEN'); return context; } } });
  return { ...audit, calls };
}
test('audit read capability is restricted to active super admin and principal', async () => {
  for (const role of ['operator', 'guru', 'orang_tua']) {
    const fixture = auditFixture({ role });
    await assert.rejects(fixture.getTenantAudit(), /FORBIDDEN/);
    assert.equal(fixture.calls.length, 0);
  }
  for (const role of ['super_admin', 'kepala_sekolah']) {
    assert.equal((await auditFixture({ role }).getTenantAudit()).available, true);
    await assert.rejects(auditFixture({ role, status: 'suspended' }).getTenantAudit(), /FORBIDDEN/);
  }
});
test('audit reads only active tenant with bounded results and safe actor lookup', async () => {
  const fixture = auditFixture({ events: [{ id: 'foreign', school_id: 'b', actor_user_id: 'foreign-user' }, { id: 'own', school_id: 'a', actor_user_id: 'user-a' }, { id: 'system', school_id: 'a', actor_user_id: null }, { id: 'deleted-actor', school_id: 'a', actor_user_id: 'deleted-user' }], profiles: [{ id: 'user-a', full_name: 'Current name' }] });
  const result = await fixture.getTenantAudit();
  assert.deepEqual(Array.from(result.events, (event) => event.id), ['own', 'system', 'deleted-actor']);
  assert.deepEqual(Array.from(result.events, (event) => event.actorLabel), ['Current name', 'Sistem', 'Pengguna (nama tidak tersedia)']);
  assert.deepEqual(fixture.calls[0].filters, [['school_id', 'a']]);
  assert.equal(fixture.calls[0].limit, 50);
  assert.deepEqual(fixture.calls[0].orders.map(([key]) => key), ['created_at', 'id']);
  assert.doesNotMatch(fixture.calls[0].columns, /\*/);
  assert.deepEqual(Array.from(fixture.calls[1].filters[0][1]), ['user-a', 'deleted-user']);
});
test('unapplied 007 degrades gracefully but other audit errors are generic failures', async () => {
  for (const code of ['42P01', 'PGRST205']) {
    const fixture = auditFixture({ error: { code, message: 'PRIVATE SQL DETAIL' } });
    const result = await fixture.getTenantAudit();
    assert.equal(result.available, false);
    assert.equal(result.events.length, 0);
    assert.equal(fixture.calls.length, 1);
  }
  for (const code of ['42501', '42703', 'network']) {
    await assert.rejects(auditFixture({ error: { code, message: 'PRIVATE SQL DETAIL' } }).getTenantAudit(), (error) => error.message === errors.USER_MESSAGES.SERVICE_UNAVAILABLE);
  }
});
test('Activity UI keeps administrative audit hidden from other roles and handles missing schema', async () => {
  const { renderToStaticMarkup } = loadDependency('react-dom/server');
  for (const role of ['super_admin', 'kepala_sekolah', 'operator', 'guru', 'orang_tua']) {
    let reads = 0;
    const { default: Page } = load('src/app/dashboard/activity/page.tsx', {
      '@/lib/auth': { requireCapability: async (cap) => { assert.equal(cap, 'activity.read'); return { user: {}, profile: {}, membership: member('a', 'active', 'user-a', role) }; } },
      '@/lib/school': { getOwnFeedback: async () => [] }, '@/lib/shell': { dateLabel: (date) => date },
      '@/lib/audit': { getTenantAudit: async () => { reads++; return { available: false, events: [] }; } }, '@/lib/audit-format': auditFormat,
      '@/components/dashboard/ui': { Page: 'main', Card: 'section' },
    });
    const html = renderToStaticMarkup(await Page());
    const admin = ['super_admin', 'kepala_sekolah'].includes(role);
    assert.equal(reads, admin ? 1 : 0);
    assert.equal(html.includes('Riwayat perubahan sekolah belum tersedia'), admin);
    assert.ok(html.includes('Ringkasan akun Anda'));
  }
});

const auditMigrationPath = 'supabase/migrations/202609160007_audit_data_integrity.sql';
const auditSql = fs.readFileSync(auditMigrationPath, 'utf8').replace(/--[^\n]*/g, '');
test('007 static security: audit table has tenant RLS, explicit FK retention and only SELECT grants', () => {
  assert.match(auditSql, /school_id uuid not null references public\.schools\(id\) on delete restrict/);
  assert.match(auditSql, /actor_user_id uuid,/);
  assert.match(auditSql, /created_at timestamptz not null default now\(\)/);
  assert.match(auditSql, /alter table public\.audit_logs enable row level security/);
  assert.match(auditSql, /revoke all on public\.audit_logs from public, anon, authenticated/);
  assert.match(auditSql, /grant select on public\.audit_logs to authenticated/);
  assert.doesNotMatch(auditSql, /grant\s+(?:all|insert|update|delete|truncate)/i);
  const policies = [...auditSql.matchAll(/create policy[\s\S]*?;/g)];
  assert.equal(policies.length, 1);
  assert.match(policies[0][0], /for select to authenticated/);
  assert.match(policies[0][0], /has_school_role\(school_id, array\['super_admin', 'kepala_sekolah'\]/);
  assert.match(auditSql, /audit_logs\(school_id, created_at desc, id desc\)/);
});
test('007 static security: append-only guards, trusted actor/timestamp, no direct callable writer', () => {
  assert.match(auditSql, /before update or delete on public\.audit_logs/);
  assert.doesNotMatch(auditSql, /before truncate|service_role|reject_audited_truncate/);
  assert.match(auditSql, /if TG_OP <> 'INSERT' then\s+raise exception/);
  assert.match(auditSql, /TG_TABLE_NAME <> 'audit_logs'\s+or TG_WHEN <> 'BEFORE' or TG_LEVEL <> 'ROW' then\s+raise exception/);
  assert.match(auditSql, /new\.actor_user_id := auth\.uid\(\);/);
  assert.match(auditSql, /new\.created_at := now\(\);/);
  assert.equal([...auditSql.matchAll(/security definer/gi)].length, 1);
  assert.match(auditSql, /security definer set search_path = pg_catalog/);
  for (const fn of ['guard_audit_log', 'capture_foundation_audit']) assert.ok(auditSql.includes(`revoke all on function public.${fn}() from public, anon, authenticated;`));
  assert.doesNotMatch(auditSql, /create (?:or replace )?function[^\n]*\([^)]*uuid/);
  assert.doesNotMatch(auditSql, /current_setting|request\.headers|cookie|execute format|exception when/i);
});
test('007 static security: audit coverage coexists with existing triggers and stores only allowlisted metadata', () => {
  const expected = { profiles: 'update', schools: 'update', school_memberships: 'update', academic_years: 'insert or update or delete', semesters: 'insert or update or delete', classrooms: 'insert or update or delete', feedbacks: 'insert or update or delete' };
  for (const [table, operations] of Object.entries(expected)) assert.ok(auditSql.includes(`create trigger ${table}_audit after ${operations} on public.${table}`));
  assert.doesNotMatch(auditSql, /drop trigger|disable trigger|create or replace function/);
  assert.match(auditSql, /TG_TABLE_SCHEMA <> 'public'/);
  assert.match(auditSql, /TG_WHEN <> 'AFTER'/);
  assert.match(auditSql, /metadata - array\['changed_fields', 'old_status', 'new_status', 'old_role', 'new_role'\]/);
  assert.match(auditSql, /source_row := case when TG_OP = 'INSERT' then after_row else before_row end/);
  assert.match(auditSql, /where m\.user_id = record_id and m\.status = 'active'::public\.membership_status/);
  assert.match(auditSql, /tenant_id := case when TG_TABLE_NAME = 'schools' then record_id else \(source_row ->> 'school_id'\)::uuid end/);
  assert.equal([...auditSql.matchAll(/values \(tenant_id, auth\.uid\(\)/g)].length, 3);
  assert.doesNotMatch(auditSql, /values[^;]*(?:before_row\s*[,)]|after_row\s*[,)]|source_row\s*[,)]|new\.(?:phone|email|full_name))/);
  assert.doesNotMatch(auditSql, /password|access_token|refresh_token|raw_user_meta_data|session|secret|current_path|stack/i);
  assert.match(auditSql, /if cardinality\(changed_fields\) = 0 then return null/);
  assert.match(auditSql, /'membership\.role_changed'/);
  assert.match(auditSql, /'feedback\.status_changed'/);
  assert.match(auditSql, /'\.activated' else '\.deactivated'/);
  assert.match(auditSql, /^\s*begin;/);
  assert.match(auditSql, /commit;\s*$/);
});

test('applied migrations 001–006 match the immutable pre-stage-B checksum manifest', () => {
  const { createHash } = loadDependency('node:crypto');
  const checksums = JSON.parse(fs.readFileSync('tests/fixtures/applied-migrations-001-006.json', 'utf8'));
  assert.equal(Object.keys(checksums).length, 6);
  // Compare canonical LF content; Git core.autocrlf may materialize CRLF on Windows.
  for (const [path, expected] of Object.entries(checksums)) assert.equal(createHash('sha256').update(fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n')).digest('hex'), expected, path);
  assert.equal(fs.readdirSync('supabase/migrations').some((file) => /^\d{8}0008_/.test(file)), false);
});

test('007 rejects identity rewrites and revokes application TRUNCATE without restricting maintenance', () => {
  const guard = auditSql.indexOf("if before_row -> 'id' is distinct from after_row -> 'id'");
  assert.ok(guard > 0 && guard < auditSql.indexOf('foreach field_name'));
  assert.match(auditSql, /or before_row -> 'school_id' is distinct from after_row -> 'school_id' then\s+raise exception/);
  const revoke = auditSql.match(/revoke truncate on ([\s\S]*?)from public, anon, authenticated;/);
  assert.ok(revoke);
  assert.deepEqual(revoke[1].split(',').map((name) => name.trim()), ['audit_logs', 'profiles', 'schools', 'school_memberships', 'academic_years', 'semesters', 'classrooms', 'feedbacks'].map((name) => `public.${name}`));
  assert.doesNotMatch(auditSql, /before truncate|_no_truncate|reject_audited_truncate|service_role/);
});
test('audit taxonomy has labels for every supported foundation event', () => {
  const expected = {
    profile: ['updated'], school: ['updated'], membership: ['approved', 'rejected', 'suspended', 'updated', 'role_changed'],
    academic_year: ['created', 'updated', 'activated', 'deactivated', 'deleted'], semester: ['created', 'updated', 'activated', 'deactivated', 'deleted'],
    classroom: ['created', 'updated', 'deleted'], feedback: ['created', 'status_changed', 'deleted'],
  };
  for (const [entity, actions] of Object.entries(expected)) {
    assert.notEqual(auditFormat.auditEntityLabel(entity), 'Entitas');
    for (const action of actions) assert.notEqual(auditFormat.auditActionLabel(`${entity}.${action}`), 'Perubahan tercatat');
  }
});
test('audit actor lookup errors remain generic and are not misreported as missing audit schema', async () => {
  const fixture = auditFixture({ events: [{ id: 'own', school_id: 'a', actor_user_id: 'user-a' }], profileError: { code: '42501', message: 'PRIVATE PROFILE DETAIL' } });
  await assert.rejects(fixture.getTenantAudit(), (error) => error.message === errors.USER_MESSAGES.SERVICE_UNAVAILABLE);
});
test('Activity renders real audit fields safely and distinguishes empty audit from unavailable audit', async () => {
  const { renderToStaticMarkup } = loadDependency('react-dom/server');
  const events = [{ id: 'log-a', action: 'membership.role_changed', actorLabel: '<script>unsafe</script>', entity_type: 'membership', entity_id: 'membership-a', created_at: '2026-09-17T01:00:00Z', metadata: { changed_fields: ['role', 'password'], old_role: 'guru', new_role: 'operator', password: 'PRIVATE VALUE', raw_session: 'PRIVATE SESSION' } }];
  for (const rows of [events, []]) {
    const { default: Page } = load('src/app/dashboard/activity/page.tsx', {
      '@/lib/auth': { requireCapability: async () => ({ user: {}, profile: {}, membership: member('a') }) },
      '@/lib/school': { getOwnFeedback: async () => [] }, '@/lib/shell': { dateLabel: (value) => value },
      '@/lib/audit': { getTenantAudit: async () => ({ available: true, events: rows }) }, '@/lib/audit-format': auditFormat,
      '@/components/dashboard/ui': { Page: 'main', Card: 'section' },
    });
    const html = renderToStaticMarkup(await Page());
    assert.doesNotMatch(html, /PRIVATE|password|raw_session|<script>|belum tersedia/);
    if (rows.length) {
      assert.match(html, /Role membership diubah/);
      assert.match(html, /Guru → Operator/);
      assert.match(html, /membership-a/);
      assert.match(html, /2026-09-17T01:00:00Z/);
      assert.match(html, /&lt;script&gt;/);
    } else assert.match(html, /Belum ada perubahan yang tercatat/);
  }
});

// Static branch contracts for pending SQL: these tests do not execute a database
// or claim to prove PostgreSQL trigger behavior. Runtime cases remain in the
// disposable integration checklist.
const membershipBranch = auditSql.split("if TG_TABLE_NAME = 'school_memberships' and TG_OP = 'UPDATE' then")[1].split("elsif TG_TABLE_NAME in")[0];
const [membershipStatusBranch, membershipRoleOnlyBranch] = membershipBranch.split(/\r?\n    else\r?\n/);
const membershipExtraRole = auditSql.split('if role_changed then')[1].split('end if;')[0];

test('membership status-only SQL contract emits status metadata without role metadata', () => {
  assert.match(membershipStatusBranch, /if before_row -> 'status' is distinct from after_row -> 'status' then/);
  assert.match(membershipStatusBranch, /when 'active' then 'approved' when 'rejected' then 'rejected'/);
  assert.match(membershipStatusBranch, /when 'suspended' then 'suspended' else 'updated'/);
  assert.match(membershipStatusBranch, /event_metadata := jsonb_build_object\('changed_fields', array\['status'\],\s*'old_status', before_row -> 'status', 'new_status', after_row -> 'status'\);/);
  assert.doesNotMatch(membershipStatusBranch, /'old_role'|'new_role'|event_metadata \|\|/);
  // With unchanged role this expression is false, so the extra role insert cannot run.
  assert.match(membershipStatusBranch, /role_changed := before_row -> 'role' is distinct from after_row -> 'role';/);
});
test('membership role-only SQL contract emits exactly the primary role event', () => {
  assert.match(auditSql, /role_changed boolean := false;/);
  assert.match(membershipRoleOnlyBranch, /event_action := 'membership\.role_changed';/);
  assert.match(membershipRoleOnlyBranch, /event_metadata := jsonb_build_object\('changed_fields', array\['role'\],\s*'old_role', before_row -> 'role', 'new_role', after_row -> 'role'\);/);
  assert.doesNotMatch(membershipRoleOnlyBranch, /role_changed :=|'old_status'|'new_status'/);
});
test('membership status-plus-role SQL contract keeps the two event payloads disjoint', () => {
  assert.match(membershipStatusBranch, /'changed_fields', array\['status'\]/);
  assert.match(membershipStatusBranch, /role_changed := before_row -> 'role' is distinct from after_row -> 'role';/);
  assert.match(membershipExtraRole, /insert into public\.audit_logs/);
  assert.match(membershipExtraRole, /'membership\.role_changed'/);
  assert.match(membershipExtraRole, /jsonb_build_object\('changed_fields', array\['role'\], 'old_role', before_row -> 'role', 'new_role', after_row -> 'role'\)/);
  assert.doesNotMatch(membershipExtraRole, /event_metadata|'old_status'|'new_status'/);
  assert.equal([...auditSql.matchAll(/if role_changed then/g)].length, 1);
});

// Model committed row state so a failed second request cannot hide deactivation.
for (const entity of ['academic_year', 'semester']) {
  test(`${entity}: editing an active period preserves activation when RPC fails`, async () => {
    const row = { id: 'period-a', school_id: 'a', is_active: true };
    let rpcCalls = 0;
    const client = {
      from(table) {
        let payload;
        const q = {
          select() { return q; }, eq() { return q; },
          update(value) { payload = value; return q; },
          async maybeSingle() {
            if (entity === 'semester' && table === 'academic_years') return { data: { id: 'year-a', start_date: '2026-01-01', end_date: '2026-12-31' }, error: null };
            if (payload) Object.assign(row, payload);
            return { data: { ...row }, error: null };
          },
        };
        return q;
      },
      async rpc() { rpcCalls++; return { error: { code: 'unavailable' } }; },
    };
    const context = { supabase: client, membership: member('a'), user: { id: 'user-a' } };
    const actions = load('src/app/dashboard/master/actions.ts', {
      '@/lib/auth': { requireCapability: async () => context },
      'next/cache': { revalidatePath() {} },
      'next/navigation': { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    });
    const action = entity === 'academic_year' ? actions.saveAcademicYear : actions.saveSemester;
    const input = { id: row.id, academic_year_id: 'year-a', name: 'Ganjil', start_date: '2026-02-01', end_date: '2026-06-01', is_active: 'on' };
    await assert.rejects(action(formData(input)), /error=save/);
    assert.equal(rpcCalls, 1);
    assert.equal(row.is_active, true, 'failed activation must not deactivate the committed period');
    await assert.rejects(action(formData({ ...input, is_active: '' })), /success=saved/);
    assert.equal(row.is_active, false, 'explicit deactivation remains supported');
    assert.equal(rpcCalls, 1);
  });
}

async function recoveryFlowFixture() {
  const jar = new Map();
  let recoveryRedirect;
  let challenge;
  let exchanges = 0;
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-a' })).toString('base64url');
  const options = {
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)) },
    global: { fetch: async (input, init) => {
      const url = new URL(String(input));
      const body = JSON.parse(init?.body ?? '{}');
      if (url.pathname.endsWith('/recover')) {
        recoveryRedirect = new URL(url.searchParams.get('redirect_to'));
        challenge = body.code_challenge;
        return Response.json({});
      }
      if (url.pathname.endsWith('/token')) {
        exchanges++;
        const actual = loadDependency('node:crypto').createHash('sha256').update(body.code_verifier).digest('base64url');
        if (actual !== challenge) return Response.json({ code: 'bad_code_verifier', msg: 'private mismatch' }, { status: 422 });
        return Response.json({ access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: 'fake-refresh', token_type: 'bearer', expires_in: 3600, user: { id: 'user-a' } });
      }
      throw new Error('Unexpected request in offline fixture');
    } },
  };
  await createServerClient('https://test.invalid', 'test-publishable', options).auth.resetPasswordForEmail('test@example.invalid', { redirectTo: 'https://school.example/auth/callback?next=/reset-password' });
  const firstFlow = recoveryRedirect.searchParams.get('sb_flow_id');
  assert.ok(firstFlow);
  // Another tab starts Google login after the recovery email was sent.
  await createServerClient('https://test.invalid', 'test-publishable', options).auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://school.example/auth/callback', skipBrowserRedirect: true } });
  return { jar, firstFlow, auth: createServerClient('https://test.invalid', 'test-publishable', options).auth, exchanges: () => exchanges };
}

test('recovery callback selects its PKCE verifier after another OAuth flow starts', async () => {
  const fixture = await recoveryFlowFixture();
  const response = await callback(fixture.auth)(req(`code=fake-code&next=/reset-password&sb_flow_id=${fixture.firstFlow}`));
  assert.equal(response.headers.get('location'), 'https://school.example/reset-password');
  assert.equal(response.cookies.get(recovery.RECOVERY_COOKIE).value, 'user-a');
  assert.equal(fixture.exchanges(), 1);
});

function googleActions(origin = 'https://aplikasi-management-sekolah.vercel.app', result = { data: { url: 'https://test.invalid/auth/v1/authorize?provider=google' }, error: null }) {
  const calls = [];
  const actions = load('src/app/auth/google-actions.ts', {
    '@/lib/auth-origin': { authOrigin: async () => origin },
    '@/utils/supabase/server': { createClient: async (options) => { calls.push({ options }); return { auth: { async signInWithOAuth(input) { calls.push(input); if (result instanceof Error) throw result; return result; } } }; } },
    'next/navigation': { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
  });
  return { ...actions, calls };
}

test('Google login requests only identity scopes and redirects through the configured Supabase endpoint', async () => {
  for (const origin of ['https://aplikasi-management-sekolah.vercel.app', 'http://localhost:3000']) {
    const fixture = googleActions(origin);
    await assert.rejects(fixture.googleLoginAction(), /REDIRECT:https:\/\/test.invalid\/auth\/v1\/authorize\?provider=google/);
    assert.equal(fixture.calls[0].options.writable, true);
    const request = fixture.calls[1];
    assert.equal(request.provider, 'google');
    assert.equal(request.options.redirectTo, `${origin}/auth/callback?next=/dashboard&flow=google`);
    assert.equal(request.options.scopes, 'openid email profile');
    assert.equal(request.options.skipBrowserRedirect, true);
    assert.equal(request.options.queryParams.prompt, 'select_account');
    assert.doesNotMatch(JSON.stringify(request), /drive|gmail|calendar|contacts|offline|access_type|role|school_id/);
  }
});

test('Google login rejects untrusted application origins before creating a verifier', async () => {
  const fixture = googleActions('https://evil.example');
  const state = await fixture.googleLoginAction();
  assert.equal(state.success, false);
  assert.equal(fixture.calls.length, 0);
  assert.doesNotMatch(state.message, /evil/);
});

test('Google initiation provider errors and unexpected destinations are safe and generic', async () => {
  for (const result of [new Error('PRIVATE_TOKEN'), { data: { url: null }, error: { message: 'PRIVATE_TOKEN' } }, { data: { url: 'https://evil.example/auth/v1/authorize?provider=google' }, error: null }]) {
    const state = await googleActions(undefined, result).googleLoginAction();
    assert.equal(state.success, false);
    assert.doesNotMatch(state.message, /PRIVATE_TOKEN|evil/);
  }
});

test('Google button uses its OAuth server action with pending and duplicate-submit protection', async () => {
  const { renderToStaticMarkup } = loadDependency('react-dom/server');
  let actionInvoked = 0;
  const oauth = async () => { actionInvoked++; return { success: false, message: '' }; };
  const { GoogleLogin } = load('src/components/auth/google-login.tsx', {
    '@/app/auth/google-actions': { googleLoginAction: oauth }, '@/lib/auth-form': authForm,
    './auth-form': { FormAlert: () => null },
  });
  const html = renderToStaticMarkup(loadDependency('react').createElement(GoogleLogin));
  assert.match(html, /Lanjutkan dengan Google/);
  assert.match(html, /type="submit"/);
  assert.doesNotMatch(html, /type="password"/);
  assert.equal(actionInvoked, 0, 'rendering must not start OAuth');
  const source = fs.readFileSync('src/components/auth/google-login.tsx', 'utf8');
  assert.match(source, /useActionState\(googleLoginAction/);
  assert.match(source, /lock.current \|\| pending/);
  assert.match(source, /disabled=\{pending\}/);
});

test('main login page exposes direct Google signup/login without the registration form', () => {
  const source = fs.readFileSync('src/app/login/page.tsx', 'utf8');
  assert.match(source, /<GoogleLogin \/>/);
  assert.doesNotMatch(source, /RegisterForm|registerAction/);
  assert.match(source, /href="\/register"/);
});

test('OAuth callback exchanges exactly once, passes flow ID and never turns next into recovery', async () => {
  let calls = 0;
  const auth = authExchange('SIGNED_IN');
  const exchange = auth.exchangeCodeForSession;
  auth.exchangeCodeForSession = async (code, options) => {
    calls++; assert.equal(code, 'one-use'); assert.equal(options.flowId, 'abcdefgh'); return exchange();
  };
  const response = await callback(auth)(req('code=one-use&flow=google&sb_flow_id=abcdefgh&next=https://evil.example&role=super_admin&school_id=foreign'));
  assert.equal(calls, 1);
  assert.equal(response.headers.get('location'), 'https://school.example/dashboard');
  assert.equal(response.cookies.get(recovery.RECOVERY_COOKIE).value, '');
});

test('OAuth callback routes every account state from the authoritative resolver', async () => {
  const cases = [
    ['active', 'https://school.example/dashboard'],
    ['pending', 'https://school.example/pending-approval?status=pending'],
    ['rejected', 'https://school.example/pending-approval?status=rejected'],
    ['suspended', 'https://school.example/pending-approval?status=suspended'],
    ['no_membership', 'https://school.example/pending-approval?status=no_membership'],
  ];
  for (const [status, location] of cases) {
    const response = await callback(authExchange('SIGNED_IN'), status === 'active' ? { status, role: 'super_admin' } : { status, role: null })(req('code=test&flow=google'));
    assert.equal(response.headers.get('location'), location);
  }
  const source = fs.readFileSync('src/app/auth/callback/route.ts', 'utf8');
  assert.doesNotMatch(source, /insert\(|signUp|email/);
});

for (const status of ['pending', 'rejected', 'suspended']) {
  test(`Google ${status} membership remains outside the tenant even with privileged OAuth metadata`, async () => {
    const db = tenantDatabase({ profiles: [{ id: 'user-a' }], school_memberships: [member('a', status, 'user-a', null)], schools: [schoolRow('a')] }, {
      id: 'user-a', app_metadata: { provider: 'google' }, user_metadata: { role: 'super_admin', school_id: 'foreign', status: 'active' },
    });
    const auth = load('src/lib/auth.ts', {
      'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': { redirect(path) { throw new Error(path); } },
      'next/headers': { cookies: async () => ({ get: () => ({ value: 'foreign' }) }) },
      '@/config/app': appConfig, '@/lib/errors': errors,
      '@/utils/supabase/server': { createClient: async () => db.client },
    });
    assert.equal(await auth.getActiveMembership(), null);
    await assert.rejects(auth.getActiveTenantContext(), /pending-approval/);
    const response = await callback(authExchange('SIGNED_IN'), { status, role: null })(req('code=test&flow=google&role=super_admin&school_id=foreign'));
    assert.equal(response.headers.get('location'), `https://school.example/pending-approval?status=${status}`);
  });
}

test('Google user with no membership or inactive school receives no tenant access', async () => {
  for (const memberships of [[], [member('a')]]) {
    const context = tenantFixture(memberships);
    if (memberships.length) {
      const db = tenantDatabase({ profiles: [], school_memberships: memberships, schools: [{ ...schoolRow('a'), is_active: false }] });
      const auth = load('src/lib/auth.ts', { 'server-only': {}, react: { cache: (fn) => fn }, 'next/navigation': {}, 'next/headers': { cookies: async () => ({ get: () => undefined }) }, '@/config/app': appConfig, '@/lib/errors': errors, '@/utils/supabase/server': { createClient: async () => db.client } });
      assert.equal(await auth.getActiveMembership(), null);
    } else assert.equal(await context.getActiveMembership(), null);
  }
});

test('OAuth cancellation and provider errors do not exchange codes or echo details', async () => {
  for (const query of ['error=access_denied&error_description=PRIVATE_TOKEN', 'error_code=provider_error&code=unused', '']) {
    const response = await callback({})(req(`flow=google&${query}`));
    assert.equal(response.headers.get('location'), 'https://school.example/login?error=oauth');
    assert.doesNotMatch(response.headers.get('location'), /PRIVATE_TOKEN|unused|provider_error/);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  }
});

test('recovery errors distinguish unavailable verifier, expired flow and internal failure', async () => {
  for (const [error, category] of [
    [{ code: 'pkce_code_verifier_not_found' }, 'browser'], [{ code: 'bad_code_verifier', status: 422 }, 'browser'],
    [{ code: 'flow_state_expired' }, 'invalid'], [{ code: 'flow_state_not_found' }, 'invalid'],
    [{ code: 'unexpected_failure', status: 500 }, 'service'], [{ status: 422 }, 'service'],
  ]) {
    const auth = { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), exchangeCodeForSession: async () => ({ data: {}, error: { ...error, message: 'PRIVATE_TOKEN' } }) };
    const response = await callback(auth)(req('next=/reset-password&code=test'));
    assert.equal(response.headers.get('location'), `https://school.example/reset-password?error=recovery-${category}`);
    const message = recovery.recoveryMessage(`recovery-${category}`);
    assert.doesNotMatch(message, /PRIVATE_TOKEN|422|500/);
    if (category !== 'invalid') assert.doesNotMatch(message, /kedaluwarsa|sudah tidak berlaku/);
  }
});

test('malformed explicit flow IDs cannot borrow the legacy verifier or exchange a code', async () => {
  for (const value of ['', 'bad', '../foreign', 'abcdefgh&sb_flow_id=ijklmnop']) {
    const response = await callback({})(req(`next=/reset-password&code=test&sb_flow_id=${value}`));
    assert.match(response.headers.get('location'), /error=recovery-browser$/);
  }
});

test('missing per-flow verifier fails before token exchange and preserves other flow cookies', async () => {
  const fixture = await recoveryFlowFixture();
  fixture.jar.delete(`sb-test-auth-token-flow-${fixture.firstFlow}-code-verifier`);
  const others = [...fixture.jar.keys()].filter((name) => name.includes('-flow-'));
  const response = await callback(fixture.auth)(req(`code=test&next=/reset-password&sb_flow_id=${fixture.firstFlow}`));
  assert.match(response.headers.get('location'), /error=recovery-browser$/);
  assert.equal(fixture.exchanges(), 0);
  for (const name of others) assert.ok(fixture.jar.has(name));
});

test('proxy leaves callback code exchange and old-session handling to the callback', async () => {
  const { proxy } = load('src/proxy.ts', {
    '@supabase/ssr': { createServerClient() { throw new Error('Must not initialize old session in callback proxy'); } },
    '@/utils/supabase/fetch': {},
  });
  const response = await proxy(req('code=one-use'));
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('recovery legacy forwarding preserves flow ID and valid marker displays the form', async () => {
  const page = (marker, user) => load('src/app/reset-password/page.tsx', {
    'next/headers': { cookies: async () => ({ get: () => marker ? { value: marker } : undefined }) },
    'next/navigation': { redirect(path) { throw new Error(`REDIRECT:${path}`); } },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user }, error: null }) } }) },
    '@/lib/recovery': recovery, './reset-form': { ResetPasswordForm: () => null },
  }).default;
  await assert.rejects(page(null, null)({ searchParams: Promise.resolve({ code: 'one-use', sb_flow_id: 'abcdefgh' }) }), /sb_flow_id=abcdefgh/);
  const result = await page('user-a', { id: 'user-a' })({ searchParams: Promise.resolve({}) });
  assert.equal(result.props.ready, true);
  assert.equal(result.props.initialError, '');
  const missing = await page(null, null)({ searchParams: Promise.resolve({ error: 'recovery-service' }) });
  assert.equal(missing.props.ready, false);
  assert.equal(missing.props.initialError, recovery.RECOVERY_SERVICE_ERROR);
});

test('provider tokens are removed before the real SSR SDK writes session cookies', async () => {
  const jar = new Map();
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user-a' })).toString('base64url');
  const { supabaseFetch } = load('src/utils/supabase/fetch.ts', {}, { fetch: async () => Response.json({
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`, refresh_token: 'app-refresh', token_type: 'bearer', expires_in: 3600,
    provider_token: 'GOOGLE_ACCESS_SECRET', provider_refresh_token: 'GOOGLE_REFRESH_SECRET', user: { id: 'user-a' },
  }) });
  const client = createServerClient('https://test.invalid', 'test-key', {
    global: { fetch: supabaseFetch },
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (items) => items.forEach(({ name, value }) => jar.set(name, value)) },
  });
  await client.auth.signInWithOAuth({ provider: 'google', options: { skipBrowserRedirect: true } });
  const { data, error } = await client.auth.exchangeCodeForSession('fake-code');
  assert.equal(error, null);
  assert.equal(data.session.provider_token, undefined);
  assert.equal(data.session.provider_refresh_token, undefined);
  const encoded = jar.get('sb-test-auth-token');
  const session = JSON.parse(Buffer.from(encoded.slice('base64-'.length), 'base64url').toString());
  assert.equal(session.refresh_token, 'app-refresh');
  assert.doesNotMatch(JSON.stringify(session), /GOOGLE_|provider_token|provider_refresh_token/);
});

test('server client enables SDK flow IDs and treats writable cookie failures as errors', async () => {
  let options;
  const { createClient } = load('src/utils/supabase/server.ts', {
    './fetch': {}, '@supabase/ssr': { createServerClient(_url, _key, value) { options = value; return {}; } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set() { throw new Error('cookie write failed'); } }) },
  });
  await createClient({ writable: true });
  assert.equal(options.auth.experimental.appendPkceFlowIdToRedirects, true);
  assert.throws(() => options.cookies.setAll([{ name: 'test', value: 'test', options: {} }]), /cookie write failed/);
  await createClient();
  assert.doesNotThrow(() => options.cookies.setAll([{ name: 'test', value: 'test', options: {} }]));
});

test('new Google auth users inherit only the existing pending membership trigger contract', () => {
  const sql = fs.readFileSync('supabase/migrations/202609100002_auth_membership_security.sql', 'utf8');
  const trigger = sql.split('create or replace function public.handle_new_user()')[1].split('drop trigger')[0];
  assert.match(trigger, /values \(default_school_id, new.id, 'pending', null\)/);
  assert.match(trigger, /slug = 'kb-devfanta-melati'/);
  assert.doesNotMatch(trigger, /raw_user_meta_data\s*->>\s*'(role|school_id|status)'/);
  const actions = fs.readFileSync('src/app/auth/google-actions.ts', 'utf8');
  assert.doesNotMatch(actions, /service_role|createAdminClient|linkIdentity|auth\.admin|from\(/);
});

test('framework headers preserve no-referrer for callback and legacy reset URLs', async () => {
  const rules = await load('next.config.ts').default.headers();
  for (const path of ['/auth/callback', '/reset-password']) {
    const matching = rules.filter((rule) => rule.source === '/(.*)' || rule.source === path);
    const values = matching.flatMap((rule) => rule.headers.filter((header) => header.key === 'Referrer-Policy'));
    assert.equal(values.at(-1).value, 'no-referrer');
  }
});
