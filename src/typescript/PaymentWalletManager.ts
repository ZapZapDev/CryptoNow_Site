import { modal, getActiveSolanaAdapter } from './ReownConfig';
import { CONFIG } from './config';
import { WalletUI } from './WalletUI';
import { Transaction, Connection, VersionedTransaction } from '@solana/web3.js';

const SERVER_URL = CONFIG.SERVER_URL;
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

export class PaymentWalletManager {
    private walletAddress: string | null = null;
    private isSubscribed: boolean = false;
    private walletDropdown: HTMLDivElement | null = null;
    private arrowIcon: SVGElement | null = null;
    private connection: Connection;

    constructor(
        private walletButton: HTMLButtonElement,
        private onConnected?: (address: string) => void,
        private onDisconnected?: () => void
    ) {
        this.connection = new Connection(SOLANA_RPC, 'confirmed');
    }

    isConnected(): boolean {
        return this.walletAddress !== null;
    }

    getAddress(): string | null {
        return this.walletAddress;
    }

    async connect(): Promise<void> {
        try {
            await modal.open();
        } catch (err) {
            console.error('Failed to open wallet modal:', err);
        }
    }

    async disconnect(): Promise<void> {
        try {
            await modal.disconnect();
        } catch (err) {
            console.error('Disconnect error:', err);
        }
        this.handleDisconnect();
    }

    private handleConnect(address: string): void {
        this.walletAddress = address;
        this.updateUI(address);
        this.onConnected?.(address);
    }

    private handleDisconnect(): void {
        this.walletAddress = null;
        this.resetUI();
        this.onDisconnected?.();
    }

    private updateUI(address: string): void {
        WalletUI.updateButton(this.walletButton, address, true);
        setTimeout(() => {
            this.arrowIcon = document.getElementById("walletArrow") as SVGElement;
        }, 0);
    }

    private resetUI(): void {
        WalletUI.resetButton(this.walletButton);
        WalletUI.setArrow(this.arrowIcon, false);
    }

    setupUI(): void {
        this.setupListeners();
        this.setupDropdown();
        this.setupButton();
    }

    private setupListeners(): void {
        if (this.isSubscribed) return;

        modal.subscribeState(() => {
        });

        modal.subscribeAccount((account) => {
            if (account && account.address) {
                if (account.address !== this.walletAddress) {
                    this.handleConnect(account.address);
                }
            } else {
                if (this.walletAddress) {
                    this.handleDisconnect();
                }
            }
        });

        this.isSubscribed = true;
    }

    private setupDropdown(): void {
        this.walletDropdown = WalletUI.createDropdown();
        this.walletDropdown.id = "paymentWalletDropdown";
        document.body.appendChild(this.walletDropdown);

        const positionDropdown = (): void => {
            if (!this.walletDropdown) return;
            WalletUI.positionDropdown(this.walletDropdown, this.walletButton);
        };

        const showDropdown = (): void => {
            if (!this.walletAddress || !this.walletDropdown) return;
            positionDropdown();
            this.walletDropdown.classList.remove("hidden");
            WalletUI.setArrow(this.arrowIcon, true);
        };

        const hideDropdown = (): void => {
            if (!this.walletDropdown) return;
            this.walletDropdown.classList.add("hidden");
            WalletUI.setArrow(this.arrowIcon, false);
        };

        const logoutBtn = this.walletDropdown.querySelector<HTMLButtonElement>("#logoutButton");
        logoutBtn?.addEventListener("click", async () => {
            await this.disconnect();
            hideDropdown();
        });

        this.walletButton.addEventListener("mouseenter", showDropdown);
        this.walletButton.addEventListener("mouseleave", hideDropdown);
        this.walletDropdown.addEventListener("mouseenter", showDropdown);
        this.walletDropdown.addEventListener("mouseleave", hideDropdown);
    }

    private setupButton(): void {
        this.walletButton.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!this.walletAddress) {
                await this.connect();
            }
        });
    }

    async payWithWallet(sessionKey: string, paymentData: any): Promise<{
        success: boolean;
        transactionId?: string;
        error?: string
    }> {
        if (!this.walletAddress) {
            return {success: false, error: 'Wallet not connected'};
        }

        try {
            // 1. Получаем правильный провайдер для подключенного кошелька
            let solanaProvider: any = null;
            const walletInfo = modal.getWalletInfo();
            const connectedWalletName = walletInfo?.name?.toLowerCase() || '';

            // Попытка 1: Reown subscribeProviders
            modal.subscribeProviders((providers: any) => {
                if (providers && providers['solana']) {
                    solanaProvider = providers['solana'];
                }
            });

            // Попытка 2: Используем специфичный провайдер на основе имени кошелька
            if (!solanaProvider) {
                if (connectedWalletName.includes('phantom') && (window as any).phantom?.solana) {
                    solanaProvider = (window as any).phantom.solana;
                } else if (connectedWalletName.includes('glow') && (window as any).glowSolana) {
                    solanaProvider = (window as any).glowSolana;
                } else if (connectedWalletName.includes('solflare') && (window as any).solflare) {
                    solanaProvider = (window as any).solflare;
                } else if (connectedWalletName.includes('backpack') && (window as any).backpack) {
                    solanaProvider = (window as any).backpack;
                } else if ((window as any).solana) {
                    solanaProvider = (window as any).solana;
                }
            }

            if (!solanaProvider) {
                return {success: false, error: 'Wallet provider not available'};
            }

            // 2. Получаем транзакцию от бэкенда
            const txResponse = await fetch(`${SERVER_URL}/api/payment/merchant/${paymentData.id}/transaction`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({account: this.walletAddress})
            });

            if (!txResponse.ok) {
                return {success: false, error: 'Failed to create transaction'};
            }

            const {transaction: base64Tx} = await txResponse.json();

            // 3. Десериализуем транзакцию
            const txBuffer = Buffer.from(base64Tx, 'base64');
            const transaction = Transaction.from(txBuffer);

            // 4. Подписываем и отправляем транзакцию
            let signature: string;

            if (typeof solanaProvider.signAndSendTransaction === 'function') {
                // Метод для browser extension wallets (Phantom, Solflare, etc.)
                const result = await solanaProvider.signAndSendTransaction(transaction, {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                });
                signature = result.signature || result;
            } else if (typeof solanaProvider.sendTransaction === 'function') {
                // Метод для Reown adapter
                signature = await solanaProvider.sendTransaction(transaction, this.connection, {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed'
                });
            } else {
                throw new Error('Wallet does not support transaction signing');
            }

            // 5. Отправляем signature на бэкенд
            const payResponse = await fetch(`${SERVER_URL}/api/payment/${sessionKey}/wallet-pay`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    walletAddress: this.walletAddress,
                    transactionId: signature
                })
            });

            if (!payResponse.ok) {
                const errorData = await payResponse.json();
                return {success: false, error: errorData.error || 'Payment recording failed'};
            }

            return {success: true, transactionId: signature};

        } catch (error: any) {
            // Обработка специфичных ошибок
            if (error?.message?.includes('User rejected')) {
                return {success: false, error: 'Transaction rejected by user'};
            }

            if (error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
                return {
                    success: false,
                    error: 'RPC rate limit. Please try again or contact support.'
                };
            }

            return {
                success: false,
                error: error?.message || 'Transaction failed'
            };
        }
    }
}
