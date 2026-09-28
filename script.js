'use strict';

/* ───────── 상수 ───────── */
const PENALTY_PER_PERSON = 30000000; // 1인당 벌금 3천만원
const MAX_QTY = 9999;                // 물품 수량 상한 (숫자 정밀도 오버플로 방지)
const MAX_PEOPLE = 9999;
const MAX_ROUND = 9999;
const MAX_BM_DIGITS = 15;            // 검은돈 입력 최대 자릿수
const ENEMY_BASED = new Set(['카게', '밀게', '건게']); // 적군 인원을 직접 입력하는 게릴라

/* ───────── 포맷 유틸 ───────── */
const numberFormatter = new Intl.NumberFormat('ko-KR');
const formatNumber = (num) => numberFormatter.format(Math.floor(num));

const formatMoney = (amount) => {
    amount = Math.floor(amount);
    if (!(amount > 0)) return '0원';
    const uk = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    const rest = amount % 10000;
    const parts = [];
    if (uk > 0) parts.push(`${formatNumber(uk)}억`);
    if (man > 0) parts.push(`${man}만`);
    if (rest > 0) parts.push(formatNumber(rest)); // 기존: 억 단위가 있으면 나머지가 사라지던 버그 수정
    return parts.join(' ') + '원';
};

const formatBoth = (amount) => `${formatMoney(amount)} (${formatNumber(amount)})`;

/* 정수 연산으로 부동소수점 오차 제거 */
// total / 0.85 올림  ==  ceil(total * 20 / 17)
const ceilBlackMoney = (total) => {
    const q = Math.floor(total / 17);
    const r = total % 17;
    return q * 20 + Math.ceil((r * 20) / 17);
};
// amount * 0.85 내림
const afterFee = (amount) =>
    Math.floor(amount / 100) * 85 + Math.floor(((amount % 100) * 85) / 100);

const clampInt = (value, max) => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) return 0;
    return Math.min(n, max);
};

/* ───────── 데이터 ───────── */
const items = [
    { id: 'raw', name: '마약 원재료 (세트)', price: 100000000, category: 'drug', unit: { per: 100, suffix: '개' } },
    { id: 'finished', name: '마약 완제품 (세트)', price: 200000000, category: 'drug', unit: { per: 100, suffix: '개' } },
    { id: 'c4', name: 'C4', price: 40000000, category: 'drug' },
    { id: 'mini_smg', name: '미니 SMG', price: 130000000, category: 'weapon' },
    { id: 'carbine', name: '카빈', price: 130000000, category: 'weapon' },
    { id: 'assault', name: '어썰트', price: 130000000, category: 'weapon' },
    { id: 'shotgun', name: '샷건', price: 150000000, category: 'weapon' },
    { id: 'uzi', name: '우지', price: 80000000, category: 'weapon' },
    { id: 'pistol', name: '피스톨', price: 50000000, category: 'weapon' },
    { id: 'melee', name: '근접무기', price: 10000000, category: 'weapon' },
    { id: 'ammo', name: '총알', price: 5000000, category: 'weapon', unit: { per: 100, suffix: '발' } },
    { id: 'bag_s_5', name: '가방(600) 5일', price: 1500000000, category: 'extra' },
    { id: 'bag_s_10', name: '가방(600) 10일', price: 3000000000, category: 'extra' },
    { id: 'bag_l_5', name: '가방(1200) 5일', price: 2500000000, category: 'extra' },
    { id: 'bag_l_10', name: '가방(1200) 10일', price: 5000000000, category: 'extra' },
    { id: 'storage_s', name: '소형창고(150)', price: 1500000000, category: 'extra' },
    { id: 'storage_l', name: '대형창고(300)', price: 3000000000, category: 'extra' }
];

const itemById = new Map(items.map((item) => [item.id, item]));
const state = Object.fromEntries(items.map((item) => [item.id, 0]));

/* DOM 참조 캐시 (render 후 채움) */
const ui = { qty: {}, penalty: {}, bm: {} };

/* ───────── 물품 계산 ───────── */
const updateGrandTotal = () => {
    let total = 0;
    for (const item of items) total += item.price * state[item.id];
    ui.grandTotal.textContent = formatBoth(total);
    ui.requiredBlackMoney.textContent = formatBoth(ceilBlackMoney(total));
};

const setQty = (id, qty, syncInput = true) => {
    const item = itemById.get(id);
    const ref = ui.qty[id];
    if (!item || !ref) return;

    qty = Math.min(Math.max(0, qty), MAX_QTY);
    state[id] = qty;
    if (syncInput) ref.input.value = qty;
    if (ref.count) ref.count.textContent = `(${formatNumber(qty * item.unit.per)}${item.unit.suffix})`;
    updateGrandTotal();
};

