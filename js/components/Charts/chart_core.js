/* HỆ THỐNG VẼ BIỂU ĐỒ TỪ DỮ LIỆU CẬP NHẬT TỪ GOOGLESHEET API */

Chart.register(ChartDataLabels);
let chartInstances = {}, isFlashing = false;


/* =============================================================================
 * NHẤP NHÁY CẢNH BÁO VƯỢT ĐỊNH MỨC
 * -----------------------------------------------------------------------------
 * Bản cũ: setInterval 500 ms vẽ lại TOÀN BỘ chartInstances, kể cả 19/21 biểu đồ
 * đang bị display:none. Bản này chỉ vẽ lại những biểu đồ vừa ĐANG MỞ vừa THỰC SỰ
 * có cột vượt định mức — bình thường là không có cái nào, và khi đó bộ hẹn giờ
 * không tồn tại chứ không phải "chạy rồi thoát sớm".
 *
 * "Khối nào đang mở" do DieuPhoi trong chart_cook.js nắm giữ (một nguồn duy
 * nhất), nên ở đây không đọc offsetParent — đọc offsetParent trong vòng nhịp là
 * một phép đọc bố cục, đúng thứ đang cần tránh.
 * ===========================================================================*/
const canhBaoVuot = new Set();   // canvasId đang có cột vượt định mức
let idNhipNhay = null;

/** Gọi sau mỗi new Chart() có định mức. cacDay: mảng các mảng giá trị (TK3, TK4). */
function updateTickingList(canvasId, cacDay, dinhMuc) {
    const day = Array.isArray(cacDay) && Array.isArray(cacDay[0]) ? cacDay : [cacDay];
    const vuot = !!dinhMuc && day.some(function (m) {
        return m && m.some(function (v, i) {
            return v != null && dinhMuc[i] != null && Number(v) > Number(dinhMuc[i]);
        });
    });
    if (vuot) canhBaoVuot.add(canvasId); else canhBaoVuot.delete(canvasId);
    chinhNhipNhay();
}

/** Canvas cần nhấp nháy NGAY LÚC NÀY = (đang mở) ∩ (có cảnh báo). */
function canvasCanNhay() {
    if (document.hidden || canhBaoVuot.size === 0) return [];
    /* Chưa có DieuPhoi (thứ tự script đổi, hoặc đang thử lẻ) -> không đoán bừa,
       cứ nhấp nháy mọi biểu đồ có cảnh báo. An toàn hơn là im lặng bỏ sót. */
    const dangMo = (window.DieuPhoi && window.DieuPhoi.canvasDangMo)
        ? window.DieuPhoi.canvasDangMo() : null;
    if (!dangMo) return Array.from(canhBaoVuot);
    return dangMo.filter(function (id) { return canhBaoVuot.has(id); });
}

function chinhNhipNhay() {
    const can = canvasCanNhay().length > 0;
    if (can && !idNhipNhay) {
        idNhipNhay = setInterval(function () {
            const ds = canvasCanNhay();
            if (!ds.length) { chinhNhipNhay(); return; }   // hết việc -> tự tắt
            isFlashing = !isFlashing;
            ds.forEach(function (id) {
                const c = chartInstances[id];
                if (c) c.update('none');
            });
        }, 500);
    } else if (!can && idNhipNhay) {
        clearInterval(idNhipNhay);
        idNhipNhay = null;
    }
}
window.chinhNhipNhay = chinhNhipNhay;

/* Chuyển tab: dừng HẲN bộ hẹn giờ thay vì để nó chạy không mỗi 500 ms. */
document.addEventListener('visibilitychange', chinhNhipNhay);

const getCSS = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const getUI = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

/* Nhấp nháy biểu đồ cột cho các biểu đồ có định mức */
function getFlashColor(ctx, baseColor, avgDataArray) {
    if (ctx.type !== 'data') return baseColor;
    const avg = avgDataArray && avgDataArray[ctx.dataIndex];
    if (avg && ctx.raw > avg) return isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)'
    return baseColor;
}

function formattingFloatingTrend(dataArray) {
    if (!dataArray) return [];
    let floatingData = [];
    let previousValue = dataArray.length > 0 ? dataArray[0] : 0;
    
    for (let i = 0; i < dataArray.length; i++) {
        let CurrentValue = dataArray[i] || 0;
        floatingData.push([previousValue, CurrentValue]);
        previousValue = CurrentValue;
    }
    return floatingData;
}

