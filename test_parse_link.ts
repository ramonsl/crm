import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { htmlScraperService } from './src/services/HtmlScraperService';
import { jobTransformerService } from './src/services/JobTransformerService';

async function run() {
    const url = "https://www.linkedin.com/jobs/view/4358740061/";
    console.log("Fetching URL:", url);
    const text = await htmlScraperService.scrapeUrlText(url);

    console.log("\n--- HTML TEXT EXTRACTED (Length: " + text.length + ") ---");
    console.log(text.substring(0, 1000));

    console.log("\n--- RUNNING GPT TRANSFORM ---");
    const parsedJob = await jobTransformerService.transformPost(`Mensagem original: ${url}\n\nConteúdo do link:\n${text}`, "debug-id", url);

    console.log("\n--- RESULT ---");
    console.log(JSON.stringify(parsedJob, null, 2));
}

run().catch(console.error);
