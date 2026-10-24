/* =============================================================================
 * js/components/Charts/ve/tien_ich.js — TIỆN ÍCH MÀU SẮC + TUỲ CHỌN CHUNG CỦA BIỂU ĐỒ
 * =============================================================================
 * Phần 3/7 của bộ đồ nghề vẽ biểu đồ (thư mục ve/, trước 24/10/2026 là
 * chart_core.js) — đọc ve/chung.js trước để biết cả thư mục.
 * ===========================================================================*/

/** Đọc biến màu CSS khai trong :root (css/base.css), vd getCSS('--danger-red'). */
const getCSS = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
/** Giá trị của ô nhập (input/select) theo id; không có ô -> ''. */
const getUI = (id) => document.getElementById(id) ? document.getElementById(id).value : "";

/* -----------------------------------------------------------------------------
 * TK1, TK2 (XƯỞNG THIÊU KẾT 1) TRÊN BIỂU ĐỒ TIÊU HAO
 *   Vẽ CHUNG với TK3, TK4: thêm cột / đường của TK1, TK2 vào đúng biểu đồ đó
 *   (riêng điện: trang riêng — drawElectricTK12Chart).
 *   Cột: mỗi dây một màu CỐ ĐỊNH trên mọi biểu đồ (MAU_DAY_THEM; TK3, TK4 giữ màu
 *   riêng từng biểu đồ như cũ), xếp TK1 -> TK4 từ trái qua (xepCotTheoDay).
 *   Đường luỹ kế: nét LIỀN như TK3, TK4, mỗi dây một màu khác hẳn 3 đường kia —
 *   màu đường TK3, TK4 mỗi biểu đồ một khác nên hàm vẽ tự chọn cfg.mauAcc cho
 *   TK1, TK2 (mặc định MAU_DUONG_DAY_THEM). Chú giải và khung số liệu khi rê chuột
 *   (tooltip) ở MỌI biểu đồ xếp theo LOẠI, trong mỗi loại theo dây TK1 -> TK4
 *   (soTheoDay): Tiêu hao TK1..TK4, rồi Luỹ kế TK1..TK4, rồi đường chung.
 *   Định mức: đường định mức sẵn có của biểu đồ là của TK3/TK4. Biểu đồ nào biết
 *   định mức RIÊNG của TK1/TK2 (bep/cot_bieu_do.js DINH_MUC_DAY_THEM, vd điện) thì có
 *   thêm đường định mức từng dây (cfg.mauDm) và cột của dây đó nhấp nháy khi
 *   vượt; không biết thì cột TK1/TK2 không nhấp nháy.
 * --------------------------------------------------------------------------- */
const DAY_THEM = ['TK1', 'TK2'];
const MAU_DAY_THEM = { TK1: '#00897b', TK2: '#d81b60' };          /* cột: xanh ngọc, hồng sẫm */
const MAU_DUONG_DAY_THEM = { TK1: '#8e24aa', TK2: '#212121' };    /* đường luỹ kế: tím, đen */

/** Dây chuyền của một dataset theo tên: 'Tiêu hao TK1' -> 'TK1'. Tên không có
 *  dây nào, hoặc ghi nhiều dây ('Định mức TK3, TK4') -> null (đường chung). */
function dayCuaNhan(nhan) {
    const ds = String(nhan || '').match(/TK[1-4]\b/g) || [];
    return ds.length && ds.every(function (x) { return x === ds[0]; }) ? ds[0] : null;
}

/** Cột của biểu đồ nhóm xếp TK1 -> TK2 -> TK3 -> TK4 từ trái qua. Chart.js xếp cột
 *  trong nhóm theo order (nhỏ trước) rồi theo thứ tự dataset, nên đặt lại order
 *  của các cột: order cột nhỏ nhất + 0,1 x số dây — vẫn lớn hơn order các đường
 *  (đường vẽ đè lên cột như cũ). */
function xepCotTheoDay(datasets) {
    const cot = datasets.filter(function (d) { return d.type === 'bar'; });
    if (cot.length < 2) return datasets;
    const goc = Math.min.apply(null, cot.map(function (d) { return d.order || 0; }));
    cot.forEach(function (d) {
        const dc = dayCuaNhan(d.label);
        d.order = goc + (dc ? +dc.slice(2) : 5) / 10;
    });
    return datasets;
}