function getTrendFlashColor(ctx) {
    if (ctx.type !== 'data') return 'rgba(108,177,125,0.8)';

    const currentData = ctx.raw;
    let valCurrent, valPrev;

    if (Array.isArray(currentData)) {
        valPrev = currentData[0];
        valCurrent = currentData[1];
    } else {
        valCurrent = currentData;
        const dataset = ctx.chart.data.datasets[ctx.datasetIndex].data;
        valPrev = ctx.dataIndex > 0 ? dataset[ctx.dataIndex - 1] : valCurrent;
    }

    const diff = valCurrent - valPrev;

    if (diff === 0) return 'rgba(170,170,170,0.8)';

    const isSiO2 = ctx.dataset.label.includes('SiO2');

    if (isSiO2) {
        if (diff > 0) { 
            return (diff > 0.5) 
                ? (isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)') 
                : 'rgba(255,0,0,0.8)';
        } else {
            return (Math.abs(diff) > 0.5) 
                ? (isFlashing ? 'rgba(40,167,69,0.9)' : 'rgba(40,167,69,0.3)') 
                : 'rgba(40,167,69,0.8)';
        }
    } else {
        if (diff > 0) { 
            return (diff > 0.1) 
                ? (isFlashing ? 'rgba(40,167,69,0.9)' : 'rgba(40,167,69,0.3)') 
                : 'rgba(40,167,69,0.8)';
        } else {
            return (Math.abs(diff) > 0.1) 
                ? (isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)') 
                : 'rgba(255,0,0,0.8)';
        }
    }
}
/* Options chung sử dụng cho các biểu đồ cùng dạng combo clustered column + line*/
function getCommonChartOptions(yPrimaryTitle, ySecondaryTitle = null, isSecondaryVisible = true) {

    /* Tính MỘT LẦN cho mỗi mảng nhãn, thay vì mỗi nhãn mỗi khung hình. */
    const NGUONG_HIEN_NHAN = 15;   // trên bao nhiêu ngày thì thôi hiện nhãn số
    let nhanCu = null;
    let ketQua = true;

    function nenHienNhan(chart) {
        const nhan = chart.data.labels || [];

        if (nhan !== nhanCu) {
            nhanCu = nhan;
            ketQua = new Set(nhan.map(l => String(l).split(' - ')[0].trim()))
                        .size <= NGUONG_HIEN_NHAN;
        }
        return ketQua;
    }
    let scales = {
        y_primary : { type: 'linear', position: 'left', title: { display: true, text: yPrimaryTitle }, grace: '5%', min : 0.00 }
    }

    if (ySecondaryTitle) {
        scales.y_secondary = {
            type: 'linear', position: 'right', title: { display: true, text: ySecondaryTitle}, grace: '70%', grid: 
            { drawOnChartArea: false, display: isSecondaryVisible}
        };
    }

    return {
        responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
        scales: scales,
        plugins: {
            datalabels: {
                display: (ctx) => {
                    if (!nenHienNhan(ctx.chart)) return false;
                    if (ctx.dataset.datalabels && ctx.dataset.datalabels.display === false) return false;
                    const datasetType = ctx.dataset.type || ctx.chart.config.type;
                    return ctx.chart.config.type === 'bar' ? datasetType === 'bar' : datasetType === 'line';
                },
                align: (ctx) => ctx.dataset.label.includes('TK4') ? 'bottom' : 'top', anchor: 'end', offset: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 3, padding: { top: 2, bottom: 2, left: 4, right: 4 },
                font: { weight: 'bold', size: 10, family: 'Roboto'}
            },
            legend: {
                display: true, position: 'top',
                labels: {
                    usePointStyle: true, boxWidth: 30, boxHeight: 20,
                    generateLabels: function(chart) {
                        return chart.data.datasets.map(function(dataset, i) {
                            let bgColor = typeof dataset.backgroundColor === 'function' ? dataset.backgroundColor({type: 'legend'}) : dataset.backgroundColor;
                            let borderColor = dataset.borderColor || bgColor;
                            return {
                                text: dataset.label, fillStyle: bgColor, strokeStyle: borderColor,
                                lineWidth: dataset.type === 'line' ? (dataset.borderWidth || 2) : 0,
                                hidden: !chart.isDatasetVisible(i),
                                pointStyle: dataset.type === 'line' ? 'line' : 'rect',
                                datasetIndex: i
                            };
                        });
                    }
                }
            }
        }
    }
}


