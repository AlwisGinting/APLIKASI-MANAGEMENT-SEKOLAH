import assert from 'node:assert/strict';

// Run against a local dev server. Invalid input prevents all signup mutations.
const origin = process.argv[2] ?? 'http://127.0.0.1:3101';
const target = new URL(origin);
assert.ok(['localhost', '127.0.0.1'].includes(target.hostname), 'Use a local test server');
const htmlUnescape = (text) => text.replaceAll('&quot;', '"').replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const page = await fetch(`${origin}/register`);
assert.equal(page.status, 200);
const html = await page.text();
const form = html.match(/<form\b([^>]*)>([\s\S]*?)<\/form>/i);
assert.ok(form, 'Register form rendered');
assert.match(form[1], /method="post"/i, 'Server-rendered form uses POST before hydration');
const action = htmlUnescape(form[1].match(/action="([^"]*)"/i)?.[1] ?? '/register');
const actionUrl = new URL(action, origin);
assert.equal(actionUrl.origin, origin);
const data = new FormData();
for (const input of form[2].matchAll(/<input\b[^>]*>/gi)) {
  const name = input[0].match(/name="([^"]*)"/i)?.[1];
  const value = input[0].match(/value="([^"]*)"/i)?.[1] ?? '';
  if (name?.startsWith('$ACTION_')) data.append(htmlUnescape(name), htmlUnescape(value));
}
assert.ok([...data.keys()].some((name) => name.startsWith('$ACTION_')), 'Server Action metadata present');
data.set('full_name', '');
data.set('email', 'invalid');
data.set('password', 'short');
data.set('confirmation', 'mismatch');
const response = await fetch(actionUrl, { method: 'POST', headers: { Origin: origin }, body: data });
assert.equal(response.status, 200);
const result = await response.text();
assert.match(result, /Kata sandi minimal 8 karakter/);
assert.match(result, /Konfirmasi kata sandi tidak sama/);
assert.match(result, /Masukkan alamat email yang valid/);
assert.match(result, /role="alert"/);
assert.match(result, /aria-invalid="true"/);
console.log('PASS: GET form renders POST action; native POST without JavaScript invokes server validation and accessible field errors. No signup attempted.');
