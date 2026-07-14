-- Adicionar campos para funcionalidades de mensagens

-- Campo para visualização única
alter table public.messages add column view_once boolean default null;

-- Campo para recibos de leitura
alter table public.messages add column read_at timestamptz default null;

-- Campo para reações (emojis)
alter table public.messages add column reaction text default null;

-- Criar índices para performance
create index messages_read_at_idx on public.messages(read_at);
create index messages_reaction_idx on public.messages(reaction);
