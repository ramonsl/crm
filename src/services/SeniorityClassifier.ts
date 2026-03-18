/**
 * SeniorityClassifier
 *
 * Responsibility: classify a job into a seniority level based on title and optional tags.
 * Pure function module — no side effects, no external dependencies.
 */

export type SeniorityLevel = 'estagio' | 'junior' | 'pleno' | 'senior' | 'outros';

export const SENIORITY_LABELS: Record<SeniorityLevel, string> = {
    estagio: '🐣 Estágio / Trainee',
    junior: '🟢 Júnior',
    pleno: '🟡 Pleno',
    senior: '🔴 Sênior',
    outros: '⚪ Outros',
};

const SENIORITY_PATTERNS: [RegExp, SeniorityLevel][] = [
    [/estagi|trainee|aprendiz/i, 'estagio'],
    [/\bjr\b|\bjunior\b|\bjúnior\b/i, 'junior'],
    [/\bpleno\b|\bmid[- ]?level\b|\bpl\b/i, 'pleno'],
    [/\bsenior\b|\bsênior\b|\bsr\b|\blead\b|\bstaff\b|\bprincipal\b/i, 'senior'],
];

const TAG_MAP: Record<string, SeniorityLevel> = {
    'Estágio': 'estagio',
    'Jovem Aprendiz': 'estagio',
    'Júnior': 'junior',
    'Junior': 'junior',
    'Pleno': 'pleno',
    'Sênior': 'senior',
    'Senior': 'senior',
};

/**
 * Classify a job by seniority level.
 *
 * Priority:
 *  1. Explicit tags (e.g. Remotar tags like "Júnior", "Estágio")
 *  2. Regex match on title
 *  3. Regex match on description (first 500 chars)
 *  4. Fallback: 'outros'
 */
export function classifySeniority(
    title: string,
    tags?: string[],
    description?: string,
): SeniorityLevel {
    // 1. Try tags first (most reliable)
    if (tags && tags.length > 0) {
        for (const tag of tags) {
            const mapped = TAG_MAP[tag];
            if (mapped) return mapped;
        }
    }

    // 2. Regex match on title
    for (const [pattern, level] of SENIORITY_PATTERNS) {
        if (pattern.test(title)) return level;
    }

    // 3. Regex match on description (first 500 chars)
    if (description) {
        const snippet = description.substring(0, 500);
        for (const [pattern, level] of SENIORITY_PATTERNS) {
            if (pattern.test(snippet)) return level;
        }
    }

    // 4. Fallback
    return 'outros';
}
