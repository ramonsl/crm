import { formatGroupByLevel, formatDailySummary, GroupedJobItem } from '@/services/JobGroupMessageFormatter';
import { SeniorityLevel } from '@/services/SeniorityClassifier';

describe('JobGroupMessageFormatter', () => {
    const sampleJobs: GroupedJobItem[] = [
        {
            title: 'Desenvolvedor React',
            company: 'Tech Corp',
            location: '100% Remoto',
            url: 'https://example.com/1',
            description: 'Vaga para desenvolvedor React com experiência em TypeScript.',
        },
        {
            title: 'Backend Python',
            company: 'Data Inc',
            location: '100% Remoto',
            url: 'https://example.com/2',
            description: 'Vaga para backend com Python e Django.',
        },
    ];

    describe('formatGroupByLevel()', () => {
        it('should format junior level with correct header', () => {
            const result = formatGroupByLevel('junior', sampleJobs);
            expect(result).toContain('VAGAS REMOTAS');
            expect(result).toContain('JÚNIOR');
            expect(result).toContain('2 oportunidades');
        });

        it('should contain all job titles', () => {
            const result = formatGroupByLevel('junior', sampleJobs);
            expect(result).toContain('Desenvolvedor React');
            expect(result).toContain('Backend Python');
        });

        it('should contain company names', () => {
            const result = formatGroupByLevel('pleno', sampleJobs);
            expect(result).toContain('Tech Corp');
            expect(result).toContain('Data Inc');
        });

        it('should contain links', () => {
            const result = formatGroupByLevel('senior', sampleJobs);
            expect(result).toContain('https://example.com/1');
            expect(result).toContain('https://example.com/2');
        });

        it('should include institutional footer', () => {
            const result = formatGroupByLevel('estagio', sampleJobs);
            expect(result).toContain('ULBRA Torres');
            expect(result).toContain('Análise e Desenvolvimento de Sistemas');
        });

        it('should use singular when only 1 job', () => {
            const result = formatGroupByLevel('senior', [sampleJobs[0]]);
            expect(result).toContain('1 oportunidade');
            expect(result).not.toContain('oportunidades');
        });

        it('should handle large job lists without crashing', () => {
            const manyJobs = Array.from({ length: 100 }, (_, i) => ({
                title: `Vaga ${i}`,
                company: 'Company',
                location: 'Remoto',
                url: `https://example.com/${i}`,
                description: 'Descrição da vaga.',
            }));

            const result = formatGroupByLevel('outros', manyJobs);
            expect(result.length).toBeLessThanOrEqual(62000);
        });
    });

    describe('formatDailySummary()', () => {
        it('should show total count', () => {
            const stats: Record<SeniorityLevel, number> = {
                estagio: 5, junior: 10, pleno: 15, senior: 8, outros: 2,
            };
            const result = formatDailySummary(stats, 'Frase motivacional');
            expect(result).toContain('40');
            expect(result).toContain('RESUMO DO DIA');
        });

        it('should include motivational quote', () => {
            const stats: Record<SeniorityLevel, number> = {
                estagio: 0, junior: 3, pleno: 0, senior: 0, outros: 0,
            };
            const result = formatDailySummary(stats, 'O sucesso é inevitável');
            expect(result).toContain('O sucesso é inevitável');
        });

        it('should only show levels with jobs', () => {
            const stats: Record<SeniorityLevel, number> = {
                estagio: 0, junior: 5, pleno: 0, senior: 3, outros: 0,
            };
            const result = formatDailySummary(stats, 'quote');
            expect(result).toContain('Júnior');
            expect(result).toContain('Sênior');
            expect(result).not.toContain('Estágio');
            expect(result).not.toContain('Pleno');
            expect(result).not.toContain('Outros');
        });

        it('should include Coordena+ branding', () => {
            const stats: Record<SeniorityLevel, number> = {
                estagio: 1, junior: 0, pleno: 0, senior: 0, outros: 0,
            };
            const result = formatDailySummary(stats, 'q');
            expect(result).toContain('Coordena+ ADS');
        });
    });
});
