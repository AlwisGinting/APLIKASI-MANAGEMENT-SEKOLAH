import assert from 'node:assert/strict';

// Local build with https://test.invalid Supabase configuration only.
// Does not follow the OAuth redirect or submit credentials to any provider.
const origin = process.argv[2] ?? 'http://localhost:3000';
assert.equal(origin, 'http://localhost:3000');
const unescape = (text) => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const response = await fetch(`${origin}/login`);
assert.equal(response.status, 200);
const html = await response.text();
const forms = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)];
assert.equal(forms.length, 2, 'Password and Google use separate forms');
assert.match(forms[0][2], /type="password"/);
assert.match(forms[1][2], /Lanjutkan dengan Google/);
assert.match(forms[1][1], /method="post"/i);
const action = unescape(forms[1][1].match(/action="([^"]*)"/i)?.[1] ?? '/login');
const target = new URL(action, origin);
assert.equal(target.origin, origin);
const data = new FormData();
for (const input of forms[1][2].matchAll(/<input\b[^>]*>/gi)) {
  const name = input[0].match(/name="([^"]*)"/i)?.[1];
  const value = input[0].match(/value="([^"]*)"/i)?.[1] ?? '';
  if (name?.startsWith('$ACTION_')) data.append(unescape(name), unescape(value));
}
assert.ok([...data.keys()].some((name) => name.startsWith('$ACTION_')));
const oauth = await fetch(target, { method: 'POST', headers: { Origin: origin }, body: data, redirect: 'manual' });
assert.equal(oauth.status, 303);
const location = new URL(oauth.headers.get('location'));
assert.equal(location.origin, 'https://test.invalid');
assert.equal(location.pathname, '/auth/v1/authorize');
assert.equal(location.searchParams.get('provider'), 'google');
assert.equal(location.searchParams.get('scopes'), 'openid email profile');
assert.equal(location.searchParams.get('code_challenge_method'), 's256');
assert.equal(location.searchParams.get('access_type'), null);
const callback = new URL(location.searchParams.get('redirect_to'));
assert.equal(callback.origin, origin);
assert.equal(callback.pathname, '/auth/callback');
assert.equal(callback.searchParams.get('next'), '/dashboard');
const flow = callback.searchParams.get('sb_flow_id');
assert.match(flow, /^[a-zA-Z0-9_-]{8,64}$/);
assert.ok(oauth.headers.getSetCookie().some((cookie) => cookie.startsWith(`sb-test-auth-token-flow-${flow}-code-verifier=`)), 'Verifier reaches the browser before redirect');
const csrf = await fetch(target, { method: 'POST', headers: { Origin: 'https://evil.invalid' }, body: data, redirect: 'manual' });
assert.ok(csrf.status >= 400);
assert.equal(csrf.headers.get('location'), null);
const cancel = await fetch(`${origin}/auth/callback?flow=google&error=access_denied&error_description=PRIVATE_TEST`, { redirect: 'manual' });
assert.equal(new URL(cancel.headers.get('location')).pathname + new URL(cancel.headers.get('location')).search, '/login?error=oauth');
assert.equal(cancel.headers.get('referrer-policy'), 'no-referrer');
const missing = await fetch(`${origin}/auth/callback?next=/reset-password&code=fake&sb_flow_id=abcdefgh`, { redirect: 'manual' });
assert.equal(new URL(missing.headers.get('location')).search, '?error=recovery-browser');
const reset = await fetch(`${origin}/reset-password?error=recovery-browser`);
assert.match(await reset.text(), /browser dan perangkat/);
console.log('PASS: native Google POST, PKCE cookie + flow redirect, separate password form, minimum scopes, CSRF rejection, cancellation and missing-verifier UX. No provider requests.');
