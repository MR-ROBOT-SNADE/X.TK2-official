/* =============================================================================
 * js/components/Charts/render/consumption_charts.js — CÁC HÀM VẼ BIỂU ĐỒ TIÊU HAO
 * =============================================================================
 * Phần 5/7 của bộ đồ nghề vẽ biểu đồ (thư mục render/, trước 24/10/2026 là
 * chart_core.js) — đọc render/setup.js trước để biết cả thư mục.
 *   than, trợ dung (vôi, dolomite), điện, quặng chứa sắt, khí than, hơi nước,
 *   tỉ lệ hồi nguội. Biểu đồ chất lượng ở quality_charts.js.
 * -----------------------------------------------------------------------------
 * Mỗi hàm nhận canvasId, mảng nhãn và các mảng số (cùng độ dài với nhãn), rồi
 * dựng biểu đồ. Các biểu đồ có định mức gọi updateTickingList ở cuối để bật
 * nhấp nháy khi có cột vượt.
 * ===========================================================================*/

/** Tiêu hao than (4 dây chung một biểu đồ):
 *    cột   = tiêu hao theo ngày từng dây (trục phải), TK1 -> TK4 — TK3, TK4 đỏ
 *            nhấp nháy nếu vượt mức trung bình
 *    đường = mức trung bình, luỹ kế từng dây (trục trái): TK3 cam, TK4 xanh lá,
 *            TK1 tím, TK2 đen */
function drawCoalConsumeChart(canvasId, labels, dataNhietriTK3, dataNhietriTK4, dataTrungbinh, dataTichluyTK3, dataTichluyTK4, lineFilter = 'all', them = null) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');
    const cTK3 = getCSS('--primary-blue') || '#a40db8';
    const cTK4 = '#3498db';

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: xepCotTheoDay([
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
                },
                ...datasetDayThem(them, lineFilter, { tenVal: 'Tiêu hao', tenAcc: 'Luỹ kế', thuTuAcc: 3, thuTuVal: 5 })
            ])
        },
        options: getCommonChartOptions('TH luỹ kế tháng', 'TH ngày')
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataNhietriTK3, dataNhietriTK4], dataTrungbinh);
}

/** Tiêu hao trợ dung (vôi / dolomite): cột = tiêu hao ngày (TK1 -> TK4), đường =
 *  luỹ kế: TK3 tím, TK4 xanh lá, TK1 đỏ, TK2 đen. Không có định mức nên không
 *  nhấp nháy. */
function drawFluxConsumeChart(canvasId, labels, dataLimeTK3, dataLimeTK4, dataLimeTichluyTK3, dataLimeTichluyTK4, lineFilter = 'all', them = null) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: xepCotTheoDay([
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
                ...datasetDayThem(them, lineFilter, { tenVal: 'Tiêu hao ngày', tenAcc: 'Tiêu hao luỹ kế', thuTuAcc: 2, thuTuVal: 4,
                    mauAcc: { TK1: '#e53935', TK2: '#212121' } })
            ])
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế tháng', 'Tiêu hao theo ngày')
    });
}

/** Nhãn số trên điểm / cột: tối đa 2 chữ số lẻ (sheet có ô như 21,6119597). */
function nhanSoGon(v) {
    return v === null || v === undefined ? '' : Math.round(v * 100) / 100;
}

/** Tiêu hao trợ dung TÁCH RIÊNG — trang 2 của biểu đồ vôi / dolomite: vật liệu
 *  nung và bột đá tiêu hao thật theo ca (chưa quy đổi, không luỹ kế), mỗi vật
 *  liệu một đường mỗi dây trên cùng một trục.
 *  Mọi đường nét LIỀN; mỗi dây một màu (TK1 xanh ngọc, TK2 hồng sẫm, TK3 xanh lam,
 *  TK4 cam), hai vật liệu của cùng dây cùng màu, phân biệt bằng ĐIỂM: vật liệu
 *  nung = chấm tròn, bột đá = chấm tam giác (chú giải cũng hiện đúng điểm đó). Hai
 *  vật liệu nằm hai dải số tách nhau (vôi nung ~60, bột đá vôi ~25-45 kg/tsp).
 *  Nhãn số cùng màu đường của nó. Chú giải gom theo dây TK1 -> TK4.
 *    cfg = { tenNung: 'Vôi nung',   nungTK3, nungTK4, (nungTK1, nungTK2)
 *            tenDa:   'Bột đá vôi', daTK3,   daTK4,   (daTK1,   daTK2) }
 *  TK1, TK2 chỉ vẽ khi có số. */
