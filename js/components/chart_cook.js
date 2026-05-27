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
/* Nghe sự kiện bên api_loaded để kích hoạt load dữ liệu từ gg sheet, không thay đổi gì */
document.addEventListener('TK3DataReady', () => { appState.isTK3Ready = true; processAllModulesData(); });
document.addEventListener('TK4DataReady', () => { appState.isTK4Ready = true; processAllModulesData(); });

function processAllModulesData() {
    if (!appState.isTK3Ready || !appState.isTK4Ready) return;

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
    setupIntersectionObservers();

    const startCoHat = document.getElementById('start-CoHatThan');
    if (startCoHat) {
        startCoHat.addEventListener('change', () => {
            syncShiftDropdown();
            applyUniversalFilter('CoHatThan'); // Tự xoay biểu đồ ngay và luôn
        });
    }
    syncShiftDropdown(); // Mồi chạy lần đầu tiên khi vừa load web xong
    // ========================================================

    ['nhietri', 'ccd', 'lime', 'dolomite', 'dien', 'feOre', 'CO', 'HLC', 'HN', 'QTH', 'CLHLC', 'CoHatThanNghien', 'CoHatThanCoke', 'ChatLuongThan', 'ChemicalQTK', 'PhysicalQTK', 
    'CoHatQTK', 'DoKiemQTK', 'burntLime', 'burntDolomite'].forEach(type => {
        applyUniversalFilter(type);
    });
}

function setupIntersectionObservers() {
    const observerTargets = [
        { id: 'tieu-hao-than',              types: ['nhietri', 'ccd'] },
        { id: 'tieu-hao-tro-dung',          types: ['lime','dolomite'] },
        { id: 'tieu-hao-dien',              types: ['dien'] },
        { id: 'tieu-hao-quang',             types: ['feOre'] },
        { id: 'tieu-hao-khi-than',          types: ['CO'] },
        { id: 'ti-le-quang-hoi',            types: ['HLC','HN'] },
        { id: 'chat-luong-quang-trung-hoa', types: ['QTHTK3', 'QTHTK4'] },
        { id: 'chat-luong-quang-hoi',       types: ['CLHLC'] },
        { id: 'chat-luong-than',            types: ['CoHatThanNghien', 'CoHatThanCoke', 'ChatLuongThan'] },
        { id: 'chat-luong-quang-thieu-ket', types: ['ChemicalQTK','PhysicalQTK'] },
        { id: 'co-hat-quang-thieu-ket',     types: ['CoHatQTK'] },
        { id: 'do-kiem',                    types: ['DoKiemQTK'] },
        { id: 'chat-luong-voi-nung',        types: ['burntLime'] },
        { id: 'chat-luong-dolomite-nung',   types: ['burntDolomite']}
    ];
    observerTargets.forEach(target => {
        const container = document.getElementById(target.id);
        if (!container) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                target.types.forEach(type => clearUniversalFilter(type));
                observer.disconnect();
            }
        });
        observer.observe(container);
    });
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