/** LOẠI của một dataset = tên bỏ phần tên dây:
 *    'Luỹ kế TK3' -> 'Luỹ kế'     '%CaO (Silo 12) - TK4' -> '%CaO (Silo 12)'
 *    'Tiêu hao luỹ kế TK3 (DSX)' -> 'Tiêu hao luỹ kế (DSX)' */
function loaiCuaNhan(nhan) {
    return String(nhan || '').replace(/\s*[-–]?\s*\bTK[1-4]\b/g, '').replace(/\s+/g, ' ').trim();
}

/** Hạng kiểu vẽ: cột 0, đường 1, đường định mức / trung bình 2. */
function hangKieu(d) {
    return d && d.type === 'bar' ? 0 : /định mức|trung bình/i.test((d && d.label) || '') ? 2 : 1;
}

/** Khoá xếp của dataset thứ i trong ds — mảng, so lần lượt từng phần tử:
 *    1) nhóm LOẠI: cột trước, đường sau, đường định mức sau cùng; cùng kiểu thì
 *       loại nào có dataset đứng trước trong biểu đồ xếp trước;
 *    2) trong một loại: theo dây TK1 -> TK2 -> TK3 -> TK4.
 *  Ví dụ: Tiêu hao TK1..TK4, Luỹ kế TK1..TK4, Mức trung bình.
 *  Đường chung (không mang tên đúng một dây: Mức trung bình, Định mức TK3, TK4)
 *  đứng cuối, theo thứ tự dataset. Một loại vừa có cột vừa có đường (vd TK1, TK2
 *  vẽ cột còn TK3, TK4 vẽ đường) vẫn chung một nhóm, xếp theo kiểu "sớm" nhất. */
function khoaTheoDay(ds, i) {
    const d = ds[i], dc = dayCuaNhan(d && d.label);
    if (!dc) return [9, 0, 0, i];
    const loai = loaiCuaNhan(d.label);
    let kieu = 9, dau = i;
    ds.forEach(function (x, j) {
        if (!dayCuaNhan(x.label) || loaiCuaNhan(x.label) !== loai) return;
        kieu = Math.min(kieu, hangKieu(x));
        dau = Math.min(dau, j);
    });
    return [kieu, dau, +dc.slice(2), i];
}

/** So hai mục — ô chú giải, hay dòng trong khung số liệu khi rê chuột (tooltip) —
 *  theo khoaTheoDay. Biểu đồ không có dataset nào mang tên dây (vật tư, cỡ hạt...)
 *  hoặc mục không gắn một dataset (biểu đồ tròn) -> 0: giữ nguyên thứ tự sẵn có.
 *  Chỉ đổi thứ tự HIỆN — bấm chú giải vẫn ẩn / hiện đúng dataset. */
function soTheoDay(a, b, data) {
    const ds = data && data.datasets;
    if (!ds || a.datasetIndex === undefined || b.datasetIndex === undefined) return 0;
    if (!ds.some(function (d) { return dayCuaNhan(d.label); })) return 0;
    const ka = khoaTheoDay(ds, a.datasetIndex), kb = khoaTheoDay(ds, b.datasetIndex);
    for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j] - kb[j];
    return 0;
}

/* ÁP CHO MỌI BIỂU ĐỒ: chú giải và tooltip cùng một thứ tự — theo loại, trong mỗi
   loại TK1 -> TK4. Không có dòng này thì tooltip theo thứ tự LỚP VẼ của Chart.js
   (option "order": đường vẽ trên cột nên đứng trước) -> ra lẫn lộn kiểu "Mức
   trung bình, Luỹ kế TK3, Luỹ kế TK4, Luỹ kế TK1, ..., Tiêu hao TK1...". */
Chart.defaults.plugins.legend.labels.sort = soTheoDay;
Chart.defaults.plugins.tooltip.itemSort = soTheoDay;

/** Màu nền vùng hơi trong của một màu '#rrggbb': '#00897b' -> 'rgba(0,137,123,0.35)' */
function mauVung(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',0.35)';
}

