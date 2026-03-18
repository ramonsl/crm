import { classifySeniority, SeniorityLevel } from '@/services/SeniorityClassifier';

describe('SeniorityClassifier', () => {
    describe('classifySeniority()', () => {
        // ── Tags (highest priority) ──────────────────────────────
        it('should classify "Estágio" tag as estagio', () => {
            expect(classifySeniority('Dev Frontend', ['Estágio'])).toBe('estagio');
        });

        it('should classify "Júnior" tag as junior', () => {
            expect(classifySeniority('Dev Backend', ['Júnior'])).toBe('junior');
        });

        it('should classify "Jovem Aprendiz" tag as estagio', () => {
            expect(classifySeniority('Assistente TI', ['Jovem Aprendiz'])).toBe('estagio');
        });

        it('should classify "Senior" tag as senior', () => {
            expect(classifySeniority('Engenheiro de Software', ['Senior'])).toBe('senior');
        });

        // ── Title regex ──────────────────────────────────────────
        it('should classify title with "estagiário" as estagio', () => {
            expect(classifySeniority('Estagiário de Desenvolvimento')).toBe('estagio');
        });

        it('should classify title with "trainee" as estagio', () => {
            expect(classifySeniority('Trainee de TI')).toBe('estagio');
        });

        it('should classify title with "junior" as junior', () => {
            expect(classifySeniority('Desenvolvedor Junior Full Stack')).toBe('junior');
        });

        it('should classify title with "jr" as junior', () => {
            expect(classifySeniority('Dev Jr Python')).toBe('junior');
        });

        it('should classify title with "pleno" as pleno', () => {
            expect(classifySeniority('Desenvolvedor Pleno React')).toBe('pleno');
        });

        it('should classify title with "mid-level" as pleno', () => {
            expect(classifySeniority('Mid-Level Software Engineer')).toBe('pleno');
        });

        it('should classify title with "sênior" as senior', () => {
            expect(classifySeniority('Desenvolvedor Sênior Java')).toBe('senior');
        });

        it('should classify title with "sr" as senior', () => {
            expect(classifySeniority('Sr. Backend Developer')).toBe('senior');
        });

        it('should classify title with "lead" as senior', () => {
            expect(classifySeniority('Tech Lead Backend')).toBe('senior');
        });

        it('should classify title with "staff" as senior', () => {
            expect(classifySeniority('Staff Engineer')).toBe('senior');
        });

        // ── Description fallback ─────────────────────────────────
        it('should use description when title has no match', () => {
            expect(classifySeniority('Desenvolvedor Python', [], 'Buscamos profissional pleno com experiência')).toBe('pleno');
        });

        // ── Fallback ─────────────────────────────────────────────
        it('should return "outros" when no match found', () => {
            expect(classifySeniority('Desenvolvedor')).toBe('outros');
        });

        it('should return "outros" for generic titles', () => {
            expect(classifySeniority('Analista de Sistemas')).toBe('outros');
        });

        // ── Priority: tags win over title ────────────────────────
        it('should prioritize tag over title regex', () => {
            // Title says senior but tag says junior
            expect(classifySeniority('Senior Developer', ['Júnior'])).toBe('junior');
        });

        // ── Edge cases ───────────────────────────────────────────
        it('should handle empty strings', () => {
            expect(classifySeniority('')).toBe('outros');
        });

        it('should handle undefined tags', () => {
            expect(classifySeniority('Dev Pleno', undefined, undefined)).toBe('pleno');
        });
    });
});
