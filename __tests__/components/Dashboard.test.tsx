import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/app/page';

// Mock Recharts to avoid sizing issues in JSDOM
jest.mock('recharts', () => {
    const OriginalModule = jest.requireActual('recharts');
    return {
        ...OriginalModule,
        ResponsiveContainer: ({ children }: any) => <div style={{ width: 100, height: 100 }}>{children}</div>,
    };
});

describe('Dashboard', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('should render loading state initially', () => {
        global.fetch = jest.fn().mockImplementation(() => new Promise(() => { })); // Never resolves
        render(<Dashboard />);
        expect(screen.getByText('Carregando painel...')).toBeInTheDocument();
    });

    it('should render KPI cards with data', async () => {
        const mockStats = {
            total: 100,
            matriculados: 20,
            metaMatriculas: 100,
            conversionRate: '15.0',
            leadToMatriculaRatio: '5.0',
            inscritoToMatriculaRatio: '2.0',
            encaminhadosComercial: 10,
            encaminhadosMatriculados: 5,
            taxaConversaoComercial: '50.0',
            totalMessagesSent: 1000,
            whatsappMessagesSent: 800,
            templatesSent: 200,
            statusCounts: [],
            funnel: []
        };

        global.fetch = jest.fn().mockResolvedValue({
            json: async () => mockStats
        });

        render(<Dashboard />);

        await waitFor(() => {
            expect(screen.queryByText('Carregando painel...')).not.toBeInTheDocument();
        });

        expect(screen.getAllByText('100')[0]).toBeInTheDocument(); // Total Leads (and maybe messages 1000 - contains 100? No, exact match)
        // Actually getByText(100) might work if it's rendered as number
        expect(screen.getByText('20')).toBeInTheDocument(); // Matriculados
        expect(screen.getByText('15.0%')).toBeInTheDocument(); // Conversion
    });
});
