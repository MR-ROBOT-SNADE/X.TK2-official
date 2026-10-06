/* XTK2-API v2 — api_v2.js
 * =============================================================================
 * DỰNG LẠI "BẢNG NGANG" NHƯ GOOGLE SHEET TỪ GÓI GỌN CỦA /api/v2 (D1)
 * =============================================================================
 * VẤN ĐỀ FILE NÀY GIẢI QUYẾT
 *   /api/v2/tk3 trả số liệu dạng GỌN (dạng chi tiết: xem db/goi-v2.mjs):
 *     { van_tay, cot: [[khối, tên cột], ...],
 *       thang: { '2026-09': [[số thứ tự cột, ngày trong tháng, stt, kíp, giá trị], ...],
 *                'nhan-su': [[kíp, stt, nhân viên, vị trí, trạng thái], ...] },
 *       muc_luc: { cac_thang: [...], khoi: { khối: ngày cuối có số } }, pham_vi: { tu, den } }
 *   Nhưng mọi biểu đồ, dải chỉ số, bảng cảnh báo, sơ đồ nhân sự đều được viết để
 *   đọc BẢNG NGANG y như Apps Script gửi (window.masterSheetDataTK3):
 *     [{ 'Thời gian (Điện)': '01/10/2026', 'Ca/kíp (Điện)': 'A', 'Điện năng': '1234', ... }, ...]
 *   File này dựng lại đúng dạng đó, để hàng nghìn dòng JS vẽ biểu đồ không phải sửa.
 *
 * BẢNG DỰNG LẠI GIỐNG SHEET Ở NHỮNG ĐIỂM MÀ CODE BIỂU ĐỒ DỰA VÀO
 *   - mỗi khối nằm ở các hàng riêng, xếp theo (ngày, stt) như trong sheet;
 *   - ô ngày chỉ có ở hàng ĐẦU của mỗi ngày (như ô gộp), các hàng sau để trống;
 *   - hàng stt = 0 là hàng mở đầu ngày CHƯA có kíp (chỉ có ô kế hoạch / định
 *     mức) — ribbonQuet() đọc kế hoạch tháng ở đó;
 *   - hàng nào cũng có ĐỦ mọi cột ('' nếu trống), vì cbTimCot(), ribbonCot()...
 *     tìm cột bằng Object.keys(rows[0]).
 *
 *   Số được viết lại thành chuỗi dạng '1234.5' — dạng mà sheetNumber() đọc không
 *   phải đoán. Riêng kiểu '12.345' (đúng 3 chữ số lẻ) thì sheetNumber() có thể
 *   hiểu là mười hai nghìn, nên thêm một số 0: '12.3450'.
 *
 * KHO THÁNG (tải theo tháng)
 *   Trình duyệt không tải hết lịch sử. API_V2_KHO giữ các gói tháng ĐÃ TẢI của
 *   mỗi dây; tải thêm tháng cũ (js/api/api_thang.js) thì gộp vào kho rồi dựng lại
 *   bảng từ cả kho. Hai quy tắc:
 *     - kho luôn là một dải tháng LIỀN NHAU, từ kho.tu đến hết;
 *     - TK3 và TK4 luôn cùng một dải: biểu đồ gộp ghép số TK4 vào nhãn ngày của
 *       TK3 THEO VỊ TRÍ HÀNG — hai dây lệch dải tháng là số bị vẽ lệch ngày.
 *
 * CHẠY Ở HAI NƠI
 *   - Trình duyệt: script thường (không phải module), các hàm thành biến toàn cục.
 *   - Máy chủ: db/chi-so.mjs import file này; dùng qua globalThis.XTK2_API_V2.
 *   Vì vậy file KHÔNG được đụng tới window / document ở cấp ngoài cùng.
 * ===========================================================================*/

/** Giá trị ô -> chuỗi như trong sheet. Số -> dạng '1234.5' mà sheetNumber() đọc
 *  chắc chắn đúng (xem đầu file); số rất lớn/nhỏ kiểu '1e-7' viết lại đủ chữ số;
 *  null / NaN -> ''; chữ giữ nguyên. */
function apiV2ChuoiSo(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return '';
    var s = String(v);
    if (/e/i.test(s)) s = v.toFixed(12).replace(/\.?0+$/, '');
    if (/^-?[1-9]\d{0,2}\.\d{3}$/.test(s)) s += '0';
    return s;
}

/** Tên cột đầu khối đúng như trong sheet:
 *    apiV2TenCot('Thời gian', 'QTK')                -> 'Thời gian (QTK)'
 *    apiV2TenCot('Ca/kíp', 'chất lượng than_1')     -> 'Ca/kíp (chất lượng than)_1' */
function apiV2TenCot(truoc, khoi) {
    var m = String(khoi).match(/^(.*?)(_\d+)?$/);
    return truoc + ' (' + m[1] + ')' + (m[2] || '');
}

