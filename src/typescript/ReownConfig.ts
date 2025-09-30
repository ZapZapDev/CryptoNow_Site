// src/typescript/ReownConfig.ts
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks';

// ⚠️ REPLACE WITH YOUR PROJECT ID FROM REOWN CLOUD
const REOWN_PROJECT_ID = '9ab07bacd3c34828a46f54c97d40b760';

// Solana protocol adapter (NOT wallet adapters!)
const solanaWeb3JsAdapter = new SolanaAdapter();

// App metadata
const metadata = {
    name: 'CryptoNow',
    description: 'CryptoNow Payment Platform',
    url: 'https://zapzap666.xyz',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Create AppKit with optimized config
export const modal = createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [solana, solanaTestnet, solanaDevnet],
    metadata,
    projectId: REOWN_PROJECT_ID,

    features: {
        analytics: false,
        email: false,
        socials: false,
        onramp: false,
        swaps: false,
        history: false
    },

    enableWalletConnect: true,
    enableInjected: true,
    enableCoinbaseWallet: false,
    enableEIP6963: true,

    allowUnsupportedChains: false,
    defaultNetwork: solana,
});

console.log('✅ Reown AppKit initialized (Vanilla JS - Solana Only)');

export default modal;