
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function processFile() {
    const inputFile = path.join(process.cwd(), 'alunos_completo.csv');
    const outputFile = path.join(process.cwd(), 'alunos_formados.csv');

    const fileStream = fs.createReadStream(inputFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const outputStream = fs.createWriteStream(outputFile);

    let header = '';
    let count = 0;

    for await (const line of rl) {
        if (!header) {
            header = line;
            outputStream.write(line + '\n');
            continue;
        }

        // Simple CSV parsing assuming quotes are handled or we just search the line
        // logic: check if 'Formado' or 'Formando' exists in the line (simplest for this specific request)
        // A more robust check would parse columns, but 'Situacao' is the main text blob here.
        const lowerLine = line.toLowerCase();

        // Check for specific keywords
        if (lowerLine.includes('formado') || lowerLine.includes('formando')) {
            outputStream.write(line + '\n');
            count++;
        }
    }

    console.log(`Extraction complete. Found ${count} records.`);
}

processFile();
