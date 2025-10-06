export const CONFIG = {
    SERVER_URL: 'https://zapzap666.xyz',
    WS_URL: 'wss://zapzap666.xyz',
    REQUEST_TIMEOUT: 90000,
    API_ENDPOINTS: {
        AUTH: {
            LOGIN: '/api/auth/login',
            VALIDATE: '/api/auth/validate',
            LOGOUT: '/api/auth/logout',
            API_KEY: '/api/user/api-key',
            GENERATE_API_KEY: '/api/user/generate-api-key'
        },
        MERCHANT: {
            NETWORKS: '/api/merchant/networks',
            QR_CODES: '/api/merchant/qr-codes'
        },
        PAYMENT: {
            STATE: '/api/payment',
            QR: '/api/payment'
        }
    }
};
