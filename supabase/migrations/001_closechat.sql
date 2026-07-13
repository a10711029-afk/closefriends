-- CloseChat: execute no SQL Editor de um projeto Supabase novo.
create extension if not exists pgcrypto;

create type public.friend_request_status as enum ('pending','accepted','declined','cancelled');
create type public.message_kind as enum ('text','image');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text check (char_length(bio) <= 160),
  last_seen timestamptz default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.friend_requests (
  id uuid primary key default gen_random_uuid(), sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade, status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(sender_id<>receiver_id)
);
create unique index one_pending_request_per_pair on public.friend_requests (least(sender_id,receiver_id),greatest(sender_id,receiver_id)) where status='pending';
create index friend_requests_receiver_idx on public.friend_requests(receiver_id,status);
create table public.friendships (
  id uuid primary key default gen_random_uuid(), user_1_id uuid not null references public.profiles(id) on delete cascade,
  user_2_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(),
  check(user_1_id<user_2_id), unique(user_1_id,user_2_id)
);
create index friendships_user_1_idx on public.friendships(user_1_id); create index friendships_user_2_idx on public.friendships(user_2_id);
create table public.conversations (
  id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  last_message_id uuid, last_message_at timestamptz
);
create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(), last_read_at timestamptz not null default now(), primary key(conversation_id,user_id)
);
create index conversation_members_user_idx on public.conversation_members(user_id);
create table public.messages (
  id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade, message_type public.message_kind not null,
  message_text text check(char_length(message_text)<=5000), image_url text, image_caption text check(char_length(image_caption)<=500),
  reply_to_message_id uuid references public.messages(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), deleted_at timestamptz,
  check (deleted_at is not null or (message_type='text' and message_text is not null and length(trim(message_text))>0 and image_url is null) or (message_type='image' and image_url is not null))
);
alter table public.conversations add constraint conversations_last_message_fk foreign key(last_message_id) references public.messages(id) on delete set null;
create index messages_conversation_created_idx on public.messages(conversation_id,created_at desc);
create table public.blocks (
  id uuid primary key default gen_random_uuid(), blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now(), check(blocker_id<>blocked_id), unique(blocker_id,blocked_id)
);
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique, p256dh text not null, auth_key text not null, previews_enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger friend_requests_updated before update on public.friend_requests for each row execute function public.set_updated_at();
create trigger messages_updated before update on public.messages for each row execute function public.set_updated_at();
create trigger push_subscriptions_updated before update on public.push_subscriptions for each row execute function public.set_updated_at();
create or replace function public.only_soft_delete_message() returns trigger language plpgsql as $$ begin
  if new.id<>old.id or new.conversation_id<>old.conversation_id or new.sender_id<>old.sender_id or new.message_type<>old.message_type or new.created_at<>old.created_at or new.reply_to_message_id is distinct from old.reply_to_message_id then raise exception 'Os campos da mensagem são imutáveis'; end if;
  if old.deleted_at is not null then raise exception 'Mensagem já eliminada'; end if;
  return new;
end $$;
create trigger messages_only_soft_delete before update on public.messages for each row execute function public.only_soft_delete_message();

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
declare base_username text; begin
  base_username:=lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username',split_part(new.email,'@',1)),'[^a-z0-9_]','','g'));
  if length(base_username)<3 then base_username:='user_'||substr(new.id::text,1,8); end if;
  insert into public.profiles(id,username,display_name) values(new.id,left(base_username,24),coalesce(nullif(new.raw_user_meta_data->>'display_name',''),'Novo utilizador'));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_blocked(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;
create or replace function public.are_friends(a uuid,b uuid) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from friendships where user_1_id=least(a,b) and user_2_id=greatest(a,b));
$$;
create or replace function public.is_conversation_member(cid uuid,uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from conversation_members where conversation_id=cid and user_id=uid);
$$;
revoke all on function public.is_blocked(uuid,uuid),public.are_friends(uuid,uuid),public.is_conversation_member(uuid,uuid) from public;
grant execute on function public.is_blocked(uuid,uuid),public.are_friends(uuid,uuid),public.is_conversation_member(uuid,uuid) to authenticated;

