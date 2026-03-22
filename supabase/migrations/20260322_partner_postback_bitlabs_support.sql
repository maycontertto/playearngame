-- Ajuste opcional de documentação para suportar novos parceiros no mesmo fluxo.
-- Nenhuma mudança estrutural é obrigatória para a BitLabs, porque o endpoint
-- process_partner_postback já aceita p_partner_name dinâmico.
--
-- Se quiser títulos 100% personalizados por parceiro no histórico financeiro,
-- faça um create or replace function em process_partner_postback usando o nome
-- do parceiro para montar o título exibido ao usuário.
--
-- Esta migration foi adicionada apenas para registrar a extensão multi-parceiro.
select 'bitlabs_support_ready' as status;
