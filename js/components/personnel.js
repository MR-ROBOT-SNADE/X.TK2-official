/* XTK2-PERSONNEL v6 — personnel.js
   PHẢI đi CẶP với components.css cùng đánh số v6. */
/* =============================================================================
 * SƠ ĐỒ TỔ CHỨC NHÂN SỰ THEO CA KÍP (A / B / C)
 * -----------------------------------------------------------------------------
 * Bố cục mỗi mục #kip-A / #kip-B / #kip-C:
 *
 *            +----------- QUẢN LÝ KÍP -----------+
 *            |     ( 3 ô ảnh tròn, cân giữa )    |
 *            +-----------------------------------+
 *
 *     +---- TỔ PHỐI LIỆU ----+      +---- TỔ THIÊU KẾT ----+
 *     |  tổ trưởng + tổ phó  |      |  tổ trưởng + tổ phó  |
 *     +----------+-----------+      +----------+-----------+
 *          +-----+-----+                 +-----+-----+
 *        thành viên  thành viên        thành viên  thành viên
 *
 * KHUNG LUÔN ĐƯỢC DỰNG SẴN, kể cả khi bảng tính chưa có ai — ô trống hiện dạng
 * nét đứt để thấy trước chỗ, nạp dữ liệu vào là tự đầy.
 *
 * NGUỒN DỮ LIỆU: các cột trong tab DATABASE của Google Sheet
 *      STT (A) | Mã nhân viên (A) | Vị trí công việc (A) | Status (A)   (và B, C)
 * Phân người vào nhóm nào thì DỰA VÀO cột "Vị trí công việc" — xem NHOM_RULES.
 *
 * ---------------------------------------------------------------------------
 * NẾU DANH SÁCH KHÔNG HIỆN
 * ---------------------------------------------------------------------------
 * Mở web -> F12 -> Console, gõ:
 *      Object.keys(window.masterSheetDataTK3[0]).filter(k => k.includes('nhân viên'))
 * Ra mảng rỗng nghĩa là API chưa lấy tab DATABASE, cần sửa Google Apps Script.
 * ===========================================================================*/

/* --- Cột dữ liệu từng kíp. Đổi tên cột trong sheet thì sửa ở đây. --------- */
const KIP_COLUMNS = {
    A: { section: 'kip-A', stt: ['STT (A)'], ma: ['Mã nhân viên (A)'],
         viTri: ['Vị trí công việc (A)'], status: ['Status (A)'] },
    B: { section: 'kip-B', stt: ['STT (B)'], ma: ['Mã nhân viên (B)'],
         viTri: ['Vị trí công việc (B)'], status: ['Status (B)'] },
    C: { section: 'kip-C', stt: ['STT (C)'], ma: ['Mã nhân viên (C)'],
         viTri: ['Vị trí công việc (C)'], status: ['Status (C)'] },
};

/* --- QUY TẮC PHÂN NHÓM ----------------------------------------------------
   Đọc cột "Vị trí công việc", khớp TỪ KHOÁ nào thì xếp vào nhóm đó. So khớp
   KHÔNG phân biệt hoa thường.
   Xét theo THỨ TỰ trong mảng, ai khớp trước thì thuộc nhóm đó, nên nhóm quản lý
   kíp phải đặt TRƯỚC hai tổ.
   Sau này chia nhánh công việc chi tiết hơn thì thêm nhóm vào đây. */
