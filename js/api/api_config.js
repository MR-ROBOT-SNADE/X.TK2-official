/* CẤU HÌNH API DỮ LIỆU */

let API_KEY_TK3 = '';
let API_KEY_TK4 = '';

if (window.location.hostname.includes('pages.dev')) {
    // Đang sử dụng cloudflare pages
    API_KEY_TK3 = '/api/tk3';
    API_KEY_TK4 = '/api/tk4';
}
const SHEET_ID_TK3 = '643230965';
const SHEET_ID_TK4 = '1040221561';

async function fetchGoogleSheetData(url) {
    try {
        const response = await fetch(url);
        const jsonResponse = await response.json();
        if (!jsonResponse || jsonResponse.status !== "success" || !jsonResponse.data || jsonResponse.data.length === 0) {
            console.warn("Không tìm thấy dữ liệu API tại URL: ",url);
            return null;
        }

        return jsonResponse.data;
    } catch (error) {
        console.error("Lỗi kết nối tải dữ liệu từ api", error);
        return null;
    }
}