import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    optimizeDeps: {
        include: [
            '@solana/pay',
            '@solana/web3.js',
            '@solana/wallet-adapter-base',
            'buffer'
        ]
    },
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            buffer: 'buffer'
        }
    },
    build: {
        target: 'esnext',
        rollupOptions: {
            input: {
                main: './src/index.html',
                merchant: './src/Merchant.html',
                dashboard: './src/Dashboard.html',
                payment: './src/Payment.html'
            },
            output: {
                manualChunks: {
                    'solana': ['@solana/web3.js', '@solana/pay'],
                    'wallet': ['@solana/wallet-adapter-base']
                }
            }
        }
    },
    server: {
        fs: {
            strict: false
        },
        // Middleware для dev сервера - убираем .html из URL
        middlewareMode: false
    },
    // Добавляем поддержку роутинга без расширений
    appType: 'spa',
    // Custom middleware для обработки роутов
    configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
            const url = req.url;

            // Обработка роутов без расширений
            const routes = {
                '/Api': '/Api.html',
                '/Merchant': '/Merchant.html',
                '/Dashboard': '/Dashboard.html',
                '/Payment': '/Payment.html',
                '/header': '/header.html'
            };

            if (routes[url]) {
                req.url = routes[url];
            }

            next();
        });
    }
});