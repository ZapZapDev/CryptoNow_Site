// src/typescript/ReownConfig.ts
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana } from '@reown/appkit/networks';

const REOWN_PROJECT_ID = '9ab07bacd3c34828a46f54c97d40b760';

// Solana protocol adapter (не кошельки, а сам протокол)
const solanaWeb3JsAdapter = new SolanaAdapter();

// Метаданные приложения
const metadata = {
    name: 'CryptoNow',
    description: 'Crypto Payment Platform',
    url: 'https://zapzap666.xyz'
};

// Создание AppKit без лишнего UI
export const modal = createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [solana],
    defaultNetwork:  solana,
    metadata,
    projectId: REOWN_PROJECT_ID,

    // 🔧 Полностью отключаем всё, кроме подключения кошелька
    features: {
        analytics: false,
        email: false,
        socials: false,
        onramp: false,
        swaps: false,
        send: false,
        history: false
    },

    ui: {
        showSmartUi: false
    },

    enableWalletConnect: true,
    enableInjected: true,
    enableCoinbaseWallet: false,
    enableEIP6963: true,

    allowUnsupportedChains: false
});

export default modal;
