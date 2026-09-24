/* ==============================================================
            KÍCH HOẠT VẼ BIỂU ĐỒ GỘP TK3 & TK4
   ============================================================== */

/* Biến toàn cục giữ nguyên */
window.AppChartData = {};

const appState = {
    isTK3Ready : false,
    isTK4Ready : false
};

/* Đặt tên cột cho chuẩn với database hiện tại đang sử dụng */
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

const colCoHatThanNghien = [
    "Cỡ hạt < 0,5mm (than nghiền)",
    "Cỡ hạt 0,5-3mm (than nghiền)",
    "Cỡ hạt >3mm (than nghiền)"
];

const colCoHatThanCoke = [
    "Cỡ hạt < 0,5mm (than coke)",
    "Cỡ hạt 0,5-3mm (than coke)",
    "Cỡ hạt >3mm (than coke)"
];

const colChatluongthan = [
    "AK (than nghiền)", "V (Than nghiền)",
    "Ak (than coke)", "V (than coke)"
];

const colChemicalQTK = [
    "FeO", "TFe"
];

const colPhysicalQTK = [
    "T", "A"
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
        namespaceKey: 'CoHatThanNghien',
        timeCol: "Thời gian (chất lượng than)", shiftCol: "Ca/kíp (chất lượng than)", dataCols: colCoHatThanNghien,
        mapping: {
            valTK3: { key: '<0.5mmTNTK3', sheetCol: "Cỡ hạt < 0,5mm (than nghiền)" },
            valTK4: { key: '<0.5mmTNTK4', sheetCol: "Cỡ hạt < 0,5mm (than nghiền)" },
            accTK3: { key: '0.5-3mmTNTK3', sheetCol: "Cỡ hạt 0,5-3mm (than nghiền)" },
            accTK4: { key: '0.5-3mmTNTK4', sheetCol: "Cỡ hạt 0,5-3mm (than nghiền)" },
            dsxTK3: { key: '>3mmTNTK3', sheetCol: "Cỡ hạt >3mm (than nghiền)" },
            dsxTK4: { key: '>3mmTNTK4', sheetCol: "Cỡ hạt >3mm (than nghiền)" }
        }
    },
    {
        namespaceKey: 'CoHatThanCoke',
        timeCol: "Thời gian (chất lượng than)", shiftCol: "Ca/kíp (chất lượng than)", dataCols: colCoHatThanCoke,
        mapping: {
            valTK3: { key: '<0.5mmTCTK3', sheetCol: "Cỡ hạt < 0,5mm (than coke)" },
            valTK4: { key: '<0.5mmTCTK4', sheetCol: "Cỡ hạt < 0,5mm (than coke)" },
            accTK3: { key: '0.5-3mmTCTK3', sheetCol: "Cỡ hạt 0,5-3mm (than coke)" },
            accTK4: { key: '0.5-3mmTCTK4', sheetCol: "Cỡ hạt 0,5-3mm (than coke)" },
            dsxTK3: { key: '>3mmTCTK3', sheetCol: "Cỡ hạt >3mm (than coke)" },
            dsxTK4: { key: '>3mmTCTK4', sheetCol: "Cỡ hạt >3mm (than coke)" }
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

moduleConfigs.push({
    namespaceKey: 'ChatLuongThan', 
    timeCol: "Thời gian (chất lượng than)", shiftCol: "Ca/kíp (chất lượng than)", dataCols: colChatluongthan,
    mapping: {
        valTK3: { key: 'AKTNTK3', sheetCol: "AK (than nghiền)" },
        valTK4: { key: 'AKTNTK4', sheetCol: "AK (than nghiền)" },
        accTK3: { key: 'VTNTK3', sheetCol: "V (Than nghiền)" },
        accTK4: { key: 'VTNTK4', sheetCol: "V (Than nghiền)" },
        dsxTK3: { key: 'AKTCTK3', sheetCol: "Ak (than coke)" },
        dsxTK4: { key: 'AKTCTK4', sheetCol: "Ak (than coke)" },
        customTK3: { key: 'VTCTK3', sheetCol: "V (than coke)" },
        customTK4: { key: 'VTCTK4', sheetCol: "V (than coke)" }
    }
});
/* Nghe sự kiện bên api_loaded để kích hoạt load dữ liệu từ gg sheet, không thay đổi gì. Cập nhật ngày 07/09/2026 để giảm tải CPU*/
let hen = 0;

function henXuLy() {
    clearTimeout(hen);
    hen = setTimeout(processAllModulesData, 50);
}
document.addEventListener('TK3DataReady', () => { appState.isTK3Ready = true; henXuLy(); });
document.addEventListener('TK4DataReady', () => { appState.isTK4Ready = true; henXuLy(); });

function processAllModulesData() {
    if (!appState.isTK3Ready || !appState.isTK4Ready) return;

    /* Dải chỉ số tổng quan trang chủ — đủ cả 2 dây mới tính */
    try { ribbonVe(); } catch (e) { console.error('[Dải chỉ số]', e); }
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    try { veBieuDoSanLuong(); } catch (e) { console.error('[Biểu đồ sản lượng]', e); }

    moduleConfigs.forEach(mod => {

    const tk3Data = extractChartData(window.masterSheetDataTK3, mod.timeCol, mod.shiftCol, mod.dataCols);
    const tk4Data = extractChartData(window.masterSheetDataTK4, mod.timeCol, mod.shiftCol, mod.dataCols);    

        if (tk3Data && tk4Data) {
                let mergedResult = { labels: tk3Data.labels };

                mergedResult[mod.mapping.valTK3.key] = tk3Data[mod.mapping.valTK3.sheetCol];
                mergedResult[mod.mapping.valTK4.key] = tk4Data[mod.mapping.valTK4.sheetCol];
                
                if (mod.mapping.avg) {
                    mergedResult[mod.mapping.avg.key] = tk3Data[mod.mapping.avg.sheetCol];
                }

                if (mod.mapping.accTK3 && mod.mapping.accTK4) {
                    mergedResult[mod.mapping.accTK3.key] = tk3Data[mod.mapping.accTK3.sheetCol];
                    mergedResult[mod.mapping.accTK4.key] = tk4Data[mod.mapping.accTK4.sheetCol];
                }

                if (mod.mapping.dsxTK3) {
                mergedResult[mod.mapping.dsxTK3.key] = tk3Data[mod.mapping.dsxTK3.sheetCol];
                mergedResult[mod.mapping.dsxTK4.key] = tk4Data[mod.mapping.dsxTK4.sheetCol];
                }

                if (mod.mapping.customTK3) {
                mergedResult[mod.mapping.customTK3.key] = tk3Data[mod.mapping.customTK3.sheetCol];
                mergedResult[mod.mapping.customTK4.key] = tk4Data[mod.mapping.customTK4.sheetCol];
                }
                // Gắn vào Namespace tập trung thay vì window trần
                window.AppChartData[mod.namespaceKey] = mergedResult;
        }
    });

    console.info("Đã hợp nhất toàn bộ hệ thống biểu đồ vào window.AppChartData");

    ganMotLan();          /* gắn trình nghe — chỉ chạy đúng một lần trong đời trang */
    DieuPhoi.duLieuMoi(); /* thay cho vòng vẽ háo hức 20 biểu đồ */
}

/* =============================================================================
 * BỘ ĐIỀU PHỐI BIỂU ĐỒ
 * -----------------------------------------------------------------------------
 * Thay cho BỐN cơ chế cũ cùng đi trả lời một câu hỏi "biểu đồ nào đang hiện?":
 * vòng vẽ háo hức, IntersectionObserver, cờ gắn-một-lần, và offsetParent trong
 * vòng nhấp nháy.
 *
 * Chỉ cần một nguồn duy nhất, vì showSubContent() ẩn TẤT CẢ .chart-group rồi
 * hiện đúng MỘT khối — trạng thái đó là xác định và đồng bộ, không phải đoán.
 *
 * BA CỬA VÀO, và chỉ ba:
 *   moKhoi(id)     <- main.js gọi khi người dùng mở một khối
 *   duLieuMoi()    <- cuối processAllModulesData(), khi dữ liệu đổi
 *   canvasDangMo() <- chart_core.js hỏi để biết nhấp nháy cái nào
 * ===========================================================================*/

/* Bảng tra DUY NHẤT. Trước đây danh sách này nằm ở 3 nơi và đã lệch nhau:
   vòng háo hức ghi 'QTH' trong khi chartConfigs chỉ có QTHTK3/QTHTK4, nên hai
   biểu đồ quặng trung hoà chưa từng được vòng đó vẽ. */
const KHOI_BIEU_DO = {
    'tieu-hao-than':              ['nhietri', 'ccd'],
    'tieu-hao-tro-dung':          ['lime', 'dolomite'],
    'tieu-hao-dien':              ['dien'],
    'tieu-hao-quang':             ['feOre'],
    'tieu-hao-khi-than':          ['CO'],
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
    khoiDangMo: null,    /* id khối .chart-group đang hiện */
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
               dùng đang chọn; dùng nhầm clearUniversalFilter ở đây sẽ giật mất
               khoảng ngày họ vừa đặt. */
            if (chuaVe) clearUniversalFilter(loai);
            else        applyUniversalFilter(loai);
        });

        this.daVe.add(id);
        this.khoiCu.delete(id);
    },

    /* Người dùng mở một khối. Gọi ĐỒNG BỘ ngay sau display:flex. */
    moKhoi: function (idKhoi) {
        this.khoiDangMo = KHOI_BIEU_DO[idKhoi] ? idKhoi : null;
        this.veKhoiDangMo();
        if (typeof chinhNhipNhay === 'function') chinhNhipNhay();
    },

    /* Dữ liệu mới về. Đánh dấu mọi khối là cũ, nhưng CHỈ vẽ lại khối đang mở;
       khối đang ẩn chờ tới lúc được mở. Đây là chỗ mà bản sửa cũ thiếu, khiến
       biểu đồ đóng băng ở dữ liệu bản nhớ sau lần xem đầu. */
    duLieuMoi: function () {
        const self = this;
        this.daVe.forEach(function (id) { self.khoiCu.add(id); });
        this.veKhoiDangMo();
        if (typeof chinhNhipNhay === 'function') chinhNhipNhay();
    },

    /* chart_core.js hỏi: canvas nào đang nằm trong khối đang mở? */
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
   khi mở trang (bản nhớ, TK3 mới, TK4 mới); gắn trong đó sẽ chồng 3 listener,
   khiến mỗi lần đổi ngày biểu đồ vẽ lại 3 lượt. */