const NHOM_RULES = [
    {
        key: 'quan-ly',
        title: 'QUẢN LÝ KÍP',
        layout: 'hero',          // hàng ô ảnh tròn lớn
        tier: 1,                 // KHUNG CẤP 1 — to nhất
        slots: 3,                // luôn dựng đủ 3 ô, thiếu người thì để trống
        match: ['truong kip', 'kip truong', 'pho kip', 'kip pho', 'ky su cong nghe',
                'quan ly kip', 'quan doc', 'pho quan doc'],
    },
    {
        /* NHÓM MỚI — trước đây "Kỹ thuật viên Vận hành" không khớp nhóm nào nên
           bị dồn hết vào ô "CHƯA PHÂN NHÓM". Nay có khung riêng, đặt NGAY DƯỚI
           hàng quản lý kíp. */
        key: 'ky-thuat',
        title: 'KỸ THUẬT VIÊN VẬN HÀNH',
        layout: 'row',           // một hàng ngang, tự xuống dòng
        tier: 2,                 // KHUNG CẤP 2
        slots: 4,                // tối thiểu 4 ô, có bao nhiêu người hiện bấy nhiêu
        match: ['ky thuat vien van hanh', 'ky thuat vien', 'ktv van hanh', 'ktv'],
    },
    {
        key: 'phoi-lieu',
        title: 'TỔ PHỐI LIỆU',
        layout: 'team',          // hộp tổ trưởng + cây thành viên
        tier: 2,                 // tổ trưởng / tổ phó = CẤP 2
        memberTier: 3,           // tổ viên = CẤP 3
        match: ['to phoi lieu', 'tuyen lieu sau tron', 'nha nghien', 'phoi lieu',
                'tron lieu'],
        leaderMatch: ['to truong', 'to pho'],
        leaderSlots: 2,
        memberSlots: 8,
    },
    {
        key: 'thieu-ket',
        title: 'TỔ THIÊU KẾT',
        layout: 'team',
        tier: 2,
        memberTier: 3,
        /* BỔ SUNG 'to thieu ket': trước đây "Tổ trưởng - Tổ thiêu kết" và
           "Tổ Phó - Tổ thiêu kết" không có từ khoá nào khớp nên rơi ra ngoài. */
        match: ['to thieu ket', 'coi lua', 'sau sang phan', 'truoc sang phan',
                'bang tai con thoi', 'may danh dong', 'rut lieu', 'may lam mat vong',
                'may nghien truc don', 'sang phan thanh pham', 'xa quang',
                'tram lay mau', 'thieu ket'],
        leaderMatch: ['to truong', 'to pho'],
        leaderSlots: 2,
        memberSlots: 12,
    },
];

/* Ảnh chân dung đặt theo MÃ NHÂN VIÊN: images/nhan-su/HP12345.jpg
   Chưa có ảnh thì hiện 2 chữ đầu của mã, không vỡ giao diện. */
const NHANSU_ANH_BASE = 'images/nhan-su';

/* Status khớp một trong các từ này thì hiện nhãn XANH, còn lại nhãn XÁM. */
const STATUS_DANG_LAM = ['đang làm việc', 'đã chuyển vị trí'];

/* --- Tiện ích ------------------------------------------------------------ */

const nsText = v => (v === undefined || v === null ? '' : v.toString().trim());
const nsLower = v => nsText(v).toLowerCase();

/* CHÌA KHOÁ SO KHỚP — bỏ dấu tiếng Việt rồi mới so.
   Vì sao bắt buộc: Google Sheets trả chữ ở dạng TỔ HỢP DẤU (NFD), còn từ khoá
   gõ trong file này ở dạng DỰNG SẴN (NFC). Hai chuỗi nhìn giống hệt nhau nhưng
   includes() trả FALSE — đó là lý do "NVVH Máy làm mát vòng" trước đây không
   khớp nổi từ khoá "máy làm mát vòng".
   Bỏ dấu xử lý luôn cả trường hợp gõ thiếu dấu hoặc sai dấu trong bảng tính. */
const nsKey = (v) => nsText(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // xoá mọi dấu thanh, dấu mũ
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ');

function nsFindCol(rows, names) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    return names.find(n => keys.includes(n)) || null;
}

function nsDangLam(status) {
    const s = nsKey(status);
    return STATUS_DANG_LAM.some(k => s.includes(nsKey(k)));
}

/** Đọc toàn bộ nhân sự của một kíp. Trả null nếu bảng tính thiếu cột. */
function nsReadKip(rows, cfg) {
    const colMa = nsFindCol(rows, cfg.ma);
    if (!colMa) return null;

    const colStt = nsFindCol(rows, cfg.stt);
    const colViTri = nsFindCol(rows, cfg.viTri);
    const colStatus = nsFindCol(rows, cfg.status);

    const list = [];
    rows.forEach(row => {
        const ma = nsText(row[colMa]);
        if (!ma) return;
        list.push({
            stt: colStt ? Number(nsText(row[colStt])) || null : null,
            ma,
            viTri: colViTri ? nsText(row[colViTri]) : '',
            status: colStatus ? nsText(row[colStatus]) : '',
        });
    });
    if (list.length && list.every(p => p.stt !== null)) list.sort((a, b) => a.stt - b.stt);
    return list;
}

/** Chia danh sách vào các nhóm theo NHOM_RULES.
 *  Ai không khớp nhóm nào thì gom vào `chuaPhanNhom` — KHÔNG bỏ sót người nào. */
function nsPhanNhom(list) {
    const buckets = {};
    NHOM_RULES.forEach(r => { buckets[r.key] = []; });
    const chuaPhanNhom = [];

    list.forEach(p => {
        const vt = nsKey(p.viTri);
        const rule = NHOM_RULES.find(r => r.match.some(k => vt.includes(k)));
        if (rule) buckets[rule.key].push(p);
        else chuaPhanNhom.push(p);
    });
    return { buckets, chuaPhanNhom };
}

