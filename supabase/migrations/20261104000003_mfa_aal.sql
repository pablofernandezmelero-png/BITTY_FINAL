-- Bitty · migración 003: exigir AAL2 a las cuentas con 2FA activado
-- ADITIVA: solo crea una función y políticas RESTRICTIVAS. No borra ni modifica datos.
-- Regla: si la cuenta tiene un factor TOTP verificado, solo las sesiones AAL2 (las que han
-- introducido el código de 6 dígitos) pueden leer o escribir sus datos. Las cuentas sin 2FA no cambian.
-- Requiere MFA/TOTP activado en Supabase (Authentication -> Sign In / Providers -> Multi-Factor).

create or replace function public.aal_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = auth.uid() and status = 'verified' and factor_type = 'totp'
      );
$$;
revoke all on function public.aal_ok() from public, anon;
grant execute on function public.aal_ok() to authenticated;

drop policy if exists "progress_require_aal" on public.progress;
drop policy if exists "profiles_require_aal" on public.profiles;
drop policy if exists "stats_require_aal" on public.stats;
create policy "progress_require_aal" on public.progress as restrictive for all to authenticated
  using (public.aal_ok()) with check (public.aal_ok());
create policy "profiles_require_aal" on public.profiles as restrictive for all to authenticated
  using (public.aal_ok()) with check (public.aal_ok());
create policy "stats_require_aal" on public.stats as restrictive for all to authenticated
  using (public.aal_ok()) with check (public.aal_ok());
