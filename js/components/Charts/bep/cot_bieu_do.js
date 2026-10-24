/* =============================================================================
 * js/components/Charts/bep/cot_bieu_do.js — "BẾP" BIỂU ĐỒ: ĐỌC FILE NÀY TRƯỚC
 *                                             + KHAI BÁO CỘT CỦA TỪNG BIỂU ĐỒ
 * =============================================================================
 * THƯ MỤC bep/ LÀM GÌ
 *   Thư mục ve/ có sẵn các hàm VẼ. Thư mục này quyết định vẽ GÌ, LÚC NÀO. Trước
 *   24/10/2026 cả thư mục là MỘT file chart_cook.js; nay tách theo việc, nạp
 *   ĐÚNG THỨ TỰ NÀY (index.html — bản build gộp lại thành một gói):
 *     cot_bieu_do.js      mỗi biểu đồ đọc những cột nào         moduleConfigs  (file này)
 *     ghep_so_lieu.js     số liệu về -> ghép số các dây theo từng biểu đồ
 *                                                               processAllModulesData
 *     dieu_phoi.js        chỉ vẽ khối biểu đồ ĐANG MỞ, vẽ lại khi số liệu đổi
 *                                                               DieuPhoi, KHOI_BIEU_DO
 *     bo_loc.js           nút "Lọc dữ liệu" / "Xoá lọc" dưới mỗi biểu đồ
 *                                                               chartConfigs, applyUniversalFilter,
 *                                                               clearUniversalFilter
 *     lat_trang.js        biểu đồ nhiều trang (mũi tên ‹ ›)      latTrangBieuDo
 *     kip_co_hat_than.js  ô "Ca/kíp" của biểu đồ cỡ hạt than     syncShiftDropdown
 *     trang_chu.js        dải chỉ số trang chủ                   ribbonVe
 *     san_luong.js        mục Sản lượng: các thẻ + biểu đồ tháng kpiVe, veBieuDoSanLuong
 *   Số của dải chỉ số và mục Sản lượng được TÍNH ở js/chung/chi_so.js; ở đây
 *   chỉ ghi kết quả vào trang.
 *   Mọi file ở đây là SCRIPT THƯỜNG (không phải module): hàm / biến cấp ngoài
 *   cùng của file này gọi thẳng được từ file khác. Vì vậy:
 *     - không đặt hai tên cấp ngoài cùng trùng nhau, dù ở hai file khác nhau;
 *     - câu lệnh chạy NGAY khi nạp file (không nằm trong hàm) chỉ được dùng tên
 *       của file nạp TRƯỚC nó. Gọi hàm của file nạp sau thì npm run dev báo lỗi
 *       "... is not defined" (bản build gộp một gói nên vẫn chạy — dễ lọt).
 *
 * ĐƯỜNG ĐI CỦA SỐ LIỆU
 *   api_loaded.js bắn 'TK3DataReady' / 'TK4DataReady'
 *     -> processAllModulesData() (ghep_so_lieu.js): với mỗi mục moduleConfigs,
 *        rút cột của TK3 và TK4 (extractChartData), ghép vào
 *        window.AppChartData[namespaceKey]
 *     -> DieuPhoi.duLieuMoi() (dieu_phoi.js): vẽ lại khối đang mở
 *          -> applyUniversalFilter(loại) (bo_loc.js): đọc ô lọc, smartFilter(),
 *             gọi draw của chartConfigs[loại] -> hàm draw...Chart trong ve/
 *
 *   GHÉP TK3 + TK4 THEO NGÀY + KÍP (ghepTheoNgayKip): số của hai dây (và của hai
 *   khối, như than nghiền + than coke) cùng ngày, cùng kíp thì đứng cùng một điểm
 *   trên trục ngang, dù mỗi dây có số hàng khác nhau. (Trước 05/10/2026 ghép theo
 *   VỊ TRÍ hàng: nạp phiếu BK của TK4 có nhiều hàng hơn TK3 là số TK4 trượt ngày.)
 *
 * TỪ NGỮ
 *   "khối"   một nhóm biểu đồ hiện cùng lúc khi bấm một mục menu, vd khối
 *            'tieu-hao-than' gồm biểu đồ 'nhietri' và 'ccd'. Là thẻ .chart-group
 *            có id tương ứng trong index.html.
 *   "loại"   tên một biểu đồ trong chartConfigs, vd 'nhietri', 'dien', 'CO'.
 *
 * MUỐN THÊM MỘT BIỂU ĐỒ MỚI
 *   1) index.html: trong khối .chart-group, thêm <canvas id="X-chart"> và các ô
 *      lọc id start-X, end-X, shift-X, sinterline-X + nút
 *      onclick="applyUniversalFilter('X')" / "clearUniversalFilter('X')".
 *   2) File này: khai mảng tên cột (colX) + một mục trong moduleConfigs.
 *   3) bo_loc.js: khai chartConfigs['X'] (dataSource, canvasId, filterSuffix '-X', draw).
 *   4) dieu_phoi.js: thêm 'X' vào đúng khối trong KHOI_BIEU_DO.
 *   5) Cần kiểu vẽ mới thì viết thêm hàm draw... trong ve/tieu_hao.js hoặc
 *      ve/chat_luong.js (hoặc dùng drawUniversalComboChart ở ve/da_nang.js cho nhanh).
 * ===========================================================================*/

