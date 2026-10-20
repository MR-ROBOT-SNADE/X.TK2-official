/* =============================================================================
 * js/components/Charts/chart_cook.js — "BẾP" BIỂU ĐỒ: CHỌN SỐ LIỆU, ĐIỀU PHỐI, LỌC
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   chart_core.js có sẵn các hàm VẼ. File này quyết định vẽ GÌ, LÚC NÀO:
 *     1) Khai báo mỗi biểu đồ đọc những cột nào của bảng tính   moduleConfigs
 *     2) Khi số liệu TK3 + TK4 về, ghép số hai dây theo từng biểu đồ
 *                                                               processAllModulesData
 *     3) Chỉ vẽ khối biểu đồ ĐANG MỞ, vẽ lại khi số liệu đổi     DieuPhoi, KHOI_BIEU_DO
 *     4) Nút "Lọc dữ liệu" / "Xoá lọc" dưới mỗi biểu đồ         applyUniversalFilter,
 *                                                               clearUniversalFilter, chartConfigs
 *     5) Vẽ dải chỉ số trang chủ + mục Sản lượng (số lấy từ js/chung/chi_so.js)
 *                                                               ribbonVe, kpiVe, veBieuDoSanLuong
 *
 * ĐƯỜNG ĐI CỦA SỐ LIỆU
 *   api_loaded.js bắn 'TK3DataReady' / 'TK4DataReady'
 *     -> processAllModulesData(): với mỗi mục moduleConfigs, rút cột của TK3 và
 *        TK4 (extractChartData), ghép vào window.AppChartData[namespaceKey]
 *     -> DieuPhoi.duLieuMoi(): vẽ lại khối đang mở
 *          -> applyUniversalFilter(loại): đọc ô lọc, smartFilter(), gọi draw của
 *             chartConfigs[loại] -> hàm draw...Chart trong chart_core.js
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
 *   3) File này: khai chartConfigs['X'] (dataSource, canvasId, filterSuffix '-X', draw).
 *   4) File này: thêm 'X' vào đúng khối trong KHOI_BIEU_DO.
 *   5) Cần kiểu vẽ mới thì viết thêm hàm draw... trong chart_core.js (hoặc dùng
 *      drawUniversalComboChart cho nhanh).
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
 * 1. KHAI BÁO CỘT CỦA TỪNG BIỂU ĐỒ
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
   định mức từng dây + cột vượt thì nhấp nháy (chart_core.js datasetDayThem).
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
 *  (chart_core.js datasetDayThem): dayThem(f, 'nhietri', 'tichluy') ->
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

/* =============================================================================
 * 2. GHÉP SỐ LIỆU KHI DỮ LIỆU VỀ
 * -----------------------------------------------------------------------------
 * Nghe sự kiện của api_loaded.js. Hẹn 50 ms rồi mới xử lý: TK3 và TK4 thường về
 * sát nhau, gộp hai lần báo thành MỘT lần xử lý cho đỡ tốn CPU.
 * ===========================================================================*/
let hen = 0;

function henXuLy() {
    clearTimeout(hen);
    hen = setTimeout(processAllModulesData, 50);
}
document.addEventListener('TK3DataReady', () => { appState.isTK3Ready = true; henXuLy(); });
document.addEventListener('TK4DataReady', () => { appState.isTK4Ready = true; henXuLy(); });
document.addEventListener('TK1DataReady', () => { appState.isTK1Ready = true; henXuLy(); });
document.addEventListener('TK2DataReady', () => { appState.isTK2Ready = true; henXuLy(); });

/** Nhãn 'dd/mm/yyyy - A' -> [ngày dạng 'yyyy-mm-dd' ('' nếu không đọc được), kíp]. */
function tachNhan(nhan) {
    const s = String(nhan), i = s.lastIndexOf(' - ');
    const ngay = i >= 0 ? s.slice(0, i).trim() : s.trim(), kip = i >= 0 ? s.slice(i + 3).trim() : '';
    const m = ngay.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return [m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '', kip];
}

/** TRỤC CA CHUNG của nhiều nguồn, ghép theo NGÀY + KÍP (thay cho ghép theo vị trí hàng).
 *
 *  dsNhan: [nhãn của nguồn 1, nhãn của nguồn 2, ...] (labels của extractChartData)
 *  Ra: { labels: trục ca chung,
 *        viTri: [mỗi nguồn: mảng "ca thứ i của nguồn -> vị trí trên trục", hoặc
 *                null khi nguồn đó đứng y nguyên vị trí] }
 *
 *  Mỗi ca của mỗi nguồn có khoá (ngày, kíp, lần thứ n của cặp đó trong nguồn —
 *  khối QTK của sheet có 4 hàng mỗi kíp). Hai nguồn cùng khoá = cùng một điểm trên
 *  trục ngang. Nhờ vậy dây nào thiếu ca, thừa ca, nhiều mẫu hơn (phiếu BK) hay bắt
 *  đầu từ tháng khác thì số vẫn rơi đúng ngày, đúng kíp. Trước đây số TK4 được vẽ
 *  vào nhãn TK3 cùng VỊ TRÍ: nạp phiếu BK có số hàng mỗi ngày khác TK3 là số TK4
 *  trượt sang các ngày sau (05/10/2026: số 01-04/10 bị vẽ tới 30/10).
 *
 *  Thứ tự: nguồn đầu (TK3) giữ nguyên thứ tự gốc; ca chỉ nguồn sau mới có thì chèn
 *  ngay sau ca liền trước nó trong chính nguồn đó (cùng ngày), không có thì lên đầu
 *  ngày đó; ngày mới thì chèn đúng chỗ theo lịch.
 *  Lối tắt: mọi nguồn có CÙNG dãy nhãn (đa số khối: hai sheet cùng mẫu hàng) thì
 *  trục = dãy đó, khỏi dò khoá — ra y hệt cách đầy đủ mà nhanh gấp nhiều lần. */
function dungTrucCa(dsNhan) {
    const nhan0 = dsNhan[0];
    const giongNhan0 = function (l) {
        if (l === nhan0) return true;
        if (l.length !== nhan0.length) return false;
        for (let i = 0; i < l.length; i++) if (l[i] !== nhan0[i]) return false;
        return true;
    };
    if (dsNhan.every(giongNhan0)) return { labels: nhan0, viTri: dsNhan.map(function () { return null; }) };

    const nut = new Map();                  /* khoá ca -> { nhan, ngay, sau, vt } */
    const cacNgay = [];                     /* các ngày đã có, tăng dần */
    const dauNgay = new Map(), cuoiNgay = new Map();
    let dau = null;

    /* Nút cuối của ngày gần nhất TRƯỚC ngay (null: chưa có ngày nào trước) */
    const cuoiTruoc = function (ngay) {
        let lo = 0, hi = cacNgay.length;
        while (lo < hi) { const g = (lo + hi) >> 1; if (cacNgay[g] < ngay) lo = g + 1; else hi = g; }
        return lo ? cuoiNgay.get(cacNgay[lo - 1]) : null;
    };
    const chenSau = function (truoc, x) {
        if (truoc) { x.sau = truoc.sau; truoc.sau = x; } else { x.sau = dau; dau = x; }
    };
    const them = function (x, truocCungNgay) {
        if (truocCungNgay) {
            chenSau(truocCungNgay, x);
            if (cuoiNgay.get(x.ngay) === truocCungNgay) cuoiNgay.set(x.ngay, x);
        } else {
            chenSau(cuoiTruoc(x.ngay), x);
            if (!dauNgay.has(x.ngay)) {
                let lo = 0, hi = cacNgay.length;
                while (lo < hi) { const g = (lo + hi) >> 1; if (cacNgay[g] < x.ngay) lo = g + 1; else hi = g; }
                cacNgay.splice(lo, 0, x.ngay);
                cuoiNgay.set(x.ngay, x);
            }
            dauNgay.set(x.ngay, x);
        }
    };

    const daTach = new Map();               /* nhãn -> tachNhan(nhãn): nhãn lặp lại giữa các nguồn */
    const nutCuaNguon = dsNhan.map(function (nhanNguon) {
        const dem = new Map();
        let truoc = null;
        return nhanNguon.map(function (nhan) {
            let t = daTach.get(nhan);
            if (!t) { t = tachNhan(nhan); daTach.set(nhan, t); }
            const ngay = t[0];
            const cap = (ngay || nhan) + '|' + t[1];
            const lan = dem.get(cap) || 0;
            dem.set(cap, lan + 1);
            const khoa = cap + '|' + lan;
            let x = nut.get(khoa);
            if (!x) {
                x = { nhan: nhan, ngay: ngay, sau: null, vt: 0 };
                nut.set(khoa, x);
                them(x, truoc && truoc.ngay === ngay ? truoc : null);
            }
            truoc = x;
            return x;
        });
    });

    const labels = [];
    for (let x = dau; x; x = x.sau) { x.vt = labels.length; labels.push(x.nhan); }
    return { labels: labels, viTri: nutCuaNguon.map(function (ds) { return ds.map(function (x) { return x.vt; }); }) };
}

