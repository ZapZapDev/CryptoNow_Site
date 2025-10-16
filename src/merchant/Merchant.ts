import { CONFIG, getAuth } from '../typescript/config';

const API_ENDPOINTS = {
    list: '/api/merchant/list',
    details: '/api/merchant/:id/details',
    delete: '/api/merchant/:id',
    toggleStatus: '/api/merchant/:id/toggle-status'
} as const;

interface Merchant {
    id: number;
    merchant_uuid: string;
    name: string;
    api_key_preview: string;
    status: 'active' | 'inactive';
    created_at: string;
}

class MerchantSystem {
    private static instance: MerchantSystem;
    private merchants: Merchant[] = [];

    static getInstance(): MerchantSystem {
        return this.instance ??= new MerchantSystem();
    }

    init(): void {
        this.setupButtons();
        this.loadMerchants();
    }

    private setupButtons(): void {
        document.getElementById('addMerchantBtn')?.addEventListener('click', () => {
            window.location.href = '/merchant/create';
        });
    }



    private async loadMerchants(): Promise<void> {
        const auth = getAuth();
        if (!auth) return;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.list}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                this.merchants = data.data || [];
                this.renderTable();
            }
        } catch (err) {
            console.error('Load merchants error:', err);
        }
    }

    private renderTable(): void {
        const container = document.getElementById('merchantsTable');
        if (!container) return;

        if (this.merchants.length === 0) {
            container.innerHTML = `
                <div class="text-center py-16">
                    <p class="text-crypto-text-muted text-xl">No merchants yet</p>
                    <p class="text-crypto-text-muted text-sm mt-2">Click "Add Merchant" to start</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="w-full">
                <thead>
                    <tr class="border-b border-crypto-border">
                        <th class="text-left py-4 px-4 text-crypto-text-muted font-semibold">Name</th>
                        <th class="text-left py-4 px-4 text-crypto-text-muted font-semibold">Status</th>
                        <th class="text-left py-4 px-4 text-crypto-text-muted font-semibold">API Key</th>
                        <th class="text-left py-4 px-4 text-crypto-text-muted font-semibold">Created</th>
                        <th class="text-left py-4 px-4 text-crypto-text-muted font-semibold">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.merchants.map(m => this.renderRow(m)).join('')}
                </tbody>
            </table>
        `;

        this.merchants.forEach(m => {
            document.getElementById(`copy-${m.id}`)?.addEventListener('click', () => this.copyApiKey(m.id));
            document.getElementById(`view-${m.id}`)?.addEventListener('click', () => this.redirectToView(m.merchant_uuid));
            document.getElementById(`edit-${m.id}`)?.addEventListener('click', () => this.redirectToEdit(m.merchant_uuid, m.status));
            document.getElementById(`toggle-${m.id}`)?.addEventListener('click', () => this.toggleStatus(m.id));
        });
    }

    private renderRow(merchant: Merchant): string {
        const statusColor = merchant.status === 'active' ? 'text-green-500' : 'text-red-500';
        const statusText = merchant.status === 'active' ? 'Active' : 'Inactive';
        const rowOpacity = merchant.status === 'inactive' ? 'opacity-60' : '';
        const date = new Date(merchant.created_at).toLocaleDateString('ru-RU', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });

        const toggleIcon = merchant.status === 'active'
            ? '<path d="M6 18L18 6M6 6l12 12"/>'
            : '<path d="M5 13l4 4L19 7"/>';
        const toggleColor = merchant.status === 'active' ? 'border-red-500 hover:bg-red-500/10' : 'border-green-500 hover:bg-green-500/10';

        const actionButtons = merchant.status === 'active' 
            ? `<button id="view-${merchant.id}" class="bg-crypto-card border border-crypto-border rounded-lg w-8 h-8 flex items-center justify-center hover:bg-crypto-border hover:scale-105 transition">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                </button>
                <button id="edit-${merchant.id}" class="bg-crypto-card border border-crypto-border rounded-lg w-8 h-8 flex items-center justify-center hover:bg-crypto-border hover:scale-105 transition">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                </button>`
            : '';

        return `
            <tr class="border-b border-crypto-border hover:bg-crypto-card transition ${rowOpacity}">
                <td class="py-4 px-4 text-white">${merchant.name}</td>
                <td class="py-4 px-4 ${statusColor} font-semibold">${statusText}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-2">
                        <span class="text-white font-mono text-sm">${merchant.api_key_preview}</span>
                        <button id="copy-${merchant.id}" class="bg-crypto-card border border-crypto-border rounded-lg w-8 h-8 flex items-center justify-center hover:bg-crypto-border hover:scale-105 transition">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2m2-2h4a2 2 0 012 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2V4a2 2 0 012-2z"/>
                            </svg>
                        </button>
                    </div>
                </td>
                <td class="py-4 px-4 text-crypto-text-muted">${date}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-2">
                        ${actionButtons}
                        <button id="toggle-${merchant.id}" class="bg-crypto-card border ${toggleColor} rounded-lg w-8 h-8 flex items-center justify-center transition">
                            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                ${toggleIcon}
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    private async copyApiKey(merchantId: number): Promise<void> {
        const auth = getAuth();
        if (!auth) return;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.details.replace(':id', merchantId.toString())}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success && data.data.api_key) {
                await navigator.clipboard.writeText(data.data.api_key);
            }
        } catch (err) {
            console.error('Copy API key error:', err);
        }
    }

    private redirectToView(merchantUUID: string): void {
        window.location.href = `/merchant/view?uuid=${merchantUUID}`;
    }

    private redirectToEdit(merchantUUID: string, status: string): void {
        if (status === 'inactive') return;
        window.location.href = `/merchant/edit?uuid=${merchantUUID}`;
    }

    private async toggleStatus(merchantId: number): Promise<void> {
        const auth = getAuth();
        if (!auth) return;

        try {
            const response = await fetch(`${CONFIG.SERVER_URL}${API_ENDPOINTS.toggleStatus.replace(':id', merchantId.toString())}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(auth)
            });

            const data = await response.json();
            if (data.success) {
                const merchant = this.merchants.find(m => m.id === merchantId);
                if (merchant) {
                    merchant.status = data.data.status;
                    this.renderTable();
                }
            }
        } catch (err) {
            console.error('Toggle status error:', err);
        }
    }

}

document.addEventListener('DOMContentLoaded', () => {
    MerchantSystem.getInstance().init();
});
