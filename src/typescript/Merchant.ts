// Merchant.ts - SEQUENCE NUMBER VERSION

/** ============ TYPES & INTERFACES ============ */
interface BaseEntity {
    id?: number;
    createdAt: string;
}

interface QRCode extends BaseEntity {
    qrId: number;
    qrUniqueId: string;
    sequenceNumber: number;
    displayName?: string;
}

interface Network extends BaseEntity {
    name: string;
    description: string;
    qrCodes?: QRCode[];
}

interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

type EntityType = 'network' | 'qrcode';
type ModalId = `${string}Modal` | `${string}ViewModal`;

/** ============ CONFIGURATION ============ */
const CONFIG = {
    SERVER_URL: 'https://zapzap666.xyz',
    API_ENDPOINTS: {
        networks: '/api/merchant/networks',
        qrcodes: '/api/merchant/qr-codes'
    },
    MODAL_Z_INDEX: {
        base: 60,
        view: 70,
        overlay: 80
    }
} as const;

/** ============ AUTHENTICATION SERVICE ============ */
class AuthService {
    private static instance: AuthService;

    static getInstance(): AuthService {
        return this.instance ??= new AuthService();
    }

    getAuthData() {
        return {
            walletAddress: localStorage.getItem("connectedWalletAddress"),
            sessionKey: localStorage.getItem("sessionKey")
        };
    }

    isAuthenticated(): boolean {
        const { walletAddress, sessionKey } = this.getAuthData();
        return !!(walletAddress && sessionKey);
    }

    requireAuth(): boolean {
        if (!this.isAuthenticated()) {
            this.showAuthError();
            return false;
        }
        return true;
    }

    private showAuthError(): void {
        alert('Please connect your wallet first to access merchant features');
    }
}

/** ============ API SERVICE ============ */
class MerchantAPI {
    private static async request<T>(endpoint: string, data?: any, method: string = 'POST'): Promise<ApiResponse<T>> {
        try {
            const authData = AuthService.getInstance().getAuthData();
            const requestData = data ? { ...authData, ...data } : authData;

            const response = await fetch(`${CONFIG.SERVER_URL}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(method !== 'GET' && { body: JSON.stringify(requestData) })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('❌ API Request Failed:', { endpoint, error });
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Network error occurred'
            };
        }
    }

    // Network operations
    static readonly networks = {
        create: (name: string, description: string) =>
            this.request(CONFIG.API_ENDPOINTS.networks, { name, description }),
        list: () =>
            this.request<Network[]>(`${CONFIG.API_ENDPOINTS.networks}/list`, AuthService.getInstance().getAuthData())
    };

    // QR Code operations
    static readonly qrcodes = {
        create: (marketNetworkId: number, quantity: number) =>
            this.request(CONFIG.API_ENDPOINTS.qrcodes, { marketNetworkId, quantity }),
        list: (networkId: number) =>
            this.request<QRCode[]>(`${CONFIG.API_ENDPOINTS.qrcodes}/${networkId}/list`, AuthService.getInstance().getAuthData())
    };

    // Generic delete operation
    static async delete(type: EntityType, id: number): Promise<ApiResponse> {
        const { walletAddress, sessionKey } = AuthService.getInstance().getAuthData();
        const endpoint = type === 'qrcode' ? 'qr-codes' : `${type}s`;

        return fetch(`${CONFIG.SERVER_URL}/api/merchant/${endpoint}/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, sessionKey })
        })
            .then(res => res.json())
            .catch(() => ({ success: false, error: 'Delete operation failed' }));
    }
}

/** ============ DOM UTILITIES ============ */
class DOMUtils {
    static createElement<T extends HTMLElement>(
        tag: string,
        className: string,
        innerHTML?: string
    ): T {
        const element = document.createElement(tag) as T;
        element.className = className;
        if (innerHTML) element.innerHTML = innerHTML;
        return element;
    }

