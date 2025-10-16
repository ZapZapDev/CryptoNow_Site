import { CONFIG, getAuth } from '../typescript/config';

const API_ENDPOINTS = {
    create: '/api/merchant/create',
    details: '/api/merchant/:id/details',
    update: '/api/merchant/:id',
    qrCreate: '/api/merchant/:merchantId/qr-codes',
    qrList: '/api/merchant/:merchantId/qr-codes/list'
} as const;

interface QRCodeTemp {
    id: number;
    displayName: string;
}

interface QRCode {
    qrId: number;
    qrUniqueId: string;
    displayName: string;
}

class MerchantCreateSystem {
    private static instance: MerchantCreateSystem;
    private qrCodesTemp: QRCodeTemp[] = [];
    private qrCounter = 0;
    private isEditMode = false;
    private merchantUUID: string | null = null;

    static getInstance(): MerchantCreateSystem {
        return this.instance ??= new MerchantCreateSystem();
    }

    async init(): Promise<void> {
        const params = new URLSearchParams(window.location.search);
        this.merchantUUID = params.get('uuid');
        this.isEditMode = !!this.merchantUUID;

        this.updatePageTitle();
        this.setupDropdown();
        this.setupModals();
        this.setupForm();

        if (this.isEditMode && this.merchantUUID) {
            await this.loadMerchantData();
        }
    }

    private updatePageTitle(): void {
        const title = document.querySelector('h1');
        const submitBtn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
        
        if (this.isEditMode) {
            if (title) title.textContent = 'Edit Merchant';
            if (submitBtn) submitBtn.textContent = 'Update';
        } else {
            if (title) title.textContent = 'Create New Merchant';
            if (submitBtn) submitBtn.textContent = 'Submit';
        }
    }

