const formatMoney = (amount) => {
    if (amount === 0) return '0원';
    let result = '';
    const uk = Math.floor(amount / 100000000);
    const man = Math.floor((amount % 100000000) / 10000);
    const remainder = amount % 10000;
    if (uk > 0) result += uk + '억 ';
    if (man > 0) result += man + '만 ';
    if (remainder > 0 && uk === 0) result += remainder;
    return result.trim() + '원';
};

const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

const items = [
    { id: 'raw', name: '마약 원재료 (세트)', price: 100000000, category: 'drug' },
    { id: 'finished', name: '마약 완제품 (세트)', price: 200000000, category: 'drug' },
    { id: 'c4', name: 'C4', price: 40000000, category: 'drug' },
    { id: 'mini_smg', name: '미니 SMG', price: 130000000, category: 'weapon' },
    { id: 'carbine', name: '카빈', price: 130000000, category: 'weapon' },
    { id: 'assault', name: '어썰트', price: 130000000, category: 'weapon' },
    { id: 'shotgun', name: '샷건', price: 150000000, category: 'weapon' },
    { id: 'uzi', name: '우지', price: 80000000, category: 'weapon' },
    { id: 'pistol', name: '피스톨', price: 50000000, category: 'weapon' },
    { id: 'melee', name: '근접무기', price: 10000000, category: 'weapon' },
    { id: 'ammo', name: '총알', price: 5000000, category: 'weapon' },
    { id: 'bag_s_5', name: '가방(600) 5일', price: 1500000000, category: 'extra' },
    { id: 'bag_s_10', name: '가방(600) 10일', price: 3000000000, category: 'extra' },
    { id: 'bag_l_5', name: '가방(1200) 5일', price: 2500000000, category: 'extra' },
    { id: 'bag_l_10', name: '가방(1200) 10일', price: 5000000000, category: 'extra' },
    { id: 'storage_s', name: '소형창고(150)', price: 1500000000, category: 'extra' },
    { id: 'storage_l', name: '대형창고(300)', price: 3000000000, category: 'extra' }
];

let state = {};
items.forEach(item => state[item.id] = 0);

const updateTotals = () => {
    let total = 0;
    items.forEach(item => {
        total += item.price * state[item.id];

        if (item.id === 'raw' || item.id === 'finished') {
            const countEl = document.getElementById(`count-${item.id}`);
            if (countEl) countEl.innerText = `(${state[item.id] * 100}개)`;
        } else if (item.id === 'ammo') {
            const countEl = document.getElementById(`count-${item.id}`);
            if (countEl) countEl.innerText = `(${formatNumber(state[item.id] * 100)}발)`;
        }
    });
    document.getElementById('grand-total').innerText = formatMoney(total) + ` (${formatNumber(total)})`;
    const requiredBlackMoney = Math.ceil(total / 0.85);
    document.getElementById('required-black-money').innerText = formatMoney(requiredBlackMoney) + ` (${formatNumber(requiredBlackMoney)})`;
};

window.handleInput = (id, value) => {
    let val = parseInt(value);
    if (isNaN(val) || val < 0) val = 0;
    state[id] = val;
    document.getElementById(`input-${id}`).value = val;
    updateTotals();
};

window.handleIncrement = (id, amount) => {
    state[id] = Math.max(0, state[id] + amount);
    document.getElementById(`input-${id}`).value = state[id];
    updateTotals();
};

const renderItem = (item) => {
    let countLabel = '';
    if (item.id === 'raw' || item.id === 'finished') {
        countLabel = ` <span style="color:var(--accent); font-size:0.85rem; margin-left:0.5rem; font-weight:600;" id="count-${item.id}">(0개)</span>`;
    } else if (item.id === 'ammo') {
        countLabel = ` <span style="color:var(--accent); font-size:0.85rem; margin-left:0.5rem; font-weight:600;" id="count-${item.id}">(0발)</span>`;
    }
    return `
        <div class="item-row">
            <div class="item-info">
                <span class="item-name">${item.name}${countLabel}</span>
                <span class="item-price">${formatMoney(item.price)}</span>
            </div>
            <div class="input-group">
                <button onclick="handleIncrement('${item.id}', -1)">-</button>
                <input type="number" id="input-${item.id}" value="0" min="0" oninput="handleInput('${item.id}', this.value)">
                <button onclick="handleIncrement('${item.id}', 1)">+</button>
            </div>
        </div>
    `;
};

