const fs = require('fs');

// Ler o arquivo original como texto
let content = fs.readFileSync('contatos_2025-12-23.csv', 'utf-8');

// Parse: substituir quebras de linha dentro de campos quoted por " | "
let lines = [];
let currentLine = '';
let inQuotes = false;

for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (currentLine.trim()) {
            lines.push(currentLine);
        }
        currentLine = '';
    } else if (char === '\n' && inQuotes) {
        // Substituir quebra de linha por " | " dentro de campos quoted
        currentLine += ' | ';
    } else if (char !== '\r') {
        currentLine += char;
    }
}
if (currentLine.trim()) {
    lines.push(currentLine);
}

// Escrever arquivo corrigido
fs.writeFileSync('contatos_google_2025-12-24.csv', lines.join('\n'), 'utf-8');
console.log('Arquivo criado: contatos_google_2025-12-24.csv');
console.log('Total de linhas:', lines.length);
