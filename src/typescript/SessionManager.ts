class SessionManager {
    private readonly SERVER_URL = 'https://zapzap666.xyz';
    private readonly WS_URL = 'wss://zapzap666.xyz';
    private sessionKey: string | null = null;
    private socket: WebSocket | null = null;
    private countdownTimer: number | null = null;
    private paymentData: any = null;
    private selectedNetwork: string | null = null;
    private selectedCoin: string | null = null;

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
            document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-[#0c0c0c]"><div class="text-red-400 text-3xl font-bold">404</div></div>';
            return;
        }

        this.initializeDisabledStates();

        try {
            await this.loadSessionState();
            this.connectWebSocket();
            this.setupDropdowns();
        } catch {
            document.body.innerHTML = '<div class="min-h-screen flex items-center justify-center bg-[#0c0c0c]"><div class="text-red-400 text-3xl font-bold">404</div></div>';
        }
    }

    private initializeDisabledStates(): void {
        this.elements.dropdownBtnNetwork.disabled = true;
        this.elements.dropdownBtnNetwork.style.opacity = '0.5';
        this.elements.dropdownBtnNetwork.style.cursor = 'not-allowed';

        this.elements.generateBtn.disabled = true;
        this.elements.generateBtn.style.opacity = '0.5';
        this.elements.generateBtn.style.cursor = 'not-allowed';
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
        this.elements.statusTitle.textContent = 'Waiting for Payment';
        this.hidePaymentControls();
    }

    private showChooseState(): void {
        this.elements.statusTitle.textContent = 'Choose Payment Method';
        this.showPaymentInfo();
        this.showPaymentControls();
    }

    private async showPaymentState(): Promise<void> {
        this.elements.statusTitle.textContent = 'Scan to Pay';
        this.showPaymentInfo();
        this.hidePaymentControls();
        await this.generateQR();
    }

    private showPaymentInfo(): void {
        if (!this.paymentData) return;

        this.elements.amountValue.textContent = `${this.paymentData.amount_usd} USD`;
        this.elements.amountRow.classList.remove('hidden');
    }

    private showPaymentControls(): void {
        const coinDropdownParent = this.elements.dropdownBtnCoin.parentElement as HTMLElement;
        const networkDropdownParent = this.elements.dropdownBtnNetwork.parentElement as HTMLElement;

        if (coinDropdownParent) coinDropdownParent.style.display = 'block';
        if (networkDropdownParent) networkDropdownParent.style.display = 'block';

        this.elements.generateBtn.style.display = 'block';
    }

    private hidePaymentControls(): void {
        const coinDropdownParent = this.elements.dropdownBtnCoin.parentElement as HTMLElement;
        const networkDropdownParent = this.elements.dropdownBtnNetwork.parentElement as HTMLElement;

        if (coinDropdownParent) coinDropdownParent.style.display = 'none';
        if (networkDropdownParent) networkDropdownParent.style.display = 'none';

        this.elements.generateBtn.style.display = 'none';
    }

    private setupDropdowns(): void {
        const toggleDropdown = (content: HTMLElement, arrow: HTMLElement, isOpen: boolean) => {
            content.classList.toggle('hidden', !isOpen);
            arrow.style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
        };

        this.elements.dropdownBtnCoin.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyOpen = !this.elements.dropdownContentCoin.classList.contains('hidden');
            
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.dropdown span').forEach((arrow: Element) => {
                (arrow as HTMLElement).style.transform = 'rotate(0deg)';
            });
            
            if (!isCurrentlyOpen) {
                toggleDropdown(this.elements.dropdownContentCoin, this.elements.dropdownArrowCoin, true);
            }
        });

        this.elements.dropdownBtnNetwork.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.elements.dropdownBtnNetwork.disabled) return;
            
            const isCurrentlyOpen = !this.elements.dropdownContentNetwork.classList.contains('hidden');
            
            document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('.dropdown span').forEach((arrow: Element) => {
                (arrow as HTMLElement).style.transform = 'rotate(0deg)';
            });
            
            if (!isCurrentlyOpen) {
                toggleDropdown(this.elements.dropdownContentNetwork, this.elements.dropdownArrowNetwork, true);
            }
        });

        this.elements.dropdownContentCoin.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedCoin = (item as HTMLElement).dataset.coin || null;
                this.elements.dropdownBtnCoin.childNodes[0].textContent = item.textContent?.trim() || 'Choose Coin';
                toggleDropdown(this.elements.dropdownContentCoin, this.elements.dropdownArrowCoin, false);

                this.elements.dropdownBtnNetwork.disabled = false;
                this.elements.dropdownBtnNetwork.style.opacity = '1';
                this.elements.dropdownBtnNetwork.style.cursor = 'pointer';

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
            
            const isClickInsideDropdown = target.closest('.dropdown');
            
            if (!isClickInsideDropdown) {
                document.querySelectorAll('.dropdown-content').forEach(el => el.classList.add('hidden'));
                document.querySelectorAll('.dropdown span').forEach((arrow: Element) => {
                    (arrow as HTMLElement).style.transform = 'rotate(0deg)';
                });
            }
        });
    }

    private updatePayButton(): void {
        const isReady = this.selectedNetwork === 'solana' && this.selectedCoin === 'USDC';

        this.elements.generateBtn.disabled = !isReady;
        this.elements.generateBtn.style.opacity = isReady ? '1' : '0.5';
        this.elements.generateBtn.style.cursor = isReady ? 'pointer' : 'not-allowed';
    }

    private async handlePayment(): Promise<void> {
        if (!this.paymentData || this.selectedNetwork !== 'solana' || this.selectedCoin !== 'USDC') {
            return;
        }

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

    private connectWebSocket(): void {
        this.socket = new WebSocket(`${this.WS_URL}/ws/session?session=${this.sessionKey}`);

        this.socket.onopen = () => {
            setTimeout(() => {
                if (this.socket?.readyState === WebSocket.OPEN) {
                    this.socket.send(JSON.stringify({ type: 'status_request' }));
                }
            }, 100);
        };

        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);

            switch (data.type) {
                case 'session_connected':
                    if (typeof data.timeLeft === 'number') this.startCountdown(data.timeLeft);
                    break;
                case 'session_status':
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