/** Dây dc có hiện với ô "Dây chuyền" đang chọn không:
 *    'all' cả 4 dây · 'TK34' Xưởng Thiêu kết 2 · 'TK12' Xưởng Thiêu kết 1 · 'TK1'..'TK4' một dây */
function hienDay(lineFilter, dc) {
    return lineFilter === 'all' || lineFilter === dc
        || (lineFilter === 'TK34' && (dc === 'TK3' || dc === 'TK4'))
        || (lineFilter === 'TK12' && (dc === 'TK1' || dc === 'TK2'));
}

/** Các dataset của TK1, TK2 để nối vào biểu đồ.
 *    them  { TK1: { val: [số theo ca], acc: [luỹ kế] | null, dm: định mức | null }, TK2: {...} }
 *          (chartConfigs gọi dayThem() trong bep/cot_bieu_do.js để gom)
 *    cfg   tenVal / tenAcc  đầu tên dataset ('Tiêu hao ngày' -> 'Tiêu hao ngày TK1')
 *          kieuVal          'bar' (mặc định) | 'line'
 *          vungVal          (với kieuVal 'line') tô vùng dưới đường, như TK3/TK4
 *          trucVal/trucAcc  trục của số theo ca / luỹ kế (mặc định y_secondary / y_primary);
 *                           đường định mức nằm cùng trục với luỹ kế, như của TK3/TK4
 *          thuTuVal/thuTuAcc  order của Chart.js: số LỚN vẽ trước (nằm dưới)
 *          mauAcc / mauDm   (tuỳ chọn) { TK1: màu, TK2: màu } của đường luỹ kế /
 *                           đường định mức — chọn sao cho khác hẳn đường TK3, TK4
 *                           của biểu đồ đó (mặc định MAU_DUONG_DAY_THEM / đỏ)
 *  Dây không có số nào trong khoảng đang xem thì bỏ hẳn, khỏi rác chú giải.
 *  Luỹ kế TK1/TK2 chỉ có ở những ca Apps Script ghi được số Tổng của file
 *  (apps-script/tk12-nguon.gs) -> spanGaps nối các điểm cho thành đường. */
function datasetDayThem(them, lineFilter, cfg) {
    const ra = [];
    const coSo = (a) => Array.isArray(a) && a.some(v => v !== null && v !== undefined);
    if (!them) return ra;
    DAY_THEM.forEach(function (dc, i) {
        const x = them[dc];
        if (!x) return;
        const mau = MAU_DAY_THEM[dc], hien = hienDay(lineFilter, dc);
        const mauAcc = (cfg.mauAcc && cfg.mauAcc[dc]) || MAU_DUONG_DAY_THEM[dc];
        /* Định mức riêng của dây (hằng số) -> mảng cùng độ dài trục, để vẽ đường
           ngang và để getFlashColor so từng cột */
        const dm = x.dm != null && (x.val || x.acc) ? (x.val || x.acc).map(function () { return x.dm; }) : null;
        if (dm && (coSo(x.val) || coSo(x.acc))) {
            ra.push({
                type: 'line', label: 'Định mức ' + dc, data: dm,
                borderColor: (cfg.mauDm && cfg.mauDm[dc]) || getCSS('--danger-red') || '#e74c3c', backgroundColor: '#ffffff',
                borderWidth: 2, tension: 0, pointStyle: 'triangle', radius: 4, fill: false,
                yAxisID: cfg.trucAcc || 'y_primary', order: 1 + (i + 1) / 10,
                hidden: !hien, datalabels: { display: false }
            });
        }
        if (coSo(x.acc)) {
            ra.push({
                type: 'line', label: cfg.tenAcc + ' ' + dc, data: x.acc,
                borderColor: mauAcc, backgroundColor: '#ffffff',
                borderWidth: 2, tension: 0.4, pointStyle: 'rectRot', radius: 4, fill: false, spanGaps: true,
                yAxisID: cfg.trucAcc || 'y_primary', order: (cfg.thuTuAcc != null ? cfg.thuTuAcc : 3) + (i + 1) / 10,
                hidden: !hien
            });
        }
        if (coSo(x.val)) {
            const laDuong = cfg.kieuVal === 'line', vung = laDuong && !!cfg.vungVal;
            ra.push({
                type: laDuong ? 'line' : 'bar', label: cfg.tenVal + ' ' + dc, data: x.val,
                backgroundColor: laDuong ? (vung ? mauVung(mau) : '#ffffff')
                    : (dm ? function (ctx) { return getFlashColor(ctx, mau, dm); } : mau),
                borderColor: mau,
                borderWidth: laDuong ? 2 : 0, tension: 0.4, pointStyle: 'rectRot', radius: 4, fill: vung,
                yAxisID: cfg.trucVal || 'y_secondary', order: (cfg.thuTuVal != null ? cfg.thuTuVal : 6) + (i + 1) / 10,
                hidden: !hien
            });
        }
    });
    return ra;
}

