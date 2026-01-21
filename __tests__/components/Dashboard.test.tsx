import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from '@/app/page';

// Mock Recharts to avoid sizing issues in JSDOM
jest.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ children }: { children: React.ReactNode }) => <div data-testid="pie">{children}</div>,
    Cell: () => <div data-testid="cell" />,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
}));


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
