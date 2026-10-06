/* XTK2-API v2 — api_config.js
 * =============================================================================
 * CẤU HÌNH ĐƯỜNG DẪN API + BẮN CUỘC GỌI DỮ LIỆU NGAY KHI TRANG VỪA MỞ
 * =============================================================================
 * BỨC TRANH CHUNG — TRÌNH DUYỆT LẤY SỐ LIỆU THẾ NÀO (4 file trong js/api/)
 *   index.html nạp theo thứ tự:
 *     1) api_v2.js      (trong <head>)  khai hàm dựng lại bảng từ gói D1 + "kho" tháng
 *     2) api_config.js  (trong <head>)  FILE NÀY: khai đường dẫn, BẮN NGAY 4 cuộc gọi
 *                                       (TK3, TK4, vật tư, chỉ số trang chủ)
 *     3) api_loaded.js  (trong <head>)  nhận kết quả, đổ vào window.masterSheetData*,
 *                                       bắn sự kiện TK3DataReady / TK4DataReady...
 *     ... các file vẽ biểu đồ ...
 *     4) api_thang.js   (cuối <body>)   xin thêm tháng cũ khi người xem lọc lùi ngày
 *   main.js gọi loadGoogleSheetData() (api_loaded.js) lúc trang dựng xong; các file
 *   biểu đồ lắng nghe sự kiện *DataReady rồi vẽ.
 *
 * VÌ SAO "BẮN NGAY"
 *   Nếu đợi main.js gọi lúc DOMContentLoaded thì phải chờ tải xong Chart.js từ
 *   CDN, đọc hết ~1.300 dòng HTML và chạy hết các file JS — cuộc gọi API bắt đầu
 *   muộn vô ích. File này bắn cuộc gọi ngay lúc được nạp và cất "lời hứa"
 *   (Promise) vào API_PREWARM; api_loaded.js dùng lại lời hứa đó, không gọi lần hai.
 *   File KHÔNG đụng tới DOM lúc nạp nên đặt trong <head> là an toàn.
 *
 * HAI NGUỒN DỮ LIỆU
 *   D1 (/api/v2/...) — nguồn chính: gọn, đã chuẩn hoá, tải theo tháng.
 *   KV (/api/tk3...) — nguyên văn lần đẩy gần nhất của Apps Script: đường lui
 *                      khi /api/v2 lỗi. Thêm ?nguon=kv vào địa chỉ trang để ép
 *                      dùng KV — tiện so hai nguồn khi nghi số liệu lệch.
 * ===========================================================================*/

/* Đường dẫn bản KV. Tên "KEY" là di sản từ bản cũ — đây là ĐƯỜNG DẪN, không phải
   khoá bí mật nào cả. Để trống = chưa có API (đang chạy ở máy, xem dưới). */
let API_KEY_TK3 = '';
let API_KEY_TK4 = '';
let API_KEY_VATTU = '';

/* Đường dẫn bản D1 (functions/api/[[route]].js, db/goi-v2.mjs) */
const API_V2 = { TK3: '', TK4: '', VATTU: '', CHI_SO: '' };
/* 'd1' bình thường; 'kv' khi địa chỉ trang có ?nguon=kv */
const API_NGUON = /[?&]nguon=kv\b/.test(window.location.search) ? 'kv' : 'd1';

/* Chỉ trên Cloudflare Pages (*.pages.dev) mới có /api. Chạy npm run dev ở máy thì
   mọi đường dẫn để trống: trang vẫn mở được, chỉ không có số liệu. */
if (window.location.hostname.includes('pages.dev')) {
    API_KEY_TK3 = '/api/tk3';
    API_KEY_TK4 = '/api/tk4';
    API_KEY_VATTU = '/api/vattu';        // vật tư tiêu hao thường xuyên
    API_V2.TK3 = '/api/v2/tk3';
    API_V2.TK4 = '/api/v2/tk4';
    API_V2.VATTU = '/api/v2/vattu';
    API_V2.CHI_SO = '/api/v2/chi-so';
}

/** Tháng bắt đầu của lượt tải MẶC ĐỊNH (TK3/TK4 từ D1): tháng của ngày
 *  (hôm nay - 10 ngày), dạng 'YYYY-MM'.
 *    - Ngày 15/10 -> '2026-10' (chỉ tháng này).
 *    - Ngày 05/10 -> '2026-09' (lấy cả tháng trước, để biểu đồ "7 ngày gần
 *      nhất" vẫn đủ ngày).
 *  Tháng cũ hơn được xin thêm khi cần (js/api/api_thang.js). Tính theo đồng hồ
 *  của máy người xem. */
