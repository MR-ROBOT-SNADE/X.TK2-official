/* =============================================================================
 * js/components/Charts/render/quality_charts.js — CÁC HÀM VẼ BIỂU ĐỒ CHẤT LƯỢNG
 * =============================================================================
 * Phần 6/7 của bộ đồ nghề vẽ biểu đồ (thư mục render/, trước 24/10/2026 là
 * chart_core.js) — đọc render/setup.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 *   quặng trung hoà (QTH), hồi liệu cao (HLC), cỡ hạt than, chất lượng than,
 *   quặng thiêu kết (QTK). Cùng quy ước với consumption_charts.js: mỗi hàm nhận canvasId,
 *   mảng nhãn và các mảng số (cùng độ dài với nhãn), rồi dựng biểu đồ.
 * ===========================================================================*/

/** Chất lượng quặng trung hoà (QTH): theo dõi DAO ĐỘNG %SiO2 và %CaO.
 *    - đường xanh: %SiO2 từng ca;
 *    - "cột nổi" SiO2: mỗi cột chạy từ giá trị ca trước tới ca này, tô màu theo
 *      chiều tăng / giảm (getTrendFlashColor) — nhìn là thấy dao động;
 *    - cột CaO: trục phải, cũng tô theo xu hướng.
 *  Trục SiO2 co sát dải giá trị (±0,2) để thấy rõ dao động nhỏ; trục CaO kéo
 *  cao gấp 4 để cột CaO nằm thấp, không che đường SiO2. */
function drawQTHChart(canvasId, labels, dataSiO2, dataCaO) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const floatingSiO2 = formattingFloatingTrend(dataSiO2);

    let options = getCommonChartOptions('(%) SiO2', '(%) CaO', true);

    if (!options.scales.x) options.scales.x = {};
    options.scales.x.stacked = true;

    // Trục SiO2: co sát dải giá trị
    const minSiO2 = Math.min(...(dataSiO2 && dataSiO2.length > 0 ? dataSiO2 : [0]));
    const maxSiO2 = Math.max(...(dataSiO2 && dataSiO2.length > 0 ? dataSiO2 : [0]));
    options.scales.y_primary.suggestedMin = Math.max(0, minSiO2 - 0.2);
    options.scales.y_primary.suggestedMax = maxSiO2 + 0.2;

    // Trục CaO: kéo cao gấp 4 lần giá trị lớn nhất
    const maxCaO = Math.max(...(dataCaO && dataCaO.length > 0 ? dataCaO : [0]), 1);
    options.scales.y_secondary.suggestedMax = maxCaO * 4;
    options.scales.y_secondary.grid = { drawOnChartArea: false };

    // Nhãn của cột nổi [trước, nay]: chỉ ghi giá trị "nay"
    if (!options.plugins) options.plugins = {};
    if (!options.plugins.datalabels) options.plugins.datalabels = {};
    options.plugins.datalabels.formatter = function(value) {
        if (Array.isArray(value)) {
            return value[1];
        }
        return value;
    };

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line',
                    label: 'Đường dao động SiO2',
                    data: dataSiO2,
                    yAxisID: 'y_primary',
                    borderColor: '#0511fc',
                    backgroundColor: '#0511fc',
                    borderWidth: 2,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    order: 0,
                    datalabels: {
                        display: false
                    }
                },
                {
                    label: '(%) SiO2',
                    data: floatingSiO2,
                    yAxisID: 'y_primary',
                    backgroundColor: (ctx) => getTrendFlashColor(ctx),
                    borderColor: (ctx) => getTrendFlashColor(ctx),
                    borderWidth: 1,
                    borderRadius: 2,
                    borderSkipped: false,
                    categoryPercentage: 1.0,
                    barPercentage: 0.95,
                    order: 1
                },
                {
                    label: '(%) CaO',
                    data: dataCaO,
                    yAxisID: 'y_secondary',
                    backgroundColor: (ctx) => getTrendFlashColor(ctx),
                    categoryPercentage: 1.0,
                    barPercentage: 0.95,
                    order: 2
                }
            ]
        },
        options: options
    });
}

/** Chất lượng quặng hồi lò cao (HLC): đường %SiO2 của từng dây. */
function drawQHLCChart(canvasId, labels, dataSiO2TK3, dataSiO2TK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: '%SiO2 HLC Thiêu kết 3', data: dataSiO2TK3 || [],
                    borderColor: getCSS('--success-green'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: '%SiO2 HLC Thiêu kết 4', data: dataSiO2TK4 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK4
                }
            ]
        },
        options: getCommonChartOptions('(%)')
    });
}

