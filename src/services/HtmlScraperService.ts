import { whatsappLogger } from '@/lib/logger';
import * as cheerio from 'cheerio';

export class HtmlScraperService {
    /**
     * Extrai contéudo legível (title, meta description, h1-h6, p, e li) de uma página web
     * resolve redirects como lnkd.in
     */
    async scrapeUrlText(url: string): Promise<string> {
        try {
            whatsappLogger.info(`[HtmlScraper] Fetching URL: ${url}`);

            const response = await fetch(url, {
                redirect: 'follow', // Seguir redirecionamentos como lnkd.in
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
                }
            });

            if (!response.ok) {
                whatsappLogger.warn(`[HtmlScraper] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                return '';
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            const title = $('title').text() || '';
            const description = $('meta[name="description"]').attr('content') || '';
            const ogTitle = $('meta[property="og:title"]').attr('content') || '';
            const ogDescription = $('meta[property="og:description"]').attr('content') || '';

            // Remove tags inuteis para o scraping de conteudo (scripts, estilos, navs, headers etc)
            $('script, style, noscript, nav, header, footer, iframe, svg, img').remove();

            // Pega o conteudo principal, geralmente em tags de texto.
            let textContent = $('main, article, .job-description, [data-test-id="job-description"]').text();

            if (!textContent || textContent.trim().length < 50) {
                // Se nao achou main/article, pega body inteiro mas com cuidado
                textContent = $('body').text();
            }

            // Limpa o texto
            const cleanText = textContent
                .replace(/\s+/g, ' ')
                .trim();

            const finalContext = `
Title: ${title}
OG Title: ${ogTitle}
Description: ${description}
OG Description: ${ogDescription}

Content:
${cleanText.substring(0, 5000)}
            `.trim();

            return finalContext;

        } catch (error) {
            whatsappLogger.error(`[HtmlScraper] Error scraping ${url}:`, error);
            return '';
        }
    }
}

export const htmlScraperService = new HtmlScraperService();
