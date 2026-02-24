import { WorkeiScraperService } from '../../src/services/scrapers/WorkeiScraperService';

describe('WorkeiScraperService', () => {
    let service: WorkeiScraperService;

    beforeEach(() => {
        service = new WorkeiScraperService();
        // Mock global fetch
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should correctly parse a job from the WordPress API response', async () => {
        const mockApiResponse = [
            {
                id: 112233,
                date: '2026-02-24T06:48:51',
                link: 'https://workei.com.br/vaga-fcamara/',
                title: {
                    rendered: 'PESSOA GERENTE DE PROJETOS: FCamara Oferece Vaga 100% Home Office'
                },
                content: {
                    rendered: `
                        <p>A FCamara está contratando!</p>
                        <div class="wp-block-button">
                            <a class="wp-block-button__link wp-element-button" href="https://fcamara.gupy.io/jobs/10886282" target="_blank">Candidatar-se</a>
                        </div>
                    `
                }
            }
        ];

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockApiResponse
        });

        const jobs = await service.fetchRecentJobs(1);

        expect(jobs).toHaveLength(1);
        expect(jobs[0].title).toBe('PESSOA GERENTE DE PROJETOS');
        expect(jobs[0].company).toBe('FCamara');
        expect(jobs[0].applicationLink).toBe('https://fcamara.gupy.io/jobs/10886282');
        expect(jobs[0].description).toBe('A FCamara está contratando! Candidatar-se...');
        expect(jobs[0].isRemote).toBe(true);
        expect(jobs[0].location).toBe('Remoto');
    });

    it('should output the expected WhatsApp template formating', () => {
        const message = service.formatWhatsAppMessage({
            id: '1234',
            title: 'Software Engineer',
            company: 'TechCorp',
            description: 'Vaga boa',
            url: 'https://workei.com.br/techcorp',
            applicationLink: 'https://techcorp.gupy.io',
            createdAt: new Date(),
            location: 'Remoto',
            isRemote: true
        });

        expect(message).toContain('*SOFTWARE ENGINEER*');
        expect(message).toContain('🏢 *Empresa:* TechCorp');
        expect(message).toContain('🔗 *Link para Inscrição:*\nhttps://techcorp.gupy.io');
    });
});
