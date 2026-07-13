# CloseChat

PWA mobile-first para conversas privadas entre amigos, construída com Next.js 16, TypeScript, Tailwind CSS e Supabase. Não inclui feed, grupos, stories ou perfis públicos.

## Funcionalidades

- Auth por email: registo, confirmação, login, recuperação e sessão persistente
- Perfis, avatar WebP, biografia, estado online e última atividade
- Pesquisa, pedidos de amizade, aceitar/recusar/cancelar, remover e bloquear
- Conversas diretas apenas entre amigos, ordenadas pela atividade mais recente
- Mensagens Realtime, não lidas, respostas, cópia, eliminação e indicador de escrita
- Câmara/galeria no iPhone, compressão WebP, pré-visualização, legenda e upload privado
- PWA iOS com manifest, service worker, modo offline, safe areas e instruções de instalação
- RLS em todas as tabelas, funções `security definer` restritas e URLs assinadas para imagens privadas
- Estrutura de subscrições preparada para um serviço de envio Web Push (o envio requer uma função Edge/backend com VAPID)

## Configuração local

1. Cria um projeto em [Supabase](https://supabase.com).
2. No SQL Editor, executa integralmente `supabase/migrations/001_closechat.sql` num projeto novo.
3. Em Authentication → URL Configuration, define o Site URL e adiciona `http://localhost:3000/auth/callback` aos Redirect URLs.
4. Copia `.env.example` para `.env.local` e preenche a URL e a chave `anon`/publishable. Nunca uses a `service_role` no frontend.
5. Instala e inicia:

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`. Para testar Realtime e amizade, usa dois utilizadores em browsers/perfis diferentes.

## Supabase e segurança

O SQL cria tabelas, índices, constraints, triggers, RPCs, RLS, publicação Realtime e os buckets `avatars` e `chat-images`. `chat-images` é privado; a app grava apenas o caminho e pede URLs assinadas de uma hora. A autorização definitiva está nas policies/RPCs, não na interface.

Se a migration for repetida num projeto que já contém policies/tipos com os mesmos nomes, recria o projeto ou remove primeiro os objetos anteriores. A migration foi concebida como instalação inicial.

## Publicar na Vercel

1. Importa o repositório na Vercel.
2. Adiciona `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em Project Settings → Environment Variables.
3. Faz Deploy.
4. Atualiza no Supabase o Site URL para o domínio Vercel e adiciona `https://TEU-DOMINIO/auth/callback` aos Redirect URLs.
5. Testa em HTTPS no Safari do iPhone. Usa Partilhar → Adicionar ao ecrã principal.

## Notificações push

O service worker aceita eventos `push`, respeita o campo `preview` e abre a rota indicada. A tabela `push_subscriptions` guarda endpoints com RLS. Para ativar o envio em produção, cria uma Supabase Edge Function ou serviço backend com as chaves VAPID em secrets do servidor e dispara-o por Database Webhook. Não coloques chaves privadas VAPID nem `service_role` em variáveis `NEXT_PUBLIC_*`.

## Comandos

```bash
npm run typecheck
npm run lint
npm run build
```

Identidade visual: ícone criado com o gerador de imagens integrado, prompt de um ícone iOS com dois balões de conversa sobrepostos, coração subtil, gradiente índigo/violeta e acento coral, sem texto.
