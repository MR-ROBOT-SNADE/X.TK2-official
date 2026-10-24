/* =============================================================================
 * js/components/Charts/controller/dispatcher.js — BỘ ĐIỀU PHỐI BIỂU ĐỒ (DieuPhoi)
 * =============================================================================
 * Phần 3/8 của phần điều khiển biểu đồ (thư mục controller/, trước 24/10/2026 là
 * chart_cook.js) — đọc controller/module_configs.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 * Trả lời MỘT câu hỏi: "khối biểu đồ nào đang hiện, có cần vẽ (lại) không?".
 * Trang có ~21 biểu đồ nhưng mỗi lúc chỉ MỘT khối hiện (showSubContent ẩn mọi
 * .chart-group rồi hiện đúng một khối) — vẽ cả 21 cái là phí. Nên:
 *   - khối chưa mở lần nào: chưa vẽ;
 *   - mở khối: vẽ khối đó (lần đầu thì đặt bộ lọc mặc định);
 *   - số liệu mới về: đánh dấu mọi khối đã vẽ là "cũ", chỉ vẽ lại khối đang mở;
 *     khối đang ẩn được vẽ lại khi người xem mở tới.
 * (Thay cho bốn cơ chế cũ: vòng vẽ hết, IntersectionObserver, cờ gắn-một-lần và
 * offsetParent trong vòng nhấp nháy.)
 *
 * BA CỬA VÀO, và chỉ ba:
 *   moKhoi(id)     <- main.js gọi khi người dùng mở một khối (bọc showSubContent)
 *   duLieuMoi()    <- cuối processAllModulesData(), khi dữ liệu đổi
 *   canvasDangMo() <- render/overlimit_flash.js hỏi để biết nhấp nháy biểu đồ nào
 * (api_thang.js còn "bọc" moKhoi để tải thêm tháng cũ khi cần.)
 * ===========================================================================*/

/* Khối (id .chart-group trong index.html) -> các loại biểu đồ trong khối.
   Bảng tra DUY NHẤT. Trước đây danh sách này nằm ở 3 nơi và đã lệch nhau: một
   nơi ghi 'QTH' trong khi chartConfigs chỉ có QTHTK3/QTHTK4, nên hai biểu đồ
   quặng trung hoà chưa từng được vẽ từ đó. */
const KHOI_BIEU_DO = {
    'tieu-hao-than':              ['nhietri', 'ccd'],
    'tieu-hao-tro-dung':          ['lime', 'dolomite'],
    'tieu-hao-dien':              ['dien'],
    'tieu-hao-quang':             ['feOre'],
    'tieu-hao-khi-than':          ['CO'],
    'tieu-hao-hoi-nuoc':          ['hoiNuoc'],
    'ti-le-quang-hoi':            ['HLC', 'HN'],
    'chat-luong-quang-trung-hoa': ['QTHTK3', 'QTHTK4'],
    'chat-luong-quang-hoi':       ['CLHLC'],
    'chat-luong-than':            ['CoHatThanNghien', 'CoHatThanCoke', 'ChatLuongThan'],
    'chat-luong-quang-thieu-ket': ['ChemicalQTK', 'PhysicalQTK'],
    'co-hat-quang-thieu-ket':     ['CoHatQTK'],
    'do-kiem':                    ['DoKiemQTK'],
    'chat-luong-voi-nung':        ['burntLime'],
    'chat-luong-dolomite-nung':   ['burntDolomite'],
};

const DieuPhoi = {
    khoiDangMo: null,    /* id khối .chart-group đang hiện (null = trang chủ / mục khác) */
    daVe:   new Set(),   /* khối đã vẽ ít nhất một lần */
    khoiCu: new Set(),   /* khối đã vẽ NHƯNG dữ liệu đã đổi -> cần vẽ lại */

    /* Vẽ khối đang mở. Đã vẽ và dữ liệu chưa đổi thì không làm gì. */
    veKhoiDangMo: function () {
        const id = this.khoiDangMo;
        if (!id || !KHOI_BIEU_DO[id]) return;

        const chuaVe = !this.daVe.has(id);
        if (!chuaVe && !this.khoiCu.has(id)) return;

        KHOI_BIEU_DO[id].forEach(function (loai) {
            /* Lần đầu -> đặt bộ lọc mặc định. Vẽ lại -> GIỮ NGUYÊN bộ lọc người
               xem đang chọn; dùng nhầm clearUniversalFilter ở đây sẽ xoá mất
               khoảng ngày họ vừa đặt. */
            if (chuaVe) clearUniversalFilter(loai);
            else        applyUniversalFilter(loai);
        });

        this.daVe.add(id);
        this.khoiCu.delete(id);
    },

    /* Người dùng mở một khối. Gọi ĐỒNG BỘ ngay sau khi khối được hiện
       (display:flex) — canvas phải đang hiện thì Chart.js mới đo được kích thước. */
    moKhoi: function (idKhoi) {
        this.khoiDangMo = KHOI_BIEU_DO[idKhoi] ? idKhoi : null;
        this.veKhoiDangMo();
        if (typeof chinhNhipNhay === 'function') chinhNhipNhay();
    },

    /* Dữ liệu mới về. Đánh dấu mọi khối đã vẽ là cũ, nhưng CHỈ vẽ lại khối đang
       mở; khối đang ẩn chờ tới lúc được mở. (Bản sửa trước thiếu bước đánh dấu
       này, khiến biểu đồ đứng im ở dữ liệu bản nhớ sau lần xem đầu.) */
    duLieuMoi: function () {
        const self = this;
        this.daVe.forEach(function (id) { self.khoiCu.add(id); });
        this.veKhoiDangMo();
        if (typeof chinhNhipNhay === 'function') chinhNhipNhay();
    },

    /* render/overlimit_flash.js hỏi: những canvas nào đang nằm trong khối đang mở? */
    canvasDangMo: function () {
        if (!this.khoiDangMo || !KHOI_BIEU_DO[this.khoiDangMo]) return [];
        return KHOI_BIEU_DO[this.khoiDangMo]
            .map(function (t) { return chartConfigs[t] && chartConfigs[t].canvasId; })
            .filter(Boolean);
    },
};
window.DieuPhoi = DieuPhoi;
window.KHOI_BIEU_DO = KHOI_BIEU_DO;

/* Trình nghe chỉ được gắn MỘT LẦN. processAllModulesData() chạy tới 3 lần mỗi
   khi mở trang (bản nhớ, TK3 mới, TK4 mới); gắn trong đó sẽ chồng 3 trình nghe,
   khiến mỗi lần đổi ngày biểu đồ vẽ lại 3 lượt. */
let daGanMotLan = false;
function ganMotLan() {
    if (daGanMotLan) return;
    daGanMotLan = true;

    /* Ô chọn ngày của cỡ hạt than: đổi ngày là cập nhật danh sách kíp + vẽ lại */
    const startCoHat = document.getElementById('start-CoHatThan');
    if (startCoHat) {
        startCoHat.addEventListener('change', function () {
            syncShiftDropdown();
            applyUniversalFilter('CoHatThan');
        });
    }
    syncShiftDropdown();   /* mồi chạy lần đầu */
}