/** '2026-10-01' -> '01/10/2026' (dạng ngày trong sheet). */
function apiV2NgaySheet(iso) {
    return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
}

/* Cột nhân sự trong sheet và vị trí tương ứng trong mỗi phần tử gói 'nhan-su'
   ([kíp, stt, nhân viên, vị trí, trạng thái]): 'STT (A)' lấy phần tử 1... */
var API_V2_NHAN_SU = [
    ['STT', 1], ['Mã nhân viên', 2], ['Vị trí công việc', 3], ['Status', 4],
];

/** Gói /api/v2 -> mảng hàng ngang, y như data của /api/tk3 bản KV.
 *
 *  tuyChon.thua (máy chủ dùng): bảng "thưa" — chỉ hàng ĐẦU có đủ mọi cột, các
 *  hàng sau chỉ có ô có giá trị. Đọc ô trống ra undefined thay vì '' — mọi hàm
 *  tính coi hai thứ như nhau — mà dựng nhanh gấp nhiều lần (tiết kiệm CPU).
 *
 *  Các bước:
 *    1) gom tên cột theo khối;
 *    2) gom từng ô của gói vào đúng hàng (ngày, stt) của khối;
 *    3) dựng "mẫu hàng" có đủ mọi cột, giá trị '';
 *    4) đổ từng khối vào các hàng 0, 1, 2... (mỗi khối bắt đầu từ hàng 0);
 *    5) đổ danh sách nhân sự vào các cột 'STT (A)'... */
function apiV2BangNgang(goi, tuyChon) {
    var thua = !!(tuyChon && tuyChon.thua);
    var cot = goi.cot || [], thang = goi.thang || {};
    var khoi = {}, thuTuKhoi = [];

    /* 1) khoi[tên] = { cotNgay, cotCa, cot: [tên cột], dong: { 'ngày|stt': hàng } } */
    cot.forEach(function (c) {
        var k = c[0];
        if (!khoi[k]) {
            khoi[k] = { cotNgay: apiV2TenCot('Thời gian', k), cotCa: apiV2TenCot('Ca/kíp', k),
                        cot: [], dong: {} };
            thuTuKhoi.push(k);
        }
        khoi[k].cot.push(c[1]);
    });

    /* 2) Gom ô về từng hàng (ngày, stt) của từng khối.
       o = [số thứ tự cột, ngày trong tháng, stt, kíp, giá trị] */
    Object.keys(thang).forEach(function (t) {
        if (t === 'nhan-su') return;
        thang[t].forEach(function (o) {
            var c = cot[o[0]];
            if (!c) return;
            var ngay = t + '-' + (o[1] < 10 ? '0' : '') + o[1];
            var b = khoi[c[0]], khoa = ngay + '|' + o[2];
            var d = b.dong[khoa];
            if (!d) d = b.dong[khoa] = { ngay: ngay, stt: o[2], kip: o[3], gt: {} };
            d.gt[c[1]] = o[4];
        });
    });

    /* 3) Mẫu hàng: đủ mọi cột, rỗng */
    var mau = {};
    thuTuKhoi.forEach(function (k) {
        var b = khoi[k];
        mau[b.cotNgay] = ''; mau[b.cotCa] = '';
        b.cot.forEach(function (c) { mau[c] = ''; });
    });
    var nhanSu = thang['nhan-su'] || [];
    if (nhanSu.length) {
        ['A', 'B', 'C'].forEach(function (kip) {
            API_V2_NHAN_SU.forEach(function (x) { mau[x[0] + ' (' + kip + ')'] = ''; });
        });
    }

    /* Lấy hàng thứ i, tạo thêm hàng (từ mẫu) nếu chưa đủ */
    var rows = [];
    function dong(i) {
        while (rows.length <= i) rows.push(thua && rows.length ? {} : Object.assign({}, mau));
        return rows[i];
    }

    /* 4) Mỗi khối: xếp theo (ngày, stt), ghi ô ngày ở hàng đầu mỗi ngày */
    thuTuKhoi.forEach(function (k) {
        var b = khoi[k];
        var ds = Object.keys(b.dong).map(function (x) { return b.dong[x]; });
        ds.sort(function (a, c) { return a.ngay < c.ngay ? -1 : a.ngay > c.ngay ? 1 : a.stt - c.stt; });
        var ngayTruoc = null;
        ds.forEach(function (d, i) {
            var r = dong(i);
            if (d.ngay !== ngayTruoc) { r[b.cotNgay] = apiV2NgaySheet(d.ngay); ngayTruoc = d.ngay; }
            r[b.cotCa] = d.kip || '';
            Object.keys(d.gt).forEach(function (c) { r[c] = apiV2ChuoiSo(d.gt[c]); });
        });
    });

    /* 5) Nhân sự: người thứ i của kíp A nằm ở hàng i, như các cột 'STT (A)'... */
    ['A', 'B', 'C'].forEach(function (kip) {
        var ds = nhanSu.filter(function (p) { return p[0] === kip; })
            .sort(function (a, c) { return a[1] - c[1]; });
        ds.forEach(function (p, i) {
            var r = dong(i);
            API_V2_NHAN_SU.forEach(function (x) { r[x[0] + ' (' + kip + ')'] = apiV2ChuoiSo(p[x[1]]); });
        });
    });

    return rows;          /* rỗng -> api_config.js coi là lỗi, quay về bản KV */
}