/* Các mốc cỡ hạt than theo phiếu BK, đúng thứ tự BK ghi. khoa = phần đầu khoá
   trong bộ số liệu CoHatThan (controller/module_configs.js): cột sheet tên "< 0,5mm" / "0,5-3mm"
   / ">3mm" thật ra chứa số <1 / 1-3 / >3mm (js/nap/mau_nap.js, coHatThan). */
const MOC_CO_HAT_THAN = [
    { nhan: '0,5 - 1mm', khoa: '0.5-1mm' },
    { nhan: '< 1mm',     khoa: '<0.5mm' },
    { nhan: '1 - 3mm',   khoa: '0.5-3mm' },
    { nhan: '> 3mm',     khoa: '>3mm' },
];

/** Cỡ hạt than: biểu đồ CỘT, mỗi mốc cỡ hạt một nhóm cột, mỗi dây một màu.
 *  Chỉ lấy số của ca CUỐI CÙNG trong dữ liệu đã lọc (f).
 *  loai 'TN' = than nghiền, 'TC' = than coke (khoá trong f dạng '<0.5mmTNTK3').
 *  Phiếu BK ghi 3 số -> 3 mốc < 1 / 1 - 3 / > 3mm; ghi 4 số -> thêm mốc 0,5 - 1mm
 *  đứng đầu (hiện khi dây đang xem có số 0,5-1 ở ca đó).
 *  Không dùng biểu đồ tròn: số 0,5-1 nằm TRONG số <1, bốn số cộng lại ~130-160%,
 *  hình tròn sẽ chia sai tỷ lệ. */
function drawCoalSizeChart(canvasId, f, lineFilter = 'all', loai = 'TN') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const cuoi = f.labels?.length ? f.labels.length - 1 : -1;
    const so = (key) => {
        const v = cuoi >= 0 && f[key] ? f[key][cuoi] : null;
        return v === null || v === undefined || isNaN(v) ? null : Number(v);
    };
    const latestLabel = cuoi >= 0 ? f.labels[cuoi] : 'Không có dữ liệu';

    const cacDay = [
        { dc: 'TK3', ten: 'Thiêu kết 3', mau: getCSS('--primary-blue') || '#0033a1' },
        { dc: 'TK4', ten: 'Thiêu kết 4', mau: getCSS('--secondary-blue') || '#3498db' },
    ].filter(d => lineFilter === 'all' || lineFilter === d.dc);

    const co05 = cacDay.some(d => so('0.5-1mm' + loai + d.dc) !== null);
    const moc = co05 ? MOC_CO_HAT_THAN : MOC_CO_HAT_THAN.slice(1);

    const datasets = cacDay.map(d => ({
        type: 'bar',
        label: d.ten,
        data: moc.map(m => so(m.khoa + loai + d.dc)),
        backgroundColor: d.mau,
        borderRadius: 4,
    }));
    const coSo = datasets.some(ds => ds.data.some(v => v !== null));

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: moc.map(m => m.nhan),
            datasets: datasets
        },
        options: getCoHatChartOptions((coSo ? 'Dữ liệu chi tiết: ' : 'Không có số cỡ hạt: ') + latestLabel)
    });
}

/** Chất lượng than: 8 đường = 4 chỉ tiêu (AK, V của than nghiền và than coke) x
 *  2 dây. TK3 điểm tròn, TK4 điểm vuông. */
function drawCoalQualityChart(canvasId, labels, dataAKTNTK3, dataVTNTK3, dataAKTNTK4, dataVTNTK4, dataAKTCTK3, dataVTCTK3, dataAKTCTK4, dataVTCTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return ;

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const dataMap = {
        'TK3': {
            'AK Than nghiền': dataAKTNTK3,
            'V Than nghiền': dataVTNTK3,
            'AK Than coke': dataAKTCTK3,
            'V Than coke': dataVTCTK3
        },
        'TK4': {
            'AK Than nghiền': dataAKTNTK4,
            'V Than nghiền': dataVTNTK4,
            'AK Than coke': dataAKTCTK4,
            'V Than coke': dataVTCTK4
        }
    };

    const baseMetric = [
        { id: 'AK Than nghiền', color: '#36A2EB' },
        { id: 'V Than nghiền', color: '#36A2EB' },
        { id: 'AK Than coke', color: '#FFCE56' },
        { id: 'V Than coke', color: '#FFCE56' }
    ];

    const targetTKs = ['TK3', 'TK4'];

    const ChartDatasets = targetTKs.flatMap(tk => {
        return baseMetric.map(metric => {
            const isTK4 = tk === 'TK4';

            const isHidden = lineFilter !== 'all' && lineFilter !== tk;

            return {
                type: 'line',
                label: `${metric.id} - ${tk}`,
                data: dataMap[tk][metric.id] || [],
                borderColor: metric.color,
                backgroundColor: '#ffffff',
                borderWidth: 2,
                pointStyle: isTK4 ? 'rect' : 'circle',
                radius: 4,
                tension: 0.3,
                fill: false,
                yAxisID: 'y_primary',
                order: isTK4 ? 2 : 1,
                hidden: isHidden
            };
        });
    });

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: ChartDatasets
        },
        options: getCommonChartOptions('Chất lượng than (%)')
    });
}