/* Số liệu đã ghép TK3 + TK4 của từng biểu đồ: AppChartData[namespaceKey] =
   { labels: [...], <key>: [số...], ... } — xem processAllModulesData. */
window.AppChartData = {};

/* Đã nhận số liệu của dây nào chưa. Đủ CẢ HAI dây TK3, TK4 mới ghép và vẽ được;
   TK1, TK2 (Xưởng Thiêu kết 1) về lúc nào thì ghép thêm lúc đó, thiếu thì thôi. */
const appState = {
    isTK3Ready : false,
    isTK4Ready : false,
    isTK1Ready : false,
    isTK2Ready : false
};

/* Thứ tự dây khi ghép: TK3 PHẢI đứng đầu (dungTrucCa giữ nguyên trục ca của nguồn
   đầu, các nguồn sau chèn vào). TK1, TK2 là dây "thêm": chưa có số thì bỏ qua. */
const DAY_CHUYEN_GHEP = ['TK3', 'TK4', 'TK1', 'TK2'];
const DAY_BAT_BUOC = ['TK3', 'TK4'];

/* =============================================================================
 * KHAI BÁO CỘT CỦA TỪNG BIỂU ĐỒ
 * -----------------------------------------------------------------------------
 * Tên cột phải viết Y HỆT tiêu đề cột trong Google Sheet (cả dấu, cả hoa thường,
 * cả khoảng trắng). Sheet đổi tên cột thì sửa ở đây.
 * ===========================================================================*/
const colThanNhietri = [
    "Tiêu hao theo nhiệt trị",
    "Mức trung bình",
    "Tiêu hao than tích luỹ (tính theo nhiệt trị)"
];
const colThanCcd = [
    "Tiêu hao theo Ccd",
    "Mức trung bình",
    "Tiêu hao than tích luỹ (tính theo Ccd)"
];
const colLime = [
    "Tiêu hao quy đổi vôi nung",
    "Tiêu hao quy đổi vôi nung (tích luỹ)"
];
const colDolomite = [
    "Tiêu hao quy đổi đá dolomite",
    "Tiêu hao quy đổi đá dolomite (tích luỹ)"
];
/* Trợ dung tiêu hao THẬT, chưa quy đổi (4 cột thêm cuối khối THTD, có số từ
   09/2026) — trang 2 của biểu đồ vôi / dolomite (chartConfigs.lime.cacTrang) */
const colLimeTach = [
    "Tiêu hao vôi nung",
    "Tiêu hao bột đá vôi"
];
const colDolomiteTach = [
    "Tiêu hao dolomite nung",
    "Tiêu hao bột đá dolomite"
];
/* Cột cuối khối QH (quặng hồi) của sheet, có số từ 09/2026 */
const colHoiNuoc = [
    "Tiêu hao hơi nước nóng"
];
const colElec = [
    "Tiêu hao điện (ca)",
    "Định mức",
    "Tiêu hao điện tích luỹ tháng",
    "Tiêu hao điện trừ DSX (tích luỹ tháng)",
];
const colFeOre = [
    "Tiêu hao quặng chứa sắt"
];