function getPieChartOptions(titleText, datasetsCount) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: titleText,
                font: { size: 14, weight: 'bold', family: 'Arial' },
                color: getCSS('--text-color') || '#333333',
                padding: { bottom: 15 }
            },
            datalabels: {
                color: '#fff',
                font: { weight: 'bold', size: 12 },
                formatter: (val) => val > 0 ? `${val}%` : '',
                display: (ctx) => ctx.dataset.data[ctx.dataIndex] > 5
            },
            legend: {
                display: true,
                position: 'bottom',
                labels: { usePointStyle: true, padding: 20 }
            },
            tooltip: {
                callbacks: {
                    label: (ctx) => `${ctx.dataset.label} - ${ctx.label}: ${ctx.formattedValue}%`
                }
            }
        }
    };
}
/* Trích xuất dữ liệu từ JSON */
function extractChartData(dataSource, timeCol, shiftCol, dataCols) {
    if (!dataSource?.length) return null;
    let res = { labels: [] };
    dataCols.forEach(c => res[c] = []);
    
    let curDate = "";
    dataSource.forEach(row => {
        if (!row[shiftCol]) return;
        if (row[timeCol]?.trim()) curDate = row[timeCol];
        res.labels.push(`${curDate} - ${row[shiftCol]}`);
        
        // Parse số liệu, nếu trống hoặc lỗi thì trả về 0 để không bị vỡ biểu đồ
        dataCols.forEach(c => {
            if (row[c] === undefined || row[c] === null || row[c].toString().trim() === '') {
                res[c].push(null);
            } else {
                let parsed = Number(row[c].toString().replace(',', '.'));
                res[c].push(isNaN(parsed) ? null : parsed);
            }
        });
    });
    return res;
}

/* Lọc dữ liệu */
function smartFilter(data, primaryKey, startId, endId, shiftId, defaultDays = 7) {
    if (!data?.labels.length) return null;

    // Lấy giá trị từ các ô input
    const start = getUI(startId), end = getUI(endId), shift = getUI(shiftId) || "all";
    
    // TÁCH BIỆT: Kiểm tra xem người dùng CÓ lọc theo ngày hay không
    const hasDateFilter = start !== "" || end !== ""; 

    // Nếu KHÔNG lọc ngày, ta luôn lấy 7 ngày gần nhất làm mốc
    let lastActiveIndex = data.labels.length - 1;
    if (!hasDateFilter) {
        for (let i = data.labels.length - 1; i >= 0; i--) {
            // Quét kiểm tra các cột dữ liệu theo ngày
            const hasAnyDailyData = Object.keys(data).some(k => {
                const isDailyDataColumn = !k.toLowerCase().includes('tichluy') &&
                                          !k.toLowerCase().includes('trungbinh') &&
                                          !k.toLowerCase().includes('dinhmuc') &&
                                          !k.toLowerCase().includes('dsx') &&
                                          k !== 'labels' && k !== 'isDateFiltered';
                                          
                return isDailyDataColumn && data[k] && data[k][i] > 0;
            });
            
            // Ngay khi gặp ca có dữ liệu đầu tiên (từ dưới lên), cắm mỏ neo và dừng lại
            if (hasAnyDailyData) {
                lastActiveIndex = i;
                break;
            }
        }
    }

    const latest7Days = !hasDateFilter 
        ? [...new Set(data.labels.slice(0, lastActiveIndex + 1).map(l => String(l).split(' - ')[0].trim()))].slice(-defaultDays) 
        : [];
    
    const startTs = start ? new Date(start).getTime() : 0;
    const endTs = end ? new Date(end).getTime() : Infinity;

    let res = { labels: [], isDateFiltered: hasDateFilter };
    Object.keys(data).filter(k => k !== 'labels').forEach(k => res[k] = []);

    const limitIndex = hasDateFilter ? data.labels.length - 1 : lastActiveIndex;

    for (let i = 0; i <= limitIndex; i++) {
        const label = data.labels[i];
        const [dPart, sPart] = String(label).split(' - ').map(s => s.trim());
        const ts = new Date(dPart.split('/').reverse().join('-')).getTime(); 
        
        const passDate = hasDateFilter 
            ? (ts >= startTs && ts <= endTs) 
            : latest7Days.includes(dPart);

        const passShift = (shift === 'all' || sPart === shift);

        if (passDate && passShift) {
            res.labels.push(label);
            Object.keys(res).filter(k => k !== 'labels' && k !== 'isDateFiltered').forEach(k => {res[k].push(data[k] ? data[k][i] : 0);});

        }
    }

    // Đã nạp chính xác, không cần vòng lặp while cắt đuôi nữa.
    return res;
}

