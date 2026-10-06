/* XTK2-PERSONNEL v6 — personnel.js
   PHẢI đi CẶP với css/components.css cùng đánh số v6 (xem nsKiemTraCss ở cuối). */
/* =============================================================================
 * SƠ ĐỒ TỔ CHỨC NHÂN SỰ 3 KÍP A / B / C
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Dựng sơ đồ tổ chức của từng kíp trong các mục #kip-A, #kip-B, #kip-C:
 *
 *       [thanh bên: tìm / lọc / khu vực]   QUẢN LÝ KÍP        (3 ô ảnh lớn)
 *                                          KỸ THUẬT VIÊN VẬN HÀNH (một hàng)
 *                                          TỔ PHỐI LIỆU   |   TỔ THIÊU KẾT
 *                                           tổ trưởng/phó |   tổ trưởng/phó
 *                                           hộp từng vị trí   hộp từng vị trí
 *
 *   Khung luôn được dựng đủ, kể cả khi bảng tính chưa có ai: ô trống hiện nét
 *   đứt để thấy trước chỗ, nạp dữ liệu vào là tự đầy.
 *
 * NGUỒN DỮ LIỆU
 *   Các cột trong tab DATABASE của Google Sheet TK3 (window.masterSheetDataTK3):
 *       STT (A) | Mã nhân viên (A) | Vị trí công việc (A) | Status (A)   (và B, C)
 *   Đây là DANH SÁCH dọc, không theo ngày: hàng i của các cột (A) là người thứ i
 *   của kíp A. Cột "Mã nhân viên" thực tế đang ghi HỌ TÊN — trang hiện nguyên
 *   văn cột đó làm tên.
 *   Xếp người vào nhóm nào DỰA VÀO cột "Vị trí công việc" — xem NHOM_RULES.
 *
 * LUỒNG CHẠY
 *   1) Mở trang: dựng ngay từ BẢN NHỚ trong máy (localStorage) nếu có.
 *   2) Sự kiện TK3DataReady: rút phần nhân sự, so vân tay với thứ đang hiện —
 *      khác thì vẽ lại và ghi đè bản nhớ, giống thì thôi.
 *
 * NẾU DANH SÁCH KHÔNG HIỆN
 *   Mở web -> F12 -> Console, gõ:
 *       Object.keys(window.masterSheetDataTK3[0]).filter(k => k.includes('nhân viên'))
 *   Ra mảng rỗng nghĩa là dữ liệu không có các cột nhân sự (tab DATABASE).
 * ===========================================================================*/

/* --- Tên cột của từng kíp. Sheet đổi tên cột thì sửa ở đây. ----------------
   section: id mục trong index.html. Mỗi trường là DANH SÁCH tên có thể có —
   lấy tên đầu tiên tìm thấy. */
const KIP_COLUMNS = {
    A: { section: 'kip-A', stt: ['STT (A)'], ma: ['Mã nhân viên (A)'],
         viTri: ['Vị trí công việc (A)'], status: ['Status (A)'] },
    B: { section: 'kip-B', stt: ['STT (B)'], ma: ['Mã nhân viên (B)'],
         viTri: ['Vị trí công việc (B)'], status: ['Status (B)'] },
    C: { section: 'kip-C', stt: ['STT (C)'], ma: ['Mã nhân viên (C)'],
         viTri: ['Vị trí công việc (C)'], status: ['Status (C)'] },
};

