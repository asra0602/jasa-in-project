create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.register_as_seller(
  p_store_name text,
  p_store_slug text,
  p_bio text default '',
  p_qris_static_payload text default null
)
returns public.seller_profiles language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_seller public.seller_profiles;
begin
  if v_user_id is null then
    raise exception 'Autentikasi diperlukan.';
  end if;
  insert into public.seller_profiles (user_id, store_name, store_slug, bio, qris_static_payload, qris_enabled)
  values (v_user_id, trim(p_store_name), lower(trim(p_store_slug)), coalesce(p_bio, ''), nullif(trim(coalesce(p_qris_static_payload, '')), ''), (nullif(trim(coalesce(p_qris_static_payload, '')), '') is not null))
  on conflict (user_id) do update set
    store_name = excluded.store_name,
    store_slug = excluded.store_slug,
    bio = excluded.bio,
    qris_static_payload = coalesce(excluded.qris_static_payload, public.seller_profiles.qris_static_payload),
    qris_enabled = (coalesce(excluded.qris_static_payload, public.seller_profiles.qris_static_payload) is not null),
    updated_at = now()
  returning * into v_seller;
  update public.profiles
  set role = case when role = 'admin' then 'admin'::public.account_role else 'seller'::public.account_role end, updated_at = now()
  where id = v_user_id;
  return v_seller;
end;
$$;

create policy "profiles_select_public" on public.profiles for select using (true);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "seller_profiles_select_public" on public.seller_profiles for select using (true);
create policy "seller_profiles_insert_own" on public.seller_profiles for insert with check (auth.uid() = user_id);
create policy "seller_profiles_update_own" on public.seller_profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "services_select_published_or_owner" on public.services for select using (status = 'published' or auth.uid() = seller_id);
create policy "services_insert_seller" on public.services for insert with check (auth.uid() = seller_id);
create policy "services_update_seller" on public.services for update using (auth.uid() = seller_id) with check (auth.uid() = seller_id);
create policy "services_delete_seller" on public.services for delete using (auth.uid() = seller_id);

create policy "orders_select_participants" on public.orders for select using (auth.uid() = buyer_id or auth.uid() = seller_id);
create policy "orders_insert_buyer" on public.orders for insert with check (auth.uid() = buyer_id and auth.uid() <> seller_id);
create policy "orders_update_participants" on public.orders for update using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "order_items_select_participants" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or o.seller_id = auth.uid())));
create policy "order_items_insert_buyer" on public.order_items for insert with check (exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));

create policy "payments_select_participants" on public.payments for select using (auth.uid() = seller_id or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy "payments_insert_participants" on public.payments for insert with check (auth.uid() = seller_id or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));
create policy "payments_update_participants" on public.payments for update using (auth.uid() = seller_id or exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid()));

create policy "reviews_select_public" on public.reviews for select using (true);
create policy "reviews_insert_completed_buyer" on public.reviews for insert with check (auth.uid() = buyer_id and exists (select 1 from public.orders o where o.id = order_id and o.buyer_id = auth.uid() and o.status = 'completed'));
