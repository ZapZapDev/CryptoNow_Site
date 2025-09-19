// TransactionSetup.ts - Main Transaction Setup
import { Buffer } from "buffer";
window.Buffer = Buffer;
(globalThis as any).Buffer = Buffer;

import { generateQR } from './QRPayment';

const SERVER_URL = 'https://zapzap666.xyz:8080';

async function testServerConnection(): Promise<void> {
    try {
        const response = await fetch(`${SERVER_URL}/api/test`);
        if (response.ok) {
            const data = await response.json();
            console.log('Server test successful:', data);
        } else {
            console.error('Server test failed:', response.status);
        }
    } catch (error) {
        console.error('Server connection test failed:', error);
    }
}

function showError(message: string): void {
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;

    paymentInfo.innerHTML = `
        <div class="text-red-400 text-sm text-center">
            ${message}
        </div>
    `;
    qrContainer.style.display = "flex";
}

window.addEventListener("DOMContentLoaded", () => {
    testServerConnection();

    // Network dropdown
    const dropdownBtnNetwork = document.getElementById("dropdownBtnNetwork") as HTMLButtonElement;
    const dropdownContentNetwork = document.getElementById("dropdownContentNetwork") as HTMLDivElement;
    const dropdownArrowNetwork = document.getElementById("dropdownArrowNetwork") as HTMLSpanElement;

    // Coin dropdown
    const dropdownBtnCoin = document.getElementById("dropdownBtnCoin") as HTMLButtonElement;
    const dropdownContentCoin = document.getElementById("dropdownContentCoin") as HTMLDivElement;
    const dropdownArrowCoin = document.getElementById("dropdownArrowCoin") as HTMLSpanElement;

    // Other elements
    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;
    const amountInput = document.getElementById("amountInput") as HTMLInputElement;
    const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;

    let selectedNetwork: string | null = null;
    let selectedCoin: string | null = null;

    qrContainer.style.display = "none";

    if (!dropdownBtnNetwork || !dropdownContentNetwork || !dropdownArrowNetwork) {
        console.error('Critical network dropdown elements missing');
        return;
    }
    if (!dropdownBtnCoin || !dropdownContentCoin || !dropdownArrowCoin) {
        console.error('Critical coin dropdown elements missing');
        return;
    }

    // Universal dropdown setup
    function setupDropdown(
        btn: HTMLButtonElement,
        content: HTMLDivElement,
        arrow: HTMLSpanElement,
        callback: (item: HTMLDivElement) => void
    ) {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            // Закрыть все дропдауны
            document.querySelectorAll(".dropdown-content").forEach(el => el.classList.add("hidden"));
            document.querySelectorAll(".dropdown span").forEach(el => el.classList.remove("dropdown-arrow-rotate"));

            // Если этот уже был открыт — закрыть
            if (!content.classList.contains("hidden")) {
                content.classList.add("hidden");
                arrow.classList.remove("dropdown-arrow-rotate");
            } else {
                content.classList.remove("hidden");
                arrow.classList.add("dropdown-arrow-rotate");
            }
        });

        const items = content.querySelectorAll(".dropdown-item") as NodeListOf<HTMLDivElement>;
        items.forEach(item => {
            item.addEventListener("click", () => {
                const selectedText = item.textContent?.trim() || "";
                btn.childNodes[0].textContent = selectedText;
                content.classList.add("hidden");
                arrow.classList.remove("dropdown-arrow-rotate");
                callback(item);
            });
        });

        // Закрывать при клике вне
        window.addEventListener("click", (e) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown')) {
                content.classList.add("hidden");
                arrow.classList.remove("dropdown-arrow-rotate");
            }
        });
    }

    // Network dropdown
    setupDropdown(dropdownBtnNetwork, dropdownContentNetwork, dropdownArrowNetwork, (item) => {
        selectedNetwork = item.getAttribute("data-network");
        console.log("Selected Network:", selectedNetwork);
    });

    // Coin dropdown
    setupDropdown(dropdownBtnCoin, dropdownContentCoin, dropdownArrowCoin, (item) => {
        selectedCoin = item.getAttribute("data-coin");
        console.log("Selected Coin:", selectedCoin);

        amountSection.style.display = "block";
        amountSection.classList.remove("hidden");
        amountInput.focus();
    });

    // Generate QR
    generateBtn.addEventListener("click", async () => {
        const amountValue = amountInput.value.trim();

        if (!selectedNetwork) {
            showError("Please choose a network");
            return;
        }
        if (!selectedCoin) {
            showError("Please choose a coin");
            return;
        }
        if (!amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
            showError("Please enter a valid amount");
            return;
        }

        generateBtn.disabled = true;
        generateBtn.textContent = "Creating...";

        try {
            await generateQR(amountValue, selectedCoin);
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = "Generate QR";
        }
    });

    // Enter key submit
    amountInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter" && !generateBtn.disabled) {
            generateBtn.click();
        }
    });
});
