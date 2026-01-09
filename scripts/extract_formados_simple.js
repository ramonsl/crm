
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function processFile() {
    const inputFile = path.join(process.cwd(), 'alunos_formados.csv');
    const outputFile = path.join(process.cwd(), 'alunos_formados_contato.csv');

    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(outputFile);
    outputStream.write('Nome,Telefone\n');

    let isHeader = true;

    for await (const line of rl) {
        if (isHeader) {
            isHeader = false;
            continue; // Skip original header
        }

        const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
        const matches = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            matches.push(match[1] || match[2] || '');
        }

        if (matches.length < 5) continue;

        const nome = matches[1].trim();
        let rawPhone = matches[4];

        // Remove junk "E-mail:..."
        let cleanPhonePart = rawPhone.split(/\s+E-mail/)[0].trim();

        // Remove non-digit chars
        let digits = cleanPhonePart.replace(/\D/g, '');

        // Logic to add default DDD 51
        if (digits.length === 8 || digits.length === 9) {
            digits = '51' + digits;
        }

        // Format: XXXXXXXXXXX (numbers only, e.g. 5130917283)
        let formattedPhone = digits;
        if (digits.length >= 10 && digits.length <= 11) {
            // It's already just digits from the regex replace above
            // formattedPhone = digits; 
            // The previous logic was splitting it. Since 'digits' contains only numbers and we added '51', 
            // 'digits' IS the formatting we want.
            formattedPhone = digits;
        }

        outputStream.write(`"${nome}","${formattedPhone}"\n`);
    }

    console.log(`Processed file saved to: ${outputFile}`);
}

processFile();