/* --- Dựng giao diện ------------------------------------------------------ */

const nsEl = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/** Ảnh chân dung; hỏng thì thay bằng 2 chữ đầu của mã. */
function nsAvatar(ma, tier = 3) {
    const img = document.createElement('img');
    img.className = `person-avatar person-avatar--t${tier}`;
    img.alt = ma;
    img.loading = 'lazy';
    img.src = `${NHANSU_ANH_BASE}/${ma}.jpg`;
    img.onerror = () => {
        const ph = nsEl('div',
            `person-avatar person-avatar--t${tier} person-avatar--empty`,
            ma.slice(0, 2).toUpperCase());
        img.replaceWith(ph);
    };
    return img;
}

/** Một thẻ nhân sự.
 *  `size` = 'hero' | 'compact' | 'mini'  -> quyết định bề rộng thẻ
 *  `tier` = 1 | 2 | 3                    -> quyết định CỠ KHUNG AVATAR
 *      cấp 1: quản lý kíp                (khung to nhất, viền vàng)
 *      cấp 2: KTV vận hành, tổ trưởng/phó (khung vừa, viền xanh)
 *      cấp 3: tổ viên                     (khung nhỏ, viền xám) */
function nsCard(p, size, tier = 3) {
    const card = nsEl('div', `person-card person-card--${size} person-card--t${tier}`);
    /* Gắn sẵn dữ liệu đã BỎ DẤU để thanh bên lọc nhanh, không phải đọc lại chữ
       hiển thị. Nhờ vậy gõ "khac" vẫn tìm ra "Khắc". */
    card.dataset.ten = nsKey(p.ma);
    card.dataset.vitri = nsKey(p.viTri);
    card.dataset.dangLam = nsDangLam(p.status) ? '1' : '0';
    card.appendChild(nsAvatar(p.ma, tier));

    const info = nsEl('div', 'person-info');
    info.appendChild(nsEl('h4', null, p.ma));
    if (p.viTri) info.appendChild(nsEl('p', 'role', p.viTri));
    if (p.status) {
        info.appendChild(nsEl('span',
            'status ' + (nsDangLam(p.status) ? 'status-online' : 'status-offline'),
            p.status));
    }
    card.appendChild(info);
    return card;
}

/** Ô TRỐNG dành sẵn, hiện nét đứt để thấy trước chỗ. */
function nsEmptyCard(size, label, tier = 3) {
    const card = nsEl('div', `person-card person-card--${size} person-card--t${tier} person-card--empty`);
    card.appendChild(nsEl('div', `person-avatar person-avatar--t${tier} person-avatar--slot`, '+'));
    const info = nsEl('div', 'person-info');
    info.appendChild(nsEl('h4', null, label || 'Chờ nạp'));
    card.appendChild(info);
    return card;
}

/** Hàng QUẢN LÝ KÍP: luôn đủ `slots` ô, cân giữa. */
function nsBuildHero(rule, people, idBase) {
    const sec = nsEl('section', 'org-lead');
    sec.id = `${idBase}--${rule.key}`;
    sec.appendChild(nsEl('h3', 'org-title', rule.title));

    const row = nsEl('div', 'org-lead__row');
    const n = Math.max(rule.slots, people.length);
    for (let i = 0; i < n; i++) {
        row.appendChild(people[i]
            ? nsCard(people[i], 'hero', rule.tier)
            : nsEmptyCard('hero', null, rule.tier));
    }
    sec.appendChild(row);
    return sec;
}

/** Hàng ngang tự xuống dòng — dùng cho KỸ THUẬT VIÊN VẬN HÀNH. */
function nsBuildRow(rule, people, idBase) {
    const sec = nsEl('section', `org-row org-row--${rule.key}`);
    sec.id = `${idBase}--${rule.key}`;
    sec.appendChild(nsEl('h3', 'org-title', rule.title));

    const row = nsEl('div', 'org-row__list');
    const n = Math.max(rule.slots, people.length);
    for (let i = 0; i < n; i++) {
        row.appendChild(people[i]
            ? nsCard(people[i], 'compact', rule.tier)
            : nsEmptyCard('compact', 'Kỹ thuật viên', rule.tier));
    }
    sec.appendChild(row);
    return sec;
}

/** Nhãn hộp nhóm: bỏ tiền tố "NVVH" / "Nhân viên" cho gọn.
 *  "NVVH Băng tải - Sau sàng phân" -> "Băng tải - Sau sàng phân"
 *  "Nhân viên Coi lửa"             -> "Coi lửa" */
