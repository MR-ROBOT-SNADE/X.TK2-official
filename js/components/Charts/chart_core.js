/* =============================================================================
 * js/components/Charts/chart_core.js — "BỘ ĐỒ NGHỀ" VẼ BIỂU ĐỒ (Chart.js)
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Chứa các hàm DÙNG CHUNG để biến số liệu bảng tính thành biểu đồ:
 *     1) Nhấp nháy cột vượt định mức           updateTickingList, chinhNhipNhay
 *     2) Tuỳ chọn chung cho biểu đồ            getCommonChartOptions, getCoHatChartOptions
 *     3) Rút số liệu khỏi bảng tính            extractChartData
 *     4) Lọc theo ngày / ca                    smartFilter
 *     5) Các hàm vẽ từng kiểu biểu đồ          drawCoalConsumeChart ... drawUniversalComboChart
 *   File này KHÔNG tự vẽ gì khi nạp. chart_cook.js mới là nơi quyết định vẽ biểu
 *   đồ nào, lúc nào, bằng số liệu nào — rồi gọi các hàm ở đây.
 *
 * ĐƯỜNG ĐI CỦA MỘT BIỂU ĐỒ
 *   bảng tính (window.masterSheetDataTK3 / TK4)
 *     -> extractChartData()  rút các cột cần: { labels: ['01/10/2026 - A', ...], 'tên cột': [số...] }
 *     -> smartFilter()       giữ 7 ngày gần nhất có số, hoặc theo ô Từ ngày / Đến ngày + ca
 *     -> draw...Chart()      dựng biểu đồ Chart.js trên thẻ <canvas id="...">
 *
 * QUY ƯỚC CHUNG CỦA CÁC HÀM draw...
 *   - canvasId: id thẻ <canvas> trong index.html. Không thấy canvas thì thôi.
 *   - Biểu đồ cũ trên cùng canvas bị huỷ (destroy) trước khi vẽ mới — Chart.js
 *     không cho hai biểu đồ dùng chung một canvas.
 *   - chartInstances[canvasId] giữ biểu đồ đang vẽ (để huỷ / cập nhật về sau).
 *   - lineFilter 'all' | 'TK3' | 'TK4': ẩn dây không chọn. Dây bị ẩn vẫn còn
 *     trong chú giải (gạch ngang) — bấm vào chú giải để hiện lại.
 *   - Biểu đồ kết hợp: CỘT (bar) = số theo ngày / ca, trục PHẢI (y_secondary);
 *     ĐƯỜNG (line) = luỹ kế / định mức / trung bình, trục TRÁI (y_primary).
 *
 * NẠP SAU: Chart.js + chartjs-plugin-datalabels (CDN) và js/chung/chi_so.js.
 * ===========================================================================*/

/* Bật plugin hiện nhãn số ngay trên cột / điểm cho MỌI biểu đồ */
Chart.register(ChartDataLabels);
/* chartInstances: canvasId -> biểu đồ Chart.js đang vẽ.
   isFlashing: nhịp nhấp nháy hiện tại (đổi mỗi 500 ms) — xem getFlashColor. */
let chartInstances = {}, isFlashing = false;


/* =============================================================================
 * 1. NHẤP NHÁY CỘT VƯỢT ĐỊNH MỨC
 * -----------------------------------------------------------------------------
 * Cột nào cao hơn đường định mức thì nhấp nháy: TK3, TK4 màu ĐỎ, TK1, TK2 màu XANH
 * DƯƠNG (MAU_NHAY). Cách làm: một bộ hẹn giờ 500 ms đảo biến isFlashing rồi vẽ lại
 * các biểu đồ cần nhấp nháy; hàm màu getFlashColor đọc isFlashing để chọn nhịp đậm
 * / nhịp nhạt.
 *
 * Để không tốn pin / CPU:
 *   - chỉ vẽ lại biểu đồ vừa ĐANG MỞ vừa THỰC SỰ có cột vượt — bình thường là
 *     không có cái nào, và khi đó bộ hẹn giờ không tồn tại (không phải "chạy
 *     rồi thoát sớm");
 *   - chuyển sang tab khác là dừng hẳn bộ hẹn giờ.
 * (Bản cũ vẽ lại TOÀN BỘ 21 biểu đồ mỗi 500 ms, kể cả 19 cái đang bị ẩn.)
 *
 * "Khối nào đang mở" do DieuPhoi trong chart_cook.js nắm giữ (một nguồn duy
 * nhất). Ở đây không tự dò bằng offsetParent — đọc offsetParent trong vòng nhịp
 * là bắt trình duyệt tính lại bố cục, đúng thứ đang cần tránh.
 * ===========================================================================*/
const canhBaoVuot = new Set();   // canvasId đang có cột vượt định mức
let idNhipNhay = null;           // id của setInterval, null = đang không nhấp nháy
/* Màu cột vượt định mức / mức trung bình theo dây: [nhịp đậm, nhịp nhạt].
   15/10/2026: TK1, TK2 nháy XANH DƯƠNG để khỏi lẫn với nhịp đỏ nhạt của TK3, TK4
   (đỏ nhạt trông gần như cột hồng của TK2). Cột TK1, TK2 chỉ nhấp nháy ở biểu đồ
   có định mức riêng của dây đó (điện — trang TK1, TK2), không có cột xanh lam
   TK3, TK4 đứng cạnh nên xanh dương không bị lẫn. */