const renderItem = (item) => {
    const count = item.unit
        ? `<span class="count-label" id="count-${item.id}">(0${item.unit.suffix})</span>`
        : '';
    return `
        <div class="item-row">
            <div class="item-info">
                <span class="item-name">${item.name}${count}</span>
                <span class="item-price">${formatMoney(item.price)}</span>
            </div>
            <div class="input-group">
                <button type="button" data-action="dec" data-id="${item.id}" aria-label="${item.name} 감소">-</button>
                <input type="number" id="input-${item.id}" class="qty-input" data-id="${item.id}"
                       value="0" min="0" max="${MAX_QTY}" inputmode="numeric" aria-label="${item.name} 수량">
                <button type="button" data-action="inc" data-id="${item.id}" aria-label="${item.name} 증가">+</button>
            </div>
        </div>
    `;
};

/* ───────── 벌금 계산 ───────── */
const updatePenalty = () => {
    const p = ui.penalty;
    const isEnemyBased = ENEMY_BASED.has(p.location.value);

    const allyCount = clampInt(p.ally.value, MAX_PEOPLE);
    if (!isEnemyBased) {
        // 그 외 지역: 적군 수 = 아군 수 (자동, 입력 잠금)
        p.enemy.value = allyCount;
    }
    p.enemy.disabled = !isEnemyBased;

    const enemyCount = clampInt(p.enemy.value, MAX_PEOPLE);
    const aRound = clampInt(p.aRound.value, MAX_ROUND);
    const bRound = clampInt(p.bRound.value, MAX_ROUND);

    const targetCount = isEnemyBased ? enemyCount : allyCount;
    const labelText = isEnemyBased ? '적군' : '동일 인원';
    const roundFee = targetCount * PENALTY_PER_PERSON;
    const maxRound = Math.max(aRound, bRound);
    const minRound = Math.min(aRound, bRound);
    const roundDiff = maxRound - minRound;
    const totalPenalty = roundDiff * roundFee;

    p.diff.textContent = `${roundDiff}라운드 차이 (${maxRound}라 - ${minRound}라)`;
    p.roundFee.textContent = `${formatMoney(roundFee)} (${labelText} ${targetCount}명 기준)`;
    p.total.textContent = `${formatMoney(totalPenalty)} (${formatNumber(totalPenalty)}원)`;
};

/* ───────── 검은돈 환전 계산 ───────── */
const resetBlackMoney = () => {
    const b = ui.bm;
    b.input.value = '';
    b.korean.textContent = '(0원)';
    b.fee.textContent = '0원';
    b.receive.textContent = '0원';
    b.receiveRaw.textContent = '0';
};

const handleBlackMoneyInput = () => {
    const b = ui.bm;
    const el = b.input;
    const caret = el.selectionStart ?? el.value.length;
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, '').length;

    const digits = el.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_BM_DIGITS);
    if (!digits || digits === '0') {
        resetBlackMoney();
        return;
    }

    const amount = parseInt(digits, 10);
    const formatted = formatNumber(amount);
    el.value = formatted;

    // 재포맷 시 커서가 끝으로 튀는 문제 보정
    if (document.activeElement === el) {
        let pos = 0;
        let seen = 0;
        while (pos < formatted.length && seen < digitsBeforeCaret) {
            if (/\d/.test(formatted[pos])) seen++;
            pos++;
        }
        el.setSelectionRange(pos, pos);
    }

    const receive = afterFee(amount);
    const fee = amount - receive; // 수수료 + 실수령액 = 입력액 이 항상 성립
    b.korean.textContent = `(${formatMoney(amount)})`;
    b.fee.textContent = formatBoth(fee);
    b.receive.textContent = formatBoth(receive);
    b.receiveRaw.textContent = String(receive);
};

