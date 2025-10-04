// QRPayment.ts
const SERVER_URL = 'https://zapzap666.xyz';

export async function generateQR(amountValue: string, coin: string): Promise<void> {
    console.log('Starting QR generation:', { amountValue, coin });

    const qrContainer = document.getElementById("qrcode") as HTMLDivElement;
    const paymentInfo = document.getElementById("paymentInfo") as HTMLDivElement;
    const publicKeyString = localStorage.getItem("walletAddress");

    console.log('Wallet address from localStorage:', publicKeyString);

    if (!publicKeyString || !amountValue || isNaN(Number(amountValue)) || Number(amountValue) <= 0) {
        console.error('Validation failed:', { publicKeyString: !!publicKeyString, amountValue, isValid: !isNaN(Number(amountValue)) && Number(amountValue) > 0 });
        showError("Invalid wallet address or amount");
        return;
    }

    showLoader(qrContainer, paymentInfo);

    try {
        const response = await fetch(`${SERVER_URL}/api/payment/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: publicKeyString,
                amount: parseFloat(amountValue),
                token: coin
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success && data.data?.qr_code) {
            const payment = data.data;

            paymentInfo.innerHTML = `
                <div class="text-center">
                    <div class="text-22 font-bold text-white mb-1 leading-tight">${amountValue} ${coin}</div>
                </div>
            `;

            const existingQR = qrContainer.querySelector('.qr-code-wrapper');
            if (existingQR) existingQR.remove();

            const qrCodeWrapper = document.createElement('div');
            qrCodeWrapper.className = 'qr-code-wrapper';

            const qrImage = document.createElement('img');
            qrImage.src = payment.qr_code;
            qrImage.alt = 'Payment QR Code';
            qrImage.style.maxWidth = '250px';
            qrImage.style.maxHeight = '250px';

            qrImage.onload = () => console.log('QR image loaded successfully');
            qrImage.onerror = () => {
                console.error('QR image failed to load');
                showError("QR code image failed to load");
            };

            qrCodeWrapper.appendChild(qrImage);
            qrContainer.appendChild(qrCodeWrapper);

            qrContainer.style.display = "flex";
            hideSelectors();
        } else {
            throw new Error('Invalid server response');
        }
    } catch (error: any) {
        console.error('QR generation failed:', error);
        showError(`Failed to generate QR code: ${error.message}`);
    }
}

function showLoader(qrContainer: HTMLDivElement, paymentInfo: HTMLDivElement): void {
    paymentInfo.innerHTML = `
        <div class="text-crypto-text-muted text-sm">
            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-crypto-text-muted mx-auto mb-2"></div>
            Creating payment...
        </div>
    `;
    qrContainer.style.display = "flex";
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

function hideSelectors(): void {
    const dropdown = document.querySelector(".dropdown") as HTMLDivElement;
    const coinSelector = document.getElementById("coinSelector") as HTMLDivElement;
    const amountSection = document.getElementById("amountSection") as HTMLDivElement;

    if (dropdown) dropdown.style.display = "none";
    if (coinSelector) coinSelector.style.display = "none";
    if (amountSection) amountSection.style.display = "none";
}