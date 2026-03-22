# PlayGame

App React/Vite com gamificação, tarefas patrocinadas, distribuição de receita 80/20 e saque via Pix com saldo liquidado.

## Variáveis de ambiente

Preencha o arquivo [.env.local](.env.local) com as chaves públicas do projeto:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use o arquivo [.env.example](.env.example) como referência.

## Backend Supabase

O backend seguro foi preparado em duas migrations:

- [supabase/migrations/20260320_rewards_backend.sql](supabase/migrations/20260320_rewards_backend.sql)
- [supabase/migrations/20260322_admin_review_backend.sql](supabase/migrations/20260322_admin_review_backend.sql)
- [supabase/migrations/20260322_referral_system.sql](supabase/migrations/20260322_referral_system.sql)
- [supabase/migrations/20260322_referral_growth_antifraud.sql](supabase/migrations/20260322_referral_growth_antifraud.sql)

Esse script cria:

- tabelas `profiles`, `task_catalog`, `task_completions`, `revenue_events` e `withdraw_requests`;
- políticas RLS;
- catálogo oficial de tarefas;
- RPCs seguras `ensure_profile_row`, `settle_pending_revenue`, `complete_task_secure` e `request_withdrawal_secure`;
- painel administrativo com `get_my_admin_status`, `get_admin_withdrawal_queue` e `review_withdrawal_request`;
- sistema de indicação direta com `apply_referral_code` e comissão de 3% por produção qualificada do indicado;
- segundo nível de indicação com 1%, ranking de indicadores e score antifraude por dispositivo/comportamento;
- proteção para impedir alteração manual de campos financeiros pelo cliente.

## Como subir no Supabase

1. No painel do Supabase, abra o SQL Editor.
2. Cole e execute o conteúdo de [supabase/migrations/20260320_rewards_backend.sql](supabase/migrations/20260320_rewards_backend.sql).
3. Depois execute [supabase/migrations/20260322_admin_review_backend.sql](supabase/migrations/20260322_admin_review_backend.sql).
4. Depois execute [supabase/migrations/20260322_referral_system.sql](supabase/migrations/20260322_referral_system.sql).
5. Depois execute [supabase/migrations/20260322_referral_growth_antifraud.sql](supabase/migrations/20260322_referral_growth_antifraud.sql).
6. Em Authentication, ative Anonymous Sign-Ins, porque o app usa login anônimo.
7. Copie a URL do projeto e a chave anon para [.env.local](.env.local).
8. Rode o app normalmente.

## Como liberar seu usuário como admin

1. Abra o app e vá até o perfil.
2. Copie o UUID mostrado no card do painel admin.
3. No SQL Editor do Supabase, execute:

```sql
insert into public.admin_users (user_id, role, label)
values ('COLE_O_UUID_AQUI', 'owner', 'Maycon')
on conflict (user_id) do update
set role = excluded.role,
	label = excluded.label;
```

4. Recarregue o app e abra a rota `/admin`.

## Fluxo implementado

- tarefa concluída gera score local e evento financeiro no backend;
- 80% da receita qualificada vai para o usuário;
- 20% fica para o site;
- o saldo fica pendente por 7 dias antes de virar saldo sacável;
- saque aceita apenas saldo liquidado;
- existe limite de 1 saque pendente e 1 saque por dia.
- o painel admin pode aprovar, pagar ou rejeitar saques sem expor `service_role` no frontend.
- indicação direta paga 3% da produção qualificada do indicado, sempre financiada pela margem do site para evitar payout acima de 100%.
- indicação indireta paga 1% para o segundo nível, também financiada pela margem do site.
- o sistema marca contas suspeitas por device fingerprint, velocidade de produção e saque precoce para revisão reforçada.

## Comandos

- `npm run dev`
- `npm run build`
- `npm test`
