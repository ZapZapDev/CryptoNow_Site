export function loadHeader(): void {
    fetch('header')
        .then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.text();
        })
        .then(html => {
            const headerEl = document.getElementById('header');
            if (headerEl) headerEl.innerHTML = html;
        })
        .catch(err => console.warn('Header load failed:', err.message));
}
