import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { vagasRemotasScraperService } from '../src/services/VagasRemotasScraperService';

async function main() {
    console.log('Testing VagasRemotas Scraper...');
    try {
        const jobs = await vagasRemotasScraperService.fetchJobs();
        console.log(`\nFound ${jobs.length} total jobs.`);

        if (jobs.length > 0) {
            console.log('\nSample job:');
            console.log(JSON.stringify(jobs[0], null, 2));

            console.log('\nFormatting WhatsApp Message for sample job:');
            console.log(vagasRemotasScraperService.formatWhatsAppMessage(jobs[0]));

            // Test filtering
            const recent = vagasRemotasScraperService.filterRecentJobs(jobs, 48);
            console.log(`\nFound ${recent.length} recent jobs (last 48h).`);
        }
    } catch (error) {
        console.error('Error fetching jobs:', error);
    }
}

main().catch(console.error);
