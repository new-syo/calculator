(() => {
    'use strict';

    // common.js (index.html <head>에서 먼저 로드됨)
    const { formatMoney, formatNumber, toast, copyText } = window.Util;

    // =========================================================
    // ⚙ 설정값
    // =========================================================
    const MAX_QTY = 999;                 // 품목당 최대 수량
    const MAX_BM_DIGITS = 13;            // 검은돈 입력 최대 자릿수
    const MAX_BOX_DIGITS = 7;            // 밀수품 상자 개수 최대 자릿수

    const BM_RECEIVE_PCT = 85;           // 검은돈 환전 실수령 비율(%)
    const BOX_PRICE = 55_000_000;        // 밀수품 상자 개당 원가
    const BOX_RECEIVE_PCT = 75;          // 밀수품 상자 실수령 비율(%)
    const BOX_RECEIVE = BOX_PRICE * BOX_RECEIVE_PCT / 100; // 개당 실수령액

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
        { id: 'bag_s_5', name: '소형가방(5일)+300kg', price: 1_500_000_000, category: 'extra' },
        { id: 'bag_s_10', name: '소형가방(10일)+300kg', price: 3_000_000_000, category: 'extra' },
        { id: 'bag_l_5', name: '대형가방(5일)+600kg', price: 2_500_000_000, category: 'extra' },
        { id: 'bag_l_10', name: '대형가방(10일)+600kg', price: 5_000_000_000, category: 'extra' },
        { id: 'storage_s', name: '소형창고(75kg)', price: 1_500_000_000, category: 'extra' },
        { id: 'storage_l', name: '대형창고(150kg)', price: 3_000_000_000, category: 'extra' }
    ];
    // =========================================================

    const $ = (id) => document.getElementById(id);
    const byId = new Map(items.map(i => [i.id, i]));
    const qty = Object.fromEntries(items.map(i => [i.id, 0]));
    const bm = { input: 0, receive: 0 };   // 검은돈: 입력 원금 / 실수령액
    const box = { count: 0, receive: 0 };  // 밀수품 상자: 개수 / 실수령액

    // render() 이후 한 번만 조회해서 재사용하는 DOM 참조
    const ui = { qtyInputs: new Map(), counts: new Map() };

    const withRaw = (n) => `${formatMoney(n)} (${formatNumber(n)})`;
    const EMPTY_SUMMARY = '<p class="empty-msg">선택된 물품이 없습니다.</p>';

    // ---- 렌더링 ----
    const renderItem = ({ id, name, price, unit }) => `
        <div class="item-row">
            <div class="item-info">
                <span class="item-name">${name}${unit ? `<span class="item-count" data-count="${id}"></span>` : ''}</span>
                <span class="item-price">${formatMoney(price)}</span>
            </div>
            <div class="input-group">
                <button type="button" data-action="dec" data-id="${id}" aria-label="${name} 감소">−</button>
                <input type="number" inputmode="numeric" data-id="${id}"
                       value="0" min="0" max="${MAX_QTY}" aria-label="${name} 수량">
                <button type="button" data-action="inc" data-id="${id}" aria-label="${name} 증가">+</button>
            </div>
        </div>`;

    const renderExchangePanel = ({ panel, hidden, note, label, inputId, placeholder, feeLabel, receiveLabel }) => `
        <div class="black-money-calculator" data-panel="${panel}"${hidden ? ' hidden' : ''}>
            <p class="muted exch-note">${note}</p>
            <div class="exch-label-row">
                <label for="${inputId}" class="exch-label">${label}</label>
                <span id="${panel}-input-korean" class="exch-korean"></span>
            </div>
            <input type="text" id="${inputId}" inputmode="numeric" autocomplete="off" placeholder="${placeholder}">
            <div class="bm-result">
                <span class="exch-fee-label">${feeLabel}</span>
                <span id="${panel}-fee"></span>
            </div>
            <div class="bm-result bm-receive-row">
                <div class="exch-receive"><span>${receiveLabel}</span><span id="${panel}-receive"></span></div>
                <span id="${panel}-receive-raw" class="muted exch-raw"></span>
            </div>
        </div>`;

    const render = () => {
        const app = $('items-container');
        const list = (cat) => items.filter(i => i.category === cat).map(renderItem).join('');
        const bmFeePct = 100 - BM_RECEIVE_PCT;
        const boxFeePct = 100 - BOX_RECEIVE_PCT;

        app.innerHTML = `
            <div class="card card-drug"><h2>💊 마약 및 폭발물</h2>${list('drug')}</div>
            <div class="card card-weapon"><div class="card-weapon-header"><h2>🔫 무기 및 총알</h2><button type="button" id="btn-copy-weapon" class="copy-btn-sm">📋 내역 복사</button></div>${list('weapon')}</div>
            <div class="card card-calc">
                <h2>💰 환전 수수료 계산기</h2>
                <div class="exchange-tabs" role="tablist">
                    <button type="button" role="tab" class="exchange-tab" data-tab="bm">💵 검은돈 환전</button>
                    <button type="button" role="tab" class="exchange-tab" data-tab="box">📦 밀수품상자 환전</button>
                </div>
                ${renderExchangePanel({
                    panel: 'bm',
                    note: `검은돈 입력 시 ${bmFeePct}% 차감 후 계산`,
                    label: '검은돈 금액 입력',
                    inputId: 'bm-input',
                    placeholder: '금액을 입력하세요 (예: 100,000,000)',
                    feeLabel: `수수료 차감 (${bmFeePct}%):`,
                    receiveLabel: `실수령액 (${BM_RECEIVE_PCT}%):`
                })}
                ${renderExchangePanel({
                    panel: 'box',
                    hidden: true,
                    note: `개당 ${formatMoney(BOX_PRICE)} 에서 ${boxFeePct}% 차감 → 개당 ${formatMoney(BOX_RECEIVE)}`,
                    label: '밀수품 상자 개수 입력',
                    inputId: 'box-input',
                    placeholder: '상자 개수를 입력하세요 (예: 10)',
                    feeLabel: `수수료 차감 (${boxFeePct}%):`,
                    receiveLabel: `실수령액 (${BOX_RECEIVE_PCT}%):`
                })}
            </div>
            <details class="card-extra full-width">
                <summary>💼 가방 및 창고</summary>
                <div class="details-content">
                    <div class="extra-grid">${list('extra')}</div>
                </div>
            </details>`;

        // DOM 참조 캐싱 (이후 조회 없이 Map/객체로 접근)
        app.querySelectorAll('input[data-id]').forEach(el => ui.qtyInputs.set(el.dataset.id, el));
        app.querySelectorAll('[data-count]').forEach(el => ui.counts.set(el.dataset.count, el));
        ui.tabs = app.querySelectorAll('.exchange-tab');
        ui.panels = app.querySelectorAll('[data-panel]');
        ui.grandTotal = $('grand-total');
        ui.headerTotal = $('header-total');
        ui.headerSettle = $('header-settle');
        ui.summaryList = $('summary-list');
        ui.copyText = $('copy-text');
    };

    // ---- 합계 / 정산 갱신 ----
    // ( 검은돈 + 밀수품 ) − 물품 = 남은/부족 금액
    const buildSettleHTML = (total) => {
        const receive = bm.receive + box.receive;
        const diff = Math.abs(receive - total);
        const isRemain = receive >= total;
        const label = (t) => `<span class="header-total-label">${t}</span>`;
        const num = (n) => `<span class="settle-num">${formatMoney(n)}</span>`;
        const op = (t) => `<span class="settle-op">${t}</span>`;
        return {
            receive, isRemain, diff,
            html: `${op('(')}${label(`검은돈(${BM_RECEIVE_PCT}%)`)}${num(bm.receive)}${op('+')}` +
                  `${label(`밀수품(${BOX_RECEIVE_PCT}%)`)}${num(box.receive)}${op(')')}` +
                  `${op('−')}${label('물품')}${num(total)}${op('=')}` +
                  `${label(isRemain ? '남은 금액' : '부족한 금액')}<span class="settle-result">${formatMoney(diff)}</span>`
        };
    };

    const updateTotals = () => {
        // 한 번의 순회로 합계와 선택 목록 생성
        let total = 0;
        const selected = [];
        for (const item of items) {
            const count = qty[item.id];
            if (!count) continue;
            const subtotal = item.price * count;
            total += subtotal;
            selected.push({ item, count, subtotal });
        }

        const totalText = formatMoney(total);
        ui.grandTotal.textContent = totalText;
        ui.headerTotal.textContent = totalText;

        const hasExchange = bm.input > 0 || box.count > 0;
        const settle = hasExchange ? buildSettleHTML(total) : null;

        // 헤더: (검은돈 + 밀수품) − 물품 총합계
        ui.headerSettle.hidden = !hasExchange;
        if (hasExchange) {
            ui.headerSettle.classList.toggle('short', !settle.isRemain);
            ui.headerSettle.innerHTML = settle.html;
        } else {
            ui.headerSettle.innerHTML = '';
        }

        // 하단 정산 카드 + 복사 텍스트
        const sections = [];
        if (selected.length) {
            const lines = selected.map(({ item, count, subtotal }) =>
                `- ${item.name} x ${count}${unitSuffix(item, count)} : ${formatMoney(subtotal)}`);
            sections.push(['[ 물품 구매 내역 ]', ...lines, '', `총합계: ${totalText}`].join('\n'));
        }
        if (hasExchange) {
            const lines = ['[ 환전 정산 ]'];
            if (bm.input > 0) {
                lines.push(`검은돈 입력 금액: ${formatMoney(bm.input)}`,
                           `검은돈 환전 후 금액 (${BM_RECEIVE_PCT}%): ${formatMoney(bm.receive)}`);
            }
            if (box.count > 0) {
                lines.push(`밀수품 상자 ${formatNumber(box.count)}개 환전 후 금액 (${BOX_RECEIVE_PCT}%): ${formatMoney(box.receive)}`);
            }
            if (bm.input > 0 && box.count > 0) lines.push(`환전 합계: ${formatMoney(settle.receive)}`);
            lines.push(`물품 총합계: -${totalText}`,
                       `${settle.isRemain ? '남은 실수령액' : '부족한 금액'}: ${formatMoney(settle.diff)}`);
            sections.push(lines.join('\n'));
        }

        ui.summaryList.innerHTML = selected.length
            ? selected.map(({ item, count, subtotal }) => `<div class="summary-row">
                    <span>${item.name} x ${count}${unitSuffix(item, count)}</span>
                    <span class="summary-price">${formatMoney(subtotal)}</span>
                </div>`).join('')
            : EMPTY_SUMMARY;
        ui.copyText.value = sections.join('\n\n');
    };

    const unitSuffix = ({ unit }, count) =>
        unit ? ` (${formatNumber(count * unit.per)}${unit.label})` : '';

    // ---- 수량 ----
    // 값/화면만 갱신 (합계 갱신은 호출 측에서 한 번만)
    const applyQty = (id, value, syncInput = true) => {
        const v = Math.min(MAX_QTY, Math.max(0, parseInt(value, 10) || 0));
        qty[id] = v;
        if (syncInput) ui.qtyInputs.get(id).value = v;
        const countEl = ui.counts.get(id);
        if (countEl) countEl.textContent = `(${formatNumber(v * byId.get(id).unit.per)}${byId.get(id).unit.label})`;
    };

    const setQty = (id, value, syncInput = true) => {
        applyQty(id, value, syncInput);
        updateTotals();
    };

    // ---- 환전 계산기 ----
    // 숫자만 추출해 쉼표 포맷 + 커서 위치 유지, 숫자 값 반환
    const formatDigitsInput = (input, maxDigits) => {
        const caret = input.selectionStart ?? input.value.length;
        const digitsBeforeCaret = input.value.slice(0, caret).replace(/\D/g, '').length;
        const digits = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, maxDigits);
        const amount = Number(digits) || 0;

        input.value = digits ? formatNumber(amount) : '';

        let pos = 0, seen = 0;
        while (pos < input.value.length && seen < digitsBeforeCaret) {
            if (/\d/.test(input.value[pos])) seen++;
            pos++;
        }
        input.setSelectionRange(pos, pos);
        return amount;
    };

    // 결과 표시를 한 곳에서 처리 (초기 화면/초기화/입력 모두 동일한 형식)
    const showExchange = (panel, { headline, fee, receive }) => {
        $(`${panel}-input-korean`).textContent = `(${headline})`;
        $(`${panel}-fee`).textContent = withRaw(fee);
        $(`${panel}-receive`).textContent = withRaw(receive);
        $(`${panel}-receive-raw`).textContent = String(receive);
    };

    const refreshBlackMoney = (amount) => {
        const receive = Math.floor(amount * BM_RECEIVE_PCT / 100);
        bm.input = amount;
        bm.receive = receive;
        showExchange('bm', { headline: formatMoney(amount), fee: amount - receive, receive });
    };

    const refreshBox = (count) => {
        const receive = count * BOX_RECEIVE;
        box.count = count;
        box.receive = receive;
        showExchange('box', { headline: `${formatNumber(count)}개`, fee: count * BOX_PRICE - receive, receive });
    };

    const setTab = (name) => {
        ui.tabs.forEach(btn => {
            const on = btn.dataset.tab === name;
            btn.classList.toggle('active', on);
            btn.setAttribute('aria-selected', String(on));
        });
        ui.panels.forEach(p => { p.hidden = p.dataset.panel !== name; });
    };

    // ---- 전체 초기화 ----
    const resetAll = () => {
        items.forEach(i => applyQty(i.id, 0));
        $('bm-input').value = '';
        $('box-input').value = '';
        refreshBlackMoney(0);
        refreshBox(0);
        setTab('bm');   // 초기화 시 항상 검은돈 환전 화면으로
        updateTotals();
        toast('전체 수량이 초기화되었습니다.');
    };

    const copyResult = async () => {
        const text = ui.copyText.value;
        if (!text) return toast('복사할 내역이 없습니다.');
        toast((await copyText(text)) ? '내역이 클립보드에 복사되었습니다!' : '복사에 실패했습니다.');
    };

    // ---- 초기화 / 이벤트 등록 ----
    const init = () => {
        const app = $('items-container');
        if (!app) return;

        render();
        items.forEach(i => applyQty(i.id, 0));   // 단위 표기 "(0개)" 초기화
        refreshBlackMoney(0);
        refreshBox(0);
        setTab('bm');
        updateTotals();

        // 클릭 한 곳에서 위임 처리: 탭 / 무기 내역 복사 / 수량 ± 버튼
        app.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            if (btn.dataset.tab) return setTab(btn.dataset.tab);
            if (btn.id === 'btn-copy-weapon') return copyResult();
            const { action, id } = btn.dataset;
            if (action) setQty(id, qty[id] + (action === 'inc' ? 1 : -1));
        });

        // 수량 직접 입력 / 검은돈 / 상자 개수 입력
        app.addEventListener('input', (e) => {
            const t = e.target;
            if (t.id === 'bm-input') {
                refreshBlackMoney(formatDigitsInput(t, MAX_BM_DIGITS));
                updateTotals();
            } else if (t.id === 'box-input') {
                refreshBox(formatDigitsInput(t, MAX_BOX_DIGITS));
                updateTotals();
            } else if (t.dataset.id) {
                setQty(t.dataset.id, t.value, false);
            }
        });

        // 포커스 아웃 시 값 정규화
        app.addEventListener('change', (e) => {
            const id = e.target.dataset.id;
            if (id) e.target.value = qty[id];
        });

        // 방향키로 수량 변경
        app.addEventListener('keydown', (e) => {
            const input = e.target.closest('input[data-id]');
            if (!input || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
            e.preventDefault();
            const id = input.dataset.id;
            setQty(id, qty[id] + (e.key === 'ArrowUp' ? 1 : -1));
        });

        $('btn-reset-all')?.addEventListener('click', resetAll);
        $('btn-copy-result')?.addEventListener('click', copyResult);
    };

    document.addEventListener('DOMContentLoaded', init);
})();
