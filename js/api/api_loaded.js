/* XTK2-API v2 — api_loaded.js
 * =============================================================================
 * NHẬN SỐ LIỆU VỀ, ĐỔ VÀO TRANG, BÁO CHO CÁC BIỂU ĐỒ VẼ
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   main.js gọi loadGoogleSheetData() khi trang dựng xong. Hàm đó:
 *     1) lấy các cuộc gọi API mà api_config.js đã bắn sẵn;
 *     2) với mỗi tuyến, đổ dữ liệu vào biến chung của trang:
 *          window.masterSheetDataTK3    mảng hàng của bảng tính TK3
 *          window.masterSheetDataTK4    mảng hàng của bảng tính TK4
 *          window.masterSheetDataVATTU  { TK3: {tongHop,nhap,xuat}, TK4: {...} }
 *        rồi bắn sự kiện 'TK3DataReady' / 'TK4DataReady' / 'VATTUDataReady';
 *     3) nhận chỉ số trang chủ máy chủ tính sẵn, bắn 'ChiSoReady'.
 *   Các file biểu đồ (chart_cook.js, canhbao.js, personnel.js, vattu.js...) chỉ
 *   việc lắng nghe các sự kiện đó và đọc các biến trên.
 *
 * BỐN MẸO GIẢM THỜI GIAN CHỜ
 *   1) DÙNG LẠI cuộc gọi đã bắn sớm trong api_config.js, không gọi lần nữa.
 *   2) BẢN NHỚ TRONG MÁY (localStorage): mở trang là bắn sự kiện NGAY từ bản lần
 *      trước -> biểu đồ hiện tức thì. Dữ liệu mới về sau thì so "vân tay", KHÁC
 *      mới vẽ lại.
 *   3) HAI DÂY ĐỘC LẬP: dây nào về trước vẽ dây đó ngay. (Bản cũ đợi cả hai —
 *      TK4 về sau 9 giây vẫn phải chờ TK3 mất 114 giây.)
 *   4) API lỗi hoặc quá chậm thì vẫn hiện được bản nhớ, không trắng trang.
 *
 * TỪ NGỮ
 *   vân tay (fp)  chuỗi ngắn đại diện cho dữ liệu: dữ liệu đổi là vân tay đổi.
 *                 Dùng ETag máy chủ gửi; không có thì tự băm (apiVanTay).
 *   bản nhớ       bản sao số liệu lần trước, lưu trong localStorage của máy người
 *                 xem, không gửi đi đâu. Xoá tay (F12 -> Console):
 *                     localStorage.removeItem('xtk2.sheet.v2.TK3')
 * ===========================================================================*/

window.masterSheetDataTK3 = [];
window.masterSheetDataTK4 = [];
/* Vật tư có dạng khác hẳn: { TK3: {tongHop,nhap,xuat}, TK4: {...} } */
window.masterSheetDataVATTU = null;

/* Tên khoá trong localStorage: 'xtk2.sheet.v2.TK3', 'xtk2.sheet.v2.TK4'... */
const API_CACHE = { prefix: 'xtk2.sheet.v2.' };

/** Vân tay tự tính: băm (djb2) toàn bộ dữ liệu -> 'độ dài-mã băm'.
 *  Đổi một ký tự trong bảng tính là chuỗi này đổi theo. */
function apiVanTay(data) {
    const s = JSON.stringify(data);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return s.length + '-' + h.toString(36);
}

/* =============================================================================
 * NÉN BẢN NHỚ THEO CỘT
 * -----------------------------------------------------------------------------
 * localStorage thường chỉ chứa được ~5 MB. Bảng TK3 có ~1.000 hàng x 100 cột,
 * mỗi hàng lặp lại đủ 100 tên cột -> rất phí. Nén: ghi danh sách tên cột MỘT
 * lần, mỗi hàng chỉ còn mảng giá trị, và cắt bỏ các ô trống ở cuối hàng.
 *     [{ 'Ngày': '01/10', 'TFe': '56', 'SiO2': '' }, ...]
 *  -> { cot: ['Ngày', 'TFe', 'SiO2'], dong: [['01/10', '56'], ...] }
 * ===========================================================================*/

