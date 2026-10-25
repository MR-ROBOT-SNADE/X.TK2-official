/* =============================================================================
 * js/components/Charts/controller/production.js — MỤC "SẢN LƯỢNG": THẺ CHỈ SỐ + BIỂU ĐỒ THÁNG
 * =============================================================================
 * Phần 8/8 của phần điều khiển biểu đồ (thư mục controller/, trước 24/10/2026 là
 * chart_cook.js) — đọc controller/module_configs.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 * MỤC "SẢN LƯỢNG" (#san-luong-theo-thang) — các thẻ chỉ số tháng này
 *   Kế hoạch | Thực tế | % đạt (+ thanh tiến độ, dòng nhận xét)
 *   + 2 thẻ hệ số lợi dụng, mỗi dây một thẻ (JS tự dựng thêm, index.html không có sẵn)
 * Thẻ đi theo TRANG đang xem của biểu đồ sản lượng bên dưới (‹ ›, SL_TRANG):
 *   trang Xưởng TK2: ribbonTinh() — số luôn khớp dải chỉ số trang chủ (cùng cột,
 *                    cùng cách cộng từ ngày 01 tới hôm nay, cùng gộp TK3 + TK4);
 *   trang Xưởng TK1: cùng hàm tinhRibbon trên số liệu TK1 + TK2.
 * Góc phải dưới mỗi thẻ có nhãn mờ X.TK2 / X.TK1 (data-xuong, CSS) cho biết đang
 * xem xưởng nào.
 * -------------------------------------------------------------------------- */

/** Ghi chữ vào một ô theo id. */
function kpiGhi(id, chuoi) {
    const el = document.getElementById(id);
    if (el) el.textContent = chuoi;
}

/** Số -> chữ kiểu Việt với `le` số lẻ; không có số -> '--'. */
const kpiSo = function (v, le) {
    return (v === null || !isFinite(v)) ? '--'
        : v.toLocaleString('vi-VN', { minimumFractionDigits: le, maximumFractionDigits: le });
};

/** Chỉ số tháng này của một trang biểu đồ sản lượng (phần tử của SL_TRANG):
 *    trang TK3 + TK4 -> ribbonTinh() (bản máy chủ tính sẵn nếu có);
 *    trang TK1 + TK2 -> tinhRibbon trên số liệu đang có của hai dây đó.
 *  Kết quả tinhRibbon đặt tên hệ số theo VỊ TRÍ: tk3 = dây đầu, tk4 = dây sau của
 *  trang (trang TK1 + TK2: tk3 là TK1, tk4 là TK2). Chưa có số liệu -> null. */
function slChiSoTrang(trang) {
    if (trang.day[0] === 'TK3') return ribbonTinh();
    const a = window['masterSheetData' + trang.day[0]] || [];
    const b = window['masterSheetData' + trang.day[1]] || [];
    if (!a.length && !b.length) return null;
    return tinhRibbon(a, b, new Date());
}

/** Dựng khung thẻ hệ số lợi dụng thứ `so` (1, 2 — dây đầu / dây sau của trang
 *  đang xem; id kpi-heso-<so>). Có rồi thì thôi — gọi lại nhiều lần không đẻ thêm
 *  thẻ. Tên dây trên tiêu đề do kpiVe ghi theo trang. */
function kpiDungTheHeSo(grid, so) {
    if (document.getElementById('kpi-heso-' + so)) return;
    const card = document.createElement('div');
    card.className = 'kpi-card kpi-card--heso';
    card.innerHTML = '<h3 id="kpi-heso-' + so + '-ten">Hệ số lợi dụng</h3>'
        + '<div id="kpi-heso-' + so + '" class="kpi-value heso">--'
        + '<span class="kpi-unit">t/m²·h</span></div>'
        + '<div id="kpi-heso-' + so + '-note" class="kpi-trend">Đang cập nhật...</div>';
    grid.appendChild(card);
}

/** Đổ số vào một thẻ hệ số lợi dụng, kèm dòng giải thích phép tính hoặc lý do lỗi.
 *  chuCho: trang chưa có số liệu -> '--' kèm dòng chữ này, KHÔNG tô đỏ như số sai. */
