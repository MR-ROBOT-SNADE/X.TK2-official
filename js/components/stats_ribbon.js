/* =============================================================================
 * stats_ribbon.js — BẢN CŨ CỦA DẢI CHỈ SỐ TRANG CHỦ — HIỆN KHÔNG ĐƯỢC DÙNG
 * =============================================================================
 * !!! FILE NÀY KHÔNG CÒN ĐƯỢC NẠP: index.html không có thẻ <script> nào gọi nó,
 *     nên nó cũng không có trong bản build (dist/).
 *
 * Dải chỉ số trang chủ (#tong-san-luong, #tb-loi, #he-so-loi-dung) hiện do:
 *     js/chung/chi_so.js                 TÍNH (RIBBON_CFG, tinhRibbon...)
 *     js/components/Charts/chart_cook.js VẼ  (ribbonVe, ribbonVeHeSo)
 * Bản đó đọc số chặt chẽ hơn (sheetNumber), tính hệ số lợi dụng RIÊNG từng dây
 * và có thể lấy kết quả máy chủ tính sẵn (/api/v2/chi-so).
 *
 * Giữ lại chỉ để tham khảo cách làm cũ. ĐỪNG nạp lại file này: nó ghi đè cùng
 * ba ô đó bằng cách tính cũ (tên cột phỏng đoán, cộng mọi tháng, đọc số kiểu cũ).
 * Không cần nữa thì xoá được.
 * -----------------------------------------------------------------------------
 * (Mô tả gốc của bản cũ)
 *   Nạp số liệu cho 3 ô ở trang chủ, lấy từ chính bảng tính mà các biểu đồ đang
 *   dùng:
 *     #tong-san-luong  : tổng sản lượng xưởng trong kỳ (tấn)
 *     #tb-loi          : tỉ lệ đảm bảo chất lượng (%)
 *     #he-so-loi-dung  : hệ số lợi dụng của xưởng trong tháng (t/m²·h)
 *   Nghe TK3DataReady / TK4DataReady, đủ cả hai dây mới tính. Tên cột trong các
 *   khối RIBBON_* là PHỎNG ĐOÁN; chưa khớp tên nào thì ô giữ nguyên '--'.
 * ===========================================================================*/

/* --- Ô 1: TỔNG SẢN LƯỢNG (cộng dồn cả 2 dây chuyền) --- */
const RIBBON_SANLUONG = {
    el: 'tong-san-luong',
    cols: ['Sản lượng thiêu kết', 'Sản lượng (ca)', 'Sản lượng quặng thiêu kết'],
    mode: 'sum',           // cộng tất cả các ca trong kỳ
    both: true,            // gộp cả TK3 và TK4
    digits: 0,
};

/* --- Ô 2: TỈ LỆ ĐẢM BẢO CHẤT LƯỢNG (trung bình các ca) --- */
const RIBBON_CHATLUONG = {
    el: 'tb-loi',
    cols: ['Tỉ lệ đạt chất lượng', 'Tỉ lệ thành phẩm đạt', 'Tỉ lệ đạt'],
    mode: 'avg',
    both: true,
    digits: 1,
};

/* --- Ô 3: HỆ SỐ LỢI DỤNG THÁNG --- */
const RIBBON_LOIDUNG = {
    el: 'he-so-loi-dung',
    cols: ['Hệ số lợi dụng', 'Hệ số lợi dụng (tháng)', 'Hệ số sử dụng thiết bị'],
    mode: 'avg',           // bình quân các ca
    both: true,
    digits: 2,

    /* Sheet KHÔNG có sẵn cột hệ số lợi dụng thì tự tính:
         hệ số lợi dụng = sản lượng / (diện tích thiêu kết x số giờ chạy)
       (gộp cả hai dây rồi chia cho diện tích MỘT máy — chính là lỗi mà bản mới
       trong chi_so.js đã sửa) */
    fallback: {
        sanLuongCols: RIBBON_SANLUONG.cols,
        gioChayCols: ['Thời gian chạy máy', 'Giờ chạy máy', 'Số giờ vận hành'],
        dienTich: 360,
    },
};

/* --- Tiện ích ------------------------------------------------------------ */

/** Đổi ô bảng tính thành số (cách đọc CŨ, kém chặt chẽ hơn sheetNumber).
 *  "1.234,56" -> 1234.56; "1234,56" -> 1234.56. Ô trống / không phải số -> null. */
