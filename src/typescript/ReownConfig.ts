// src/typescript/ReownConfig.ts
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks';
import { Connection } from '@solana/web3.js';

const REOWN_PROJECT_ID = '9ab07bacd3c34828a46f54c97d40b760';

// ⚠️ ВАЖНО: Публичный RPC имеет rate limit!
// Для production используйте платный RPC (Helius, QuickNode, Alchemy)
// Примеры:
// - Helius: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
// - QuickNode: https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_TOKEN/
// - Alchemy: https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY

const SOLANA_RPC = 'https://api.mainnet-beta.solana.com'; // Публичный RPC (rate limited)

// Создаем Solana Connection
const solanaConnection = new Connection(SOLANA_RPC, 'confirmed');

// Solana adapter с настроенным Connection
const solanaWeb3JsAdapter = new SolanaAdapter({
    connection: solanaConnection
});

// Экспортируем adapter И modal
export { solanaWeb3JsAdapter };

// Функция для получения активного адаптера из modal (ПОСЛЕ подключения)
export function getActiveSolanaAdapter() {
    // modal внутри хранит активный адаптер
    return (modal as any).adapter || (modal as any).getAdapter?.('solana') || solanaWeb3JsAdapter;
}

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
