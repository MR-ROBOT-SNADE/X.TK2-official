/* =============================================================================
 * js/components/Charts/controller/data_merge.js — GHÉP SỐ LIỆU KHI DỮ LIỆU VỀ
 * =============================================================================
 * Phần 2/8 của phần điều khiển biểu đồ (thư mục controller/, trước 24/10/2026 là
 * chart_cook.js) — đọc controller/module_configs.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 * Nghe sự kiện của api_loaded.js. Hẹn 50 ms rồi mới xử lý: TK3 và TK4 thường về
 * sát nhau, gộp hai lần báo thành MỘT lần xử lý cho đỡ tốn CPU.
 * ===========================================================================*/
let hen = 0;

function henXuLy() {
    clearTimeout(hen);
    hen = setTimeout(processAllModulesData, 50);
}
document.addEventListener('TK3DataReady', () => { appState.isTK3Ready = true; henXuLy(); });
document.addEventListener('TK4DataReady', () => { appState.isTK4Ready = true; henXuLy(); });
document.addEventListener('TK1DataReady', () => { appState.isTK1Ready = true; henXuLy(); });
document.addEventListener('TK2DataReady', () => { appState.isTK2Ready = true; henXuLy(); });

/** Nhãn 'dd/mm/yyyy - A' -> [ngày dạng 'yyyy-mm-dd' ('' nếu không đọc được), kíp]. */
function tachNhan(nhan) {
    const s = String(nhan), i = s.lastIndexOf(' - ');
    const ngay = i >= 0 ? s.slice(0, i).trim() : s.trim(), kip = i >= 0 ? s.slice(i + 3).trim() : '';
    const m = ngay.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return [m ? m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0') : '', kip];
}

/** TRỤC CA CHUNG của nhiều nguồn, ghép theo NGÀY + KÍP (thay cho ghép theo vị trí hàng).
 *
 *  dsNhan: [nhãn của nguồn 1, nhãn của nguồn 2, ...] (labels của extractChartData)
 *  Ra: { labels: trục ca chung,
 *        viTri: [mỗi nguồn: mảng "ca thứ i của nguồn -> vị trí trên trục", hoặc
 *                null khi nguồn đó đứng y nguyên vị trí] }
 *
 *  Mỗi ca của mỗi nguồn có khoá (ngày, kíp, lần thứ n của cặp đó trong nguồn —
 *  khối QTK của sheet có 4 hàng mỗi kíp). Hai nguồn cùng khoá = cùng một điểm trên
 *  trục ngang. Nhờ vậy dây nào thiếu ca, thừa ca, nhiều mẫu hơn (phiếu BK) hay bắt
 *  đầu từ tháng khác thì số vẫn rơi đúng ngày, đúng kíp. Trước đây số TK4 được vẽ
 *  vào nhãn TK3 cùng VỊ TRÍ: nạp phiếu BK có số hàng mỗi ngày khác TK3 là số TK4
 *  trượt sang các ngày sau (05/10/2026: số 01-04/10 bị vẽ tới 30/10).
 *
 *  Thứ tự: nguồn đầu (TK3) giữ nguyên thứ tự gốc; ca chỉ nguồn sau mới có thì chèn
 *  ngay sau ca liền trước nó trong chính nguồn đó (cùng ngày), không có thì lên đầu
 *  ngày đó; ngày mới thì chèn đúng chỗ theo lịch.
 *  Lối tắt: mọi nguồn có CÙNG dãy nhãn (đa số khối: hai sheet cùng mẫu hàng) thì
 *  trục = dãy đó, khỏi dò khoá — ra y hệt cách đầy đủ mà nhanh gấp nhiều lần. */
function dungTrucCa(dsNhan) {
    const nhan0 = dsNhan[0];
    const giongNhan0 = function (l) {
        if (l === nhan0) return true;
        if (l.length !== nhan0.length) return false;
        for (let i = 0; i < l.length; i++) if (l[i] !== nhan0[i]) return false;
        return true;
    };
    if (dsNhan.every(giongNhan0)) return { labels: nhan0, viTri: dsNhan.map(function () { return null; }) };

    const nut = new Map();                  /* khoá ca -> { nhan, ngay, sau, vt } */
    const cacNgay = [];                     /* các ngày đã có, tăng dần */
    const dauNgay = new Map(), cuoiNgay = new Map();
    let dau = null;

    /* Nút cuối của ngày gần nhất TRƯỚC ngay (null: chưa có ngày nào trước) */
    const cuoiTruoc = function (ngay) {
        let lo = 0, hi = cacNgay.length;
        while (lo < hi) { const g = (lo + hi) >> 1; if (cacNgay[g] < ngay) lo = g + 1; else hi = g; }
        return lo ? cuoiNgay.get(cacNgay[lo - 1]) : null;
    };
    const chenSau = function (truoc, x) {
        if (truoc) { x.sau = truoc.sau; truoc.sau = x; } else { x.sau = dau; dau = x; }
    };
    const them = function (x, truocCungNgay) {
        if (truocCungNgay) {
            chenSau(truocCungNgay, x);
            if (cuoiNgay.get(x.ngay) === truocCungNgay) cuoiNgay.set(x.ngay, x);
        } else {
            chenSau(cuoiTruoc(x.ngay), x);
            if (!dauNgay.has(x.ngay)) {
                let lo = 0, hi = cacNgay.length;
                while (lo < hi) { const g = (lo + hi) >> 1; if (cacNgay[g] < x.ngay) lo = g + 1; else hi = g; }
                cacNgay.splice(lo, 0, x.ngay);
                cuoiNgay.set(x.ngay, x);
            }
            dauNgay.set(x.ngay, x);
        }
    };

    const daTach = new Map();               /* nhãn -> tachNhan(nhãn): nhãn lặp lại giữa các nguồn */
    const nutCuaNguon = dsNhan.map(function (nhanNguon) {
        const dem = new Map();
        let truoc = null;
        return nhanNguon.map(function (nhan) {
            let t = daTach.get(nhan);
            if (!t) { t = tachNhan(nhan); daTach.set(nhan, t); }
            const ngay = t[0];
            const cap = (ngay || nhan) + '|' + t[1];
            const lan = dem.get(cap) || 0;
            dem.set(cap, lan + 1);
            const khoa = cap + '|' + lan;
            let x = nut.get(khoa);
            if (!x) {
                x = { nhan: nhan, ngay: ngay, sau: null, vt: 0 };
                nut.set(khoa, x);
                them(x, truoc && truoc.ngay === ngay ? truoc : null);
            }
            truoc = x;
            return x;
        });
    });

    const labels = [];
    for (let x = dau; x; x = x.sau) { x.vt = labels.length; labels.push(x.nhan); }
    return { labels: labels, viTri: nutCuaNguon.map(function (ds) { return ds.map(function (x) { return x.vt; }); }) };
}

/** GHÉP NHIỀU NGUỒN lên trục ca chung (dungTrucCa).
 *
 *  nguon: [{ khoa: 'TK3|cột ngày' (tên nguồn, để dùng lại trục),
 *            du: kết quả extractChartData của MỘT dây, MỘT khối,
 *            cot: [[tên cột sheet, khoá trong bộ số liệu ghép], ...] }, ...]
 *  boNho: Map dùng chung trong một lượt processAllModulesData — các mục đọc cùng
 *         bộ nguồn (4 biểu đồ QTK...) dựng trục MỘT lần.
 *  Ra: { labels: [...], <khoá>: [số | null, ...] } — mỗi phần tử ứng với một ca.
 *  Hai nguồn cùng ghi một khoá (đường định mức chung của hai dây): lấy nguồn đầu,
 *  nguồn đầu trống thì lấy nguồn sau. */
function ghepTheoNgayKip(nguon, boNho) {
    const khoaTruc = boNho ? nguon.map(function (n) { return n.khoa; }).join('||') : '';
    let truc = boNho ? boNho.get(khoaTruc) : null;
    if (!truc) {
        truc = dungTrucCa(nguon.map(function (n) { return n.du.labels; }));
        if (boNho) boNho.set(khoaTruc, truc);
    }
    const ra = { labels: truc.labels.slice() };
    nguon.forEach(function (n, s) {
        const vt = truc.viTri[s];
        n.cot.forEach(function (c) {
            const v = n.du[c[0]] || [];
            let dich = ra[c[1]];
            if (!dich) dich = ra[c[1]] = new Array(ra.labels.length).fill(null);
            for (let i = 0; i < v.length; i++) {
                const j = vt ? vt[i] : i;
                if (dich[j] === null && v[i] !== undefined) dich[j] = v[i];
            }
        });
    });
    return ra;
}

/** Ghép số TK3 + TK4 cho MỌI mục moduleConfigs vào window.AppChartData, vẽ lại
 *  trang chủ và khối biểu đồ đang mở. Chỉ chạy khi đã có số liệu CẢ HAI dây.
 *
 *  Với mỗi mục: gom các ô mapping theo (dây, khối) — vai trò đuôi TK3 / TK4 là của
 *  dây đó, vai trò khác (avg) lấy cả hai dây; ô có 'khoi' thì đọc ở khối đó (than
 *  coke nằm ở khối 'chất lượng than_1'), không thì ở khối timeCol của mục. Rồi
 *  ghép theo ngày + kíp (ghepTheoNgayKip): AppChartData[namespaceKey] = { labels, <key>: số... }
 *  Mỗi (dây, khối) chỉ rút MỘT lần bằng extractChartData cho mọi mục cần tới nó,
 *  trục ca của cùng bộ nguồn chỉ dựng một lần — nhanh hơn rút / ghép từng mục. */
function processAllModulesData() {
    if (!appState.isTK3Ready || !appState.isTK4Ready) return;

    /* Dải chỉ số tổng quan trang chủ — đủ cả 2 dây mới tính */
    try { ribbonVe(); } catch (e) { console.error('[Dải chỉ số]', e); }
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    try { veBieuDoSanLuong(); } catch (e) { console.error('[Biểu đồ sản lượng]', e); }

    /* 1) Mỗi mục: các nhóm (dây, khối) cần đọc; gom cột cần rút của từng (dây, khối) */
    const rut = new Map();                  /* 'TK3|cột ngày' -> { dc, timeCol, shiftCol, cot: [cột] } */
    const cacMuc = moduleConfigs.map(mod => {
        const nhom = new Map();             /* 'TK3|cột ngày' -> [[cột, khoá]] */
        DAY_CHUYEN_GHEP.forEach(dc => {
            Object.keys(mod.mapping).forEach(vaiTro => {
                const m = mod.mapping[vaiTro];
                if (!m) return;
                const cuaDc = /TK[1-4]$/.test(vaiTro) ? vaiTro.slice(-3) : null;
                /* Vai trò không đuôi (đường trung bình / định mức chung) chỉ đọc ở
                   TK3, TK4 — sheet TK1, TK2 không có các cột đó */
                if (!cuaDc && DAY_BAT_BUOC.indexOf(dc) < 0) return;
                if (cuaDc && cuaDc !== dc) return;
                const timeCol = m.khoi ? apiV2TenCot('Thời gian', m.khoi) : mod.timeCol;
                const k = dc + '|' + timeCol;
                if (!rut.has(k)) {
                    rut.set(k, { dc, timeCol, shiftCol: m.khoi ? apiV2TenCot('Ca/kíp', m.khoi) : mod.shiftCol, cot: [] });
                }
                const r = rut.get(k);
                [m.sheetCol].concat(m.khoi ? [] : (mod.dataCols || [])).forEach(c => { if (r.cot.indexOf(c) < 0) r.cot.push(c); });
                if (!nhom.has(k)) nhom.set(k, []);
                nhom.get(k).push([m.sheetCol, m.key]);
            });
        });
        return { mod, nhom };
    });
    /* 2) Rút: mỗi (dây, khối) một lần */
    rut.forEach(r => { r.du = extractChartData(window['masterSheetData' + r.dc], r.timeCol, r.shiftCol, r.cot); });
    /* 3) Ghép từng mục; trục ca của cùng bộ nguồn dùng lại (boNho) */
    const boNho = new Map();
    cacMuc.forEach(({ mod, nhom }) => {
        /* TK1, TK2 chưa về / bảng rỗng -> bỏ nguồn đó, vẫn ghép TK3 + TK4 */
        const nguon = [...nhom].map(([k, cot]) => ({ khoa: k, dc: rut.get(k).dc, du: rut.get(k).du, cot }))
            .filter(n => n.du || DAY_BAT_BUOC.indexOf(n.dc) >= 0);
        /* Thiếu số liệu của TK3 hoặc TK4 (bảng rỗng) thì chưa ghép, như trước */
        if (nguon.some(n => !n.du)) return;
        // Gom vào một chỗ (window.AppChartData) thay vì rải biến lên window
        window.AppChartData[mod.namespaceKey] = ghepTheoNgayKip(nguon, boNho);
    });

    console.info("Đã hợp nhất toàn bộ hệ thống biểu đồ vào window.AppChartData");

    ganMotLan();          /* gắn trình nghe — chỉ chạy đúng một lần trong đời trang */
    DieuPhoi.duLieuMoi(); /* vẽ lại khối đang mở (không vẽ tràn lan mọi biểu đồ) */
}
