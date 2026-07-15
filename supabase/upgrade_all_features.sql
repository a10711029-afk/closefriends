-- CloseChat: atualização completa para uma base de dados existente.
-- Executar este ficheiro inteiro, uma única vez, no SQL Editor do Supabase.

-- Os COMMITs tornam os novos valores do enum utilizáveis no restante script,
-- mesmo quando todo o conteúdo é enviado ao SQL Editor de uma só vez.
alter type public.message_kind add value if not exists 'voice';
commit;
alter type public.message_kind add value if not exists 'location';
commit;

alter table public.messages add column if not exists view_once boolean default null;
alter table public.messages add column if not exists read_at timestamptz default null;
alter table public.messages add column if not exists reaction text default null;
alter table public.messages add column if not exists voice_url text;
alter table public.messages add column if not exists location_lat numeric;
alter table public.messages add column if not exists location_lng numeric;
alter table public.messages add column if not exists location_address text;

create index if not exists messages_read_at_idx on public.messages(read_at);
create index if not exists messages_reaction_idx on public.messages(reaction);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_active_idx on public.stories(expires_at desc, created_at desc);
create index if not exists stories_user_idx on public.stories(user_id, created_at desc);
alter table public.stories enable row level security;

drop policy if exists "stories visible to friends" on public.stories;
drop policy if exists "stories create own" on public.stories;
drop policy if exists "stories delete own" on public.stories;
create policy "stories visible to friends" on public.stories for select to authenticated
  using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));
create policy "stories create own" on public.stories for insert to authenticated
  with check (user_id = auth.uid() and expires_at <= now() + interval '24 hours 5 minutes');
create policy "stories delete own" on public.stories for delete to authenticated
  using (user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values
  ('stories', 'stories', false, 5242880, array['image/webp','image/jpeg','image/png']),
  ('chat-voice', 'chat-voice', false, 10485760, array['audio/webm','audio/mp4','audio/ogg'])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can upload voice messages" on storage.objects;
drop policy if exists "Users can view voice messages" on storage.objects;
drop policy if exists "Users can delete voice messages" on storage.objects;
drop policy if exists "voice conversation member upload" on storage.objects;
drop policy if exists "voice conversation member read" on storage.objects;
drop policy if exists "voice owner delete" on storage.objects;
drop policy if exists "story owner upload" on storage.objects;
drop policy if exists "stories visible to friends" on storage.objects;
drop policy if exists "story owner delete" on storage.objects;

create policy "voice conversation member upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-voice' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "voice conversation member read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-voice' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "voice owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-voice' and owner_id = auth.uid()::text);

create policy "story owner upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "stories visible to friends" on storage.objects for select to authenticated
  using (
    bucket_id = 'stories'
    and (((storage.foldername(name))[1])::uuid = auth.uid()
      or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid))
  );
create policy "story owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check check (
  deleted_at is not null
  or (message_type = 'text' and message_text is not null and length(trim(message_text)) > 0 and image_url is null and voice_url is null and location_lat is null and location_lng is null)
  or (message_type = 'image' and image_url is not null and voice_url is null and location_lat is null and location_lng is null)
  or (message_type = 'voice' and voice_url is not null and image_url is null and location_lat is null and location_lng is null)
  or (message_type = 'location' and location_lat is not null and location_lng is not null and image_url is null and voice_url is null)
);

do $$ begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object then null;
end $$;
