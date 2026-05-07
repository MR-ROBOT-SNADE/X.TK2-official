/* HỆ THỐNG VẼ BIỂU ĐỒ TỪ DỮ LIỆU CẬP NHẬT TỪ GOOGLESHEET API */
Chart.register(ChartDataLabels);
let chartInstances = {}, isFlashing = false;

setInterval(() => {
    isFlashing = !isFlashing;
    Object.values(chartInstances).forEach(c => c && c.update('none'));
}, 500);

const getCSS = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const getUI = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

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
        dataCols.forEach(c => res[c].push(row[c] ? parseFloat(row[c].toString().replace(',','.')) || 0 : 0));
    });
    return res;
}

/* Lọc dữ liệu */
function smartFilter(data, primaryKey, startId, endId, shiftId) {
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
        ? [...new Set(data.labels.slice(0, lastActiveIndex + 1).map(l => String(l).split(' - ')[0].trim()))].slice(-7) 
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
            Object.keys(res).filter(k => k !== 'labels' && k !== 'isDateFiltered').forEach(k => res[k].push(data[k][i]));
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
                    backgroundColor: (ctx) => {
                        if (ctx.type !== 'data') return getCSS('--primary-blue') || '#a40db8';
                        const avg = dataTrungbinh && dataTrungbinh[ctx.dataIndex];
                        if (avg && ctx.raw > avg) return isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)';
                        return getCSS('--primary-blue') || '#a40db8';
                    }, 
                    yAxisID: 'y_secondary', order: 4
                    ,hidden: !showTK3
                },
                {
                    type: 'bar', label: 'Tiêu hao TK4', data: dataNhietriTK4 || [], 
                    backgroundColor: (ctx) => {
                        if (ctx.type !== 'data') return '#3498db';
                        const avg = dataTrungbinh && dataTrungbinh[ctx.dataIndex];
                        if (avg && ctx.raw > avg) return isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)';
                        return '#3498db';
                    },
                    yAxisID: 'y_secondary', order: 5
                    ,hidden: !showTK4
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y_primary: { type: 'linear', position: 'left', title: { display: true, text: 'TH luỹ kế tháng' }, grace: '10%' },
                y_secondary: { type: 'linear', position: 'right', title: { display: true, text: 'TH ngày' }, grid: { drawOnChartArea: false }, grace: '50%' }
            },
            plugins: {
                datalabels: {
                    display: (ctx) => {
                        const lbls = ctx.chart.data.labels || [];
                        const uniqueDays = new Set(lbls.map(l => String(l).split(' - ')[0].trim())).size;
                        return uniqueDays <= 15 && ctx.dataset.type === 'bar';
                    },
                    align: 'top', anchor: 'end', font: { weight: 'bold', size: 11 }
                }
            }
        }   
    });
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
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y_primary: { type: 'linear', position: 'left', title: { display: true, text: 'Tiêu hao luỹ kế tháng' }, grace: '10%' },
                y_secondary: { type: 'linear', position: 'right', title: { display: true, text: 'Tiêu hao theo ngày' }, grace: '50%' }
            },
            plugins: {
                datalabels: {
                    display: (ctx) => {
                        const lbls = ctx.chart.data.labels || [];
                        const uniqueDays = new Set(lbls.map(l => String(l).split(' - ')[0].trim())).size;
                        return uniqueDays <= 15 && ctx.dataset.type === 'bar';
                    },
                    align: 'top', anchor: 'end', font: { weight: 'bold', size: 11 }
                }
            }
        }
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
                    backgroundColor: (ctx) => {
                        if (ctx.type !== 'data') return '#3498db';
                        const avg = dataDinhMuc && dataDinhMuc[ctx.dataIndex];
                        if (avg && ctx.raw > avg) return isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)';
                        return '#3498db';
                    },
                    yAxisID: 'y_secondary', order: 6
                    ,hidden: isTK4
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK4', data: dataElecTK4 || [], 
                    backgroundColor: (ctx) => {
                        if (ctx.type !== 'data') return '#3498db';
                        const avg = dataDinhMuc && dataDinhMuc[ctx.dataIndex];
                        if (avg && ctx.raw > avg) return isFlashing ? 'rgba(255,0,0,0.9)' : 'rgba(255,0,0,0.3)';
                        return '#3498db';
                    },
                    yAxisID: 'y_secondary', order: 7
                    ,hidden: isTK3
                },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            scales: {
                y_primary: { type: 'linear', position: 'left', title: { display: true, text: 'Tiêu hao luỹ kế tháng' }, grace: '5%' },
                y_secondary: { type: 'linear', position: 'right', title: { display: true, text: 'Tiêu hao theo ngày' }, grace: '85%' }
            },
            plugins:{
                datalabels: {
                    display: (ctx) => {
                        const lbls = ctx.chart.data.labels || [];
                        const uniqueDays = new Set(lbls.map(l => String(l).split(' - ')[0].trim())).size;
                        return uniqueDays <= 15 && ctx.dataset.type === 'bar';
                    },
                    align: 'top', anchor: 'end', font: { weight: 'bold', size: 11 }
                }
            }
        }
    });
}