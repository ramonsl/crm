-- Script para limpar dados órfãos antes da migration

-- 1. Encontrar atividades órfãs (sem lead correspondente)
SELECT a.id, a.contact_cpf, a.type, a.title, a.created_at
FROM activities a
LEFT JOIN leads l ON a.contact_cpf = l.cpf
WHERE l.cpf IS NULL;

-- 2. Deletar atividades órfãs
DELETE FROM activities
WHERE contact_cpf NOT IN (SELECT cpf FROM leads);

-- 3. Verificar se ainda há órfãos
SELECT COUNT(*) as orphaned_activities
FROM activities a
LEFT JOIN leads l ON a.contact_cpf = l.cpf
WHERE l.cpf IS NULL;
