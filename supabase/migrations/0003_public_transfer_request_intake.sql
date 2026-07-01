drop policy if exists "transfer_requests public intake" on transfer_requests;

create policy "transfer_requests public intake"
on transfer_requests for insert to anon
with check (
  status in ('incomplete', 'pending_review')
  and assigned_driver_id is null
  and assigned_vehicle_id is null
);
