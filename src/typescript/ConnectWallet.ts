//ConnectWallet.ts - ИСПРАВЛЕННАЯ ВЕРСИЯ
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { GlowWalletAdapter } from "@solana/wallet-adapter-glow";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";

type WalletType = "phantom" | "solflare" | "glow" | "backpack";

const SERVER_URL = 'https://zapzap666.xyz';

const walletButtonDesktop = document.getElementById("walletButtonDesktop") as HTMLButtonElement;
const walletButtonMobile = document.getElementById("walletButtonMobile") as HTMLButtonElement;
const walletModal = document.getElementById("walletModal") as HTMLDivElement;
const walletModalClose = document.getElementById("walletModalClose") as HTMLButtonElement;
const walletListButtons = document.querySelectorAll<HTMLButtonElement>("#walletList button[data-wallet]");

const solanaAdapters: Record<WalletType, any> = {
    phantom: new PhantomWalletAdapter(),
    solflare: new SolflareWalletAdapter(),
    glow: new GlowWalletAdapter(),
    backpack: new BackpackWalletAdapter()
};

// Функция для проверки установлен ли кошелек
function isWalletInstalled(walletType: WalletType): boolean {
    switch(walletType) {
        case 'phantom':
            return !!(window as any).phantom?.solana;
        case 'solflare':
            return !!(window as any).solflare || !!(window as any).solana?.isSolflare;
        case 'glow':
            return !!(window as any).glow || !!(window as any).glowSolana;
        case 'backpack':
            return !!(window as any).backpack || !!(window as any).solana?.isBackpack;
        default:
            return false;
    }
}

let connectedWalletType: WalletType | null = null;
let arrowIcon: SVGElement | null = null;
let walletDropdown: HTMLDivElement | null = null;
let currentSessionKey: string | null = null;

// НОВОЕ: флаги для предотвращения повторных операций
let isConnecting = false;
let isValidatingSession = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

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
    if (walletButtonMobile) {
        walletButtonMobile.textContent = `${shortAddr} ▼`;
    }

    // Обновляем arrow icon после изменения innerHTML
    arrowIcon = document.getElementById("walletArrow") as SVGElement;
}

function setArrow(up: boolean) {
    if (!arrowIcon) return;
    arrowIcon.style.transform = up ? "rotate(180deg)" : "rotate(0deg)";
}

// ИСПРАВЛЕНО: Более надежная серверная аутентификация
async function loginToServer(walletAddress: string): Promise<string | null> {
    try {
        console.log('🔐 Logging in to server:', walletAddress.slice(0, 8) + '...');

        const response = await fetch(`${SERVER_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ walletAddress })
        });

        if (!response.ok) {
            console.error('❌ Server login failed - HTTP', response.status);
            return null;
        }

        const data = await response.json();

        if (data.success && data.sessionKey) {
            console.log('✅ Server login successful');
            return data.sessionKey;
        } else {
            console.error('❌ Server login failed:', data.error || 'No session key received');
            return null;
        }
    } catch (error) {
        console.error('❌ Server login error:', error);
        return null;
    }
}

// ИСПРАВЛЕНО: Более надежная валидация сессии
async function validateServerSession(walletAddress: string, sessionKey: string): Promise<boolean> {
    if (isValidatingSession) {
        console.log('⚠️ Validation already in progress, skipping');
        return true; // Не блокируем если уже валидируем
    }

    isValidatingSession = true;

    try {
        console.log('🔍 Validating server session');

        const response = await fetch(`${SERVER_URL}/api/auth/validate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ walletAddress, sessionKey })
        });

        if (!response.ok) {
            console.error('❌ Session validation failed - HTTP', response.status);
            return false;
        }

        const data = await response.json();
        console.log('📥 Validation response:', { success: data.success });

        return data.success;
    } catch (error) {
        console.error('❌ Session validation error:', error);
        return false;
    } finally {
        isValidatingSession = false;
    }
}