/** Màu một cột: vượt định mức (avgDataArray tại cùng vị trí) thì nhấp nháy — TK1,
 *  TK2 xanh dương, còn lại (TK3, TK4) đỏ (MAU_NHAY; dây đọc từ tên dataset) — không
 *  thì giữ baseColor. Chart.js gọi hàm này cho từng cột mỗi lần vẽ. */
function getFlashColor(ctx, baseColor, avgDataArray) {
    if (ctx.type !== 'data') return baseColor;
    const avg = avgDataArray && avgDataArray[ctx.dataIndex];
    if (avg && ctx.raw > avg) {
        const mau = DAY_THEM.indexOf(dayCuaNhan(ctx.dataset && ctx.dataset.label)) >= 0 ? MAU_NHAY.TK12 : MAU_NHAY.TK34;
        return isFlashing ? mau[0] : mau[1];
    }
    return baseColor;
}

/** Biến dãy số [a, b, c] thành các "cột nổi" [[a, a], [a, b], [b, c]]: mỗi cột
 *  chạy từ giá trị ca TRƯỚC tới giá trị ca NÀY — nhìn là thấy tăng hay giảm bao
 *  nhiêu. Dùng cho biểu đồ dao động SiO2 (drawQTHChart). */
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

/** Màu cột theo XU HƯỚNG so với ca trước (biểu đồ quặng trung hoà):
 *    - không đổi: xám;
 *    - SiO2: TĂNG là xấu (đỏ), GIẢM là tốt (xanh); đổi > 0,5 thì nhấp nháy;
 *    - chỉ tiêu khác (CaO): TĂNG là tốt (xanh), GIẢM là xấu (đỏ); đổi > 0,1
 *      thì nhấp nháy. */
