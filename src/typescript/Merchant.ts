// Merchant.ts

/** ================== TYPES & INTERFACES ================== */
interface BaseEntity { id?: number; createdAt: string; }
interface QRCode extends BaseEntity { qrId: number; qrUniqueId: string; displayName?: string; }
interface Network extends BaseEntity { name: string; description: string; qrCodes?: QRCode[]; }
interface ApiResponse<T = any> { success: boolean; data?: T; error?: string; message?: string; }
type EntityType = 'network' | 'qrcode';
type ModalId = `${string}Modal` | `${string}ViewModal`;

/** ================== CONFIGURATION ================== */
const CONFIG = {
    SERVER_URL: 'https://zapzap666.xyz',
    API_ENDPOINTS: { networks: '/api/merchant/networks', qrcodes: '/api/merchant/qr-codes' },
    MODAL_Z_INDEX: { base: 60, view: 70, overlay: 80 }
} as const;

/** ================== AUTH SERVICE ================== */
class AuthService {
    private static instance: AuthService;
    static getInstance(): AuthService { return this.instance ??= new AuthService(); }

    getAuthData() {
        return { walletAddress: localStorage.getItem("connectedWalletAddress"), sessionKey: localStorage.getItem("sessionKey") };
    }

    isAuthenticated(): boolean {
        const { walletAddress, sessionKey } = this.getAuthData();
        return !!(walletAddress && sessionKey);
    }

    requireAuth(): boolean {
        if (!this.isAuthenticated()) { alert('Please connect your wallet first'); return false; }
        return true;
    }
}

/** ================== API SERVICE ================== */
class MerchantAPI {
    private static async request<T>(endpoint: string, data?: any, method = 'POST'): Promise<ApiResponse<T>> {
        try {
            const authData = AuthService.getInstance().getAuthData();
            const body = data ? { ...authData, ...data } : authData;
            const res = await fetch(`${CONFIG.SERVER_URL}${endpoint}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(method !== 'GET' && { body: JSON.stringify(body) })
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            return await res.json();
        } catch (e) {
            console.error('API request failed', e);
            return { success: false, error: e instanceof Error ? e.message : 'Network error' };
        }
    }

    static networks = {
        create: (name: string, description: string) => this.request(CONFIG.API_ENDPOINTS.networks, { name, description }),
        list: () => this.request<Network[]>(`${CONFIG.API_ENDPOINTS.networks}/list`, AuthService.getInstance().getAuthData())
    };

    static qrcodes = {
        create: (networkId: number, quantity: number) => this.request(CONFIG.API_ENDPOINTS.qrcodes, { marketNetworkId: networkId, quantity }),
        list: (networkId: number) => this.request<QRCode[]>(`${CONFIG.API_ENDPOINTS.qrcodes}/${networkId}/list`, AuthService.getInstance().getAuthData())
    };

    static async delete(type: EntityType, id: number): Promise<ApiResponse> {
        const { walletAddress, sessionKey } = AuthService.getInstance().getAuthData();
        const endpoint = type === 'qrcode' ? 'qr-codes' : `${type}s`;
        try {
            const res = await fetch(`${CONFIG.SERVER_URL}/api/merchant/${endpoint}/${id}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ walletAddress, sessionKey })
            });
            return await res.json();
        } catch { return { success: false, error: 'Delete failed' }; }
    }
}

/** ================== DOM UTILITIES ================== */
class DOMUtils {
    static createElement<T extends HTMLElement>(tag: string, className: string, innerHTML?: string): T {
        const el = document.createElement(tag) as T;
        el.className = className;
        if (innerHTML) el.innerHTML = innerHTML;
        return el;
    }

    static createListItem(text: string, onClick: () => void): HTMLElement {
        const li = this.createElement('li',
            'flex items-center gap-2 px-2 py-1 text-white hover:bg-crypto-border hover:scale-105 transition-all duration-200 rounded cursor-pointer');
        li.innerHTML = `<span class="w-1.5 h-1.5 bg-white rounded-full flex-shrink-0"></span><span class="truncate">${text}</span>`;
        li.addEventListener('click', onClick);
        return li;
    }

