window.Util = (() => {
    'use strict';
    const nf = new Intl.NumberFormat('ko-KR');
    const formatNumber = (n) => nf.format(Math.round(Number(n) || 0));

    // 1억 5000만원 형식 (조/억/만 + 나머지 원 단위까지 표기)
    const formatMoney = (amount) => {
        let rest = Math.max(0, Math.round(Number(amount) || 0));
        if (!rest) return '0원';
        const parts = [];
        for (const [label, size] of [['조', 1e12], ['억', 1e8], ['만', 1e4]]) {
            const q = Math.floor(rest / size);
            if (q) { parts.push(q + label); rest %= size; }
        }
        if (rest) parts.push(rest);
        return parts.join(' ') + '원';
    };

    let timer;
    const toast = (msg) => {
        let el = document.getElementById('toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'toast';
            el.className = 'toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(() => el.classList.remove('show'), 2200);
    };

    const copyText = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) { /* 구형/비보안 환경 → 폴백 */ }
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        ta.remove();
        return ok;
    };

    return { formatNumber, formatMoney, toast, copyText };
})();