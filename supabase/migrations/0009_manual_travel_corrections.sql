alter table travel_events
drop constraint if exists travel_events_type_check;

alter table travel_events
add constraint travel_events_type_check check (
  type in (
    'driver_at_pickup',
    'passenger_on_board',
    'completed',
    'incident',
    'manual_correction'
  )
);