/* Vẽ biểu đồ tiêu hao than - Gộp TK3 & TK4 */
function drawCoalConsumeChart(canvasId, labels, dataNhietriTK3, dataNhietriTK4, dataTrungbinh, dataTichluyTK3, dataTichluyTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');
    const cTK3 = getCSS('--primary-blue') || '#a40db8';
    const cTK4 = '#3498db';

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: 'Mức trung bình', data: dataTrungbinh || [], 
                    borderColor: getCSS('--danger-red') || '#e74c3c', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                },
                {
                    type: 'line', label: 'Luỹ kế TK3', data: dataTichluyTK3 || [], 
                    borderColor: getCSS('--warning-yellow') || '#f39c12', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: 'Luỹ kế TK4', data: dataTichluyTK4 || [], 
                    borderColor: getCSS('--success-green') || '#2ecc71', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 3
                    ,hidden: !showTK4
                },
                {
                    type: 'bar', label: 'Tiêu hao TK3', data: dataNhietriTK3 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK3, dataTrungbinh), 
                    yAxisID: 'y_secondary', order: 4
                    ,hidden: !showTK3
                },
                {
                    type: 'bar', label: 'Tiêu hao TK4', data: dataNhietriTK4 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK4, dataTrungbinh),
                    yAxisID: 'y_secondary', order: 5
                    ,hidden: !showTK4
                }
            ]
        },
        options: getCommonChartOptions('TH luỹ kế tháng', 'TH ngày')   
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataNhietriTK3, dataNhietriTK4], dataTrungbinh);
}
/* Vẽ biểu đồ tiêu hao trợ dung, tiếp tục */

function drawFluxConsumeChart(canvasId, labels, dataLimeTK3, dataLimeTK4, dataLimeTichluyTK3, dataLimeTichluyTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3', data: dataLimeTichluyTK3 || [], 
                    borderColor: '#b65edb', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4', data: dataLimeTichluyTK4 || [], 
                    borderColor: getCSS('--success-green') || '#09e80d', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK4
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK3', data: dataLimeTK3 || [], 
                    backgroundColor: getCSS('--primary-blue') || '#a40db8',
                    yAxisID: 'y_secondary', order: 3
                    ,hidden: !showTK3
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK4', data: dataLimeTK4 || [], 
                    backgroundColor: getCSS('--warning-yellow') || '#d3ed0c',
                    yAxisID: 'y_secondary', order: 4
                    ,hidden: !showTK4
                },
            ]
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế tháng', 'Tiêu hao theo ngày')
    });
}

function drawElectricConsumeChart(canvasId, labels, dataElecTK3, dataElecTK4, dataDinhMuc ,dataElecTichluyTK3, dataElecTichluyTK4, dataElecDSXTK3, dataElecDSXTK4, lineFilter = 'all', elecTypeFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const isLineAll = (lineFilter === 'all');
    const isTK3 = (lineFilter === 'TK3');
    const isTK4 = (lineFilter === 'TK4');

    const showNormalType = (elecTypeFilter === 'all' || elecTypeFilter === 'normal');
    const showDSXType = (elecTypeFilter === 'all' || elecTypeFilter === 'dsx');

    const displayTK3Normal = isTK3 || (isLineAll && showNormalType);
    const displayTK3DSX    = isTK3 || (isLineAll && showDSXType);
    
    const displayTK4Normal = isTK4 || (isLineAll && showNormalType);
    const displayTK4DSX    = isTK4 || (isLineAll && showDSXType);

    const cTK3 = '#60f542';
    const cTK4 = '#3498db';

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: 'Định mức', data: dataDinhMuc || [], 
                    borderColor: getCSS('--danger-red') || '#e74c3c', backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3', data: dataElecTichluyTK3 || [], 
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !displayTK3Normal
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4', data: dataElecTichluyTK4 || [], 
                    borderColor: getCSS('--success-green'), backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 3
                    ,hidden: !displayTK4Normal
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3 (DSX)', data: dataElecDSXTK3 || [], 
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'rect', radius: 4, fill: false, yAxisID: 'y_primary', order: 4
                    ,hidden: !displayTK3DSX
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4 (DSX)', data: dataElecDSXTK4 || [], 
                    borderColor: getCSS('--success-green'),  backgroundColor: getCSS('--white') || '#ffffff', 
                    borderWidth: 2, tension: 0.4, pointStyle: 'rect', radius: 4, fill: false, yAxisID: 'y_primary', order: 5
                    ,hidden: !displayTK4DSX
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK3', data: dataElecTK3 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK3, dataDinhMuc),
                    yAxisID: 'y_secondary', order: 6
                    ,hidden: isTK4
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK4', data: dataElecTK4 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK4, dataDinhMuc),
                    yAxisID: 'y_secondary', order: 7
                    ,hidden: isTK3
                },
            ]
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế tháng', 'Tiêu hao ngày')
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataElecTK3, dataElecTK4], dataDinhMuc);
}

