// src/typescript/ConnectWallet.ts - PURE REOWN VANILLA JS
import { modal } from './ReownConfig';

const SERVER_URL = "https://zapzap666.xyz";

// UI элементы
const walletButtonDesktop = document.getElementById("walletButtonDesktop") as HTMLButtonElement;
const walletButtonMobile = document.getElementById("walletButtonMobile") as HTMLButtonElement;

// Состояние
let currentWalletAddress: string | null = null;
let currentSessionKey: string | null = null;
let arrowIcon: SVGElement | null = null;
let walletDropdown: HTMLDivElement | null = null;

/* ----------------------------- Утилиты ----------------------------- */

function shortenAddress(addr: string): string {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function updateWalletButton(address: string): void {
    const shortAddr = shortenAddress(address);

    if (walletButtonDesktop) {
        walletButtonDesktop.innerHTML = `
            ${shortAddr}
            <svg id="walletArrow" class="w-5 h-5 ml-2 transition-transform duration-200" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
                <path d="M6 9l6 6 6-6"/>
            </svg>
        `;
    }

    if (walletButtonMobile) {
        walletButtonMobile.textContent = `${shortAddr} ▼`;
    }
}

function resetWalletButton(): void {
    if (walletButtonDesktop) {
        walletButtonDesktop.textContent = "Connect Wallet";
    }
    if (walletButtonMobile) {
        walletButtonMobile.textContent = "Connect Wallet";
    }
    setArrow(false);
}

function setArrow(up: boolean): void {
    if (arrowIcon) {
        arrowIcon.style.transform = up ? "rotate(180deg)" : "rotate(0deg)";
    }
}

/* ------------------------- Работа с сервером ------------------------- */

async function loginToServer(walletAddress: string): Promise<string | null> {
    try {
        console.log('🔐 Logging in to server:', walletAddress);

        const res = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ walletAddress })
        });

        if (!res.ok) {
            console.error('❌ Server login failed:', res.status);
            return null;
        }

        const data = await res.json();
        console.log('✅ Login successful');
        return data.success ? data.sessionKey : null;

    } catch (error) {
        console.error('❌ Login error:', error);
        return null;
    }
}

async function validateServerSession(walletAddress: string, sessionKey: string): Promise<boolean> {
    try {
        const res = await fetch(`${SERVER_URL}/api/auth/validate`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ walletAddress, sessionKey })
        });

        if (!res.ok) return false;

        const data = await res.json();
        return !!data.success;

    } catch (error) {
        console.error('❌ Validate error:', error);
        return false;
    }
}

