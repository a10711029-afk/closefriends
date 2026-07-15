-- Stories privados, visíveis apenas pelo autor e pelos seus amigos.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  image_url text not null,
  caption text check (char_length(caption) <= 500),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create index if not exists stories_active_idx
  on public.stories(expires_at desc, created_at desc);
create index if not exists stories_user_idx
  on public.stories(user_id, created_at desc);

alter table public.stories enable row level security;

create policy "stories visible to friends"
on public.stories for select to authenticated
using (user_id = auth.uid() or public.are_friends(auth.uid(), user_id));

create policy "stories create own"
on public.stories for insert to authenticated
with check (user_id = auth.uid() and expires_at <= now() + interval '24 hours 5 minutes');

create policy "stories delete own"
on public.stories for delete to authenticated
using (user_id = auth.uid());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('stories', 'stories', false, 5242880, array['image/webp','image/jpeg','image/png'])
on conflict(id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "story owner upload"
on storage.objects for insert to authenticated
with check (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "stories visible to friends"
on storage.objects for select to authenticated
using (
  bucket_id = 'stories'
  and (
    ((storage.foldername(name))[1])::uuid = auth.uid()
    or public.are_friends(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

create policy "story owner delete"
on storage.objects for delete to authenticated
using (bucket_id = 'stories' and (storage.foldername(name))[1] = auth.uid()::text);

alter publication supabase_realtime add table public.stories;
