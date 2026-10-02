(() => {
    'use strict';
    const { formatMoney, copyText, toast } = window.Util;

    // =========================================================
    // ⚙ [설정] 상대 조직 목록 / 총기 목록 / 금액 기준
    // =========================================================
    const TARGET_ORGS = ['백야','마피아'];
    const WEAPONS = ['미니 SMG', '카빈', '어썰트', '샷건', '우지', '피스톨', '근접무기'];
    const ENEMY_BASED = new Set(['카게', '밀게', '건게','말농','남부공항','호수위']); // 적군 인원 기준 게릴라
    const FEE_PER_PERSON = 30_000_000;  // RP: 1라운드 인당 3천만
    const GUN_FINE = 50_000_000;        // 건샵털이: 신수 승리 라운드당 5천만
    const MAX_GUN_ROUNDS = 3;
    const MAX_IMAGES = 10;
    // =========================================================

    const $ = (id) => document.getElementById(id);
    const count = (el) => Math.max(0, parseInt(el.value, 10) || 0);

    // ---------------------------------------------------------
    // 🖼️ 스크린샷 첨부
    // ---------------------------------------------------------
    let images = []; // { id, blob, url }
    let imageSeq = 0;

    const renderPreviews = () => {
        const box = $('preview-container');
        box.replaceChildren(...images.map(item => {
            const wrap = document.createElement('div');
            wrap.className = 'preview-img-wrapper';
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = '첨부 스크린샷';
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'remove-img-btn';
            del.textContent = '✕';
            del.setAttribute('aria-label', '이미지 삭제');
            del.addEventListener('click', () => {
                URL.revokeObjectURL(item.url);
                images = images.filter(i => i.id !== item.id);
                renderPreviews();
                updateRpLedger();
            });
            wrap.append(img, del);
            return wrap;
        }));
    };

    const addImage = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        if (images.length >= MAX_IMAGES) return toast(`스크린샷은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
        images.push({ id: ++imageSeq, blob: file, url: URL.createObjectURL(file) });
        renderPreviews();
        updateRpLedger();
    };

    // 여러 장이면 세로로 이어붙여 PNG 한 장으로 (클립보드 이미지는 1장만 가능)
    const toPngBlob = async (blobs) => {
        if (blobs.length === 1 && blobs[0].type === 'image/png') return blobs[0];
        const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
        try {
            const gap = 8;
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(...bitmaps.map(b => b.width));
            canvas.height = bitmaps.reduce((s, b) => s + b.height, 0) + gap * (bitmaps.length - 1);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            let y = 0;
            for (const bmp of bitmaps) { ctx.drawImage(bmp, 0, y); y += bmp.height + gap; }
            return await new Promise((res, rej) =>
                canvas.toBlob(b => b ? res(b) : rej(new Error('PNG 변환 실패')), 'image/png'));
        } finally {
            bitmaps.forEach(b => b.close && b.close());
        }
    };

    const copyRpImage = async () => {
        if (!images.length) return toast('첨부된 스크린샷이 없습니다.');
        if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
            return toast('이미지 복사를 지원하지 않는 환경입니다. (HTTPS 또는 localhost 필요)');
        }
        try {
            // Promise를 그대로 넘겨 사용자 제스처 만료(Safari 등) 문제 방지
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': toPngBlob(images.map(i => i.blob)) })]);
            toast('스크린샷이 복사되었습니다! 붙여넣기 하세요.');
        } catch (err) {
            console.error(err);
            toast('이미지 복사에 실패했습니다.');
        }
    };

    // ---------------------------------------------------------
    // ⚔️ 일반 RP 장부
    // ---------------------------------------------------------
    const updateRpLedger = () => {
        const target = $('rp-target-select').value || '미정';
        const type = $('rp-type').value;
        const enemyBased = ENEMY_BASED.has(type);

        const enemyEl = $('rp-enemy');
        enemyEl.disabled = !enemyBased;
        if (!enemyBased) enemyEl.value = $('rp-ally').value;

        const ally = count($('rp-ally'));
        const enemy = count(enemyEl);
        const rpCode = enemyBased
            ? `${type} 신${ally} ${target.trim().charAt(0)}${enemy}`
            : `${type}${ally}${enemy}`;

        const a = count($('rp-around'));
        const b = count($('rp-bround'));
        const diff = Math.abs(a - b);
        const headcount = enemyBased ? enemy : ally;
        const roundFee = headcount * FEE_PER_PERSON;
        const total = diff * roundFee;

        $('rp-code-display').textContent = rpCode;
        $('rp-round-diff-display').textContent = `${diff}라운드 차이 (${Math.max(a, b)}라 - ${Math.min(a, b)}라)`;
        $('rp-round-fee-display').textContent = `${formatMoney(roundFee)} (${headcount}명 기준)`;
        $('rp-total-display').textContent = formatMoney(total);

        const imgText = images.length ? `첨부 ${images.length}장` : '';
        $('rp-copy-text').value =
            `상대 조직 : ${target}\n\nRP 종류 :  ${rpCode}\n\n금액 : ${formatMoney(total)}\n\n최종 스코어 및 승패여부 스크린샷 : ${imgText}`;
    };

    // ---------------------------------------------------------
    // 🛒 건샵털이 장부
    // ---------------------------------------------------------
    let gunRounds = [];     // ['승', '패', ...]
    let weaponChoices = []; // 패배 라운드 순서대로 선택한 총기

    const renderWeaponSelects = () => {
        const losses = gunRounds.filter(r => r === '패').length;
        weaponChoices.length = losses;
        $('weapon-select-group').hidden = losses === 0;
        $('weapon-dropdowns').replaceChildren(...Array.from({ length: losses }, (_, i) => {
            const sel = document.createElement('select');
            sel.className = 'styled-select-sm';
            sel.setAttribute('aria-label', `${i + 1}번째 패배 보상 총기`);
            sel.append(...WEAPONS.map(w => new Option(w, w)));
            weaponChoices[i] = weaponChoices[i] || WEAPONS[0];
            sel.value = weaponChoices[i];
            sel.addEventListener('change', () => { weaponChoices[i] = sel.value; updateGunLedger(); });
            return sel;
        }));
    };

    const updateGunLedger = () => {
        const roundsStr = gunRounds.join('');
        const fine = gunRounds.filter(r => r === '승').length * GUN_FINE;
        const full = gunRounds.length >= MAX_GUN_ROUNDS;

        $('btn-add-win').disabled = full;
        $('btn-add-lose').disabled = full;
        $('btn-remove-round').disabled = gunRounds.length === 0;
        $('gun-round-status').textContent = `진행 결과: [ ${roundsStr || '미입력'} ] (${gunRounds.length}/${MAX_GUN_ROUNDS})`;

        const tally = {};
        weaponChoices.forEach(w => { tally[w] = (tally[w] || 0) + 1; });
        const reward = Object.keys(tally).length
            ? Object.entries(tally).map(([w, c]) => `${w} ${c}자루`).join(', ')
            : 'X';

        $('gun-fine-display').textContent = formatMoney(fine);
        $('gun-reward-display').textContent = reward;
        $('gun-copy-text').value =
            `시민측 참여인원(고번/이름): ${$('gun-citizen').value}\n` +
            `신수측 참여인원(고번/이름): ${$('gun-enemy').value}\n` +
            `라운드 승/패 여부(큰스): ${roundsStr || '미입력'}\n` +
            `벌금: ${formatMoney(fine)}\n` +
            `보상: ${reward}`;
    };

    const changeRounds = (fn) => { fn(); renderWeaponSelects(); updateGunLedger(); };

    // ---------------------------------------------------------
    // 초기화 / 이벤트 바인딩
    // ---------------------------------------------------------
    const copyFrom = async (id, okMsg) =>
        toast((await copyText($(id).value)) ? okMsg : '복사에 실패했습니다.');

    const init = () => {
        $('rp-target-select').append(...TARGET_ORGS.map(o => new Option(o, o)));

        ['rp-target-select', 'rp-type'].forEach(id => $(id).addEventListener('change', updateRpLedger));
        ['rp-ally', 'rp-enemy', 'rp-around', 'rp-bround'].forEach(id => $(id).addEventListener('input', updateRpLedger));
        ['gun-citizen', 'gun-enemy'].forEach(id => $(id).addEventListener('input', updateGunLedger));

        // 이미지: 파일 선택 / Ctrl+V / 드래그&드롭
        $('rp-screenshot-input').addEventListener('change', (e) => {
            Array.from(e.target.files).forEach(addImage);
            e.target.value = '';
        });
        document.addEventListener('paste', (e) => {
            const files = Array.from(e.clipboardData?.items || [])
                .filter(it => it.kind === 'file' && it.type.startsWith('image/'))
                .map(it => it.getAsFile());
            if (!files.length) return; // 일반 텍스트 붙여넣기는 그대로 둠
            e.preventDefault();
            files.forEach(addImage);
        });
        const zone = $('image-drop-zone');
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');
            Array.from(e.dataTransfer.files).forEach(addImage);
        });

        // 건샵털이 버튼
        $('btn-add-win').addEventListener('click', () => changeRounds(() => gunRounds.length < MAX_GUN_ROUNDS && gunRounds.push('승')));
        $('btn-add-lose').addEventListener('click', () => changeRounds(() => gunRounds.length < MAX_GUN_ROUNDS && gunRounds.push('패')));
        $('btn-remove-round').addEventListener('click', () => changeRounds(() => gunRounds.pop()));
        $('btn-reset-round').addEventListener('click', () => changeRounds(() => { gunRounds = []; }));

        // 복사 버튼
        $('btn-copy-rp-text').addEventListener('click', () => { updateRpLedger(); copyFrom('rp-copy-text', '장부 텍스트가 복사되었습니다! 붙여넣은 뒤 ② 스크린샷 복사를 눌러주세요.'); });
        $('btn-copy-rp-image').addEventListener('click', copyRpImage);
        $('btn-copy-gun').addEventListener('click', () => copyFrom('gun-copy-text', '건샵털이 장부가 복사되었습니다!'));

        renderWeaponSelects();
        updateRpLedger();
        updateGunLedger();
    };

    document.addEventListener('DOMContentLoaded', init);
})();