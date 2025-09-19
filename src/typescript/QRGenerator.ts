// src/typescript/QRGenerator.ts
class QRGenerator {
    private static instance: QRGenerator;
    private qrOptions = {
        width: 300,
        height: 300,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M' as 'L' | 'M' | 'Q' | 'H'
    };

    static getInstance(): QRGenerator {
        return this.instance ??= new QRGenerator();
    }

    /**
     * Generate QR code with full CryptoNow URL for scanning
     */
    async generateQRForScan(qrUniqueId: string, canvasId: string = 'qrCanvas'): Promise<void> {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) {
            console.error('QR Canvas element not found');
            return;
        }

        if (typeof (window as any).QRCode === 'undefined') {
            console.error('❌ QRCode library not loaded');
            this.showQRError(canvas, 'QRCode library not loaded');
            return;
        }

        try {
            const qrUrl = `https://zapzap666.xyz/?qr=${qrUniqueId}`;

            // Create temporary container for QRCodeJS
            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            document.body.appendChild(tempDiv);

            // Generate QR with QRCodeJS
            const QRCodeLib = (window as any).QRCode;
            new QRCodeLib(tempDiv, {
                text: qrUrl,
                width: 300,
                height: 300,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCodeLib.CorrectLevel.M
            });

            // Copy to canvas
            setTimeout(() => {
                const qrImg = tempDiv.querySelector('img') as HTMLImageElement;
                if (qrImg) {
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        canvas.width = 300;
                        canvas.height = 300;
                        qrImg.onload = () => {
                            ctx.drawImage(qrImg, 0, 0, 300, 300);
                            tempDiv.remove();
                        };
                        if (qrImg.complete) qrImg.onload(null as any);
                    }
                }
            }, 100);

            console.log('✅ QR generated for scan:', qrUniqueId);
            this.updateQRInfo(qrUniqueId, qrUrl);

        } catch (error) {
            console.error('❌ QR generation failed:', error);
            this.showQRError(canvas, 'Failed to generate QR code');
        }
    }

    /**
     * Generate QR with custom styling
     */
    async generateStyledQR(qrUniqueId: string, canvasId: string, options: Partial<typeof this.qrOptions>): Promise<void> {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return;

        const mergedOptions = { ...this.qrOptions, ...options };
        const qrUrl = `https://zapzap666.xyz/?qr=${qrUniqueId}`;

        try {
            // @ts-ignore
            await QRCode.toCanvas(canvas, qrUrl, mergedOptions);
            this.updateQRInfo(qrUniqueId, qrUrl);
        } catch (error) {
            console.error('❌ Styled QR generation failed:', error);
            this.showQRError(canvas, 'Failed to generate styled QR');
        }
    }

    /**
     * Download QR as PNG
     */
    downloadQR(canvasId: string = 'qrCanvas', filename?: string): void {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return;

        try {
            const link = document.createElement('a');
            link.download = filename || `cryptonow-qr-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('✅ QR downloaded:', link.download);
        } catch (error) {
            console.error('❌ QR download failed:', error);
            alert('Download failed. Please try again.');
        }
    }

    /**
     * Get QR as base64 data URL
     */
    getQRDataURL(canvasId: string = 'qrCanvas'): string | null {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) return null;

        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch (error) {
            console.error('❌ Failed to get QR data URL:', error);
            return null;
        }
    }

    /**
     * Copy QR URL to clipboard
     */
    async copyQRUrl(): Promise<void> {
        const qrCodeUrlEl = document.getElementById('qrCodeUrl');
        const url = qrCodeUrlEl?.textContent;

        if (!url || url === 'Not available yet') {
            alert('QR URL not available');
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            this.showCopyNotification('QR URL copied to clipboard!');
        } catch (error) {
            console.error('❌ Copy failed:', error);
            this.fallbackCopy(url);
        }
    }

    /**
     * Update QR information in the UI
     */
    private updateQRInfo(qrUniqueId: string, qrUrl: string): void {
        const qrUniqueIdEl = document.getElementById('qrUniqueId');
        const qrCodeUrlEl = document.getElementById('qrCodeUrl');

        if (qrUniqueIdEl) qrUniqueIdEl.textContent = qrUniqueId;
        if (qrCodeUrlEl) {
            qrCodeUrlEl.textContent = qrUrl;
            qrCodeUrlEl.className = 'text-white text-sm break-all';
        }
    }

    /**
     * Show error on canvas
     */
    private showQRError(canvas: HTMLCanvasElement, message: string): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = 300;
        canvas.height = 300;

        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, 300, 300);

        ctx.fillStyle = '#ef4444';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(message, 150, 150);
    }

    private showCopyNotification(message: string): void {
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
        notification.textContent = message;

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
            this.showCopyNotification('QR URL copied to clipboard!');
        } catch (error) {
            alert('Copy failed. Please copy manually: ' + text);
        }

        document.body.removeChild(textarea);
    }
}

export default QRGenerator;