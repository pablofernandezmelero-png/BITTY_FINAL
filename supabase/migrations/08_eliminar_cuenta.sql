-- Bitty · migración 008: el usuario puede eliminar su propia cuenta
-- Requisito de privacidad (RGPD) y de Google Play. NO toca datos de nadie más: la función solo
-- actúa sobre auth.uid(), exige sesión AAL2 si la cuenta tiene 2FA, y no la puede llamar anon.
-- Al borrar la fila de auth.users, "on delete cascade" elimina progress, profiles, stats, xp_events
-- y question_history de ese usuario.
-- Se ejecuta DESPUÉS de las migraciones 003 y 007. Solo crea una función; no modifica datos.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not public.aal_ok() then
    raise exception 'mfa_required' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
