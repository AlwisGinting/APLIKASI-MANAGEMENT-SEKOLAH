-- Read-only assertions against the fresh, real Supabase system schemas.
set transaction read only;
do $$
begin
  if inet_server_addr() <> '127.0.0.1'::inet then raise exception 'loopback required'; end if;
  if to_regclass('auth.users') is null or to_regclass('storage.objects') is null
     or to_regclass('storage.buckets') is null or to_regprocedure('auth.uid()') is null
  then raise exception 'Supabase system schemas missing'; end if;
  if exists (select from pg_tables where schemaname = 'public')
     or exists (select from auth.users) or exists (select from storage.buckets)
     or to_regtype('public.membership_status') is not null
  then raise exception 'Database is not fresh'; end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists (select from supabase_migrations.schema_migrations) then
      raise exception 'Unexpected migration ledger';
    end if;
  end if;
end $$;
