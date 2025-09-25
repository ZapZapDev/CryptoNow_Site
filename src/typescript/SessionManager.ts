// src/typescript/SessionManager.ts - Оптимизированная версия
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
        this.sessionKey = new URLSearchParams(window.location.search).get('session');
        if (!this.sessionKey) return this.showError('Invalid session key');

        this.connectWebSocket();
        this.setupDropdowns();
        this.hidePaymentControls();
    }

    private connectWebSocket(): void {
        if (this.isExpired || this.isDestroyed) return;

        this.socket = new WebSocket(`wss://zapzap666.xyz/ws/session?session=${this.sessionKey}`);
        this.socket.onopen = () => setTimeout(() => this.requestStatus(), 100);
        this.socket.onmessage = e => this.handleMessage(e);
        this.socket.onclose = e => e.code === 1008 && this.showExpiredState();
        this.socket.onerror = () => this.showError('Connection error');
    }

    private handleMessage(event: MessageEvent): void {
        if (this.isDestroyed) return;

        try {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'session_connected':
                    this.elements.qrCodeId.textContent = data.qrCodeId;
                    if (typeof data.timeLeft === 'number') this.startRealCountdown(data.timeLeft);
                    this.elements.statusTitle.textContent = 'Session Active';
                    break;
                case 'payment_created':
                    this.paymentData = data.data;
                    this.showPaymentControls();
                    console.log('💳 Payment data received:', data.data);
                    break;
                case 'payment_completed':
                    this.showPaymentSuccess(data.data);
                    break;
                case 'session_expired':
                case 'session_invalid':
                    this.showExpiredState();
                    break;
                case 'session_status':
                    if (data.data) {
                        const { qrCodeId, timeLeft } = data.data;
                        if (qrCodeId) this.elements.qrCodeId.textContent = qrCodeId;
                        if (typeof timeLeft === 'number') this.startRealCountdown(timeLeft);
                    }
                    break;
            }
        } catch (err) {
            console.error('❌ Message parse error:', err);
        }
    }

    private requestStatus(): void {
        if (this.socket?.readyState === WebSocket.OPEN) {
            console.log('📡 Requesting session status...');
            this.socket.send(JSON.stringify({ type: 'status_request' }));
        }
    }

    private startRealCountdown(seconds: number): void {
        this.clearCountdown();
        let remaining = seconds;

        const update = () => {
            if (this.isExpired || this.isDestroyed) return;
            this.updateTimeLeft(remaining);
            if (remaining-- <= 0) this.showExpiredState();
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
    }

    private updateTimeLeft(seconds: number): void {
        if (seconds > 0) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            this.elements.timeLeft.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            this.elements.timeLeft.className = seconds > 60 ? 'text-green-400 text-sm font-bold' : 'text-yellow-400 text-sm font-bold';
        } else {
            this.elements.timeLeft.textContent = 'EXPIRED';
            this.elements.timeLeft.className = 'text-red-400 text-sm font-bold';
        }
    }

    private setupDropdowns(): void {
        this.setupDropdown(this.elements.dropdownBtnNetwork, this.elements.dropdownContentNetwork, this.elements.dropdownArrowNetwork, item => {
            this.selectedNetwork = item.getAttribute('data-network');
            console.log('Selected Network:', this.selectedNetwork);
            this.updatePayButton();
        });

        this.setupDropdown(this.elements.dropdownBtnCoin, this.elements.dropdownContentCoin, this.elements.dropdownArrowCoin, item => {
            this.selectedCoin = item.getAttribute('data-coin');
            console.log('Selected Coin:', this.selectedCoin);
            if (this.paymentData) this.showPaymentAmount();
            this.updatePayButton();
        });

        window.addEventListener('click', e => {
            if (!(e.target as HTMLElement).closest('.dropdown')) {
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.dropdown span').forEach(el => el.classList.remove('dropdown-arrow-rotate'));
            }
        });
    }

    private setupDropdown(btn: HTMLButtonElement, content: HTMLDivElement, arrow: HTMLSpanElement, callback: (item: HTMLDivElement) => void) {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.dropdown span').forEach(el => el.classList.remove('dropdown-arrow-rotate'));

            const show = content.classList.contains('hidden');
            content.classList.toggle('hidden', !show);
            arrow.classList.toggle('dropdown-arrow-rotate', show);
        });

        content.querySelectorAll<HTMLDivElement>('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                btn.childNodes[0].textContent = item.textContent?.trim() || '';
                content.classList.add('hidden');
                arrow.classList.remove('dropdown-arrow-rotate');
                callback(item);
            });
        });
    }

    private hidePaymentControls(): void {
        ['dropdownBtnNetwork', 'dropdownBtnCoin', 'amountSection', 'qrcode'].forEach(key => this.hideElement(this.elements[key as keyof typeof this.elements]));
    }

    private showPaymentControls(): void {
        if (!this.paymentData) return;
        ['dropdownBtnNetwork', 'dropdownBtnCoin'].forEach(key => this.showElement(this.elements[key as keyof typeof this.elements]));
        console.log('💳 Payment controls shown');
    }

    private showPaymentAmount(): void {
        if (!this.paymentData) return;
        this.elements.amountInput.style.display = 'none';
        if (!this.elements.amountSection.querySelector('.payment-amount-display')) {
            const amountDisplay = document.createElement('div');
            amountDisplay.className = 'payment-amount-display w-full p-4 text-base font-semibold border-2 border-crypto-border rounded-2xl bg-crypto-card text-white text-center mb-3';
            amountDisplay.innerHTML = `<div class="text-lg font-bold">$${this.paymentData.amount_usd}</div>
                                       <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>`;
            this.elements.amountInput.parentNode?.insertBefore(amountDisplay, this.elements.amountInput);
        }
        this.elements.amountSection.style.display = 'block';
        this.elements.generateBtn.textContent = 'Pay Now';
        this.elements.generateBtn.onclick = () => this.generatePaymentQR();
        this.updatePayButton();
    }

    private updatePayButton(): void {
        if (!this.paymentData) return;

        const isValid = this.selectedNetwork === 'solana' && this.selectedCoin === 'USDC';
        if (!this.selectedNetwork || !this.selectedCoin) {
            this.disableButton('Choose Network & Coin');
        } else if (!isValid) {
            this.disableButton('Only USDC on Solana supported', '#ef4444');
        } else {
            this.enableButton('Pay Now');
        }
    }

    private async generatePaymentQR(): Promise<void> {
        if (!this.paymentData || this.selectedNetwork !== 'solana' || this.selectedCoin !== 'USDC') {
            return alert('Please select Solana network and USDC coin');
        }

        this.disableButton('Creating QR...');
        try {
            const res = await fetch(`https://zapzap666.xyz/api/payment/${this.sessionKey}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();

            this.elements.paymentInfo.innerHTML = `<div class="text-center">
                <div class="text-22 font-bold text-white mb-1 leading-tight">$${this.paymentData.amount_usd}</div>
                <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>
                <div class="text-xs text-crypto-text-muted mt-2">Scan with Solana wallet</div>
            </div>`;

            const existingQR = this.elements.qrcode.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrWrapper = document.createElement('div');
            qrWrapper.className = 'qr-code-wrapper';
            const qrImage = document.createElement('img');
            qrImage.src = data.qr_code;
            qrImage.alt = 'Payment QR Code';
            qrImage.style.maxWidth = '250px';
            qrImage.style.maxHeight = '250px';
            qrWrapper.appendChild(qrImage);
            this.elements.qrcode.appendChild(qrWrapper);
            this.showElement(this.elements.qrcode);

            ['dropdownBtnNetwork', 'dropdownBtnCoin', 'amountSection'].forEach(k => this.hideElement(this.elements[k as keyof typeof this.elements]));
            console.log('✅ Payment QR generated');
        } catch (err: any) {
            console.error('❌ Payment QR generation failed:', err);
            alert(`Failed to generate payment QR: ${err.message}`);
        } finally {
            this.enableButton('Pay Now');
        }
    }

    private showPaymentSuccess(data: any): void {
        this.elements.statusTitle.textContent = 'Payment Completed!';
        this.elements.paymentInfo.innerHTML = `<div class="text-center">
            <div class="text-green-400 text-xl font-bold mb-2">✅ Payment Successful</div>
            <div class="text-white">$${data.amount_usd} paid</div>
            <div class="text-xs text-crypto-text-muted mt-2">Signature: ${data.signature.slice(0, 16)}...</div>
        </div>`;
        ['dropdownBtnNetwork', 'dropdownBtnCoin', 'amountSection'].forEach(k => this.hideElement(this.elements[k as keyof typeof this.elements]));
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
        this.clearCountdown();
        this.socket?.close();
        this.socket = null;
    }

    private clearCountdown(): void {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.countdownInterval = null;
    }

    private showElement(el: HTMLElement): void { el.style.display = 'block'; }
    private hideElement(el: HTMLElement): void { el.style.display = 'none'; }
    private disableButton(text: string, bg?: string) { this.elements.generateBtn.disabled = true; this.elements.generateBtn.textContent = text; if (bg) this.elements.generateBtn.style.backgroundColor = bg; }
    private enableButton(text: string) { this.elements.generateBtn.disabled = false; this.elements.generateBtn.textContent = text; this.elements.generateBtn.style.backgroundColor = ''; }
}

// Запуск
document.addEventListener('DOMContentLoaded', () => {
    const sessionManager = new SessionManager();
    sessionManager.init();
});

(window as any).SessionManager = SessionManager;