    static createNetworkBlock(network: Network, onClick: () => void): HTMLElement {
        const block = this.createElement('div',
            'network-block bg-crypto-dark border-2 border-crypto-border rounded-2xl h-48 p-4 cursor-pointer hover:bg-crypto-border hover:scale-105 transition-all duration-200 flex flex-col');
        block.innerHTML = `<div class="flex-1 flex flex-col justify-center">
            <h3 class="text-white text-lg font-semibold text-center truncate">${network.name}</h3>
            ${network.description ? `<p class="text-crypto-text-muted text-sm text-center line-clamp-3 mt-2">${network.description}</p>` : ''}
        </div>`;
        block.addEventListener('click', onClick);
        return block;
    }

    static createAddBlock(onClick: () => void): HTMLElement {
        const block = this.createElement('div',
            'network-add-block bg-crypto-dark border-2 border-crypto-border rounded-2xl h-48 flex items-center justify-center cursor-pointer hover:bg-crypto-border hover:scale-105 transition-all duration-200');
        block.innerHTML = `<svg class="w-12 h-12 text-crypto-text-muted" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>`;
        block.addEventListener('click', onClick);
        return block;
    }

    static createDeleteButton(onClick: () => void): HTMLElement {
        const btn = this.createElement('button',
            'delete-btn absolute bottom-4 right-4 w-10 h-10 bg-crypto-card border border-red-600 rounded-lg flex items-center justify-center hover:bg-crypto-border transition z-10');
        btn.innerHTML = `<svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>`;
        btn.onclick = e => { e.stopPropagation(); onClick(); };
        return btn;
    }

    static getElement<T extends HTMLElement>(id: string): T | null { return document.getElementById(id) as T | null; }
    static getInput(id: string): HTMLInputElement | null { return this.getElement<HTMLInputElement>(id); }
}

/** ================== MODAL MANAGEMENT ================== */
class ModalManager {
    private static instance: ModalManager;
    private modals = new Map<string, HTMLElement>();
    private inputs = new Map<string, HTMLInputElement>();
    private modalStack: Array<{ modalId: string; data?: any; deleteCallback?: () => void }> = [];

    static getInstance(): ModalManager { return this.instance ??= new ModalManager(); }

    init(): void {
        ['networkModal','networkViewModal','qrModal','qrViewModal'].forEach(id => {
            const modal = DOMUtils.getElement(id); if(modal){ this.modals.set(id, modal); this.setupModalEvents(id, modal);}
        });
        ['networkName','networkDescription','qrQuantity'].forEach(id => { const input = DOMUtils.getInput(id); if(input) this.inputs.set(id,input);});
        ['networkForm','qrForm'].forEach(id=>{
            const form = DOMUtils.getElement(id);
            if(form) form.addEventListener('submit', e=>{ e.preventDefault(); this.handleFormSubmit(id);});
        });
        document.addEventListener('keydown', e=>{ if(e.key==='Escape'&&this.modalStack.length>0)this.goBack(); });
    }

    private setupModalEvents(id:string, modal:HTMLElement):void {
        const closeBtn = modal.querySelector(`#${id}Close`), backdrop = modal.querySelector(`#${id}Backdrop`), backBtn = modal.querySelector(`#${id.replace('Modal','')}Back`);
        closeBtn?.addEventListener('click', ()=>this.hide(id));
        backdrop?.addEventListener('click', ()=>this.hide(id));
        backBtn?.addEventListener('click', ()=>this.goBack());
    }

    private handleFormSubmit(formId:string):void {
        const typeMap: Record<string, EntityType> = { networkForm:'network', qrForm:'qrcode' };
        const type = typeMap[formId];
        if(type) MerchantSystem.getInstance().handleSave(type);
    }

