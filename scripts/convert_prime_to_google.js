const fs = require('fs');
const path = require('path');

// Ler o arquivo alunos_completo.csv
const inputPath = path.join(__dirname, '..', 'alunos_completo.csv');
const outputPath = path.join(__dirname, '..', 'data', 'exports', 'alunos_prime_google.csv');

const content = fs.readFileSync(inputPath, 'utf-8');
const lines = content.split('\n');

// Header do Google Contacts - campos essenciais
const googleHeader = [
    'Name',
    'Given Name',
    'Family Name',
    'E-mail 1 - Type',
    'E-mail 1 - Value',
    'Phone 1 - Type',
    'Phone 1 - Value',
    'Organization 1 - Name',
    'Organization 1 - Title',
    'Notes'
].join(',');

const outputLines = [googleHeader];

// Processar cada linha (ignorar header)
for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV com aspas
    const parts = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            parts.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    parts.push(current.trim());

    if (parts.length < 5) continue;

    const [codigo, nomeCompleto, situacao, emailRaw, telefoneRaw] = parts;

    // Separar nome
    const nomeParts = nomeCompleto.split(' ');
    const firstName = nomeParts[0] || '';
    const lastName = nomeParts.slice(1).join(' ') || '';

    // Limpar email (pegar o primeiro se houver vários)
    let email = emailRaw || '';
    if (email.includes(';')) {
        email = email.split(';')[0];
    }
    email = email.trim();

    // Limpar telefone - extrair apenas números
    let telefone = telefoneRaw || '';
    if (telefone.includes('E-mail:')) {
        telefone = telefone.split('E-mail:')[0];
    }
    telefone = telefone.replace(/[^0-9]/g, '');

    // Formatar telefone brasileiro
    if (telefone.length === 8) {
        telefone = '+55519' + telefone;
    } else if (telefone.length === 9) {
        telefone = '+5551' + telefone;
    } else if (telefone.length === 10) {
        telefone = '+55' + telefone;
    } else if (telefone.length === 11) {
        telefone = '+55' + telefone;
    } else if (telefone.length > 11) {
        telefone = '+' + telefone;
    }

    // Extrair situação atual simplificada
    let situacaoAtual = 'Aluno ADS';
    if (situacao.includes('Matriculado')) {
        situacaoAtual = 'Matriculado ADS';
    } else if (situacao.includes('Formado')) {
        situacaoAtual = 'Formado';
    } else if (situacao.includes('Desistente')) {
        situacaoAtual = 'Desistente';
    } else if (situacao.includes('Cancelado')) {
        situacaoAtual = 'Cancelado';
    } else if (situacao.includes('Desvinculado')) {
        situacaoAtual = 'Desvinculado';
    }

    // Notes simples: apenas o código do aluno
    const notes = `Código Prime: ${codigo}`;

    // Escapar campos
    const escapeField = (field) => {
        if (!field) return '';
        if (field.includes(',') || field.includes('"') || field.includes('\n')) {
            return '"' + field.replace(/"/g, '""') + '"';
        }
        return field;
    };

    const row = [
        escapeField(nomeCompleto),           // Name
        escapeField(firstName),               // Given Name
        escapeField(lastName),                // Family Name
        'Work',                               // E-mail 1 - Type
        escapeField(email),                   // E-mail 1 - Value
        'Mobile',                             // Phone 1 - Type
        telefone,                             // Phone 1 - Value
        'ULBRA',                              // Organization 1 - Name
        escapeField(situacaoAtual),           // Organization 1 - Title (situação)
        escapeField(notes)                    // Notes (apenas código)
    ].join(',');

    outputLines.push(row);
}

// Escrever arquivo
fs.writeFileSync(outputPath, outputLines.join('\n'), 'utf-8');

console.log(`✅ Arquivo criado: ${outputPath}`);
console.log(`📊 Total de contatos: ${outputLines.length - 1}`);