const MAU_NHAY = {
    TK34: ['rgba(255,0,0,0.9)', 'rgba(255,0,0,0.3)'],
    TK12: ['rgba(30,136,229,0.9)', 'rgba(30,136,229,0.3)']
};

/** Gọi ngay sau mỗi lần vẽ một biểu đồ có định mức: ghi nhận biểu đồ đó có cột
 *  nào vượt không, rồi bật / tắt bộ nhấp nháy cho phù hợp.
 *  cacDay: mảng các mảng giá trị cột (vd [số TK3, số TK4]).
 *  dinhMuc: mảng định mức, cùng vị trí với giá trị.
 *  them: (tuỳ chọn) số TK1/TK2 kèm định mức riêng { TK1: { val, dm }, ... } —
 *        xem datasetDayThem; dây không có dm thì không xét. */
function updateTickingList(canvasId, cacDay, dinhMuc, them) {
    const day = Array.isArray(cacDay) && Array.isArray(cacDay[0]) ? cacDay : [cacDay];
    const vuot = (!!dinhMuc && day.some(function (m) {
        return m && m.some(function (v, i) {
            return v != null && dinhMuc[i] != null && Number(v) > Number(dinhMuc[i]);
        });
    })) || (!!them && DAY_THEM.some(function (dc) {
        const x = them[dc];
        return !!x && x.dm != null && Array.isArray(x.val) && x.val.some(function (v) { return v != null && Number(v) > Number(x.dm); });
    }));
    if (vuot) canhBaoVuot.add(canvasId); else canhBaoVuot.delete(canvasId);
    chinhNhipNhay();
}

/** Danh sách canvas cần nhấp nháy NGAY LÚC NÀY = (đang mở) ∩ (có cột vượt).
 *  Tab đang ẩn -> rỗng. */
function canvasCanNhay() {
    if (document.hidden || canhBaoVuot.size === 0) return [];
    /* Chưa có DieuPhoi (thứ tự script đổi, hoặc đang thử lẻ) -> không đoán bừa,
       cứ nhấp nháy mọi biểu đồ có cảnh báo. An toàn hơn là im lặng bỏ sót. */
    const dangMo = (window.DieuPhoi && window.DieuPhoi.canvasDangMo)
        ? window.DieuPhoi.canvasDangMo() : null;
    if (!dangMo) return Array.from(canhBaoVuot);
    return dangMo.filter(function (id) { return canhBaoVuot.has(id); });
}

/** Bật bộ hẹn giờ nhấp nháy nếu có việc, tắt nếu hết việc. Gọi được bao nhiêu
 *  lần cũng được (DieuPhoi gọi mỗi khi đổi khối đang mở). */
