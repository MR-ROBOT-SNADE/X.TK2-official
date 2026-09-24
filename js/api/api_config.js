/* XTK2-API v2 — api_config.js
 * =============================================================================
 * CẤU HÌNH API + KHỞI ĐỘNG SỚM
 * -----------------------------------------------------------------------------
 * Bản cũ chỉ khai đường dẫn rồi ngồi đợi main.js gọi lúc DOMContentLoaded —
 * tức sau khi đã tải xong Chart.js từ CDN, phân tích 1.341 dòng HTML và chạy
 * hết 6 file JS. Cuộc gọi API vì thế bắt đầu muộn một cách vô ích.
 *
 * Bản này BẮN NGAY cuộc gọi khi file được nạp, cất lời hứa vào API_PREWARM.
 * api_loaded.js dùng lại lời hứa đó thay vì gọi lần nữa.
 *
 * >>> ĐỂ ĂN NHIỀU NHẤT: chuyển 2 thẻ script này lên <head> (xem phần trả lời).
 *     File này KHÔNG đụng tới DOM lúc nạp nên đặt ở <head> hoàn toàn an toàn.
 * ===========================================================================*/

let API_KEY_TK3 = '';
let API_KEY_TK4 = '';
let API_KEY_VATTU = '';

if (window.location.hostname.includes('pages.dev')) {
    // Đang chạy trên Cloudflare Pages
    API_KEY_TK3 = '/api/tk3';
    API_KEY_TK4 = '/api/tk4';
    API_KEY_VATTU = '/api/vattu';        // vật tư tiêu hao thường xuyên
}

const SHEET_ID_TK3 = '643230965';
const SHEET_ID_TK4 = '1040221561';

/* Giữ nguyên tham số cũ để không đổi hành vi phía Apps Script */
const API_QUERY = '?limit=10';

/* Lời hứa của các cuộc gọi, bắn ngay khi file này được nạp */
const API_PREWARM = { TK3: null, TK4: null, VATTU: null, batDauLuc: 0 };

/* KV quá số giây này chưa nhận lần đẩy mới thì báo ra Console. Apps Script đẩy
   theo lịch, nên dữ liệu cũ quá lâu gần như chắc chắn là trigger đã ngừng chạy —
   vật tư từng đứng im 20 ngày mà trên web không có dấu hiệu gì. */
const API_CANH_BAO_CU_GIAY = 6 * 3600;

function apiTuoiChu(giay) {
    if (giay < 3600) return Math.round(giay / 60) + ' phút';
    if (giay < 86400) return Math.round(giay / 3600) + ' giờ';
    return Math.round(giay / 86400) + ' ngày';
}

/** Gọi API và trả về dữ liệu, hoặc null nếu hỏng.
 *  TK3/TK4 trả data là MẢNG dòng; vật tư trả data là ĐỐI TƯỢNG { TK3:…, TK4:… }.
 *  Kiểm tra "rỗng" phải khác nhau cho hai dạng — dùng .length cho đối tượng sẽ
 *  luôn ra undefined và loại nhầm dữ liệu hợp lệ. */
async function fetchGoogleSheetData(url) {
    try {
        const response = await fetch(url);
        const jsonResponse = await response.json();
        const d = jsonResponse && jsonResponse.data;
        const coND = Array.isArray(d) ? d.length > 0
                   : (d && typeof d === 'object') ? Object.keys(d).length > 0
                   : false;
        if (!jsonResponse || jsonResponse.status !== 'success' || !coND) {
            console.warn('Không tìm thấy dữ liệu API tại URL: ', url);
            return null;
        }
        /* Mốc Apps Script đẩy bản này lên KV. Máy chủ cũ chưa có x-xtk2-at thì
           suy ra từ giờ máy chủ trừ tuổi. */
        const h = response.headers;
        const dayLuc = Number(h.get('x-xtk2-at'))
            || (Date.parse(h.get('date')) - Number(h.get('x-xtk2-age')) * 1000) || 0;
        const tuoi = dayLuc ? (Date.now() - dayLuc) / 1000 : 0;
        if (tuoi > API_CANH_BAO_CU_GIAY) {
            console.warn('[Dữ liệu] ' + url + ': lần đẩy lên KV gần nhất cách đây '
                + apiTuoiChu(tuoi) + ' — kiểm tra trigger Apps Script của tuyến này. '
                + 'Xem cả 3 tuyến: /api/trang-thai');
        }
        return { data: d, etag: h.get('etag') || '', dayLuc: dayLuc };
    } catch (error) {
        console.error('Lỗi kết nối tải dữ liệu từ api', error);
        return null;
    }
}

/** Bắn 2 cuộc gọi NGAY, không đợi DOMContentLoaded. */
(function apiKhoiDongSom() {
    if (!API_KEY_TK3 && !API_KEY_TK4) return;      // chạy máy nhà, chưa có API
    API_PREWARM.batDauLuc = Date.now();
    if (API_KEY_TK3) API_PREWARM.TK3 = fetchGoogleSheetData(API_KEY_TK3 + API_QUERY);
    if (API_KEY_TK4) API_PREWARM.TK4 = fetchGoogleSheetData(API_KEY_TK4 + API_QUERY);
    if (API_KEY_VATTU) API_PREWARM.VATTU = fetchGoogleSheetData(API_KEY_VATTU);
    console.info('[Dữ liệu] Đã bắn cuộc gọi API ngay từ lúc nạp api_config.js.');
})();