function drawIronOreConsumeChart(canvasId, labels, dataOreTK3, dataOreTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: 'Tiêu hao quặng chứa sắt TK3', data: dataOreTK3 || [], 
                    borderColor: getCSS('--success-green'), backgroundColor: getCSS('--success-green'),
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: true, yAxisID: 'y_primary', order: 1
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: 'Tiêu hao quặng chứa sắt TK4', data: dataOreTK4 || [], 
                    borderColor: getCSS('--primary-blue'), backgroundColor: getCSS('--primary-blue'),
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: true, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK4
                }
            ],
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế tháng')
    });
}

function drawCOConsumeChart(canvasId, labels, dataCOTK3, dataCOTK4, dataDinhMuc, dataCOTichluyTK3, dataCOTichluyTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3  = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4  = (lineFilter === 'all' || lineFilter === 'TK4');

    const cTK3 = getCSS('--primary-blue');
    const cTK4 = getCSS('--secondary-blue');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels : labels || [],
            datasets: [
                {
                    type: 'line', label: 'Định mức', data: dataDinhMuc || [],
                    borderColor: getCSS('--danger-red'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3', data: dataCOTichluyTK3 || [],
                    borderColor: getCSS('--coal-consumeCcd'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4', data: dataCOTichluyTK4 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 3
                },
                {
                    type: 'bar', label: 'Tiêu hao TK3', data: dataCOTK3 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK3, dataDinhMuc), 
                    yAxisID: 'y_secondary', order: 4
                    ,hidden: !showTK3
                },
                {
                    type: 'bar', label: 'Tiêu hao TK4', data: dataCOTK4 || [], 
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK4, dataDinhMuc), 
                    yAxisID: 'y_secondary', order: 5
                    ,hidden: !showTK4
                }
            ]
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế', 'Tiêu hao theo ngày')
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataCOTK3, dataCOTK4], dataDinhMuc);
}

function drawReturnFinesRate(canvasId, labels, dataHoiTK3, dataHoiTK4, dataTichluyTK3, dataTichluyTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');

    const cTK3 = getCSS('--primary-blue');
    const cTK4 = getCSS('--secondary-blue');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'line', label: 'Tích lũy TK3', data: dataTichluyTK3 || [],
                    borderColor: getCSS('--success-green'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                },
                {
                    type: 'line', label: 'Tích lũy TK4', data: dataTichluyTK4 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK3', data: dataHoiTK3 || [],
                    backgroundColor: cTK3, yAxisID: 'y_secondary', order: 3,
                    hidden: !showTK3  
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK4', data: dataHoiTK4 || [],
                    backgroundColor: cTK4, yAxisID: 'y_secondary', order: 4,
                    hidden: !showTK4
                }
            ]
        },
        options: getCommonChartOptions('Tiêu hao lũy kế', 'Tiêu hao ngày')
    });
}