/** GHÉP NHIỀU NGUỒN lên trục ca chung (dungTrucCa).
 *
 *  nguon: [{ khoa: 'TK3|cột ngày' (tên nguồn, để dùng lại trục),
 *            du: kết quả extractChartData của MỘT dây, MỘT khối,
 *            cot: [[tên cột sheet, khoá trong bộ số liệu ghép], ...] }, ...]
 *  boNho: Map dùng chung trong một lượt processAllModulesData — các mục đọc cùng
 *         bộ nguồn (4 biểu đồ QTK...) dựng trục MỘT lần.
 *  Ra: { labels: [...], <khoá>: [số | null, ...] } — mỗi phần tử ứng với một ca.
 *  Hai nguồn cùng ghi một khoá (đường định mức chung của hai dây): lấy nguồn đầu,
 *  nguồn đầu trống thì lấy nguồn sau. */
function ghepTheoNgayKip(nguon, boNho) {
    const khoaTruc = boNho ? nguon.map(function (n) { return n.khoa; }).join('||') : '';
    let truc = boNho ? boNho.get(khoaTruc) : null;
    if (!truc) {
        truc = dungTrucCa(nguon.map(function (n) { return n.du.labels; }));
        if (boNho) boNho.set(khoaTruc, truc);
    }
    const ra = { labels: truc.labels.slice() };
    nguon.forEach(function (n, s) {
        const vt = truc.viTri[s];
        n.cot.forEach(function (c) {
            const v = n.du[c[0]] || [];
            let dich = ra[c[1]];
            if (!dich) dich = ra[c[1]] = new Array(ra.labels.length).fill(null);
            for (let i = 0; i < v.length; i++) {
                const j = vt ? vt[i] : i;
                if (dich[j] === null && v[i] !== undefined) dich[j] = v[i];
            }
        });
    });
    return ra;
}

/** Ghép số TK3 + TK4 cho MỌI mục moduleConfigs vào window.AppChartData, vẽ lại
 *  trang chủ và khối biểu đồ đang mở. Chỉ chạy khi đã có số liệu CẢ HAI dây.
 *
 *  Với mỗi mục: gom các ô mapping theo (dây, khối) — vai trò đuôi TK3 / TK4 là của
 *  dây đó, vai trò khác (avg) lấy cả hai dây; ô có 'khoi' thì đọc ở khối đó (than
 *  coke nằm ở khối 'chất lượng than_1'), không thì ở khối timeCol của mục. Rồi
 *  ghép theo ngày + kíp (ghepTheoNgayKip): AppChartData[namespaceKey] = { labels, <key>: số... }
 *  Mỗi (dây, khối) chỉ rút MỘT lần bằng extractChartData cho mọi mục cần tới nó,
 *  trục ca của cùng bộ nguồn chỉ dựng một lần — nhanh hơn rút / ghép từng mục. */
function processAllModulesData() {
    if (!appState.isTK3Ready || !appState.isTK4Ready) return;

    /* Dải chỉ số tổng quan trang chủ — đủ cả 2 dây mới tính */
    try { ribbonVe(); } catch (e) { console.error('[Dải chỉ số]', e); }
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    try { veBieuDoSanLuong(); } catch (e) { console.error('[Biểu đồ sản lượng]', e); }

    /* 1) Mỗi mục: các nhóm (dây, khối) cần đọc; gom cột cần rút của từng (dây, khối) */
    const rut = new Map();                  /* 'TK3|cột ngày' -> { dc, timeCol, shiftCol, cot: [cột] } */
    const cacMuc = moduleConfigs.map(mod => {
        const nhom = new Map();             /* 'TK3|cột ngày' -> [[cột, khoá]] */
        DAY_CHUYEN_GHEP.forEach(dc => {
            Object.keys(mod.mapping).forEach(vaiTro => {
                const m = mod.mapping[vaiTro];
                if (!m) return;
                const cuaDc = /TK[1-4]$/.test(vaiTro) ? vaiTro.slice(-3) : null;
                /* Vai trò không đuôi (đường trung bình / định mức chung) chỉ đọc ở
                   TK3, TK4 — sheet TK1, TK2 không có các cột đó */
                if (!cuaDc && DAY_BAT_BUOC.indexOf(dc) < 0) return;
                if (cuaDc && cuaDc !== dc) return;
                const timeCol = m.khoi ? apiV2TenCot('Thời gian', m.khoi) : mod.timeCol;
                const k = dc + '|' + timeCol;
                if (!rut.has(k)) {
                    rut.set(k, { dc, timeCol, shiftCol: m.khoi ? apiV2TenCot('Ca/kíp', m.khoi) : mod.shiftCol, cot: [] });
                }
                const r = rut.get(k);
                [m.sheetCol].concat(m.khoi ? [] : (mod.dataCols || [])).forEach(c => { if (r.cot.indexOf(c) < 0) r.cot.push(c); });
                if (!nhom.has(k)) nhom.set(k, []);
                nhom.get(k).push([m.sheetCol, m.key]);
            });
        });
        return { mod, nhom };
    });
    /* 2) Rút: mỗi (dây, khối) một lần */
    rut.forEach(r => { r.du = extractChartData(window['masterSheetData' + r.dc], r.timeCol, r.shiftCol, r.cot); });
    /* 3) Ghép từng mục; trục ca của cùng bộ nguồn dùng lại (boNho) */
    const boNho = new Map();
    cacMuc.forEach(({ mod, nhom }) => {
        /* TK1, TK2 chưa về / bảng rỗng -> bỏ nguồn đó, vẫn ghép TK3 + TK4 */
        const nguon = [...nhom].map(([k, cot]) => ({ khoa: k, dc: rut.get(k).dc, du: rut.get(k).du, cot }))
            .filter(n => n.du || DAY_BAT_BUOC.indexOf(n.dc) >= 0);
        /* Thiếu số liệu của TK3 hoặc TK4 (bảng rỗng) thì chưa ghép, như trước */
        if (nguon.some(n => !n.du)) return;
        // Gom vào một chỗ (window.AppChartData) thay vì rải biến lên window
        window.AppChartData[mod.namespaceKey] = ghepTheoNgayKip(nguon, boNho);
    });

    console.info("Đã hợp nhất toàn bộ hệ thống biểu đồ vào window.AppChartData");

    ganMotLan();          /* gắn trình nghe — chỉ chạy đúng một lần trong đời trang */
    DieuPhoi.duLieuMoi(); /* vẽ lại khối đang mở (không vẽ tràn lan mọi biểu đồ) */
}

/* =============================================================================
 * 3. BỘ ĐIỀU PHỐI BIỂU ĐỒ (DieuPhoi)
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
 *   canvasDangMo() <- chart_core.js hỏi để biết nhấp nháy biểu đồ nào
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

    /* chart_core.js hỏi: những canvas nào đang nằm trong khối đang mở? */
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

/* =============================================================================
 * 4. BỘ LỌC DÙNG CHUNG CHO MỌI BIỂU ĐỒ
 * -----------------------------------------------------------------------------
 * chartConfigs[loại] — cấu hình của MỘT biểu đồ:
 *   dataSource    hàm trả bộ số liệu đã ghép (luôn đọc bản MỚI NHẤT trong
 *                 AppChartData). api_thang.js đọc chữ 'AppChartData.<tên>' trong
 *                 hàm này để biết biểu đồ dùng khối dữ liệu nào — giữ đúng dạng.
 *   keyTK3/keyTK4 khoá số chính (để smartFilter tham khảo)
 *   canvasId      id thẻ <canvas>
 *   filterSuffix  đuôi id các ô lọc. Với filterSuffix '-ccd' thì các ô là:
 *                   start-ccd    Từ ngày          end-ccd        Đến ngày
 *                   shift-ccd    Ca/kíp           sinterline-ccd Dây chuyền
 *                 (riêng điện có thêm electype-dien: thường / DSX)
 *   defaultDays   số ngày hiện khi không lọc (mặc định 7; cỡ hạt than: 1)
 *   draw(f, canvasId, lineFilter, elecTypeFilter)  gọi hàm vẽ của chart_core.js
 *   cacTrang      (tuỳ chọn) BIỂU ĐỒ NHIỀU TRANG — xem latTrangBieuDo ở cuối mục này
 * ===========================================================================*/