function apiThangMacDinh() {
    const d = new Date(Date.now() - 10 * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* Mã tab (gid) của hai tab dữ liệu trong Google Sheet. Hiện không file nào dùng —
   chỉ giữ để tra cứu tab nào là của dây chuyền nào. */
const SHEET_ID_TK3 = '643230965';
const SHEET_ID_TK4 = '1040221561';

/* Tham số còn lại từ thời trình duyệt gọi thẳng Apps Script. Máy chủ hiện bỏ qua
   nó; giữ nguyên để đường dẫn (và bản nhớ đệm của trình duyệt) không đổi. */
const API_QUERY = '?limit=10';

/* Lời hứa (Promise) của các cuộc gọi đã bắn sớm. api_loaded.js lấy ra dùng —
   lấy xong thì đặt lại null. batDauLuc: mốc bắn, để in ra mất bao lâu. */
const API_PREWARM = { TK3: null, TK4: null, VATTU: null, CHI_SO: null, batDauLuc: 0 };

/** Tải /api/v2/chi-so: dải chỉ số + mục Sản lượng + 3 bảng cảnh báo của tháng
 *  này, máy chủ đã tính sẵn. Gói chỉ vài KB nên về trước số liệu TK3/TK4 ->
 *  trang chủ có số ngay.
 *  Ra: đối tượng kết quả, hoặc null nếu lỗi (khi đó trình duyệt tự tính như cũ,
 *  bằng cùng một mã js/chung/chi_so.js). Với ?nguon=kv thì không dùng — để so
 *  hai nguồn cho sạch. */
function apiTaiChiSo() {
    if (!API_V2.CHI_SO || API_NGUON !== 'd1') return Promise.resolve(null);
    return fetch(API_V2.CHI_SO).then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return j && j.status === 'success' ? j : null; })
        .catch(function () { return null; });
}

/* Quá 6 giờ Apps Script chưa đẩy bản mới thì báo ra Console (F12). Apps Script
   đẩy theo lịch, nên dữ liệu cũ quá lâu gần như chắc chắn là trigger đã ngừng —
   vật tư từng đứng im 20 ngày mà trên web không có dấu hiệu gì.
   Phải giữ bằng NGUONG_CU_GIAY trong functions/api/[[route]].js. */
const API_CANH_BAO_CU_GIAY = 6 * 3600;

/** Số giây -> chữ dễ đọc: 90 -> '2 phút', 7200 -> '2 giờ', 200000 -> '2 ngày'. */
function apiTuoiChu(giay) {
    if (giay < 3600) return Math.round(giay / 60) + ' phút';
    if (giay < 86400) return Math.round(giay / 3600) + ' giờ';
    return Math.round(giay / 86400) + ' ngày';
}

/** Gọi một đường dẫn API, kiểm câu trả lời, trả về gói kết quả hoặc null nếu hỏng.
 *
 *  Vào:
 *    url        đường dẫn
 *    bienDoi    (tuỳ chọn) hàm đổi câu trả lời thành data. /api/v2/tk3 cần cái
 *               này để dựng lại bảng ngang (apiV2NhanGoi trong api_v2.js).
 *    nhanEtag   (tuỳ chọn) hàm nhận ETag của câu trả lời, gọi TRƯỚC bienDoi.
 *  Ra: { data, etag, dayLuc (mốc Apps Script đẩy, ms), nguon: 'd1' | 'kv' } hoặc null.
 *
 *  Kiểm "có nội dung" khác nhau theo dạng: TK3/TK4 là MẢNG hàng, vật tư là ĐỐI
 *  TƯỢNG { TK3:…, TK4:… }. (Dùng .length cho đối tượng sẽ luôn ra undefined và
 *  loại nhầm dữ liệu hợp lệ.)
 *  Tên hàm giữ từ thời gọi thẳng Google Sheet; giờ nó gọi API của dự án. */