async function logoutFromServer(walletAddress: string): Promise<void> {
    try {
        await fetch(`${SERVER_URL}/api/auth/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ walletAddress })
        });
        console.log('✅ Logged out from server');
    } catch (error) {
        console.error('❌ Logout error:', error);
    }
}

/* -------------------------- Работа с Reown Modal -------------------------- */

async function openReownModal(): Promise<void> {
    try {
        console.log('🔌 Opening Reown modal...');

        // Открываем модал Reown - ОН САМ покажет все доступные кошельки!
        await modal.open();

        console.log('✅ Modal opened');

    } catch (error) {
        console.error('❌ Failed to open modal:', error);
        alert('Failed to open wallet connection');
    }
}

async function onWalletConnected(address: string): Promise<void> {
    console.log('✅ Wallet connected:', address);

    try {
        // Логинимся на бэкенд
        const sessionKey = await loginToServer(address);

        if (!sessionKey) {
            console.error('❌ Server authentication failed');
            await modal.disconnect();
            alert('Failed to authenticate with server');
            return;
        }

        // Сохраняем состояние
        currentWalletAddress = address;
        currentSessionKey = sessionKey;

        localStorage.setItem("connectedWalletAddress", address);
        localStorage.setItem("sessionKey", sessionKey);

        // Обновляем UI
        updateWalletButton(address);

        console.log('✅ Full connection successful');

    } catch (error) {
        console.error('❌ Connection error:', error);
        await modal.disconnect();
        alert('Failed to connect wallet');
    }
}

async function handleWalletDisconnect(): Promise<void> {
    console.log('👋 Disconnecting wallet...');

    if (currentWalletAddress) {
        await logoutFromServer(currentWalletAddress);
    }

    currentWalletAddress = null;
    currentSessionKey = null;

    localStorage.clear();
    resetWalletButton();
}

/* ------------------- Подписка на события Reown ------------------- */

function setupReownListeners(): void {
    console.log('🎧 Setting up Reown listeners...');

    // Подписываемся на изменения состояния модала
    modal.subscribeState((state) => {
        console.log('🔔 Modal state changed:', state);
    });

    // Подписываемся на изменения аккаунта
    modal.subscribeAccount((account) => {
        console.log('👛 Account changed:', account);

        if (account && account.address) {
            const address = account.address;

            // Если это новый кошелек
            if (address !== currentWalletAddress) {
                onWalletConnected(address);
            }
        } else {
            // Кошелек отключен
            if (currentWalletAddress) {
                handleWalletDisconnect();
            }
        }
    });
}

/* --------------------- Автоподключение --------------------- */

async function autoConnect(): Promise<void> {
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");

    if (!savedAddress || !savedSessionKey) {
        console.log('ℹ️ No saved session found');
        return;
    }

    console.log('🔄 Attempting auto-connect...');

    try {
        // Проверяем валидность сессии на сервере
        const isValid = await validateServerSession(savedAddress, savedSessionKey);

        if (!isValid) {
            console.log('❌ Saved session is invalid');
            localStorage.clear();
            return;
        }

        // Проверяем текущее состояние Reown
        const account = modal.getAccount();

        if (account && account.address === savedAddress) {
            currentWalletAddress = savedAddress;
            currentSessionKey = savedSessionKey;
            updateWalletButton(savedAddress);
            console.log('✅ Auto-connected successfully');
        } else {
            console.log('⚠️ Reown not connected, clearing session');
            localStorage.clear();
        }

    } catch (error) {
        console.error('❌ Auto-connect failed:', error);
        localStorage.clear();
    }
}

/* ------------------------- UI: Dropdown ------------------------- */

function setupDropdown(): void {
    if (!walletButtonDesktop) return;

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

    const positionDropdown = (): void => {
        if (!walletDropdown || !walletButtonDesktop) return;
        const rect = walletButtonDesktop.getBoundingClientRect();
        walletDropdown.style.top = `${rect.bottom + window.scrollY}px`;
        walletDropdown.style.left = `${rect.left + window.scrollX}px`;
    };

    const showDropdown = (): void => {
        if (!currentWalletAddress || !walletDropdown) return;
        positionDropdown();
        walletDropdown.classList.remove("hidden");
        setArrow(true);
    };

    const hideDropdown = (): void => {
        if (!walletDropdown) return;
        walletDropdown.classList.add("hidden");
        setArrow(false);
    };

    const logoutBtn = walletDropdown.querySelector<HTMLButtonElement>("#logoutButton");
    logoutBtn?.addEventListener("click", async () => {
        await modal.disconnect();
        hideDropdown();
    });

    walletButtonDesktop.addEventListener("mouseenter", showDropdown);
    walletButtonDesktop.addEventListener("mouseleave", hideDropdown);
    walletDropdown.addEventListener("mouseenter", showDropdown);
    walletDropdown.addEventListener("mouseleave", hideDropdown);
}

/* ------------------- Обработчики кнопок ------------------- */

function setupEventListeners(): void {
    console.log('🎯 Setting up button listeners...');

    walletButtonDesktop?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('🖱️ Desktop button clicked');

        if (!currentWalletAddress) {
            await openReownModal();
        }
    });

    walletButtonMobile?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('🖱️ Mobile button clicked');

        if (!currentWalletAddress) {
            await openReownModal();
        }
    });

    document.addEventListener("visibilitychange", async () => {
        if (document.visibilityState !== "visible" || !currentWalletAddress) return;

        const savedAddress = localStorage.getItem("connectedWalletAddress");
        const savedSessionKey = localStorage.getItem("sessionKey");

        if (savedAddress && savedSessionKey) {
            const isValid = await validateServerSession(savedAddress, savedSessionKey);
            if (!isValid) {
                await modal.disconnect();
            }
        }
    });
}

/* ------------------- Инициализация ------------------- */

window.addEventListener("load", async () => {
    console.log('🚀 Initializing Reown wallet system...');

    // Задержка для полной инициализации Reown
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Настройка слушателей
    setupReownListeners();
    setupDropdown();
    setupEventListeners();

    // Попытка автоподключения
    await autoConnect();

    console.log('✅ Wallet system ready');
});