/** Chất lượng quặng thiêu kết (QTK) — một hàm cho NHIỀU biểu đồ đường.
 *
 *  Tham số sau labels là các CỤM 4 phần tử, cụm nào cũng dạng:
 *      dataTK3, dataTK4, tên chỉ tiêu, màu
 *  và có thể kết thúc bằng lineFilter ('all' | 'TK3' | 'TK4'). Ví dụ:
 *      drawQTKQualityChart('x-chart', nhan, feoTK3, feoTK4, 'FeO', '#e74c3c',
 *                                            tTK3, tTK4, 'Trống quay', '#3498db', 'all')
 *  Riêng biểu đồ độ kiềm ('basicility-chart'): từ cụm thứ 2 trở đi là đường
 *  định mức trên / dưới -> vẽ mảnh, không chấm, không nhãn. */
function drawQTKQualityChart(canvasId, labels, ...args) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // lineFilter (nếu có) là tham số CUỐI CÙNG -> tách ra trước
    let lineFilter = 'all';
    if (args.length > 0 && typeof args[args.length - 1] === 'string' && ['all', 'TK3', 'TK4'].includes(args[args.length - 1])) {
        lineFilter = args.pop();
    }

    // Gom các tham số còn lại thành cụm 4: (dataTK3, dataTK4, tên, màu)
    const baseMetrics = [];
    for (let i = 0; i < args.length; i += 4) {
        if (args[i] && args[i + 1]) {
            baseMetrics.push({
                dataTK3: args[i],
                dataTK4: args[i + 1],
                id: args[i + 2],
                color: args[i + 3] || '#000'
            });
        }
    }

    const targetTKs = ['TK3', 'TK4'];

    const ChartDatasets = targetTKs.flatMap(tk => {
        return baseMetrics.map((metric, index) => {
            const isTK4 = tk === 'TK4';

            // Ẩn / hiện theo bộ lọc dây chuyền (đồng bộ mọi đường)
            const isHidden = lineFilter !== 'all' && lineFilter !== tk;
            const dataset = isTK4 ? metric.dataTK4 : metric.dataTK3;

            // Kiểu mặc định cho đường số liệu thật
            let borderWidth = 2;
            let pointStyle = isTK4 ? 'rect' : 'circle';
            let pointRadius = 3;
            /* LƯU Ý: nhánh màu "rgb" có lỗi gõ (metric.color.metric.color) — sẽ báo
               lỗi nếu có biểu đồ truyền màu dạng 'rgb(...)'. Hiện mọi chỗ gọi đều
               dùng màu dạng '#...' nên nhánh này chưa bao giờ chạy. */
            let borderColor = isTK4 && metric.color.includes('rgb') ? metric.color.metric.color.replace('rgb', 'rgba').replace(')', ', 0.8)') : metric.color;
            let datalabelsConfig = { display: true };

            // Biểu đồ độ kiềm: cụm thứ 2, 3 là đường giới hạn trên / dưới
            if (index > 0 && canvasId === 'basicility-chart') {
                borderWidth = 1.5;
                pointRadius = 0;     // không chấm -> trông như đường biên giới hạn
                borderColor = isTK4 ? 'rgba(231, 76, 60, 0.3)' : 'rgba(231, 76, 60, 0.5)';
                datalabelsConfig = { display: false };
            }

            return {
                type: 'line',
                label: `${metric.id} - ${tk}`,
                data: dataset || [],
                borderColor: borderColor,
                backgroundColor: '#ffffff',
                borderWidth: borderWidth,
                pointStyle: pointStyle,
                radius: pointRadius,
                tension: 0.3,
                fill: false,
                yAxisID: 'y_primary',
                order: isTK4 ? 2 : 1,
                hidden: isHidden, // ẩn tự động khi lọc chỉ TK3 / chỉ TK4
                datalabels: datalabelsConfig
            };
        });
    });

    const chartTitle = canvasId === 'basicility-chart' ? 'Độ kiềm R2' : '%';

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: ChartDatasets
        },
        options: getCommonChartOptions(chartTitle, null, false)
    });
}