function nsNhanLabel(viTri) {
    /* .normalize('NFC') là BẮT BUỘC: Google Sheets trả chữ ở dạng tổ hợp dấu
       (NFD), còn "Nhân viên" gõ trong file này ở dạng dựng sẵn (NFC) — không
       quy về cùng một dạng thì regex dưới đây không bao giờ khớp. */
    let t = nsText(viTri).normalize('NFC')
        .replace(/^\s*(NVVH|NV|Nhân viên|Nhan vien)\s*/i, '')
        .replace(/^[-–—\s]+/, '')
        .trim();
    if (!t) return 'Khác';
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** GOM TỔ VIÊN THEO VỊ TRÍ LÀM VIỆC.
 *  Trước đây mỗi người một nhánh -> cây dài lê thê, đầy khoảng trống.
 *  Nay mỗi VỊ TRÍ là MỘT HỘP, mọi người cùng vị trí nằm gọn trong hộp đó.
 *  Gom theo chìa khoá đã bỏ dấu nên "Coi lửa" và "coi lua" về chung một hộp.
 *  Hộp đông người xếp trước để hai bên nhánh cân nhau. */
function nsGomTheoViTri(members) {
    const map = new Map();
    members.forEach((p) => {
        const k = nsKey(p.viTri) || '~khac';
        if (!map.has(k)) map.set(k, { label: nsNhanLabel(p.viTri), people: [] });
        map.get(k).people.push(p);
    });
    return [...map.values()].sort((a, b) => b.people.length - a.people.length);
}

/** Một TỔ: hộp tổ trưởng/tổ phó ở trên, các HỘP VỊ TRÍ rẽ hai bên bên dưới. */
function nsBuildTeam(rule, people, idBase) {
    const leaders = people.filter(p =>
        rule.leaderMatch.some(k => nsKey(p.viTri).includes(k)));
    const members = people.filter(p => leaders.indexOf(p) === -1);

    const sec = nsEl('section', `org-team org-team--${rule.key}`);
    sec.id = `${idBase}--${rule.key}`;
    sec.appendChild(nsEl('h3', 'org-title', rule.title));

    /* Hộp trên: tổ trưởng + tổ phó */
    const head = nsEl('div', 'org-team__head');
    const nLead = Math.max(rule.leaderSlots, leaders.length);
    for (let i = 0; i < nLead; i++) {
        head.appendChild(leaders[i]
            ? nsCard(leaders[i], 'compact', rule.tier)
            : nsEmptyCard('compact', i === 0 ? 'Tổ trưởng' : 'Tổ phó', rule.tier));
    }
    sec.appendChild(head);

    /* Nhánh: thân dọc ở giữa, các HỘP VỊ TRÍ toả sang hai bên */
    const branch = nsEl('div', 'org-branch');
    const nhom = nsGomTheoViTri(members);

    if (!nhom.length) {
        const box = nsEl('div', 'org-group org-group--empty');
        box.appendChild(nsEl('h4', 'org-group__title', 'Chưa có tổ viên'));
        const list = nsEl('div', 'org-group__list');
        for (let i = 0; i < 3; i++) {
            list.appendChild(nsEmptyCard('mini', 'Tổ viên', rule.memberTier));
        }
        box.appendChild(list);
        branch.appendChild(box);
    } else {
        nhom.forEach((g, gi) => {
            const box = nsEl('div', 'org-group');
            box.id = `${idBase}--${rule.key}--${gi}`;
            const title = nsEl('h4', 'org-group__title', g.label);
            title.appendChild(nsEl('span', 'org-group__count', String(g.people.length)));
            box.appendChild(title);

            const list = nsEl('div', 'org-group__list');
            g.people.forEach(p => list.appendChild(nsCard(p, 'mini', rule.memberTier)));
            box.appendChild(list);
            branch.appendChild(box);
        });
    }

    sec.appendChild(branch);
    return sec;
}

/** Khung báo lỗi / chưa có dữ liệu. */
function nsNotice(message, hint) {
    const box = nsEl('div', 'personnel-empty');
    box.appendChild(nsEl('span', null, message));
    if (hint) box.appendChild(nsEl('code', null, hint));
    return box;
}

/* =============================================================================
 * THANH BÊN TRÁI — TÌM VÀ LỌC NHÂN SỰ
 * -----------------------------------------------------------------------------
 *   1) Ô tìm: gõ TÊN hoặc VỊ TRÍ, các thẻ không khớp ẩn đi ngay. So khớp đã bỏ
 *      dấu nên gõ "khac" vẫn ra "Khắc", "sang phan" vẫn ra "Sàng phân".
 *   2) Lọc TRẠNG THÁI: tất cả / đang làm việc / không còn làm.
 *   3) Danh sách KHU VỰC kèm sĩ số — bấm là nhảy thẳng tới khối đó.
 *      Có đủ cả Quản lý kíp và Kỹ thuật viên vận hành, không chỉ hai tổ.
 * Khối nào lọc xong không còn ai thì tự ẩn, sĩ số bên cạnh cập nhật theo.
 * ===========================================================================*/

/** Một dòng khu vực trong thanh bên. */
function nsSideLink(label, count, targetId, level) {
    const a = nsEl('button', `ns-area ns-area--l${level}`);
    a.type = 'button';
    a.dataset.target = targetId;
    a.appendChild(nsEl('span', 'ns-area__name', label));
    a.appendChild(nsEl('span', 'ns-area__num', String(count)));
    return a;
}

/** Dựng thanh bên cho một kíp. */
function nsBuildSide(key, list, phan, idBase) {
    const side = nsEl('aside', 'ns-side');

    /* --- Ô tìm --- */
    const boxSearch = nsEl('div', 'ns-box');
    const input = document.createElement('input');
    input.type = 'search';
    input.className = 'ns-search';
    input.placeholder = 'Tìm tên hoặc vị trí…';
    input.setAttribute('aria-label', `Tìm nhân sự kíp ${key}`);
    boxSearch.appendChild(input);
    side.appendChild(boxSearch);

    /* --- Lọc trạng thái --- */
    const dangLam = list.filter(p => nsDangLam(p.status)).length;
    const boxSt = nsEl('div', 'ns-box');
    boxSt.appendChild(nsEl('h4', 'ns-box__title', 'TRẠNG THÁI LÀM VIỆC'));
    [['all', 'Tất cả', list.length],
     ['on', 'Đang làm việc', dangLam],
     ['off', 'Không còn làm', list.length - dangLam]].forEach(([v, ten, n]) => {
        const b = nsEl('button', `ns-st ns-st--${v}${v === 'all' ? ' is-on' : ''}`);
        b.type = 'button';
        b.dataset.st = v;
        b.appendChild(nsEl('span', null, ten));
        b.appendChild(nsEl('span', 'ns-st__num', String(n)));
        boxSt.appendChild(b);
    });
    side.appendChild(boxSt);

    /* --- Danh sách khu vực --- */
    const boxArea = nsEl('div', 'ns-box ns-box--areas');
    boxArea.appendChild(nsEl('h4', 'ns-box__title', 'KHU VỰC LÀM VIỆC'));

    NHOM_RULES.forEach((r) => {
        const people = phan.buckets[r.key] || [];
        boxArea.appendChild(nsSideLink(r.title, people.length, `${idBase}--${r.key}`, 1));

        /* Với hai tổ thì liệt kê tiếp từng vị trí bên trong */
        if (r.layout !== 'team') return;
        const leaders = people.filter(p =>
            r.leaderMatch.some(k => nsKey(p.viTri).includes(k)));
        const members = people.filter(p => leaders.indexOf(p) === -1);
        if (leaders.length) {
            boxArea.appendChild(nsSideLink('Tổ trưởng / Tổ phó', leaders.length,
                `${idBase}--${r.key}`, 2));
        }
        nsGomTheoViTri(members).forEach((g, gi) => {
            boxArea.appendChild(nsSideLink(g.label, g.people.length,
                `${idBase}--${r.key}--${gi}`, 2));
        });
    });

    if (phan.chuaPhanNhom.length) {
        boxArea.appendChild(nsSideLink('Chưa phân nhóm', phan.chuaPhanNhom.length,
            `${idBase}--khac`, 1));
    }
    side.appendChild(boxArea);

    side.appendChild(nsEl('p', 'ns-hint', 'Bấm một khu vực để nhảy tới. '
        + 'Trạng thái của từng người hiện ngay dưới ảnh đại diện.'));
    return side;
}

/** Áp bộ lọc lên toàn bộ thẻ trong một kíp. */
function nsApplyFilter(root, q, st) {
    const key = nsKey(q);
    let hien = 0;

    root.querySelectorAll('.person-card').forEach((c) => {
        /* Ô trống chỉ hiện khi KHÔNG lọc gì */
        if (c.classList.contains('person-card--empty')) {
            c.classList.toggle('is-hidden', Boolean(key) || st !== 'all');
            return;
        }
        const hopTen = !key || (c.dataset.ten || '').includes(key)
                            || (c.dataset.vitri || '').includes(key);
        const hopSt = st === 'all'
            || (st === 'on' && c.dataset.dangLam === '1')
            || (st === 'off' && c.dataset.dangLam === '0');
        const hien1 = hopTen && hopSt;
        c.classList.toggle('is-hidden', !hien1);
        if (hien1) hien += 1;
    });

    /* Khối nào không còn ai thì ẩn luôn cho gọn */
    root.querySelectorAll('.org-group, .org-lead, .org-row, .org-team').forEach((b) => {
        const con = b.querySelectorAll('.person-card:not(.is-hidden)').length;
        b.classList.toggle('is-hidden', con === 0);
    });

    /* Báo số kết quả */
    const bao = root.querySelector('.ns-result');
    if (bao) {
        const loc = Boolean(key) || st !== 'all';
        bao.textContent = loc ? `Tìm thấy ${hien} người` : '';
        bao.classList.toggle('is-hidden', !loc);
    }
}

/** Đọc mốc chừa chỗ (--ns-offset) từ CSS để JS và CSS không bao giờ lệch nhau. */
function nsOffset(el) {
    try {
        const v = getComputedStyle(el).scrollMarginTop;
        if (v && v.endsWith('px')) return parseFloat(v);
    } catch { /* môi trường không có getComputedStyle */ }
    return 232;
}

/** Kéo khối về đúng mốc, TỨC THÌ.
 *  Vì sao KHÔNG dùng scrollIntoView mượt:
 *    Lọc xong danh sách ngắn lại -> trang thấp xuống -> trình duyệt TỰ KẸP vị
 *    trí cuộn về mức tối đa mới. Cú kẹp đó xảy ra ngay, còn cuộn mượt thì trượt
 *    dần trong ~300ms — mắt thấy rõ thanh bên bị đẩy lên rồi mới bò về.
 *    Đặt thẳng scrollTop là xong trong một khung hình, không thấy nhúc nhích. */
function nsGhimVeMoc(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const off = nsOffset(el);
    const top = el.getBoundingClientRect().top;
    if (top >= off - 4) return;                 // đang thấy rồi thì để yên
    const y = (window.pageYOffset || 0) + top - off;
    if (typeof window.scrollTo === 'function') window.scrollTo(0, Math.max(0, y));
}

/** Ghim rồi kiểm lại một khung hình sau.
 *  Một số trình duyệt kẹp vị trí cuộn SAU khi mình đo, nên ghim một lần có thể
 *  vẫn lệch; kiểm lại ở khung hình kế là chắc chắn đứng yên. */
function nsGhimChac(el) {
    nsGhimVeMoc(el);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => nsGhimVeMoc(el));
    }
}

