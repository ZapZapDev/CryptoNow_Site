// src/typescript/SessionManager.ts - ФИНАЛЬНАЯ ВЕРСИЯ ПОД PAYMENT.HTML
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
        if (!this.sessionKey) {
            this.showError('Invalid session key');
            return;
        }
        this.connectWebSocket();
        this.setupDropdowns();
        this.hidePaymentControls(); // Скрываем до получения данных платежа
    }

    private extractSessionKey(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('session');
    }

    private connectWebSocket(): void {
        if (this.isExpired || this.isDestroyed) return;

        const wsUrl = `wss://zapzap666.xyz/ws/session?session=${this.sessionKey}`;
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            setTimeout(() => this.requestStatus(), 100);
        };

        this.socket.onmessage = e => this.handleMessage(e);
        this.socket.onclose = (event) => {
            if (event.code === 1008) {
                this.showExpiredState();
            }
        };
        this.socket.onerror = () => this.showError('Connection error');
    }

    private handleMessage(event: MessageEvent): void {
        if (this.isDestroyed) return;

        try {
            const data = JSON.parse(event.data);

            if (data.type === 'session_connected' && data.qrCodeId) {
                this.elements.qrCodeId.textContent = data.qrCodeId;

                if (typeof data.timeLeft === 'number' && data.timeLeft >= 0) {
                    console.log(`🕐 Starting countdown from server time: ${data.timeLeft}s`);
                    this.startRealCountdown(data.timeLeft);
                } else {
                    this.requestStatus();
                }

                this.elements.statusTitle.textContent = 'Session Active';
            }

            // НОВОЕ: Обработка создания платежа
            if (data.type === 'payment_created' && data.data) {
                this.paymentData = data.data;
                this.showPaymentControls();
                console.log('💳 Payment data received:', data.data);
            }

            // НОВОЕ: Обработка завершения платежа
            if (data.type === 'payment_completed' && data.data) {
                this.showPaymentSuccess(data.data);
                console.log('✅ Payment completed:', data.data);
            }

            if (data.type === 'session_expired' || data.type === 'session_invalid') {
                this.showExpiredState();
            }

            if (data.type === 'session_status' && data.data) {
                const { qrCodeId, timeLeft } = data.data;
                if (qrCodeId) this.elements.qrCodeId.textContent = qrCodeId;

                if (typeof timeLeft === 'number' && timeLeft >= 0) {
                    console.log(`🔄 Updating countdown to server time: ${timeLeft}s`);
                    this.startRealCountdown(timeLeft);
                }
            }
        } catch (error) {
            console.error('❌ Message parse error:', error);
        }
    }

    private requestStatus(): void {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('📡 Requesting session status...');
            this.socket.send(JSON.stringify({ type: 'status_request' }));
        }
    }

    private startRealCountdown(serverTimeLeft: number): void {
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        let remainingSeconds = serverTimeLeft;

        const update = () => {
            if (this.isExpired || this.isDestroyed) return;

            this.updateTimeLeft(remainingSeconds);

            if (remainingSeconds <= 0) {
                this.showExpiredState();
                return;
            }

            remainingSeconds--;
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
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

    // Настройка дропдаунов (используем существующую логику из TransactionSetup.ts)
    private setupDropdowns(): void {
        this.setupDropdown(
            this.elements.dropdownBtnNetwork,
            this.elements.dropdownContentNetwork,
            this.elements.dropdownArrowNetwork,
            (item) => {
                this.selectedNetwork = item.getAttribute("data-network");
                console.log("Selected Network:", this.selectedNetwork);
                this.updatePayButton();
            }
        );

        this.setupDropdown(
            this.elements.dropdownBtnCoin,
            this.elements.dropdownContentCoin,
            this.elements.dropdownArrowCoin,
            (item) => {
                this.selectedCoin = item.getAttribute("data-coin");
                console.log("Selected Coin:", this.selectedCoin);

                if (this.paymentData) {
                    this.elements.amountSection.style.display = "block";
                    this.elements.amountSection.classList.remove("hidden");
                    this.showPaymentAmount();
                }
                this.updatePayButton();
            }
        );

        // Закрытие дропдаунов при клике вне
        window.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown')) {
                document.querySelectorAll(".dropdown-content").forEach(el => el.classList.add("hidden"));
                document.querySelectorAll(".dropdown span").forEach(el => el.classList.remove("dropdown-arrow-rotate"));
            }
        });
    }

    private setupDropdown(
        btn: HTMLButtonElement,
        content: HTMLDivElement,
        arrow: HTMLSpanElement,
        callback: (item: HTMLDivElement) => void
    ): void {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            // Закрыть все дропдауны
            document.querySelectorAll(".dropdown-content").forEach(el => el.classList.add("hidden"));
            document.querySelectorAll(".dropdown span").forEach(el => el.classList.remove("dropdown-arrow-rotate"));

            // Открыть текущий
            if (!content.classList.contains("hidden")) {
                content.classList.add("hidden");
                arrow.classList.remove("dropdown-arrow-rotate");
            } else {
                content.classList.remove("hidden");
                arrow.classList.add("dropdown-arrow-rotate");
            }
        });

        const items = content.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
        items.forEach(item => {
            item.addEventListener("click", () => {
                const selectedText = item.textContent?.trim() || "";
                btn.childNodes[0].textContent = selectedText;
                content.classList.add("hidden");
                arrow.classList.remove("dropdown-arrow-rotate");
                callback(item);
            });
        });
    }

    // Скрытие контролов до получения данных платежа
    private hidePaymentControls(): void {
        this.elements.dropdownBtnNetwork.style.display = 'none';
        this.elements.dropdownBtnCoin.style.display = 'none';
        this.elements.amountSection.style.display = 'none';
        this.elements.qrcode.style.display = 'none';
    }

    // Показ контролов после получения данных платежа
    private showPaymentControls(): void {
        if (!this.paymentData) return;

        // Показываем дропдауны
        this.elements.dropdownBtnNetwork.style.display = 'block';
        this.elements.dropdownBtnCoin.style.display = 'block';

        console.log('💳 Payment controls shown');
    }

    // Показ суммы к оплате (вместо input)
    private showPaymentAmount(): void {
        if (!this.paymentData) return;

        // Скрываем input
        this.elements.amountInput.style.display = 'none';

        // Проверяем, не добавлен ли уже элемент
        const existingDisplay = this.elements.amountSection.querySelector('.payment-amount-display');
        if (!existingDisplay) {
            const amountDisplay = document.createElement('div');
            amountDisplay.className = 'payment-amount-display w-full p-4 text-base font-semibold border-2 border-crypto-border rounded-2xl bg-crypto-card text-white text-center mb-3';
            amountDisplay.innerHTML = `
                <div class="text-lg font-bold">$${this.paymentData.amount_usd}</div>
                <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>
            `;

            this.elements.amountInput.parentNode?.insertBefore(amountDisplay, this.elements.amountInput);
        }

        // Меняем кнопку
        this.elements.generateBtn.textContent = 'Pay Now';
        this.elements.generateBtn.onclick = () => this.generatePaymentQR();
        this.updatePayButton();
    }

    // Обновление состояния кнопки
    private updatePayButton(): void {
        if (!this.paymentData) return;

        const isValidSelection = this.selectedNetwork === 'solana' && this.selectedCoin === 'USDC';

        if (this.selectedNetwork && this.selectedCoin && !isValidSelection) {
            this.elements.generateBtn.disabled = true;
            this.elements.generateBtn.textContent = 'Only USDC on Solana supported';
            this.elements.generateBtn.style.backgroundColor = '#ef4444';
        } else if (isValidSelection) {
            this.elements.generateBtn.disabled = false;
            this.elements.generateBtn.textContent = 'Pay Now';
            this.elements.generateBtn.style.backgroundColor = '';
        } else {
            this.elements.generateBtn.disabled = true;
            this.elements.generateBtn.textContent = 'Choose Network & Coin';
            this.elements.generateBtn.style.backgroundColor = '';
        }
    }

    // Генерация QR для платежа
    private async generatePaymentQR(): void {
        if (!this.paymentData || this.selectedNetwork !== 'solana' || this.selectedCoin !== 'USDC') {
            alert('Please select Solana network and USDC coin');
            return;
        }

        this.elements.generateBtn.disabled = true;
        this.elements.generateBtn.textContent = 'Creating QR...';

        try {
            // УБИРАЕМ проверку кошелька - генерируем QR сразу
            const response = await fetch(`https://zapzap666.xyz/api/payment/${this.sessionKey}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    // Пустое тело - всё берется из payment данных
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            this.elements.paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">$${this.paymentData.amount_usd}</div>
                    <div class="text-sm text-crypto-text-muted">${this.paymentData.item_name}</div>
                    <div class="text-xs text-crypto-text-muted mt-2">Scan with Solana wallet</div>
                </div>
            `;

            // Показываем QR код
            const existingQR = this.elements.qrcode.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrCodeWrapper = document.createElement('div');
            qrCodeWrapper.className = 'qr-code-wrapper';

            const qrImage = document.createElement('img');
            qrImage.src = data.qr_code; // QR приходит готовый с сервера
            qrImage.alt = 'Payment QR Code';
            qrImage.style.maxWidth = '250px';
            qrImage.style.maxHeight = '250px';

            qrCodeWrapper.appendChild(qrImage);
            this.elements.qrcode.appendChild(qrCodeWrapper);
            this.elements.qrcode.style.display = "flex";

            // Скрываем селекторы
            this.elements.dropdownBtnNetwork.style.display = "none";
            this.elements.dropdownBtnCoin.style.display = "none";
            this.elements.amountSection.style.display = "none";

            console.log('✅ Payment QR generated and monitoring started');

        } catch (error) {
            console.error('❌ Payment QR generation failed:', error);
            alert(`Failed to generate payment QR: ${error.message}`);
        } finally {
            this.elements.generateBtn.disabled = false;
            this.elements.generateBtn.textContent = 'Pay Now';
        }
    }

    // Показ успешной оплаты
    private showPaymentSuccess(data: any): void {
        this.elements.statusTitle.textContent = 'Payment Completed!';
        this.elements.paymentInfo.innerHTML = `
            <div class="text-center">
                <div class="text-green-400 text-xl font-bold mb-2">✅ Payment Successful</div>
                <div class="text-white">$${data.amount_usd} paid</div>
                <div class="text-xs text-crypto-text-muted mt-2">Signature: ${data.signature.slice(0, 16)}...</div>
            </div>
        `;

        // Скрываем все лишнее
        this.elements.dropdownBtnNetwork.style.display = "none";
        this.elements.dropdownBtnCoin.style.display = "none";
        this.elements.amountSection.style.display = "none";
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
        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

// Запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const sessionManager = new SessionManager();
    sessionManager.init();
});

(window as any).SessionManager = SessionManager;