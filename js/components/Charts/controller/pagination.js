/* =============================================================================
 * js/components/Charts/controller/pagination.js — BIỂU ĐỒ NHIỀU TRANG (MŨI TÊN ‹ ›)
 * =============================================================================
 * Phần 5/8 của phần điều khiển biểu đồ (thư mục controller/, trước 24/10/2026 là
 * chart_cook.js) — đọc controller/module_configs.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 * BIỂU ĐỒ NHIỀU TRANG — một khung, một canvas, một bộ lọc; mũi tên ‹ › hai bên
 * khung đổi giữa các "trang" (vd vôi: trang 1 quy đổi, trang 2 vôi nung + bột
 * đá vôi riêng). Khai bằng chartConfigs[loại].cacTrang = [{ tieuDe, ... }]: mỗi
 * trang GHI ĐÈ các trường của cấu hình gốc (dataSource, keyTK3/keyTK4, draw);
 * trang chỉ có tieuDe thì dùng nguyên cấu hình gốc. canvasId và filterSuffix là
 * của chung, nên bộ lọc đang chọn giữ nguyên khi lật trang và khi số liệu mới về.
 * HTML: khung id="lat-<loại>" chứa h3.lat-tieu-de, .lat-cham (mỗi trang một
 * <span>) và hai nút onclick="latTrangBieuDo('<loại>', -1 | 1)".
 *
 * NHỚ TRANG ĐANG XEM: mỗi lần lật, trang của mọi biểu đồ được ghi vào
 * localStorage của máy người xem (khoá TRANG_KHOA_NHO) — tải lại trang, mở lại
 * hôm sau vẫn ở đúng trang đã lật tới. Chỉ là tiện ích: trình duyệt chặn bộ nhớ
 * (ẩn danh) thì mọi biểu đồ mở ở trang 1 như trước. Không gửi đi đâu.
 * Xoá bằng: localStorage.removeItem('xtk2.trang.v1')
 * --------------------------------------------------------------------------- */
const TRANG_KHOA_NHO = 'xtk2.trang.v1';
/* Biểu đồ sản lượng cũng lật trang (Xưởng TK2 / Xưởng TK1) — số trang = SL_TRANG.length
   ở production.js; khai sẵn ở đây vì docTrangDaNho chạy ngay lúc nạp file */
const SO_TRANG_SAN_LUONG = 2;

/** Đọc trang đã nhớ -> { loại: số trang }. Chỉ nhận số trang còn tồn tại (bớt
 *  trang hay đổi tên biểu đồ thì bỏ qua); hỏng / bị chặn -> {} (= trang 1). */
function docTrangDaNho() {
    const ra = {};
    try {
        const nho = JSON.parse(window.localStorage.getItem(TRANG_KHOA_NHO) || '{}') || {};
        Object.keys(nho).forEach(function (loai) {
            const config = chartConfigs[loai], i = nho[loai];
            /* 'sanLuong' = biểu đồ sản lượng (veBieuDoSanLuong), không nằm trong chartConfigs */
            const soTrang = loai === 'sanLuong' ? SO_TRANG_SAN_LUONG
                : (config && config.cacTrang ? config.cacTrang.length : 0);
            if (Number.isInteger(i) && i >= 0 && i < soTrang) ra[loai] = i;
        });
    } catch (e) { /* hỏng hoặc bị chặn — mở trang 1 */ }
    return ra;
}

/** Ghi trang đang xem; lỗi (hết chỗ, bị chặn) thì bỏ qua — không ảnh hưởng hiển thị. */
function ghiTrangDaNho() {
    try {
        window.localStorage.setItem(TRANG_KHOA_NHO, JSON.stringify(TRANG_DANG_XEM));
    } catch (e) { /* hết chỗ hoặc bị chặn — bỏ qua */ }
}

const TRANG_DANG_XEM = docTrangDaNho();   /* loại -> số thứ tự trang đang xem (chưa có = 0) */

/** Cấu hình của trang đang xem: cấu hình gốc + các trường của trang đó.
 *  Biểu đồ một trang -> chính chartConfigs[chartType]. */
function cauHinhDangXem(chartType) {
    const config = chartConfigs[chartType];
    if (!config || !config.cacTrang) return config;
    return Object.assign({}, config, config.cacTrang[TRANG_DANG_XEM[chartType] || 0]);
}

/** Huỷ biểu đồ đang vẽ trên canvas (lật sang trang không có số để vẽ). */
function xoaBieuDoTrangCu(canvasId) {
    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
        delete chartInstances[canvasId];
    }
}

/** Đưa tiêu đề + chấm của khung id="lat-<chartType>" về đúng trang đang xem. */
function veKhungTrang(chartType) {
    const config = chartConfigs[chartType];
    const khung = document.getElementById('lat-' + chartType);
    if (!config || !config.cacTrang || !khung) return;
    const i = TRANG_DANG_XEM[chartType] || 0;
    const tieuDe = khung.querySelector('.lat-tieu-de');
    if (tieuDe) tieuDe.textContent = config.cacTrang[i].tieuDe;
    khung.querySelectorAll('.lat-cham > span').forEach(function (cham, j) {
        cham.classList.toggle('is-dang-xem', j === i);
    });
    if (config.khiDoiTrang) config.khiDoiTrang(i);
}

/** Mũi tên ‹ (buoc -1) / › (buoc 1) của biểu đồ chartType: sang trang kề (vòng
 *  lại khi tới đầu / cuối), đổi tiêu đề + chấm, nhớ trang, vẽ trang mới với bộ
 *  lọc đang chọn. */
function latTrangBieuDo(chartType, buoc) {
    const config = chartConfigs[chartType];
    if (!config || !config.cacTrang) return;
    const n = config.cacTrang.length;
    TRANG_DANG_XEM[chartType] = (((TRANG_DANG_XEM[chartType] || 0) + buoc) % n + n) % n;
    ghiTrangDaNho();
    veKhungTrang(chartType);
    applyUniversalFilter(chartType);
}

/* Mở trang: HTML viết sẵn tiêu đề + chấm của trang 1 -> khung nào được nhớ ở
   trang khác thì đổi ngay, trước lần vẽ đầu (file này nạp cuối <body>, các khung
   đã có). Lần vẽ đầu (DieuPhoi) tự vẽ đúng trang qua cauHinhDangXem. */
Object.keys(TRANG_DANG_XEM).forEach(veKhungTrang);

/* Biểu đồ nhiều trang chia theo xưởng (chartConfigs[loại].trangTheoDay, vd điện):
   đổi ô "Dây chuyền" sang dây nằm ở trang khác thì lật ngay sang trang đó và vẽ
   lại (như bấm "Lọc dữ liệu"); vẫn lật tay bằng ‹ › được như thường. */
Object.keys(chartConfigs).forEach(function (loai) {
    const config = chartConfigs[loai];
    const o = config.trangTheoDay && document.getElementById('sinterline' + config.filterSuffix);
    if (!o) return;
    o.addEventListener('change', function () {
        const i = config.trangTheoDay[o.value];
        if (i === undefined || i === (TRANG_DANG_XEM[loai] || 0)) return;
        TRANG_DANG_XEM[loai] = i;
        ghiTrangDaNho();
        veKhungTrang(loai);
        applyUniversalFilter(loai);
    });
});