    static createListItem(text: string, onClick: () => void): HTMLElement {
        const li = this.createElement('li',
            'flex items-center gap-2 px-2 py-1 text-white hover:bg-crypto-border hover:scale-105 transition-all duration-200 rounded cursor-pointer'
        );

        li.innerHTML = `
            <span class="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span>
            <span class="truncate">${text}</span>
        `;

        li.addEventListener('click', onClick);
        return li;
    }

    static createNetworkBlock(network: Network, onClick: () => void): HTMLElement {
        const block = this.createElement('div',
            'network-block bg-crypto-dark border-2 border-crypto-border rounded-2xl h-48 p-4 cursor-pointer hover:bg-crypto-border hover:scale-105 transition-all duration-200 flex flex-col'
        );

        block.innerHTML = `
            <div class="flex-1 flex flex-col justify-center">
                <h3 class="text-white text-lg font-semibold text-center truncate">${network.name}</h3>
                ${network.description ? `<p class="text-crypto-text-muted text-sm text-center line-clamp-3 mt-2">${network.description}</p>` : ''}
            </div>
        `;

        block.addEventListener('click', onClick);
        return block;
    }

    static createAddBlock(onClick: () => void): HTMLElement {
        const block = this.createElement('div',
            'network-add-block bg-crypto-dark border-2 border-crypto-border rounded-2xl h-48 flex items-center justify-center cursor-pointer hover:bg-crypto-border hover:scale-105 transition-all duration-200'
        );

        block.innerHTML = `
            <svg class="w-12 h-12 text-crypto-text-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M12 6v12M6 12h12"/>
            </svg>
        `;

        block.addEventListener('click', onClick);
        return block;
    }

    static createDeleteButton(onClick: () => void): HTMLElement {
        const btn = this.createElement('button',
            'delete-btn absolute bottom-4 right-4 w-10 h-10 bg-crypto-card border border-red-600 rounded-lg flex items-center justify-center hover:bg-crypto-border transition z-10'
        );

        btn.innerHTML = `
            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
        `;

        btn.onclick = (e) => {
            e.stopPropagation();
            onClick();
        };

        return btn;
    }

    static getElement<T extends HTMLElement>(id: string): T | null {
        return document.getElementById(id) as T | null;
    }

    static getInput(id: string): HTMLInputElement | null {
        return this.getElement<HTMLInputElement>(id);
    }
}

/** ============ MODAL MANAGEMENT ============ */
class ModalManager {
    private static instance: ModalManager;
    private modals = new Map<string, HTMLElement>();
    private inputs = new Map<string, HTMLInputElement>();
    private modalStack: Array<{ modalId: string; data?: any; deleteCallback?: () => void }> = [];

    static getInstance(): ModalManager {
        return this.instance ??= new ModalManager();
    }

    init(): void {
        this.registerModals();
        this.registerInputs();
        this.setupEventListeners();
    }

    private registerModals(): void {
        const modalIds = [
            'networkModal', 'networkViewModal', 'qrModal', 'qrViewModal'
        ];

        modalIds.forEach(id => {
            const modal = DOMUtils.getElement(id);
            if (modal) {
                this.modals.set(id, modal);
                this.setupModalEvents(id, modal);
            }
        });
    }

    private registerInputs(): void {
        const inputIds = ['networkName', 'networkDescription', 'qrQuantity'];

        inputIds.forEach(id => {
            const input = DOMUtils.getInput(id);
            if (input) this.inputs.set(id, input);
        });
    }

    private setupModalEvents(id: string, modal: HTMLElement): void {
        const closeBtn = modal.querySelector(`#${id}Close`);
        const backdrop = modal.querySelector(`#${id}Backdrop`);
        const backBtn = modal.querySelector(`#${id.replace('Modal', '')}Back`);

        closeBtn?.addEventListener('click', () => this.hide(id));
        backdrop?.addEventListener('click', () => this.hide(id));
        backBtn?.addEventListener('click', () => this.goBack());
    }