/** Nối thanh bên với phần nội dung. */
function nsWireSide(side, main) {
    const state = { q: '', st: 'all' };
    const apply = () => {
        nsApplyFilter(main, state.q, state.st);
        /* Lọc xong danh sách ngắn lại -> trang co lên, thanh bên và kết quả trôi
           vào gầm tiêu đề. Ghim về đầu mục để mọi thứ đứng yên. */
        nsGhimChac(main);
    };

    const input = side.querySelector('.ns-search');
    if (input) {
        input.addEventListener('input', () => { state.q = input.value; apply(); });
    }

    side.querySelectorAll('.ns-st').forEach((b) => {
        b.addEventListener('click', () => {
            side.querySelectorAll('.ns-st').forEach(x => x.classList.remove('is-on'));
            b.classList.add('is-on');
            state.st = b.dataset.st;
            apply();
        });
    });

    side.querySelectorAll('.ns-area').forEach((a) => {
        a.addEventListener('click', () => {
            const el = document.getElementById(a.dataset.target);
            if (!el) return;
            side.querySelectorAll('.ns-area').forEach(x => x.classList.remove('is-on'));
            a.classList.add('is-on');
            /* Cuộn thẳng bằng scrollIntoView sẽ đưa mép trên khối lên sát mép
               cửa sổ, tức chui vào gầm 2 thanh cố định + tiêu đề dính. CSS đã
               đặt scroll-margin-top cho các khối này nên trình duyệt dừng sớm
               đúng bấy nhiêu, thấy trọn tên và ảnh người đầu tiên. */
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            /* Nháy viền cho dễ nhận ra khối vừa nhảy tới */
            el.classList.add('is-flash');
            setTimeout(() => el.classList.remove('is-flash'), 1400);
        });
    });
}