/* --- QUY TẮC PHÂN NHÓM ----------------------------------------------------
   Đọc cột "Vị trí công việc" (đã BỎ DẤU, chữ thường), chứa TỪ KHOÁ nào trong
   match thì xếp vào nhóm đó. Từ khoá viết không dấu, chữ thường.
   Xét theo THỨ TỰ trong mảng, khớp nhóm nào trước thì thuộc nhóm đó — nên nhóm
   quản lý kíp phải đặt TRƯỚC hai tổ.
   Các trường:
     key        mã nhóm (dùng làm id khối)       title   tiêu đề hiện trên trang
     layout     'hero' (hàng ảnh lớn) | 'row' (hàng ngang) | 'team' (tổ: hộp
                tổ trưởng + các hộp vị trí)
     tier       cấp khung ảnh: 1 to nhất (viền vàng), 2 vừa (xanh), 3 nhỏ (xám)
     slots      số ô tối thiểu (thiếu người thì để ô trống)
     leaderMatch (tổ) từ khoá nhận ra tổ trưởng / tổ phó
     leaderSlots, memberTier, memberSlots  (tổ) số ô tổ trưởng, cấp khung tổ viên...
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
        /* Trước đây "Kỹ thuật viên Vận hành" không khớp nhóm nào nên bị dồn hết
           vào ô "CHƯA PHÂN NHÓM". Nay có khung riêng, NGAY DƯỚI hàng quản lý kíp. */
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
        layout: 'team',          // hộp tổ trưởng + các hộp vị trí
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
        /* Có 'to thieu ket': trước đây "Tổ trưởng - Tổ thiêu kết" và "Tổ Phó - Tổ
           thiêu kết" không có từ khoá nào khớp nên rơi ra ngoài. */
        match: ['to thieu ket', 'coi lua', 'sau sang phan', 'truoc sang phan',
                'bang tai con thoi', 'may danh dong', 'rut lieu', 'may lam mat vong',
                'may nghien truc don', 'sang phan thanh pham', 'xa quang',
                'tram lay mau', 'thieu ket'],
        leaderMatch: ['to truong', 'to pho'],
        leaderSlots: 2,
        memberSlots: 12,
    },
];

/* Ảnh chân dung đặt theo giá trị cột "Mã nhân viên": images/nhan-su/<giá trị>.jpg
   Chưa có ảnh thì hiện 2 chữ đầu, không vỡ giao diện. */
const NHANSU_ANH_BASE = 'images/nhan-su';

/* Status chứa một trong các cụm này thì hiện nhãn XANH, còn lại nhãn XÁM. */
const STATUS_DANG_LAM = ['đang làm việc', 'đã chuyển vị trí'];

/* =============================================================================
 * TIỆN ÍCH ĐỌC DỮ LIỆU
 * ===========================================================================*/

/** Giá trị ô -> chuỗi đã cắt khoảng trắng hai đầu (null/undefined -> ''). */
const nsText = v => (v === undefined || v === null ? '' : v.toString().trim());
const nsLower = v => nsText(v).toLowerCase();

/** CHÌA KHOÁ SO KHỚP — bỏ dấu tiếng Việt, chữ thường, gộp khoảng trắng:
 *    nsKey('NVVH Máy  làm mát vòng') -> 'nvvh may lam mat vong'
 *  Vì sao bắt buộc: Google Sheets có thể trả chữ ở dạng TỔ HỢP DẤU (NFD), còn từ
 *  khoá gõ trong file này ở dạng DỰNG SẴN (NFC). Hai chuỗi nhìn giống hệt nhau
 *  nhưng includes() trả FALSE — đó là lý do "NVVH Máy làm mát vòng" trước đây
 *  không khớp nổi từ khoá "máy làm mát vòng". Bỏ dấu cũng xử lý luôn trường hợp
 *  gõ thiếu dấu hoặc sai dấu trong bảng tính. */
const nsKey = (v) => nsText(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // xoá mọi dấu thanh, dấu mũ
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ');

/** Trong danh sách tên `names`, lấy tên đầu tiên thực sự là một cột của rows. */
function nsFindCol(rows, names) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    return names.find(n => keys.includes(n)) || null;
}

/** Status này có tính là "đang làm việc" không (xem STATUS_DANG_LAM). */
function nsDangLam(status) {
    const s = nsKey(status);
    return STATUS_DANG_LAM.some(k => s.includes(nsKey(k)));
}

/** Đọc toàn bộ nhân sự của một kíp -> [{ stt, ma, viTri, status }], xếp theo STT
 *  (nếu mọi người đều có STT). Trả null nếu bảng tính thiếu cột "Mã nhân viên". */