    private setupEventListeners(): void {
        // Handle form submissions
        const forms = ['networkForm', 'qrForm'];
        forms.forEach(formId => {
            const form = DOMUtils.getElement(formId);
            if (form) {
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.handleFormSubmit(formId);
                });
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modalStack.length > 0) {
                this.goBack();
            }
        });
    }

    private handleFormSubmit(formId: string): void {
        const typeMap: Record<string, EntityType> = {
            networkForm: 'network',
            qrForm: 'qrcode'
        };

        const type = typeMap[formId];
        if (type) {
            MerchantSystem.getInstance().handleSave(type);
        }
    }

    show(modalId: string, title?: string, deleteCallback?: () => void): void {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        // Hide current modal if exists
        if (this.modalStack.length > 0) {
            const current = this.modalStack[this.modalStack.length - 1];
            this.hideModal(current.modalId);
        }

        // Add to stack with delete callback
        this.modalStack.push({ modalId, data: { title }, deleteCallback });
        this.showModal(modalId, title);

        // Add delete button if callback provided
        if (deleteCallback) {
            this.addDeleteButton(modalId, deleteCallback);
        }
    }

    hide(modalId: string): void {
        this.hideModal(modalId);

        // Remove from stack
        const index = this.modalStack.findIndex(item => item.modalId === modalId);
        if (index !== -1) {
            this.modalStack.splice(index, 1);
        }
    }

    goBack(): void {
        if (this.modalStack.length === 0) return;

        const current = this.modalStack[this.modalStack.length - 1];
        this.hideModal(current.modalId);

        if (this.modalStack.length <= 1) {
            this.modalStack = [];
            return;
        }

        this.modalStack.pop();
        const previous = this.modalStack[this.modalStack.length - 1];
        this.showModal(previous.modalId, previous.data?.title);

        // Restore delete button if needed
        if (previous.deleteCallback) {
            this.addDeleteButton(previous.modalId, previous.deleteCallback);
        }
    }

    clear(): void {
        this.modalStack.forEach(item => this.hideModal(item.modalId));
        this.modalStack = [];
    }

    private showModal(modalId: string, title?: string): void {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';

        if (title) {
            const titleEl = modal.querySelector(`#${modalId.replace('Modal', '')}Title`);
            if (titleEl) titleEl.textContent = title;
        }
    }

    private hideModal(modalId: string): void {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
        this.removeDeleteButtons();
    }

    getInputValue(inputId: string): string {
        return this.inputs.get(inputId)?.value.trim() || '';
    }

    clearInputs(...inputIds: string[]): void {
        inputIds.forEach(id => {
            const input = this.inputs.get(id);
            if (input) input.value = '';
        });
    }

    addDeleteButton(modalId: string, onClick: () => void): void {
        const modal = this.modals.get(modalId);
        if (!modal) return;

        this.removeDeleteButtons();

        const contentBlock = modal.querySelector('.p-6, .p-8') as HTMLElement;
        if (contentBlock) {
            contentBlock.style.position = 'relative';
            contentBlock.appendChild(DOMUtils.createDeleteButton(onClick));
        }
    }

    private removeDeleteButtons(): void {
        document.querySelectorAll('.delete-btn').forEach(btn => btn.remove());
    }
}

/** ============ DROPDOWN MANAGEMENT ============ */
class DropdownManager {
    private static instance: DropdownManager;
    private openDropdown: HTMLElement | null = null;

    static getInstance(): DropdownManager {
        return this.instance ??= new DropdownManager();
    }

    init(): void {
        const configs = [
            { buttonId: 'QRCodesButton', dropdownId: 'QRCodesDropdown' }
        ];

        configs.forEach(({ buttonId, dropdownId }) => {
            const button = DOMUtils.getElement(buttonId);
            const dropdown = DOMUtils.getElement(dropdownId);

            if (button && dropdown) {
                this.setupDropdown(button, dropdown);
            }
        });

        document.addEventListener('click', () => this.closeAll());
    }

