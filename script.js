(() => {
    'use strict';
    const { formatMoney, formatNumber } = window.Util;

    const MAX_QTY = 999;        // 품목당 최대 수량
    const MAX_BM_DIGITS = 13;   // 검은돈 입력 최대 자릿수 (정밀도 보호)

    const items = [
        { id: 'raw', name: '마약 원재료 (세트)', price: 100_000_000, category: 'drug', unit: { per: 100, label: '개' } },
        { id: 'finished', name: '마약 완제품 (세트)', price: 200_000_000, category: 'drug', unit: { per: 100, label: '개' } },
        { id: 'c4', name: 'C4', price: 40_000_000, category: 'drug' },
        { id: 'mini_smg', name: '미니 SMG', price: 130_000_000, category: 'weapon' },
        { id: 'carbine', name: '카빈', price: 130_000_000, category: 'weapon' },
        { id: 'assault', name: '어썰트', price: 130_000_000, category: 'weapon' },
        { id: 'shotgun', name: '샷건', price: 150_000_000, category: 'weapon' },
        { id: 'uzi', name: '우지', price: 80_000_000, category: 'weapon' },
        { id: 'pistol', name: '피스톨', price: 50_000_000, category: 'weapon' },
        { id: 'melee', name: '근접무기', price: 10_000_000, category: 'weapon' },
        { id: 'ammo', name: '총알', price: 5_000_000, category: 'weapon', unit: { per: 100, label: '발' } },
        { id: 'bag_s_5', name: '가방(600) 5일', price: 1_500_000_000, category: 'extra' },
        { id: 'bag_s_10', name: '가방(600) 10일', price: 3_000_000_000, category: 'extra' },
        { id: 'bag_l_5', name: '가방(1200) 5일', price: 2_500_000_000, category: 'extra' },
        { id: 'bag_l_10', name: '가방(1200) 10일', price: 5_000_000_000, category: 'extra' },
        { id: 'storage_s', name: '소형창고(150)', price: 1_500_000_000, category: 'extra' },
        { id: 'storage_l', name: '대형창고(300)', price: 3_000_000_000, category: 'extra' }
    ];

    const byId = Object.fromEntries(items.map(i => [i.id, i]));
    const qty = Object.fromEntries(items.map(i => [i.id, 0]));
    const $ = (id) => document.getElementById(id);
    const app = $('items-container');

    const renderItem = (item) => `
        <div class="item-row">
            <div class="item-info">
                <span class="item-name">${item.name}${item.unit ? `<span class="item-count" data-count="${item.id}">(0${item.unit.label})</span>` : ''}</span>
                <span class="item-price">${formatMoney(item.price)}</span>
            </div>
            <div class="input-group">
                <button type="button" data-action="dec" data-id="${item.id}" aria-label="${item.name} 감소">-</button>
                <input type="number" inputmode="numeric" data-id="${item.id}" value="0" min="0" max="${MAX_QTY}" aria-label="${item.name} 수량">
                <button type="button" data-action="inc" data-id="${item.id}" aria-label="${item.name} 증가">+</button>
            </div>
        </div>`;

    const render = () => {
        const list = (cat) => items.filter(i => i.category === cat).map(renderItem).join('');
        app.innerHTML = `
            <div class="card card-drug"><h2>💊 마약 및 폭발물</h2>${list('drug')}</div>
            <div class="card card-weapon"><h2>🔫 무기 및 총알</h2>${list('weapon')}</div>
            <div class="card card-calc">
                <h2>💰 검은돈 환전 수수료 계산기</h2>
                <p class="muted" style="font-size:0.95rem;">보유한 검은돈을 입력하면 15% 수수료를 제외한 실수령액을 알려줍니다.</p>
                <div class="black-money-calculator">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                        <label for="bm-input" style="font-size:0.95rem; font-weight:500;">보유한 검은돈 금액 입력</label>
                        <span id="bm-input-korean" style="color:var(--accent); font-size:0.9rem; font-weight:600;">(0원)</span>
                    </div>
                    <input type="text" id="bm-input" inputmode="numeric" autocomplete="off" placeholder="금액을 입력하세요 (예: 100,000,000)">
                    <div class="bm-result">
                        <span style="color:var(--danger)">수수료 차감 (15%):</span>
                        <span id="bm-fee">0원</span>
                    </div>
                    <div class="bm-result" style="margin-top:1rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.1); flex-direction:column; align-items:flex-end;">
                        <div style="width:100%; display:flex; justify-content:space-between; color:var(--success); font-size:1.15rem;">
                            <span>실수령액 (85%):</span><span id="bm-receive">0원</span>
                        </div>
                        <span id="bm-receive-raw" class="muted" style="font-size:0.85rem; margin-top:0.25rem;">0</span>
                    </div>
                </div>
            </div>
            <details class="card-extra full-width">
                <summary>💼 가방 및 창고</summary>
                <div class="details-content">
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:1rem;">${list('extra')}</div>
                </div>
            </details>`;
    };

    // ---- 물품 합계 ----
    const updateTotals = () => {
        const total = items.reduce((sum, i) => sum + i.price * qty[i.id], 0);
        $('grand-total').textContent = `${formatMoney(total)} (${formatNumber(total)})`;

        const selectedItems = items.filter(i => qty[i.id] > 0);
        const summaryList = $('summary-list');
        const copyTextarea = $('copy-text');

        if (selectedItems.length === 0) {
            summaryList.innerHTML = '<p style="color: var(--text-muted); text-align: center;">선택된 물품이 없습니다.</p>';
            copyTextarea.value = '';
        } else {
            let summaryHTML = '';
            let copyString = '[ 물품 구매 내역 ]\n';

            selectedItems.forEach(i => {
                const count = qty[i.id];
                const unitStr = i.unit ? ` (${formatNumber(count * i.unit.per)}${i.unit.label})` : '';
                const itemTotal = count * i.price;

                summaryHTML += `<div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.95rem;">
                    <span>${i.name} x ${count}${unitStr}</span>
                    <span>${formatMoney(itemTotal)}</span>
                </div>`;

                copyString += `- ${i.name} x ${count}${unitStr} : ${formatMoney(itemTotal)}\n`;
            });

            copyString += `\n총합계: ${formatMoney(total)}`;
            summaryList.innerHTML = summaryHTML;
            copyTextarea.value = copyString;
        }
    };

    const setQty = (id, value, syncInput = true) => {
        const v = Math.min(MAX_QTY, Math.max(0, parseInt(value, 10) || 0));
        qty[id] = v;
        if (syncInput) app.querySelector(`input[data-id="${id}"]`).value = v;
        const unit = byId[id].unit;
        if (unit) app.querySelector(`[data-count="${id}"]`).textContent = `(${formatNumber(v * unit.per)}${unit.label})`;
        updateTotals();
    };

    // ---- 검은돈 환전 ----
    const onBlackMoneyInput = (input) => {
        const caret = input.selectionStart ?? input.value.length;
        const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
        const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_BM_DIGITS);
        const amount = Number(digits) || 0;

        input.value = digits ? formatNumber(amount) : '';
        let pos = 0, seen = 0;
        while (pos < input.value.length && seen < digitsBeforeCaret) {
            if (/\d/.test(input.value[pos])) seen++;
            pos++;
        }
        input.setSelectionRange(pos, pos);

        const receive = Math.floor(amount * 85 / 100);
        const fee = amount - receive;
        $('bm-input-korean').textContent = `(${formatMoney(amount)})`;
        $('bm-fee').textContent = `${formatMoney(fee)} (${formatNumber(fee)})`;
        $('bm-receive').textContent = `${formatMoney(receive)} (${formatNumber(receive)})`;
        $('bm-receive-raw').textContent = String(receive);
    };

    // ---- 이벤트 위임 ----
    app.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        setQty(id, qty[id] + (btn.dataset.action === 'inc' ? 1 : -1));
    });

    app.addEventListener('input', (e) => {
        const t = e.target;
        if (t.id === 'bm-input') return onBlackMoneyInput(t);
        if (t.dataset.id) setQty(t.dataset.id, t.value, false);
    });

    app.addEventListener('change', (e) => {
        if (e.target.dataset.id) e.target.value = qty[e.target.dataset.id];
    });

    // ---- 내역 복사 함수 ----
    window.copyResult = async () => {
        const text = $('copy-text').value;
        if (!text) {
            window.Util.toast('복사할 내역이 없습니다.');
            return;
        }
        const success = await window.Util.copyText(text);
        if (success) {
            window.Util.toast('내역이 클립보드에 복사되었습니다!');
        } else {
            window.Util.toast('복사에 실패했습니다.');
        }
    };

    render();
    updateTotals();
})();