async function logoutFromServer(walletAddress: string) {
    try {
        await fetch(`${SERVER_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ walletAddress })
        });
        console.log('🚪 Server logout successful');
    } catch (error) {
        console.error('❌ Server logout error:', error);
    }
}

// ИСПРАВЛЕНО: Подключение кошелька с обработчиками событий
async function connectWallet(type: WalletType) {
    if (isConnecting) {
        console.log('⚠️ Connection already in progress');
        return;
    }

    isConnecting = true;

    try {
        const adapter = solanaAdapters[type];

        // ВАЖНО: Добавляем обработчики событий ДО подключения
        setupWalletEventListeners(adapter, type);

        // Подключаемся к кошельку
        await adapter.connect({ onlyIfTrusted: false });
        const publicKey = adapter.publicKey;

        if (publicKey) {
            const walletAddress = publicKey.toBase58();

            // Логинимся на сервер
            const sessionKey = await loginToServer(walletAddress);

            if (sessionKey) {
                connectedWalletType = type;
                currentSessionKey = sessionKey;

                // Сохраняем в localStorage
                localStorage.setItem("connectedWalletType", type);
                localStorage.setItem("connectedWalletAddress", walletAddress);
                localStorage.setItem("sessionKey", sessionKey);

                updateWalletButton(walletAddress);
                closeModal();
                reconnectAttempts = 0; // Сбрасываем счетчик попыток

                console.log('✅ Wallet connected and authenticated');
            } else {
                throw new Error('Failed to authenticate with server');
            }
        } else {
            throw new Error('Failed to get public key from wallet');
        }
    } catch (error) {
        console.error('❌ Connect wallet error:', error);
        alert('Failed to connect wallet: ' + (error as Error).message);

        // Очищаем состояние при ошибке
        await handleWalletDisconnect();
    } finally {
        isConnecting = false;
    }
}

// НОВОЕ: Настройка обработчиков событий кошелька
function setupWalletEventListeners(adapter: any, type: WalletType) {
    // Удаляем старые слушатели если есть
    adapter.removeAllListeners?.();

    adapter.on('connect', (publicKey: any) => {
        console.log(`✅ ${type} wallet connected:`, publicKey?.toBase58()?.slice(0, 8) + '...');
    });

    adapter.on('disconnect', () => {
        console.log(`🔌 ${type} wallet disconnected`);
        handleWalletDisconnect();
    });

    adapter.on('error', (error: any) => {
        console.error(`❌ ${type} wallet error:`, error);
        handleWalletDisconnect();
    });

    // Для некоторых кошельков
    if (adapter.on && typeof adapter.on === 'function') {
        adapter.on('accountChanged', (publicKey: any) => {
            console.log(`🔄 ${type} account changed:`, publicKey?.toBase58()?.slice(0, 8) + '...');
            // При смене аккаунта переподключаемся
            setTimeout(() => tryReconnect(), 1000);
        });
    }
}

// НОВОЕ: Обработка отключения кошелька
async function handleWalletDisconnect() {
    console.log('🔌 Handling wallet disconnect');

    if (connectedWalletType) {
        const adapter = solanaAdapters[connectedWalletType];
        const walletAddress = localStorage.getItem("connectedWalletAddress");

        // Логаут с сервера
        if (walletAddress) {
            await logoutFromServer(walletAddress);
        }

        // Очищаем локальное состояние
        connectedWalletType = null;
        currentSessionKey = null;

        localStorage.removeItem("connectedWalletType");
        localStorage.removeItem("connectedWalletAddress");
        localStorage.removeItem("sessionKey");

        // Обновляем UI
        if (walletButtonDesktop) walletButtonDesktop.textContent = "Connect Wallet";
        if (walletButtonMobile) walletButtonMobile.textContent = "Connect Wallet";
        setArrow(false);
        hideDropdown();
    }
}

// НОВОЕ: Попытка переподключения
async function tryReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.log('❌ Max reconnect attempts reached');
        await handleWalletDisconnect();
        return;
    }

    reconnectAttempts++;
    console.log(`🔄 Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);

    const savedType = localStorage.getItem("connectedWalletType") as WalletType;
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");

    if (savedType && savedAddress && savedSessionKey) {
        try {
            // Проверяем сессию на сервере
            const isValidSession = await validateServerSession(savedAddress, savedSessionKey);

            if (isValidSession) {
                const adapter = solanaAdapters[savedType];

                // Пытаемся подключиться только если кошелек доступен
                if (isWalletInstalled(savedType)) {
                    await adapter.connect({ onlyIfTrusted: false });

                    if (adapter.connected && adapter.publicKey) {
                        const currentAddress = adapter.publicKey.toBase58();

                        // Проверяем что адрес не изменился
                        if (currentAddress === savedAddress) {
                            connectedWalletType = savedType;
                            currentSessionKey = savedSessionKey;
                            updateWalletButton(currentAddress);
                            reconnectAttempts = 0;
                            console.log('✅ Reconnection successful');
                            return;
                        }
                    }
                }
            }
        } catch (error) {
            console.error('❌ Reconnection failed:', error);
        }
    }

    // Если переподключение не удалось
    await handleWalletDisconnect();
}

function disconnectWallet() {
    handleWalletDisconnect();
}

function openModal() {
    if (walletModal) {
        walletModal.classList.remove("hidden");
        walletModal.classList.add("flex");
    }
}

function closeModal() {
    if (walletModal) {
        walletModal.classList.add("hidden");
        walletModal.classList.remove("flex");
    }
}

// ИСПРАВЛЕНО: Проверка при загрузке и автоподключение
window.addEventListener("load", async () => {
    console.log('🚀 Page loaded, checking wallet connection...');

    // Проверка и установка статуса "Installed" для каждого кошелька
    document.querySelectorAll<HTMLButtonElement>("#walletModal button[data-wallet]").forEach(btn => {
        const walletType = btn.getAttribute("data-wallet") as WalletType;
        const statusSpan = btn.querySelector<HTMLSpanElement>(".wallet-status");

        if (statusSpan) {
            const isInstalled = isWalletInstalled(walletType);

            if (isInstalled) {
                statusSpan.textContent = "Installed";
                statusSpan.classList.remove("bg-crypto-border", "text-gray-300");
                statusSpan.classList.add("bg-green-600/20", "text-green-400", "border", "border-green-600/30");
            } else {
                statusSpan.textContent = "";
                statusSpan.style.display = "none";
            }
        }
    });

    // Автоподключение с задержкой для стабильности
    await new Promise(resolve => setTimeout(resolve, 500));

    const savedType = localStorage.getItem("connectedWalletType") as WalletType;
    const savedAddress = localStorage.getItem("connectedWalletAddress");
    const savedSessionKey = localStorage.getItem("sessionKey");

    if (savedType && savedAddress && savedSessionKey) {
        console.log('🔄 Attempting auto-reconnect...');

        try {
            // Сначала проверяем что кошелек установлен
            if (!isWalletInstalled(savedType)) {
                console.log('❌ Wallet not installed');
                await handleWalletDisconnect();
                return;
            }

            // Валидируем сессию на сервере
            const isValidSession = await validateServerSession(savedAddress, savedSessionKey);

            if (isValidSession) {
                const adapter = solanaAdapters[savedType];

                // Настраиваем обработчики событий
                setupWalletEventListeners(adapter, savedType);

                try {
                    // ИСПРАВЛЕНО: Сначала пробуем onlyIfTrusted: true
                    await adapter.connect({ onlyIfTrusted: true });

                    if (adapter.connected && adapter.publicKey) {
                        const currentAddress = adapter.publicKey.toBase58();

                        if (currentAddress === savedAddress) {
                            connectedWalletType = savedType;
                            currentSessionKey = savedSessionKey;
                            updateWalletButton(currentAddress);
                            console.log('✅ Auto-reconnect successful (trusted)');
                            return;
                        }
                    }
                } catch (trustedError) {
                    console.log('⚠️ Trusted connection failed, trying manual connection...');

                    // Если trusted не сработал, НЕ очищаем данные, а оставляем для ручного подключения
                    console.log('ℹ️ Wallet requires manual connection');
                    return;
                }
            } else {
                console.log('❌ Session invalid, clearing local storage');
                await handleWalletDisconnect();
            }
        } catch (error) {
            console.error('❌ Auto-reconnect error:', error);
            await handleWalletDisconnect();
        }
    }
});

// ИСПРАВЛЕНО: Обработчики событий
walletButtonMobile?.addEventListener("click", () => {
    if (!connectedWalletType) openModal();
});

walletModalClose?.addEventListener("click", closeModal);

walletListButtons.forEach(btn => {
    btn.addEventListener("click", async (e) => {
        const walletType = (e.currentTarget as HTMLButtonElement).getAttribute("data-wallet") as WalletType;
        if (!walletType) return;

        if (!isWalletInstalled(walletType)) {
            alert(`${walletType} wallet is not installed. Please install it first.`);
            return;
        }

        await connectWallet(walletType);
    });
});

// Dropdown logic (без изменений, но с проверками)
if (walletButtonDesktop) {
    walletDropdown = document.createElement("div");
    walletDropdown.id = "walletDropdown";
    walletDropdown.className =
        "absolute bg-crypto-card border border-crypto-border rounded-lg w-44 hidden shadow-lg z-50 overflow-hidden transition-all duration-200 opacity-0 pointer-events-none";

    walletDropdown.innerHTML = `
        <button id="logoutButton" class="w-full text-left px-4 py-2 text-red-500 font-medium hover:bg-crypto-border transition flex items-center gap-2">
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
        walletDropdown.classList.remove("hidden", "opacity-0", "pointer-events-none");
        setArrow(true);
    };

    const hideDropdown = () => {
        if (!walletDropdown) return;
        walletDropdown.classList.add("opacity-0", "pointer-events-none");
        setArrow(false);
        setTimeout(() => walletDropdown?.classList.add("hidden"), 200);
    };

    const logoutBtn = walletDropdown.querySelector<HTMLButtonElement>("#logoutButton");
    logoutBtn?.addEventListener("click", () => {
        disconnectWallet();
        hideDropdown();
    });

    // Hover/click логика
    let hoverTimer: number | null = null;
    const enter = () => {
        if (!connectedWalletType) return;
        if (hoverTimer) clearTimeout(hoverTimer);
        showDropdown();
    };
    const leave = () => {
        if (hoverTimer) clearTimeout(hoverTimer);
        hoverTimer = window.setTimeout(() => {
            if (!walletDropdown?.matches(":hover") && !walletButtonDesktop?.matches(":hover")) {
                hideDropdown();
            }
        }, 150);
    };

    walletButtonDesktop.addEventListener("mouseenter", enter);
    walletDropdown.addEventListener("mouseenter", enter);
    walletButtonDesktop.addEventListener("mouseleave", leave);
    walletDropdown.addEventListener("mouseleave", leave);

    walletButtonDesktop.addEventListener("click", () => {
        if (!connectedWalletType) openModal();
    });
}

// НОВОЕ: Глобальная обработка ошибок
window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('wallet')) {
        console.error('🔥 Wallet-related error detected:', event.error);
        // НЕ вызываем disconnect автоматически, только логируем
    }
});

// НОВОЕ: Обработка видимости страницы
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && connectedWalletType) {
        // Проверяем соединение когда страница становится видимой
        setTimeout(() => {
            const savedAddress = localStorage.getItem("connectedWalletAddress");
            const savedSessionKey = localStorage.getItem("sessionKey");

            if (savedAddress && savedSessionKey && !isValidatingSession) {
                validateServerSession(savedAddress, savedSessionKey).then(isValid => {
                    if (!isValid) {
                        console.log('⚠️ Session expired while page was hidden');
                        handleWalletDisconnect();
                    }
                });
            }
        }, 1000);
    }
});