function drawQTHChart(canvasId, labels, dataSiO2, dataCaO) {
    const canvas = document.getElementById(canvasId);
    
    if (!canvas) return;

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const floatingSiO2 = formattingFloatingTrend(dataSiO2);

    let options = getCommonChartOptions('(%) SiO2', '(%) CaO', true);

    if (!options.scales.x) options.scales.x = {};
    options.scales.x.stacked = true;

    // Logic tính mức min max trên biểu đồ
    const minSiO2 = Math.min(...(dataSiO2 && dataSiO2.length > 0 ? dataSiO2 : [0]));
    const maxSiO2 = Math.max(...(dataSiO2 && dataSiO2.length > 0 ? dataSiO2 : [0]));
    options.scales.y_primary.suggestedMin = Math.max(0, minSiO2 - 0.2); 
    options.scales.y_primary.suggestedMax = maxSiO2 + 0.2;

    // Logic tính mức min max trê biểu đồ
    const maxCaO = Math.max(...(dataCaO && dataCaO.length > 0 ? dataCaO : [0]), 1);
    options.scales.y_secondary.suggestedMax = maxCaO * 4; 
    options.scales.y_secondary.grid = { drawOnChartArea: false };

    // Logic quy định labels
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

function drawQHLCChart(canvasId, labels, dataSiO2TK3, dataSiO2TK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');

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

function drawCoalSizeChart(canvasId, f, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const getLast = (key) => f[key] && f[key].length > 0 ? parseFloat(f[key][f[key].length - 1]) : 0;

    const p = f['<0.5mmTNTK3'] !== undefined ? 'TN' : 'TC';
    const latestLabel = f.labels?.length ? f.labels[f.labels.length - 1] : 'Không có dữ liệu';

    const lineConfigs = {
        'TK4' : { show: lineFilter === 'all' || lineFilter === 'TK4', colors: ['#2ecc71', '#f39c12', '#e74c3c']},
        'TK3' : { show: lineFilter === 'all' || lineFilter === 'TK3', colors: ['#27ae60', '#f1c40f', '#c0392b']}
    };

    const datasets = Object.keys(lineConfigs).filter(line => lineConfigs[line].show).map(line => ({
        label: line,
        data: [getLast(`<0.5mm${p}${line}`), getLast(`0.5-3mm${p}${line}`), getLast(`>3mm${p}${line}`)],
        backgroundColor: lineConfigs[line].colors,
        borderColor: getCSS('--white') || '#ffffff',
        borderWidth: 2
    }));

    const chartTitle = `Dữ liệu chi tiết: ${latestLabel}`;

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'pie',
        data: {
            labels: ['< 0.5mm', '0.5 - 3mm', '> 3mm'],
            datasets: datasets
        },
        options: getPieChartOptions(chartTitle)
    });
}

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

