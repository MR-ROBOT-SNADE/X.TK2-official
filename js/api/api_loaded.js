/* XTK2-API v2 — api_loaded.js
 * =============================================================================
 * NHẬN DỮ LIỆU VÀ PHÂN PHÁT — bản đã tối ưu độ trễ
 * -----------------------------------------------------------------------------
 * Giữ NGUYÊN cách dùng cũ: vẫn có loadGoogleSheetData(), vẫn bắn TK3DataReady /
 * TK4DataReady, vẫn đổ vào window.masterSheetDataTK3 / TK4. KHÔNG phải sửa
 * chart_cook.js, chart_core.js hay personnel.js.
 *
 * Bốn thay đổi cắt độ trễ:
 *   1) DÙNG LẠI cuộc gọi đã bắn sớm trong api_config.js, không gọi lần nữa.
 *   2) NHỚ TRONG MÁY: mở trang là bắn sự kiện NGAY từ bản lần trước -> biểu đồ
 *      hiện tức thì. Dữ liệu mới về sau thì so vân tay, KHÁC mới vẽ lại.
 *   3) HAI DÂY ĐỘC LẬP: bản cũ dùng Promise.all nên tk4 (8,9 giây) phải đợi
 *      tk3 (114 giây) mới được vẽ. Nay dây nào xong trước dùng ngay dây đó.
 *   4) API lỗi hoặc quá chậm thì vẫn hiện được dữ liệu cũ, không trắng trang.
 *
 * Bản nhớ nằm trong localStorage của máy người xem, không gửi đi đâu.
 * Xoá tay: localStorage.removeItem('xtk2.sheet.v2.TK3')
 * ===========================================================================*/

window.masterSheetDataTK3 = [];
window.masterSheetDataTK4 = [];
/* Vật tư có dạng khác hẳn: { TK3: {tongHop,nhap,xuat}, TK4: {...} } */
window.masterSheetDataVATTU = null;

const API_CACHE = { prefix: 'xtk2.sheet.v2.' };

/** Vân tay dữ liệu: đổi một ký tự trong bảng tính là số này đổi theo. */
function apiVanTay(data) {
    const s = JSON.stringify(data);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return s.length + '-' + h.toString(36);
}

/* =============================================================================
 * NÉN BẢN NHỚ THEO CỘT
 * -----------------------------------------------------------------------------
 * ===========================================================================*/
function apiNenCot(rows) {
    if (!Array.isArray(rows) || !rows.length || typeof rows[0] !== 'object') return null;
    const cot = Object.keys(rows[0]);
    const dong = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        /* Dòng nào có bộ cột khác dòng đầu thì thôi không nén, giữ dạng gốc */
        if (!r || Object.keys(r).length !== cot.length) return null;
        const a = new Array(cot.length);
        let cuoi = 0;
        for (let j = 0; j < cot.length; j++) {
            const v = r[cot[j]];
            if (v === undefined) return null;
            a[j] = v;
            if (v !== '') cuoi = j + 1;
        }
        a.length = cuoi;
        dong[i] = a;
    }
    return { cot: cot, dong: dong };
}

function apiGiaiNenCot(cot, dong) {
    return dong.map(function (a) {
        const r = {};
        for (let j = 0; j < cot.length; j++) r[cot[j]] = j < a.length ? a[j] : '';
        return r;
    });
}

function apiDocNho(ten) {
    try {
        const raw = window.localStorage.getItem(API_CACHE.prefix + ten);
        if (!raw) return null;
        const o = JSON.parse(raw);
        if (!o) return null;
        /* Dạng cột (bản này) hoặc dạng gốc (bản nhớ do phiên bản cũ ghi) */
        if (o.dang === 'cot' && Array.isArray(o.cot) && Array.isArray(o.dong)) {
            return o.dong.length ? { fp: o.fp, data: apiGiaiNenCot(o.cot, o.dong) } : null;
        }
        if (!o.data) return null;
        const coND = Array.isArray(o.data) ? o.data.length > 0
                   : (typeof o.data === 'object') ? Object.keys(o.data).length > 0
                   : false;
        /* dangCu: bản nhớ dạng gốc còn nén được -> ghi lại cho gọn dù dữ liệu không đổi */
        return coND ? { fp: o.fp, data: o.data, dangCu: Array.isArray(o.data) } : null;
    } catch { return null; }
}

