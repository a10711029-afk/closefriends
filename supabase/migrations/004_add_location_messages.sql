-- Adicionar suporte para partilha de localização

-- Adicionar valor location ao enum existente
alter type public.message_kind add value 'location';

-- Adicionar campos para localização
alter table public.messages add column location_lat numeric;
alter table public.messages add column location_lng numeric;
alter table public.messages add column location_address text;

-- Atualizar constraint de mensagens
alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages 
add constraint messages_message_type_check 
check (
  deleted_at is not null or 
  (message_type='text' and message_text is not null and length(trim(message_text))>0 and image_url is null and voice_url is null and location_lat is null) or 
  (message_type='image' and image_url is not null and voice_url is null and location_lat is null) or
  (message_type='voice' and voice_url is not null and image_url is null and location_lat is null) or
  (message_type='location' and location_lat is not null and location_lng is not null and image_url is null and voice_url is null)
);