function drawQTKQualityChart(canvasId, labels, ...args) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    // Tách bộ lọc lineFilter nằm ở vị trí cuối cùng của mảng arguments (nếu có)
    let lineFilter = 'all';
    if (args.length > 0 && typeof args[args.length - 1] === 'string' && ['all', 'TK3', 'TK4'].includes(args[args.length - 1])) {
        lineFilter = args.pop();
    }

    // Đóng gói mảng tham số động: Cứ mỗi 4 tham số là 1 cụm (dataTK3, dataTK4, name, color)
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
            
            // Tính toán Ẩn/Hiện dựa vào bộ lọc (Đồng bộ mọi đường)
            const isHidden = lineFilter !== 'all' && lineFilter !== tk;
            const dataset = isTK4 ? metric.dataTK4 : metric.dataTK3;

            // Cấu hình UI gốc cho đường dữ liệu thực
            let borderWidth = 2;
            let pointStyle = isTK4 ? 'rect' : 'circle';
            let pointRadius = 3;
            let borderColor = isTK4 && metric.color.includes('rgb') ? metric.color.metric.color.replace('rgb', 'rgba').replace(')', ', 0.8)') : metric.color;
            let datalabelsConfig = { display: true };

            // TINH CHỈNH RIÊNG CHO ĐƯỜNG ĐỊNH MỨC (Khoảng Trên & Dưới)
            // Vì Khoảng trên/dưới nằm ở cụm tham số 2 và 3 (index > 0)
            if (index > 0 && canvasId === 'basicility-chart') {
                borderWidth = 1.5;
                pointRadius = 0;     // Ẩn dấu chấm để nó giống 1 đường biên giới hạn
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
                hidden: isHidden, // Thuộc tính quyết định việc tự động ẩn khi lọc TK3/TK4
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

function drawUniversalComboChart(canvasId, labels, config, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = (lineFilter === 'all' || lineFilter === 'TK3');
    const showTK4 = (lineFilter === 'all' || lineFilter === 'TK4');

    const datasets = [];

    // 1. Lớp dữ liệu Line 1: Đường Trung bình / Tiêu chuẩn / Định mức
    if (config.avg) {
        datasets.push({
            type: 'line', label: config.avg.label, data: config.avg.data || [],
            borderColor: config.avg.color || getCSS('--danger-red') || '#e74c3c',
            backgroundColor: '#ffffff',
            borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false,
            yAxisID: 'y_primary', order: 1
        });
    }

    // 2. Lớp dữ liệu Line 2: Đường Luỹ kế / Đường Biên
    if (config.lines && Array.isArray(config.lines)) {
        let orderIndex = 2;
        config.lines.forEach(lineCfg => {
            datasets.push({
                type: 'line', 
                label: lineCfg.labelTK3 || `${lineCfg.label} TK3`, 
                data: lineCfg.dataTK3 || [],
                borderColor: lineCfg.colorTK3 || getCSS('--warning-yellow'),
                backgroundColor: '#ffffff',
                borderWidth: 2, tension: 0.4, 
                pointStyle: lineCfg.pointStyleTK3 || 'circle', 
                radius: 4, fill: false, yAxisID: 'y_primary', 
                order: orderIndex++, hidden: !showTK3
            });
            datasets.push({
                type: 'line', 
                label: lineCfg.labelTK4 || `${lineCfg.label} TK4`, 
                data: lineCfg.dataTK4 || [],
                borderColor: lineCfg.colorTK4 || getCSS('--success-green'),
                backgroundColor: '#ffffff',
                borderWidth: 2, tension: 0.4, 
                pointStyle: lineCfg.pointStyleTK4 || 'circle', 
                radius: 4, fill: false, yAxisID: 'y_primary', 
                order: orderIndex++, hidden: !showTK4
            });
        });
    }
    else if (config.line) {
        datasets.push({
            type: 'line', label: `${config.line.label} TK3`, data: config.line.dataTK3 || [],
            borderColor: config.line.colorTK3 || getCSS('--warning-yellow') || '#f39c12',
            backgroundColor: '#ffffff',
            borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false,
            yAxisID: 'y_primary', order: 2, hidden: !showTK3
        });
        datasets.push({
            type: 'line', label: `${config.line.label} TK4`, data: config.line.dataTK4 || [],
            borderColor: config.line.colorTK4 || getCSS('--success-green') || '#2ecc71',
            backgroundColor: '#ffffff',
            borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false,
            yAxisID: 'y_primary', order: 3, hidden: !showTK4
        });
    }

    // 3. Lớp dữ liệu Bar: Khối lượng / Giá trị thực tế ngày
    if (config.bar) {
        datasets.push({
            type: 'bar', label: `${config.bar.label} TK3`, data: config.bar.dataTK3 || [],
            backgroundColor: (ctx) => config.avg ? getFlashColor(ctx, config.bar.colorTK3 || getCSS('--primary-blue'), config.avg.data) : (config.bar.colorTK3 || getCSS('--primary-blue') || '#a40db8'),
            yAxisID: 'y_secondary', order: 4, hidden: !showTK3
        });
        datasets.push({
            type: 'bar', label: `${config.bar.label} TK4`, data: config.bar.dataTK4 || [],
            backgroundColor: (ctx) => config.avg ? getFlashColor(ctx, config.bar.colorTK4 || '#3498db', config.avg.data) : (config.bar.colorTK4 || '#3498db'),
            yAxisID: 'y_secondary', order: 5, hidden: !showTK4
        });
    }

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: { labels: labels || [], datasets: datasets },
        options: getCommonChartOptions(config.yPrimaryTitle || 'Trục Line', config.ySecondaryTitle || 'Trục Bar')
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [config.bar && config.bar.dataTK3, config.bar && config.bar.dataTK4],
        config.avg && config.avg.data);
}
/* =============================================================================
 * ĐỌC SỐ VÀ NGÀY TỪ BẢNG TÍNH — dùng cho dải chỉ số tổng quan trang chủ
 * -----------------------------------------------------------------------------
 * Vì sao không dùng lại cách cũ `Number(v.replace(',', '.'))`:
 * cách đó chỉ đổi DẤU PHẨY ĐẦU TIÊN nên gãy với mọi định dạng có ngăn hàng nghìn
 *      "5,854.00"   -> "5.854.00"  -> NaN
 *      "5.930,000"  -> NaN
 *      "313,000.00" -> NaN
 * Bảng tính của xưởng đang xuất ra CẢ HAI kiểu (kiểu Mỹ và kiểu Việt) tuỳ ô,
 * nên cần đọc được cả hai.
 *
 * Thậm chí trong CÙNG một sheet, mỗi cột một kiểu (TK4: sản lượng "5.930,000",
 * "6236,451", "6299"; hệ số biến thiên "0,047"; cỡ hạt "97.23").
 *
 * QUY TẮC:
 *   1) Có cả '.' và ',' -> dấu ĐỨNG SAU là thập phân, dấu kia là ngăn hàng nghìn.
 *   2) Một loại dấu, xuất hiện NHIỀU lần ("1.234.567") -> ngăn hàng nghìn.
 *   3) Một dấu duy nhất -> là THẬP PHÂN nếu không thể là ngăn hàng nghìn:
 *        - sau dấu không đúng 3 chữ số        "85,48"    -> 85,48
 *        - phần nguyên là 0 hoặc trống         "0,047"    -> 0,047
 *        - phần nguyên dài hơn 3 chữ số        "6236,451" -> 6236,451
 *          (ngăn hàng nghìn thật thì phải viết "6,236,451")
 *   4) Còn lại mới thật sự mơ hồ ("1,500": 1,5 hay 1500?) -> theo dauThapPhan của
 *      CỘT (xem sheetDauThapPhanCot); không có gợi ý thì coi là ngăn hàng nghìn.
 *
 * LỖI ĐÃ GẶP: bản cũ chỉ xét "đúng 3 chữ số sau dấu" nên đọc "6236,451" (TK4 ca A
 * 16/09) thành 6.236.451 tấn -> luỹ kế tháng vọt lên 6,6 triệu tấn, tỉ lệ đạt
 * 1.070%, hệ số lợi dụng TK4 43,8. Và "0,047" thành 47.
 * ===========================================================================*/