const colCO = [
    "Tiêu hao khí than (khí than)",
    "Tiêu hao khí than tích luỹ (khí than)",
    "Định mức tiêu hao khí than theo thiết kế"
];

const colHLC = [
    "Tỉ lệ quặng HLC (QH)",
    "Tỉ lệ quặng HLC tích lũy (QH)"
];

const colHN = [
    "Tỉ lệ quặng hồi nguội (QH)",
    "Tỉ lệ quặng hồi nguội tích lũy (QH)"
];

const colQTH = [
    "%SiO2 (QTH)",
    "%CaO (QTH)"
];

const colCLHLC = [
    "%SiO2 (HLC)"
];

/* Cỡ hạt than. Tên cột theo tiêu đề sheet nhưng SỐ trong đó là <1 / 1-3 / >3mm
   (P.QLCL xác nhận 04/10/2026); "0,5-1mm" là cột chỉ phiếu BK 4 số mới có
   (js/nap/mau_nap.js, coHatThan). Than coke nằm ở khối riêng 'chất lượng than_1'. */
const colCoHatThanNghien = [
    "Cỡ hạt 0,5-1mm (than nghiền)",
    "Cỡ hạt < 0,5mm (than nghiền)",
    "Cỡ hạt 0,5-3mm (than nghiền)",
    "Cỡ hạt >3mm (than nghiền)"
];

const colChatluongthan = [
    "AK (than nghiền)", "V (Than nghiền)",
    "Ak (than coke)", "V (than coke)"
];

const colChemicalQTK = [
    "FeO", "TFe"
];

const colPhysicalQTK = [
    "T", "A"                        // T = cường độ trống quay, A = chỉ số mài mòn
];

const colCoHatQTK = [
    "< 5mm", "> 40mm"
];

const colDoKiemQTK = [
    "R2", "Khoảng dưới R2", "Khoảng trên R2"
];

const colburntLime = [
    "Cỡ hạt 0 - 3mm (VN) (%)", "% CaO (vôi) (12)", "% CaO (vôi) (13)"
];

const colburntDolomite = [
    "Cỡ hạt 0 - 3mm (ĐN) (%)", "%MgO"
]

/* -----------------------------------------------------------------------------
 * moduleConfigs — MỖI MỤC = MỘT BỘ SỐ LIỆU ĐÃ GHÉP TK3 + TK4
 *   namespaceKey  tên trong window.AppChartData (vd AppChartData.CoalNhietri)
 *   timeCol       cột ngày của khối dữ liệu, vd "Thời gian (THthan)"
 *   shiftCol      cột ca/kíp của khối, vd "Ca/kíp (THthan)"
 *   dataCols      các cột cần rút của khối timeCol (mảng col... ở trên)
 *   mapping       cột nào của dây nào -> đặt tên khoá gì trong bộ số liệu ghép:
 *     valTK3/valTK4     số chính của từng dây
 *     avg               đường trung bình / định mức — lấy TK3, TK3 trống thì TK4
 *     accTK3/accTK4     số phụ thứ nhất của từng dây (thường là luỹ kế)
 *     dsxTK3/dsxTK4     số phụ thứ hai (ban đầu cho điện "trừ DSX")
 *     customTK3/TK4     số phụ thứ ba
 *   Tên vai trò tuỳ ý (vd tn051TK3): đuôi TK3 / TK4 nói số của dây nào, không có
 *   đuôi thì lấy cả hai dây (như avg). Ô có thêm khoi: 'chất lượng than_1' thì
 *   đọc ở khối đó (cột ngày / kíp riêng của khối), không phải khối timeCol.
 *   Tên các ô acc/dsx/custom là di sản: ở nhiều mục chúng chứa chỉ tiêu khác
 *   (CaO, cỡ hạt...), không phải luỹ kế. Đọc "key" để biết thật sự là gì.
 * --------------------------------------------------------------------------- */
