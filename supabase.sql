create table if not exists messages (
  id bigserial primary key,
  number text not null,
  chat_id text,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  is_ephemeral bool default false,
  created_at timestamptz default now()
);

alter table messages add column if not exists expires_at timestamptz;

create index if not exists messages_number_created_at_idx on messages(number, created_at desc);
create index if not exists messages_expires_at_idx on messages(expires_at);

create table if not exists homework (
  id serial primary key,
  number text,
  fach text,
  aufgabe text,
  due timestamptz,
  done bool default false,
  created_at timestamptz default now()
);

create index if not exists homework_number_due_idx on homework(number, due);