function chinhNhipNhay() {
    const can = canvasCanNhay().length > 0;
    if (can && !idNhipNhay) {
        idNhipNhay = setInterval(function () {
            const ds = canvasCanNhay();
            if (!ds.length) { chinhNhipNhay(); return; }   // hết việc -> tự tắt
            isFlashing = !isFlashing;
            ds.forEach(function (id) {
                const c = chartInstances[id];
                if (c) c.update('none');                  // 'none' = vẽ lại không hiệu ứng
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

/* =============================================================================
 * 2. TIỆN ÍCH MÀU SẮC + TUỲ CHỌN CHUNG CỦA BIỂU ĐỒ
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
 *   định mức RIÊNG của TK1/TK2 (chart_cook.js DINH_MUC_DAY_THEM, vd điện) thì có
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
 *          (chartConfigs gọi dayThem() trong chart_cook.js để gom)
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

/* =============================================================================
 * 3. RÚT SỐ LIỆU KHỎI BẢNG TÍNH
 * ===========================================================================*/

/** Rút các cột cần vẽ của MỘT khối khỏi bảng tính.
 *
 *  dataSource  mảng hàng (window.masterSheetDataTK3...)
 *  timeCol     cột ngày của khối, vd 'Thời gian (Điện)'
 *  shiftCol    cột ca/kíp của khối, vd 'Ca/kíp (Điện)'
 *  dataCols    các cột số liệu cần lấy
 *
 *  Ra: { labels: ['01/10/2026 - A', '01/10/2026 - B', ...],
 *        'tên cột 1': [số | null, ...], ... }   — mỗi phần tử ứng với một ca.
 *  Hàng không có Ca/kíp thì bỏ. Ô trống / không phải số -> null (biểu đồ để
 *  trống chỗ đó thay vì vẽ số 0 giả).
 *
 *  Ô ngày trong sheet là ô GỘP: chỉ hàng đầu của mỗi ngày có ngày, các hàng sau
 *  để trống -> nhớ ngày gần nhất (curDate) rồi dùng tiếp.
 *  Cách đọc số ở đây đơn giản: chỉ đổi dấu phẩy ĐẦU TIÊN thành chấm (đủ cho các
 *  cột biểu đồ). Dải chỉ số và cảnh báo dùng sheetNumber() chặt chẽ hơn. */
function extractChartData(dataSource, timeCol, shiftCol, dataCols) {
    if (!dataSource?.length) return null;
    let res = { labels: [] };
    dataCols.forEach(c => res[c] = []);

    let curDate = "";
    dataSource.forEach(row => {
        /* Đọc ngày TRƯỚC, bỏ hàng thiếu ca SAU. Làm ngược lại thì hàng mở đầu
           một ngày mà quên điền Ca/kíp làm mất luôn ngày đó: TK3 khối QTK hàng
           361 ghi 16/05/2026 nhưng trống Ca/kíp, nên 4 mẫu kíp A của 16/05 từng
           bị vẽ thành 15/05. db/chuan-hoa.mjs đọc theo đúng thứ tự này. */
        if (row[timeCol]?.trim()) curDate = row[timeCol];
        if (!row[shiftCol]) return;
        res.labels.push(`${curDate} - ${row[shiftCol]}`);

        // Đọc số; trống hoặc không phải số -> null để biểu đồ không bị vỡ
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

/* =============================================================================
 * 4. LỌC THEO NGÀY / CA
 * ===========================================================================*/

/** Lọc kết quả extractChartData theo ô lọc trên giao diện.
 *
 *  data          { labels, cột... } (từ extractChartData, có thể đã gộp TK3+TK4)
 *  primaryKey    (không dùng — giữ cho khớp chỗ gọi cũ)
 *  startId/endId id ô "Từ ngày" / "Đến ngày"
 *  shiftId       id ô chọn ca/kíp ('all' = mọi ca)
 *  defaultDays   số ngày lấy khi KHÔNG lọc ngày (mặc định 7)
 *
 *  Hai chế độ:
 *    - CÓ lọc ngày: giữ các ca nằm trong khoảng [Từ ngày, Đến ngày].
 *    - KHÔNG lọc ngày: tìm ca CUỐI CÙNG có số liệu thật (> 0, bỏ qua các cột
 *      luỹ kế / trung bình / định mức / DSX vì chúng có số sẵn cả tháng), rồi
 *      lấy 7 ngày tính ngược từ đó. Nhờ vậy khối có số liệu đã ngừng từ lâu vẫn
 *      hiện 7 ngày cuối có số, không phải 7 ngày trống.
 *  Sau đó lọc thêm theo ca nếu có chọn.
 *  Ra: { labels, cột..., isDateFiltered } hoặc null nếu không có dữ liệu. */
function smartFilter(data, primaryKey, startId, endId, shiftId, defaultDays = 7) {
    if (!data?.labels.length) return null;

    // Lấy giá trị từ các ô lọc
    const start = getUI(startId), end = getUI(endId), shift = getUI(shiftId) || "all";

    // Người xem CÓ lọc theo ngày hay không
    const hasDateFilter = start !== "" || end !== "";

    // Không lọc ngày: tìm ca cuối cùng có số liệu thật làm mốc
    let lastActiveIndex = data.labels.length - 1;
    if (!hasDateFilter) {
        for (let i = data.labels.length - 1; i >= 0; i--) {
            // Chỉ xét các cột số liệu THEO NGÀY (bỏ luỹ kế, trung bình, định mức, DSX)
            const hasAnyDailyData = Object.keys(data).some(k => {
                const isDailyDataColumn = !k.toLowerCase().includes('tichluy') &&
                                          !k.toLowerCase().includes('trungbinh') &&
                                          !k.toLowerCase().includes('dinhmuc') &&
                                          !k.toLowerCase().includes('dsx') &&
                                          k !== 'labels' && k !== 'isDateFiltered';

                return isDailyDataColumn && data[k] && data[k][i] > 0;
            });

            // Gặp ca có dữ liệu đầu tiên (đi từ dưới lên) thì cắm mốc và dừng
            if (hasAnyDailyData) {
                lastActiveIndex = i;
                break;
            }
        }
    }

    /* 7 ngày khác nhau cuối cùng tính tới mốc, vd ['24/09/2026', ..., '30/09/2026'] */
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
        /* 'dd/mm/yyyy' -> 'yyyy-mm-dd' -> mốc thời gian để so với ô lọc */
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

    return res;
}

/* =============================================================================
 * 5. CÁC HÀM VẼ TỪNG KIỂU BIỂU ĐỒ
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
 *            của dây (TK1 55, TK2 44 kWh/tsp — chart_cook.js DINH_MUC_DAY_THEM)
 *    đường = luỹ kế (hàng Tổng sheet 3 của file): TK1 cam, TK2 xanh lá — như TK3,
 *            TK4 ở trang 1; định mức: TK1 đỏ, TK2 tím. Mọi đường nét liền.
 *  TK1, TK2 chỉ có một cách tính luỹ kế (không có DSX) -> ô "Loại điện luỹ kế"
 *  không áp dụng (chart_cook.js ẩn ô đó khi đang ở trang này).
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
   trong bộ số liệu CoHatThan (chart_cook.js): cột sheet tên "< 0,5mm" / "0,5-3mm"
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
