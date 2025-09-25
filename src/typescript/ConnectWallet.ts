// ConnectWallet.ts - Оптимизированная версия
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { GlowWalletAdapter } from "@solana/wallet-adapter-glow";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

type WalletType = "phantom" | "solflare" | "glow" | "backpack";

const SERVER_URL = "https://zapzap666.xyz";

// UI элементы
const walletButtonDesktop = document.getElementById("walletButtonDesktop") as HTMLButtonElement;
const walletButtonMobile = document.getElementById("walletButtonMobile") as HTMLButtonElement;
const walletModal = document.getElementById("walletModal") as HTMLDivElement;
const walletModalClose = document.getElementById("walletModalClose") as HTMLButtonElement;
const walletListButtons = document.querySelectorAll<HTMLButtonElement>("#walletList button[data-wallet]");

// Адаптеры
const solanaAdapters: Record<WalletType, any> = {
    phantom: new PhantomWalletAdapter(),
    solflare: new SolflareWalletAdapter(),
    glow: new GlowWalletAdapter(),
    backpack: new BackpackWalletAdapter()
};

// Состояние
let connectedWalletType: WalletType | null = null;
let currentSessionKey: string | null = null;
let arrowIcon: SVGElement | null = null;
let walletDropdown: HTMLDivElement | null = null;

// Флаги
let isConnecting = false;
let isValidatingSession = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

/* ----------------------------- Утилиты ----------------------------- */

function shortenAddress(addr: string) {
    return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function updateWalletButton(address: string) {
    const shortAddr = shortenAddress(address);
    if (walletButtonDesktop) {
        walletButtonDesktop.innerHTML = `
            ${shortAddr}
            <svg id="walletArrow" class="w-5 h-5 ml-2 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6"/>
            </svg>
        `;
    }
    if (walletButtonMobile) walletButtonMobile.textContent = `${shortAddr} ▼`;
}

function setArrow(up: boolean) {
    if (arrowIcon) arrowIcon.style.transform = up ? "rotate(180deg)" : "rotate(0deg)";
}

function isWalletInstalled(walletType: WalletType): boolean {
    const w = window as any;
    switch (walletType) {
        case "phantom": return !!w.phantom?.solana;
        case "solflare": return !!w.solflare || !!w.solana?.isSolflare;
        case "glow": return !!w.glow || !!w.glowSolana;
        case "backpack": return !!w.backpack || !!w.solana?.isBackpack;
        default: return false;
    }
}

/* ------------------------- Работа с сервером ------------------------- */

async function loginToServer(walletAddress: string): Promise<string | null> {
    try {
        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ walletAddress })
        });
        if (!res.ok) return null;

        const data = await res.json();
        return data.success ? data.sessionKey : null;
    } catch {
        return null;
    }
}

async function validateServerSession(walletAddress: string, sessionKey: string): Promise<boolean> {
    if (isValidatingSession) return true;
    isValidatingSession = true;

    try {
        const res = await fetch(`${SERVER_URL}/api/auth/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ walletAddress, sessionKey })
        });
        if (!res.ok) return false;

        const data = await res.json();
        return !!data.success;
    } catch {
        return false;
    } finally {
        isValidatingSession = false;
    }
}

async function logoutFromServer(walletAddress: string) {
    try {
        await fetch(`${SERVER_URL}/api/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ walletAddress })
        });
    } catch {}
}

/* -------------------------- Подключение -------------------------- */

async function connectWallet(type: WalletType) {
    if (isConnecting) return;
    isConnecting = true;

    try {
        const adapter = solanaAdapters[type];
        setupWalletEventListeners(adapter, type);

        await adapter.connect({ onlyIfTrusted: false });
        const publicKey = adapter.publicKey;
        if (!publicKey) throw new Error("No public key");

        const walletAddress = publicKey.toBase58();
        const sessionKey = await loginToServer(walletAddress);
        if (!sessionKey) throw new Error("Server auth failed");

        connectedWalletType = type;
        currentSessionKey = sessionKey;

        localStorage.setItem("connectedWalletType", type);
        localStorage.setItem("connectedWalletAddress", walletAddress);
        localStorage.setItem("sessionKey", sessionKey);

        updateWalletButton(walletAddress);
        closeModal();
        reconnectAttempts = 0;
    } catch (e) {
        await handleWalletDisconnect();
        alert("Failed to connect wallet");
    } finally {
        isConnecting = false;
    }
}

function setupWalletEventListeners(adapter: any, type: WalletType) {
    adapter.removeAllListeners?.();
    adapter.on("disconnect", handleWalletDisconnect);
    adapter.on("error", handleWalletDisconnect);
    adapter.on("accountChanged", () => setTimeout(tryReconnect, 1000));
}

/* ---------------------- Обработка отключения ---------------------- */

async function handleWalletDisconnect() {
    if (connectedWalletType) {
        const walletAddress = localStorage.getItem("connectedWalletAddress");
        if (walletAddress) await logoutFromServer(walletAddress);

        connectedWalletType = null;
        currentSessionKey = null;

        localStorage.clear();

        if (walletButtonDesktop) walletButtonDesktop.textContent = "Connect Wallet";
        if (walletButtonMobile) walletButtonMobile.textContent = "Connect Wallet";
        setArrow(false);
    }
}