    show(modalId:string, title?:string, deleteCallback?:()=>void):void{
        if(this.modalStack.length>0) this.hideModal(this.modalStack[this.modalStack.length-1].modalId);
        this.modalStack.push({modalId,data:{title},deleteCallback});
        this.showModal(modalId,title);
        if(deleteCallback) this.addDeleteButton(modalId,deleteCallback);
    }

    hide(modalId:string):void{
        this.hideModal(modalId);
        const idx = this.modalStack.findIndex(item=>item.modalId===modalId);
        if(idx!==-1) this.modalStack.splice(idx,1);
    }

    goBack():void{
        if(this.modalStack.length===0) return;
        const current = this.modalStack.pop()!;
        this.hideModal(current.modalId);
        if(this.modalStack.length===0) return;
        const previous = this.modalStack[this.modalStack.length-1];
        this.showModal(previous.modalId, previous.data?.title);
        if(previous.deleteCallback) this.addDeleteButton(previous.modalId, previous.deleteCallback);
    }

    clear():void{ this.modalStack.forEach(item=>this.hideModal(item.modalId)); this.modalStack=[]; }

    private showModal(id:string, title?:string):void{
        const modal = this.modals.get(id); if(!modal) return;
        modal.classList.remove('hidden'); modal.classList.add('flex'); document.body.style.overflow='hidden';
        if(title){ const titleEl = modal.querySelector(`#${id.replace('Modal','')}Title`); if(titleEl) titleEl.textContent=title; }
    }

    private hideModal(id:string):void{
        const modal = this.modals.get(id); if(!modal) return;
        modal.classList.add('hidden'); modal.classList.remove('flex'); document.body.style.overflow='auto';
        this.removeDeleteButtons();
    }

    getInputValue(id:string):string{ return this.inputs.get(id)?.value.trim()||''; }
    clearInputs(...ids:string[]):void{ ids.forEach(id=>{ const input=this.inputs.get(id); if(input) input.value=''; }); }

    addDeleteButton(modalId:string, onClick:()=>void):void{
        const modal=this.modals.get(modalId); if(!modal) return;
        this.removeDeleteButtons();
        const content = modal.querySelector('.p-6, .p-8') as HTMLElement;
        if(content){ content.style.position='relative'; content.appendChild(DOMUtils.createDeleteButton(onClick)); }
    }

    private removeDeleteButtons():void{ document.querySelectorAll('.delete-btn').forEach(btn=>btn.remove()); }
}

/** ================== DROPDOWN MANAGEMENT ================== */
class DropdownManager {
    private static instance: DropdownManager; private openDropdown:HTMLElement|null=null;
    static getInstance():DropdownManager{ return this.instance??=new DropdownManager(); }
    init():void{
        [{buttonId:'QRCodesButton',dropdownId:'QRCodesDropdown'}].forEach(cfg=>{
            const btn=DOMUtils.getElement(cfg.buttonId), dd=DOMUtils.getElement(cfg.dropdownId);
            if(btn&&dd){ btn.addEventListener('click', e=>{ e.stopPropagation(); this.toggle(dd,btn); }); }
        });
        document.addEventListener('click', ()=>this.closeAll());
    }
    private toggle(dropdown:HTMLElement, button:HTMLElement):void{
        if(this.openDropdown&&this.openDropdown!==dropdown) this.close(this.openDropdown);
        dropdown.classList.toggle('hidden'); this.openDropdown=dropdown.classList.contains('hidden')?null:dropdown;
        const arrow=button.querySelector('svg'); if(arrow) arrow.classList.toggle('rotate-180');
    }
    private close(dropdown:HTMLElement):void{ dropdown.classList.add('hidden'); this.openDropdown=null; }
    private closeAll():void{ if(this.openDropdown) this.close(this.openDropdown); }
}

/** ================== QR CODE MANAGEMENT ================== */
class QRCodeManager {
    private static instance:QRCodeManager;
    static getInstance():QRCodeManager{ return this.instance??=new QRCodeManager(); }

