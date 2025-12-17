# Verificar Números em Grupos do WhatsApp

Este documento explica como usar as novas funcionalidades para trabalhar com grupos do WhatsApp.

## Funcionalidades Disponíveis

### 1. **isNumberInGroup** - Verificar se um número está em um grupo
Verifica se um número de telefone específico é membro de um grupo do WhatsApp.

```typescript
import { isNumberInGroup } from '@/lib/whatsapp';

// Exemplo 1: Usando ID do grupo
const isInGroup = await isNumberInGroup('51999887766', '120363123456789@g.us');

// Exemplo 2: Usando nome do grupo (busca parcial)
const isInGroup = await isNumberInGroup('51999887766', 'Clientes VIP');

console.log(isInGroup); // true ou false
```

### 2. **listAllGroups** - Listar todos os grupos
Retorna uma lista com todos os grupos disponíveis no WhatsApp conectado.

```typescript
import { listAllGroups } from '@/lib/whatsapp';

const groups = await listAllGroups();
// Retorna: Array<{ id: string, name: string, participantCount: number }>

groups.forEach(group => {
    console.log(`${group.name}: ${group.participantCount} participantes`);
    console.log(`ID: ${group.id}`);
});
```

### 3. **getGroupParticipants** - Obter participantes de um grupo
Lista todos os participantes de um grupo específico.

```typescript
import { getGroupParticipants } from '@/lib/whatsapp';

// Usando ID do grupo
const participants = await getGroupParticipants('120363123456789@g.us');

// Ou usando nome do grupo
const participants = await getGroupParticipants('Clientes VIP');

participants.forEach(p => {
    console.log(`Telefone: ${p.phone}`);
    console.log(`Admin: ${p.isAdmin}`);
});
```

## API Endpoints

Você também pode usar via API HTTP:

### Listar todos os grupos
```bash
GET /api/whatsapp/groups?action=list
```

**Resposta:**
```json
{
  "success": true,
  "groups": [
    {
      "id": "120363123456789@g.us",
      "name": "Clientes VIP",
      "participantCount": 25
    }
  ],
  "total": 1
}
```

### Verificar se um número está em um grupo
```bash
GET /api/whatsapp/groups?action=check&phone=51999887766&groupId=Clientes VIP
```

**Resposta:**
```json
{
  "success": true,
  "phone": "51999887766",
  "groupId": "Clientes VIP",
  "isInGroup": true
}
```

### Obter participantes de um grupo
```bash
GET /api/whatsapp/groups?action=participants&groupId=120363123456789@g.us
```

**Resposta:**
```json
{
  "success": true,
  "groupId": "120363123456789@g.us",
  "participants": [
    {
      "phone": "5551999887766",
      "isAdmin": true
    },
    {
      "phone": "5551988776655",
      "isAdmin": false
    }
  ],
  "total": 2
}
```

## Casos de Uso

### Exemplo 1: Verificar múltiplos números
```typescript
const phones = ['51999887766', '51988776655', '51977665544'];
const groupName = 'Clientes VIP';

for (const phone of phones) {
    const isInGroup = await isNumberInGroup(phone, groupName);
    console.log(`${phone}: ${isInGroup ? '✓ No grupo' : '✗ Não está no grupo'}`);
}
```

### Exemplo 2: Filtrar leads que estão em um grupo específico
```typescript
import { pool } from '@/lib/db';
import { isNumberInGroup } from '@/lib/whatsapp';

// Buscar todos os leads
const result = await pool.query('SELECT telefone, nome FROM leads');
const leads = result.rows;

// Filtrar apenas os que estão no grupo
const groupMembers = [];
for (const lead of leads) {
    const isInGroup = await isNumberInGroup(lead.telefone, 'Clientes Premium');
    if (isInGroup) {
        groupMembers.push(lead);
    }
}

console.log(`${groupMembers.length} leads estão no grupo Clientes Premium`);
```

### Exemplo 3: Sincronizar tags com grupos
```typescript
// Adicionar uma tag para todos que estão em um grupo específico
const participants = await getGroupParticipants('Clientes VIP');

for (const participant of participants) {
    // Encontrar o lead pelo telefone
    const leadResult = await pool.query(
        'SELECT cpf FROM leads WHERE telefone LIKE $1',
        [`%${participant.phone}%`]
    );
    
    if (leadResult.rows.length > 0) {
        const cpf = leadResult.rows[0].cpf;
        
        // Adicionar tag "Cliente VIP"
        await pool.query(
            'INSERT INTO lead_tags (lead_cpf, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [cpf, 1] // Assumindo que tag_id 1 é "Cliente VIP"
        );
        
        console.log(`Tag adicionada para ${cpf}`);
    }
}
```

## Notas Importantes

1. **Formato do número**: A função aceita diversos formatos:
   - `51999887766` (sem código do país)
   - `5551999887766` (com código do país)
   - `(51) 99988-7766` (formatado - será normalizado)

2. **Variações brasileiras**: A função tenta automaticamente com e sem o 9º dígito para números brasileiros.

3. **ID vs Nome do grupo**: 
   - Use o ID completo (`@g.us`) para busca exata
   - Use o nome para busca parcial (case-insensitive)

4. **Requisito**: O WhatsApp Client precisa estar conectado (`status: 'ready'`)