/* ───────── 렌더 ───────── */
const initApp = () => {
    const app = document.getElementById('app');
    if (!app) return;

    const byCategory = (category) => items.filter((i) => i.category === category).map(renderItem).join('');

    app.innerHTML = `
        <div class="card full-width" id="penalty-card">
            <h2>⚔️ 지상 or 차전 벌금 계산기</h2>
            <div class="penalty-calculator">
                <div class="form-group">
                    <label for="p-location">조직RP 선택</label>
                    <select id="p-location" class="styled-select">
                        <option value="지상">지상</option>
                        <option value="남부공항">남부공항 게릴라</option>
                        <option value="카게">카지노 게릴라</option>
                        <option value="밀게">밀공장 게릴라</option>
                        <option value="건게">건샵 게릴라</option>
                        <option value="말농">말농장 게릴라</option>
                        <option value="호수위">호수 위 게릴라</option>
                    </select>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label for="p-ally">아군 참여 인원 (명)</label>
                        <input type="number" id="p-ally" class="styled-input" value="0" min="0" max="${MAX_PEOPLE}" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="p-enemy">적군 참여 인원 (명)</label>
                        <input type="number" id="p-enemy" class="styled-input" value="0" min="0" max="${MAX_PEOPLE}" inputmode="numeric">
                    </div>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label for="p-around">1팀 승리 라운드</label>
                        <input type="number" id="p-around" class="styled-input" value="0" min="0" max="${MAX_ROUND}" inputmode="numeric">
                    </div>
                    <div class="form-group">
                        <label for="p-bround">2팀 승리 라운드</label>
                        <input type="number" id="p-bround" class="styled-input" value="0" min="0" max="${MAX_ROUND}" inputmode="numeric">
                    </div>
                </div>

                <div class="penalty-result-box">
                    <div class="result-row">
                        <span class="muted">승리 라운드 차이:</span>
                        <span id="p-diff-display" class="strong">0라운드 차이 (0라 - 0라)</span>
                    </div>
                    <div class="result-row">
                        <span class="muted">1라운드당 적용 벌금:</span>
                        <span id="p-round-fee-display" class="strong fee-blue">0원 (0명 기준)</span>
                    </div>
                    <div class="result-row main">
                        <span class="final-label">최종 총 벌금:</span>
                        <span id="p-total-display" class="final-value">0원 (0원)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>💊 마약 및 폭발물</h2>
            ${byCategory('drug')}
        </div>
        <div class="card">
            <h2>🔫 무기 및 총알</h2>
            ${byCategory('weapon')}
        </div>

        <div class="card full-width">
            <h2>💰 검은돈 환전 수수료 계산기</h2>
            <p class="muted-text">보유한 검은돈을 입력하면 15% 수수료를 제외한 실수령액을 알려줍니다.</p>
            <div class="black-money-calculator">
                <div class="bm-label-row">
                    <label for="bm-input">보유한 검은돈 금액 입력</label>
                    <span id="bm-input-korean">(0원)</span>
                </div>
                <input type="text" id="bm-input" inputmode="numeric" autocomplete="off" placeholder="금액을 입력하세요 (예: 100,000,000)">
                <div class="bm-result">
                    <span class="danger-text">수수료 차감 (15%):</span>
                    <span id="bm-fee">0원</span>
                </div>
                <div class="bm-result bm-final">
                    <div class="bm-final-row">
                        <span>실수령액 (85%):</span>
                        <span id="bm-receive">0원</span>
                    </div>
                    <span id="bm-receive-raw">0</span>
                </div>
            </div>
        </div>

        <details class="full-width">
            <summary>💼 가방 및 창고</summary>
            <div class="details-content">
                <div class="extras-grid">${byCategory('extra')}</div>
            </div>
        </details>
    `;

    /* DOM 참조 캐시 */
    const $ = (id) => document.getElementById(id);
    ui.grandTotal = $('grand-total');
    ui.requiredBlackMoney = $('required-black-money');
    for (const item of items) {
        ui.qty[item.id] = { input: $(`input-${item.id}`), count: $(`count-${item.id}`) };
    }
    ui.penalty = {
        location: $('p-location'), ally: $('p-ally'), enemy: $('p-enemy'),
        aRound: $('p-around'), bRound: $('p-bround'),
        diff: $('p-diff-display'), roundFee: $('p-round-fee-display'), total: $('p-total-display')
    };
    ui.bm = {
        input: $('bm-input'), korean: $('bm-input-korean'), fee: $('bm-fee'),
        receive: $('bm-receive'), receiveRaw: $('bm-receive-raw')
    };

    /* 이벤트 위임: 인라인 onclick/oninput 및 전역 함수 제거 */
    app.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        setQty(id, state[id] + (btn.dataset.action === 'inc' ? 1 : -1));
    });

    app.addEventListener('input', (e) => {
        const target = e.target;
        if (target.classList.contains('qty-input')) {
            // 입력 도중 빈 칸을 허용 (지우자마자 "0"이 강제로 채워지던 문제 수정)
            const raw = target.value;
            const qty = clampInt(raw, MAX_QTY);
            setQty(target.dataset.id, qty, false);
            if (raw !== '' && String(qty) !== raw) target.value = qty;
        } else if (target.closest('#penalty-card')) {
            updatePenalty();
        } else if (target === ui.bm.input) {
            handleBlackMoneyInput();
        }
    });

    ui.penalty.location.addEventListener('change', updatePenalty);
    // 입력창을 비운 채 포커스를 잃으면 0으로 복구
    app.addEventListener('focusout', (e) => {
        if (e.target.classList.contains('qty-input') && e.target.value === '') e.target.value = 0;
    });

    updatePenalty();
    updateGrandTotal();
};

initApp();
