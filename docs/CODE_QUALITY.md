# Boas Práticas e Qualidade de Código Integrada

## 🎯 Objetivo
Manter o codebase limpo, seguro e escalável, reduzindo gradativamente o débito técnico (~1000 issues de lint identificadas em Jan/2026).

## 🚫 Regras de Ouro (Lint & Types)

### 1. Zero `any` Explícito
**Por que?** O uso de `any` desliga a checagem do TypeScript, permitindo bugs de runtime que seriam pegos em compilação.
**Como corrigir:**
- Use interfaces ou types.
- Se não sabe o tipo, use `unknown` e faça verificação de tipo (Type Guard).
- Para respostas de API de terceiros, crie interfaces parciais apenas com os campos que você usa.

```typescript
// ❌ Ruim
function processData(data: any) { ... }

// ✅ Bom
function processData(data: unknown) {
    if (typeof data === 'string') { ... }
}
```

### 2. Sem Variáveis Não Usadas
**Por que?** Poluição visual e confusão cognitiva ("Pra que serve isso?").
**Como corrigir:**
- Remova a variável.
- Se for argumento de função obrigatório (ex: override), prefixe com `_`. Ex: `(_req, res)`.

### 3. Imports Modernos (ESM)
**Por que?** `require` é legado do CommonJS. O projeto usa TypeScript/ESM.
**Como corrigir:**
- Use `import { foo } from 'bar'` em arquivos `.ts`.
- Para scripts de automação, migre para `.ts` (usando `ts-node`) ou use `import` em arquivos `.mjs`.`

### 4. Componentes React Limpos
- Evite lógica pesada dentro do componente. Extraia para Hooks customizados.
- Tipagem estrita de Props (nada de `any`).

## 🛠️ Workflow de Refatoração
A equipe adotou a estratégia de **"Boy Scout Rule"**: deixe o código mais limpo do que encontrou.

1. **Ao tocar em um arquivo:** Corrija os erros de lint daquele arquivo.
2. **Ao criar novo código:** Não introduza novos erros (o CI deve bloquear).
3. **Tarefas Dedicadas:** Pegue uma das Issues de Refatoração (#87 a #96) para limpar um módulo inteiro.

## 🔍 Comandos Úteis
```bash
# Verificar todo o projeto
npm run lint

# Tentar corrigir automaticamente (ex: indentação, aspas)
npm run lint -- --fix
```