async function fetchGoogleSheetData(url, bienDoi, nhanEtag) {
    try {
        const response = await fetch(url);
        if (nhanEtag) nhanEtag(response.headers.get('etag') || '');
        const jsonResponse = await response.json();
        let d = jsonResponse && jsonResponse.data;
        if (bienDoi && jsonResponse && jsonResponse.status === 'success') d = bienDoi(jsonResponse);
        const coND = Array.isArray(d) ? d.length > 0
                   : (d && typeof d === 'object') ? Object.keys(d).length > 0
                   : false;
        if (!jsonResponse || jsonResponse.status !== 'success' || !coND) {
            console.warn('Không tìm thấy dữ liệu API tại URL: ', url);
            return null;
        }
        /* Mốc Apps Script đẩy bản này. Máy chủ bản cũ chưa có header x-xtk2-at
           thì suy ra = giờ máy chủ (header date) trừ tuổi (x-xtk2-age). */
        const h = response.headers;
        const dayLuc = Number(h.get('x-xtk2-at'))
            || (Date.parse(h.get('date')) - Number(h.get('x-xtk2-age')) * 1000) || 0;
        const tuoi = dayLuc ? (Date.now() - dayLuc) / 1000 : 0;
        if (tuoi > API_CANH_BAO_CU_GIAY) {
            console.warn('[Dữ liệu] ' + url + ': lần đẩy lên KV gần nhất cách đây '
                + apiTuoiChu(tuoi) + ' — kiểm tra trigger Apps Script của tuyến này. '
                + 'Xem cả 3 tuyến: /api/trang-thai');
        }
        return { data: d, etag: h.get('etag') || '', dayLuc: dayLuc,
                 nguon: h.get('x-xtk2-source') === 'd1' ? 'd1' : 'kv' };
    } catch (error) {
        console.error('Lỗi kết nối tải dữ liệu từ api', error);
        return null;
    }
}

/** Tải một tuyến ('TK3' | 'TK4' | 'VATTU'): thử D1 trước, hỏng thì lấy bản KV.
 *  Ra: Promise của gói kết quả (xem fetchGoogleSheetData) hoặc null.
 *
 *  Với TK3/TK4 từ D1:
 *    - chỉ xin các tháng từ apiThangMacDinh() trở đi;
 *    - gói nhận về được GỘP vào kho (API_V2_KHO, api_v2.js) rồi dựng bảng từ CẢ
 *      kho — nên các tháng cũ đã tải thêm trước đó vẫn còn khi làm mới;
 *    - etag trả về là vân tay của CẢ kho (apiV2VanTayKho), không phải của riêng
 *      câu trả lời — để api_loaded.js biết bảng có đổi hay không. */
function apiTai(ten) {
    const kv = ten === 'TK3' ? (API_KEY_TK3 && API_KEY_TK3 + API_QUERY)
             : ten === 'TK4' ? (API_KEY_TK4 && API_KEY_TK4 + API_QUERY)
             : API_KEY_VATTU;
    const quaKV = function () { return kv ? fetchGoogleSheetData(kv) : Promise.resolve(null); };
    const v2 = API_NGUON === 'd1' ? API_V2[ten] : '';
    if (!v2) return quaKV();

    /* Vật tư: /api/v2 đã trả đúng dạng cũ, không phải dựng lại gì */
    if (ten === 'VATTU') {
        return fetchGoogleSheetData(v2).then(function (kq) {
            if (kq) return kq;
            console.warn('[Dữ liệu] ' + ten + ': /api/v2 (D1) chưa dùng được — lấy bản KV.');
            return quaKV();
        });
    }

    /* TK3/TK4 phải dựng lại bảng ngang. Thiếu api_v2.js (nạp hỏng) -> dùng thẳng KV */
    if (typeof apiV2NhanGoi !== 'function') return quaKV();
    let etag = '';
    const bienDoi = function (goi) { return apiV2NhanGoi(ten, goi, true, etag); };
    return fetchGoogleSheetData(v2 + '?tu=' + apiThangMacDinh(), bienDoi, function (e) { etag = e; })
        .then(function (kq) {
            if (kq) {
                kq.etag = apiV2VanTayKho(ten);
                return kq;
            }
            /* Chuyển sang KV: bản KV có ĐỦ mọi tháng nên xoá kho (null) — dây này
               không cần tải thêm tháng nào nữa */
            API_V2_KHO[ten] = null;
            console.warn('[Dữ liệu] ' + ten + ': /api/v2 (D1) chưa dùng được — lấy bản KV.');
            return quaKV();
        });
}

/* Bắn 4 cuộc gọi NGAY khi file được nạp, không đợi trang dựng xong. */
(function apiKhoiDongSom() {
    if (!API_KEY_TK3 && !API_KEY_TK4) return;      // chạy ở máy, chưa có API
    API_PREWARM.batDauLuc = Date.now();
    API_PREWARM.TK3 = apiTai('TK3');
    API_PREWARM.TK4 = apiTai('TK4');
    if (API_KEY_VATTU) API_PREWARM.VATTU = apiTai('VATTU');
    API_PREWARM.CHI_SO = apiTaiChiSo();
    console.info('[Dữ liệu] Đã bắn cuộc gọi API ngay từ lúc nạp api_config.js (nguồn: '
        + (API_NGUON === 'd1' ? 'D1, lỗi thì KV' : 'KV — do ?nguon=kv') + ').');
})();