const moduleConfigs = [
    {
        namespaceKey: 'CoalNhietri', // Sẽ được lưu thành window.AppChartData.CoalNhietri
        timeCol: "Thời gian (THthan)", shiftCol: "Ca/kíp (THthan)", dataCols: colThanNhietri,
        mapping: {
            valTK3: { key: 'nhietriTK3', sheetCol: "Tiêu hao theo nhiệt trị" },
            valTK4: { key: 'nhietriTK4', sheetCol: "Tiêu hao theo nhiệt trị" },
            avg:    { key: 'trungbinh',  sheetCol: "Mức trung bình" },
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao than tích luỹ (tính theo nhiệt trị)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao than tích luỹ (tính theo nhiệt trị)" }
        }
    },
    {
        namespaceKey: 'CoalCcd',
        timeCol: "Thời gian (THthan)", shiftCol: "Ca/kíp (THthan)", dataCols: colThanCcd,
        mapping: {
            valTK3: { key: 'CcdTK3', sheetCol: "Tiêu hao theo Ccd" },
            valTK4: { key: 'CcdTK4', sheetCol: "Tiêu hao theo Ccd" },
            avg:    { key: 'trungbinh',  sheetCol: "Mức trung bình" },
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao than tích luỹ (tính theo Ccd)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao than tích luỹ (tính theo Ccd)" }
        }
    },
    {
        namespaceKey: 'Lime',
        timeCol: "Thời gian (THTD)", shiftCol: "Ca/kíp (THTD)", dataCols: colLime,
        mapping: {
            valTK3: { key: 'limeTK3', sheetCol: "Tiêu hao quy đổi vôi nung" },
            valTK4: { key: 'limeTK4', sheetCol: "Tiêu hao quy đổi vôi nung" },
            avg:    null, // Vôi không có đường trung bình
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao quy đổi vôi nung (tích luỹ)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao quy đổi vôi nung (tích luỹ)" }
        }
    },
    {
        namespaceKey: 'Dolomite',
        timeCol: "Thời gian (THTD)", shiftCol: "Ca/kíp (THTD)", dataCols: colDolomite,
        mapping: {
            valTK3: { key: 'dolomiteTK3', sheetCol: "Tiêu hao quy đổi đá dolomite" },
            valTK4: { key: 'dolomiteTK4', sheetCol: "Tiêu hao quy đổi đá dolomite" },
            avg:    null,
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao quy đổi đá dolomite (tích luỹ)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao quy đổi đá dolomite (tích luỹ)" }
        }
    },
    {
        namespaceKey: 'LimeTach',
        timeCol: "Thời gian (THTD)", shiftCol: "Ca/kíp (THTD)", dataCols: colLimeTach,
        mapping: {
            valTK3: { key: 'voiNungTK3', sheetCol: "Tiêu hao vôi nung" },
            valTK4: { key: 'voiNungTK4', sheetCol: "Tiêu hao vôi nung" },
            accTK3: { key: 'daVoiTK3', sheetCol: "Tiêu hao bột đá vôi" },
            accTK4: { key: 'daVoiTK4', sheetCol: "Tiêu hao bột đá vôi" }
        }
    },
    {
        namespaceKey: 'DolomiteTach',
        timeCol: "Thời gian (THTD)", shiftCol: "Ca/kíp (THTD)", dataCols: colDolomiteTach,
        mapping: {
            valTK3: { key: 'dolomiteNungTK3', sheetCol: "Tiêu hao dolomite nung" },
            valTK4: { key: 'dolomiteNungTK4', sheetCol: "Tiêu hao dolomite nung" },
            accTK3: { key: 'daDolomiteTK3', sheetCol: "Tiêu hao bột đá dolomite" },
            accTK4: { key: 'daDolomiteTK4', sheetCol: "Tiêu hao bột đá dolomite" }
        }
    },
    {
        namespaceKey: 'Electricity',
        timeCol: "Thời gian (Điện)", shiftCol: "Ca/kíp (Điện)", dataCols: colElec,
        mapping: {
            valTK3: { key: 'elecTK3', sheetCol: "Tiêu hao điện (ca)" },
            valTK4: { key: 'elecTK4', sheetCol: "Tiêu hao điện (ca)" },
            avg:    { key: 'dinhmuc', sheetCol: "Định mức" },
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao điện tích luỹ tháng" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao điện tích luỹ tháng" },
            dsxTK3: { key: 'dsxTK3', sheetCol: "Tiêu hao điện trừ DSX (tích luỹ tháng)" },
            dsxTK4: { key: 'dsxTK4', sheetCol: "Tiêu hao điện trừ DSX (tích luỹ tháng)" }
        }
    },
    {
        namespaceKey: 'FeOre',
        timeCol: "Thời gian (QCS)", shiftCol: "Ca/kíp (QCS)", dataCols: colFeOre,
        mapping: {
            valTK3: { key: 'FeOreTK3', sheetCol: "Tiêu hao quặng chứa sắt" },
            valTK4: { key: 'FeOreTK4', sheetCol: "Tiêu hao quặng chứa sắt" },
            avg: null,
            accTK3: null,
            accTK4: null
        }
    },
    {
        namespaceKey: 'CO',
        timeCol: "Thời gian (khí than)", shiftCol: "Ca/kíp (khí than)", dataCols: colCO,
        mapping: {
            valTK3: { key: 'COTK3', sheetCol: "Tiêu hao khí than (khí than)" },
            valTK4: { key: 'COTK4', sheetCol: "Tiêu hao khí than (khí than)"},
            avg:    { key: 'dinhmuc', sheetCol: "Định mức tiêu hao khí than theo thiết kế"},
            accTK3: { key: 'tichluyTK3', sheetCol: "Tiêu hao khí than tích luỹ (khí than)"},
            accTK4: { key: 'tichluyTK4', sheetCol: "Tiêu hao khí than tích luỹ (khí than)"}
        }
    },
    {
        namespaceKey: 'HoiNuoc',
        timeCol: "Thời gian (QH)", shiftCol: "Ca/kíp (QH)", dataCols: colHoiNuoc,
        mapping: {
            valTK3: { key: 'hoiNuocTK3', sheetCol: "Tiêu hao hơi nước nóng" },
            valTK4: { key: 'hoiNuocTK4', sheetCol: "Tiêu hao hơi nước nóng" }
        }
    },
    {
        namespaceKey: 'HLC',
        timeCol: "Thời gian (QH)", shiftCol: "Ca/kíp (QH)", dataCols: colHLC,
        mapping: {
            valTK3: { key: 'HLCTK3', sheetCol: "Tỉ lệ quặng HLC (QH)" },
            valTK4: { key: 'HLCTK4', sheetCol: "Tỉ lệ quặng HLC (QH)" },
            avg: null,
            accTK3: { key: 'tichluyTK3', sheetCol: "Tỉ lệ quặng HLC tích lũy (QH)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tỉ lệ quặng HLC tích lũy (QH)" },
        }
    },
    {
        namespaceKey: 'HN',
        timeCol: "Thời gian (QH)", shiftCol: "Ca/kíp (QH)", dataCols: colHN,
        mapping: {
            valTK3: { key: 'HNTK3', sheetCol: "Tỉ lệ quặng hồi nguội (QH)" },
            valTK4: { key: 'HNTK4', sheetCol: "Tỉ lệ quặng hồi nguội (QH)" },
            avg: null,
            accTK3: { key: 'tichluyTK3', sheetCol: "Tỉ lệ quặng hồi nguội tích lũy (QH)" },
            accTK4: { key: 'tichluyTK4', sheetCol: "Tỉ lệ quặng hồi nguội tích lũy (QH)" }
        }
    },
    {
        namespaceKey: 'QTH',
        timeCol: "Thời gian (QTH)", shiftCol: "Ca/kíp (QTH)", dataCols: colQTH,
        mapping: {
            valTK3: { key: 'SiO2TK3', sheetCol: "%SiO2 (QTH)" },
            valTK4: { key: 'SiO2TK4', sheetCol: "%SiO2 (QTH)" },
            avg: null,
            accTK3: { key: 'CaOTK3', sheetCol: "%CaO (QTH)" },
            accTK4: { key: 'CaOTK4', sheetCol: "%CaO (QTH)" }
        }
    },
    {
        namespaceKey: 'CLHLC',
        timeCol: "Thời gian (HLC)", shiftCol: "Ca/kíp (HLC)", dataCols: colCLHLC,
        mapping: {
            valTK3: { key: 'SiO2HLCTK3', sheetCol: "%SiO2 (HLC)"},
            valTK4: { key: 'SiO2HLCTK4', sheetCol: "%SiO2 (HLC)"},
            avg: null,
            accTK3: null,
            accTK4: null
        }
    },
    {
        /* Cỡ hạt than nghiền + than coke CHUNG một bộ số liệu (chung trục ca), để
           ô chọn kíp (syncShiftDropdown) xét cả hai loại than ở cùng vị trí.
           Khoá: '<0.5mm' = <1mm, '0.5-3mm' = 1-3mm (xem colCoHatThanNghien) */
        namespaceKey: 'CoHatThan',
        timeCol: "Thời gian (chất lượng than)", shiftCol: "Ca/kíp (chất lượng than)", dataCols: colCoHatThanNghien,
        mapping: {
            tn051TK3: { key: '0.5-1mmTNTK3', sheetCol: "Cỡ hạt 0,5-1mm (than nghiền)" },
            tn051TK4: { key: '0.5-1mmTNTK4', sheetCol: "Cỡ hạt 0,5-1mm (than nghiền)" },
            valTK3: { key: '<0.5mmTNTK3', sheetCol: "Cỡ hạt < 0,5mm (than nghiền)" },
            valTK4: { key: '<0.5mmTNTK4', sheetCol: "Cỡ hạt < 0,5mm (than nghiền)" },
            accTK3: { key: '0.5-3mmTNTK3', sheetCol: "Cỡ hạt 0,5-3mm (than nghiền)" },
            accTK4: { key: '0.5-3mmTNTK4', sheetCol: "Cỡ hạt 0,5-3mm (than nghiền)" },
            dsxTK3: { key: '>3mmTNTK3', sheetCol: "Cỡ hạt >3mm (than nghiền)" },
            dsxTK4: { key: '>3mmTNTK4', sheetCol: "Cỡ hạt >3mm (than nghiền)" },
            tc051TK3: { key: '0.5-1mmTCTK3', sheetCol: "Cỡ hạt 0,5-1mm (than coke)", khoi: 'chất lượng than_1' },
            tc051TK4: { key: '0.5-1mmTCTK4', sheetCol: "Cỡ hạt 0,5-1mm (than coke)", khoi: 'chất lượng than_1' },
            tc1TK3: { key: '<0.5mmTCTK3', sheetCol: "Cỡ hạt < 0,5mm (than coke)", khoi: 'chất lượng than_1' },
            tc1TK4: { key: '<0.5mmTCTK4', sheetCol: "Cỡ hạt < 0,5mm (than coke)", khoi: 'chất lượng than_1' },
            tc13TK3: { key: '0.5-3mmTCTK3', sheetCol: "Cỡ hạt 0,5-3mm (than coke)", khoi: 'chất lượng than_1' },
            tc13TK4: { key: '0.5-3mmTCTK4', sheetCol: "Cỡ hạt 0,5-3mm (than coke)", khoi: 'chất lượng than_1' },
            tc3TK3: { key: '>3mmTCTK3', sheetCol: "Cỡ hạt >3mm (than coke)", khoi: 'chất lượng than_1' },
            tc3TK4: { key: '>3mmTCTK4', sheetCol: "Cỡ hạt >3mm (than coke)", khoi: 'chất lượng than_1' }
        }
    },
    {
        namespaceKey: 'ChemicalQTK',
        timeCol: "Thời gian (QTK)", shiftCol: "Ca/kíp (QTK)", dataCols: colChemicalQTK,
        mapping: {
            valTK3: { key: 'FeOTK3', sheetCol: "FeO" },
            valTK4: { key: 'FeOTK4', sheetCol: "FeO" },
            accTK3: { key: 'TFeTK3', sheetCol: "TFe" },
            accTK4: { key: 'TFeTK4', sheetCol: "TFe" }
        }
    },
    {
        namespaceKey: 'PhysicalQTK',
        timeCol: "Thời gian (QTK)", shiftCol: "Ca/kíp (QTK)", dataCols: colPhysicalQTK,
        mapping: {
            valTK3: { key: 'TrongQuayTK3', sheetCol: "T" },
            valTK4: { key: 'TrongQuayTK4', sheetCol: "T" },
            accTK3: { key: 'MaiMonTK3', sheetCol: "A" },
            accTK4: { key: 'MaiMonTK4', sheetCol: "A" }
        }
    },
    {
        namespaceKey: 'CoHatQTK',
        timeCol: "Thời gian (QTK)", shiftCol: "Ca/kíp (QTK)", dataCols: colCoHatQTK,
        mapping: {
            valTK3: { key: 'CH5mmTK3', sheetCol: "< 5mm" },
            valTK4: { key: 'CH5mmTK4', sheetCol: "< 5mm" },
            accTK3: { key: 'CH40mmTK3', sheetCol: "> 40mm" },
            accTK4: { key: 'CH40mmTK4', sheetCol: "> 40mm" }
        }
    },
    {
        namespaceKey: 'DoKiemQTK',
        timeCol: "Thời gian (QTK)", shiftCol: "Ca/kíp (QTK)", dataCols: colDoKiemQTK,
        mapping: {
            valTK3: { key: 'R2TK3', sheetCol: "R2" },
            valTK4: { key: 'R2TK4', sheetCol: "R2" },
            accTK3: { key: 'KDTK3', sheetCol: "Khoảng dưới R2" },
            accTK4: { key: 'KDTK4', sheetCol: "Khoảng dưới R2" },
            dsxTK3: { key: 'KTTK3', sheetCol: "Khoảng trên R2" },
            dsxTK4: { key: 'KTTK4', sheetCol: "Khoảng trên R2" }
        }
    },
    {
        namespaceKey: 'ChatLuongBurntLime',
        timeCol: "Thời gian (vôi nung)", shiftCol: "Ca/kíp (vôi nung)", dataCols: colburntLime,
        mapping: {
            valTK3: { key: 'CH03VNTK3', sheetCol: "Cỡ hạt 0 - 3mm (VN) (%)"},
            valTK4: { key: 'CH03VNTK4', sheetCol: "Cỡ hạt 0 - 3mm (VN) (%)"},
            avg: null,
            accTK3: { key: 'CaO12TK3', sheetCol: "% CaO (vôi) (12)" },
            accTK4: { key: 'CaO12TK4', sheetCol: "% CaO (vôi) (12)" },
            dsxTK3: { key: 'CaO13TK3', sheetCol: "% CaO (vôi) (13)" },
            dsxTK4: { key: 'CaO13TK4', sheetCol: "% CaO (vôi) (13)" }
        }
    },
    {
        namespaceKey: 'ChatLuongBurntDolomite',
        timeCol: "Thời gian (đo nung)", shiftCol: "Ca/kíp (đo nung)", dataCols: colburntDolomite,
        mapping: {
            valTK3: { key: 'CH03DNTK3', sheetCol: "Cỡ hạt 0 - 3mm (ĐN) (%)" },
            valTK4: { key: 'CH03DNTK4', sheetCol: "Cỡ hạt 0 - 3mm (ĐN) (%)" },
            avg: null,
            accTK3: { key: 'MgOTK3', sheetCol: "%MgO" },
            accTK4: { key: 'MgOTK4', sheetCol: "%MgO" }
        }
    }
];

