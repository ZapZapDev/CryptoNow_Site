import { CONFIG } from './config';
import { PaymentWalletManager } from './PaymentWalletManager';

class SessionManager {
    private readonly SERVER_URL = CONFIG.SERVER_URL;
    private readonly WS_URL = CONFIG.WS_URL;
    private sessionKey: string | null = null;
    private socket: WebSocket | null = null;
    private countdownTimer: number | null = null;
    private paymentData: any = null;
    private selectedNetwork: string | null = null;
    private selectedCoin: string | null = null;
    private walletManager: PaymentWalletManager | null = null;

    private elements = {
        statusTitle: document.getElementById('statusTitle')!,
        qrCodeId: document.getElementById('qrCodeId')!,
        timeLeft: document.getElementById('timeLeft')!,
        amountRow: document.getElementById('amountRow')!,
        amountValue: document.getElementById('amountValue')!,
        dropdownBtnNetwork: document.getElementById('dropdownBtnNetwork') as HTMLButtonElement,
        dropdownBtnCoin: document.getElementById('dropdownBtnCoin') as HTMLButtonElement,
        dropdownContentNetwork: document.getElementById('dropdownContentNetwork')!,
        dropdownContentCoin: document.getElementById('dropdownContentCoin')!,
        dropdownArrowNetwork: document.getElementById('dropdownArrowNetwork')!,
        dropdownArrowCoin: document.getElementById('dropdownArrowCoin')!,
        generateBtn: document.getElementById('generateBtn') as HTMLButtonElement,
        qrcode: document.getElementById('qrcode')!,
        paymentInfo: document.getElementById('paymentInfo')!
    };

    async init(): Promise<void> {
        this.sessionKey = new URLSearchParams(window.location.search).get('session');

        if (!this.sessionKey) {
            this.showError();
            return;
        }

        this.initializeDisabledStates();
        this.initializeWalletManager();

        try {
            await this.loadSessionState();
            await this.connectWebSocket();
            this.setupDropdowns();
        } catch {
            this.showError();
        }
    }

    private setButtonState(button: HTMLButtonElement, enabled: boolean): void {
        button.disabled = !enabled;
        button.style.opacity = enabled ? '1' : '0.5';
        button.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    private initializeDisabledStates(): void {
        this.setButtonState(this.elements.dropdownBtnNetwork, false);
        this.setButtonState(this.elements.generateBtn, false);
    }

    private initializeWalletManager(): void {
        const walletButton = document.getElementById('paymentWalletButton') as HTMLButtonElement;
        if (!walletButton) return;

        this.walletManager = new PaymentWalletManager(
            walletButton,
            (address) => {
                const payWithWalletBtn = document.getElementById('payWithWalletBtn') as HTMLButtonElement;
                if (payWithWalletBtn) {
                    payWithWalletBtn.classList.remove('hidden');
                    payWithWalletBtn.onclick = () => this.handleWalletPayment();
                }
            },
            () => {
                const payWithWalletBtn = document.getElementById('payWithWalletBtn') as HTMLButtonElement;
                if (payWithWalletBtn) {
                    payWithWalletBtn.classList.add('hidden');
                }
            }
        );

        this.walletManager.setupUI();
    }



    private async loadSessionState(): Promise<void> {
        const response = await fetch(`${this.SERVER_URL}/api/payment/${this.sessionKey}/state`);

        if (!response.ok) throw new Error('Session not found');

        const data = await response.json();
        if (!data.success) throw new Error(data.error);

        this.handleSessionUpdate(data.data);
    }

    private async handleSessionUpdate(sessionData: any): Promise<void> {
        const { uiState, qrId, payment, timeLeft } = sessionData;

        if (qrId) this.elements.qrCodeId.textContent = qrId;
        if (typeof timeLeft === 'number') this.startCountdown(timeLeft);

        if (uiState === 'wait') {
            this.showWaitState();
        } else if (uiState === 'choose' && payment) {
            this.paymentData = payment;
            this.showChooseState();
        } else if (uiState === 'payment' && payment) {
            this.paymentData = payment;
            await this.showPaymentState();
        }
    }

    private showWaitState(): void {
        this.elements.statusTitle.textContent = 'Waiting for Request';
        this.hidePaymentControls();
        this.hideWalletControls(); // Скрываем кнопки кошелька
    }

    private showChooseState(): void {
        this.elements.statusTitle.textContent = 'Choose Payment Method';
        this.showPaymentInfo();
        this.showPaymentControls();
        this.hideWalletControls(); // Скрываем кнопки кошелька
    }

    private async showPaymentState(): Promise<void> {
        this.elements.statusTitle.textContent = 'CryptoNow';
        this.showPaymentInfo();
        this.hidePaymentControls();
        await this.generateQR();
        this.showWalletControls(); // Показываем кнопки кошелька только здесь
    }

    private showWalletControls(): void {
        const walletButton = document.getElementById('paymentWalletButton') as HTMLButtonElement;
        const payWithWalletBtn = document.getElementById('payWithWalletBtn') as HTMLButtonElement;

        if (walletButton) {
            walletButton.classList.remove('hidden');
        }

        if (payWithWalletBtn && this.walletManager?.isConnected()) {
            payWithWalletBtn.classList.remove('hidden');
            payWithWalletBtn.onclick = () => this.handleWalletPayment();
        }
    }

    private hideWalletControls(): void {
        const walletButton = document.getElementById('paymentWalletButton') as HTMLButtonElement;
        const payWithWalletBtn = document.getElementById('payWithWalletBtn') as HTMLButtonElement;

        // Принудительно скрываем обе кнопки
        if (walletButton) {
            walletButton.classList.add('hidden');
        }

        if (payWithWalletBtn) {
            payWithWalletBtn.classList.add('hidden');
        }
    }

    private showPaymentInfo(): void {
        if (!this.paymentData) return;

        this.elements.amountValue.textContent = `${this.paymentData.amount_usd} USD`;
        this.elements.amountRow.classList.remove('hidden');
    }

    private togglePaymentControls(show: boolean): void {
        const coinDropdownParent = this.elements.dropdownBtnCoin.parentElement as HTMLElement;
        const networkDropdownParent = this.elements.dropdownBtnNetwork.parentElement as HTMLElement;
        const display = show ? 'block' : 'none';

        if (coinDropdownParent) coinDropdownParent.style.display = display;
        if (networkDropdownParent) networkDropdownParent.style.display = display;
        this.elements.generateBtn.style.display = display;
    }

    private showPaymentControls(): void {
        this.togglePaymentControls(true);
    }

    private hidePaymentControls(): void {
        this.togglePaymentControls(false);
    }

    private setupDropdowns(): void {
        const toggleDropdown = (content: HTMLElement, arrow: HTMLElement, isOpen: boolean) => {
            content.classList.toggle('hidden', !isOpen);
            arrow.style.transform = `rotate(${isOpen ? 180 : 0}deg)`;
        };

        const closeAllDropdowns = () => {
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.dropdown span').forEach((arrow: Element) => {
                (arrow as HTMLElement).style.transform = 'rotate(0deg)';
            });
        };

