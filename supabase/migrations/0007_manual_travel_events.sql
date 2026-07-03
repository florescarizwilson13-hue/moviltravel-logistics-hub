alter table travel_events
drop constraint if exists travel_events_source_check;

alter table travel_events
add constraint travel_events_source_check check (source in ('whatsapp_driver', 'manual'));

alter table travel_events
drop constraint if exists travel_events_actor_type_check;

alter table travel_events
add constraint travel_events_actor_type_check check (actor_type in ('driver', 'coordinator'));