const chartConfigs = {
    'nhietri': {
        dataSource: () => window.AppChartData.CoalNhietri, // hàm mũi tên để luôn lấy số liệu mới nhất
        keyTK3: 'nhietriTK3',
        keyTK4: 'nhietriTK4',
        canvasId: 'coal-chart-nhietri',
        filterSuffix: '-nhietri', // các ô lọc có id start-nhietri, end-nhietri, shift-nhietri, sinterline-nhietri
        draw: (f, canvasId, lineFilter) => drawCoalConsumeChart(canvasId, f.labels, f.nhietriTK3, f.nhietriTK4, f.trungbinh, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'nhietri', 'tichluy'))
    },
    'ccd': {
        dataSource: () => window.AppChartData.CoalCcd,
        keyTK3: 'CcdTK3',
        keyTK4: 'CcdTK4',
        canvasId: 'coal-chart-ccd',
        filterSuffix: '-ccd',
        draw: (f, canvasId, lineFilter) => drawCoalConsumeChart(canvasId, f.labels, f.CcdTK3, f.CcdTK4, f.trungbinh, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'Ccd', 'tichluy'))
    },
    /* Vôi / dolomite: biểu đồ HAI TRANG (mũi tên ‹ › hai bên khung), chung canvas
       và bộ lọc. Trang 1 = cấu hình gốc (quy đổi + luỹ kế), trang 2 = vật liệu nung
       và bột đá tiêu hao riêng. Mọi trang phải đọc cùng khối THTD: api_thang.js
       chỉ dò khối qua dataSource GỐC. */
    'lime': {
        dataSource: () => window.AppChartData.Lime,
        keyTK3: 'limeTK3',
        keyTK4: 'limeTK4',
        canvasId: 'flux-chart-lime',
        filterSuffix: '-lime',
        draw: (f, canvasId, lineFilter) => drawFluxConsumeChart(canvasId, f.labels, f.limeTK3, f.limeTK4, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'lime', 'tichluy')),
        cacTrang: [
            { tieuDe: 'TIÊU HAO QUY ĐỔI VÔI NUNG' },
            {
                tieuDe: 'TIÊU HAO VÔI NUNG VÀ BỘT ĐÁ VÔI',
                dataSource: () => window.AppChartData.LimeTach,
                keyTK3: 'voiNungTK3',
                keyTK4: 'voiNungTK4',
                draw: (f, canvasId, lineFilter) => drawFluxSplitChart(canvasId, f.labels, {
                    tenNung: 'Vôi nung', nungTK3: f.voiNungTK3, nungTK4: f.voiNungTK4, nungTK1: f.voiNungTK1, nungTK2: f.voiNungTK2,
                    tenDa: 'Bột đá vôi', daTK3: f.daVoiTK3, daTK4: f.daVoiTK4, daTK1: f.daVoiTK1, daTK2: f.daVoiTK2
                }, lineFilter)
            }
        ]
    },
    'dolomite': {
        dataSource: () => window.AppChartData.Dolomite,
        keyTK3: 'dolomiteTK3',
        keyTK4: 'dolomiteTK4',
        canvasId: 'flux-chart-dolomite',
        filterSuffix: '-dolomite',
        draw: (f, canvasId, lineFilter) => drawFluxConsumeChart(canvasId, f.labels, f.dolomiteTK3, f.dolomiteTK4, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'dolomite', 'tichluy')),
        cacTrang: [
            { tieuDe: 'TIÊU HAO QUY ĐỔI ĐÁ DOLOMITE' },
            {
                tieuDe: 'TIÊU HAO DOLOMITE NUNG VÀ BỘT ĐÁ DOLOMITE',
                dataSource: () => window.AppChartData.DolomiteTach,
                keyTK3: 'dolomiteNungTK3',
                keyTK4: 'dolomiteNungTK4',
                draw: (f, canvasId, lineFilter) => drawFluxSplitChart(canvasId, f.labels, {
                    tenNung: 'Dolomite nung', nungTK3: f.dolomiteNungTK3, nungTK4: f.dolomiteNungTK4, nungTK1: f.dolomiteNungTK1, nungTK2: f.dolomiteNungTK2,
                    tenDa: 'Bột đá dolomite', daTK3: f.daDolomiteTK3, daTK4: f.daDolomiteTK4, daTK1: f.daDolomiteTK1, daTK2: f.daDolomiteTK2
                }, lineFilter)
            }
        ]
    },
    /* Điện: HAI TRANG theo xưởng, KHÔNG vẽ chung — trang 1 TK3 + TK4 (định mức của
       sheet, luỹ kế thường + DSX), trang 2 TK1 + TK2 (định mức riêng từng dây).
       trangTheoDay: chọn dây ở ô "Dây chuyền" là lật ngay sang trang có dây đó
       ('all' giữ trang đang xem). khiDoiTrang: ô "Loại điện luỹ kế" (thường / DSX)
       chỉ có nghĩa ở trang TK3, TK4 -> ẩn ở trang TK1, TK2. */
    'dien' : {
        dataSource: () => window.AppChartData.Electricity,
        keyTK3: 'elecTK3',
        keyTK4: 'elecTK4',
        canvasId: 'electric-chart',
        filterSuffix: '-dien',
        draw: (f, canvasId, lineFilter, elecTypeFilter) => drawElectricConsumeChart(canvasId, f.labels, f.elecTK3, f.elecTK4, f.dinhmuc, f.tichluyTK3, f.tichluyTK4, f.dsxTK3, f.dsxTK4, lineFilter, elecTypeFilter),
        cacTrang: [
            { tieuDe: 'TIÊU HAO ĐIỆN — XƯỞNG THIÊU KẾT 2 (TK3, TK4)' },
            {
                tieuDe: 'TIÊU HAO ĐIỆN — XƯỞNG THIÊU KẾT 1 (TK1, TK2)',
                draw: (f, canvasId, lineFilter) => drawElectricTK12Chart(canvasId, f.labels, dayThem(f, 'elec', 'tichluy', DINH_MUC_DAY_THEM.dien), lineFilter)
            }
        ],
        trangTheoDay: { TK34: 0, TK3: 0, TK4: 0, TK12: 1, TK1: 1, TK2: 1 },
        khiDoiTrang: function (i) {
            const o = document.getElementById('electype-dien');
            if (o && o.parentElement) o.parentElement.style.display = i === 1 ? 'none' : '';
        }
    },
    'feOre' : {
        dataSource: () => window.AppChartData.FeOre,
        keyTK3: 'FeOreTK3',
        keyTK4: 'FeOreTK4',
        canvasId: 'feoreconsume-chart',
        filterSuffix: '-feOre',
        draw: (f, canvasId, lineFilter) => drawIronOreConsumeChart(canvasId, f.labels, f.FeOreTK3, f.FeOreTK4, lineFilter, dayThem(f, 'FeOre'))
    },
    'CO'   : {
        dataSource: () => window.AppChartData.CO,
        keyTK3: 'COTK3',
        keyTK4: 'COTK4',
        canvasId: 'COconsume-chart',
        filterSuffix: '-CO',
        draw: (f, canvasId, lineFilter) => drawCOConsumeChart(canvasId, f.labels, f.COTK3, f.COTK4, f.dinhmuc, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'CO', 'tichluy'))
    },
    'hoiNuoc': {
        dataSource: () => window.AppChartData.HoiNuoc,
        keyTK3: 'hoiNuocTK3',
        keyTK4: 'hoiNuocTK4',
        canvasId: 'steamconsume-chart',
        filterSuffix: '-hoiNuoc',
        draw: (f, canvasId, lineFilter) => drawSteamConsumeChart(canvasId, f.labels, f.hoiNuocTK3, f.hoiNuocTK4, lineFilter)
    },
    'HLC'   : {
        dataSource: () => window.AppChartData.HLC,
        keyTK3: 'HLCTK3',
        keyTK4: 'HLCTK4',
        canvasId: 'returnfinesrateHLC-chart',
        filterSuffix: '-HLC',
        draw: (f, canvasId, lineFilter) => drawReturnFinesRate(canvasId, f.labels, f.HLCTK3, f.HLCTK4, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'HLC', 'tichluy'))
    },
    'HN'    : {
        dataSource: () => window.AppChartData.HN,
        keyTK3: 'HNTK3',
        keyTK4: 'HNTK4',
        canvasId: 'returnfinesrateHN-chart',
        filterSuffix: '-HN',
        draw: (f, canvasId, lineFilter) => drawReturnFinesRate(canvasId, f.labels, f.HNTK3, f.HNTK4, f.tichluyTK3, f.tichluyTK4, lineFilter, dayThem(f, 'HN', 'tichluy'))
    },
    /* Quặng trung hoà: mỗi dây MỘT biểu đồ riêng (TK3 / TK4), cùng một bộ số liệu */
    'QTHTK3'   : {
        dataSource: () => window.AppChartData.QTH,
        keyTK3: 'SiO2TK3',
        canvasId: 'blendingore-chart-tk3',
        filterSuffix: '-QTHTK3',
        draw: (f, canvasId) => drawQTHChart(canvasId, f.labels, f.SiO2TK3, f.CaOTK3)
    },
    'QTHTK4'   : {
        dataSource: () => window.AppChartData.QTH,
        keyTK4: 'SiO2TK4',
        canvasId: 'blendingore-chart-tk4',
        filterSuffix: '-QTHTK4',
        draw: (f, canvasId) => drawQTHChart(canvasId, f.labels, f.SiO2TK4, f.CaOTK4)
    },
    'CLHLC'    : {
        dataSource: () => window.AppChartData.CLHLC,
        keyTK3: 'SiO2HLCTK3',
        keyTK4: 'SiO2HLCTK4',
        canvasId: 'returnfines-chart',
        filterSuffix: '-CLHLC',
        draw: (f, canvasId, lineFilter) => drawQHLCChart(canvasId, f.labels, f.SiO2HLCTK3, f.SiO2HLCTK4, lineFilter)
    },
    /* Cỡ hạt than: hai biểu đồ cột (nghiền, coke) đọc CHUNG bộ số liệu CoHatThan
       và DÙNG CHUNG một bộ ô lọc '-CoHatThan' chỉ có MỘT ô ngày — xem nhánh
       'CoHatThan' trong applyUniversalFilter / clearUniversalFilter và syncShiftDropdown. */
    'CoHatThanNghien': {
        dataSource: () => window.AppChartData.CoHatThan,
        keyTK3: '<0.5mmTNTK3',
        keyTK4: '<0.5mmTNTK4',
        canvasId: 'coalquality-chart-cohattn',
        filterSuffix: '-CoHatThan',
        defaultDays: 1,
        draw: (f, canvasId, lineFilter) => drawCoalSizeChart(canvasId, f, lineFilter, 'TN')
    },
    'CoHatThanCoke':  {
        dataSource: () => window.AppChartData.CoHatThan,
        keyTK3: '<0.5mmTCTK3',
        keyTK4: '<0.5mmTCTK4',
        canvasId: 'coalquality-chart-cohatcoke',
        filterSuffix: '-CoHatThan',
        defaultDays: 1,
        draw: (f, canvasId, lineFilter) => drawCoalSizeChart(canvasId, f, lineFilter, 'TC')
    },
    'ChatLuongThan': {
        dataSource: () => window.AppChartData.ChatLuongThan,
        keyTK3: 'AKTNTK3',
        keyTK4: 'AKTNTK4',
        canvasId: 'coalquality-chart-ChatLuongThan',
        filterSuffix: '-ChatLuongThan',
        draw: (f, canvasId, lineFilter) => {
            drawCoalQualityChart(
                canvasId, f.labels, f.AKTNTK3, f.VTNTK3, f.AKTNTK4, f.VTNTK4, f.AKTCTK3, f.VTCTK3, f.AKTCTK4, f.VTCTK4, lineFilter
            );
        }
    },
    'ChemicalQTK': {
        dataSource: () => window.AppChartData.ChemicalQTK,
        keyTK3: 'FeOTK3',
        keyTK4: 'FeOTK4',
        canvasId: 'chemicalcomponent-chart-QTK',
        filterSuffix: '-ChatLuongQTK',
        draw: (f, canvasId, lineFilter) => {
            // Hai cụm số liệu: FeO và TFe
            drawQTKQualityChart(
                canvasId, f.labels,
                f.FeOTK3, f.FeOTK4, 'Thành phần FeO', getCSS('--success-green') || '#2ecc71',
                f.TFeTK3, f.TFeTK4, 'Thành phần TFe', getCSS('--warning-yellow') || '#f39c12',
                lineFilter
            );
        }
    },
    'PhysicalQTK': {
        dataSource: () => window.AppChartData.PhysicalQTK,
        keyTK3: 'TrongQuayTK3',
        keyTK4: 'TrongQuayTK4',
        canvasId: 'physicalcomponent-chart-QTK', // Khớp với id thẻ canvas trong index.html
        filterSuffix: '-TCVatLyQTK', // Khớp với id ô lọc (start-TCVatLyQTK)
        draw: (f, canvasId, lineFilter) => {
            // Hai cụm số liệu: Trống quay và Mài mòn
            drawQTKQualityChart(
                canvasId, f.labels,
                f.TrongQuayTK3, f.TrongQuayTK4, 'Cường độ trống quay', getCSS('--danger-red') || '#e74c3c',
                f.MaiMonTK3, f.MaiMonTK4, 'Chỉ số mài mòn', getCSS('--primary-blue') || '#0033a1',
                lineFilter
            );
        }
    },
    'CoHatQTK': {
        dataSource: () => window.AppChartData.CoHatQTK,
        keyTK3: 'CH5mmTK3',
        keyTK4: 'CH5mmTK4',
        canvasId: 'grainsizerate-chart',
        filterSuffix: '-CoHatQTK',
        draw: (f, canvasId, lineFilter) => {
            drawQTKQualityChart(
                canvasId, f.labels,
                f.CH5mmTK3, f.CH5mmTK4, 'Cỡ hạt < 5mm', getCSS('--warning-yellow') || '#f5ef42',
                f.CH40mmTK3, f.CH40mmTK4, 'Cỡ hạt > 40mm', getCSS('--success-green') || '#07f207',
                lineFilter
            );
        }
    },
    'DoKiemQTK': {
        dataSource: () => window.AppChartData.DoKiemQTK,
        keyTK3: 'R2TK3',
        keyTK4: 'R2TK4',
        canvasId: 'basicility-chart',
        filterSuffix: '-DoKiemQTK',
        draw: (f, canvasId, lineFilter) => {
            /* Cụm 2, 3 là đường giới hạn trên / dưới -> vẽ mảnh (xem drawQTKQualityChart) */
            drawQTKQualityChart(
                canvasId, f.labels,
                f.R2TK3, f.R2TK4, 'Độ kiềm R2', getCSS('--primary-blue'),
                f.KTTK3, f.KTTK4, 'Khoảng trên R2 cho phép', getCSS('--danger-red'),
                f.KDTK3, f.KDTK4 ,'Khoảng dưới R2 cho phép', getCSS('--danger-red'),
                lineFilter
            );
        }
    },
    'burntLime': {
        dataSource: () => window.AppChartData.ChatLuongBurntLime,
        keyTK3: 'CH03VNTK3',
        keyTK4: 'CH03VNTK4',
        canvasId: 'burntlime-chart',
        filterSuffix: '-burntlime',
        draw: (f, canvasId, lineFilter) => {
            /* Cột = cỡ hạt 0-3mm; hai cặp đường = %CaO silo 12 và silo 13 */
            const comboConfig = {
                yPrimaryTitle: 'Tỉ lệ %CaO',
                ySecondaryTitle: 'Cỡ hạt 0-3mm (%)',
                bar: {
                    label: 'Cỡ hạt 0-3mm (%)',
                    dataTK3: f.CH03VNTK3,
                    dataTK4: f.CH03VNTK4,
                    colorTK3: getCSS('--primary-blue'),
                    colorTK4: getCSS('--secondary-blue')
                },
                lines: [
                    {
                        labelTK3: '%CaO (Silo 12) - TK3',
                        labelTK4: '%CaO (Silo 12) - TK4',
                        dataTK3: f.CaO12TK3,
                        dataTK4: f.CaO12TK4,
                        colorTK3: getCSS('--warning-yellow') || '#f39c12',
                        colorTK4: getCSS('--success-green') || '#2ecc71',
                        pointStyleTK3: 'circle',
                        pointStyleTK4: 'circle'
                    },
                    {
                        labelTK3: '%CaO (Silo 13) - TK3',
                        labelTK4: '%CaO (Silo 13) - TK4',
                        dataTK3: f.CaO13TK3,
                        dataTK4: f.CaO13TK4,
                        colorTK3: '#e74c3c', // Màu đỏ cho Silo 13 của TK3
                        colorTK4: '#9b59b6', // Màu tím cho Silo 13 của TK4
                        pointStyleTK3: 'rect',
                        pointStyleTK4: 'rect'
                    }
                ]
            };

            drawUniversalComboChart(canvasId, f.labels, comboConfig, lineFilter);
        }
    },
    'burntDolomite': {
        dataSource: () => window.AppChartData.ChatLuongBurntDolomite,
        keyTK3: 'CH03DNTK3',
        keyTK4: 'CH03DNTK4',
        canvasId: 'burntdolomite-chart',
        filterSuffix: '-burntdolomite',
        draw: (f, canvasId, lineFilter) => {
            /* Cột = cỡ hạt 0-3mm; một cặp đường = %MgO */
            const comboConfig = {
                yPrimaryTitle: 'Tỉ lệ %MgO',
                ySecondaryTitle: 'Cỡ hạt 0-3mm (%)',
                bar: {
                    label: 'Cỡ hạt 0-3mm (%)',
                    dataTK3: f.CH03DNTK3,
                    dataTK4: f.CH03DNTK4,
                    colorTK3: getCSS('--primary-blue'),
                    colorTK4: getCSS('--secondary-blue')
                },
                line: {
                    label: 'Tỉ lệ %MgO',
                    dataTK3: f.MgOTK3,
                    dataTK4: f.MgOTK4,
                    colorTK3: getCSS('--warning-yellow'),
                    colorTK4: getCSS('--success-green')
                }
            };

            drawUniversalComboChart(canvasId, f.labels, comboConfig, lineFilter);
        }
    }
};