    async generateQRImage(qrUniqueId:string):Promise<void>{
        const canvas=DOMUtils.getElement<HTMLCanvasElement>('qrCanvas');
        if(!canvas){ console.error('Canvas not found'); return; }
        if(typeof (window as any).QRCode==='undefined'){ console.error('QRCode lib missing'); return; }

        try{
            const qrUrl=`https://zapzap666.xyz/?qr=${qrUniqueId}`;
            const ctx=canvas.getContext('2d'); if(ctx) ctx.clearRect(0,0,canvas.width,canvas.height);

            const container=canvas.parentElement;
            if(container){
                const old=container.querySelector('.qr-code-temp'); if(old) old.remove();
                const temp=document.createElement('div'); temp.className='qr-code-temp'; temp.style.display='none';
                container.appendChild(temp);
                new (window as any).QRCode(temp,{text:qrUrl,width:300,height:300,colorDark:'#000',colorLight:'#fff',correctLevel:(window as any).QRCode.CorrectLevel.M});
                setTimeout(()=>{
                    const img=temp.querySelector('img') as HTMLImageElement;
                    if(img&&ctx){ img.onload=()=>{ canvas.width=300; canvas.height=300; ctx.drawImage(img,0,0,300,300); temp.remove(); }; if(img.complete) img.onload(null as any);}
                },100);
            }

            const qrUniqueIdEl = DOMUtils.getElement('qrUniqueId'); if(qrUniqueIdEl) qrUniqueIdEl.textContent = qrUniqueId;
            const qrCodeUrl = DOMUtils.getElement('qrCodeUrl');
            if (qrCodeUrl) {
                qrCodeUrl.innerHTML = `<a href="${qrUrl}" target="_blank" class="text-white text-sm break-all underline">${qrUrl}</a>`;
            }

        }catch(e){ console.error('QR generation failed',e); }
    }

    downloadQR():void{
        const canvas=DOMUtils.getElement<HTMLCanvasElement>('qrCanvas'); if(!canvas) return;
        const link=document.createElement('a'); link.download=`cryptonow-qr-${Date.now()}.png`; link.href=canvas.toDataURL('image/png',1.0);
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    }

    async copyQRUrl():Promise<void>{
        const el=DOMUtils.getElement('qrCodeUrl'); const url=el?.textContent;
        if(!url||url===''){ alert('QR URL not available'); return; }
        try{ await navigator.clipboard.writeText(url); }catch{ alert('Copy failed, copy manually: '+url); }
    }

}

/** ================== MAIN MERCHANT SYSTEM ================== */
class MerchantSystem {
    private static instance:MerchantSystem;
    private networks:Network[]=[];
    private state={ currentNetworkId:null as number|null, currentQRId:null as number|null };

    static getInstance():MerchantSystem{ return this.instance??=new MerchantSystem(); }

    init():void{
        ModalManager.getInstance().init();
        DropdownManager.getInstance().init();
        this.loadNetworks();
        DOMUtils.getElement('AddQRButton')?.addEventListener('click', ()=>this.openCreateModal('qrcode'));
        DOMUtils.getElement('downloadQR')?.addEventListener('click', ()=>QRCodeManager.getInstance().downloadQR());
        DOMUtils.getElement('copyQRUrl')?.addEventListener('click', ()=>QRCodeManager.getInstance().copyQRUrl());
    }

    private async loadNetworks():Promise<void>{
        if(!AuthService.getInstance().isAuthenticated()){ this.networks=[]; this.renderNetworks(); return; }
        const res = await MerchantAPI.networks.list(); this.networks = res.success? res.data||[] : [];
        this.renderNetworks();
    }

    private renderNetworks():void{
        const grid = DOMUtils.getElement('innerGrid'); if(!grid) return;
        grid.innerHTML='';
        this.networks.forEach(n=>grid.appendChild(DOMUtils.createNetworkBlock(n, ()=>this.openNetworkView(n))));
        grid.appendChild(DOMUtils.createAddBlock(()=>this.openCreateModal('network')));
    }

