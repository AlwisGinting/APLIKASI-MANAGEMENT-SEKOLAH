import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

// Opt-in, local disposable Supabase only. No dotenv, service key, SQL, or writes.
test('real RLS: own school is visible and foreign tenant rows are hidden', { skip: process.env.RUN_LOCAL_RLS !== '1' }, async () => {
  const url = new URL(process.env.RLS_TEST_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Only local disposable Supabase is supported');
  assert.equal(url.protocol, 'http:');
  const key = process.env.RLS_TEST_PUBLISHABLE_KEY;
  assert.ok(key?.startsWith('sb_publishable_'), 'Use a publishable key, never a service secret');
  const token = process.env.RLS_TEST_USER_ACCESS_TOKEN;
  assert.ok(token, 'A normal authenticated test-user access token is required');
  const client = createClient(url.origin, key, { accessToken: async () => token, auth: { persistSession: false, autoRefreshToken: false } });
  const ownSchool = process.env.RLS_TEST_OWN_SCHOOL_ID;
  const foreignSchool = process.env.RLS_TEST_FOREIGN_SCHOOL_ID;
  assert.ok(ownSchool && foreignSchool && ownSchool !== foreignSchool);
  const { data: own, error } = await client.from('schools').select('id').eq('id', ownSchool);
  assert.equal(error, null);
  assert.equal(own.length, 1, 'Positive control: ordinary user must see own school');
  for (const table of ['schools', 'academic_years', 'semesters', 'classrooms', 'feedbacks', 'school_memberships']) {
    const { data, error: queryError } = await client.from(table).select('id').eq(table === 'schools' ? 'id' : 'school_id', foreignSchool);
    assert.equal(queryError, null, `${table}: query must succeed`);
    assert.equal(data.length, 0, `${table}: foreign rows must be hidden`);
  }
});