/** Nút "Lọc dữ liệu" của biểu đồ chartType (index.html gọi qua onclick; DieuPhoi
 *  gọi khi vẽ lại). Đọc các ô lọc theo filterSuffix, lọc bằng smartFilter rồi vẽ.
 *  'CoHatThan' là tên gộp: lọc cùng lúc hai biểu đồ cỡ hạt than nghiền + coke.
 *  (api_thang.js "bọc" hàm này: lọc xong thì xét có cần tải thêm tháng cũ.) */
function applyUniversalFilter(chartType) {
    if (chartType === 'CoHatThan') {
        syncShiftDropdown();
        applyUniversalFilter('CoHatThanNghien');
        applyUniversalFilter('CoHatThanCoke');
        return;
    }
    const config = cauHinhDangXem(chartType);
    const data = config ? config.dataSource() : null;

    if (!data) { if (config && config.cacTrang) xoaBieuDoTrangCu(config.canvasId); return; }

    // Ghép id các ô lọc từ đuôi filterSuffix
    const s_start = `start${config.filterSuffix}`;
    const s_end   = (config.filterSuffix === '-CoHatThan') ? s_start : `end${config.filterSuffix}`;   // cỡ hạt than chỉ có 1 ô ngày
    const s_shift = `shift${config.filterSuffix}`;
    const s_line  = `sinterline${config.filterSuffix}`;

    const lineFilter = document.getElementById(s_line) ? document.getElementById(s_line).value : 'all';

    const elecTypeFilter = document.getElementById('electype-dien') ? document.getElementById('electype-dien').value : 'all';

    const f = smartFilter(data, config.keyTK3, s_start, s_end, s_shift, config.defaultDays || 7);
    if (f && f.labels.length > 0) {
        if (config.draw) {
            config.draw(f, config.canvasId, lineFilter, elecTypeFilter);
        }
    } else {
        /* Biểu đồ nhiều trang: không xoá thì canvas còn hình của trang trước dưới
           tiêu đề trang mới */
        if (config.cacTrang) xoaBieuDoTrangCu(config.canvasId);
        console.warn(`Dữ liệu lọc ${chartType} rỗng.`);
    }
}

