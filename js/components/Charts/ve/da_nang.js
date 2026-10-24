/* =============================================================================
 * js/components/Charts/ve/da_nang.js — BIỂU ĐỒ KẾT HỢP "ĐA NĂNG"
 * =============================================================================
 * Phần 7/7 của bộ đồ nghề vẽ biểu đồ (thư mục ve/, trước 24/10/2026 là
 * chart_core.js) — đọc ve/chung.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 *   Một hàm vẽ cấu hình bằng đối tượng (xem chú thích ngay dưới) — chartConfigs
 *   trong bep/bo_loc.js dùng nó cho biểu đồ chất lượng vôi nung, dolomite nung.
 * ===========================================================================*/

/** Biểu đồ kết hợp "đa năng", cấu hình bằng một đối tượng thay vì một dãy tham số:
 *    config = {
 *      avg:   { label, data, color }            đường trung bình / định mức (tuỳ chọn)
 *      lines: [{ label, dataTK3, dataTK4,       các đường luỹ kế / biên — mỗi phần tử
 *                labelTK3?, labelTK4?,          thành 2 đường TK3 + TK4
 *                colorTK3?, colorTK4?,
 *                pointStyleTK3?, pointStyleTK4? }]
 *      line:  { label, dataTK3, dataTK4, ... }  dùng khi chỉ có MỘT cặp đường
 *      bar:   { label, dataTK3, dataTK4,        cột số theo ngày; có avg thì cột
 *               colorTK3?, colorTK4? }          vượt avg nhấp nháy đỏ
 *      yPrimaryTitle, ySecondaryTitle           tên trục trái / phải
 *    } */
function drawUniversalComboChart(canvasId, labels, config, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

    const datasets = [];

    // 1. Đường trung bình / tiêu chuẩn / định mức
    if (config.avg) {
        datasets.push({
            type: 'line', label: config.avg.label, data: config.avg.data || [],
            borderColor: config.avg.color || getCSS('--danger-red') || '#e74c3c',
            backgroundColor: '#ffffff',
            borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false,
            yAxisID: 'y_primary', order: 1
        });
    }

    // 2. Các đường luỹ kế / đường biên (mỗi cấu hình -> 2 đường TK3 + TK4)
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

    // 3. Cột: khối lượng / giá trị thực tế theo ngày
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


/* sheetNumber(), sheetDate(), sheetDauThapPhanCot(), soNgayTrongThang() — đọc số
   và ngày từ bảng tính — nằm ở js/chung/chi_so.js (nạp trước file này) để máy
   chủ đọc số y hệt trình duyệt. */