    private async openNetworkView(network:Network):Promise<void>{
        this.state.currentNetworkId=network.id!;
        try{
            const qrRes=await MerchantAPI.qrcodes.list(network.id!);
            // Используем displayName или fallback на "QR ID: {qrId} ({qrUniqueId})"
            this.renderEntityList('qrCodesList', qrRes.data||[], item=>this.openQRView(item), item=>item.displayName||`QR ID: ${item.qrId} (${item.qrUniqueId})`);
            const deleteCb = ()=>this.handleDelete('network', network.id!, ()=>ModalManager.getInstance().clear());
            ModalManager.getInstance().show('networkViewModal', network.name, deleteCb);
        }catch(e){ console.error(e); alert('Failed to load network data'); }
    }

    private async openQRView(qr:QRCode):Promise<void>{
        this.state.currentQRId=qr.qrId;
        const deleteCb = ()=>this.handleDelete('qrcode', qr.qrId, ()=>ModalManager.getInstance().goBack());
        // Заголовок модала теперь использует qr_id вместо sequence_number
        ModalManager.getInstance().show('qrViewModal', `QR ID: ${qr.qrId}`, deleteCb);
        await QRCodeManager.getInstance().generateQRImage(qr.qrUniqueId);
    }

    private async saveNetwork():Promise<void>{
        const modal=ModalManager.getInstance(); const name=modal.getInputValue('networkName'); const desc=modal.getInputValue('networkDescription');
        if(!name){ alert('Enter chain name'); return; }
        const res = await MerchantAPI.networks.create(name, desc);
        if(res.success){ await this.loadNetworks(); modal.hide('networkModal'); } else alert(res.error||'Failed to create network');
    }

    private async saveQRCode():Promise<void>{
        const quantity=parseInt(ModalManager.getInstance().getInputValue('qrQuantity'))||0;
        if(!quantity||quantity<1||quantity>50||!this.state.currentNetworkId){ alert('Enter quantity 1-50'); return; }
        const res=await MerchantAPI.qrcodes.create(this.state.currentNetworkId,quantity);
        if(res.success){ ModalManager.getInstance().hide('qrModal'); const net=this.networks.find(n=>n.id===this.state.currentNetworkId); if(net) await this.openNetworkView(net); }
        else alert(res.error||'Failed to create QR codes');
    }

    private renderEntityList<T extends { qrId?: number; qrUniqueId?: string; displayName?: string }>(id:string, items:T[], onClick:(item:T)=>void, getText?:(item:T)=>string):void{
        const container = DOMUtils.getElement(id); if(!container) return; container.innerHTML='';
        items.forEach(item=>container.appendChild(DOMUtils.createListItem(getText?getText(item):`QR ${item.qrId}`, ()=>onClick(item))));
    }

    private openCreateModal(type:EntityType):void{
        if(!AuthService.getInstance().requireAuth()) return;
        const modalMap:Record<EntityType,string>={network:'networkModal', qrcode:'qrModal'};
        const inputMap:Record<EntityType,string[]>={network:['networkName','networkDescription'], qrcode:['qrQuantity']};
        const modalId=modalMap[type]; if(modalId){ ModalManager.getInstance().clearInputs(...inputMap[type]); ModalManager.getInstance().show(modalId); }
    }

    async handleSave(type:EntityType):Promise<void>{
        if(!AuthService.getInstance().requireAuth()) return;
        const handlers:Record<EntityType,()=>Promise<void>>={network:()=>this.saveNetwork(),qrcode:()=>this.saveQRCode()};
        await handlers[type]();
    }

    private async handleDelete(type:EntityType,id:number,onSuccess:()=>void):Promise<void>{
        const names:Record<EntityType,string>={network:'network',qrcode:'QR code'};
        if(!confirm(`Delete this ${names[type]}?`)) return;
        const res=await MerchantAPI.delete(type,id);
        if(res.success){ onSuccess(); await this.loadNetworks(); } else alert(res.error||'Delete failed');
    }
}

/** ================== INITIALIZATION ================== */
document.addEventListener('DOMContentLoaded', ()=>{ MerchantSystem.getInstance().init(); });