/** Nút "Xoá lọc": đưa mọi ô lọc của biểu đồ về mặc định rồi vẽ lại.
 *  Mặc định: không lọc ngày (= 7 ngày gần nhất có số), mọi ca, cả hai dây —
 *  riêng cỡ hạt than, chất lượng than và độ kiềm mặc định chỉ hiện TK3 (vẽ cả
 *  hai dây chung thì quá rối). DieuPhoi gọi hàm này lần đầu vẽ mỗi khối. */
function clearUniversalFilter(chartType) {
    if (chartType === 'CoHatThan') {
        // Cỡ hạt than chỉ có 1 ô chọn ngày
        const el = document.getElementById('start-CoHatThan');
        if (el) el.value = "";

        syncShiftDropdown();

        const lineEl = document.getElementById('sinterline-CoHatThan');
        if (lineEl) lineEl.value = "TK3";

        applyUniversalFilter('CoHatThanNghien');
        applyUniversalFilter('CoHatThanCoke');
        return;
    }

    const config = chartConfigs[chartType];
    if (!config) return;

    const suffix = config.filterSuffix;
    ['start', 'end'].forEach(prefix => {
        const el = document.getElementById(`${prefix}${suffix}`);
        if (el) el.value = "";
    });

    const shiftEl = document.getElementById(`shift${suffix}`);
    if (shiftEl) shiftEl.value = "all";

    const lineEl = document.getElementById(`sinterline${suffix}`);
    if (lineEl) {
        if (suffix === '-CoHatThan' || suffix === '-ChatLuongThan' || suffix === '-DoKiemQTK') {
            lineEl.value = "TK3";
        } else {
            lineEl.value = "all";
        }
    }

    const dsxE1 = document.getElementById(`electype${suffix}`);
    if (dsxE1) dsxE1.value = "all";

    // Xoá xong thì vẽ lại
    applyUniversalFilter(chartType);
}

/* -----------------------------------------------------------------------------
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
   ở cuối file; khai sẵn ở đây vì docTrangDaNho chạy ngay lúc nạp file */
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

/** Cập nhật danh sách kíp trong ô "Ca/kíp" của biểu đồ cỡ hạt than
 *  (#shift-CoHatThan): chỉ liệt kê những kíp THẬT SỰ có số trong ngày đang xem
 *  (ngày được chọn, hoặc ngày mới nhất có số). Một kíp được coi là "có số" nếu
 *  BẤT KỲ dây nào (TK3/TK4, than nghiền/coke) có giá trị <1mm (khoá '<0.5mm...') > 0.
 *  Kíp đang chọn vẫn còn trong danh sách mới thì giữ; không thì chọn kíp đầu. */
function syncShiftDropdown(chartType) {

    /* Than nghiền và than coke chung một bộ số liệu (chung trục ca) */
    const dataTN = window.AppChartData.CoHatThan;
    const dataTC = dataTN;

    const shiftSelect = document.getElementById('shift-CoHatThan');
    const startInput = document.getElementById('start-CoHatThan');

    // Dùng nhãn thời gian của than nghiền làm trục gốc
    if (!dataTN || !dataTN.labels || !shiftSelect) return;

    const startTs = (startInput && startInput.value) ? new Date(startInput.value).getTime() : 0;
    const hasDateFilter = !!(startInput && startInput.value);

    let availableShifts = [];

    /* Ca thứ i có số không — xét cả TK3, TK4, than nghiền và than coke */
    const checkHasData = (i) => {
        let hasTN3 = dataTN['<0.5mmTNTK3'] && dataTN['<0.5mmTNTK3'][i] > 0;
        let hasTN4 = dataTN['<0.5mmTNTK4'] && dataTN['<0.5mmTNTK4'][i] > 0;
        let hasTC3 = dataTC && dataTC['<0.5mmTCTK3'] && dataTC['<0.5mmTCTK3'][i] > 0;
        let hasTC4 = dataTC && dataTC['<0.5mmTCTK4'] && dataTC['<0.5mmTCTK4'][i] > 0;

        return hasTN3 || hasTN4 || hasTC3 || hasTC4;
    };

    if (hasDateFilter) {
        /* Có chọn ngày: lấy các kíp có số của đúng ngày đó */
        for (let i = 0; i < dataTN.labels.length; i++) {
            const label = dataTN.labels[i];
            const [dPart, sPart] = String(label).split(' - ').map(s => s.trim());
            const ts = new Date(dPart.split('/').reverse().join('-')).getTime();

            if (ts === startTs && checkHasData(i)) {
                if (!availableShifts.includes(sPart)) {
                    availableShifts.push(sPart);
                }
            }
        }
    } else {
        /* Không chọn ngày: tìm ngày MỚI NHẤT có số, rồi lấy các kíp của ngày đó */
        let targetDate = "";
        for (let i = dataTN.labels.length - 1; i >= 0; i--) {
            if (checkHasData(i)) {
                targetDate = dataTN.labels[i].split(' - ')[0].trim();
                break;
            }
        }
        for (let i = 0; i < dataTN.labels.length; i++) {
            if (dataTN.labels[i].includes(targetDate) && checkHasData(i)) {
                let shift = dataTN.labels[i].split(' - ')[1].trim();
                if (!availableShifts.includes(shift)) {
                    availableShifts.push(shift);
                }
            }
        }
    }

    availableShifts.sort();

    // Xoá danh sách cũ (tránh còn kíp không còn số liệu)
    const currentVal = shiftSelect.value;
    shiftSelect.innerHTML = '';

    // Nạp lại các kíp có thật
    if (availableShifts.length === 0) {
        shiftSelect.innerHTML = '<option value="all">Trống dữ liệu</option>';
    } else {
        availableShifts.forEach(shift => {
            const opt = document.createElement('option');
            opt.value = shift;
            opt.text = `Kíp ${shift}`;
            shiftSelect.appendChild(opt);
        });
    }

    // Giữ kíp đang chọn nếu còn; không thì chọn kíp đầu tiên
    if (availableShifts.includes(currentVal)) {
        shiftSelect.value = currentVal;
    } else if (availableShifts.length > 0) {
        shiftSelect.value = availableShifts[0];
    } else {
        shiftSelect.value = 'all';
    }
}