/** Nén mảng hàng -> { cot, dong }. Ra null (không nén được, giữ dạng gốc) nếu có
 *  hàng mang bộ cột khác hàng đầu. */
function apiNenCot(rows) {
    if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== 'object') return null;
    const cot = Object.keys(rows[0]);
    const dong = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        /* Hàng nào có bộ cột khác hàng đầu thì thôi không nén, giữ dạng gốc */
        if (!r || Object.keys(r).length !== cot.length) return null;
        const a = new Array(cot.length);
        let cuoi = 0;
        for (let j = 0; j < cot.length; j++) {
            const v = r[cot[j]];
            if (v === undefined) return null;
            a[j] = v;
            if (v !== '') cuoi = j + 1;       /* vị trí sau ô CÓ giá trị cuối cùng */
        }
        a.length = cuoi;                       /* cắt ô trống ở cuối hàng */
        dong[i] = a;
    }
    return { cot: cot, dong: dong };
}

/** Ngược lại của apiNenCot: { cot, dong } -> mảng hàng; ô bị cắt điền lại ''. */
function apiGiaiNenCot(cot, dong) {
    return dong.map(function (a) {
        const r = {};
        for (let j = 0; j < cot.length; j++) r[cot[j]] = j < a.length ? a[j] : '';
        return r;
    });
}

/** Đọc bản nhớ của một tuyến. Ra { fp, data, dangCu? } hoặc null nếu không có /
 *  hỏng. Đọc được cả dạng nén (bản này ghi) lẫn dạng gốc (phiên bản cũ ghi). */
function apiDocNho(ten) {
    try {
        const raw = window.localStorage.getItem(API_CACHE.prefix + ten);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o) return null;
        if (o.dang === 'cot' && Array.isArray(o.cot) && Array.isArray(o.dong)) {
            return o.dong.length ? { fp: o.fp, data: apiGiaiNenCot(o.cot, o.dong) } : null;
        }
        if (!o.data) return null;
        const coND = Array.isArray(o.data) ? o.data.length > 0
                   : (typeof o.data === 'object') ? Object.keys(o.data).length > 0
                   : false;
        /* dangCu: bản nhớ dạng gốc mà còn nén được -> lát nữa ghi lại cho gọn,
           dù dữ liệu không đổi */
        return coND ? { fp: o.fp, data: o.data, dangCu: Array.isArray(o.data) } : null;
    } catch { return null; }
}

/** Ghi bản nhớ của một tuyến (nén theo cột nếu được). */
function apiGhiNho(ten, data, fp) {
    const nen = apiNenCot(data);
    const goi = nen
        ? JSON.stringify({ fp: fp, at: Date.now(), dang: 'cot', cot: nen.cot, dong: nen.dong })
        : JSON.stringify({ fp: fp, at: Date.now(), data: data });
    try {
        window.localStorage.setItem(API_CACHE.prefix + ten, goi);
    } catch {
        /* Hết chỗ (localStorage ~5 MB) -> xoá bản cũ của tuyến này rồi thử lại
           một lần. Vẫn không được thì thôi: chỉ mất phần tăng tốc, không hỏng gì. */
        try {
            window.localStorage.removeItem(API_CACHE.prefix + ten);
            window.localStorage.setItem(API_CACHE.prefix + ten, goi);
        } catch { /* đành chịu */ }
    }
}

/** Ghi bản nhớ lúc trình duyệt RẢNH. Nén + ghi vài MB là việc chặn luồng chính;
 *  làm ngay lúc dữ liệu vừa về thì tranh giờ với chính các biểu đồ đang vẽ. */
function apiGhiNhoKhiRanh(ten, data, fp) {
    const lam = function () { apiGhiNho(ten, data, fp); };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(lam, { timeout: 5000 });
    } else {
        setTimeout(lam, 1500);               /* Safari chưa có requestIdleCallback */
    }
}

