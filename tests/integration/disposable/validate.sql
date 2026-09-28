-- Catalog verification only. This is NOT the later role/concurrency security suite.
set transaction read only;
do $$
declare r record; actual text[]; f oid; expected integer;
begin
  select array_agg(enumlabel::text order by enumsortorder) into actual
  from pg_enum where enumtypid = 'public.membership_status'::regtype;
  if actual is distinct from array['pending','approved','rejected','suspended','active'] then
    raise exception 'Enum ordering mismatch';
  end if;
  for r in select * from (values
    ('schools',2,0),('profiles',2,1),('school_memberships',3,3),
    ('academic_years',4,1),('semesters',4,3),('classrooms',4,2),
    ('feedbacks',5,2),('audit_logs',1,1)
  ) v(tbl, policies, fks) loop
    if not exists(select from pg_class where oid=to_regclass('public.'||r.tbl) and relrowsecurity) then
      raise exception 'Missing table/RLS: %',r.tbl;
    end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=r.tbl) <> r.policies then
      raise exception 'Policy count mismatch: %',r.tbl;
    end if;
    if (select count(*) from pg_constraint where conrelid=to_regclass('public.'||r.tbl) and contype='f' and convalidated) <> r.fks then
      raise exception 'FK count mismatch: %',r.tbl;
    end if;
  end loop;
  if (select count(*) from pg_constraint where conrelid in ('public.semesters'::regclass,'public.classrooms'::regclass)
      and contype='f' and cardinality(conkey)=2 and confrelid='public.academic_years'::regclass and confdeltype='r') <> 2 then
    raise exception 'Composite tenant FK mismatch';
  end if;
  if not exists(select from pg_constraint where conrelid='public.profiles'::regclass and confrelid='auth.users'::regclass and confdeltype='c')
    or not exists(select from pg_constraint where conrelid='public.audit_logs'::regclass and confrelid='public.schools'::regclass and confdeltype='r') then
    raise exception 'Auth/audit FK mismatch';
  end if;
  for r in select * from (values
    ('is_school_member(uuid)',true,true,true,'public'),
    ('has_school_role(uuid,public.app_role[])',true,true,true,'public'),
    ('prevent_membership_identity_change()',true,true,true,'public'),
    ('handle_new_user()',true,true,true,'public'),
    ('storage_school_id(text)',false,true,true,null),
    ('validate_academic_year_dates()',false,true,true,'public'),
    ('validate_semester_dates()',false,true,true,'public'),
    ('prevent_academic_master_school_change()',false,true,true,'public'),
    ('validate_classroom_school_year()',false,true,true,'public'),
    ('activate_academic_year(uuid)',false,false,true,'public'),
    ('activate_semester(uuid)',false,false,true,'public'),
    ('ensure_default_semesters(uuid,uuid,text,date,date,boolean)',true,false,false,'public'),
    ('create_default_semesters_for_year()',true,false,false,'public'),
    ('prevent_non_super_admin_semester_name_change()',false,false,false,'public'),
    ('protect_feedback_content()',false,false,false,'public'),
    ('protect_school_profile_update()',false,false,false,'public'),
    ('guard_audit_log()',false,false,false,'pg_catalog'),
    ('capture_foundation_audit()',true,false,false,'pg_catalog')
  ) v(signature,definer,public_exec,authenticated_exec,path) loop
    f := to_regprocedure('public.'||r.signature);
    if f is null then raise exception 'Missing function: %',r.signature; end if;
    if (select prosecdef from pg_proc where oid=f) <> r.definer
      or has_function_privilege('authenticated',f,'EXECUTE') <> r.authenticated_exec
      or exists(select from pg_proc p, lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
                where p.oid=f and a.grantee=0 and a.privilege_type='EXECUTE') <> r.public_exec then
      raise exception 'Function mode/EXECUTE mismatch: %',r.signature;
    end if;
    if r.path is not null and not exists(select from pg_proc where oid=f and ('search_path='||r.path)=any(proconfig)) then
      raise exception 'Function search_path mismatch: %',r.signature;
    end if;
    if not r.public_exec and not r.authenticated_exec and has_function_privilege('anon',f,'EXECUTE') then
      raise exception 'Unexpected anon function access';
    end if;
  end loop;
  for r in select * from (values
    ('auth.users','on_auth_user_created','handle_new_user'),
    ('public.school_memberships','school_memberships_identity_guard','prevent_membership_identity_change'),
    ('public.academic_years','academic_year_dates_guard','validate_academic_year_dates'),
    ('public.semesters','semesters_dates_guard','validate_semester_dates'),
    ('public.academic_years','academic_year_school_identity_guard','prevent_academic_master_school_change'),
    ('public.semesters','semesters_school_identity_guard','prevent_academic_master_school_change'),
    ('public.classrooms','classrooms_school_identity_guard','prevent_academic_master_school_change'),
    ('public.classrooms','classrooms_school_year_guard','validate_classroom_school_year'),
    ('public.academic_years','academic_year_default_semesters','create_default_semesters_for_year'),
    ('public.semesters','semesters_name_role_guard','prevent_non_super_admin_semester_name_change'),
    ('public.feedbacks','feedback_content_guard','protect_feedback_content'),
    ('public.schools','schools_profile_update_guard','protect_school_profile_update'),
    ('public.audit_logs','audit_logs_stamp','guard_audit_log'),
    ('public.audit_logs','audit_logs_immutable','guard_audit_log'),
    ('public.profiles','profiles_audit','capture_foundation_audit'),
    ('public.schools','schools_audit','capture_foundation_audit'),
    ('public.school_memberships','school_memberships_audit','capture_foundation_audit'),
    ('public.academic_years','academic_years_audit','capture_foundation_audit'),
    ('public.semesters','semesters_audit','capture_foundation_audit'),
    ('public.classrooms','classrooms_audit','capture_foundation_audit'),
    ('public.feedbacks','feedbacks_audit','capture_foundation_audit')
  ) v(tbl,trig,fn) loop
    if not exists(select from pg_trigger t join pg_proc p on p.oid=t.tgfoid
                  where t.tgrelid=to_regclass(r.tbl) and t.tgname=r.trig and not t.tgisinternal
                  and t.tgenabled='O' and p.proname=r.fn) then
      raise exception 'Missing/enabled trigger mismatch: %',r.trig;
    end if;
  end loop;
  if (select count(*) from storage.buckets) <> 4 or
    (select count(*) from storage.buckets where id in ('student-documents','teacher-documents','attendance-photos','avatars') and not public) <> 4 then
    raise exception 'Private buckets mismatch';
  end if;
  if not (select relrowsecurity from pg_class where oid='storage.objects'::regclass) or
    (select count(*) from pg_policies where schemaname='storage' and tablename='objects'
      and policyname like 'active tenant members can % private files' and roles=array['authenticated']::name[]) <> 4 then
    raise exception 'Storage policy mismatch';
  end if;
  if (select count(*) from public.schools) <> 1 or not exists(select from public.schools
    where id='00000000-0000-0000-0000-000000000001' and slug='kb-devfanta-melati' and name='KB DEVFANTA MELATI' and is_active) then
    raise exception 'Default school mismatch';
  end if;
  if exists(select from public.audit_logs) or has_table_privilege('authenticated','public.audit_logs','INSERT,UPDATE,DELETE,TRUNCATE')
    or not has_table_privilege('authenticated','public.audit_logs','SELECT') then
    raise exception 'Audit baseline/grants mismatch';
  end if;
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    if exists(select from supabase_migrations.schema_migrations) then raise exception 'Unexpected ledger entries'; end if;
  end if;
end $$;