/* =============================================================================
 * 5. DẢI CHỈ SỐ TRANG CHỦ + MỤC SẢN LƯỢNG — PHẦN VẼ
 * -----------------------------------------------------------------------------
 * Phần TÍNH (RIBBON_CFG, ribbonQuet, hệ số lợi dụng...) nằm ở js/chung/chi_so.js
 * để máy chủ tính được y hệt. Ở đây chỉ lấy kết quả rồi ghi vào trang.
 * Vẽ lại khi: số liệu TK3+TK4 về (processAllModulesData) hoặc khi máy chủ gửi
 * chỉ số tính sẵn (sự kiện ChiSoReady).
 * ===========================================================================*/

/** Chỉ số tháng này (kết quả tinhRibbon). Có bản máy chủ tính sẵn cho đúng hôm
 *  nay (/api/v2/chi-so) thì dùng luôn — có ngay khi mở trang; không thì tự tính
 *  trên số liệu đang có. Cùng một mã tính nên hai đường ra cùng một số. */
function ribbonTinh() {
    const may = (typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    if (may) return may.ribbon;
    return tinhRibbon(window.masterSheetDataTK3, window.masterSheetDataTK4, new Date());
}

/* Máy chủ tính xong trước khi số liệu TK3/TK4 về -> vẽ trang chủ ngay. Số liệu về
   sau thì processAllModulesData() vẽ lại — vẫn từ bản máy chủ, nên số không nháy. */
document.addEventListener('ChiSoReady', function () {
    try { ribbonVe(); } catch (e) { console.error('[Dải chỉ số]', e); }
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    try { veBieuDoSanLuong(); } catch (e) { console.error('[Biểu đồ sản lượng]', e); }
});

/** CÔNG CỤ TRA CỨU — gõ trong Console (F12): xemCotSanLuong() hoặc
 *  xemCotSanLuong('TK4') để in bảng toàn bộ tên cột của một dây kèm giá trị
 *  hàng đầu. Dùng khi cần lấy tên cột THẬT để khai vào RIBBON_CFG.cols
 *  (js/chung/chi_so.js) — đừng đoán tên cột. */
function xemCotSanLuong(day) {
    const rows = (String(day).toUpperCase() === 'TK4')
        ? window.masterSheetDataTK4 : window.masterSheetDataTK3;
    if (!rows || !rows.length) {
        console.warn('[Dải chỉ số] Chưa có dữ liệu để xem tên cột.');
        return [];
    }
    const keys = Object.keys(rows[0]);
    console.table(keys.map(function (k, i) {
        return { STT: i, 'Tên cột': k, 'Ví dụ dòng 1': rows[0][k] };
    }));
    return keys;
}
window.xemCotSanLuong = xemCotSanLuong;

window.kiemTraHeSoLoiDung = kiemTraHeSoLoiDung;


/** Ghi số vào một ô của dải chỉ số (kiểu Việt: 1.234,5), GIỮ NGUYÊN thẻ <span>
 *  đơn vị đứng sau. Không có số -> '--'. */
function ribbonGhi(id, giaTri, soLe) {
    const el = document.getElementById(id);
    if (!el) return;
    const unit = el.querySelector('span');
    if (giaTri === null || !isFinite(giaTri)) {
        el.textContent = '--';
    } else {
        el.textContent = giaTri.toLocaleString('vi-VN', {
            minimumFractionDigits: soLe, maximumFractionDigits: soLe
        });
    }
    if (unit) el.appendChild(unit);
}

/** Đổ số ra dải chỉ số trang chủ (3 ô: tổng sản lượng, % đạt, hệ số lợi dụng)
 *  và in nhật ký đối chiếu ra Console. */
function ribbonVe() {
    const kq = ribbonTinh();
    if (!kq) {
        console.warn('[Dải chỉ số] Không tìm thấy cột "' + RIBBON_CFG.cols.sanLuong[0]
            + '". Xem tên cột thật bằng: xemCotSanLuong()');
        return;
    }

    const R = RIBBON_CFG.lamTron;
    ribbonGhi('tong-san-luong', kq.tongSL, R.sanLuong);
    ribbonGhi('tb-loi', kq.dat, R.dat);
    ribbonVeHeSo(kq);

    /* Tiêu đề ô đầu ghi rõ đang là tháng nào — khỏi phải sửa index.html mỗi tháng. */
    const h = document.querySelector('#tong-san-luong');
    const box = h && h.closest ? h.closest('.stat-box') : null;
    const tieuDe = box ? box.querySelector('h3') : null;
    if (tieuDe) tieuDe.textContent = 'TỔNG SẢN LƯỢNG THÁNG ' + kq.thang + '/' + kq.nam;

    /* Báo ra Console khi thiếu cột, để biết vì sao một ô trống / thấp */
    if (kq.thieuCot.keHoach) {
        console.warn('[Dải chỉ số] Thiếu cột "' + RIBBON_CFG.cols.keHoach[0]
            + '" -> ô % đạt để trống.');
    }
    if (kq.thieuCot.dung) {
        console.warn('[Dải chỉ số] Không thấy cột giờ dừng (thử: '
            + RIBBON_CFG.cols.gioDung.join(' | ')
            + ') -> mẫu số đang tính với giờ dừng = 0, hệ số sẽ THẤP hơn thực tế. '
            + 'Gõ xemCotSanLuong() để lấy tên cột thật.');
    }
    if (kq.thieuCot.dungKH) {
        /* Sheet hiện chỉ có MỘT cột "Thời gian dừng" gộp cả đình trệ lẫn dừng
           kế hoạch — đúng như công thức đang dùng, nên đây chỉ là ghi chú. */
        console.info('[Dải chỉ số] Không có cột giờ dừng kế hoạch riêng — '
            + 'đang coi cột "' + RIBBON_CFG.cols.gioDung[0] + '" là TỔNG giờ dừng. '
            + 'Nếu sau này tách làm hai cột thì khai tên cột thứ hai vào '
            + 'RIBBON_CFG.cols.gioDungKH, chương trình tự cộng thêm.');
    }

    /* Nhật ký đầy đủ để đối chiếu tay với bảng tính */
    [['TK3', kq.tk3], ['TK4', kq.tk4]].forEach(function (c) {
        const d = c[1];
        if (!d) return;
        const kt = kiemTraHeSoLoiDung(d.heSo);
        const dong = '[Hệ số lợi dụng ' + c[0] + '] '
            + (d.heSo === null ? '--' : d.heSo.toFixed(3)) + ' t/m²·h = '
            + Math.round(d.tongSL).toLocaleString('vi-VN') + ' / ['
            + RIBBON_CFG.heSo.dienTich + ' x (' + RIBBON_CFG.heSo.gioMoiNgay
            + ' x ' + d.soNgay + ' ngày - ' + hsGio(d.gioDung) + 'h dừng)] — '
            + (kt.ok ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ: ' + kt.loi);
        if (kt.ok) console.info(dong); else console.warn(dong);
    });

    console.info('[Dải chỉ số] Tháng ' + kq.thang + '/' + kq.nam
        + ' — ' + kq.soCa + ' ca, sản lượng ' + Math.round(kq.tongSL).toLocaleString('vi-VN')
        + ' / kế hoạch ' + Math.round(kq.tongKH).toLocaleString('vi-VN')
        + ' (cộng tới hết ngày ' + kq.ngayChot + ')');
}

/** Ô hệ số lợi dụng trên trang chủ: một ô nhưng HAI số, TK3 và TK4 đứng cạnh
 *  nhau. Số không hợp lệ (kiemTraHeSoLoiDung) tô đỏ kèm ⚠, rê chuột để xem lý
 *  do; số hợp lệ thì rê chuột xem phép tính. Đơn vị chuyển lên tiêu đề cho khỏi
 *  lặp hai lần. */
function ribbonVeHeSo(kq) {
    const el = document.getElementById('he-so-loi-dung');
    if (!el) return;

    const box = el.closest ? el.closest('.stat-box') : null;
    const tieuDe = box ? box.querySelector('h3') : null;
    if (tieuDe) {
        /* Đơn vị tách thành span riêng để CSS giữ chữ thường "t/m²·h" — h3 đang
           in hoa toàn bộ, để chung thì thành "T/M²·H" khó đọc. */
        tieuDe.textContent = 'HỆ SỐ LỢI DỤNG THÁNG ';
        const dv = document.createElement('span');
        dv.className = 'heso-donvi';
        dv.textContent = '(t/m²·h)';
        tieuDe.appendChild(dv);
    }

    const R = RIBBON_CFG.lamTron;
    el.classList.add('heso-doi');
    el.innerHTML = '';

    [['TK3', kq.tk3], ['TK4', kq.tk4]].forEach(function (c) {
        const d = c[1];
        const hs = d ? d.heSo : null;
        const kt = kiemTraHeSoLoiDung(hs);

        const o = document.createElement('span');
        o.className = 'heso-mot' + (kt.ok ? '' : ' is-loi');
        o.title = kt.ok ? (d ? d.moTaMauSo : '') : kt.loi;

        const ten = document.createElement('b');
        ten.textContent = c[0] + (kt.ok ? '' : ' ⚠');
        const so = document.createElement('i');
        so.textContent = (hs === null || !isFinite(hs)) ? '--'
            : hs.toLocaleString('vi-VN', {
                minimumFractionDigits: R.heSo, maximumFractionDigits: R.heSo });

        o.appendChild(ten);
        o.appendChild(so);
        el.appendChild(o);
    });
}

/* -----------------------------------------------------------------------------
 * MỤC "SẢN LƯỢNG" (#san-luong-theo-thang) — các thẻ chỉ số tháng này
 *   Kế hoạch | Thực tế | % đạt (+ thanh tiến độ, dòng nhận xét)
 *   + 2 thẻ hệ số lợi dụng TK3, TK4 (JS tự dựng thêm, index.html không có sẵn)
 * Dùng LẠI ribbonTinh() nên số luôn khớp với dải chỉ số trang chủ: cùng cột,
 * cùng cách cộng từ ngày 01 tới hôm nay, cùng gộp TK3 + TK4.
 * -------------------------------------------------------------------------- */

/** Ghi chữ vào một ô theo id. */
function kpiGhi(id, chuoi) {
    const el = document.getElementById(id);
    if (el) el.textContent = chuoi;
}

/** Số -> chữ kiểu Việt với `le` số lẻ; không có số -> '--'. */
const kpiSo = function (v, le) {
    return (v === null || !isFinite(v)) ? '--'
        : v.toLocaleString('vi-VN', { minimumFractionDigits: le, maximumFractionDigits: le });
};

/** Dựng khung một thẻ hệ số lợi dụng (id kpi-heso-<ma>). Có rồi thì thôi — gọi
 *  lại nhiều lần không đẻ thêm thẻ. */
function kpiDungTheHeSo(grid, ma, ten) {
    if (document.getElementById('kpi-heso-' + ma)) return;
    const card = document.createElement('div');
    card.className = 'kpi-card kpi-card--heso';
    card.innerHTML = '<h3>Hệ số lợi dụng ' + ten + '</h3>'
        + '<div id="kpi-heso-' + ma + '" class="kpi-value heso">--'
        + '<span class="kpi-unit">t/m²·h</span></div>'
        + '<div id="kpi-heso-' + ma + '-note" class="kpi-trend">Đang cập nhật...</div>';
    grid.appendChild(card);
}

/** Đổ số vào một thẻ hệ số lợi dụng, kèm dòng giải thích phép tính hoặc lý do lỗi. */
function kpiVeMotHeSo(ma, d) {
    const R = RIBBON_CFG.lamTron;
    const kt = kiemTraHeSoLoiDung(d ? d.heSo : null);

    const el = document.getElementById('kpi-heso-' + ma);
    if (el) {
        el.textContent = kpiSo(d ? d.heSo : null, R.heSo);
        const u = document.createElement('span');
        u.className = 'kpi-unit';
        u.textContent = 't/m²·h';
        el.appendChild(u);
        el.classList.toggle('is-loi', !kt.ok);
    }

    const note = document.getElementById('kpi-heso-' + ma + '-note');
    if (note) {
        note.textContent = kt.ok ? (d ? d.moTaMauSo : '') : kt.loi;
        note.className = 'kpi-trend' + (kt.ok ? '' : ' is-cham');
    }
}

/** Vẽ mục Sản lượng: sắp lại thẻ, dựng thẻ hệ số, đổ số, thanh tiến độ, nhận xét. */
function kpiVe() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec) return;

    /* Sửa bố cục: index.html để 2 trong 3 thẻ NẰM NGOÀI lưới .kpi-grid nên hàng
       bị vỡ, thẻ tràn hết bề ngang -> gom hết vào lưới cho ngay ngắn. */
    const grid = sec.querySelector('.kpi-grid');
    if (grid) {
        sec.querySelectorAll(':scope > .kpi-card').forEach(function (c) { grid.appendChild(c); });
    }

    /* Thẻ HỆ SỐ LỢI DỤNG: TÁCH RIÊNG TK3 VÀ TK4.
       Bản cũ gộp một thẻ: lấy sản lượng của CẢ HAI dây chia cho diện tích của
       MỘT máy (360 m²) nên con số phình lên gần gấp đôi — 2,135 t/m²·h trong
       khi trần kỹ thuật chỉ 1,5. Dọn thẻ cũ (#kpi-heso) rồi dựng hai thẻ mới. */
    const theCu = document.getElementById('kpi-heso');
    if (theCu && theCu.closest) {
        const khungCu = theCu.closest('.kpi-card');
        if (khungCu) khungCu.remove();
    }
    if (grid) {
        kpiDungTheHeSo(grid, 'tk3', 'Thiêu kết 3');
        kpiDungTheHeSo(grid, 'tk4', 'Thiêu kết 4');
    }

    const kq = ribbonTinh();
    if (!kq) return;

    const R = RIBBON_CFG.lamTron;
    kpiGhi('kpi-target', kpiSo(kq.tongKH || null, 0));
    kpiGhi('kpi-actual', kpiSo(kq.tongSL, R.sanLuong));
    kpiGhi('kpi-percen', kq.dat === null ? '--%' : kpiSo(kq.dat, R.dat) + '%');

    /* Thanh tiến độ: chặn trong 0..100% để không tràn khung khi vượt kế hoạch */
    const bar = document.getElementById('kpi-progress-bar');
    if (bar) {
        const pct = kq.dat === null ? 0 : Math.max(0, Math.min(100, kq.dat));
        bar.style.width = pct.toFixed(1) + '%';
        bar.classList.toggle('is-vuot', kq.dat !== null && kq.dat >= 100);
    }

    /* Dòng nhận xét: so sản lượng thực tế với TIẾN ĐỘ ĐÁNG LẼ phải đạt tới hôm
       nay (= kế hoạch tháng x số ngày đã qua / số ngày của tháng), chứ không so
       với kế hoạch cả tháng — như vậy giữa tháng mới có ý nghĩa. */
    const el = document.getElementById('kpi-trend');
    if (el) {
        if (!kq.tongKH) {
            el.textContent = 'Chưa có sản lượng kế hoạch trong bảng tính';
            el.className = 'kpi-trend';
        } else {
            const ngayTrongThang = soNgayTrongThang(kq.thang, kq.nam);
            const homNay = new Date().getDate();
            const dangLe = kq.tongKH * (homNay / ngayTrongThang);
            const lech = dangLe > 0 ? ((kq.tongSL - dangLe) / dangLe) * 100 : 0;
            const dat = lech >= 0;
            el.textContent = 'Đến hết ngày ' + homNay + '/' + kq.thang + ' — '
                + (dat ? 'vượt tiến độ ' : 'chậm tiến độ ')
                + Math.abs(lech).toFixed(1) + '% (đáng lẽ '
                + Math.round(dangLe).toLocaleString('vi-VN') + ' tấn)';
            el.className = 'kpi-trend ' + (dat ? 'is-tot' : 'is-cham');
        }
    }

    /* Hệ số lợi dụng: mỗi dây một thẻ, kèm kết quả kiểm tra hợp lệ */
    kpiVeMotHeSo('tk3', kq.tk3);
    kpiVeMotHeSo('tk4', kq.tk4);
}