let daGanMotLan = false;
function ganMotLan() {
    if (daGanMotLan) return;
    daGanMotLan = true;

    const startCoHat = document.getElementById('start-CoHatThan');
    if (startCoHat) {
        startCoHat.addEventListener('change', function () {
            syncShiftDropdown();
            applyUniversalFilter('CoHatThan');
        });
    }
    syncShiftDropdown();   /* mồi chạy lần đầu */
}

/* HỆ THỐNG LỌC XÀI CHUNG CHO TOÀN BỘ CÁC BIỂU ĐỒ */
const chartConfigs = {
    'nhietri': {
        dataSource: () => window.AppChartData.CoalNhietri, // Dùng arrow function để luôn lấy data mới nhất
        keyTK3: 'nhietriTK3',
        keyTK4: 'nhietriTK4',
        canvasId: 'coal-chart-nhietri',
        filterSuffix: '-nhietri', // Luôn để đuôi id bên kia là (start,end,sinterline) + phần ký tự này
        draw: (f, canvasId, lineFilter) => drawCoalConsumeChart(canvasId, f.labels, f.nhietriTK3, f.nhietriTK4, f.trungbinh, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'ccd': {
        dataSource: () => window.AppChartData.CoalCcd,
        keyTK3: 'CcdTK3',
        keyTK4: 'CcdTK4',
        canvasId: 'coal-chart-ccd',
        filterSuffix: '-ccd', // Luôn để đuôi id bên kia là (start,end,sinterline) + phần ký tự này
        draw: (f, canvasId, lineFilter) => drawCoalConsumeChart(canvasId, f.labels, f.CcdTK3, f.CcdTK4, f.trungbinh, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'lime': {
        dataSource: () => window.AppChartData.Lime,
        keyTK3: 'limeTK3',
        keyTK4: 'limeTK4',
        canvasId: 'flux-chart-lime',
        filterSuffix: '-lime',
        draw: (f, canvasId, lineFilter) => drawFluxConsumeChart(canvasId, f.labels, f.limeTK3, f.limeTK4, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'dolomite': {
        dataSource: () => window.AppChartData.Dolomite,
        keyTK3: 'dolomiteTK3',
        keyTK4: 'dolomiteTK4',
        canvasId: 'flux-chart-dolomite',
        filterSuffix: '-dolomite',
        draw: (f, canvasId, lineFilter) => drawFluxConsumeChart(canvasId, f.labels, f.dolomiteTK3, f.dolomiteTK4, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'dien' : {
        dataSource: () => window.AppChartData.Electricity,
        keyTK3: 'elecTK3',
        keyTK4: 'elecTK4',
        canvasId: 'electric-chart',
        filterSuffix: '-dien',
        draw: (f, canvasId, lineFilter, elecTypeFilter) => drawElectricConsumeChart(canvasId, f.labels, f.elecTK3, f.elecTK4, f.dinhmuc, f.tichluyTK3, f.tichluyTK4, f.dsxTK3, f.dsxTK4, lineFilter, elecTypeFilter)
    },
    'feOre' : {
        dataSource: () => window.AppChartData.FeOre,
        keyTK3: 'FeOreTK3',
        keyTK4: 'FeOreTK4',
        canvasId: 'feoreconsume-chart',
        filterSuffix: '-feOre',
        draw: (f, canvasId, lineFilter) => drawIronOreConsumeChart(canvasId, f.labels, f.FeOreTK3, f.FeOreTK4, lineFilter)
    },
    'CO'   : {
        dataSource: () => window.AppChartData.CO,
        keyTK3: 'COTK3',
        keyTK4: 'COTK4',
        canvasId: 'COconsume-chart',
        filterSuffix: '-CO',
        draw: (f, canvasId, lineFilter) => drawCOConsumeChart(canvasId, f.labels, f.COTK3, f.COTK4, f.dinhmuc, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'HLC'   : {
        dataSource: () => window.AppChartData.HLC,
        keyTK3: 'HLCTK3',
        keyTK4: 'HLCTK4',
        canvasId: 'returnfinesrateHLC-chart',
        filterSuffix: '-HLC',
        draw: (f, canvasId, lineFilter) => drawReturnFinesRate(canvasId, f.labels, f.HLCTK3, f.HLCTK4, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
    'HN'    : {
        dataSource: () => window.AppChartData.HN,
        keyTK3: 'HNTK3',
        keyTK4: 'HNTK4',
        canvasId: 'returnfinesrateHN-chart',
        filterSuffix: '-HN',
        draw: (f, canvasId, lineFilter) => drawReturnFinesRate(canvasId, f.labels, f.HNTK3, f.HNTK4, f.tichluyTK3, f.tichluyTK4, lineFilter)
    },
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
    'CoHatThanNghien': {
        dataSource: () => window.AppChartData.CoHatThanNghien,
        keyTK3: '<0.5mmTNTK3',
        keyTK4: '<0.5mmTNTK4',
        canvasId: 'coalquality-chart-cohattn',
        filterSuffix: '-CoHatThan',
        defaultDays: 1,
        draw: (f, canvasId, lineFilter) => drawCoalSizeChart(canvasId, f, lineFilter)
    },
    'CoHatThanCoke':  {
        dataSource: () => window.AppChartData.CoHatThanCoke,
        keyTK3: '<0.5mmTCTK3',
        keyTK4: '<0.5mmTCTK4',
        canvasId: 'coalquality-chart-cohatcoke',
        filterSuffix: '-CoHatThan',
        defaultDays: 1,
        draw: (f, canvasId, lineFilter) => drawCoalSizeChart(canvasId, f, lineFilter)
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
            // Truyền 2 cặp dữ liệu: FeO và TFe vào hàm dùng chung
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
        filterSuffix: '-TCVatLyQTK', // Khớp với id input (start-TCVatLyQTK)
        draw: (f, canvasId, lineFilter) => {
            // Truyền 2 cặp dữ liệu: Trống quay và Mài mòn vào hàm dùng chung
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

// 2. HÀM LỌC CHUNG
function applyUniversalFilter(chartType) {
    if (chartType === 'CoHatThan') {
        syncShiftDropdown();
        applyUniversalFilter('CoHatThanNghien');
        applyUniversalFilter('CoHatThanCoke');
        return;
    }
    const config = chartConfigs[chartType];
    const data = config ? config.dataSource() : null;
    
    if (!data) return;

    // Tự động ghép nối ID dựa vào hậu tố cấu hình
    const s_start = `start${config.filterSuffix}`;
    const s_end   = (config.filterSuffix === '-CoHatThan') ? s_start : `end${config.filterSuffix}`;
    const s_shift = `shift${config.filterSuffix}`;
    const s_line  = `sinterline${config.filterSuffix}`;

    const lineFilter = document.getElementById(s_line) ? document.getElementById(s_line).value : 'all';

    const elecTypeFilter = document.getElementById('electype-dien') ? document.getElementById('electype-dien').value : 'all';
    
    // Gọi hàm smartFilter gốc
    const f = smartFilter(data, config.keyTK3, s_start, s_end, s_shift, config.defaultDays || 7);
    // Đây chỉ là vẽ biểu đồ than thôi, nếu vẽ biểu đồ khác, thì khai báo 1 biểu đồ khác đã được cấu hình vẽ bên chart_core.js vào
    // Xài cấu trúc if  tương tự thế này
    if (f && f.labels.length > 0) {
        if (config.draw) {
            config.draw(f, config.canvasId, lineFilter, elecTypeFilter);
        }
    } else {
        console.warn(`Dữ liệu lọc ${chartType} rỗng.`);
    }
}

// 3. HÀM XOÁ LỌC CHUNG
function clearUniversalFilter(chartType) {
    if (chartType === 'CoHatThan') {
        // Chỉ cần xoá 1 ô Chọn ngày
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
    
    // Xoá xong thì kích hoạt vẽ lại
    applyUniversalFilter(chartType);
}

// 4. Hàm đồng bộ lọc cho biểu đồ chất lượng than
function syncShiftDropdown(chartType) {

    const dataTN = window.AppChartData.CoHatThanNghien;
    const dataTC = window.AppChartData.CoHatThanCoke;
    
    const shiftSelect = document.getElementById('shift-CoHatThan');
    const startInput = document.getElementById('start-CoHatThan');

    // Dùng nhãn thời gian của Than Nghiền làm trục gốc
    if (!dataTN || !dataTN.labels || !shiftSelect) return;

    const startTs = (startInput && startInput.value) ? new Date(startInput.value).getTime() : 0;
    const hasDateFilter = !!(startInput && startInput.value);

    let availableShifts = [];

    // ========================================================
    // RADAR ĐA MỤC TIÊU: Quét xem TK3 HOẶC TK4 có chạy không
    // ========================================================
    const checkHasData = (i) => {
        let hasTN3 = dataTN['<0.5mmTNTK3'] && dataTN['<0.5mmTNTK3'][i] > 0;
        let hasTN4 = dataTN['<0.5mmTNTK4'] && dataTN['<0.5mmTNTK4'][i] > 0;
        let hasTC3 = dataTC && dataTC['<0.5mmTCTK3'] && dataTC['<0.5mmTCTK3'][i] > 0;
        let hasTC4 = dataTC && dataTC['<0.5mmTCTK4'] && dataTC['<0.5mmTCTK4'][i] > 0;
        
        // Trả về TRUE nếu bất kỳ một dây chuyền nào có đổ than
        return hasTN3 || hasTN4 || hasTC3 || hasTC4;
    };
    
    if (hasDateFilter) {
        for (let i = 0; i < dataTN.labels.length; i++) {
            const label = dataTN.labels[i];
            const [dPart, sPart] = String(label).split(' - ').map(s => s.trim());
            const ts = new Date(dPart.split('/').reverse().join('-')).getTime();

            // Áp dụng Radar mới vào màng lọc
            if (ts === startTs && checkHasData(i)) {
                if (!availableShifts.includes(sPart)) {
                    availableShifts.push(sPart); 
                }
            }
        }
    } else {
        let targetDate = "";
        for (let i = dataTN.labels.length - 1; i >= 0; i--) {
            // Áp dụng Radar mới vào việc quét ngày mới nhất
            if (checkHasData(i)) {
                targetDate = dataTN.labels[i].split(' - ')[0].trim();
                break;
            }
        }
        for (let i = 0; i < dataTN.labels.length; i++) {
            // Áp dụng Radar vào việc gom kíp
            if (dataTN.labels[i].includes(targetDate) && checkHasData(i)) {
                let shift = dataTN.labels[i].split(' - ')[1].trim();
                if (!availableShifts.includes(shift)) {
                    availableShifts.push(shift);
                }
            }
        }
    }
    
    availableShifts.sort();

    // Rút ruột HTML cũ để dọn dẹp bóng ma
    const currentVal = shiftSelect.value;
    shiftSelect.innerHTML = ''; 

    // Nạp lại các Kíp có thật vào UI
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

    // Ép nhảy Kíp logic
    if (availableShifts.includes(currentVal)) {
        shiftSelect.value = currentVal;
    } else if (availableShifts.length > 0) {
        shiftSelect.value = availableShifts[0];
    } else {
        shiftSelect.value = 'all';
    }
}

/* =============================================================================
 * DẢI CHỈ SỐ TỔNG QUAN TRANG CHỦ — 3 ô: sản lượng, % đạt, hệ số lợi dụng
 * -----------------------------------------------------------------------------
 * Tất cả tính cho THÁNG HIỆN TẠI theo lịch máy: từ ngày 01 tới hôm nay, cộng
 * dồn CẢ HAI dây chuyền TK3 + TK4. Sang tháng mới là tự nhảy, không phải sửa gì.
 *
 * Chạy sau khi cả TK3 và TK4 tải xong (gọi ở cuối processAllModulesData).
 * ===========================================================================*/

const RIBBON_CFG = {
    /* --- Tên cột trong bảng tính. Khai NHIỀU tên cũng được, lấy tên đầu tiên
           tìm thấy, nên đổi tên cột trong sheet vẫn chạy. --- */
    cols: {
        ngay:   ['Thời gian (Sản lượng)'],
        ca:     ['Ca/kíp (Sản lượng)'],
        sanLuong: ['Sản lượng (sản lượng)', 'Sản lượng'],
        keHoach:  ['Sản lượng kế hoạch'],

        /* Giờ máy KHÔNG chạy — công thức trừ CẢ HAI loại:
             gioDung   : dừng đình trệ (sự cố, hỏng hóc)
             gioDungKH : dừng theo kế hoạch (sửa chữa định kỳ, cắt điện…)
           Tên cột của loại thứ hai CHƯA XÁC MINH ĐƯỢC — mấy tên dưới là phỏng
           đoán. Mở F12 -> Console gõ  xemCotSanLuong()  để in tên cột thật rồi
           chép vào đây. Không khớp tên nào thì phần đó tính bằng 0 và Console
           sẽ báo rõ, chứ không âm thầm ra số sai. */
        gioDung:   ['Thời gian dừng', 'Thời gian dừng đình trệ',
                    'Thời gian đình trệ', 'Giờ dừng đình trệ'],
        gioDungKH: ['Thời gian dừng kế hoạch', 'Giờ dừng kế hoạch',
                    'Thời gian dừng KH', 'Dừng kế hoạch'],
    },

    /* --- CÔNG THỨC HỆ SỐ LỢI DỤNG — TÍNH RIÊNG TỪNG DÂY ------------------
     *   hệ số(TK) = sản lượng của DÂY ĐÓ từ ngày 01 tới HÔM NAY (đủ 3 ca)
     *             / [ dienTich x ( gioMoiNgay x soNgay − tổng giờ dừng ) ]
     *
     *   HAI VẾ CÙNG MỘT MỐC THỜI GIAN: tử số, số ngày và giờ dừng đều tính từ
     *   ngày 01 tới hôm nay. Trước đây số ngày lấy trọn tháng còn giờ dừng chỉ
     *   tới hôm nay nên hai vế lệch nhau, hệ số bị kéo thấp xuống.
     *
     *   dienTich   : 360 — diện tích của MỘT máy thiêu kết (m²)
     *   gioMoiNgay : 24
     *   soNgay     : 'daQua'    = số ngày từ 01 tới HÔM NAY  <-- đang dùng
     *                'coSoLieu' = tới ngày CUỐI CÙNG CÓ SẢN LƯỢNG. Dùng khi
     *                             sheet chưa nhập kịp ngày hôm nay, tránh việc
     *                             cộng thêm một ngày trống làm hệ số tụt.
     *                'caThang'  = trọn tháng (cách tính cũ, giữ lại để đối chiếu)
     *   tranHopLe  : 1.5 — trần kỹ thuật t/m²·h, vượt là số liệu có vấn đề
     *   sanHopLe   : 0   — bằng hoặc dưới mức này cũng coi là bất thường
     * ------------------------------------------------------------------- */
    heSo: {
        dienTich: 360,
        gioMoiNgay: 24,
        soNgay: 'daQua',
        tranHopLe: 1.5,
        sanHopLe: 0,
    },

    /* Số chữ số thập phân của từng ô */
    lamTron: { sanLuong: 0, dat: 1, heSo: 3 },
};

/** Tìm tên cột đầu tiên thực sự có trong dữ liệu. */
function ribbonCot(rows, ten) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    return ten.find(function (n) { return keys.indexOf(n) >= 0; }) || null;
}

/** In toàn bộ tên cột của một dây để đối chiếu — gõ trong Console F12.
 *  Đừng tin tên cột đoán mò: chạy hàm này rồi chép tên THẬT vào RIBBON_CFG.cols. */
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

/* =============================================================================
 * KIỂM TRA TÍNH HỢP LỆ CỦA HỆ SỐ LỢI DỤNG
 * -----------------------------------------------------------------------------
 * Trần kỹ thuật của máy thiêu kết là 1,5 t/m²·h. Ra cao hơn thì KHÔNG phải là
 * xưởng chạy giỏi mà là số liệu sai — thường do một trong ba nguyên nhân:
 *      - cộng sản lượng của cả hai dây rồi chia cho diện tích một máy
 *      - thiếu cột giờ dừng nên mẫu số bị to giả (hoặc ngược lại, nhỏ giả)
 *      - đơn vị sản lượng trong sheet không phải tấn
 * Hàm này chặn ở khâu hiển thị: số vẫn hiện để anh soi, nhưng bị đánh dấu đỏ
 * kèm lý do, thay vì lặng lẽ đưa lên bảng như số đúng.
 * ===========================================================================*/
function kiemTraHeSoLoiDung(hs) {
    const H = RIBBON_CFG.heSo;

    if (hs === null || hs === undefined || !isFinite(hs)) {
        return { ok: false, ma: 'thieu',
                 loi: 'Chưa tính được — thiếu sản lượng hoặc mẫu số ≤ 0' };
    }
    if (hs <= H.sanHopLe) {
        return { ok: false, ma: 'am',
                 loi: 'Hệ số ≤ ' + H.sanHopLe + ' — xem lại cột sản lượng và giờ dừng' };
    }
    if (hs > H.tranHopLe) {
        return { ok: false, ma: 'vuot',
                 loi: 'Vượt trần kỹ thuật ' + H.tranHopLe.toLocaleString('vi-VN')
                      + ' t/m²·h — số liệu nhiều khả năng sai, kiểm tra lại '
                      + 'sản lượng, diện tích ' + H.dienTich + ' m² và giờ dừng' };
    }
    return { ok: true, ma: 'dat', loi: '' };
}
window.kiemTraHeSoLoiDung = kiemTraHeSoLoiDung;

/** Quét một dây chuyền, gom số liệu CỦA THÁNG ĐANG XÉT.
 *  Ngày trong bảng tính chỉ ghi ở DÒNG ĐẦU của mỗi ngày (ô gộp), các dòng ca
 *  sau để trống -> phải nhớ ngày gần nhất mà gán tiếp, giống extractChartData.
 *
 *  ngayToiDa CHỈ ÁP CHO GIỜ DỪNG, không đụng tới sản lượng: giờ dừng cộng
 *  tới hết hôm nay, còn sản lượng / kế hoạch / số ca vẫn quét trọn tháng Y NHƯ
 *  BẢN CŨ — các ô Kế hoạch, Sản lượng đã đạt, Tỉ lệ đạt và biểu đồ không
 *  được phép đổi số. */
function ribbonQuet(rows, thang, nam, ngayToiDa) {
    const C = RIBBON_CFG.cols;
    const cNgay = ribbonCot(rows, C.ngay);
    const cCa = ribbonCot(rows, C.ca);
    const cSL = ribbonCot(rows, C.sanLuong);
    const cKH = ribbonCot(rows, C.keHoach);
    const cDung = ribbonCot(rows, C.gioDung);
    const cDungKH = ribbonCot(rows, C.gioDungKH);

    if (!cSL) return null;                       // thiếu cột sản lượng thì chịu

    /* Mỗi cột một kiểu số (TK3 "5,854.00", TK4 "5.930,000") — dò dấu thập phân
       của từng cột một lần để đọc đúng các ô mơ hồ. Xem sheetNumber(). */
    const tpSL = sheetDauThapPhanCot(rows, cSL);
    const tpKH = sheetDauThapPhanCot(rows, cKH);
    const tpDung = sheetDauThapPhanCot(rows, cDung);
    const tpDungKH = sheetDauThapPhanCot(rows, cDungKH);

    let tongSL = 0, tongDung = 0, tongDungKH = 0, keHoach = 0, soCa = 0;
    /* Tử số của hệ số lợi dụng cắt tới hôm nay, tách riêng khỏi tongSL trọn
       tháng để các ô Kế hoạch / Sản lượng đã đạt / Tỉ lệ đạt giữ nguyên số. */
    let tongSLToiNay = 0, ngayCuoiCoSL = 0;
    let ngayHienTai = null;

    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && row[cNgay].toString().trim() !== '') {
            const d = sheetDate(row[cNgay]);
            if (d) ngayHienTai = d;
        }
        if (!ngayHienTai) return;
        if (ngayHienTai.m !== thang || ngayHienTai.y !== nam) return;

        /* Kế hoạch ghi MỘT LẦN ở dòng ngày 01 của MỖI tháng (8/2026: 313.000,
           9/2026: 310.000…), nên phải đọc SAU khi lọc tháng. Bản cũ đọc trước
           bộ lọc, lấy ô kế hoạch đầu tiên của cả sheet -> tháng 9 vẫn hiện số
           của tháng 8 (313k x 2 = 626k). Đọc trước dòng kiểm tra ca vì dòng
           ngày 01 của tháng chưa chạy có thể chưa điền ca. */
        if (cKH && !keHoach) {
            const kh = sheetNumber(row[cKH], tpKH);
            if (kh) keHoach = kh;
        }

        if (cCa && !row[cCa]) return;            // dòng không phải một ca

        const sl = sheetNumber(row[cSL], tpSL);
        if (sl !== null) { tongSL += sl; soCa += 1; }

        /* TỪ ĐÂY TRỞ XUỐNG chỉ phục vụ hệ số lợi dụng. Ngày chưa tới thì dừng
           ở đây — giờ dừng điền sẵn cho cuối tháng mà cộng vào từ giữa tháng
           thì mẫu số tụt, hệ số vọt lên sai. */
        if (ngayToiDa && ngayHienTai.d > ngayToiDa) return;

        if (sl !== null) {
            tongSLToiNay += sl;
            if (ngayHienTai.d > ngayCuoiCoSL) ngayCuoiCoSL = ngayHienTai.d;
        }

        if (cDung) {
            const gd = sheetNumber(row[cDung], tpDung);
            if (gd !== null) tongDung += gd;
        }
        if (cDungKH) {
            const gk = sheetNumber(row[cDungKH], tpDungKH);
            if (gk !== null) tongDungKH += gk;
        }
    });

    return { tongSL: tongSL, tongSLToiNay: tongSLToiNay,
             tongDung: tongDung, tongDungKH: tongDungKH,
             ngayCuoiCoSL: ngayCuoiCoSL,
             keHoach: keHoach, soCa: soCa,
             thieuCot: { ngay: !cNgay, keHoach: !cKH,
                         dung: !cDung, dungKH: !cDungKH } };
}

/* =============================================================================
 * HỆ SỐ LỢI DỤNG CỦA MỘT DÂY
 * -----------------------------------------------------------------------------
 * Ví dụ tháng 8, hôm nay 26/8:
 *
 *      sản lượng dây đó, cộng đủ 3 ca, từ 1/8 tới 26/8
 *   ----------------------------------------------------------------
 *      360 x ( 24 x 26 ngày − tổng giờ dừng cả 3 ca từ 1/8 tới 26/8 )
 *
 * BA CHỖ CẦN NHỚ:
 *   1. 360 m² là diện tích của MỘT máy thiêu kết -> tử số cũng phải là sản
 *      lượng của MỘT máy. Gộp TK3 + TK4 rồi chia 360 là ra 2,135, cao gần gấp
 *      đôi trần kỹ thuật 1,5 — đó là lỗi của bản đầu.
 *   2. Cả ba vế (sản lượng, số ngày, giờ dừng) cùng chốt ở HÔM NAY. Lấy số
 *      ngày trọn tháng mà sản lượng chỉ tới hôm nay thì mẫu số phình ra, hệ số
 *      tụt xuống rồi bò lên dần tới cuối tháng.
 *   3. Giờ dừng gộp CẢ đình trệ lẫn dừng kế hoạch — sheet hiện chỉ có một cột
 *      "Thời gian dừng" nên phần dừng kế hoạch bằng 0, có thêm cột thì tự cộng.
 * ===========================================================================*/
/** Giờ dừng cộng dồn hay ra số lẻ dài kiểu 0.5199999999999995 — cắt còn 2 số
 *  lẻ cho dòng chú thích khỏi rối, phép tính vẫn dùng số gốc. */
function hsGio(v) {
    return (Math.round((v || 0) * 100) / 100).toLocaleString('vi-VN', {
        maximumFractionDigits: 2 });
}

function heSoMotDay(dat, thang, nam) {
    const H = RIBBON_CFG.heSo;
    const homNay = new Date().getDate();

    let soNgay;
    if (H.soNgay === 'caThang') {
        soNgay = soNgayTrongThang(thang, nam);
    } else if (H.soNgay === 'coSoLieu') {
        soNgay = (dat && dat.ngayCuoiCoSL) ? dat.ngayCuoiCoSL : homNay;
    } else {
        soNgay = homNay;                     // 'daQua' — mặc định
    }

    if (!dat) {
        return { heSo: null, tongSL: 0, soNgay: soNgay, gioDung: 0,
                 gioChay: 0, mauSo: 0, moTaMauSo: 'Không có dữ liệu dây này' };
    }

    /* Tổng giờ dừng = đình trệ + dừng kế hoạch, cộng đủ 3 ca từ ngày 01 */
    const gioDung = (dat.tongDung || 0) + (dat.tongDungKH || 0);
    const gioChay = H.gioMoiNgay * soNgay - gioDung;
    const mauSo = H.dienTich * gioChay;

    return {
        heSo: mauSo > 0 ? dat.tongSLToiNay / mauSo : null,
        tongSL: dat.tongSLToiNay,
        soNgay: soNgay, gioDung: gioDung, gioChay: gioChay, mauSo: mauSo,
        moTaMauSo: Math.round(dat.tongSLToiNay).toLocaleString('vi-VN') + ' tấn ÷ ['
            + H.dienTich + ' × (' + H.gioMoiNgay + ' × ' + soNgay + ' ngày − '
            + hsGio(gioDung) + 'h dừng) = ' + Math.round(mauSo).toLocaleString('vi-VN') + ']',
    };
}

/** Tính toàn bộ chỉ số của tháng hiện tại. */
function ribbonTinh() {
    const now = new Date();
    const thang = now.getMonth() + 1;
    const nam = now.getFullYear();
    const ngayChot = now.getDate();          // cộng tới hết hôm nay

    const a = ribbonQuet(window.masterSheetDataTK3, thang, nam, ngayChot);
    const b = ribbonQuet(window.masterSheetDataTK4, thang, nam, ngayChot);
    if (!a && !b) return null;

    const tongSL = (a ? a.tongSL : 0) + (b ? b.tongSL : 0);
    const tongKH = (a ? a.keHoach : 0) + (b ? b.keHoach : 0);
    const mau = a || b;

    return {
        thang: thang, nam: nam, ngayChot: ngayChot,
        soNgay: heSoMotDay(a || b, thang, nam).soNgay,
        ngayCuoiCoSL: Math.max(a ? a.ngayCuoiCoSL : 0, b ? b.ngayCuoiCoSL : 0),
        tongSL: tongSL,
        tongKH: tongKH,
        dat: tongKH > 0 ? (tongSL / tongKH) * 100 : null,

        /* Hệ số lợi dụng TÍNH RIÊNG từng dây */
        tk3: heSoMotDay(a, thang, nam),
        tk4: heSoMotDay(b, thang, nam),

        soCa: (a ? a.soCa : 0) + (b ? b.soCa : 0),
        thieuCot: {
            ngay: mau.thieuCot.ngay,
            keHoach: mau.thieuCot.keHoach,
            dung: (!a || a.thieuCot.dung) && (!b || b.thieuCot.dung),
            dungKH: (!a || a.thieuCot.dungKH) && (!b || b.thieuCot.dungKH),
        },
    };
}

/** Ghi số vào một ô, GIỮ NGUYÊN thẻ <span> đơn vị đứng sau. */
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

/** Đổ số ra dải chỉ số. */
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

    /* Đổi tiêu đề ô đầu cho đúng nghĩa và ghi rõ đang là tháng nào —
       khỏi phải sửa index.html mỗi tháng. */
    const h = document.querySelector('#tong-san-luong');
    const box = h && h.closest ? h.closest('.stat-box') : null;
    const tieuDe = box ? box.querySelector('h3') : null;
    if (tieuDe) tieuDe.textContent = 'TỔNG SẢN LƯỢNG THÁNG ' + kq.thang + '/' + kq.nam;

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
 *  nhau. Đơn vị chuyển lên tiêu đề cho khỏi lặp hai lần. */
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

/* =============================================================================
 * MỤC "SẢN LƯỢNG" (#san-luong-theo-thang) — 4 thẻ chỉ số tháng này
 * -----------------------------------------------------------------------------
 * Dùng LẠI ribbonTinh() nên số liệu luôn khớp với dải chỉ số trang chủ: cùng
 * cột, cùng cách cộng từ ngày 01 tới hôm nay, cùng gộp TK3 + TK4.
 *
 * Thẻ HỆ SỐ LỢI DỤNG do JS tự dựng thêm (index.html chưa có) — hiện là KHUNG
 * TRỐNG chờ anh đưa nội dung vào, xem RIBBON_CFG.heSo để chỉnh công thức.
 * ===========================================================================*/

/** Ghi một ô chỉ số, giữ hậu tố (ví dụ dấu %) nếu có. */
function kpiGhi(id, chuoi) {
    const el = document.getElementById(id);
    if (el) el.textContent = chuoi;
}

const kpiSo = function (v, le) {
    return (v === null || !isFinite(v)) ? '--'
        : v.toLocaleString('vi-VN', { minimumFractionDigits: le, maximumFractionDigits: le });
};

/** Dựng khung một thẻ hệ số lợi dụng. Có rồi thì thôi, gọi lại không đẻ thêm. */
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

/** Đổ số vào một thẻ hệ số lợi dụng, kèm dòng giải thích mẫu số hoặc báo lỗi. */
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

function kpiVe() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec) return;

    /* --- SỬA CẤU TRÚC: index.html để 2 trong 3 thẻ NẰM NGOÀI lưới nên hàng bị
       vỡ, thẻ tràn hết bề ngang. Gom hết vào lưới cho ngay ngắn.
       (Sửa gốc trong index.html cũng được, xem phần trả lời.) --- */
    const grid = sec.querySelector('.kpi-grid');
    if (grid) {
        sec.querySelectorAll(':scope > .kpi-card').forEach(function (c) { grid.appendChild(c); });
    }

    /* --- Thẻ HỆ SỐ LỢI DỤNG: TÁCH RIÊNG TK3 VÀ TK4 ---
       Bản cũ gộp một thẻ: lấy sản lượng của CẢ HAI dây chia cho diện tích của
       MỘT máy (360 m²) nên con số phình lên gần gấp đôi — 2,135 t/m²·h trong
       khi trần kỹ thuật chỉ 1,5. Dọn thẻ cũ rồi dựng hai thẻ mới. */
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

    /* Thanh tiến độ: chặn 0..100 để không tràn khung khi vượt kế hoạch */
    const bar = document.getElementById('kpi-progress-bar');
    if (bar) {
        const pct = kq.dat === null ? 0 : Math.max(0, Math.min(100, kq.dat));
        bar.style.width = pct.toFixed(1) + '%';
        bar.classList.toggle('is-vuot', kq.dat !== null && kq.dat >= 100);
    }

    /* Dòng nhận xét: so sản lượng thực tế với TIẾN ĐỘ ĐÁNG LẼ phải đạt tới hôm
       nay, chứ không so với kế hoạch cả tháng — giữa tháng mới có ý nghĩa. */
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

    /* --- Hệ số lợi dụng: mỗi dây một thẻ, kèm kết quả kiểm tra hợp lệ --- */
    kpiVeMotHeSo('tk3', kq.tk3);
    kpiVeMotHeSo('tk4', kq.tk4);
}

/* =============================================================================
 * BIỂU ĐỒ SẢN LƯỢNG THÁNG NÀY (đặt dưới 4 thẻ chỉ số của mục SẢN LƯỢNG)
 * -----------------------------------------------------------------------------
 *   - CỘT   : sản lượng TỪNG NGÀY của TK3 và TK4 (cộng 3 ca trong ngày)
 *   - ĐƯỜNG : luỹ kế cả xưởng, cộng dồn từ ngày 01 tới hôm nay
 *   - ĐƯỜNG ĐỎ: mục tiêu (sản lượng kế hoạch tháng của cả 2 dây)
 *
 * HAI TRỤC là bắt buộc: cột mỗi ngày ~18 nghìn tấn, còn luỹ kế lên tới hơn 600
 * nghìn — để chung một trục thì mấy cột bẹp dí thành một vạch sát đáy.
 *   trục TRÁI  : sản lượng ngày (cột)
 *   trục PHẢI  : luỹ kế + mục tiêu (đường)
 *
 * Không có bộ chọn ngày: luôn hiển thị trọn tháng hiện tại.
 * ===========================================================================*/

/** Gom sản lượng THEO NGÀY của một dây chuyền, trong tháng đang xét. */
function slTheoNgay(rows, thang, nam) {
    const C = RIBBON_CFG.cols;
    const cNgay = ribbonCot(rows, C.ngay);
    const cCa = ribbonCot(rows, C.ca);
    const cSL = ribbonCot(rows, C.sanLuong);
    const map = {};
    if (!cSL) return map;
    const tpSL = sheetDauThapPhanCot(rows, cSL);

    let ngay = null;
    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && row[cNgay].toString().trim() !== '') {
            const d = sheetDate(row[cNgay]);
            if (d) ngay = d;
        }
        if (!ngay || ngay.m !== thang || ngay.y !== nam) return;
        if (cCa && !row[cCa]) return;
        const v = sheetNumber(row[cSL], tpSL);
        if (v === null) return;
        map[ngay.d] = (map[ngay.d] || 0) + v;
    });
    return map;
}

let slChartInstance = null;

function veBieuDoSanLuong() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec || typeof Chart === 'undefined') return;

    /* Tạo sẵn khung vẽ nếu index.html chưa có — khỏi phải sửa HTML */
    let box = document.getElementById('sanluong-chart-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'sanluong-chart-box';
        box.className = 'chart-container sanluong-chart';
        box.innerHTML = '<h3 class="sanluong-chart__title"></h3>'
            + '<div class="sanluong-chart__canvas"><canvas id="sanluong-chart"></canvas></div>';
        sec.appendChild(box);
    }

    const now = new Date();
    const thang = now.getMonth() + 1, nam = now.getFullYear();
    const soNgay = soNgayTrongThang(thang, nam);

    const m3 = slTheoNgay(window.masterSheetDataTK3, thang, nam);
    const m4 = slTheoNgay(window.masterSheetDataTK4, thang, nam);

    /* TRỤC NGÀY: luôn từ NGÀY 01 tới HÔM NAY của tháng hiện tại.
       Không lấy "ngày cuối có số liệu" nữa: sang tháng mới, ngày 01/09 chỉ hiện
       đúng một cột 1/9, không dính gì của tháng 8. Ngày nào chưa có số thì để
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
    if (!coSo) return;                      // cả tháng chưa có số nào

    const kq = ribbonTinh();
    const mucTieu = kq && kq.tongKH ? kq.tongKH : null;

    const tieuDe = box.querySelector('.sanluong-chart__title');
    if (tieuDe) tieuDe.textContent = 'SẢN LƯỢNG THÁNG ' + thang + '/' + nam
        + ' — theo ngày và luỹ kế';

    const ds = [
        {
            type: 'line', label: 'Luỹ kế cả xưởng', data: luyKe,
            borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,.10)',
            borderWidth: 3, tension: 0.3, pointRadius: 2, fill: true,
            spanGaps: false,                 /* ngày trống thì ĐỨT, không nối tắt */
            yAxisID: 'y_luyke', order: 1, datalabels: { display: false }
        },
        {
            type: 'bar', label: 'Thiêu kết 3', data: tk3,
            backgroundColor: 'rgba(26,79,214,.85)', yAxisID: 'y_ngay', order: 3,
            datalabels: { display: false }
        },
        {
            type: 'bar', label: 'Thiêu kết 4', data: tk4,
            backgroundColor: 'rgba(243,156,18,.85)', yAxisID: 'y_ngay', order: 4,
            datalabels: { display: false }
        }
    ];

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