function kpiVeMotHeSo(ma, d, chuCho) {
    const R = RIBBON_CFG.lamTron;
    const kt = chuCho ? { ok: true, loi: '' } : kiemTraHeSoLoiDung(d ? d.heSo : null);

    const el = document.getElementById('kpi-heso-' + ma);
    if (el) {
        el.textContent = kpiSo(d ? d.heSo : null, R.heSo);
        const u = document.createElement('span');
        u.className = 'kpi-unit';
        u.textContent = 't/m²·h';
        el.appendChild(u);
        el.classList.toggle('is-loi', !kt.ok);
    }

    const note = document.getElementById('kpi-heso-' + ma + '-note');
    if (note) {
        note.textContent = chuCho || (kt.ok ? (d ? d.moTaMauSo : '') : kt.loi);
        note.className = 'kpi-trend' + (kt.ok ? '' : ' is-cham');
    }
}

/** Vẽ mục Sản lượng cho xưởng đang xem: sắp lại thẻ, dựng thẻ hệ số, nhãn xưởng,
 *  đổ số, thanh tiến độ, nhận xét. */
function kpiVe() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec) return;

    /* Sửa bố cục: index.html để 2 trong 3 thẻ NẰM NGOÀI lưới .kpi-grid nên hàng
       bị vỡ, thẻ tràn hết bề ngang -> gom hết vào lưới cho ngay ngắn. */
    const grid = sec.querySelector('.kpi-grid');
    if (grid) {
        sec.querySelectorAll(':scope > .kpi-card').forEach(function (c) { grid.appendChild(c); });
    }

    /* Thẻ HỆ SỐ LỢI DỤNG: TÁCH RIÊNG TK3 VÀ TK4.
       Bản cũ gộp một thẻ: lấy sản lượng của CẢ HAI dây chia cho diện tích của
       MỘT máy (360 m²) nên con số phình lên gần gấp đôi — 2,135 t/m²·h trong
       khi trần kỹ thuật chỉ 1,5. Dọn thẻ cũ (#kpi-heso) rồi dựng hai thẻ mới. */
    const theCu = document.getElementById('kpi-heso');
    if (theCu && theCu.closest) {
        const khungCu = theCu.closest('.kpi-card');
        if (khungCu) khungCu.remove();
    }
    const trang = SL_TRANG[TRANG_DANG_XEM.sanLuong || 0];
    if (grid) {
        kpiDungTheHeSo(grid, 1);
        kpiDungTheHeSo(grid, 2);
        /* Nhãn mờ góc phải dưới mọi thẻ (CSS .kpi-card[data-xuong]) */
        grid.querySelectorAll('.kpi-card').forEach(function (c) { c.setAttribute('data-xuong', trang.nhan); });
    }
    trang.ten.forEach(function (ten, i) { kpiGhi('kpi-heso-' + (i + 1) + '-ten', 'Hệ số lợi dụng ' + ten); });

    const kq = slChiSoTrang(trang);
    if (!kq) {
        /* Xưởng đang xem chưa có số (TK1/TK2 chưa tải xong, đầu tháng chưa nhập):
           xoá số của xưởng kia, kẻo nhãn X.TK1 đứng cạnh số của X.TK2 */
        const chu = trang.day.some(function (d) { return appState['is' + d + 'Ready']; })
            ? 'Chưa có số liệu tháng này' : 'Đang cập nhật...';
        kpiGhi('kpi-target', '--');
        kpiGhi('kpi-actual', '--');
        kpiGhi('kpi-percen', '--%');
        const bar0 = document.getElementById('kpi-progress-bar');
        if (bar0) { bar0.style.width = '0%'; bar0.classList.remove('is-vuot'); }
        const trend0 = document.getElementById('kpi-trend');
        if (trend0) { trend0.textContent = chu; trend0.className = 'kpi-trend'; }
        kpiVeMotHeSo(1, null, chu);
        kpiVeMotHeSo(2, null, chu);
        return;
    }

    const R = RIBBON_CFG.lamTron;
    kpiGhi('kpi-target', kpiSo(kq.tongKH || null, 0));
    kpiGhi('kpi-actual', kpiSo(kq.tongSL, R.sanLuong));
    kpiGhi('kpi-percen', kq.dat === null ? '--%' : kpiSo(kq.dat, R.dat) + '%');

    /* Thanh tiến độ: chặn trong 0..100% để không tràn khung khi vượt kế hoạch */
    const bar = document.getElementById('kpi-progress-bar');
    if (bar) {
        const pct = kq.dat === null ? 0 : Math.max(0, Math.min(100, kq.dat));
        bar.style.width = pct.toFixed(1) + '%';
        bar.classList.toggle('is-vuot', kq.dat !== null && kq.dat >= 100);
    }

    /* Dòng nhận xét: so sản lượng thực tế với TIẾN ĐỘ ĐÁNG LẼ phải đạt tới hôm
       nay (= kế hoạch tháng x số ngày đã qua / số ngày của tháng), chứ không so
       với kế hoạch cả tháng — như vậy giữa tháng mới có ý nghĩa. */
    const el = document.getElementById('kpi-trend');
    if (el) {
        if (!kq.tongKH) {
            el.textContent = 'Chưa có sản lượng kế hoạch trong bảng tính';
            el.className = 'kpi-trend';
        } else {
            const ngayTrongThang = soNgayTrongThang(kq.thang, kq.nam);
            const homNay = new Date().getDate();
            const dangLe = kq.tongKH * (homNay / ngayTrongThang);
            const lech = dangLe > 0 ? ((kq.tongSL - dangLe) / dangLe) * 100 : 0;
            const dat = lech >= 0;
            el.textContent = 'Đến hết ngày ' + homNay + '/' + kq.thang + ' — '
                + (dat ? 'vượt tiến độ ' : 'chậm tiến độ ')
                + Math.abs(lech).toFixed(1) + '% (đáng lẽ '
                + Math.round(dangLe).toLocaleString('vi-VN') + ' tấn)';
            el.className = 'kpi-trend ' + (dat ? 'is-tot' : 'is-cham');
        }
    }

    /* Hệ số lợi dụng: mỗi dây một thẻ, kèm kết quả kiểm tra hợp lệ (tk3 / tk4 =
       dây đầu / dây sau của trang — xem slChiSoTrang) */
    kpiVeMotHeSo(1, kq.tk3);
    kpiVeMotHeSo(2, kq.tk4);
}

