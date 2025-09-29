// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    root: 'src',
    optimizeDeps: {
        include: [
            '@solana/web3.js',
            '@reown/appkit',
            '@reown/appkit-adapter-solana',
            'buffer'
        ]
    },
    define: {
        global: 'globalThis',
        'process.env': {}
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
            }
        }
    },
    server: {
        fs: {
            strict: false
        }
    },
    appType: 'spa',
    configureServer: (server) => {
        server.middlewares.use((req, res, next) => {
            const routes = {
                '/Api': '/Api.html',
                '/Merchant': '/Merchant.html',
                '/Dashboard': '/Dashboard.html',
                '/Payment': '/Payment.html',
                '/header': '/header.html'
            };

            if (routes[req.url]) {
                req.url = routes[req.url];
            }

            next();
        });
    }
});