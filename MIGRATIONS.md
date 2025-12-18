# Guia de Migrations - CRM

Este projeto utiliza o `node-pg-migrate` para gerenciar alterações no schema do banco de dados PostgreSQL (Neon).

## 🚀 Comandos Principais

### Criar uma nova migration
Para criar um novo arquivo de migration:
```bash
npm run migrate:create -- nome_da_sua_migration
```
Isso criará um arquivo em `migrations/` com o timestamp atual.

### Aplicar migrations (Desenvolvimento/Teste)
Para rodar as migrations no banco `ep-winter-wind` (configurado no `.env.local`):
```bash
npm run migrate:test
```

### Aplicar migrations (Produção)
Para rodar as migrations no banco de produção (configurado via variáveis de ambiente):
```bash
npm run migrate:prod
```
*Geralmente executado automaticamente pelo CI/CD durante o deploy.*

### Rollback (Reverter última migration)
Para desfazer a última alteração no banco de teste:
```bash
npm run rollback:test
```

## 📝 Como escrever uma migration

As migrations são escritas em JavaScript. Exemplo de como adicionar uma coluna:

```javascript
exports.up = (pgm) => {
  pgm.addColumn('leads', {
    new_column: { type: 'text', default: null }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('leads', 'new_column');
};
```

### Boas Práticas

1. **Idempotência**: Sempre que possível, use verificações como `IF NOT EXISTS` ou a opção `ifNotExists: true` fornecida pelo `node-pg-migrate`.
2. **Rollback**: Sempre implemente a função `down` para permitir reverter mudanças se necessário.
3. **Nomes Claros**: Use nomes descritivos como `add_priority_to_leads` ou `create_tags_table`.
4. **SQL Puro**: Se precisar de uma lógica complexa que os helpers não cobrem, use `pgm.sql(\`MEU SQL\`)`.

## 🗄️ Estratégia de Ambientes

- **Local/Test**: Usa o banco Neon `ep-winter-wind`.
- **Produção**: Usa o banco Neon `ep-crimson-dawn`.

O arquivo `.node-pg-migraterc` contém a configuração base que aponta para a variável `DATABASE_URL`.
