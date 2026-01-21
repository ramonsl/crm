import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignora pacotes de servidor no build client
  serverExternalPackages: [
    'whatsapp-web.js',
    '@whiskeysockets/baileys',
    'pino',
    'pino-pretty',
    'thread-stream',
    'jimp',
    'sharp',
    'puppeteer',
    'puppeteer-core',
    '@wppconnect-team/wppconnect',
    'electron',
    'keyv'
  ],

  // Configuração Webpack para ignorar dependências binárias
  webpack: (config) => {
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
      'electron': 'commonjs electron',
    });
    return config;
  },

  // Silencia erro de Turbopack + Webpack config
  turbopack: {},

  // SECURITY FIX #61: Desabilita header X-Powered-By
  poweredByHeader: false,

  // SECURITY FIX #53: Headers de Segurança
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