/* Chất lượng than cần 4 chỉ tiêu mỗi dây -> dùng thêm ô custom. AK / V than coke
   đọc ở khối riêng của nó ('chất lượng than_1'), ghép vào cùng trục ca */
moduleConfigs.push({
    namespaceKey: 'ChatLuongThan',
    timeCol: "Thời gian (chất lượng than)", shiftCol: "Ca/kíp (chất lượng than)", dataCols: colChatluongthan,
    mapping: {
        valTK3: { key: 'AKTNTK3', sheetCol: "AK (than nghiền)" },
        valTK4: { key: 'AKTNTK4', sheetCol: "AK (than nghiền)" },
        accTK3: { key: 'VTNTK3', sheetCol: "V (Than nghiền)" },
        accTK4: { key: 'VTNTK4', sheetCol: "V (Than nghiền)" },
        dsxTK3: { key: 'AKTCTK3', sheetCol: "Ak (than coke)", khoi: 'chất lượng than_1' },
        dsxTK4: { key: 'AKTCTK4', sheetCol: "Ak (than coke)", khoi: 'chất lượng than_1' },
        customTK3: { key: 'VTCTK3', sheetCol: "V (than coke)", khoi: 'chất lượng than_1' },
        customTK4: { key: 'VTCTK4', sheetCol: "V (than coke)", khoi: 'chất lượng than_1' }
    }
});