/* =============================================================================
 * KHO GÓI THÁNG CỦA TRÌNH DUYỆT
 * ===========================================================================*/

/* Mỗi dây một kho:
     { vanTay    vân tay danh mục cột của các gói trong kho
       cot       danh mục cột [[khối, tên cột], ...]
       thang     { 'YYYY-MM': [ô...] } — các tháng đã tải
       nhanSu    danh sách nhân sự
       mucLuc    { cac_thang, khoi } của lượt tải mặc định gần nhất
       tu        tháng sớm nhất đang có trong kho
       etag      ETag của lượt tải mặc định gần nhất
       soLanThem số lần đã tải thêm tháng cũ }
   null = dây đó đang dùng bản KV (vốn đủ mọi tháng) hoặc chưa tải. */
var API_V2_KHO = { TK3: null, TK4: null };

/** Cộng n tháng vào 'YYYY-MM' (n âm = lùi): ('2026-01', -1) -> '2025-12'. */
function apiV2CongThang(t, n) {
    var y = +t.slice(0, 4), m = +t.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + '-' + (m < 9 ? '0' : '') + (m + 1);
}

/** Gộp một gói /api/v2 vào kho của dây ten, rồi trả bảng ngang dựng từ CẢ kho.
 *
 *  laMacDinh = true: gói của lượt tải mặc định (từ tháng tu đến hết, kèm nhân sự
 *    + mục lục). Gói này được quyền:
 *      - thay hẳn kho khi danh mục cột đổi (vân tay khác);
 *      - xoá khỏi kho những tháng >= tu mà gói không còn (đã bị xoá khỏi D1).
 *  laMacDinh = false: gói xin thêm tháng cũ. Lệch danh mục với kho thì BỎ (trả
 *    null): số thứ tự cột của hai gói không khớp nhau, gộp là sai cột.
 *  etag: ETag của câu trả lời (chỉ dùng với gói mặc định). */
function apiV2NhanGoi(ten, goi, laMacDinh, etag) {
    var kho = API_V2_KHO[ten];
    var tu = goi.pham_vi && goi.pham_vi.tu;
    if (!kho || kho.vanTay !== goi.van_tay) {
        if (!laMacDinh) return null;
        kho = API_V2_KHO[ten] = { vanTay: goi.van_tay, cot: goi.cot, thang: {}, nhanSu: [],
                                  mucLuc: null, tu: tu, etag: '', soLanThem: 0 };
    }
    Object.keys(goi.thang || {}).forEach(function (t) {
        if (t === 'nhan-su') kho.nhanSu = goi.thang[t];
        else kho.thang[t] = goi.thang[t];
    });
    if (laMacDinh) {
        kho.mucLuc = goi.muc_luc || null;
        kho.etag = etag || '';
        /* Tháng trong dải mặc định mà gói mới không còn -> đã bị xoá khỏi D1 */
        Object.keys(kho.thang).forEach(function (t) {
            if (tu && t >= tu && !(t in goi.thang)) delete kho.thang[t];
        });
        if (!kho.tu || (tu && tu < kho.tu)) kho.tu = tu;
    } else {
        kho.soLanThem++;
        if (tu && (!kho.tu || tu < kho.tu)) kho.tu = tu;
    }
    var thang = {};
    Object.keys(kho.thang).forEach(function (t) { thang[t] = kho.thang[t]; });
    thang['nhan-su'] = kho.nhanSu;
    return apiV2BangNgang({ cot: kho.cot, thang: thang });
}

/** Vân tay của bảng đang dựng từ kho = ETag gói mặc định + tháng đầu + số lần
 *  tải thêm. Đổi khi gói mặc định đổi hoặc vừa tải thêm tháng — api_loaded.js
 *  dùng để biết có phải vẽ lại biểu đồ không. */
function apiV2VanTayKho(ten) {
    var kho = API_V2_KHO[ten];
    return kho ? kho.etag + '+' + kho.tu + '+' + kho.soLanThem : '';
}

/* Cho máy chủ dùng (db/chi-so.mjs import file này như một module) */
globalThis.XTK2_API_V2 = { bangNgang: apiV2BangNgang, tenCot: apiV2TenCot };