function nsReadKip(rows, cfg) {
    const colMa = nsFindCol(rows, cfg.ma);
    if (!colMa) return null;

    const colStt = nsFindCol(rows, cfg.stt);
    const colViTri = nsFindCol(rows, cfg.viTri);
    const colStatus = nsFindCol(rows, cfg.status);

    const list = [];
    rows.forEach(row => {
        const ma = nsText(row[colMa]);
        if (!ma) return;                       // hàng trống -> bỏ
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
 *  Ra { buckets: { 'quan-ly': [...], 'ky-thuat': [...], ... }, chuaPhanNhom: [...] }.
 *  Ai không khớp nhóm nào thì vào chuaPhanNhom — KHÔNG bỏ sót người nào. */
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

/* =============================================================================
 * DỰNG GIAO DIỆN — THẺ NGƯỜI VÀ CÁC KHỐI
 * ===========================================================================*/

/** Tạo nhanh một thẻ HTML: nsEl('div', 'lop-css', 'chữ'). */
const nsEl = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/** Ảnh chân dung (tải lười — chỉ tải khi cuộn tới). Ảnh lỗi / chưa có thì thay
 *  bằng ô tròn ghi 2 chữ đầu. tier: cấp khung (1 / 2 / 3). */
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

/** Một thẻ nhân sự: ảnh + tên + vị trí + nhãn trạng thái.
 *  size = 'hero' | 'compact' | 'mini'  -> bề rộng thẻ
 *  tier = 1 | 2 | 3                    -> CỠ KHUNG ảnh
 *      cấp 1: quản lý kíp                (khung to nhất, viền vàng)
 *      cấp 2: KTV vận hành, tổ trưởng/phó (khung vừa, viền xanh)
 *      cấp 3: tổ viên                     (khung nhỏ, viền xám) */
function nsCard(p, size, tier = 3) {
    const card = nsEl('div', `person-card person-card--${size} person-card--t${tier}`);
    /* Gắn sẵn chữ đã BỎ DẤU vào data-* để thanh bên lọc nhanh, không phải đọc
       lại chữ hiển thị. Nhờ vậy gõ "khac" vẫn tìm ra "Khắc". */
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

/** Ô TRỐNG dành sẵn (nét đứt, dấu +), ghi nhãn label (mặc định "Chờ nạp"). */
function nsEmptyCard(size, label, tier = 3) {
    const card = nsEl('div', `person-card person-card--${size} person-card--t${tier} person-card--empty`);
    card.appendChild(nsEl('div', `person-avatar person-avatar--t${tier} person-avatar--slot`, '+'));
    const info = nsEl('div', 'person-info');
    info.appendChild(nsEl('h4', null, label || 'Chờ nạp'));
    card.appendChild(info);
    return card;
}

/** Hàng QUẢN LÝ KÍP (layout 'hero'): luôn đủ rule.slots ô, cân giữa.
 *  idBase: id mục (vd 'kip-A') — khối có id 'kip-A--quan-ly' để thanh bên nhảy tới. */
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

/** Hàng ngang tự xuống dòng (layout 'row') — dùng cho KỸ THUẬT VIÊN VẬN HÀNH. */
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

/** Nhãn hộp vị trí: bỏ tiền tố "NVVH" / "Nhân viên" cho gọn, viết hoa chữ đầu.
 *    "NVVH Băng tải - Sau sàng phân" -> "Băng tải - Sau sàng phân"
 *    "Nhân viên Coi lửa"             -> "Coi lửa" */
function nsNhanLabel(viTri) {
    /* .normalize('NFC') là BẮT BUỘC: Google Sheets có thể trả chữ ở dạng tổ hợp
       dấu (NFD), còn "Nhân viên" gõ trong file này ở dạng dựng sẵn (NFC) — không
       quy về cùng một dạng thì regex dưới đây không bao giờ khớp. */
    let t = nsText(viTri).normalize('NFC')
        .replace(/^\s*(NVVH|NV|Nhân viên|Nhan vien)\s*/i, '')
        .replace(/^[-–—\s]+/, '')
        .trim();
    if (!t) return 'Khác';
    return t.charAt(0).toUpperCase() + t.slice(1);
}

/** GOM TỔ VIÊN THEO VỊ TRÍ LÀM VIỆC -> [{ label, people }].
 *  Mỗi VỊ TRÍ là MỘT HỘP, mọi người cùng vị trí nằm gọn trong hộp đó (trước đây
 *  mỗi người một nhánh -> cây dài lê thê). Gom theo chìa khoá đã bỏ dấu nên
 *  "Coi lửa" và "coi lua" về chung một hộp. Hộp đông người xếp trước để hai bên
 *  nhánh cân nhau. */
function nsGomTheoViTri(members) {
    const map = new Map();
    members.forEach((p) => {
        const k = nsKey(p.viTri) || '~khac';
        if (!map.has(k)) map.set(k, { label: nsNhanLabel(p.viTri), people: [] });
        map.get(k).people.push(p);
    });
    return [...map.values()].sort((a, b) => b.people.length - a.people.length);
}

/** Một TỔ (layout 'team'): hộp tổ trưởng / tổ phó ở trên, các HỘP VỊ TRÍ toả hai
 *  bên một thân dọc bên dưới. Hộp vị trí thứ gi có id '<idBase>--<key>--<gi>'. */
function nsBuildTeam(rule, people, idBase) {
    const leaders = people.filter(p =>
        rule.leaderMatch.some(k => nsKey(p.viTri).includes(k)));
    const members = people.filter(p => leaders.indexOf(p) === -1);

    const sec = nsEl('section', `org-team org-team--${rule.key}`);
    sec.id = `${idBase}--${rule.key}`;
    sec.appendChild(nsEl('h3', 'org-title', rule.title));

    /* Hộp trên: tổ trưởng + tổ phó (thiếu thì ô trống ghi sẵn chức danh) */
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

/** Khung báo lỗi / chưa có dữ liệu, kèm dòng gợi ý dạng mã (tuỳ chọn). */
function nsNotice(message, hint) {
    const box = nsEl('div', 'personnel-empty');
    box.appendChild(nsEl('span', null, message));
    if (hint) box.appendChild(nsEl('code', null, hint));
    return box;
}

/* =============================================================================
 * THANH BÊN TRÁI — TÌM VÀ LỌC NHÂN SỰ
 * -----------------------------------------------------------------------------
 *   1) Ô tìm: gõ TÊN hoặc VỊ TRÍ, thẻ không khớp ẩn đi ngay. So khớp đã bỏ dấu
 *      nên gõ "khac" vẫn ra "Khắc", "sang phan" vẫn ra "Sàng phân".
 *   2) Lọc TRẠNG THÁI: tất cả / đang làm việc / không còn làm.
 *   3) Danh sách KHU VỰC kèm sĩ số — bấm là nhảy thẳng tới khối đó. Có đủ cả
 *      Quản lý kíp và Kỹ thuật viên vận hành, không chỉ hai tổ.
 * Khối nào lọc xong không còn ai thì tự ẩn.
 * ===========================================================================*/

/** Một dòng khu vực trong thanh bên (nút): tên + sĩ số; targetId: id khối nhảy
 *  tới; level 1 = nhóm, 2 = vị trí bên trong tổ (thụt vào). */
function nsSideLink(label, count, targetId, level) {
    const a = nsEl('button', `ns-area ns-area--l${level}`);
    a.type = 'button';
    a.dataset.target = targetId;
    a.appendChild(nsEl('span', 'ns-area__name', label));
    a.appendChild(nsEl('span', 'ns-area__num', String(count)));
    return a;
}

/** Dựng thanh bên cho một kíp: ô tìm, 3 nút trạng thái, danh sách khu vực. */
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

    /* --- Lọc trạng thái: [giá trị, nhãn, sĩ số] --- */
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

        /* Với hai tổ thì liệt kê tiếp từng vị trí bên trong (cùng thứ tự và id
           như nsBuildTeam dựng) */
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

/** Áp bộ lọc lên toàn bộ thẻ trong một kíp.
 *  q: chữ trong ô tìm; st: 'all' | 'on' | 'off'.
 *  Thẻ không khớp và khối không còn ai -> thêm lớp is-hidden. Cập nhật dòng
 *  "Tìm thấy N người". */
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

    /* Báo số kết quả (chỉ khi đang lọc) */
    const bao = root.querySelector('.ns-result');
    if (bao) {
        const loc = Boolean(key) || st !== 'all';
        bao.textContent = loc ? `Tìm thấy ${hien} người` : '';
        bao.classList.toggle('is-hidden', !loc);
    }
}

/** Khoảng chừa phía trên khi cuộn tới một khối (dưới các thanh cố định), đọc từ
 *  CSS (scroll-margin-top = biến --ns-offset) để JS và CSS không bao giờ lệch
 *  nhau. Không đọc được thì 232px. */
function nsOffset(el) {
    try {
        const v = getComputedStyle(el).scrollMarginTop;
        if (v && v.endsWith('px')) return parseFloat(v);
    } catch { /* môi trường không có getComputedStyle */ }
    return 232;
}

/** Kéo trang để khối el nằm đúng mốc (ngay dưới các thanh cố định), TỨC THÌ.
 *  Vì sao KHÔNG cuộn mượt: lọc xong danh sách ngắn lại -> trang thấp xuống ->
 *  trình duyệt TỰ KẸP vị trí cuộn về mức tối đa mới. Cú kẹp đó xảy ra ngay,
 *  còn cuộn mượt thì trượt dần ~300 ms — mắt thấy thanh bên bị đẩy lên rồi mới
 *  bò về. Đặt thẳng vị trí cuộn là xong trong một khung hình. */
function nsGhimVeMoc(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const off = nsOffset(el);
    const top = el.getBoundingClientRect().top;
    if (top >= off - 4) return;                 // đang thấy rồi thì để yên
    const y = (window.pageYOffset || 0) + top - off;
    if (typeof window.scrollTo === 'function') window.scrollTo(0, Math.max(0, y));
}

/** Ghim rồi kiểm lại một khung hình sau: một số trình duyệt kẹp vị trí cuộn SAU
 *  khi mình đo, ghim một lần có thể vẫn lệch. */
function nsGhimChac(el) {
    nsGhimVeMoc(el);
    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => nsGhimVeMoc(el));
    }
}

/** Nối thanh bên với phần nội dung: gõ tìm / bấm trạng thái -> lọc; bấm khu vực
 *  -> cuộn tới khối đó và nháy viền. */
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
            /* scrollIntoView thường đưa mép trên khối lên sát mép cửa sổ, tức chui
               vào gầm 2 thanh cố định + tiêu đề dính. CSS đã đặt scroll-margin-top
               cho các khối này nên trình duyệt dừng sớm đúng bấy nhiêu. */
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            /* Nháy viền cho dễ nhận ra khối vừa nhảy tới */
            el.classList.add('is-flash');
            setTimeout(() => el.classList.remove('is-flash'), 1400);
        });
    });
}