async function tryReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return handleWalletDisconnect();

    reconnectAttempts++;
    const savedType = localStorage.getItem("connectedWalletType") as WalletType;
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");
    if (!savedType || !savedAddress || !savedSessionKey) return handleWalletDisconnect();

    try {
        if (!(await validateServerSession(savedAddress, savedSessionKey))) return handleWalletDisconnect();
        if (!isWalletInstalled(savedType)) return handleWalletDisconnect();

        const adapter = solanaAdapters[savedType];
        await adapter.connect({ onlyIfTrusted: false });

        if (adapter.connected && adapter.publicKey?.toBase58() === savedAddress) {
            connectedWalletType = savedType;
            currentSessionKey = savedSessionKey;
            updateWalletButton(savedAddress);
            reconnectAttempts = 0;
        }
    } catch {
        await handleWalletDisconnect();
    }
}

/* -------------------------- UI Логика -------------------------- */

function disconnectWallet() { handleWalletDisconnect(); }
function openModal() { walletModal?.classList.replace("hidden", "flex"); }
function closeModal() { walletModal?.classList.replace("flex", "hidden"); }

/* --------------------- Автоподключение --------------------- */

window.addEventListener("load", async () => {
    document.querySelectorAll<HTMLButtonElement>("#walletModal button[data-wallet]").forEach(btn => {
        const walletType = btn.getAttribute("data-wallet") as WalletType;
        const statusSpan = btn.querySelector<HTMLSpanElement>(".wallet-status");
        if (!statusSpan) return;
        if (isWalletInstalled(walletType)) {
            statusSpan.textContent = "Installed";
            statusSpan.className = "wallet-status bg-green-600/20 text-green-400 border border-green-600/30";
        } else {
            statusSpan.style.display = "none";
        }
    });

    await new Promise(r => setTimeout(r, 500));
    const savedType = localStorage.getItem("connectedWalletType") as WalletType;
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");
    if (!savedType || !savedAddress || !savedSessionKey) return;

    try {
        if (!isWalletInstalled(savedType)) return handleWalletDisconnect();
        if (!(await validateServerSession(savedAddress, savedSessionKey))) return handleWalletDisconnect();

        const adapter = solanaAdapters[savedType];
        setupWalletEventListeners(adapter, savedType);
        await adapter.connect({ onlyIfTrusted: true });

        if (adapter.connected && adapter.publicKey?.toBase58() === savedAddress) {
            connectedWalletType = savedType;
            currentSessionKey = savedSessionKey;
            updateWalletButton(savedAddress);
        }
    } catch {
        await handleWalletDisconnect();
    }
});

/* ------------------------- Обработчики ------------------------- */

walletButtonMobile?.addEventListener("click", () => !connectedWalletType && openModal());
walletModalClose?.addEventListener("click", closeModal);

walletListButtons.forEach(btn => {
    btn.addEventListener("click", async e => {
        const walletType = (e.currentTarget as HTMLButtonElement).getAttribute("data-wallet") as WalletType;
        if (!walletType) return;
        if (!isWalletInstalled(walletType)) return alert(`${walletType} wallet is not installed.`);
        await connectWallet(walletType);
    });
});

/* ------------------- Dropdown логика ------------------- */

if (walletButtonDesktop) {
    walletDropdown = document.createElement("div");
    walletDropdown.id = "walletDropdown";
    walletDropdown.className = "absolute bg-crypto-card border border-crypto-border rounded-lg w-44 hidden shadow-lg z-50";

    walletDropdown.innerHTML = `
        <button id="logoutButton" class="w-full text-left px-4 py-2 text-red-500 font-medium hover:bg-crypto-border flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path d="M17 16l4-4m0 0l-4-4m4 4H7"/>
            </svg>
            Logout
        </button>
    `;
    document.body.appendChild(walletDropdown);

    const positionDropdown = () => {
        if (!walletDropdown || !walletButtonDesktop) return;
        const rect = walletButtonDesktop.getBoundingClientRect();
        walletDropdown.style.top = rect.bottom + window.scrollY + "px";
        walletDropdown.style.left = rect.left + window.scrollX + "px";
    };

    const showDropdown = () => {
        if (!walletDropdown) return;
        positionDropdown();
        walletDropdown.classList.remove("hidden");
        setArrow(true);
    };

    const hideDropdown = () => {
        if (!walletDropdown) return;
        walletDropdown.classList.add("hidden");
        setArrow(false);
    };

    const logoutBtn = walletDropdown.querySelector<HTMLButtonElement>("#logoutButton");
    logoutBtn?.addEventListener("click", () => { disconnectWallet(); hideDropdown(); });

    walletButtonDesktop.addEventListener("mouseenter", showDropdown);
    walletButtonDesktop.addEventListener("mouseleave", hideDropdown);
    walletDropdown.addEventListener("mouseenter", showDropdown);
    walletDropdown.addEventListener("mouseleave", hideDropdown);

    walletButtonDesktop.addEventListener("click", () => !connectedWalletType && openModal());
}

/* ------------------- Прочие обработчики ------------------- */

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !connectedWalletType) return;
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");
    if (savedAddress && savedSessionKey && !isValidatingSession) {
        validateServerSession(savedAddress, savedSessionKey).then(isValid => {
            if (!isValid) handleWalletDisconnect();
        });
    }
});
