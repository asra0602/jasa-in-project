-- Galeri foto jasa: tabel service_images + bucket Storage "service-images".
-- Terapkan lewat Supabase Dashboard -> SQL Editor SETELAH migrasi 003.
-- Tanpa migrasi ini, upload foto di dashboard akan gagal dengan pesan
-- bucket belum diterapkan, dan jasa baru tetap bisa dibuat tanpa foto.
-- Bucket dibuat publik (baca) agar foto katalog bisa ditampilkan tanpa
-- login; unggah hanya untuk user login, dan pencatatan galeri di tabel
-- hanya untuk seller pemilik jasa (kebijakan di bawah).

create table public.service_images (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index service_images_service_idx on public.service_images(service_id, sort_order);

alter table public.service_images enable row level security;

create policy "service_images_select_public" on public.service_images for select using (true);
create policy "service_images_insert_seller" on public.service_images for insert with check (
  exists (select 1 from public.services s where s.id = service_id and s.seller_id = auth.uid())
);
create policy "service_images_update_seller" on public.service_images for update using (
  exists (select 1 from public.services s where s.id = service_id and s.seller_id = auth.uid())
) with check (
  exists (select 1 from public.services s where s.id = service_id and s.seller_id = auth.uid())
);
create policy "service_images_delete_seller" on public.service_images for delete using (
  exists (select 1 from public.services s where s.id = service_id and s.seller_id = auth.uid())
);

-- Bucket Storage publik untuk foto galeri jasa.
insert into storage.buckets (id, name, public)
values ('service-images', 'service-images', true)
on conflict (id) do update set public = true;

create policy "service_images_storage_select_public" on storage.objects for select using (
  bucket_id = 'service-images'
);
create policy "service_images_storage_insert_auth" on storage.objects for insert with check (
  bucket_id = 'service-images' and auth.uid() is not null
);
create policy "service_images_storage_delete_owner" on storage.objects for delete using (
  bucket_id = 'service-images' and owner = auth.uid()
);