/** Dựng TOÀN BỘ một kíp vào mục cfg.section (vd #kip-A).
 *  list: kết quả nsReadKip (null = thiếu cột -> hiện thông báo lỗi). */
function nsRenderKip(key, cfg, list) {
    const section = document.getElementById(cfg.section);
    if (!section) return;
    const grid = section.querySelector('.personnel-grid');
    if (!grid) return;

    grid.innerHTML = '';
    grid.classList.add('personnel-grid--org');

    /* Dòng đếm sĩ số gắn THẲNG VÀO tiêu đề mục (thanh dính) chứ không để trong
       lưới — để nó không bị chính tiêu đề che khi cuộn. Xoá bản cũ trước khi gắn. */
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

    /* Chưa có ai vẫn dựng đủ khung, chỉ thêm một dòng nhắc phía trên. Dòng nhắc
       phải nằm TRONG cột nội dung — thả thẳng vào lưới 2 cột là nó chiếm mất ô
       đầu và đẩy lệch cả bố cục. */
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
 * BẢN NHỚ (cache) — hiện danh sách NGAY, không đợi tải xong dữ liệu
 * -----------------------------------------------------------------------------
 * Lần đầu vào web thì vẫn phải chờ dữ liệu. Nhưng lần sau:
 *   1) Vừa mở trang là dựng luôn danh sách từ bản đã nhớ trong máy  -> thấy ngay
 *   2) Dữ liệu tải xong, so DẤU VÂN TAY với thứ đang hiện:
 *        - GIỐNG  -> KHÔNG vẽ lại gì cả
 *        - KHÁC   -> vẽ lại và ghi đè bản nhớ
 * Nhờ vậy sửa bảng tính vẫn cập nhật đúng, mà mở trang thì không phải chờ.
 *
 * Bản nhớ để trong localStorage của trình duyệt, chỉ máy người xem giữ, không
 * gửi đi đâu. Xoá bằng: localStorage.removeItem('xtk2.nhansu.v1')
 * ===========================================================================*/