/* -----------------------------------------------------------------------------
 * BIỂU ĐỒ SẢN LƯỢNG THÁNG NÀY (dưới các thẻ của mục SẢN LƯỢNG)
 *   - CỘT      : sản lượng TỪNG NGÀY của hai dây (cộng các ca trong ngày)
 *   - ĐƯỜNG    : luỹ kế cả xưởng, cộng dồn từ ngày 01 tới hôm nay
 *   - ĐƯỜNG ĐỎ : mục tiêu (sản lượng kế hoạch tháng của cả 2 dây)
 *
 * HAI TRANG, mỗi xưởng một trang — KHÔNG gộp chung; mũi tên ‹ › hai bên khung đổi
 * trang như biểu đồ vôi / dolomite (trang đang xem được nhớ: TRANG_DANG_XEM.sanLuong):
 *   trang 1  Xưởng Thiêu kết 2: TK3 + TK4, có đường mục tiêu
 *   trang 2  Xưởng Thiêu kết 1: TK1 + TK2, CHƯA có mục tiêu (2 sheet nguồn của
 *            TK1/TK2 không có kế hoạch tháng)
 *
 * HAI TRỤC là bắt buộc: cột mỗi ngày ~18 nghìn tấn, còn luỹ kế lên tới hơn 600
 * nghìn — để chung một trục thì mấy cột bẹp dí thành một vạch sát đáy.
 *   trục TRÁI  : sản lượng ngày (cột)
 *   trục PHẢI  : luỹ kế + mục tiêu (đường)
 *
 * Không có bộ chọn ngày: luôn hiển thị tháng hiện tại, từ ngày 01 tới hôm nay.
 * -------------------------------------------------------------------------- */

