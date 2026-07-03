alter table travel_events
add column if not exists location_accuracy numeric,
add column if not exists location_label text;