/* -----------------------------------------------------------------------------
 * BIỂU ĐỒ SẢN LƯỢNG THÁNG NÀY (dưới các thẻ của mục SẢN LƯỢNG)
 *   - CỘT      : sản lượng TỪNG NGÀY của hai dây (cộng các ca trong ngày)
 *   - ĐƯỜNG    : luỹ kế cả xưởng, cộng dồn từ ngày 01 tới hôm nay
 *   - ĐƯỜNG ĐỎ : mục tiêu (sản lượng kế hoạch tháng của cả 2 dây)
 *
 * HAI TRANG, mỗi xưởng một trang — KHÔNG gộp chung; mũi tên ‹ › hai bên khung đổi
 * trang như biểu đồ vôi / dolomite (trang đang xem được nhớ: TRANG_DANG_XEM.sanLuong).
 * Lật trang là các thẻ chỉ số phía trên (kpiVe) đổi theo xưởng đó:
 *   trang 1  Xưởng Thiêu kết 2: TK3 + TK4
 *   trang 2  Xưởng Thiêu kết 1: TK1 + TK2 — kế hoạch tháng và giờ dừng lấy từ sheet
 *            "Báo cáo" của 2 file nguồn (apps-script/tk12-nguon.gs, từ 21/10/2026)
 *
 * HAI TRỤC là bắt buộc: cột mỗi ngày ~18 nghìn tấn, còn luỹ kế lên tới hơn 600
 * nghìn — để chung một trục thì mấy cột bẹp dí thành một vạch sát đáy.
 *   trục TRÁI  : sản lượng ngày (cột)
 *   trục PHẢI  : luỹ kế + mục tiêu (đường)
 *
 * Không có bộ chọn ngày: luôn hiển thị tháng hiện tại, từ ngày 01 tới hôm nay.
 * -------------------------------------------------------------------------- */

let slChartInstance = null;      /* biểu đồ sản lượng đang vẽ (để huỷ khi vẽ lại) */

/* Các trang của biểu đồ sản lượng (số trang phải bằng SO_TRANG_SAN_LUONG).
   nhan: nhãn mờ góc phải dưới các thẻ chỉ số khi đang xem trang đó */