function getTrendFlashColor(ctx) {
    if (ctx.type !== 'data') return 'rgba(108,177,125,0.8)';

    const currentData = ctx.raw;
    let valCurrent, valPrev;

    if (Array.isArray(currentData)) {
        valPrev = currentData[0];               // cột nổi [trước, nay]
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

/** Tuỳ chọn chung cho biểu đồ kết hợp cột + đường.
 *    yPrimaryTitle       tên trục TRÁI (đường: luỹ kế, định mức...)
 *    ySecondaryTitle     tên trục PHẢI (cột: số theo ngày); null = không có trục phải
 *    isSecondaryVisible  có vẽ lưới của trục phải không
 *  Nhãn số trên cột / điểm chỉ hiện khi biểu đồ có <= 7 ngày (nhiều hơn thì
 *  chữ chồng lên nhau, không đọc được — 09/10/2026 hạ từ 15 xuống 7 khi thêm
 *  TK1, TK2: 4 dây x 2 ca x 15 ngày là quá dày). Dây TK4, TK2 đặt nhãn phía
 *  dưới, TK3, TK1 phía trên, để hai nhãn không đè nhau. Có hơn 2 cột / đường
 *  cùng kiểu đang hiện thì nhãn nào đè nhãn khác được tự ẩn ('auto'). */
function getCommonChartOptions(yPrimaryTitle, ySecondaryTitle = null, isSecondaryVisible = true) {

    /* Đếm số ngày MỘT LẦN cho mỗi mảng nhãn, thay vì mỗi nhãn mỗi khung hình. */
    const NGUONG_HIEN_NHAN = 7;    // trên bao nhiêu ngày thì thôi hiện nhãn số
    let nhanCu = null;
    let ketQua = true;

    function nenHienNhan(chart) {
        const nhan = chart.data.labels || [];

        if (nhan !== nhanCu) {
            nhanCu = nhan;
            /* Nhãn dạng '01/10/2026 - A' -> lấy phần ngày, đếm số ngày khác nhau */
            ketQua = new Set(nhan.map(l => String(l).split(' - ')[0].trim()))
                        .size <= NGUONG_HIEN_NHAN;
        }
        return ketQua;
    }
    let scales = {
        y_primary : { type: 'linear', position: 'left', title: { display: true, text: yPrimaryTitle }, grace: '5%', min : 0.00 }
    }

    if (ySecondaryTitle) {
        /* grace 70%: chừa khoảng trống phía trên cột, để cột không đè lên đường */
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
                /* Biểu đồ kiểu 'bar' chỉ ghi nhãn trên CỘT; kiểu 'line' chỉ ghi trên ĐƯỜNG */
                display: (ctx) => {
                    if (!nenHienNhan(ctx.chart)) return false;
                    if (ctx.dataset.datalabels && ctx.dataset.datalabels.display === false) return false;
                    const datasetType = ctx.dataset.type || ctx.chart.config.type;
                    const kieuGhi = ctx.chart.config.type === 'bar' ? 'bar' : 'line';
                    if (datasetType !== kieuGhi) return false;
                    const cungKieu = ctx.chart.data.datasets.filter((d, i) =>
                        (d.type || ctx.chart.config.type) === kieuGhi && ctx.chart.isDatasetVisible(i)).length;
                    return cungKieu > 2 ? 'auto' : true;
                },
                align: (ctx) => /TK[24]\b/.test(ctx.dataset.label) ? 'bottom' : 'top', anchor: 'end', offset: 8,
                backgroundColor: 'rgba(255, 255, 255, 0.85)', borderRadius: 3, padding: { top: 2, bottom: 2, left: 4, right: 4 },
                font: { weight: 'bold', size: 10, family: 'Roboto'}
            },
            legend: {
                display: true, position: 'top',
                labels: {
                    usePointStyle: true, boxWidth: 30, boxHeight: 20,
                    /* Tự dựng ô chú giải: màu cột có thể là HÀM (nhấp nháy) nên phải
                       gọi thử để lấy màu gốc; đường hiện dạng gạch, cột dạng ô vuông */
                    generateLabels: function(chart) {
                        return chart.data.datasets.map(function(dataset, i) {
                            let bgColor = typeof dataset.backgroundColor === 'function' ? dataset.backgroundColor({type: 'legend'}) : dataset.backgroundColor;
                            let borderColor = dataset.borderColor || bgColor;
                            /* chuGiaiDiem: đường hiện bằng ĐIỂM của nó (tròn / tam
                               giác...) thay vì gạch — khi điểm mới phân biệt được hai
                               đường cùng màu (drawFluxSplitChart) */
                            const laDuong = dataset.type === 'line';
                            return {
                                text: dataset.label, fillStyle: bgColor, strokeStyle: borderColor,
                                lineDash: dataset.borderDash,   /* đường nét đứt -> ô chú giải cũng nét đứt */
                                lineWidth: laDuong ? (dataset.borderWidth || 2) : 0,
                                hidden: !chart.isDatasetVisible(i),
                                pointStyle: laDuong ? (dataset.chuGiaiDiem ? dataset.pointStyle : 'line') : 'rect',
                                datasetIndex: i
                            };
                        });
                    }
                }
            }
        }
    }
}


/** Tuỳ chọn cho biểu đồ cột cỡ hạt than: tiêu đề, trục % (0-100), nhãn % trên
 *  đầu mỗi cột, chú giải phía dưới. */
function getCoHatChartOptions(titleText) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, max: 100, title: { display: true, text: '%' } },
        },
        plugins: {
            title: {
                display: true,
                text: titleText,
                font: { size: 14, weight: 'bold', family: 'Arial' },
                color: getCSS('--text-color') || '#333333',
                padding: { bottom: 15 }
            },
            datalabels: {
                anchor: 'end', align: 'top', offset: 2,
                color: getCSS('--text-color') || '#333333',
                font: { weight: 'bold', size: 12 },
                formatter: (val) => val === null || val === undefined ? '' : `${val}%`,
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