function drawFluxSplitChart(canvasId, labels, cfg, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const mau = { TK1: MAU_DAY_THEM.TK1, TK2: MAU_DAY_THEM.TK2,
                  TK3: getCSS('--primary-blue') || '#0033a1', TK4: getCSS('--warning-yellow') || '#f39c12' };

    /* Tên đường phải có chữ TK1..TK4: getCommonChartOptions đặt nhãn số của TK2,
       TK4 phía dưới điểm, TK1, TK3 phía trên; chú giải gom theo dây (soTheoDay) */
    const duong = (ten, dc, data, laDa, thuTu) => ({
        type: 'line', label: ten + ' ' + dc, data: data || [],
        borderColor: mau[dc], backgroundColor: getCSS('--white') || '#ffffff',
        borderWidth: 2, tension: 0.4, pointStyle: laDa ? 'triangle' : 'circle', radius: laDa ? 5 : 4,
        fill: false, yAxisID: 'y_primary', order: thuTu, hidden: !hienDay(lineFilter, dc),
        chuGiaiDiem: true, datalabels: { color: mau[dc] }
    });
    const coSo = (a) => Array.isArray(a) && a.some(v => v !== null && v !== undefined);

    const options = getCommonChartOptions('Tiêu hao theo ca');
    options.plugins.datalabels.formatter = nhanSoGon;

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: labels || [],
            datasets: [
                duong(cfg.tenNung, 'TK3', cfg.nungTK3, false, 1),
                duong(cfg.tenNung, 'TK4', cfg.nungTK4, false, 2),
                duong(cfg.tenDa,   'TK3', cfg.daTK3,   true,  3),
                duong(cfg.tenDa,   'TK4', cfg.daTK4,   true,  4),
                ...DAY_THEM.flatMap((dc, i) => [[cfg.tenNung, cfg['nung' + dc], false], [cfg.tenDa, cfg['da' + dc], true]]
                    .filter(x => coSo(x[1]))
                    .map((x, j) => duong(x[0], dc, x[1], x[2], 5 + i * 2 + j)))
            ]
        },
        options: options
    });
}

/** Tiêu hao điện XƯỞNG THIÊU KẾT 2 (TK3, TK4) — trang 1 của biểu đồ điện (TK1,
 *  TK2 ở trang 2: drawElectricTK12Chart). Có HAI cách tính luỹ kế: thường và DSX
 *  — bộ lọc elecTypeFilter ('all' | 'normal' | 'dsx') chọn hiện đường nào. Khi đã
 *  chọn hẳn một dây (TK3 / TK4) thì hiện cả hai cách của dây đó.
 *  Cột vượt định mức nhấp nháy đỏ. */
function drawElectricConsumeChart(canvasId, labels, dataElecTK3, dataElecTK4, dataDinhMuc ,dataElecTichluyTK3, dataElecTichluyTK4, dataElecDSXTK3, dataElecDSXTK4, lineFilter = 'all', elecTypeFilter = 'all') {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    /* Chọn hẳn MỘT dây -> hiện cả hai cách luỹ kế của dây đó; chọn nhóm dây
       ('all', 'TK34') -> theo ô "thường / DSX" */
    const motDay = /^TK[1-4]$/.test(lineFilter);
    const isLineAll = !motDay;
    const isTK3 = (lineFilter === 'TK3');
    const isTK4 = (lineFilter === 'TK4');

    const showNormalType = (elecTypeFilter === 'all' || elecTypeFilter === 'normal');
    const showDSXType = (elecTypeFilter === 'all' || elecTypeFilter === 'dsx');

    const displayTK3Normal = isTK3 || (isLineAll && hienDay(lineFilter, 'TK3') && showNormalType);
    const displayTK3DSX    = isTK3 || (isLineAll && hienDay(lineFilter, 'TK3') && showDSXType);

    const displayTK4Normal = isTK4 || (isLineAll && hienDay(lineFilter, 'TK4') && showNormalType);
    const displayTK4DSX    = isTK4 || (isLineAll && hienDay(lineFilter, 'TK4') && showDSXType);

    const cTK3 = '#60f542';
    const cTK4 = '#3498db';

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    /* Định mức trong sheet TK3/TK4 */
                    type: 'line', label: 'Định mức', data: dataDinhMuc || [],
                    borderColor: getCSS('--danger-red') || '#e74c3c', backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                    ,hidden: !(hienDay(lineFilter, 'TK3') || hienDay(lineFilter, 'TK4'))
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3', data: dataElecTichluyTK3 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, chuGiaiDiem: true, yAxisID: 'y_primary', order: 2
                    ,hidden: !displayTK3Normal
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4', data: dataElecTichluyTK4 || [],
                    borderColor: getCSS('--success-green'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, chuGiaiDiem: true, yAxisID: 'y_primary', order: 3
                    ,hidden: !displayTK4Normal
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3 (DSX)', data: dataElecDSXTK3 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'rect', radius: 4, fill: false, chuGiaiDiem: true, yAxisID: 'y_primary', order: 4
                    ,hidden: !displayTK3DSX
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4 (DSX)', data: dataElecDSXTK4 || [],
                    borderColor: getCSS('--success-green'),  backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'rect', radius: 4, fill: false, chuGiaiDiem: true, yAxisID: 'y_primary', order: 5
                    ,hidden: !displayTK4DSX
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK3', data: dataElecTK3 || [],
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK3, dataDinhMuc),
                    yAxisID: 'y_secondary', order: 6
                    ,hidden: !hienDay(lineFilter, 'TK3')
                },
                {
                    type: 'bar', label: 'Tiêu hao ngày TK4', data: dataElecTK4 || [],
                    backgroundColor: (ctx) => getFlashColor(ctx, cTK4, dataDinhMuc),
                    yAxisID: 'y_secondary', order: 7
                    ,hidden: !hienDay(lineFilter, 'TK4')
                }
            ]
        },
        options: tachCotVaDuong(getCommonChartOptions('Tiêu hao luỹ kế tháng', 'Tiêu hao ngày'))
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataElecTK3, dataElecTK4], dataDinhMuc);
}

