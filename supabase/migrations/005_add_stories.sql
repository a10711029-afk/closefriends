-- Adicionar campo para URL de áudio
alter table public.messages
add column if not exists voice_url text;


-- Criar bucket para mensagens de voz
insert into storage.buckets (id, name, public)
values ('chat-voice', 'chat-voice', false)
on conflict (id) do nothing;


-- Remover políticas anteriores, caso existam
drop policy if exists "Users can upload voice messages"
on storage.objects;

drop policy if exists "Users can view voice messages"
on storage.objects;

drop policy if exists "Users can delete voice messages"
on storage.objects;


-- Permitir upload na pasta do próprio utilizador
create policy "Users can upload voice messages"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-voice'
  and auth.uid()::text = (storage.foldername(name))[1]
);


-- Permitir visualizar mensagens de voz
create policy "Users can view voice messages"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-voice'
);


-- Permitir eliminar ficheiros da própria pasta
create policy "Users can delete voice messages"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'chat-voice'
  and auth.uid()::text = (storage.foldername(name))[1]
);


-- Atualizar constraint das mensagens
alter table public.messages
drop constraint if exists messages_message_type_check;

alter table public.messages
add constraint messages_message_type_check
check (
  deleted_at is not null

  or (
    message_type = 'text'
    and message_text is not null
    and length(trim(message_text)) > 0
    and image_url is null
    and voice_url is null
  )

  or (
    message_type = 'image'
    and image_url is not null
    and voice_url is null
  )

  or (
    message_type = 'voice'
    and voice_url is not null
    and image_url is null
  )
);