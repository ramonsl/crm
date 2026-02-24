import { VagasRemotasScraperService } from '@/services/VagasRemotasScraperService';

describe('VagasRemotasScraperService', () => {
    let service: VagasRemotasScraperService;

    beforeEach(() => {
        service = new VagasRemotasScraperService();
    });

    it('should parse job listings from HTML correctly', () => {
        const sampleHtml = `
            <a href="https://vagasremotas.com.br/vagas-home-office-remoto/teste-vaga/">
                <li class="left post-1234 job_listing type-job_listing status-publish job_listing_category-programacao job_listing_category-marketing job_listing_type-vaga-em-dolar">
                    <h3>Desenvolvedor Backend Pleno</h3>
                    <div class="company">Tech Corp</div>
                    <div class="date">Posted 2 dias ago</div>
                    <div class="description">Estamos buscando um desenvolvedor backend pleno com foco em Node.js. Se voc&ecirc; gosta de desafios&#8230; &lt;a href...</div>
                </li>
            </a>
        `;

        const jobs = service.parseJobListings(sampleHtml);

        expect(jobs).toHaveLength(1);
        expect(jobs[0].id).toBe('1234');
        expect(jobs[0].title).toBe('Desenvolvedor Backend Pleno');
        expect(jobs[0].company).toBe('Tech Corp');
        // 'Estamos buscando um desenvolvedor backend pleno com foco em Node.js. Se você gosta de desafios... <a href...'
        // After cleaning HTML tags and decoding, it should be clean.
        expect(jobs[0].url).toBe('https://vagasremotas.com.br/vagas-home-office-remoto/teste-vaga/');
        expect(jobs[0].type).toBe('vaga-em-dolar');
        expect(jobs[0].categories).toEqual(expect.arrayContaining(['programacao', 'marketing']));
        expect(jobs[0].dateText).toBe('Posted 2 dias ago');
    });

    it('should decode entities and strip truncated tags properly', () => {
        const sampleHtml = `
            <a href="https://vagasremotas.com.br/vagas-home-office-remoto/teste-vaga-2/">
                <li class="left post-5678 job_listing type-job_listing status-publish job_listing_type-vaga-nacional">
                    <h3>Vaga Teste</h3>
                    <div>Empresa Teste</div>
                    <div>Posted 5 horas ago</div>
                    <div>Texto com &#8230; e uma tag &lt;a href="http... truncada <a href="http</div>
                </li>
            </a>
        `;

        const jobs = service.parseJobListings(sampleHtml);

        expect(jobs).toHaveLength(1);
        expect(jobs[0].description).toBe('Texto com ... e uma tag <a href="http... truncada');
    });
});