/* -----------------------------------------------------------------------------
 * TK1, TK2 (XƯỞNG THIÊU KẾT 1) — chỉ các biểu đồ TIÊU HAO có số rõ ràng.
 * Apps Script (apps-script/tk12-nguon.gs) dựng bảng TK1/TK2 với ĐÚNG tên cột sheet
 * TK3, nên mỗi vai trò (val / acc...) của TK3 được nhân thêm cho TK1, TK2: cùng
 * cột, khoá đổi đuôi (nhietriTK3 -> nhietriTK1). 'acc' = luỹ kế, lấy từ hàng Tổng
 * của file TK1/TK2.
 * KHOAN NẠP (chưa có hoặc chưa rõ): hơi nước nóng (TK1, TK2 ghi chung một số tấn
 * hơi), mọi biểu đồ chất lượng (2 sheet nguồn không có số chất lượng).
 * Luỹ kế tỉ lệ HLC nối 10/10/2026 (hàng Tổng của file có số từ tối 10/10; trước
 * đó công thức ra 0,00 — Apps Script bỏ số 0).
 * Điện: TK1, TK2 ở trang RIÊNG của biểu đồ điện (chartConfigs.dien.cacTrang).
 * --------------------------------------------------------------------------- */
const DAY_THEM_VAI_TRO = {
    CoalNhietri:  ['val', 'acc'],
    CoalCcd:      ['val', 'acc'],
    Lime:         ['val', 'acc'],
    Dolomite:     ['val', 'acc'],
    LimeTach:     ['val', 'acc'],       /* acc ở đây là bột đá vôi, không phải luỹ kế */
    DolomiteTach: ['val', 'acc'],       /* acc = bột đá dolomite */
    Electricity:  ['val', 'acc'],       /* không có DSX */
    FeOre:        ['val'],
    CO:           ['val', 'acc'],
    HLC:          ['val', 'acc'],
    HN:           ['val', 'acc'],
};