/** Đổ dữ liệu vào window.masterSheetData<ten> và bắn sự kiện '<ten>DataReady' —
 *  CHỈ KHI vân tay khác lần trước (không thì biểu đồ vẽ lại vô ích).
 *  nguon: chữ mô tả nguồn, chỉ để in ra Console. Ra true nếu đã bắn sự kiện.
 *  api_thang.js cũng gọi hàm này sau khi tải thêm tháng cũ. */
const apiDaBan = {};                          /* tuyến -> vân tay đã bắn gần nhất */
function apiApDung(ten, data, fp, nguon) {
    if (apiDaBan[ten] === fp) {
        console.info('[Dữ liệu] ' + ten + ': ' + nguon + ' — không đổi, không vẽ lại.');
        return false;
    }
    window['masterSheetData' + ten] = data;
    apiDaBan[ten] = fp;
    document.dispatchEvent(new CustomEvent(ten + 'DataReady'));
    var soDong = Array.isArray(data) ? data.length + ' dòng'
        : Object.keys(data).join(' + ');
    console.info('[Dữ liệu] ' + ten + ': ' + nguon + ' — ' + soDong + '.');
    return true;
}

/** Ghi ô "Cập nhật: ..." trên thanh đầu trang (#last-updates).
 *  Hiện mốc đẩy CŨ HƠN trong hai dây TK3 / TK4: một dây ngừng đẩy thì ô này cũng
 *  đứng lại, không bị dây kia che mất. Rê chuột vào ô để xem mốc của từng dây. */
const apiDayLuc = {};
function apiGhiMocCapNhat(ten, dayLuc) {
    if (!dayLuc || (ten !== 'TK3' && ten !== 'TK4')) return;
    apiDayLuc[ten] = dayLuc;
    const el = document.getElementById('last-updates');
    if (!el || !apiDayLuc.TK3 || !apiDayLuc.TK4) return;
    const moc = new Date(Math.min(apiDayLuc.TK3, apiDayLuc.TK4));
    el.textContent = 'Cập nhật: ' + moc.toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    el.title = 'Lần Apps Script đẩy dữ liệu lên gần nhất — TK3: '
        + new Date(apiDayLuc.TK3).toLocaleString('vi-VN') + ', TK4: '
        + new Date(apiDayLuc.TK4).toLocaleString('vi-VN');
}

/** Xử lý MỘT tuyến: hiện ngay từ bản nhớ (nếu có), rồi đợi API về để cập nhật.
 *  loiHua: Promise của gói kết quả (apiTai trong api_config.js). */
async function apiMotDay(ten, loiHua) {
    /* Bản nhớ chỉ có ích lúc MỞ TRANG. Các lần làm mới sau đó màn hình đã có dữ
       liệu rồi, đọc + giải nén lại bản nhớ chỉ tốn công. */
    const nho = (apiDaBan[ten] === undefined) ? apiDocNho(ten) : null;
    if (nho) apiApDung(ten, nho.data, nho.fp, 'bản nhớ trong máy');

    const goi = await loiHua;
    if (!goi || !goi.data) {
        if (!nho) console.warn('[Dữ liệu]' + ten + ': không có bản nhớ và API cùng lỗi.');
        return;
    }

    const moi = goi.data;
    const fp = goi.etag || apiVanTay(moi);
    apiGhiMocCapNhat(ten, goi.dayLuc);

    /* Có đổi thì ghi lại bản nhớ (lúc rảnh). Không đổi thì thôi — trừ khi bản
       nhớ còn ở dạng gốc cồng kềnh, ghi lại cho gọn. */
    const doi = apiApDung(ten, moi, fp, 'tải mới từ '
        + (goi.nguon === 'd1' ? 'D1 (/api/v2)' : 'Cloudflare KV'));
    if (doi || (nho && nho.dangCu)) apiGhiNhoKhiRanh(ten, moi, fp);
}

