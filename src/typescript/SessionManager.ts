// src/typescript/SessionManager.ts
class SessionManager {
    private sessionKey: string | null = null;
    private socket: WebSocket | null = null;
    private countdownInterval: number | null = null;
    private isExpired = false;
    private isDestroyed = false;
    private paymentData: any = null;
    private selectedNetwork: string | null = null;
    private selectedCoin: string | null = null;

    private elements = {
        qrCodeId: document.getElementById('qrCodeId')!,
        timeLeft: document.getElementById('timeLeft')!,
        statusTitle: document.getElementById('statusTitle')!,
        dropdownBtnNetwork: document.getElementById('dropdownBtnNetwork')!,
        dropdownBtnCoin: document.getElementById('dropdownBtnCoin')!,
        dropdownContentNetwork: document.getElementById('dropdownContentNetwork')!,
        dropdownContentCoin: document.getElementById('dropdownContentCoin')!,
        dropdownArrowNetwork: document.getElementById('dropdownArrowNetwork')!,
        dropdownArrowCoin: document.getElementById('dropdownArrowCoin')!,
        amountSection: document.getElementById('amountSection')!,
        amountInput: document.getElementById('amountInput') as HTMLInputElement,
        generateBtn: document.getElementById('generateBtn')!,
        qrcode: document.getElementById('qrcode')!,
        paymentInfo: document.getElementById('paymentInfo')!
    };

    init(): void {
        this.sessionKey = this.extractSessionKey();
        if (!this.sessionKey) return this.showError('Invalid session key');

        this.connectWebSocket();
        this.setupDropdowns();
        this.hidePaymentControls();
    }

    private extractSessionKey(): string | null {
        return new URLSearchParams(window.location.search).get('session');
    }

    private connectWebSocket(): void {
        if (this.isExpired || this.isDestroyed) return;

        this.socket = new WebSocket(`wss://zapzap666.xyz/ws/session?session=${this.sessionKey}`);

        this.socket.onopen = () => setTimeout(() => this.requestStatus(), 100);
        this.socket.onmessage = e => this.handleMessage(e);
        this.socket.onclose = e => { if (e.code === 1008) this.showExpiredState(); };
        this.socket.onerror = () => this.showError('Connection error');
    }

