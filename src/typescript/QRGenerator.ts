// src/typescript/QRGenerator.ts
class QRGenerator {
    private static instance: QRGenerator;
    private readonly size = 300;
    private readonly defaultCanvasId = 'qrCanvas';

    private qrOptions = {
        width: this.size,
        height: this.size,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' },
        errorCorrectionLevel: 'M' as 'L' | 'M' | 'Q' | 'H'
    };

    static getInstance(): QRGenerator {
        return this.instance ??= new QRGenerator();
    }

    /** Generate QR code with full CryptoNow URL for scanning */
    async generateQRForScan(qrUniqueId: string, canvasId: string = this.defaultCanvasId): Promise<void> {
        const canvas = this.getCanvas(canvasId);
        if (!canvas) return;

        const QRCodeLib = (window as any).QRCode;
        if (!QRCodeLib) {
            this.handleError(canvas, 'QRCode library not loaded');
            return;
        }

        try {
            const qrUrl = this.buildQRUrl(qrUniqueId);

            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            document.body.appendChild(tempDiv);

            new QRCodeLib(tempDiv, {
                text: qrUrl,
                width: this.size,
                height: this.size,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCodeLib.CorrectLevel.M
            });

            setTimeout(() => {
                const qrImg = tempDiv.querySelector('img') as HTMLImageElement;
                if (!qrImg) return;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;

                canvas.width = this.size;
                canvas.height = this.size;

                qrImg.onload = () => {
                    ctx.drawImage(qrImg, 0, 0, this.size, this.size);
                    tempDiv.remove();
                };
                if (qrImg.complete) qrImg.onload(null as any);
            }, 100);

            console.log('✅ QR generated:', qrUniqueId);
            this.updateQRInfo(qrUniqueId, qrUrl);

        } catch (error) {
            this.handleError(canvas, 'Failed to generate QR code', error);
        }
    }

    /** Generate QR with custom styling */
    async generateStyledQR(qrUniqueId: string, canvasId: string, options: Partial<typeof this.qrOptions>): Promise<void> {
        const canvas = this.getCanvas(canvasId);
        if (!canvas) return;

        const mergedOptions = { ...this.qrOptions, ...options };
        const qrUrl = this.buildQRUrl(qrUniqueId);

        try {
            // @ts-ignore
            await QRCode.toCanvas(canvas, qrUrl, mergedOptions);
            this.updateQRInfo(qrUniqueId, qrUrl);
        } catch (error) {
            this.handleError(canvas, 'Failed to generate styled QR', error);
        }
    }

    /** Download QR as PNG */
    downloadQR(canvasId: string = this.defaultCanvasId, filename?: string): void {
        const canvas = this.getCanvas(canvasId);
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
            alert('Download failed. Please try again.');
            console.error('❌ QR download failed:', error);
        }
    }

    /** Get QR as base64 data URL */
    getQRDataURL(canvasId: string = this.defaultCanvasId): string | null {
        const canvas = this.getCanvas(canvasId);
        if (!canvas) return null;

        try {
            return canvas.toDataURL('image/png', 1.0);
        } catch (error) {
            console.error('❌ Failed to get QR data URL:', error);
            return null;
        }
    }

    /** Copy QR URL to clipboard */
    async copyQRUrl(): Promise<void> {
        const url = document.getElementById('qrCodeUrl')?.textContent;
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

    // ===== Helpers =====
    private buildQRUrl(qrUniqueId: string): string {
        return `https://zapzap666.xyz/?qr=${qrUniqueId}`;
    }

    private getCanvas(canvasId: string): HTMLCanvasElement | null {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) console.error(`❌ Canvas "${canvasId}" not found`);
        return canvas;
    }

    private updateQRInfo(qrUniqueId: string, qrUrl: string): void {
        const qrUniqueIdEl = document.getElementById('qrUniqueId');
        const qrCodeUrlEl = document.getElementById('qrCodeUrl');

        if (qrUniqueIdEl) qrUniqueIdEl.textContent = qrUniqueId;
        if (qrCodeUrlEl) {
            qrCodeUrlEl.textContent = qrUrl;
            qrCodeUrlEl.className = 'text-white text-sm break-all';
        }
    }

    private handleError(canvas: HTMLCanvasElement, message: string, error?: any): void {
        console.error(`❌ ${message}`, error ?? '');
        this.showQRError(canvas, message);
    }

    private showQRError(canvas: HTMLCanvasElement, message: string): void {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = this.size;
        canvas.height = this.size;

        ctx.fillStyle = '#f3f4f6';
        ctx.fillRect(0, 0, this.size, this.size);

        ctx.fillStyle = '#ef4444';
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(message, this.size / 2, this.size / 2);
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
        } catch {
            alert('Copy failed. Please copy manually: ' + text);
        }

        document.body.removeChild(textarea);
    }
}

export default QRGenerator;
