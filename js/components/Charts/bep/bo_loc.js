/* =============================================================================
 * js/components/Charts/bep/bo_loc.js — BỘ LỌC DÙNG CHUNG CHO MỌI BIỂU ĐỒ
 * =============================================================================
 * Phần 4/8 của "bếp" biểu đồ (thư mục bep/, trước 24/10/2026 là
 * chart_cook.js) — đọc bep/cot_bieu_do.js trước để biết cả thư mục.
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
 *   draw(f, canvasId, lineFilter, elecTypeFilter)  gọi hàm vẽ trong ve/
 *   cacTrang      (tuỳ chọn) BIỂU ĐỒ NHIỀU TRANG — xem lat_trang.js
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