const SL_TRANG = [
    { xuong: 'XƯỞNG THIÊU KẾT 2', nhan: 'X.TK2', day: ['TK3', 'TK4'], ten: ['Thiêu kết 3', 'Thiêu kết 4'],
      mau: ['rgba(26,79,214,.85)', 'rgba(243,156,18,.85)'] },
    { xuong: 'XƯỞNG THIÊU KẾT 1', nhan: 'X.TK1', day: ['TK1', 'TK2'], ten: ['Thiêu kết 1', 'Thiêu kết 2'],
      mau: [MAU_DAY_THEM.TK1, MAU_DAY_THEM.TK2] },
];

/** Nút ‹ (buoc -1) / › (buoc 1) của biểu đồ sản lượng: sang xưởng kia, nhớ trang,
 *  vẽ lại biểu đồ và các thẻ chỉ số phía trên theo xưởng mới. */
function latTrangSanLuong(buoc) {
    const n = SL_TRANG.length;
    TRANG_DANG_XEM.sanLuong = (((TRANG_DANG_XEM.sanLuong || 0) + buoc) % n + n) % n;
    ghiTrangDaNho();
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    veBieuDoSanLuong();
}

function veBieuDoSanLuong() {
    const sec = document.getElementById('san-luong-theo-thang');
    if (!sec || typeof Chart === 'undefined') return;

    /* Tạo sẵn khung vẽ nếu index.html chưa có — khỏi phải sửa HTML. Khung lật
       trang dùng lại đúng các lớp .lat-khung / .lat-nut / .lat-cham của biểu đồ vôi */
    let box = document.getElementById('sanluong-chart-box');
    if (!box) {
        const khung = document.createElement('div');
        khung.className = 'lat-khung';
        khung.id = 'lat-sanLuong';
        khung.innerHTML = '<button type="button" class="lat-nut lat-nut--trai" data-page-step="-1" aria-label="Xưởng trước">&#8249;</button>'
            + '<div id="sanluong-chart-box" class="chart-container sanluong-chart">'
            + '<h3 class="sanluong-chart__title lat-tieu-de"></h3>'
            + '<div class="lat-cham" aria-hidden="true">' + SL_TRANG.map(function () { return '<span></span>'; }).join('') + '</div>'
            + '<div class="sanluong-chart__canvas"><canvas id="sanluong-chart"></canvas></div>'
            + '</div>'
            + '<button type="button" class="lat-nut lat-nut--phai" data-page-step="1" aria-label="Xưởng sau">&#8250;</button>';
        khung.querySelectorAll('[data-page-step]').forEach(function (nut) {
            nut.addEventListener('click', function () { latTrangSanLuong(Number(nut.dataset.pageStep)); });
        });
        sec.appendChild(khung);
        box = document.getElementById('sanluong-chart-box');
    }

    const iTrang = TRANG_DANG_XEM.sanLuong || 0;
    const trang = SL_TRANG[iTrang];
    box.querySelectorAll('.lat-cham > span').forEach(function (cham, j) { cham.classList.toggle('is-dang-xem', j === iTrang); });

    const now = new Date();
    const thang = now.getMonth() + 1, nam = now.getFullYear();
    const soNgay = soNgayTrongThang(thang, nam);
    const tieuDe = box.querySelector('.sanluong-chart__title');
    if (tieuDe) tieuDe.textContent = 'SẢN LƯỢNG THÁNG ' + thang + '/' + nam + ' — ' + trang.xuong
        + ' (' + trang.day.join(' + ') + ') — theo ngày và luỹ kế';

    /* Sản lượng từng ngày { ngày: tấn }: trang TK3 + TK4 dùng bản máy chủ tính sẵn
       nếu có, không thì tự tính (cùng hàm slTheoNgay trong js/chung/chi_so.js) */
    const may = (iTrang === 0 && typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    const m3 = may ? may.sanLuongNgay.TK3 : slTheoNgay(window['masterSheetData' + trang.day[0]] || [], thang, nam);
    const m4 = may ? may.sanLuongNgay.TK4 : slTheoNgay(window['masterSheetData' + trang.day[1]] || [], thang, nam);

    /* TRỤC NGÀY: luôn từ NGÀY 01 tới HÔM NAY của tháng hiện tại.
       (Không lấy "ngày cuối có số liệu": sang tháng mới, ngày 01/09 chỉ hiện
       đúng một cột 1/9, không dính gì của tháng 8.) Ngày nào chưa có số thì để
       TRỐNG (null) — cột bên phải trống dần chứ không tụt về 0. */
    const homNay = now.getDate();

    const nhan = [], tk3 = [], tk4 = [], luyKe = [];
    let cong = 0, coSo = false;
    for (let d = 1; d <= homNay; d++) {
        nhan.push(d + '/' + thang);
        const a = m3[d], b = m4[d];
        const coNgay = (a !== undefined) || (b !== undefined);

        tk3.push(a === undefined ? null : a);
        tk4.push(b === undefined ? null : b);

        if (coNgay) {
            cong += (a || 0) + (b || 0);
            coSo = true;
        }
        /* Luỹ kế chỉ vẽ tới ngày CÓ số liệu; ngày sau để null cho đường dừng lại,
           không kéo ngang giả tạo tới cuối tháng. */
        luyKe.push(coNgay ? cong : null);
    }
    if (!coSo) {                            // cả tháng chưa có số nào
        /* Huỷ hình của trang kia (lật trang) cho khỏi hiện số xưởng khác dưới tiêu đề này */
        if (slChartInstance) { slChartInstance.destroy(); slChartInstance = null; }
        if (tieuDe) tieuDe.textContent += ' — chưa có số liệu tháng này';
        return;
    }

    /* Mục tiêu = kế hoạch tháng của hai dây đang xem (slChiSoTrang — cùng số với
       thẻ "Kế hoạch tháng"); chưa có kế hoạch thì không vẽ đường đỏ */
    const kq = slChiSoTrang(trang);
    const mucTieu = kq && kq.tongKH ? kq.tongKH : null;

    const ds = [
        {
            type: 'line', label: 'Luỹ kế cả xưởng', data: luyKe,
            borderColor: '#27ae60', backgroundColor: 'rgba(39,174,96,.10)',
            borderWidth: 3, tension: 0.3, pointRadius: 2, fill: true,
            spanGaps: false,                 /* ngày trống thì ĐỨT, không nối tắt */
            yAxisID: 'y_luyke', order: 1, datalabels: { display: false }
        },
        {
            type: 'bar', label: trang.ten[0], data: tk3,
            backgroundColor: trang.mau[0], yAxisID: 'y_ngay', order: 3,
            datalabels: { display: false }
        },
        {
            type: 'bar', label: trang.ten[1], data: tk4,
            backgroundColor: trang.mau[1], yAxisID: 'y_ngay', order: 4,
            datalabels: { display: false }
        }
    ];

    /* Có kế hoạch thì chèn đường mục tiêu (đường ngang đỏ) vào sau đường luỹ kế */
    if (mucTieu) {
        ds.splice(1, 0, {
            type: 'line', label: 'Mục tiêu tháng',
            data: nhan.map(function () { return mucTieu; }),
            borderColor: '#e74c3c', borderWidth: 2,   /* liền nét, bỏ borderDash */
            pointRadius: 0, fill: false, tension: 0,
            yAxisID: 'y_luyke', order: 2, datalabels: { display: false }
        });
    }

    if (slChartInstance) slChartInstance.destroy();
    slChartInstance = new Chart(document.getElementById('sanluong-chart').getContext('2d'), {
        type: 'bar',
        data: { labels: nhan, datasets: ds },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                y_ngay: {
                    type: 'linear', position: 'left', min: 0, grace: '10%',
                    title: { display: true, text: 'Sản lượng ngày (tấn)' }
                },
                y_luyke: {
                    type: 'linear', position: 'right', min: 0,
                    /* Nới trần để đường mục tiêu không dính sát mép trên */
                    suggestedMax: mucTieu ? mucTieu * 1.08 : undefined,
                    title: { display: true, text: 'Luỹ kế / mục tiêu (tấn)' },
                    grid: { drawOnChartArea: false }
                }
            },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10 } },
                datalabels: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (c) {
                            const v = c.parsed.y;
                            return c.dataset.label + ': '
                                + (v === null ? '--' : Math.round(v).toLocaleString('vi-VN')) + ' tấn';
                        }
                    }
                }
            }
        }
    });
}