/* Định mức RIÊNG của TK1, TK2 (xưởng cho số, chưa có trong file nguồn) — vẽ đường
   định mức từng dây + cột vượt thì nhấp nháy (ve/tien_ich.js datasetDayThem).
   Biểu đồ không có ở đây: cột TK1/TK2 không nhấp nháy. */
const DINH_MUC_DAY_THEM = {
    dien: { TK1: 55, TK2: 44 },         /* kWh/tsp, 10/10/2026 */
};
moduleConfigs.forEach(function (mod) {
    (DAY_THEM_VAI_TRO[mod.namespaceKey] || []).forEach(function (vai) {
        const goc = mod.mapping[vai + 'TK3'];
        if (!goc) return;
        ['TK1', 'TK2'].forEach(function (dc) {
            mod.mapping[vai + dc] = Object.assign({}, goc, { key: goc.key.replace(/TK3$/, dc) });
        });
    });
});

/** Gom số TK1, TK2 của một biểu đồ cho tham số "them" của các hàm vẽ
 *  (ve/tien_ich.js datasetDayThem): dayThem(f, 'nhietri', 'tichluy') ->
 *  { TK1: { val: f.nhietriTK1, acc: f.tichluyTK1, dm: null }, TK2: {...} }
 *  dinhMuc: (tuỳ chọn) { TK1: số, TK2: số } — xem DINH_MUC_DAY_THEM. */
function dayThem(f, val, acc, dinhMuc) {
    const ra = {};
    ['TK1', 'TK2'].forEach(function (dc) {
        ra[dc] = { val: f[val + dc] || null, acc: acc ? (f[acc + dc] || null) : null,
                   dm: dinhMuc && dinhMuc[dc] != null ? dinhMuc[dc] : null };
    });
    return ra;
}