/** Tiêu hao điện XƯỞNG THIÊU KẾT 1 (TK1, TK2) — trang 2 của biểu đồ điện, vẽ RIÊNG
 *  (không chung với TK3, TK4).
 *    cột   = tiêu hao từng ca, TK1 rồi TK2; nhấp nháy xanh dương khi vượt định mức RIÊNG
 *            của dây (TK1 55, TK2 44 kWh/tsp — controller/module_configs.js DINH_MUC_DAY_THEM)
 *    đường = luỹ kế (hàng Tổng sheet 3 của file): TK1 cam, TK2 xanh lá — như TK3,
 *            TK4 ở trang 1; định mức: TK1 đỏ, TK2 tím. Mọi đường nét liền.
 *  TK1, TK2 chỉ có một cách tính luỹ kế (không có DSX) -> ô "Loại điện luỹ kế"
 *  không áp dụng (controller/chart_configs.js ẩn ô đó khi đang ở trang này).
 *    them = dayThem(f, 'elec', 'tichluy', DINH_MUC_DAY_THEM.dien) */
function drawElectricTK12Chart(canvasId, labels, them, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: xepCotTheoDay(datasetDayThem(them, lineFilter, {
                tenVal: 'Tiêu hao ngày', tenAcc: 'Tiêu hao luỹ kế', thuTuAcc: 2, thuTuVal: 4,
                mauAcc: { TK1: getCSS('--warning-yellow') || '#f39c12', TK2: getCSS('--success-green') || '#27ae60' },
                mauDm:  { TK1: getCSS('--danger-red') || '#e74c3c', TK2: '#8e24aa' }
            }))
        },
        options: tachCotVaDuong(getCommonChartOptions('Tiêu hao luỹ kế tháng', 'Tiêu hao ngày'))
    });

    updateTickingList(canvasId, null, null, them);
}

/** Tách tầng cột và tầng đường của biểu đồ hai trục cho khỏi chồng lên nhau:
 *  cột (trục phải) dồn xuống dưới — trần trục phải = 2,3 lần cột cao nhất, đỉnh
 *  cột cao nhất ở ~43% chiều cao; các đường định mức / luỹ kế (trục trái, từ 0)
 *  nằm ở phần trên. Biểu đồ điện có tới 4 đường định mức + 4 đường luỹ kế quanh
 *  40-55 kWh/tsp, cột cùng cỡ số: để như cũ thì đỉnh cột, nhãn số và các đường
 *  đè nhau. (Không dùng grace: Chart.js tính grace theo khoảng dao động của số,
 *  vd 33-55, chứ không tính từ 0 — cột không xuống thấp được bao nhiêu.) */
function tachCotVaDuong(options) {
    const truc = options.scales.y_secondary;
    if (truc) {
        delete truc.grace;
        truc.min = 0;
        truc.afterDataLimits = function (t) { if (t.max > 0) t.max = t.max * 2.3; };
    }
    return options;
}

/** Tiêu hao quặng chứa sắt: hai đường tô nền (TK3, TK4), không có định mức. */
function drawIronOreConsumeChart(canvasId, labels, dataOreTK3, dataOreTK4, lineFilter = 'all', them = null) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

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
                },
                /* TK1, TK2: biểu đồ vùng như TK3, TK4; vẽ lên trên, nền hơi trong
                   (mauVung) — 4 dây cùng quanh 0,92 t/tsp, nền đặc thì che kín nhau */
                ...datasetDayThem(them, lineFilter, { tenVal: 'Tiêu hao quặng chứa sắt', kieuVal: 'line', vungVal: true, trucVal: 'y_primary', thuTuVal: 0 })
            ],
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế tháng')
    });
}