create or replace function public.respond_friend_request(p_request_id uuid,p_accept boolean) returns void language plpgsql security definer set search_path=public as $$
declare r friend_requests; begin
  select * into r from friend_requests where id=p_request_id and receiver_id=auth.uid() and status='pending' for update;
  if not found then raise exception 'Pedido inválido'; end if;
  if public.is_blocked(r.sender_id,r.receiver_id) then raise exception 'Utilizador bloqueado'; end if;
  update friend_requests set status=case when p_accept then 'accepted'::friend_request_status else 'declined'::friend_request_status end where id=p_request_id;
  if p_accept then insert into friendships(user_1_id,user_2_id) values(least(r.sender_id,r.receiver_id),greatest(r.sender_id,r.receiver_id)) on conflict do nothing; end if;
end $$;
grant execute on function public.respond_friend_request(uuid,boolean) to authenticated;

create or replace function public.ensure_direct_conversation(p_friend_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare cid uuid; me uuid:=auth.uid(); begin
  if me is null or me=p_friend_id or not public.are_friends(me,p_friend_id) or public.is_blocked(me,p_friend_id) then raise exception 'Só amigos não bloqueados podem conversar'; end if;
  perform pg_advisory_xact_lock(hashtext(least(me,p_friend_id)::text||greatest(me,p_friend_id)::text));
  select cm.conversation_id into cid from conversation_members cm join conversation_members other on other.conversation_id=cm.conversation_id and other.user_id=p_friend_id
  where cm.user_id=me and (select count(*) from conversation_members x where x.conversation_id=cm.conversation_id)=2 limit 1;
  if cid is null then insert into conversations default values returning id into cid; insert into conversation_members(conversation_id,user_id) values(cid,me),(cid,p_friend_id); end if;
  return cid;
end $$;
grant execute on function public.ensure_direct_conversation(uuid) to authenticated;

create or replace function public.get_conversation_friend(p_conversation_id uuid) returns setof profiles language sql stable security definer set search_path=public as $$
  select p.* from profiles p join conversation_members cm on cm.user_id=p.id where cm.conversation_id=p_conversation_id and p.id<>auth.uid() and public.is_conversation_member(p_conversation_id,auth.uid());
$$;
grant execute on function public.get_conversation_friend(uuid) to authenticated;
create or replace function public.get_my_friends() returns table(friendship_id uuid,id uuid,username text,display_name text,avatar_url text,bio text,last_seen timestamptz,created_at timestamptz,updated_at timestamptz) language sql stable security definer set search_path=public as $$
  select f.id,p.id,p.username,p.display_name,p.avatar_url,p.bio,p.last_seen,p.created_at,p.updated_at from friendships f join profiles p on p.id=case when f.user_1_id=auth.uid() then f.user_2_id else f.user_1_id end where auth.uid() in(f.user_1_id,f.user_2_id) and not public.is_blocked(auth.uid(),p.id) order by p.display_name;
$$;
grant execute on function public.get_my_friends() to authenticated;
create or replace function public.get_blocked_users() returns setof profiles language sql stable security definer set search_path=public as $$
  select p.* from blocks b join profiles p on p.id=b.blocked_id where b.blocker_id=auth.uid() order by p.display_name;
$$;
grant execute on function public.get_blocked_users() to authenticated;
create or replace function public.get_my_conversations() returns table(conversation_id uuid,friend_id uuid,display_name text,username text,avatar_url text,last_seen timestamptz,last_message_id uuid,last_message_type message_kind,last_message_text text,last_message_at timestamptz,last_sender_id uuid,unread_count bigint) language sql stable security definer set search_path=public as $$
  select c.id,p.id,p.display_name,p.username,p.avatar_url,p.last_seen,c.last_message_id,m.message_type,coalesce(m.message_text,m.image_caption),c.last_message_at,m.sender_id,
  (select count(*) from messages unread where unread.conversation_id=c.id and unread.sender_id<>auth.uid() and unread.created_at>me.last_read_at and unread.deleted_at is null)
  from conversation_members me join conversations c on c.id=me.conversation_id join conversation_members them on them.conversation_id=c.id and them.user_id<>auth.uid() join profiles p on p.id=them.user_id left join messages m on m.id=c.last_message_id
  where me.user_id=auth.uid() and not public.is_blocked(auth.uid(),p.id) order by c.last_message_at desc nulls last,c.created_at desc;
$$;
grant execute on function public.get_my_conversations() to authenticated;

create or replace function public.message_after_insert() returns trigger language plpgsql security definer set search_path=public as $$ begin update conversations set last_message_id=new.id,last_message_at=new.created_at,updated_at=now() where id=new.conversation_id; return new; end $$;
create trigger messages_update_conversation after insert on public.messages for each row execute function public.message_after_insert();
create or replace function public.block_cleanup() returns trigger language plpgsql security definer set search_path=public as $$ begin delete from friend_requests where status='pending' and ((sender_id=new.blocker_id and receiver_id=new.blocked_id) or(sender_id=new.blocked_id and receiver_id=new.blocker_id)); delete from friendships where user_1_id=least(new.blocker_id,new.blocked_id) and user_2_id=greatest(new.blocker_id,new.blocked_id); return new; end $$;
create trigger blocks_cleanup after insert on public.blocks for each row execute function public.block_cleanup();

alter table public.profiles enable row level security; alter table public.friend_requests enable row level security; alter table public.friendships enable row level security;
alter table public.conversations enable row level security; alter table public.conversation_members enable row level security; alter table public.messages enable row level security;
alter table public.blocks enable row level security; alter table public.push_subscriptions enable row level security;
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using(not public.is_blocked(auth.uid(),id) or id=auth.uid());
create policy "profiles update own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy "requests read own" on public.friend_requests for select to authenticated using(auth.uid() in(sender_id,receiver_id));
create policy "requests send own" on public.friend_requests for insert to authenticated with check(sender_id=auth.uid() and receiver_id<>auth.uid() and status='pending' and not public.is_blocked(sender_id,receiver_id) and not public.are_friends(sender_id,receiver_id));
create policy "requests cancel own" on public.friend_requests for update to authenticated using(sender_id=auth.uid() and status='pending') with check(sender_id=auth.uid() and status='cancelled');
create policy "friendships read own" on public.friendships for select to authenticated using(auth.uid() in(user_1_id,user_2_id));
create policy "friendships remove own" on public.friendships for delete to authenticated using(auth.uid() in(user_1_id,user_2_id));
create policy "conversations read member" on public.conversations for select to authenticated using(public.is_conversation_member(id));
create policy "members read conversation" on public.conversation_members for select to authenticated using(public.is_conversation_member(conversation_id));
create policy "members mark own read" on public.conversation_members for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "messages read member" on public.messages for select to authenticated using(public.is_conversation_member(conversation_id));
create policy "messages send member friend" on public.messages for insert to authenticated with check(sender_id=auth.uid() and public.is_conversation_member(conversation_id) and exists(select 1 from conversation_members peer where peer.conversation_id=messages.conversation_id and peer.user_id<>auth.uid() and public.are_friends(auth.uid(),peer.user_id) and not public.is_blocked(auth.uid(),peer.user_id)));
create policy "messages soft delete own" on public.messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid() and deleted_at is not null);
create policy "blocks read own" on public.blocks for select to authenticated using(auth.uid() in(blocker_id,blocked_id));
create policy "blocks create own" on public.blocks for insert to authenticated with check(blocker_id=auth.uid());
create policy "blocks delete own" on public.blocks for delete to authenticated using(blocker_id=auth.uid());
create policy "push own" on public.push_subscriptions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('avatars','avatars',true,2097152,array['image/webp','image/jpeg','image/png']),('chat-images','chat-images',false,5242880,array['image/webp','image/jpeg','image/png']) on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "avatar public read" on storage.objects for select using(bucket_id='avatars');
create policy "avatar owner insert" on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner update" on storage.objects for update to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "avatar owner delete" on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "chat image member read" on storage.objects for select to authenticated using(bucket_id='chat-images' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "chat image member upload" on storage.objects for insert to authenticated with check(bucket_id='chat-images' and public.is_conversation_member(((storage.foldername(name))[1])::uuid));
create policy "chat image sender delete" on storage.objects for delete to authenticated using(bucket_id='chat-images' and owner_id=auth.uid()::text);

alter publication supabase_realtime add table public.messages,public.friend_requests,public.conversation_members;