function ribbonToNumber(v) {
    if (v === undefined || v === null) return null;
    const s = v.toString().trim();
    if (s === '') return null;
    const cleaned = s.replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
}

/** Tên cột ĐẦU TIÊN trong names thực sự có trong dữ liệu. */
function ribbonFindCol(rows, names) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    return names.find(n => keys.includes(n)) || null;
}

/** Gom toàn bộ giá trị số của một cột (cả hai dây nếu cfg.both). */
function ribbonCollect(cfg) {
    const sources = cfg.both
        ? [window.masterSheetDataTK3, window.masterSheetDataTK4]
        : [window.masterSheetDataTK3];

    const values = [];
    sources.forEach(rows => {
        const col = ribbonFindCol(rows, cfg.cols);
        if (!col) return;
        rows.forEach(row => {
            const n = ribbonToNumber(row[col]);
            if (n !== null) values.push(n);
        });
    });
    return values;
}

/** Tự tính hệ số lợi dụng khi sheet không có sẵn cột đó. */
function ribbonComputeLoiDung(fb) {
    const sources = [window.masterSheetDataTK3, window.masterSheetDataTK4];
    let tongSanLuong = 0;
    let tongGio = 0;

    sources.forEach(rows => {
        const colSL = ribbonFindCol(rows, fb.sanLuongCols);
        const colGio = ribbonFindCol(rows, fb.gioChayCols);
        if (!colSL || !colGio) return;
        rows.forEach(row => {
            const sl = ribbonToNumber(row[colSL]);
            const gio = ribbonToNumber(row[colGio]);
            if (sl !== null && gio !== null && gio > 0) {
                tongSanLuong += sl;
                tongGio += gio;
            }
        });
    });

    if (tongGio <= 0 || !fb.dienTich) return null;
    return tongSanLuong / (fb.dienTich * tongGio);
}

/** Ghi số vào ô, GIỮ NGUYÊN thẻ <span> đơn vị đứng sau. Không có số -> giữ '--'. */
function ribbonRender(cfg, value) {
    const el = document.getElementById(cfg.el);
    if (!el) return;

    if (value === null || !Number.isFinite(value)) {
        console.warn(`[Dải chỉ số] Chưa lấy được số cho #${cfg.el} — `
            + `không tìm thấy cột nào trong: ${cfg.cols.join(' | ')}. `
            + `Xem tên cột thật bằng: console.table(window.masterSheetDataTK3[0])`);
        return;                                  // giữ nguyên '--'
    }

    const text = value.toLocaleString('vi-VN', {
        minimumFractionDigits: cfg.digits,
        maximumFractionDigits: cfg.digits,
    });

    const unit = el.querySelector('span');       // thẻ đơn vị: TẤN, %, ...
    el.textContent = text;
    if (unit) el.appendChild(unit);
}

/** Tính (cộng hoặc trung bình, hoặc tự tính hệ số) rồi hiển thị một ô. */
function ribbonUpdateOne(cfg) {
    const values = ribbonCollect(cfg);

    let result = null;
    if (values.length) {
        result = cfg.mode === 'sum'
            ? values.reduce((a, b) => a + b, 0)
            : values.reduce((a, b) => a + b, 0) / values.length;
    } else if (cfg.fallback) {
        result = ribbonComputeLoiDung(cfg.fallback);
        if (result !== null) {
            console.info(`[Dải chỉ số] #${cfg.el}: sheet không có cột sẵn, `
                + `đã TỰ TÍNH từ sản lượng và giờ chạy máy.`);
        }
    }

    ribbonRender(cfg, result);
}

/* --- Chạy khi dữ liệu đã tải xong (chỉ khi file được nạp) ---------------- */

const ribbonState = { tk3: false, tk4: false };

function ribbonUpdateAll() {
    if (!ribbonState.tk3 || !ribbonState.tk4) return;   // đợi đủ cả 2 dây chuyền
    [RIBBON_SANLUONG, RIBBON_CHATLUONG, RIBBON_LOIDUNG].forEach(ribbonUpdateOne);
    console.info('[Dải chỉ số] Đã nạp xong 3 ô tổng quan trang chủ.');
}

document.addEventListener('TK3DataReady', () => { ribbonState.tk3 = true; ribbonUpdateAll(); });
document.addEventListener('TK4DataReady', () => { ribbonState.tk4 = true; ribbonUpdateAll(); });