        this.elements.dropdownBtnCoin.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyOpen = !this.elements.dropdownContentCoin.classList.contains('hidden');
            closeAllDropdowns();
            if (!isCurrentlyOpen) {
                toggleDropdown(this.elements.dropdownContentCoin, this.elements.dropdownArrowCoin, true);
            }
        });

        this.elements.dropdownBtnNetwork.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.elements.dropdownBtnNetwork.disabled) return;
            const isCurrentlyOpen = !this.elements.dropdownContentNetwork.classList.contains('hidden');
            closeAllDropdowns();
            if (!isCurrentlyOpen) {
                toggleDropdown(this.elements.dropdownContentNetwork, this.elements.dropdownArrowNetwork, true);
            }
        });

        this.elements.dropdownContentCoin.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedCoin = (item as HTMLElement).dataset.coin || null;
                this.elements.dropdownBtnCoin.childNodes[0].textContent = item.textContent?.trim() || 'Choose Coin';
                toggleDropdown(this.elements.dropdownContentCoin, this.elements.dropdownArrowCoin, false);

                this.setButtonState(this.elements.dropdownBtnNetwork, true);

                this.updatePayButton();
            });
        });

        this.elements.dropdownContentNetwork.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedNetwork = (item as HTMLElement).dataset.network || null;
                this.elements.dropdownBtnNetwork.childNodes[0].textContent = item.textContent?.trim() || 'Choose Network';
                toggleDropdown(this.elements.dropdownContentNetwork, this.elements.dropdownArrowNetwork, false);
                this.updatePayButton();
            });
        });

        this.elements.generateBtn.addEventListener('click', () => this.handlePayment());

        document.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown')) {
                closeAllDropdowns();
            }
        });
    }

    private updatePayButton(): void {
        const isReady = this.selectedNetwork === 'solana' && this.selectedCoin === 'USDC';
        this.setButtonState(this.elements.generateBtn, isReady);
    }

    private async handlePayment(): Promise<void> {
        if (!this.paymentData || this.selectedNetwork !== 'solana' || this.selectedCoin !== 'USDC') {
            return;
        }

        await this.handleQRPayment();
    }

    private async handleWalletPayment(): Promise<void> {
        if (!this.walletManager || !this.sessionKey) return;

        const payWithWalletBtn = document.getElementById('payWithWalletBtn') as HTMLButtonElement;
        if (!payWithWalletBtn) return;

        payWithWalletBtn.disabled = true;
        payWithWalletBtn.textContent = 'Processing...';

        try {
            const result = await this.walletManager.payWithWallet(this.sessionKey, this.paymentData);

            if (result.success) {
                payWithWalletBtn.textContent = 'Payment Successful!';
            } else {
                alert(result.error || 'Payment failed');
                payWithWalletBtn.textContent = 'Pay with Wallet';
                payWithWalletBtn.disabled = false;
            }
        } catch (err) {
            console.error('Payment failed:', err);
            alert('Payment failed');
            payWithWalletBtn.textContent = 'Pay with Wallet';
            payWithWalletBtn.disabled = false;
        }
    }

    private async handleQRPayment(): Promise<void> {
        this.elements.generateBtn.disabled = true;
        this.elements.generateBtn.textContent = 'Creating QR...';

        try {
            await this.generateQR();
            this.hidePaymentControls();
        } catch {
            this.elements.generateBtn.disabled = false;
            this.elements.generateBtn.textContent = 'Pay Now';
        }
    }

    private async generateQR(): Promise<void> {
        const response = await fetch(`${this.SERVER_URL}/api/payment/${this.sessionKey}/qr`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });

        if (!response.ok) throw new Error('QR generation failed');

        const data = await response.json();

        this.elements.qrcode.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'qr-code-wrapper';

        const img = document.createElement('img');
        img.src = data.qr_code;
        img.alt = 'Payment QR Code';
        img.style.maxWidth = '250px';
        img.style.maxHeight = '250px';

        wrapper.appendChild(img);

        const infoDiv = document.createElement('div');
        infoDiv.className = 'text-center mt-4';
        infoDiv.innerHTML = '<div class="text-xs text-crypto-text-muted">Scan with Solana wallet</div>';

        this.elements.qrcode.appendChild(wrapper);
        this.elements.qrcode.appendChild(infoDiv);
        this.elements.qrcode.style.display = 'flex';
        this.elements.qrcode.style.flexDirection = 'column';
    }

    // ✅ ИСПРАВЛЕНО: Теперь async + убрана задержка 100ms
    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.socket = new WebSocket(`${this.WS_URL}/ws/session?session=${this.sessionKey}`);

            this.socket.onopen = () => {
                // ✅ ИСПРАВЛЕНО: Убрали setTimeout, запрашиваем сразу
                if (this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'status_request' }));
                }
                resolve();
            };

            this.socket.onerror = () => {
                reject(new Error('WebSocket connection failed'));
            };

            this.socket.onmessage = (e) => {
                const data = JSON.parse(e.data);

                switch (data.type) {
                    case 'session_connected':
                        // ✅ ИСПРАВЛЕНО: session_connected содержит только таймер
                        if (typeof data.timeLeft === 'number') this.startCountdown(data.timeLeft);
                        break;
                    case 'session_status':
                        // ✅ ПОЛНОЕ состояние приходит через session_status
                        this.handleSessionUpdate(data.data);
                        break;
                    case 'payment_created':
                        if (data.data && data.uiState === 'choose') {
                            this.paymentData = data.data;
                            this.showChooseState();
                        }
                        break;
                    case 'qr_generated':
                        if (data.uiState === 'payment') this.showPaymentState();
                        break;
                    case 'session_expired':
                    case 'session_invalid':
                        this.showError();
                        break;
                }
            };

            this.socket.onclose = (e) => {
                if (e.code === 1008) this.showError();
            };
        });
    }

    private startCountdown(seconds: number): void {
        if (this.countdownTimer) clearInterval(this.countdownTimer);

        let remaining = seconds;

        const tick = () => {
            const mins = Math.floor(remaining / 60);
            const secs = remaining % 60;

            this.elements.timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            this.elements.timeLeft.className = remaining > 60
                ? 'text-green-400 text-sm font-bold'
                : 'text-yellow-400 text-sm font-bold';

            if (remaining-- <= 0) {
                this.showError();
            }
        };

        tick();
        this.countdownTimer = setInterval(tick, 1000);
    }

    private showError(): void {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.socket?.close();

        document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-[#0c0c0c]"><div class="text-red-400 text-3xl font-bold">404</div></div>';
    }
}

document.addEventListener('DOMContentLoaded', () => new SessionManager().init());