function apiGhiNho(ten, data, fp) {
    const nen = apiNenCot(data);
    const goi = nen
        ? JSON.stringify({ fp: fp, at: Date.now(), dang: 'cot', cot: nen.cot, dong: nen.dong })
        : JSON.stringify({ fp: fp, at: Date.now(), data: data });
    try {
        window.localStorage.setItem(API_CACHE.prefix + ten, goi);
    } catch {
        /* localStorage thường chỉ 5 MB. Hết chỗ -> xoá bản cũ rồi thử lại một
           lần. Vẫn không được thì bỏ qua: chỉ mất phần tăng tốc, không hỏng gì. */
        try {
            window.localStorage.removeItem(API_CACHE.prefix + ten);
            window.localStorage.setItem(API_CACHE.prefix + ten, goi);
        } catch { /* đành chịu */ }
    }
}

/** Ghi bản nhớ lúc trình duyệt RẢNH. Nén + ghi vài MB là việc đồng bộ chặn luồng
 *  chính; làm ngay lúc dữ liệu vừa về là tranh giờ với chính các biểu đồ đang vẽ. */
function apiGhiNhoKhiRanh(ten, data, fp) {
    const lam = function () { apiGhiNho(ten, data, fp); };
    if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(lam, { timeout: 5000 });
    } else {
        setTimeout(lam, 1500);
    }
}

/** Đổ dữ liệu vào window và bắn sự kiện — chỉ bắn khi dữ liệu THỰC SỰ khác. */
const apiDaBan = {};
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

/** Ô "Cập nhật:" trên thanh đầu trang — trước giờ không file nào ghi vào nên
 *  hiện "Đang tải......" mãi. Lấy mốc đẩy CŨ HƠN của TK3 / TK4: một dây ngừng
 *  đẩy thì ô này cũng đứng lại, không bị dây kia che mất. */
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

/** Một dây chuyền: hiện ngay từ bản nhớ, rồi âm thầm cập nhật khi API về. */
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

    /* Không đổi thì khỏi ghi lại bản nhớ — trừ khi bản nhớ còn ở dạng gốc cồng kềnh */
    const doi = apiApDung(ten, moi, fp, 'tải mới từ Cloudflare KV');
    if (doi || (nho && nho.dangCu)) apiGhiNhoKhiRanh(ten, moi, fp);
}



function apiLayLoiHua(ten, url) {
    if (typeof API_PREWARM !== 'undefined' && API_PREWARM[ten]) {
        const p = API_PREWARM[ten];
        API_PREWARM[ten] = null;
        return p;
    }
    return url ? fetchGoogleSheetData(url) : Promise.resolve(null);
}

async function loadGoogleSheetData() {
    const q = (typeof API_QUERY === 'string' ? API_QUERY : '');
    const p3 = apiLayLoiHua('TK3', API_KEY_TK3 ? API_KEY_TK3 + q : '');
    const p4 = apiLayLoiHua('TK4', API_KEY_TK4 ? API_KEY_TK4 + q : '');
    const pVT = apiLayLoiHua('VATTU', (typeof API_KEY_VATTU === 'string' && API_KEY_VATTU) || '');

    const t0 = (typeof API_PREWARM !== 'undefined' && API_PREWARM.batDauLuc)
        ? API_PREWARM.batDauLuc : Date.now();
    if (typeof API_PREWARM !== 'undefined') API_PREWARM.batDauLuc = 0;

    /* KHÔNG dùng Promise.all cho phần hiển thị: luồng nào xong trước vẽ trước. */
    await Promise.all([
        apiMotDay('TK3', p3),
        apiMotDay('TK4', p4),
        apiMotDay('VATTU', pVT),
    ]);

    console.info('[Dữ liệu] Xong sau ' + ((Date.now() - t0) / 1000).toFixed(1)
        + ' giây tính từ lúc bắn cuộc gọi.');
}