    private handleMessage(event: MessageEvent): void {
        if (this.isDestroyed) return;
        try {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'session_connected':
                    if (data.qrCodeId) this.elements.qrCodeId.textContent = data.qrCodeId;
                    if (typeof data.timeLeft === 'number') this.startCountdown(data.timeLeft);
                    this.elements.statusTitle.textContent = 'Session Active';
                    break;

                case 'payment_created':
                    if (data.data) {
                        this.paymentData = data.data;
                        this.showPaymentControls();
                    }
                    break;

                case 'payment_completed':
                    if (data.data) this.showPaymentSuccess(data.data);
                    break;

                case 'session_expired':
                case 'session_invalid':
                    this.showExpiredState();
                    break;

                case 'session_status':
                    if (data.data) {
                        const { qrCodeId, timeLeft } = data.data;
                        if (qrCodeId) this.elements.qrCodeId.textContent = qrCodeId;
                        if (typeof timeLeft === 'number') this.startCountdown(timeLeft);
                    }
                    break;
            }
        } catch (error) {
            console.error('Message parse error:', error);
        }
    }

    private requestStatus(): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ type: 'status_request' }));
        }
    }

    private startCountdown(seconds: number): void {
        if (this.countdownInterval) clearInterval(this.countdownInterval);

        let remaining = seconds;
        const tick = () => {
            if (this.isExpired || this.isDestroyed) return;
            this.updateTimeLeft(remaining);
            if (remaining-- <= 0) this.showExpiredState();
        };

        tick();
        this.countdownInterval = setInterval(tick, 1000);
    }

    private updateTimeLeft(seconds: number): void {
        if (seconds > 0) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            this.elements.timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            this.elements.timeLeft.className = seconds > 60
                ? 'text-green-400 text-sm font-bold'
                : 'text-yellow-400 text-sm font-bold';
        } else {
            this.elements.timeLeft.textContent = 'EXPIRED';
            this.elements.timeLeft.className = 'text-red-400 text-sm font-bold';
        }
    }

    private setupDropdowns(): void {
        this.setupDropdown(
            this.elements.dropdownBtnNetwork,
            this.elements.dropdownContentNetwork,
            this.elements.dropdownArrowNetwork,
            item => {
                this.selectedNetwork = item.getAttribute('data-network');
                this.updatePayButton();
            }
        );

        this.setupDropdown(
            this.elements.dropdownBtnCoin,
            this.elements.dropdownContentCoin,
            this.elements.dropdownArrowCoin,
            item => {
                this.selectedCoin = item.getAttribute('data-coin');
                if (this.paymentData) this.showPaymentAmount();
                this.updatePayButton();
            }
        );

        window.addEventListener('click', e => {
            if (!(e.target as HTMLElement).closest('.dropdown')) {
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.dropdown span').forEach(el => el.classList.remove('dropdown-arrow-rotate'));
            }
        });
    }

    private setupDropdown(btn: HTMLButtonElement, content: HTMLDivElement, arrow: HTMLSpanElement, callback: (item: HTMLDivElement) => void): void {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const isHidden = content.classList.contains('hidden');
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.dropdown span').forEach(el => el.classList.remove('dropdown-arrow-rotate'));
            if (isHidden) { content.classList.remove('hidden'); arrow.classList.add('dropdown-arrow-rotate'); }
        });

        content.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                btn.childNodes[0].textContent = item.textContent?.trim() || '';
                content.classList.add('hidden');
                arrow.classList.remove('dropdown-arrow-rotate');
                callback(item as HTMLDivElement);
            });
        });
    }

    private hidePaymentControls(): void {
        ['dropdownBtnNetwork', 'dropdownBtnCoin', 'amountSection', 'qrcode'].forEach(id => this.elements[id as keyof typeof this.elements].style.display = 'none');
    }

    private showPaymentControls(): void {
        if (!this.paymentData) return;
        ['dropdownBtnNetwork', 'dropdownBtnCoin'].forEach(id => this.elements[id as keyof typeof this.elements].style.display = 'block');
    }

    private showPaymentAmount(): void {
        if (!this.paymentData) return;
        this.elements.amountInput.style.display = 'none';

        if (!this.elements.amountSection.querySelector('.payment-amount-display')) {
            const display = document.createElement('div');
            display.className = 'payment-amount-display w-full p-4 text-base font-semibold border-2 border-crypto-border rounded-2xl bg-crypto-card text-white text-center mb-3';
            display.innerHTML = `
                <div class="text-lg font-bold">$${this.paymentData.amount_usd}</div>
                <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>
            `;
            this.elements.amountInput.parentNode?.insertBefore(display, this.elements.amountInput);
        }

        this.elements.generateBtn.textContent = 'Pay Now';
        this.elements.generateBtn.onclick = () => this.generatePaymentQR();
        this.updatePayButton();
        this.elements.amountSection.style.display = 'block';
    }

    private updatePayButton(): void {
        if (!this.paymentData) return;

        const btn = this.elements.generateBtn;
        const isValid = this.selectedNetwork === 'solana' && this.selectedCoin === 'USDC';

        if (isValid) {
            btn.disabled = false;
            btn.textContent = 'Pay Now';
            btn.style.backgroundColor = '';
        } else if (this.selectedNetwork && this.selectedCoin) {
            btn.disabled = true;
            btn.textContent = 'Only USDC on Solana supported';
            btn.style.backgroundColor = '#ef4444';
        } else {
            btn.disabled = true;
            btn.textContent = 'Choose Network & Coin';
            btn.style.backgroundColor = '';
        }
    }

    private async generatePaymentQR(): Promise<void> {
        if (!this.paymentData || this.selectedNetwork !== 'solana' || this.selectedCoin !== 'USDC') {
            return alert('Please select Solana network and USDC coin');
        }

        const btn = this.elements.generateBtn;
        btn.disabled = true;
        btn.textContent = 'Creating QR...';

        try {
            const response = await fetch(`https://zapzap666.xyz/api/payment/${this.sessionKey}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();

            this.elements.paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">$${this.paymentData.amount_usd}</div>
                    <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>
                    <div class="text-xs text-crypto-text-muted mt-2">Scan with Solana wallet</div>
                </div>
            `;

            const existingQR = this.elements.qrcode.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const wrapper = document.createElement('div');
            wrapper.className = 'qr-code-wrapper';

            const img = document.createElement('img');
            img.src = data.qr_code;
            img.alt = 'Payment QR Code';
            img.style.maxWidth = img.style.maxHeight = '250px';

            wrapper.appendChild(img);
            this.elements.qrcode.appendChild(wrapper);
            this.elements.qrcode.style.display = 'flex';

            this.elements.dropdownBtnNetwork.style.display = 'none';
            this.elements.dropdownBtnCoin.style.display = 'none';
            this.elements.amountSection.style.display = 'none';

        } catch (error: any) {
            alert(`Failed to generate payment QR: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Pay Now';
        }
    }

    private showPaymentSuccess(data: any): void {
        this.elements.statusTitle.textContent = 'Payment Completed!';
        this.elements.paymentInfo.innerHTML = `
            <div class="text-center">
                <div class="text-green-400 text-xl font-bold mb-2">✅ Payment Successful</div>
                <div class="text-white">$${data.amount_usd} paid</div>
                <div class="text-xs text-crypto-text-muted mt-2">Signature: ${data.signature.slice(0,16)}...</div>
            </div>
        `;
        this.hidePaymentControls();
    }

    private showExpiredState(): void {
        this.isExpired = true;
        this.destroy();
        this.elements.statusTitle.textContent = 'Session Expired';
        this.updateTimeLeft(0);
    }

    private showError(message: string): void {
        this.destroy();
        this.elements.statusTitle.textContent = message;
        this.elements.qrCodeId.textContent = 'Error';
        this.updateTimeLeft(0);
    }

    private destroy(): void {
        this.isDestroyed = true;
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.socket?.close();
        this.socket = null;
    }
}

document.addEventListener('DOMContentLoaded', () => new SessionManager().init());
(window as any).SessionManager = SessionManager;