// ⚔️ 거점/이벤트 벌금 계산 로직
window.updatePenalty = () => {
    const selectedLocation = document.getElementById('p-location').value;
    const enemyInput = document.getElementById('p-enemy');
    let allyCount = parseInt(document.getElementById('p-ally').value) || 0;
    
    // 카지노, 밀공장, 건샵 게릴라 여부 체크
    const isEnemyBased = ['카게', '밀게', '건게'].includes(selectedLocation);

    if (!isEnemyBased) {
        // 그 외 지역: 적군 수가 아군 수와 무조건 동일하게 자동 설정 및 입력 비활성화
        enemyInput.value = allyCount;
        enemyInput.disabled = true;
        enemyInput.style.opacity = '0.6';
        enemyInput.style.cursor = 'not-allowed';
    } else {
        // 3개 게릴라 지역: 적군 인원 수 자유 입력 가능
        enemyInput.disabled = false;
        enemyInput.style.opacity = '1';
        enemyInput.style.cursor = 'text';
    }

    const enemyCount = parseInt(enemyInput.value) || 0;
    const aRound = parseInt(document.getElementById('p-around').value) || 0;
    const bRound = parseInt(document.getElementById('p-bround').value) || 0;

    // 1인당 벌금 3천만원 고정
    const pricePerPerson = 30000000;

    // 카지노/밀공장/건샵은 적군 인원 기준, 그 외는 동일한 인원 수 기준
    const targetCount = isEnemyBased ? enemyCount : allyCount;
    const labelText = isEnemyBased ? '적군' : '동일 인원';

    // 적용 인원 기준 라운드당 벌금 계산
    const roundFee = targetCount * pricePerPerson;

    // 무조건 큰 수에서 작은 수 빼기
    const roundDiff = Math.abs(aRound - bRound);

    // 총 벌금 계산
    const totalPenalty = roundDiff * roundFee;

    // 실시간 UI 업데이트
    const minRound = Math.min(aRound, bRound);
    const maxRound = Math.max(aRound, bRound);
    
    document.getElementById('p-diff-display').innerText = `${roundDiff}라운드 차이 (${maxRound}라 - ${minRound}라)`;
    document.getElementById('p-round-fee-display').innerText = `${formatMoney(roundFee)} (${labelText} ${targetCount}명 기준)`;
    document.getElementById('p-total-display').innerText = `${formatMoney(totalPenalty)} (${formatNumber(totalPenalty)}원)`;
};