    private async loadMerchantData(): Promise<void> {
        const auth = getAuth();
        
        if (!auth) {
            this.showError('Authentication required');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.details.replace(':id', this.merchantUUID!)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                this.fillForm(data.data);
            } else {
                this.showError('Failed to load merchant data');
            }
        } catch (err) {
            console.error('Load merchant error:', err);
            this.showError('Failed to load merchant data');
        }
    }

    private fillForm(merchant: any): void {
        const nameInput = document.getElementById('merchantName') as HTMLInputElement;
        const webhookInput = document.getElementById('webhookUrl') as HTMLInputElement;
        const walletInput = document.getElementById('solanaWallet') as HTMLInputElement;

        if (nameInput) nameInput.value = merchant.name;
        if (webhookInput) webhookInput.value = merchant.webhook_url;
        if (walletInput) walletInput.value = merchant.solana_wallet;
        
        this.loadExistingQRCodes(merchant.id);
    }

    private async loadExistingQRCodes(merchantId: number): Promise<void> {
        const auth = getAuth();
        
        if (!auth) return;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.qrList.replace(':merchantId', merchantId.toString())}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                this.renderQRList(data.data || []);
            }
        } catch (err) {
            console.error('Load QR codes error:', err);
        }
    }

    private renderQRList(qrCodes: QRCode[]): void {
        const container = document.getElementById('qrCodesList');
        if (!container) return;

        container.innerHTML = '';
        qrCodes.forEach(qr => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2 px-2 py-1 text-white hover:bg-crypto-border hover:scale-105 transition-all duration-200 rounded';
            li.innerHTML = `<span class="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span><span class="truncate">${qr.displayName}</span>`;
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

        document.getElementById('AddQRButton')?.addEventListener('click', () => {
            this.openQRModal();
        });
    }

    private setupModals(): void {
        const modal = document.getElementById('qrModal');
        const backdrop = document.getElementById('qrModalBackdrop');
        const closeBtn = document.getElementById('qrModalClose');

        closeBtn?.addEventListener('click', () => this.closeQRModal());
        backdrop?.addEventListener('click', () => this.closeQRModal());

        document.getElementById('qrForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleQRCreate();
        });
    }

    private setupForm(): void {
        const form = document.getElementById('merchantForm');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit();
        });

        // Add live URL validation
        const webhookInput = document.getElementById('webhookUrl') as HTMLInputElement;
        webhookInput?.addEventListener('blur', () => {
            const url = webhookInput.value.trim();
            if (url && !this.validateUrl(url)) {
                webhookInput.classList.add('border-red-500');
                webhookInput.classList.remove('border-crypto-border');
            } else {
                webhookInput.classList.remove('border-red-500');
                webhookInput.classList.add('border-crypto-border');
            }
        });
    }

    private openQRModal(): void {
        const modal = document.getElementById('qrModal');
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }

    private closeQRModal(): void {
        const modal = document.getElementById('qrModal');
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
        
        const input = document.getElementById('qrQuantity') as HTMLInputElement;
        if (input) input.value = '';
    }

    private async handleQRCreate(): Promise<void> {
        const input = document.getElementById('qrQuantity') as HTMLInputElement;
        const quantity = parseInt(input.value);

        if (!quantity || quantity < 1 || quantity > 50) return;

        if (this.isEditMode && this.merchantUUID) {
            const auth = getAuth();
            
            if (!auth) return;

            try {
                const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.details.replace(':id', this.merchantUUID)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(auth)
                });

                const data = await response.json();
                if (!data.success) return;

                const merchantId = data.data.id;
                const qrResponse = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.qrCreate.replace(':merchantId', merchantId.toString())}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...auth,
                        quantity
                    })
                });

                const qrData = await qrResponse.json();
                if (qrData.success) {
                    this.closeQRModal();
                    await this.loadExistingQRCodes(merchantId);
                }
            } catch (err) {
                console.error('Create QR codes error:', err);
            }
        } else {
            for (let i = 0; i < quantity; i++) {
                this.qrCounter++;
                this.qrCodesTemp.push({
                    id: this.qrCounter,
                    displayName: `QR Code #${this.qrCounter}`
                });
            }

            this.renderTempQRList();
            this.closeQRModal();
        }
    }

    private renderTempQRList(): void {
        const container = document.getElementById('qrCodesList');
        if (!container) return;

        container.innerHTML = '';
        this.qrCodesTemp.forEach(qr => {
            const li = document.createElement('li');
            li.className = 'flex items-center gap-2 px-2 py-1 text-white hover:bg-crypto-border hover:scale-105 transition-all duration-200 rounded';
            li.innerHTML = `<span class="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span><span class="truncate">${qr.displayName}</span>`;
            container.appendChild(li);
        });
    }

    private showError(message: string): void {
        const form = document.getElementById('merchantForm');
        if (!form) return;

        // Remove existing error if any
        const existingError = form.querySelector('.error-message');
        if (existingError) existingError.remove();

        // Create error element
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message bg-red-500/10 border border-red-500 rounded-xl p-4 mb-4 text-red-400 text-sm';
        errorDiv.textContent = message;
        
        // Insert at the top of the form
        form.insertBefore(errorDiv, form.firstChild);

        // Auto-remove after 5 seconds
        setTimeout(() => errorDiv.remove(), 5000);
    }

    private validateUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            // Check if it has a valid protocol and hostname with TLD
            return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && 
                   parsed.hostname.includes('.');
        } catch {
            return false;
        }
    }

    private async handleSubmit(): Promise<void> {
        const nameInput = document.getElementById('merchantName') as HTMLInputElement;
        const webhookInput = document.getElementById('webhookUrl') as HTMLInputElement;
        const walletInput = document.getElementById('solanaWallet') as HTMLInputElement;

        const name = nameInput?.value.trim();
        const webhook_url = webhookInput?.value.trim();
        const solana_wallet = walletInput?.value.trim();

        // Validation
        if (!name || !webhook_url || !solana_wallet) {
            this.showError('Please fill in all required fields');
            return;
        }

        if (!this.validateUrl(webhook_url)) {
            this.showError('Invalid webhook URL. Please enter a valid URL (e.g., https://example.com/webhook)');
            return;
        }

        if (solana_wallet.length !== 44) {
            this.showError('Solana wallet must be exactly 44 characters');
            return;
        }

        const auth = getAuth();

        if (!auth) {
            this.showError('Authentication required. Redirecting to login...');
            setTimeout(() => window.location.href = '/', 2000);
            return;
        }

        try {
            if (this.isEditMode && this.merchantUUID) {
                const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.update.replace(':id', this.merchantUUID)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...auth,
                        name,
                        webhook_url,
                        solana_wallet
                    })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = '/merchant';
                } else {
                    this.showError(data.error || 'Failed to update merchant. Please try again.');
                }
            } else {
                const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.create}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...auth,
                        name,
                        webhook_url,
                        solana_wallet,
                        qrCodes: this.qrCodesTemp
                    })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = '/merchant';
                } else {
                    this.showError(data.error || 'Failed to create merchant. Please try again.');
                }
            }
        } catch (err) {
            console.error('Merchant operation error:', err);
            this.showError('Network error. Please check your connection and try again.');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    MerchantCreateSystem.getInstance().init();
});