/** Tiêu hao khí than (CO): cột = tiêu hao ngày TK1 -> TK4 (TK3, TK4 nhấp nháy nếu
 *  vượt định mức), đường = định mức + luỹ kế từng dây: TK3 tím, TK4 cam, TK1 xanh
 *  lá, TK2 đen. */
function drawCOConsumeChart(canvasId, labels, dataCOTK3, dataCOTK4, dataDinhMuc, dataCOTichluyTK3, dataCOTichluyTK4, lineFilter = 'all', them = null) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3  = hienDay(lineFilter, 'TK3');
    const showTK4  = hienDay(lineFilter, 'TK4');

    const cTK3 = getCSS('--primary-blue');
    const cTK4 = getCSS('--secondary-blue');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels : labels || [],
            datasets: xepCotTheoDay([
                {
                    type: 'line', label: 'Định mức', data: dataDinhMuc || [],
                    borderColor: getCSS('--danger-red'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'triangle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK3', data: dataCOTichluyTK3 || [],
                    borderColor: getCSS('--coal-consumeCcd'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: 'Tiêu hao luỹ kế TK4', data: dataCOTichluyTK4 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: getCSS('--white') || '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 3
                    ,hidden: !showTK4
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
                },
                ...datasetDayThem(them, lineFilter, { tenVal: 'Tiêu hao', tenAcc: 'Tiêu hao luỹ kế', thuTuAcc: 3, thuTuVal: 5,
                    mauAcc: { TK1: getCSS('--success-green') || '#27ae60', TK2: '#212121' } })
            ])
        },
        options: getCommonChartOptions('Tiêu hao luỹ kế', 'Tiêu hao theo ngày')
    });

    /* Ghi nhận có cột nào vượt định mức không -> quyết định nhấp nháy. */
    updateTickingList(canvasId, [dataCOTK3, dataCOTK4], dataDinhMuc);
}

/** Tiêu hao hơi nước nóng: cột theo ca của từng dây, một trục. Sheet chưa có
 *  cột định mức / luỹ kế nên không có đường, không nhấp nháy. */
function drawSteamConsumeChart(canvasId, labels, dataTK3, dataTK4, lineFilter = 'all') {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

    const options = getCommonChartOptions('Tiêu hao hơi nước nóng theo ca');
    options.plugins.datalabels.formatter = nhanSoGon;

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: [
                {
                    type: 'bar', label: 'Tiêu hao hơi nước nóng TK3', data: dataTK3 || [],
                    backgroundColor: getCSS('--primary-blue') || '#0033a1',
                    yAxisID: 'y_primary', order: 1, hidden: !showTK3
                },
                {
                    type: 'bar', label: 'Tiêu hao hơi nước nóng TK4', data: dataTK4 || [],
                    backgroundColor: getCSS('--warning-yellow') || '#f39c12',
                    yAxisID: 'y_primary', order: 2, hidden: !showTK4
                }
            ]
        },
        options: options
    });
}

/** Tỉ lệ quặng hồi: cột = tỉ lệ ngày từng dây (TK1 -> TK4), đường = tích luỹ từng
 *  dây: TK3 xanh lá, TK4 cam, TK1 tím, TK2 đen. */
function drawReturnFinesRate(canvasId, labels, dataHoiTK3, dataHoiTK4, dataTichluyTK3, dataTichluyTK4, lineFilter = 'all', them = null) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) return;

    const showTK3 = hienDay(lineFilter, 'TK3');
    const showTK4 = hienDay(lineFilter, 'TK4');

    const cTK3 = getCSS('--primary-blue');
    const cTK4 = getCSS('--secondary-blue');

    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    chartInstances[canvasId] = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: labels || [],
            datasets: xepCotTheoDay([
                {
                    type: 'line', label: 'Tích lũy TK3', data: dataTichluyTK3 || [],
                    borderColor: getCSS('--success-green'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 1
                    ,hidden: !showTK3
                },
                {
                    type: 'line', label: 'Tích lũy TK4', data: dataTichluyTK4 || [],
                    borderColor: getCSS('--warning-yellow'), backgroundColor: '#ffffff',
                    borderWidth: 2, tension: 0.4, pointStyle: 'circle', radius: 4, fill: false, yAxisID: 'y_primary', order: 2
                    ,hidden: !showTK4
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
                },
                ...datasetDayThem(them, lineFilter, { tenVal: 'Tiêu hao ngày', tenAcc: 'Tích lũy', thuTuAcc: 2, thuTuVal: 4 })
            ])
        },
        options: getCommonChartOptions('Tiêu hao lũy kế', 'Tiêu hao ngày')
    });
}