const initApp = () => {
    const app = document.getElementById('app');
    if (!app) return;

    const drugs = items.filter(i => i.category === 'drug');
    const weapons = items.filter(i => i.category === 'weapon');
    const extras = items.filter(i => i.category === 'extra');

    let html = `
        <!-- ⚔️ 지상 or 차전 벌금 계산기 -->
        <div class="card full-width">
            <h2>⚔️ 지상 or 차전 벌금 계산기</h2>
            <div class="penalty-calculator">
                <div class="form-group">
                    <label>조직RP 선택</label>
                    <select id="p-location" class="styled-select" onchange="updatePenalty()">
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
                        <label>아군 참여 인원 (명)</label>
                        <input type="number" id="p-ally" class="styled-input" value="0" min="0" oninput="updatePenalty()">
                    </div>
                    <div class="form-group">
                        <label>적군 참여 인원 (명)</label>
                        <input type="number" id="p-enemy" class="styled-input" value="0" min="0" oninput="updatePenalty()">
                    </div>
                </div>

                <div class="grid-2">
                    <div class="form-group">
                        <label>1팀 승리 라운드</label>
                        <input type="number" id="p-around" class="styled-input" value="0" min="0" oninput="updatePenalty()">
                    </div>
                    <div class="form-group">
                        <label>2팀 승리 라운드</label>
                        <input type="number" id="p-bround" class="styled-input" value="0" min="0" oninput="updatePenalty()">
                    </div>
                </div>

                <!-- 📊 실시간 실측 검증 결과 창 -->
                <div class="penalty-result-box">
                    <div class="result-row">
                        <span style="color: var(--text-muted);">승리 라운드 차이:</span>
                        <span id="p-diff-display" style="font-weight: 600;">0라운드 차이 (0라 - 0라)</span>
                    </div>
                    <div class="result-row">
                        <span style="color: var(--text-muted);">1라운드당 적용 벌금:</span>
                        <span id="p-round-fee-display" style="font-weight: 600; color: #60a5fa;">0원 (0명 기준)</span>
                    </div>
                    <div class="result-row main">
                        <span style="font-weight: 700; font-size: 1.1rem; color: var(--warning);">최종 총 벌금:</span>
                        <span id="p-total-display" style="font-weight: 800; font-size: 1.3rem; color: var(--warning);">0원 (0원)</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="card">
            <h2>💊 마약 및 폭발물</h2>
            ${drugs.map(renderItem).join('')}
        </div>
        <div class="card">
            <h2>🔫 무기 및 총알</h2>
            ${weapons.map(renderItem).join('')}
        </div>
        
        <div class="card full-width">
            <h2>💰 검은돈 환전 수수료 계산기</h2>
            <p style="color: var(--text-muted); font-size: 0.95rem;">보유한 검은돈을 입력하면 15% 수수료를 제외한 실수령액을 알려줍니다.</p>
            <div class="black-money-calculator">
                <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                    <label for="bm-input" style="font-size: 0.95rem; font-weight: 500;">보유한 검은돈 금액 입력</label>
                    <span id="bm-input-korean" style="color: var(--accent); font-size: 0.9rem; font-weight: 600;">(0원)</span>
                </div>
                <input type="text" id="bm-input" placeholder="금액을 입력하세요 (예: 100,000,000)" oninput="calcBlackMoney(this.value)">
                <div class="bm-result">
                    <span style="color: var(--danger)">수수료 차감 (15%):</span>
                    <span id="bm-fee">0원</span>
                </div>
                <div class="bm-result" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); flex-direction: column; align-items: flex-end;">
                    <div style="width: 100%; display: flex; justify-content: space-between;">
                        <span style="color: #10b981; font-size: 1.15rem;">실수령액 (85%):</span>
                        <span id="bm-receive" style="color: #10b981; font-size: 1.15rem;">0원</span>
                    </div>
                    <span id="bm-receive-raw" style="color: var(--text-muted); font-size: 0.85rem; margin-top: 0.25rem;">0</span>
                </div>
            </div>
        </div>
        <details class="full-width">
            <summary>💼 가방 및 창고</summary>
            <div class="details-content">
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem;">
                    ${extras.map(renderItem).join('')}
                </div>
            </div>
        </details>
    `;
    app.innerHTML = html;
    updatePenalty();
};

window.calcBlackMoney = (val) => {
    let rawValue = val.replace(/[^0-9]/g, '');
    if (!rawValue) {
        document.getElementById('bm-input').value = '';
        document.getElementById('bm-input-korean').innerText = '(0원)';
        document.getElementById('bm-fee').innerText = '0원';
        document.getElementById('bm-receive').innerText = '0원';
        document.getElementById('bm-receive-raw').innerText = '0';
        return;
    }

    document.getElementById('bm-input').value = parseInt(rawValue, 10).toLocaleString('ko-KR');

    const amount = parseInt(rawValue, 10);
    document.getElementById('bm-input-korean').innerText = `(${formatMoney(amount)})`;
    const fee = amount * 0.15;
    const receive = amount - fee;
    document.getElementById('bm-fee').innerText = formatMoney(fee) + ` (${formatNumber(fee)})`;
    document.getElementById('bm-receive').innerText = formatMoney(receive) + ` (${formatNumber(receive)})`;
    document.getElementById('bm-receive-raw').innerText = Math.floor(receive).toString();
};

initApp();
