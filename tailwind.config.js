/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./src/**/*.{html,js,ts,tsx}'],
    theme: {
        extend: {
            colors: {
                'black': '#0c0c0c',
                'crypto-dark': '#171618',
                'crypto-card': '#121112',
                'crypto-border': '#2c2b2d',
                'crypto-border-hover': '#3c3b3d',
                'crypto-text-muted': '#919093',
                'crypto-focus': '#0a0a0a',
                'sol-gradient-from': '#9945FF',
                'sol-gradient-to': '#14F195',
                'usdc-gradient-from': '#2775CA',
                'usdc-gradient-to': '#4DB8E8',
            },
            fontFamily: {
                'system': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Open Sans', 'Helvetica Neue', 'sans-serif'],
            },
            maxWidth: {
                'crypto': '400px',
            },
            spacing: {
                '18': '4.5rem',
                '25': '6.25rem',
                '32': '2rem',
                '40': '2.5rem',
            },
            fontSize: {
                '22': ['1.375rem', '1.2'],
                '36': ['2.25rem', '1.1'],
            },
            letterSpacing: {
                'crypto': '0.5px',
            },
            boxShadow: {
                'crypto': '0 2px 4px rgba(0, 0, 0, 0.25)',
                'crypto-lg': '0 4px 8px rgba(0, 0, 0, 0.25)',
            },
            animation: {
                'dropdown': 'dropdown 0.3s ease',
            },
            keyframes: {
                dropdown: {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(180deg)' },
                }
            },
            transitionProperty: {
                'dropdown': 'transform',
            }
        },
    },
    plugins: [],
}