/** Lấy lời hứa đã bắn sớm cho tuyến ten ('TK3' | 'TK4' | 'VATTU' | 'CHI_SO').
 *  Lấy được thì xoá khỏi API_PREWARM (lần làm mới sau phải gọi mới). Không có
 *  thì gọi mới luôn — D1 trước, KV sau. */
function apiLayLoiHua(ten) {
    if (typeof API_PREWARM !== 'undefined' && API_PREWARM[ten]) {
        const p = API_PREWARM[ten];
        API_PREWARM[ten] = null;
        return p;
    }
    return ten === 'CHI_SO' ? apiTaiChiSo() : apiTai(ten);
}

/* =============================================================================
 * CHỈ SỐ TRANG CHỦ MÁY CHỦ TÍNH SẴN (/api/v2/chi-so)
 * -----------------------------------------------------------------------------
 * Dải chỉ số, mục Sản lượng, bảng cảnh báo dùng kết quả này NẾU nó được tính cho
 * ĐÚNG ngày hôm nay theo đồng hồ máy người xem; không thì tự tính
 * (chart_cook.js, canhbao.js gọi chiSoMayChu() để hỏi).
 * ===========================================================================*/
window.XTK2_CHI_SO_MAY = null;              /* kết quả gần nhất, hoặc null */

/** Kết quả máy chủ tính sẵn, nếu còn dùng được cho hôm nay; không thì null.
 *  (Trang để mở qua đêm: sang ngày mới thì kết quả hôm qua hết giá trị.) */
function chiSoMayChu() {
    const c = window.XTK2_CHI_SO_MAY;
    if (!c || !c.ngay) return null;
    const d = new Date();
    const homNay = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
        + '-' + String(d.getDate()).padStart(2, '0');
    return c.ngay === homNay ? c : null;
}

/** Nhận kết quả /api/v2/chi-so; khác lần trước thì bắn sự kiện 'ChiSoReady' để
 *  dải chỉ số, mục Sản lượng, bảng cảnh báo vẽ lại. */
async function apiNhanChiSo(loiHua) {
    const j = await loiHua;
    const cu = window.XTK2_CHI_SO_MAY;
    /* Lỗi thì BỎ kết quả cũ: số liệu vừa làm mới có thể đã khác, tự tính cho chắc */
    window.XTK2_CHI_SO_MAY = j || null;
    if (!j) {
        if (cu) console.warn('[Chỉ số] /api/v2/chi-so lỗi — trình duyệt tự tính.');
        return;
    }
    if (cu && JSON.stringify(cu) === JSON.stringify(j)) return;     // không đổi, khỏi vẽ lại
    console.info('[Chỉ số] Máy chủ đã tính sẵn chỉ số ngày ' + j.ngay + ' (/api/v2/chi-so).');
    document.dispatchEvent(new CustomEvent('ChiSoReady'));
}

/** ĐIỂM VÀO — main.js gọi lúc mở trang và mỗi lần làm mới định kỳ.
 *  Chạy 4 việc song song; việc nào xong trước thì phần đó hiện trước. */
async function loadGoogleSheetData() {
    const p3 = apiLayLoiHua('TK3');
    const p4 = apiLayLoiHua('TK4');
    const pVT = apiLayLoiHua('VATTU');
    const pCS = apiLayLoiHua('CHI_SO');

    const t0 = (typeof API_PREWARM !== 'undefined' && API_PREWARM.batDauLuc)
        ? API_PREWARM.batDauLuc : Date.now();
    if (typeof API_PREWARM !== 'undefined') API_PREWARM.batDauLuc = 0;

    /* Promise.all ở đây chỉ để biết khi nào XONG HẾT (in thời gian). Mỗi
       apiMotDay tự bắn sự kiện của nó ngay khi về, không đợi các dây khác. */
    await Promise.all([
        apiNhanChiSo(pCS),
        apiMotDay('TK3', p3),
        apiMotDay('TK4', p4),
        apiMotDay('VATTU', pVT),
    ]);

    console.info('[Dữ liệu] Xong sau ' + ((Date.now() - t0) / 1000).toFixed(1)
        + ' giây tính từ lúc bắn cuộc gọi.');
}
