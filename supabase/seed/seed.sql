insert into companies (name, contact_name, contact_phone, contact_email)
values ('Moviltravel Demo', 'Operaciones', '+56900000000', 'ops@example.com')
on conflict do nothing;