/** Dựng một kíp. */
function nsRenderKip(key, cfg, list) {
    const section = document.getElementById(cfg.section);
    if (!section) return;
    const grid = section.querySelector('.personnel-grid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.classList.add('personnel-grid--org');

    /* Dòng đếm gắn THẲNG VÀO tiêu đề mục (thanh dính) chứ không để trong lưới —
       để nó không bị chính tiêu đề che khi cuộn. Xoá bản cũ trước khi gắn mới. */
    const header = section.querySelector('.section-header');
    const oldSum = section.querySelector('.section-header .personnel-summary');
    if (oldSum) oldSum.remove();
    const putSummary = (text) => {
        if (!header) { grid.appendChild(nsEl('p', 'personnel-summary', text)); return; }
        header.appendChild(nsEl('p', 'personnel-summary', text));
    };

    if (list === null) {
        grid.appendChild(nsNotice(`Chưa lấy được danh sách kíp ${key}`,
            `thiếu cột: ${cfg.ma.join(' | ')}`));
        console.warn(`[Nhân sự] Kíp ${key}: không tìm thấy cột nào trong `
            + `${cfg.ma.join(' | ')}. Tra tên cột thật bằng: `
            + `Object.keys(window.masterSheetDataTK3[0])`);
        return;
    }

    if (list.length) {
        const dangLam = list.filter(p => nsDangLam(p.status)).length;
        putSummary(list.some(p => p.status)
            ? `${list.length} nhân sự — ${dangLam} đang làm việc`
            : `${list.length} nhân sự`);
    }

    const phan = nsPhanNhom(list);
    const idBase = cfg.section;

    /* --- Hai cột: thanh bên TRÁI + nội dung PHẢI --- */
    const side = nsBuildSide(key, list, phan, idBase);
    const main = nsEl('div', 'ns-main');
    grid.appendChild(side);
    grid.appendChild(main);

    /* Chưa có ai vẫn dựng đủ khung, chỉ thêm một dòng nhắc phía trên.
       Dòng nhắc phải nằm TRONG cột nội dung, không thả thẳng vào lưới 2 cột —
       thả vào lưới là nó chiếm mất ô đầu và đẩy lệch cả bố cục. */
    if (!list.length) {
        main.appendChild(nsNotice(`Kíp ${key} chưa có nhân sự trong bảng tính — `
            + `khung dưới đây là chỗ dành sẵn`));
    }
    main.appendChild(nsEl('p', 'ns-result is-hidden'));

    /* Hàng quản lý kíp */
    const heroRule = NHOM_RULES.filter(r => r.layout === 'hero')[0];
    if (heroRule) main.appendChild(nsBuildHero(heroRule, phan.buckets[heroRule.key], idBase));

    /* Hàng KỸ THUẬT VIÊN VẬN HÀNH — ngay dưới hàng quản lý kíp */
    NHOM_RULES.filter(r => r.layout === 'row')
        .forEach(r => main.appendChild(nsBuildRow(r, phan.buckets[r.key], idBase)));

    /* Hai tổ đặt cạnh nhau */
    const teams = nsEl('div', 'org-teams');
    NHOM_RULES.filter(r => r.layout === 'team')
        .forEach(r => teams.appendChild(nsBuildTeam(r, phan.buckets[r.key], idBase)));
    main.appendChild(teams);

    /* Ai chưa khớp nhóm nào thì xếp riêng, KHÔNG âm thầm bỏ sót */
    if (phan.chuaPhanNhom.length) {
        const sec = nsEl('section', 'org-team org-team--khac');
        sec.id = `${idBase}--khac`;
        sec.appendChild(nsEl('h3', 'org-title', 'CHƯA PHÂN NHÓM'));
        const row = nsEl('div', 'org-team__head');
        phan.chuaPhanNhom.forEach(p => row.appendChild(nsCard(p, 'compact', 3)));
        sec.appendChild(row);
        main.appendChild(sec);
        console.warn(`[Nhân sự] Kíp ${key}: ${phan.chuaPhanNhom.length} người chưa khớp `
            + `nhóm nào (vị trí: ${phan.chuaPhanNhom.map(p => p.viTri || '—').join(', ')}). `
            + `Bổ sung từ khoá vào NHOM_RULES trong personnel.js.`);
    }

    nsWireSide(side, main);
}

/* =============================================================================
 * NHỚ DỮ LIỆU (cache) — hiện danh sách NGAY, không đợi tải xong Google Sheet
 * -----------------------------------------------------------------------------
 * Lần đầu vào web thì vẫn phải chờ API. Nhưng lần sau:
 *   1) Vừa mở trang là dựng luôn danh sách từ bản đã nhớ trong máy  -> thấy ngay
 *   2) API tải xong, so DẤU VÂN TAY dữ liệu với bản đã nhớ:
 *        - GIỐNG  -> KHÔNG vẽ lại gì cả, khỏi tốn công
 *        - KHÁC   -> vẽ lại và ghi đè bản nhớ
 * Nhờ vậy sửa bảng tính vẫn cập nhật đúng, mà mở trang thì không phải chờ.
 *
 * Bản nhớ để trong localStorage của trình duyệt, chỉ máy người xem giữ, không
 * gửi đi đâu. Xoá bằng: localStorage.removeItem('xtk2.nhansu.v1')
 * ===========================================================================*/
const NS_CACHE_KEY = 'xtk2.nhansu.v1';

/** Dấu vân tay của dữ liệu: đổi một ký tự trong bảng tính là số này đổi theo. */
function nsFingerprint(data) {
    const str = JSON.stringify(data);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return `${str.length}-${h.toString(36)}`;
}

/** Đọc bản nhớ. Trình duyệt chặn localStorage (chế độ ẩn danh) thì trả null. */
function nsCacheRead() {
    try {
        const raw = window.localStorage.getItem(NS_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return (obj && obj.data && obj.fp) ? obj : null;
    } catch { return null; }
}

function nsCacheWrite(data, fp) {
    try {
        window.localStorage.setItem(NS_CACHE_KEY, JSON.stringify({ fp, data, at: Date.now() }));
    } catch { /* hết chỗ hoặc bị chặn — bỏ qua, không ảnh hưởng hiển thị */ }
}

/** Rút gọn dữ liệu 3 kíp thành đúng phần cần dùng, để nhớ và để so sánh. */
function nsExtractAll(rows) {
    const out = {};
    Object.keys(KIP_COLUMNS).forEach(key => {
        out[key] = nsReadKip(rows, KIP_COLUMNS[key]);
    });
    return out;
}

/** Vẽ cả 3 kíp từ dữ liệu đã rút gọn. */
function nsRenderFrom(data) {
    Object.keys(KIP_COLUMNS).forEach(key => nsRenderKip(key, KIP_COLUMNS[key], data[key]));
}

let nsShownFp = null;          // dấu vân tay của thứ đang hiện trên màn hình

/* --- 1) Vào trang: dựng ngay từ bản nhớ --- */
function nsBootFromCache() {
    const cached = nsCacheRead();
    if (!cached) return;
    nsRenderFrom(cached.data);
    nsShownFp = cached.fp;
    console.info('[Nhân sự] Đã dựng từ bản nhớ trong máy — không phải chờ tải dữ liệu.');
}

/* Thẻ <script> đặt ở CUỐI body nên 3 mục #kip-A/B/C đã có sẵn khi file này
   chạy -> dựng NGAY, không chờ DOMContentLoaded.
   Chỉ khi chưa thấy mục nào (thẻ script bị dời lên <head>) mới phải chờ.
   Quan trọng: nếu chờ DOMContentLoaded mà dữ liệu API về TRƯỚC thì bản nhớ
   thành vô dụng — vẫn đúng nhưng mất hết tác dụng tăng tốc. */
if (document.getElementById(KIP_COLUMNS.A.section)) {
    nsBootFromCache();
} else {
    document.addEventListener('DOMContentLoaded', nsBootFromCache);
}

/* --- 2) API tải xong: chỉ vẽ lại KHI dữ liệu thật sự đổi --- */
/** Kiểm tra components.css có đúng bản đi kèm không.
 *  Vì sao cần: JS và CSS là hai file rời, chép nhầm một bản cũ là thanh bên
 *  hiện ra trần trụi mà không có lỗi nào trong Console — rất khó đoán.
 *  Ở đây đo thẳng một thuộc tính chỉ bản mới mới có. */
function nsKiemTraCss() {
    const side = document.querySelector('.ns-side');
    if (!side || typeof getComputedStyle !== 'function') return;
    let ok = false;
    try { ok = getComputedStyle(side).position === 'sticky'; } catch { return; }
    if (!ok) {
        console.error('[Nhân sự] components.css KHÔNG PHẢI bản đi kèm '
            + '(thiếu định dạng thanh bên .ns-side). Thanh tìm/lọc sẽ hiện trần trụi. '
            + 'Hãy chép đè css/components.css bằng bản v6 rồi build lại.');
    }
}

function nsRenderAll() {
    const data = nsExtractAll(window.masterSheetDataTK3);
    const fp = nsFingerprint(data);

    if (fp === nsShownFp) {
        console.info('[Nhân sự] Bảng tính không đổi — giữ nguyên, không vẽ lại.');
        return;
    }

    nsRenderFrom(data);
    nsShownFp = fp;
    nsCacheWrite(data, fp);
    nsKiemTraCss();
    console.info('[Nhân sự] Bảng tính có thay đổi — đã cập nhật sơ đồ tổ chức 3 kíp A / B / C.');
}

document.addEventListener('TK3DataReady', nsRenderAll);
