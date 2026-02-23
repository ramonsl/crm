import { htmlScraperService } from '@/services/HtmlScraperService';

// Mocking fetch globally
global.fetch = jest.fn();

describe('HtmlScraperService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should gracefully handle network errors returning an empty string', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

        const result = await htmlScraperService.scrapeUrlText('http://example.com');
        expect(result).toBe('');
    });

    it('should return empty string if response is not ok', async () => {
        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found'
        });

        const result = await htmlScraperService.scrapeUrlText('http://example.com/404');
        expect(result).toBe('');
    });

    it('should extract title, description, and main text content', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Test Page Title</title>
                <meta name="description" content="This is a description">
            </head>
            <body>
                <header>Header that should be ignored</header>
                <main>
                    <h1>Main Content Heading</h1>
                    <p>This is the important core content we want to extract.</p>
                </main>
                <script>console.log('Ignore scripts')</script>
            </body>
            </html>
        `;

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            text: async () => mockHtml
        });

        const result = await htmlScraperService.scrapeUrlText('http://example.com/job');

        expect(result).toContain('Title: Test Page Title');
        expect(result).toContain('Description: This is a description');
        expect(result).toContain('Main Content Heading This is the important core content we want to extract.');
        expect(result).not.toContain('Ignore scripts');
        expect(result).not.toContain('Header that should be ignored'); // Since we scrape <main> preferably
    });
});
