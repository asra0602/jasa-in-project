-- Admin Jasa-in untuk verifikasi pembayaran QRIS pusat.
-- Terapkan lewat Supabase Dashboard -> SQL Editor SETELAH akun admin
-- (profiles.role = 'admin') ditentukan. Tanpa migrasi ini, RLS yang ada
-- hanya mengizinkan buyer/seller partisipan, sehingga admin tidak bisa
-- membaca/mengubah pesanan yang bukan miliknya.
create policy "orders_select_admin" on public.orders for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "orders_update_admin" on public.orders for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "payments_select_admin" on public.payments for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "payments_update_admin" on public.payments for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
create policy "order_items_select_admin" on public.order_items for select using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