function sheetNumber(v, dauThapPhan) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let t = v.toString().trim().replace(/\s/g, '');
    if (t === '') return null;
    t = t.replace(/[^\d.,-]/g, '');            // bỏ đơn vị, ký tự lạ
    if (t === '' || t === '-') return null;

    const cham = t.lastIndexOf('.');
    const phay = t.lastIndexOf(',');
    let tp = '';                               // dấu thập phân, '' = số nguyên

    if (cham >= 0 && phay >= 0) {
        tp = cham > phay ? '.' : ',';
    } else if (cham >= 0 || phay >= 0) {
        const dau = cham >= 0 ? '.' : ',';
        if (sheetLaDauThapPhan(t, dau, dauThapPhan)) tp = dau;
    }

    const nghin = tp === '.' ? ',' : tp === ',' ? '.' : null;
    if (nghin) t = t.split(nghin).join('');
    else t = t.split('.').join('').split(',').join('');
    if (tp) t = t.replace(tp, '.');

    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Chuỗi chỉ có MỘT loại dấu `dau`: dấu đó là thập phân (true) hay ngăn hàng nghìn? */
function sheetLaDauThapPhan(t, dau, goiY) {
    const phan = t.replace(/^-/, '').split(dau);
    if (phan.length > 2) return false;                     // quy tắc 2
    const nguyen = phan[0], le = phan[1];
    if (le.length !== 3) return true;                      // quy tắc 3
    if (/^0*$/.test(nguyen) || nguyen.length > 3) return true;
    if (goiY) return goiY === dau;                         // quy tắc 4
    return false;
}

/** Dò xem một CỘT dùng dấu nào làm thập phân, dựa trên các ô KHÔNG mơ hồ trong
 *  cột đó. Trả ',' / '.' / null (không đủ căn cứ). Dùng làm gợi ý cho sheetNumber
 *  khi gặp ô mơ hồ kiểu "1,500". */
function sheetDauThapPhanCot(rows, cot) {
    if (!rows || !cot) return null;
    const phieu = { ',': 0, '.': 0 };
    for (let i = 0; i < rows.length; i++) {
        const v = rows[i][cot];
        if (v === undefined || v === null || typeof v === 'number') continue;
        const t = v.toString().replace(/[^\d.,-]/g, '');
        const cham = t.lastIndexOf('.'), phay = t.lastIndexOf(',');
        if (cham < 0 && phay < 0) continue;
        if (cham >= 0 && phay >= 0) { phieu[cham > phay ? '.' : ',']++; continue; }
        const dau = cham >= 0 ? '.' : ',';
        const khac = dau === '.' ? ',' : '.';
        const phan = t.replace(/^-/, '').split(dau);
        if (phan.length > 2) phieu[khac]++;
        else if (sheetLaDauThapPhan(t, dau, null)) phieu[dau]++;
    }
    if (phieu[','] === phieu['.']) return null;
    return phieu[','] > phieu['.'] ? ',' : '.';
}

/* Đọc ngày kiểu dd/mm/yyyy (định dạng bảng tính đang dùng). Trả {d,m,y} hoặc null. */
function sheetDate(v) {
    if (!v) return null;
    const m = v.toString().trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!m) return null;
    const d = +m[1], th = +m[2], y = +m[3];
    if (d < 1 || d > 31 || th < 1 || th > 12) return null;
    return { d: d, m: th, y: y };
}

/* Số ngày của một tháng (có xét năm nhuận). */
function soNgayTrongThang(thang, nam) {
    return new Date(nam, thang, 0).getDate();
}
