// src/typescript/ReownConfig.ts - PURE VANILLA JS VERSION
import { createAppKit } from '@reown/appkit';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { solana, solanaTestnet, solanaDevnet } from '@reown/appkit/networks';

// ⚠️ ЗАМЕНИ НА СВОЙ PROJECT ID ИЗ REOWN CLOUD
const REOWN_PROJECT_ID = 'твой_project_id_здесь';

// Создаем Solana адаптер ПРОТОКОЛА (не кошельков!)
const solanaWeb3JsAdapter = new SolanaAdapter();

// Метаданные приложения
const metadata = {
    name: 'CryptoNow',
    description: 'CryptoNow Payment Platform',
    url: 'https://zapzap666.xyz',
    icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// Создаем AppKit для Vanilla JS (без React!)
export const modal = createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [solana, solanaTestnet, solanaDevnet],
    metadata,
    projectId: REOWN_PROJECT_ID,
    features: {
        analytics: false
    }
});

console.log('✅ Reown AppKit initialized (Vanilla JS)');

export default modal;