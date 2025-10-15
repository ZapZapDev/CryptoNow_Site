// vite.config.js
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

// Custom HTML routing plugin
function htmlRoutingPlugin() {
    return {
        name: 'html-routing',
        enforce: 'pre', // Run BEFORE other plugins
        configureServer(server) {
            server.middlewares.use((req, res, next) => {
                // Skip if it's an asset request
                if (req.url.match(/\.(js|ts|css|png|jpg|svg|ico|json|woff|woff2|ttf)(\?.*)?$/)) {
                    return next();
                }

                const originalUrl = req.url;
                const url = req.url.split('?')[0].toLowerCase();
                
                // Route mappings
                const routes = {
                    '/': 'index.html',
                    '/merchant/create': 'MerchantCreate.html',
                    '/merchant/edit': 'MerchantCreate.html',
                    '/merchant/view': 'MerchantView.html',
                    '/merchant': 'Merchant.html',
                    '/api': 'Api.html',
                    '/dashboard': 'Dashboard.html',
                    '/payment': 'Payment.html',
                    '/header': 'header.html'
                };

                if (routes[url]) {
                    const htmlFile = routes[url];
                    console.log(`[HTML Router] ✓ ${originalUrl} → /${htmlFile}`);
                    
                    // Preserve query params
                    const queryParams = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
                    
                    // IMPORTANT: Set to absolute path from root
                    req.url = '/' + htmlFile + queryParams;
                }

                next();
            });
        }
    };
}

export default defineConfig({
    plugins: [
        htmlRoutingPlugin(),
        tailwindcss()
    ],
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
                main: 'index.html',
                merchant: 'Merchant.html',
                merchantCreate: 'MerchantCreate.html',
                merchantView: 'MerchantView.html',
                dashboard: 'Dashboard.html',
                payment: 'Payment.html',
                api: 'Api.html'
            }
        }
    },
    server: {
        fs: {
            strict: false
        }
    },
    appType: 'mpa'
});