const NS_CACHE_KEY = 'xtk2.nhansu.v1';

/** Dấu vân tay (băm djb2) của dữ liệu: đổi một ký tự là chuỗi này đổi theo. */
function nsFingerprint(data) {
    const str = JSON.stringify(data);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return `${str.length}-${h.toString(36)}`;
}

/** Đọc bản nhớ -> { fp, data, at } hoặc null (không có, hỏng, hoặc trình duyệt
 *  chặn localStorage như ở chế độ ẩn danh). */
function nsCacheRead() {
    try {
        const raw = window.localStorage.getItem(NS_CACHE_KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return (obj && obj.data && obj.fp) ? obj : null;
    } catch { return null; }
}

/** Ghi bản nhớ; lỗi (hết chỗ, bị chặn) thì bỏ qua — không ảnh hưởng hiển thị. */
function nsCacheWrite(data, fp) {
    try {
        window.localStorage.setItem(NS_CACHE_KEY, JSON.stringify({ fp, data, at: Date.now() }));
    } catch { /* hết chỗ hoặc bị chặn — bỏ qua, không ảnh hưởng hiển thị */ }
}

/** Rút gọn bảng tính thành đúng phần nhân sự 3 kíp: { A: [...], B: [...], C: [...] }
 *  — vừa để nhớ (nhẹ), vừa để so vân tay (số liệu sản xuất đổi không làm vẽ
 *  lại sơ đồ nhân sự). */
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

/* Thẻ <script> đặt ở CUỐI body nên 3 mục #kip-A/B/C đã có sẵn khi file này chạy
   -> dựng NGAY, không chờ DOMContentLoaded. Chỉ khi chưa thấy mục nào (thẻ script
   bị dời lên <head>) mới phải chờ.
   Quan trọng: nếu chờ DOMContentLoaded mà dữ liệu API về TRƯỚC thì bản nhớ thành
   vô dụng — vẫn đúng nhưng mất hết tác dụng tăng tốc. */
if (document.getElementById(KIP_COLUMNS.A.section)) {
    nsBootFromCache();
} else {
    document.addEventListener('DOMContentLoaded', nsBootFromCache);
}

/* --- 2) Dữ liệu tải xong: chỉ vẽ lại KHI phần nhân sự thật sự đổi --- */

/** Kiểm tra components.css có đúng bản đi kèm không.
 *  Vì sao cần: JS và CSS là hai file rời, chép nhầm bản cũ là thanh bên hiện ra
 *  trần trụi mà không có lỗi nào trong Console — rất khó đoán. Ở đây đo thẳng
 *  một thuộc tính chỉ bản mới có (thanh bên dính: position sticky). */
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

/** Gọi mỗi khi có số liệu TK3 mới: rút phần nhân sự, khác thì vẽ lại + nhớ. */
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