    private setupDropdown(button: HTMLElement, dropdown: HTMLElement): void {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(dropdown, button);
        });
    }

    private toggle(dropdown: HTMLElement, button: HTMLElement): void {
        if (this.openDropdown && this.openDropdown !== dropdown) {
            this.close(this.openDropdown);
        }

        dropdown.classList.toggle('hidden');
        this.openDropdown = dropdown.classList.contains('hidden') ? null : dropdown;
        this.toggleArrow(button);
    }

    private close(dropdown: HTMLElement): void {
        dropdown.classList.add('hidden');
        this.openDropdown = null;
    }

    private closeAll(): void {
        if (this.openDropdown) {
            this.close(this.openDropdown);
        }
    }

    private toggleArrow(button: HTMLElement): void {
        const arrow = button.querySelector('svg');
        if (arrow) arrow.classList.toggle('rotate-180');
    }
}

/** ============ QR CODE MANAGEMENT ============ */
class QRCodeManager {
    private static instance: QRCodeManager;

    static getInstance(): QRCodeManager {
        return this.instance ??= new QRCodeManager();
    }

    async generateQRImage(qrUniqueId: string): Promise<void> {
        const canvas = DOMUtils.getElement<HTMLCanvasElement>('qrCanvas');
        if (!canvas) {
            console.error('QR Canvas element not found');
            return;
        }

        // ✅ Проверяем загружена ли библиотека QRCode
        if (typeof (window as any).QRCode === 'undefined') {
            console.error('❌ QRCode library not loaded');
            this.showQRError('QRCode library not loaded');
            return;
        }

        try {
            const qrUrl = `https://zapzap666.xyz/?qr=${qrUniqueId}`;

            // ✅ Очищаем canvas перед генерацией
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }

            // ✅ Создаем контейнер для QR кода
            const qrContainer = canvas.parentElement;
            if (qrContainer) {
                // Удаляем старый QR если есть
                const oldQR = qrContainer.querySelector('.qr-code-temp');
                if (oldQR) oldQR.remove();

                // Создаем временный div для QRCodeJS
                const tempDiv = document.createElement('div');
                tempDiv.className = 'qr-code-temp';
                tempDiv.style.display = 'none';
                qrContainer.appendChild(tempDiv);

                // ✅ Генерируем QR с помощью QRCodeJS
                const QRCodeLib = (window as any).QRCode;
                new QRCodeLib(tempDiv, {
                    text: qrUrl,
                    width: 300,
                    height: 300,
                    colorDark: '#000000',
                    colorLight: '#ffffff',
                    correctLevel: QRCodeLib.CorrectLevel.M
                });

                // ✅ Копируем сгенерированный QR на canvas
                setTimeout(() => {
                    const qrImg = tempDiv.querySelector('img') as HTMLImageElement;
                    if (qrImg && ctx) {
                        qrImg.onload = () => {
                            canvas.width = 300;
                            canvas.height = 300;
                            ctx.drawImage(qrImg, 0, 0, 300, 300);
                            tempDiv.remove();
                        };
                        if (qrImg.complete) qrImg.onload(null as any);
                    }
                }, 100);
            }

            this.updateQRInfo(qrUniqueId, qrUrl);
            console.log('✅ QR generated with QRCodeJS:', qrUniqueId);

        } catch (error) {
            console.error('❌ QR generation failed:', error);
            this.showQRError('Failed to generate QR code');
        }
    }

    private updateQRInfo(qrUniqueId: string, qrUrl: string): void {
        const qrUniqueIdEl = DOMUtils.getElement('qrUniqueId');
        const qrCodeUrl = DOMUtils.getElement('qrCodeUrl');

        if (qrUniqueIdEl) qrUniqueIdEl.textContent = qrUniqueId;
        if (qrCodeUrl) {
            qrCodeUrl.textContent = qrUrl;
            qrCodeUrl.className = 'text-white text-sm break-all';
        }
    }

    private showQRError(message: string): void {
        const canvas = DOMUtils.getElement<HTMLCanvasElement>('qrCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = 300;
                canvas.height = 300;
                ctx.fillStyle = '#f3f4f6';
                ctx.fillRect(0, 0, 300, 300);
                ctx.fillStyle = '#ef4444';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(message, 150, 150);
            }
        }
    }

    downloadQR(): void {
        const canvas = DOMUtils.getElement<HTMLCanvasElement>('qrCanvas');
        if (!canvas) return;

        try {
            const link = document.createElement('a');
            link.download = `cryptonow-qr-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('❌ QR download failed:', error);
            alert('Download failed. Please try again.');
        }
    }

    async copyQRUrl(): Promise<void> {
        const qrCodeUrlEl = DOMUtils.getElement('qrCodeUrl');
        const url = qrCodeUrlEl?.textContent;

        if (!url || url === '') {
            alert('QR URL not available');
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            console.log('✅ QR URL copied to clipboard');
        } catch (error) {
            console.error('❌ Copy failed:', error);
            alert('Copy failed. Please copy manually: ' + url);
        }
    }

    private showCopySuccess(): void {
        const notification = DOMUtils.createElement('div',
            'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity'
        );
        notification.textContent = 'ID copied to clipboard!';

        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => document.body.removeChild(notification), 300);
        }, 2000);
    }

    private fallbackCopy(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';

        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            this.showCopySuccess();
        } catch (error) {
            alert('Copy failed. Please copy manually: ' + text);
        }

        document.body.removeChild(textarea);
    }
}

/** ============ MAIN MERCHANT SYSTEM ============ */
class MerchantSystem {
    private static instance: MerchantSystem;
    private networks: Network[] = [];
    private state = {
        currentNetworkId: null as number | null,
        currentQRId: null as number | null,
    };

    static getInstance(): MerchantSystem {
        return this.instance ??= new MerchantSystem();
    }

    init(): void {
        this.initializeManagers();
        this.setupEventListeners();
        this.loadNetworks();
    }

    private initializeManagers(): void {
        ModalManager.getInstance().init();
        DropdownManager.getInstance().init();
    }

    private setupEventListeners(): void {
        // Add QR button
        DOMUtils.getElement('AddQRButton')?.addEventListener('click', () =>
            this.openCreateModal('qrcode')
        );

        // QR actions
        DOMUtils.getElement('downloadQR')?.addEventListener('click', () =>
            QRCodeManager.getInstance().downloadQR()
        );
        DOMUtils.getElement('copyQRUrl')?.addEventListener('click', () =>
            QRCodeManager.getInstance().copyQRUrl()
        );
    }

    // ============ NETWORK OPERATIONS ============
    private async loadNetworks(): Promise<void> {
        if (!AuthService.getInstance().isAuthenticated()) {
            this.networks = [];
            this.renderNetworks();
            return;
        }

        const response = await MerchantAPI.networks.list();
        this.networks = response.success ? response.data || [] : [];
        this.renderNetworks();
    }

    private renderNetworks(): void {
        const grid = DOMUtils.getElement('innerGrid');
        if (!grid) return;

        grid.innerHTML = '';

        // Add network blocks
        this.networks.forEach(network => {
            grid.appendChild(DOMUtils.createNetworkBlock(network, () => this.openNetworkView(network)));
        });

        // Add "create new" block
        grid.appendChild(DOMUtils.createAddBlock(() => this.openCreateModal('network')));
    }

    private async openNetworkView(network: Network): Promise<void> {
        this.state.currentNetworkId = network.id!;

        try {
            // Load QR codes for this network
            const qrCodesResponse = await MerchantAPI.qrcodes.list(network.id!);

            // Render QR codes list
            this.renderEntityList('qrCodesList', qrCodesResponse.data || [],
                item => this.openQRView(item),
                item => item.displayName || `${item.sequenceNumber} (Id:${item.qrUniqueId})`);

            // Show modal with delete callback
            const deleteCallback = () => this.handleDelete('network', network.id!, () => ModalManager.getInstance().clear());
            ModalManager.getInstance().show('networkViewModal', network.name, deleteCallback);

        } catch (error) {
            console.error('❌ Failed to load network data:', error);
            alert('Failed to load network data. Please try again.');
        }
    }

    // ============ QR CODE OPERATIONS ============
    private async openQRView(qrCode: QRCode): Promise<void> {
        this.state.currentQRId = qrCode.qrId;

        // Show modal with delete callback
        const deleteCallback = () => this.handleDelete('qrcode', qrCode.qrId, () => ModalManager.getInstance().goBack());
        ModalManager.getInstance().show('qrViewModal', `QR ${qrCode.sequenceNumber}`, deleteCallback);

        // Generate QR image
        await QRCodeManager.getInstance().generateQRImage(qrCode.qrUniqueId);
    }

    private async saveQRCode(): Promise<void> {
        const quantity = parseInt(ModalManager.getInstance().getInputValue('qrQuantity')) || 0;
        if (!quantity || quantity < 1 || quantity > 50 || !this.state.currentNetworkId) {
            alert('Please enter quantity (1-50)');
            return;
        }

        const response = await MerchantAPI.qrcodes.create(this.state.currentNetworkId, quantity);
        if (response.success) {
            ModalManager.getInstance().hide('qrModal');
            const network = this.networks.find(n => n.id === this.state.currentNetworkId);
            if (network) await this.openNetworkView(network);
        } else {
            alert(response.error || 'Failed to create QR codes');
        }
    }

    // ============ GENERIC OPERATIONS ============
    private openCreateModal(type: EntityType): void {
        if (!AuthService.getInstance().requireAuth()) return;

        const modalMap: Record<EntityType, string> = {
            network: 'networkModal',
            qrcode: 'qrModal'
        };

        const inputMap: Record<EntityType, string[]> = {
            network: ['networkName', 'networkDescription'],
            qrcode: ['qrQuantity']
        };

        const modalId = modalMap[type];
        if (modalId) {
            ModalManager.getInstance().clearInputs(...inputMap[type]);
            ModalManager.getInstance().show(modalId);
        }
    }

    private renderEntityList<T extends { qrId?: number; sequenceNumber?: number; displayName?: string }>(
        containerId: string,
        items: T[],
        onItemClick: (item: T) => void,
        getDisplayText?: (item: T) => string
    ): void {
        const container = DOMUtils.getElement(containerId);
        if (!container) return;

        container.innerHTML = '';
        items.forEach(item => {
            const text = getDisplayText ? getDisplayText(item) : `${item.sequenceNumber}`;
            container.appendChild(DOMUtils.createListItem(text, () => onItemClick(item)));
        });
    }

    // ============ CRUD OPERATIONS ============
    async handleSave(type: EntityType): Promise<void> {
        if (!AuthService.getInstance().requireAuth()) return;

        const handlers: Record<EntityType, () => Promise<void>> = {
            network: () => this.saveNetwork(),
            qrcode: () => this.saveQRCode()
        };

        await handlers[type]();
    }

    private async saveNetwork(): Promise<void> {
        const modalManager = ModalManager.getInstance();
        const name = modalManager.getInputValue('networkName');
        const description = modalManager.getInputValue('networkDescription');

        if (!name) {
            alert('Please enter a chain name');
            return;
        }

        const response = await MerchantAPI.networks.create(name, description);
        if (response.success) {
            await this.loadNetworks();
            modalManager.hide('networkModal');
        } else {
            alert(response.error || 'Failed to create network');
        }
    }

    private async handleDelete(type: EntityType, id: number, onSuccess: () => void): Promise<void> {
        const entityNames: Record<EntityType, string> = {
            network: 'network',
            qrcode: 'QR code'
        };

        if (!confirm(`Are you sure you want to delete this ${entityNames[type]}?`)) return;

        const response = await MerchantAPI.delete(type, id);
        if (response.success) {
            onSuccess();
            await this.loadNetworks();
        } else {
            alert(response.error || 'Delete operation failed');
        }
    }
}

/** ============ INITIALIZATION ============ */
document.addEventListener('DOMContentLoaded', () => {
    MerchantSystem.getInstance().init();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            AuthService.getInstance().isAuthenticated();
        }
    });
});