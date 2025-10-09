import { modal } from './ReownConfig';
import { CONFIG } from './config';
import { WalletUI } from './WalletUI';

const SERVER_URL = CONFIG.SERVER_URL;

const walletButtonDesktop = document.getElementById("walletButtonDesktop") as HTMLButtonElement;
const walletButtonMobile = document.getElementById("walletButtonMobile") as HTMLButtonElement;

let currentWalletAddress: string | null = null;
let currentSessionKey: string | null = null;
let arrowIcon: SVGElement | null = null;
let walletDropdown: HTMLDivElement | null = null;

let isConnecting = false;
let isDisconnecting = false;
let loginPromise: Promise<string | null> | null = null;

const updateWalletButton = (address: string): void => {
    if (walletButtonDesktop) {
        WalletUI.updateButton(walletButtonDesktop, address, true);
        arrowIcon = document.getElementById("walletArrow") as SVGElement;
    }
    if (walletButtonMobile) {
        WalletUI.updateButton(walletButtonMobile, address, false);
    }
};

const resetWalletButton = (): void => {
    if (walletButtonDesktop) WalletUI.resetButton(walletButtonDesktop);
    if (walletButtonMobile) WalletUI.resetButton(walletButtonMobile);
    WalletUI.setArrow(arrowIcon, false);
};

async function loginToServer(walletAddress: string): Promise<string | null> {
    // УЛУЧШЕННАЯ ЛОГИКА: если логин уже идет, ждем его завершения
    if (isConnecting && loginPromise) {
        return await loginPromise;
    }

    isConnecting = true;

    loginPromise = (async () => {
        try {

            const res = await fetch(`${SERVER_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ walletAddress })
            });

            if (!res.ok) return null;

            const data = await res.json();
            return (data.success && data.sessionKey) ? data.sessionKey : null;

        } catch {
            return null;
        } finally {
            isConnecting = false;
            loginPromise = null;
        }
    })();

    return await loginPromise;
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
    } catch {
        return false;
    }
}

async function logoutFromServer(walletAddress: string): Promise<void> {
    if (isDisconnecting) return;

    isDisconnecting = true;

    try {
        await fetch(`${SERVER_URL}/api/auth/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ walletAddress })
        });
    } finally {
        isDisconnecting = false;
    }
}

async function openReownModal(): Promise<void> {
    try {
        await modal.open();
    } catch {
        alert('Failed to open wallet connection');
    }
}

async function onWalletConnected(address: string): Promise<void> {
    if (currentWalletAddress === address) return;

    try {
        const sessionKey = await loginToServer(address);

        if (!sessionKey) {
            await modal.disconnect();
            alert('Failed to authenticate with server');
            return;
        }

        // Успешная аутентификация
        currentWalletAddress = address;
        currentSessionKey = sessionKey;

        localStorage.setItem("connectedWalletAddress", address);
        localStorage.setItem("sessionKey", sessionKey);

        updateWalletButton(address);
    } catch {
        await modal.disconnect();
        alert('Failed to connect wallet');
    }
}

async function handleWalletDisconnect(): Promise<void> {
    if (currentWalletAddress) await logoutFromServer(currentWalletAddress);

    currentWalletAddress = null;
    currentSessionKey = null;

    localStorage.clear();
    resetWalletButton();
}

// ПЕРЕМЕННАЯ ДЛЯ ОТСЛЕЖИВАНИЯ ПОДПИСКИ
let isSubscribed = false;

function setupReownListeners(): void {
    if (isSubscribed) return;

    modal.subscribeState(() => {});

    modal.subscribeAccount((account) => {

        if (account && account.address) {
            const address = account.address;

            if (address !== currentWalletAddress) {
                onWalletConnected(address);
            }
        } else {
            if (currentWalletAddress) {
                handleWalletDisconnect();
            }
        }
    });

    isSubscribed = true;
}

async function autoConnect(): Promise<void> {
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");

    if (!savedAddress || !savedSessionKey) return;

    try {
        const isValid = await validateServerSession(savedAddress, savedSessionKey);

        if (!isValid) {
            localStorage.clear();
            return;
        }

        const account = modal.getAccount();

        if (account && account.address === savedAddress) {
            currentWalletAddress = savedAddress;
            currentSessionKey = savedSessionKey;
            updateWalletButton(savedAddress);
        } else {
            localStorage.clear();
        }
    } catch {
        localStorage.clear();
    }
}

function setupDropdown(): void {
    if (!walletButtonDesktop) return;

    walletDropdown = WalletUI.createDropdown();
    walletDropdown.id = "walletDropdown";
    document.body.appendChild(walletDropdown);

    const positionDropdown = (): void => {
        if (!walletDropdown || !walletButtonDesktop) return;
        WalletUI.positionDropdown(walletDropdown, walletButtonDesktop);
    };

    const showDropdown = (): void => {
        if (!currentWalletAddress || !walletDropdown) return;
        positionDropdown();
        walletDropdown.classList.remove("hidden");
        WalletUI.setArrow(arrowIcon, true);
    };

    const hideDropdown = (): void => {
        if (!walletDropdown) return;
        walletDropdown.classList.add("hidden");
        WalletUI.setArrow(arrowIcon, false);
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

function setupEventListeners(): void {
    walletButtonDesktop?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentWalletAddress) await openReownModal();
    });

    walletButtonMobile?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!currentWalletAddress) await openReownModal();
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

window.addEventListener("load", async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));

    setupReownListeners();
    setupDropdown();
    setupEventListeners();
    await autoConnect();
});
