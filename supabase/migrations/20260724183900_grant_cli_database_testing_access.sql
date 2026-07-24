do $$
begin
  if exists (
    select 1
    from pg_roles
    where rolname = 'cli_login_postgres'
  ) then
    execute 'grant usage on schema extensions to cli_login_postgres';
  end if;
end;
$$;
