-- Adicionar suporte para mensagens de voz

-- Adicionar valor voice ao enum existente
alter type public.message_kind add value 'voice';

-- Adicionar campo para URL de áudio
alter table public.messages add column voice_url text;

-- Criar bucket para armazenar mensagens de voz
insert into storage.buckets (id, name, public)
values ('chat-voice', 'chat-voice', false)
on conflict (id) do nothing;

-- Criar política de acesso para mensagens de voz
create policy "Users can upload voice messages"
on storage.objects for insert
with check (
  bucket_id = 'chat-voice' and
  auth.uid()::text = (storage.foldername(name))[1]
);

create policy "Users can view voice messages"
on storage.objects for select
using (
  bucket_id = 'chat-voice'
);

create policy "Users can delete voice messages"
on storage.objects for delete
using (
  bucket_id = 'chat-voice' and
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Atualizar constraint de mensagens
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages 
add constraint messages_message_type_check 
check (
  deleted_at is not null or 
  (message_type='text' and message_text is not null and length(trim(message_text))>0 and image_url is null and voice_url is null) or 
  (message_type='image' and image_url is not null and voice_url is null) or
  (message_type='voice' and voice_url is not null and image_url is null)
);
