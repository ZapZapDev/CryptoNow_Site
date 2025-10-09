export class WalletUI {
    static shortenAddress(address: string): string {
        return address.slice(0, 6) + "..." + address.slice(-4);
    }

    static updateButton(button: HTMLButtonElement, address: string, includeArrow: boolean = true): void {
        const shortAddr = this.shortenAddress(address);
        
        if (includeArrow) {
            button.innerHTML = `
                ${shortAddr}
                <svg id="walletArrow" class="w-5 h-5 ml-2 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            `;
        } else {
            button.textContent = `${shortAddr} ▼`;
        }
    }

    static resetButton(button: HTMLButtonElement, text: string = "Connect Wallet"): void {
        button.textContent = text;
    }

    static createDropdown(): HTMLDivElement {
        const dropdown = document.createElement("div");
        dropdown.className = "absolute bg-crypto-card border-2 border-crypto-border rounded-lg w-44 hidden shadow-lg z-50";
        
        dropdown.innerHTML = `
            <button id="logoutButton" class="w-full text-left px-4 py-2 text-red-500 font-medium hover:bg-crypto-border flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path d="M17 16l4-4m0 0l-4-4m4 4H7"/>
                </svg>
                Logout
            </button>
        `;
        
        return dropdown;
    }

    static positionDropdown(dropdown: HTMLElement, button: HTMLElement): void {
        const rect = button.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + window.scrollY}px`;
        dropdown.style.left = `${rect.left + window.scrollX}px`;
    }

    static setArrow(arrowIcon: SVGElement | null, up: boolean): void {
        if (arrowIcon) {
            arrowIcon.style.transform = up ? "rotate(180deg)" : "rotate(0deg)";
        }
    }
}
