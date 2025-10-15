import QRGenerator from './QRGenerator';

const CONFIG = {
    SERVER_URL: 'https://zapzap666.xyz',
    API_ENDPOINTS: {
        details: '/api/merchant/:id/details',
        qrList: '/api/merchant/:merchantId/qr-codes/list'
    }
} as const;

interface QRCode {
    qrId: number;
    qrUniqueId: string;
    displayName: string;
}

class MerchantViewSystem {
    private static instance: MerchantViewSystem;
    private merchantUUID: string | null = null;
    private qrCodes: QRCode[] = [];
    private currentQRUrl: string = '';
    private qrGenerator: QRGenerator;

    constructor() {
        this.qrGenerator = QRGenerator.getInstance();
    }

    static getInstance(): MerchantViewSystem {
        return this.instance ??= new MerchantViewSystem();
    }

    async init(): Promise<void> {
        const params = new URLSearchParams(window.location.search);
        this.merchantUUID = params.get('uuid');

        if (!this.merchantUUID) {
            window.location.href = '/merchant';
            return;
        }

        this.setupCopyButtons();
        this.setupDropdown();
        this.setupQRModal();
        this.setupApiKeyToggle();
        await this.loadMerchantData();
    }

    private async loadMerchantData(): Promise<void> {
        const auth = this.getAuth();
        if (!auth) {
            window.location.href = '/';
            return;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${CONFIG.API_ENDPOINTS.details.replace(':id', this.merchantUUID!)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                this.fillData(data.data);
                await this.loadQRCodes(data.data.id);
            } else {
                window.location.href = '/merchant';
            }
        } catch (err) {
            console.error('Load merchant error:', err);
            window.location.href = '/merchant';
        }
    }

    private fillData(merchant: any): void {
        const title = document.getElementById('merchantTitle');
        const merchantId = document.getElementById('merchantId') as HTMLInputElement;
        const webhook = document.getElementById('webhookUrl') as HTMLInputElement;
        const apiKey = document.getElementById('apiKey') as HTMLInputElement;
        const wallet = document.getElementById('solanaWallet') as HTMLInputElement;
        const statusBadge = document.getElementById('merchantStatus');

        if (title) title.textContent = merchant.name;
        if (merchantId) merchantId.value = merchant.merchant_uuid;
        if (webhook) webhook.value = merchant.webhook_url;
        if (apiKey) apiKey.value = merchant.api_key;
        if (wallet) wallet.value = merchant.solana_wallet;
        
        if (statusBadge) {
            statusBadge.textContent = merchant.status === 'active' ? 'Active' : 'Inactive';
            statusBadge.className = merchant.status === 'active' 
                ? 'text-lg font-semibold text-green-500'
                : 'text-lg font-semibold text-red-500';
        }
    }

    private async loadQRCodes(merchantId: number): Promise<void> {
        const auth = this.getAuth();
        if (!auth) return;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${CONFIG.API_ENDPOINTS.qrList.replace(':merchantId', merchantId.toString())}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                this.qrCodes = data.data || [];
                this.renderQRList();
            }
        } catch (err) {
            console.error('Load QR codes error:', err);
        }
    }

    private renderQRList(): void {
        const container = document.getElementById('qrCodesList');
        if (!container) return;

        if (this.qrCodes.length === 0) {
            container.innerHTML = '<p class="px-4 py-2 text-crypto-text-muted">No QR codes</p>';
            return;
        }

        container.innerHTML = '';
        this.qrCodes.forEach(qr => {
            const li = document.createElement('div');
            li.className = 'flex items-center gap-2 px-3 py-2 text-white hover:bg-crypto-border hover:scale-105 transition-all duration-200 rounded cursor-pointer';
            li.innerHTML = `
                <span class="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
                <span class="truncate flex-1">${qr.displayName}</span>
            `;
            li.addEventListener('click', () => this.openQRModal(qr));
            container.appendChild(li);
        });
    }

    private setupDropdown(): void {
        const button = document.getElementById('QRCodesButton');
        const dropdown = document.getElementById('QRCodesDropdown');
        if (!button || !dropdown) return;

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            button.querySelector('svg')?.classList.toggle('rotate-180');
        });

        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
            button.querySelector('svg')?.classList.remove('rotate-180');
        });
    }

    private setupCopyButtons(): void {
        const buttons = [
            { id: 'copyMerchantId', inputId: 'merchantId' },
            { id: 'copyWebhook', inputId: 'webhookUrl' },
            { id: 'copyApiKey', inputId: 'apiKey' },
            { id: 'copyWallet', inputId: 'solanaWallet' }
        ];

        buttons.forEach(({ id, inputId }) => {
            document.getElementById(id)?.addEventListener('click', () => {
                const input = document.getElementById(inputId) as HTMLInputElement;
                if (input?.value) {
                    navigator.clipboard.writeText(input.value);
                }
            });
        });
    }

    private setupApiKeyToggle(): void {
        const toggleBtn = document.getElementById('toggleApiKey');
        const apiKeyInput = document.getElementById('apiKey') as HTMLInputElement;
        const eyeClosed = document.getElementById('eyeIconClosed');
        const eyeOpen = document.getElementById('eyeIconOpen');

        toggleBtn?.addEventListener('click', () => {
            if (apiKeyInput.type === 'password') {
                apiKeyInput.type = 'text';
                eyeClosed?.classList.add('hidden');
                eyeOpen?.classList.remove('hidden');
            } else {
                apiKeyInput.type = 'password';
                eyeClosed?.classList.remove('hidden');
                eyeOpen?.classList.add('hidden');
            }
        });
    }

    private setupQRModal(): void {
        const modal = document.getElementById('qrViewModal');
        const backdrop = document.getElementById('qrViewBackdrop');
        const backBtn = document.getElementById('qrViewBack');
        const copyBtn = document.getElementById('copyQRUrl');
        const downloadBtn = document.getElementById('downloadQR');

        backBtn?.addEventListener('click', () => this.closeQRModal());
        backdrop?.addEventListener('click', () => this.closeQRModal());
        copyBtn?.addEventListener('click', () => this.copyQRUrl());
        downloadBtn?.addEventListener('click', () => this.downloadQR());
    }

    private async openQRModal(qr: QRCode): Promise<void> {
        const modal = document.getElementById('qrViewModal');
        const title = document.getElementById('qrViewTitle');
        const urlSpan = document.getElementById('qrCodeUrl');
        
        if (!modal) return;

        this.currentQRUrl = `${CONFIG.SERVER_URL}/?qr=${qr.qrUniqueId}`;

        if (title) title.textContent = qr.displayName;
        if (urlSpan) urlSpan.textContent = this.currentQRUrl;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
        
        const dropdown = document.getElementById('QRCodesDropdown');
        dropdown?.classList.add('hidden');

        await this.qrGenerator.generateQRForScan(qr.qrUniqueId, 'qrCanvas');
    }

    private closeQRModal(): void {
        const modal = document.getElementById('qrViewModal');
        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }

    private async copyQRUrl(): Promise<void> {
        await this.qrGenerator.copyQRUrl();
    }

    private downloadQR(): void {
        this.qrGenerator.downloadQR('qrCanvas', `qr-code-${Date.now()}.png`);
    }

    private getAuth() {
        const walletAddress = localStorage.getItem('connectedWalletAddress');
        const sessionKey = localStorage.getItem('sessionKey');
        if (!walletAddress || !sessionKey) return null;
        return { walletAddress, sessionKey };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    MerchantViewSystem.getInstance().init();
});
