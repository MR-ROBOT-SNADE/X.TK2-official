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
    }
];

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

                mergedResult[mod.mapping.accTK3.key] = tk3Data[mod.mapping.accTK3.sheetCol];
                mergedResult[mod.mapping.accTK4.key] = tk4Data[mod.mapping.accTK4.sheetCol];

                if (mod.mapping.dsxTK3) {
                mergedResult[mod.mapping.dsxTK3.key] = tk3Data[mod.mapping.dsxTK3.sheetCol];
                mergedResult[mod.mapping.dsxTK4.key] = tk4Data[mod.mapping.dsxTK4.sheetCol];
                }    
                // Gắn vào Namespace tập trung thay vì window trần
                window.AppChartData[mod.namespaceKey] = mergedResult;
        }
    });

    console.info("Đã hợp nhất toàn bộ hệ thống biểu đồ vào window.AppChartData");
    setupIntersectionObservers();
}

function setupIntersectionObservers() {
    // Observer cho than
    const coalContainer = document.getElementById('tieu-hao-than');
    if (coalContainer) {
        const obsCoal = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                clearUniversalFilter('nhietri');
                clearUniversalFilter('ccd');
                obsCoal.disconnect();
            }
        });
        obsCoal.observe(coalContainer);
    }
    // Observer cho trợ dung
    const fluxContainer = document.getElementById('tieu-hao-tro-dung');
    if (fluxContainer) {
        const obsFlux = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                clearUniversalFilter('lime');
                clearUniversalFilter('dolomite');
                obsFlux.disconnect();
            }
        });
        obsFlux.observe(fluxContainer);
    }
    // Observer cho điện
    const electricContainer = document.getElementById('tieu-hao-dien');
    if (electricContainer) {
        const obselectric = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                clearUniversalFilter('dien');
                obselectric.disconnect();
            }
        });
        obselectric.observe(electricContainer);
    }
}


/* HỆ THỐNG LỌC XÀI CHUNG CHO TOÀN BỘ CÁC BIỂU ĐỒ */
const chartConfigs = {
    'nhietri': {
        dataSource: () => window.AppChartData.CoalNhietri, // Dùng arrow function để luôn lấy data mới nhất
        keyTK3: 'nhietriTK3',
        keyTK4: 'nhietriTK4',
        canvasId: 'coal-chart-nhietri',
        filterSuffix: '-nhietri' // Luôn để đuôi id bên kia là (start,end,sinterline) + phần ký tự này
    },
    'ccd': {
        dataSource: () => window.AppChartData.CoalCcd,
        keyTK3: 'CcdTK3',
        keyTK4: 'CcdTK4',
        canvasId: 'coal-chart-ccd',
        filterSuffix: '-ccd' // Luôn để đuôi id bên kia là (start,end,sinterline) + phần ký tự này
    },
    'lime': {
        dataSource: () => window.AppChartData.Lime,
        keyTK3: 'limeTK3',
        keyTK4: 'limeTK4',
        canvasId: 'flux-chart-lime',
        filterSuffix: '-lime'
    },
    'dolomite': {
        dataSource: () => window.AppChartData.Dolomite,
        keyTK3: 'dolomiteTK3',
        keyTK4: 'dolomiteTK4',
        canvasId: 'flux-chart-dolomite',
        filterSuffix: '-dolomite'
    },
    'dien' : {
        dataSource: () => window.AppChartData.Electricity,
        keyTK3: 'elecTK3',
        keyTK4: 'elecTK4',
        canvasId: 'electric-chart',
        filterSuffix: '-dien'
    }
};

// 2. HÀM LỌC CHUNG
function applyUniversalFilter(chartType) {
    const config = chartConfigs[chartType];
    const data = config ? config.dataSource() : null;
    
    if (!data) return;

    // Tự động ghép nối ID dựa vào hậu tố cấu hình
    const s_start = `start${config.filterSuffix}`;
    const s_end   = `end${config.filterSuffix}`;
    const s_shift = `shift${config.filterSuffix}`;
    const s_line  = `sinterline${config.filterSuffix}`;

    const lineFilter = document.getElementById(s_line) ? document.getElementById(s_line).value : 'all';

    const elecTypeFilter = document.getElementById('electype-dien') ? document.getElementById('electype-dien').value : 'all';
    
    // Gọi hàm smartFilter gốc
    const f = smartFilter(data, config.keyTK3, s_start, s_end, s_shift);
    // Đây chỉ là vẽ biểu đồ than thôi, nếu vẽ biểu đồ khác, thì khai báo 1 biểu đồ khác đã được cấu hình vẽ bên chart_core.js vào
    // Xài cấu trúc if  tương tự thế này
    if (f && f.labels.length > 0) {
        if (chartType === 'nhietri' || chartType === 'ccd') {
            drawCoalConsumeChart(
                config.canvasId, 
                f.labels, 
                f[config.keyTK3], 
                f[config.keyTK4],
                f.trungbinh, 
                f.tichluyTK3, 
                f.tichluyTK4, 
                lineFilter,
                elecTypeFilter
            );
        }
        else if (chartType === 'lime' || chartType === 'dolomite') {
            const titlePrimary = chartType === 'lime' ? 'Tiêu hao vôi luỹ kế' : 'Tiêu hao dolomite luỹ kế';
            const titleSecondary = chartType === 'lime' ? 'Tiêu hao vôi ngày' : 'Tiêu hao dolomite ngày';
            drawFluxConsumeChart(
                config.canvasId, 
                f.labels, 
                f[config.keyTK3], 
                f[config.keyTK4],
                f.tichluyTK3, 
                f.tichluyTK4, 
                lineFilter, 
                titlePrimary, 
                titleSecondary
            );
        }
        else if (chartType == 'dien') {
            drawElectricConsumeChart(
                config.canvasId,
                f.labels,
                f[config.keyTK3],
                f[config.keyTK4],
                f.dinhmuc,
                f.tichluyTK3,
                f.tichluyTK4,
                f.dsxTK3,
                f.dsxTK4,
                lineFilter,
                elecTypeFilter
            )
        }
    } else {
        console.warn(`Dữ liệu lọc ${chartType} rỗng.`);
    }
}

// 3. HÀM XOÁ LỌC CHUNG
function clearUniversalFilter(chartType) {
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
    if (lineEl) lineEl.value = "all";

    const dsxE1 = document.getElementById(`electype${suffix}`);
    if (dsxE1) dsxE1.value = "all";
    
    // Xoá xong thì kích hoạt vẽ lại
    applyUniversalFilter(chartType);
}