let slChartInstance = null;      /* biểu đồ sản lượng đang vẽ (để huỷ khi vẽ lại) */

/* Các trang của biểu đồ sản lượng (số trang phải bằng SO_TRANG_SAN_LUONG) */
const SL_TRANG = [
    { xuong: 'XƯỞNG THIÊU KẾT 2', day: ['TK3', 'TK4'], ten: ['Thiêu kết 3', 'Thiêu kết 4'],
      mau: ['rgba(26,79,214,.85)', 'rgba(243,156,18,.85)'], mucTieu: true },
    { xuong: 'XƯỞNG THIÊU KẾT 1', day: ['TK1', 'TK2'], ten: ['Thiêu kết 1', 'Thiêu kết 2'],
      mau: [MAU_DAY_THEM.TK1, MAU_DAY_THEM.TK2], mucTieu: false },
];

/** Nút ‹ (buoc -1) / › (buoc 1) của biểu đồ sản lượng: sang xưởng kia, nhớ trang, vẽ lại. */
function latTrangSanLuong(buoc) {
    const n = SL_TRANG.length;
    TRANG_DANG_XEM.sanLuong = (((TRANG_DANG_XEM.sanLuong || 0) + buoc) % n + n) % n;
    ghiTrangDaNho();
    veBieuDoSanLuong();
}

function veBieuDoSanLuong() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec || typeof Chart === 'undefined') return;

    /* Tạo sẵn khung vẽ nếu index.html chưa có — khỏi phải sửa HTML. Khung lật
       trang dùng lại đúng các lớp .lat-khung / .lat-nut / .lat-cham của biểu đồ vôi */
    let box = document.getElementById('sanluong-chart-box');
    if (!box) {
        const khung = document.createElement('div');
        khung.className = 'lat-khung';
        khung.id = 'lat-sanLuong';
        khung.innerHTML = '<button type="button" class="lat-nut lat-nut--trai" onclick="latTrangSanLuong(-1)" aria-label="Xưởng trước">&#8249;</button>'
            + '<div id="sanluong-chart-box" class="chart-container sanluong-chart">'
            + '<h3 class="sanluong-chart__title lat-tieu-de"></h3>'
            + '<div class="lat-cham" aria-hidden="true">' + SL_TRANG.map(function () { return '<span></span>'; }).join('') + '</div>'
            + '<div class="sanluong-chart__canvas"><canvas id="sanluong-chart"></canvas></div>'
            + '</div>'
            + '<button type="button" class="lat-nut lat-nut--phai" onclick="latTrangSanLuong(1)" aria-label="Xưởng sau">&#8250;</button>';
        sec.appendChild(khung);
        box = document.getElementById('sanluong-chart-box');
    }

    const iTrang = TRANG_DANG_XEM.sanLuong || 0;
    const trang = SL_TRANG[iTrang];
    box.querySelectorAll('.lat-cham > span').forEach(function (cham, j) { cham.classList.toggle('is-dang-xem', j === iTrang); });

    const now = new Date();
    const thang = now.getMonth() + 1, nam = now.getFullYear();
    const soNgay = soNgayTrongThang(thang, nam);
    const tieuDe = box.querySelector('.sanluong-chart__title');
    if (tieuDe) tieuDe.textContent = 'SẢN LƯỢNG THÁNG ' + thang + '/' + nam + ' — ' + trang.xuong
        + ' (' + trang.day.join(' + ') + ') — theo ngày và luỹ kế';

    /* Sản lượng từng ngày { ngày: tấn }: trang TK3 + TK4 dùng bản máy chủ tính sẵn
       nếu có, không thì tự tính (cùng hàm slTheoNgay trong js/chung/chi_so.js) */
    const may = (iTrang === 0 && typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    const m3 = may ? may.sanLuongNgay.TK3 : slTheoNgay(window['masterSheetData' + trang.day[0]] || [], thang, nam);
    const m4 = may ? may.sanLuongNgay.TK4 : slTheoNgay(window['masterSheetData' + trang.day[1]] || [], thang, nam);

    /* TRỤC NGÀY: luôn từ NGÀY 01 tới HÔM NAY của tháng hiện tại.
       (Không lấy "ngày cuối có số liệu": sang tháng mới, ngày 01/09 chỉ hiện
       đúng một cột 1/9, không dính gì của tháng 8.) Ngày nào chưa có số thì để
       TRỐNG (null) — cột bên phải trống dần chứ không tụt về 0. */
    const homNay = now.getDate();

    const nhan = [], tk3 = [], tk4 = [], luyKe = [];
    let cong = 0, coSo = false;
    for (let d = 1; d <= homNay; d++) {
        nhan.push(d + '/' + thang);
        const a = m3[d], b = m4[d];
        const coNgay = (a !== undefined) || (b !== undefined);

        tk3.push(a === undefined ? null : a);
        tk4.push(b === undefined ? null : b);

        if (coNgay) {
            cong += (a || 0) + (b || 0);
            coSo = true;
        }
        /* Luỹ kế chỉ vẽ tới ngày CÓ số liệu; ngày sau để null cho đường dừng lại,
           không kéo ngang giả tạo tới cuối tháng. */
        luyKe.push(coNgay ? cong : null);
    }
    if (!coSo) {                            // cả tháng chưa có số nào
        /* Huỷ hình của trang kia (lật trang) cho khỏi hiện số xưởng khác dưới tiêu đề này */
        if (slChartInstance) { slChartInstance.destroy(); slChartInstance = null; }
        if (tieuDe) tieuDe.textContent += ' — chưa có số liệu tháng này';
        return;
    }

    /* Mục tiêu = kế hoạch tháng của TK3 + TK4 (ribbonTinh); xưởng TK1 chưa có */
    const kq = trang.mucTieu ? ribbonTinh() : null;
    const mucTieu = kq && kq.tongKH ? kq.tongKH : null;

    const ds = [
        {
            type: 'line', label: 'Luỹ kế cả xưởng', data: luyKe,
            borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,.10)',
            borderWidth: 3, tension: 0.3, pointRadius: 2, fill: true,
            spanGaps: false,                 /* ngày trống thì ĐỨT, không nối tắt */
            yAxisID: 'y_luyke', order: 1, datalabels: { display: false }
        },
        {
            type: 'bar', label: trang.ten[0], data: tk3,
            backgroundColor: trang.mau[0], yAxisID: 'y_ngay', order: 3,
            datalabels: { display: false }
        },
        {
            type: 'bar', label: trang.ten[1], data: tk4,
            backgroundColor: trang.mau[1], yAxisID: 'y_ngay', order: 4,
            datalabels: { display: false }
        }
    ];

    /* Có kế hoạch thì chèn đường mục tiêu (đường ngang đỏ) vào sau đường luỹ kế */
    if (mucTieu) {
        ds.splice(1, 0, {
            type: 'line', label: 'Mục tiêu tháng',
            data: nhan.map(function () { return mucTieu; }),
            borderColor: '#e74c3c', borderWidth: 2,   /* liền nét, bỏ borderDash */
            pointRadius: 0, fill: false, tension: 0,
            yAxisID: 'y_luyke', order: 2, datalabels: { display: false }
        });
    }

    if (slChartInstance) slChartInstance.destroy();
    slChartInstance = new Chart(document.getElementById('sanluong-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: nhan, datasets: ds },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y_ngay: {
                    type: 'linear', position: 'left', min: 0, grace: '10%',
                    title: { display: true, text: 'Sản lượng ngày (tấn)' }
                },
                y_luyke: {
                    type: 'linear', position: 'right', min: 0,
                    /* Nới trần để đường mục tiêu không dính sát mép trên */
                    suggestedMax: mucTieu ? mucTieu * 1.08 : undefined,
                    title: { display: true, text: 'Luỹ kế / mục tiêu (tấn)' },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10 } },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            const v = c.parsed.y;
                            return c.dataset.label + ': '
                                + (v === null ? '--' : Math.round(v).toLocaleString('vi-VN')) + ' tấn';
                        }
                    }
                }
            }
        }
    });
}
