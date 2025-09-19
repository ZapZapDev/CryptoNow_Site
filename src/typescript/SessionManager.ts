// src/typescript/SessionManager.ts - РЕАЛЬНЫЙ ОБРАТНЫЙ ОТСЧЕТ
class SessionManager {
    private sessionKey: string | null = null;
    private socket: WebSocket | null = null;
    private countdownInterval: number | null = null;
    private isExpired = false;
    private isDestroyed = false;

    private elements = {
        qrCodeId: document.getElementById('qrCodeId')!,
        timeLeft: document.getElementById('timeLeft')!,
        statusTitle: document.getElementById('statusTitle')!
    };

    init(): void {
        this.sessionKey = this.extractSessionKey();
        if (!this.sessionKey) {
            this.showError('Invalid session key');
            return;
        }
        this.connectWebSocket();
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

                // ✅ ИСПРАВЛЕНО: Используем РЕАЛЬНОЕ время с сервера
                if (typeof data.timeLeft === 'number' && data.timeLeft >= 0) {
                    console.log(`🕐 Starting countdown from server time: ${data.timeLeft}s`);
                    this.startRealCountdown(data.timeLeft);
                } else {
                    console.log('⚠️ No timeLeft from server, requesting status...');
                    this.requestStatus();
                }

                this.elements.statusTitle.textContent = 'Session Active';
            }

            if (data.type === 'session_expired' || data.type === 'session_invalid') {
                this.showExpiredState();
            }

            if (data.type === 'session_status' && data.data) {
                const { qrCodeId, timeLeft } = data.data;
                if (qrCodeId) this.elements.qrCodeId.textContent = qrCodeId;

                // ✅ ИСПРАВЛЕНО: Перезапускаем таймер с актуальным временем
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

    // ✅ ИСПРАВЛЕНО: Обратный отсчет от РЕАЛЬНОГО времени сервера
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

        // Показать сразу
        update();

        // Обновлять каждую секунду
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

(window as any).SessionManager = SessionManager;