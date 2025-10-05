import { modal } from './ReownConfig';

const SERVER_URL = "https://zapzap666.xyz";

const walletButtonDesktop = document.getElementById("walletButtonDesktop") as HTMLButtonElement;
const walletButtonMobile = document.getElementById("walletButtonMobile") as HTMLButtonElement;

let currentWalletAddress: string | null = null;
let currentSessionKey: string | null = null;
let arrowIcon: SVGElement | null = null;
let walletDropdown: HTMLDivElement | null = null;

// ЗАЩИТА ОТ ДУБЛИРОВАНИЯ ЗАПРОСОВ
let isConnecting = false;
let isDisconnecting = false;
let loginPromise: Promise<string | null> | null = null; // Храним promise для переиспользования

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

async function loginToServer(walletAddress: string): Promise<string | null> {
    // УЛУЧШЕННАЯ ЛОГИКА: если логин уже идет, ждем его завершения
    if (isConnecting && loginPromise) {
        console.log('Login already in progress, waiting for result...');
        return await loginPromise;
    }

    isConnecting = true;

    // Создаем promise и сохраняем для переиспользования
    loginPromise = (async () => {
        try {
            console.log('Logging in to server:', walletAddress);

            const res = await fetch(`${SERVER_URL}/api/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({ walletAddress })
            });

            if (!res.ok) {
                console.error('Server login failed:', res.status);
                return null;
            }

            const data = await res.json();
            console.log('Login successful:', data);

            if (data.success && data.sessionKey) {
                return data.sessionKey;
            } else {
                console.error('Invalid response structure:', data);
                return null;
            }

        } catch (error) {
            console.error('Login error:', error);
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

    } catch (error) {
        console.error('Validate error:', error);
        return false;
    }
}

async function logoutFromServer(walletAddress: string): Promise<void> {
    // ЗАЩИТА: предотвращение параллельных логаутов
    if (isDisconnecting) {
        console.log('Logout already in progress, skipping');
        return;
    }

    isDisconnecting = true;

    try {
        await fetch(`${SERVER_URL}/api/auth/logout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ walletAddress })
        });
        console.log('Logged out from server');
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        isDisconnecting = false;
    }
}

async function openReownModal(): Promise<void> {
    try {
        console.log('Opening Reown modal...');
        await modal.open();
        console.log('Modal opened');
    } catch (error) {
        console.error('Failed to open modal:', error);
        alert('Failed to open wallet connection');
    }
}

async function onWalletConnected(address: string): Promise<void> {
    // ЗАЩИТА: пропускаем если уже подключен к этому кошельку
    if (currentWalletAddress === address) {
        console.log('Already connected to this wallet, skipping');
        return;
    }

    console.log('Wallet connected, authenticating...', address);

    try {
        // Ждем логин (если несколько событий, все получат один и тот же результат)
        const sessionKey = await loginToServer(address);

        if (!sessionKey) {
            console.error('Authentication failed - no session key received');
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

        console.log('Successfully authenticated and connected');

    } catch (error) {
        console.error('Connection error:', error);
        await modal.disconnect();
        alert('Failed to connect wallet');
    }
}

async function handleWalletDisconnect(): Promise<void> {
    console.log('Disconnecting wallet...');

    if (currentWalletAddress) {
        await logoutFromServer(currentWalletAddress);
    }

    currentWalletAddress = null;
    currentSessionKey = null;

    localStorage.clear();
    resetWalletButton();
}

// ПЕРЕМЕННАЯ ДЛЯ ОТСЛЕЖИВАНИЯ ПОДПИСКИ
let isSubscribed = false;

function setupReownListeners(): void {
    // ЗАЩИТА: подписываемся только один раз
    if (isSubscribed) {
        console.log('Reown listeners already set up, skipping');
        return;
    }

    console.log('Setting up Reown listeners...');

    modal.subscribeState((state) => {
        console.log('Modal state changed:', state);
    });

    modal.subscribeAccount((account) => {
        console.log('Account changed:', account);

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

    if (!savedAddress || !savedSessionKey) {
        console.log('No saved session found');
        return;
    }

    console.log('Attempting auto-connect...');

    try {
        const isValid = await validateServerSession(savedAddress, savedSessionKey);

        if (!isValid) {
            console.log('Saved session is invalid');
            localStorage.clear();
            return;
        }

        const account = modal.getAccount();

        if (account && account.address === savedAddress) {
            currentWalletAddress = savedAddress;
            currentSessionKey = savedSessionKey;
            updateWalletButton(savedAddress);
            console.log('Auto-connected successfully');
        } else {
            console.log('Reown not connected, clearing session');
            localStorage.clear();
        }

    } catch (error) {
        console.error('Auto-connect failed:', error);
        localStorage.clear();
    }
}

function setupDropdown(): void {
    if (!walletButtonDesktop) return;

    walletDropdown = document.createElement("div");
    walletDropdown.id = "walletDropdown";
    walletDropdown.className = "absolute bg-crypto-card border-2 border-crypto-border rounded-lg w-44 hidden shadow-lg z-50";

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

function setupEventListeners(): void {
    console.log('Setting up button listeners...');

    walletButtonDesktop?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('Desktop button clicked');

        if (!currentWalletAddress) {
            await openReownModal();
        }
    });

    walletButtonMobile?.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('Mobile button clicked');

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

window.addEventListener("load", async () => {
    console.log('Initializing Reown wallet system...');

    await new Promise(resolve => setTimeout(resolve, 1000));

    setupReownListeners();
    setupDropdown();
    setupEventListeners();

    await autoConnect();

    console.log('Wallet system ready');
});
