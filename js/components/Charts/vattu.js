/* XTK2-VATTU v1 — vattu.js
 * Đi cặp với css/vt.css (giao diện).
 * =============================================================================
 * BA MỤC VẬT TƯ TIÊU HAO THƯỜNG XUYÊN
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Dựng toàn bộ nội dung của ba mục vật tư (trong index.html chỉ có khung rỗng):
 *     #vat-tu-thanh-ghi   thanh ghi giữa — chỉ 1 loại nên KHÔNG cần bộ lọc loại
 *     #vat-tu-tam-op      tấm ốp, chốt chẻ… — nhiều loại nên CÓ bộ lọc loại + dây
 *     #vat-tu-tong-hop    tổng hợp vật tư XUẤT trong tháng hiện tại
 *   Mỗi mục thanh ghi / tấm ốp gồm:
 *     - 4 thẻ: tồn đầu kỳ, đã nhập, đã xuất, tồn cuối kỳ (báo đỏ nếu loại nào
 *       DƯỚI mức tồn an toàn);
 *     - biểu đồ nhập - xuất 12 tháng gần nhất;
 *     - biểu đồ tồn cuối so với mức tồn an toàn;
 *     - bảng chi tiết từng lượt nhập / xuất, mới nhất lên đầu.
 *
 * NGUỒN SỐ LIỆU
 *   window.masterSheetDataVATTU do api_loaded.js đổ vào, dạng
 *     { TK3: { tongHop: [...], nhap: [...], xuat: [...] }, TK4: { ... } }
 *   tongHop: [{ ten, donVi, tonDau, nhap, xuat, tonCuoi, tonAnToan }]  tồn kho
 *   nhap / xuat: [{ ten, moTa, soLuong }]                              từng lượt
 *   Ngày và ca của mỗi lượt KHÔNG có cột riêng — phải tách từ chữ mô tả
 *   (vtTachNgayCa), vd "1B 28/10/2025 - Thắng Lợi".
 *
 * Dùng lại kiểu thẻ .kpi-card của mục Sản lượng cho đồng bộ, không đẻ kiểu mới.
 * Vẽ lại mỗi khi có sự kiện VATTUDataReady.
 * ===========================================================================*/

/* Vật tư nào thuộc mục "thanh ghi giữa" (so khớp BỎ DẤU, chứa cụm từ này).
   Vật tư còn lại thuộc mục "tấm ốp". */
var VT_THANH_GHI = ['thanh ghi giua'];

/* Cấu hình ba mục:
     sec       id mục trong index.html
     tongQuan  id khung chứa thẻ + biểu đồ;  chiTiet: id khung chứa bảng chi tiết
     menu      id khối menu bên của mục
     loc       có bộ lọc loại vật tư không
     thuoc     hàm: vật tư tên này có thuộc mục không
     bang      (mục tổng hợp) id khung chứa bảng */
var VT_MUC = [
    { sec: 'vat-tu-thanh-ghi', tongQuan: 'vt-thanh-ghi-tong-quan',
      chiTiet: 'vt-thanh-ghi-chi-tiet', menu: 'sidebar-menu-vat-tu',
      loc: false, thuoc: function (ten) { return vtLaThanhGhi(ten); } },
    { sec: 'vat-tu-tam-op', tongQuan: 'vt-tam-op-tong-quan',
      chiTiet: 'vt-tam-op-chi-tiet', menu: 'sidebar-menu-vat-tu-op',
      loc: true, thuoc: function (ten) { return !vtLaThanhGhi(ten); } },
    { sec: 'vat-tu-tong-hop', bang: 'vt-thang-bang',
      menu: 'sidebar-menu-vat-tu-thang' },
];

/* =============================================================================
 * TIỆN ÍCH
 * ===========================================================================*/

/** Chuẩn hoá chữ để so khớp: bỏ dấu, chữ thường, gộp khoảng trắng.
 *    vtKey('Thanh  ghi Giữa') -> 'thanh ghi giua'
 *  Cần vì Google Sheets có thể trả chữ dạng tổ hợp dấu (NFD) còn từ khoá trong
 *  file này dạng dựng sẵn (NFC) — không quy về một dạng thì includes() luôn trả
 *  false dù nhìn giống hệt nhau. */
function vtKey(v) {
    return (v === undefined || v === null ? '' : String(v))
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Vật tư tên `ten` có phải thanh ghi giữa không. */
function vtLaThanhGhi(ten) {
    var k = vtKey(ten);
    return VT_THANH_GHI.some(function (t) { return k.indexOf(t) >= 0; });
}

/** Tạo nhanh một thẻ HTML: vtEl('div', 'lop-css', 'chữ'). */
var vtEl = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

/** Số -> chữ kiểu Việt (1.234), `le` số lẻ (mặc định 0); không có số -> '--'. */
var vtSo = function (v, le) {
    return (v === null || v === undefined || !isFinite(v)) ? '--'
        : Number(v).toLocaleString('vi-VN', {
            minimumFractionDigits: le || 0, maximumFractionDigits: le || 0 });
};

/** Tách NGÀY và CA từ chuỗi mô tả kiểu:
 *      "1B 28/10/2025 - Thắng Lợi"
 *      "2C 03/03/2026 Thắng Lợi-Chuyển từ TK4 qua 300 Thanh"
 *      "1A 3/4/2026 nhập ghi vico"
 *      "1B ngày 23/1 thắng lợi - thay 235 thanh"   (thiếu năm)
 *  Ra { ngay, thang, nam, ca } — phần nào không thấy thì để null.
 *  (db/chuan-hoa.mjs có bản tương tự cho D1 — bản đó KHÔNG đoán năm.) */
function vtTachNgayCa(moTa) {
    var s = String(moTa || '');
    var ra = { ngay: null, thang: null, nam: null, ca: null };

    /* Ca kíp: cụm số-chữ ở ĐẦU chuỗi, ví dụ 1A, 2B, 1C */
    var mCa = s.match(/^\s*([123])\s*([ABC])/i);
    if (mCa) ra.ca = mCa[1] + mCa[2].toUpperCase();

    /* Ngày: dd/mm/yyyy hoặc dd/mm (năm 2 chữ số -> 20xx) */
    var mN = s.match(/(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{2,4}))?/);
    if (mN) {
        ra.ngay = +mN[1];
        ra.thang = +mN[2];
        if (mN[3]) {
            var y = +mN[3];
            ra.nam = y < 100 ? 2000 + y : y;
        }
    }
    return ra;
}

/** Gom một khối ('tongHop' | 'nhap' | 'xuat') của CẢ HAI dây thành một danh sách
 *  phẳng; mỗi phần tử được chép ra và gắn thêm day: 'TK3' / 'TK4'. */
function vtGom(khoi) {
    var data = window.masterSheetDataVATTU;
    var ra = [];
    if (!data) return ra;
    ['TK3', 'TK4'].forEach(function (day) {
        var d = data[day];
        if (!d || !Array.isArray(d[khoi])) return;
        d[khoi].forEach(function (x) {
            var b = {};
            Object.keys(x).forEach(function (k) { b[k] = x[k]; });
            b.day = day;
            ra.push(b);
        });
    });
    return ra;
}

/* =============================================================================
 * THẺ CHỈ SỐ
 * ===========================================================================*/

/** Một thẻ: tiêu đề, số (đơn vị "cái"), dòng ghi chú (tuỳ chọn).
 *  mau: lớp CSS màu của số ('target', 'actual', 'heso', 'canhbao'...). */
function vtThe(nhan, giaTri, mau, ghiChu) {
    var card = vtEl('div', 'kpi-card');
    card.appendChild(vtEl('h3', null, nhan));
    var v = vtEl('div', 'kpi-value ' + (mau || ''));
    v.textContent = giaTri;
    var u = vtEl('span', 'kpi-unit', 'cái');
    v.appendChild(u);
    card.appendChild(v);
    if (ghiChu) card.appendChild(vtEl('div', 'kpi-trend', ghiChu));
    return card;
}

/** Lưới 4 thẻ: tồn đầu, nhập, xuất, tồn cuối — CỘNG DỒN các vật tư trong ds.
 *  Thẻ tồn cuối báo đỏ + liệt kê loại nào đang DƯỚI mức tồn an toàn. */
function vtDungThe(ds) {
    var g = { tonDau: 0, nhap: 0, xuat: 0, tonCuoi: 0, tonAnToan: 0 };
    var co = false;
    ds.forEach(function (x) {
        ['tonDau', 'nhap', 'xuat', 'tonCuoi', 'tonAnToan'].forEach(function (k) {
            if (x[k] !== null && x[k] !== undefined && isFinite(x[k])) { g[k] += x[k]; co = true; }
        });
    });

    /* Vật tư nào tồn cuối THẤP HƠN tồn an toàn thì phải báo — đó là lý do
       cột TỒN AN TOÀN có trong bảng tính. */
    var duoiNguong = ds.filter(function (x) {
        return x.tonAnToan !== null && x.tonCuoi !== null
            && isFinite(x.tonAnToan) && isFinite(x.tonCuoi)
            && x.tonCuoi < x.tonAnToan;
    });

    var grid = vtEl('div', 'panel-content kpi-grid');
    grid.appendChild(vtThe('Tồn đầu kỳ', co ? vtSo(g.tonDau) : '--', 'target'));
    grid.appendChild(vtThe('Đã nhập', co ? vtSo(g.nhap) : '--', 'actual'));
    grid.appendChild(vtThe('Đã xuất', co ? vtSo(g.xuat) : '--', 'heso'));

    /* Ghi chú của thẻ tồn cuối: cảnh báo > mức an toàn > mô tả danh sách */
    var ghi;
    if (duoiNguong.length) {
        ghi = '⚠ ' + duoiNguong.length + ' loại DƯỚI mức tồn an toàn: '
            + duoiNguong.map(function (x) {
                return x.ten + ' (' + vtSo(x.tonCuoi) + '/' + vtSo(x.tonAnToan) + ')';
            }).join(', ');
    } else if (g.tonAnToan) {
        ghi = 'Mức tồn an toàn: ' + vtSo(g.tonAnToan) + ' — đang đủ';
    } else {
        ghi = ds.length === 1 ? ds[0].day + ' — ' + ds[0].ten
                              : ds.length + ' loại vật tư, gộp 2 dây chuyền';
    }
    var theTon = vtThe('Tồn cuối kỳ', co ? vtSo(g.tonCuoi) : '--',
        duoiNguong.length ? 'canhbao' : 'persent', ghi);
    if (duoiNguong.length) theTon.classList.add('vt-card--canhbao');
    grid.appendChild(theTon);
    return grid;
}

/* =============================================================================
 * BIỂU ĐỒ (Chart.js — đã có sẵn trên trang)
 *   1) Nhập - xuất theo THÁNG    (cột kép)   — thấy tháng nào thay nhiều
 *   2) Tồn cuối so TỒN AN TOÀN   (cột ngang) — thấy loại nào sắp thiếu
 *   3) Xuất trong tháng theo loại (cột ngang) — ở mục tổng hợp
 * Mỗi khung vẽ giữ MỘT đối tượng biểu đồ (VT_CHART[id]); vẽ lại thì huỷ cái cũ
 * để không rò bộ nhớ khi người xem đổi bộ lọc liên tục.
 * ===========================================================================*/

var VT_CHART = {};

/** Dựng khung chứa một biểu đồ: tiêu đề + <canvas id="id">, cao `cao` px. */
function vtKhungVe(id, tieuDe, cao) {
    var box = vtEl('div', 'vt-box');
    box.appendChild(vtEl('h3', 'vt-box__title', tieuDe));
    var khung = vtEl('div', 'vt-canvas');
    if (cao) khung.style.height = cao + 'px';
    var cv = document.createElement('canvas');
    cv.id = id;
    khung.appendChild(cv);
    box.appendChild(khung);
    return box;
}

/** Vẽ biểu đồ cauHinh (cấu hình Chart.js) lên canvas id, huỷ biểu đồ cũ nếu có. */
function vtVe(id, cauHinh) {
    if (typeof Chart === 'undefined') return;
    var cv = document.getElementById(id);
    if (!cv) return;
    if (VT_CHART[id]) VT_CHART[id].destroy();
    VT_CHART[id] = new Chart(cv.getContext('2d'), cauHinh);
}

/** Cộng số lượng nhập và xuất theo THÁNG, cho 12 tháng gần nhất.
 *  loc: hàm lọc lượt nhập/xuất (null = lấy hết).
 *  Ra: [{ thang, nam, nhap, xuat }] từ cũ tới mới. Lượt thiếu năm coi là năm nay. */
function vtTheoThang(loc) {
    var now = new Date();
    var moc = [];
    for (var i = 11; i >= 0; i--) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        moc.push({ thang: d.getMonth() + 1, nam: d.getFullYear(), nhap: 0, xuat: 0 });
    }
    var tim = function (t, n) {
        for (var k = 0; k < moc.length; k++) {
            if (moc[k].thang === t && moc[k].nam === n) return moc[k];
        }
        return null;
    };

    [['nhap', 'nhap'], ['xuat', 'xuat']].forEach(function (c) {
        vtGom(c[0]).forEach(function (x) {
            if (loc && !loc(x)) return;
            var d = vtTachNgayCa(x.moTa);
            if (!d.thang) return;
            var o = tim(d.thang, d.nam || now.getFullYear());
            if (!o) return;
            if (x.soLuong !== null && isFinite(x.soLuong)) o[c[1]] += x.soLuong;
        });
    });
    return moc;
}

/** Biểu đồ 1: cột kép nhập (xanh) / xuất (đỏ) theo tháng. */
function vtVeNhapXuatThang(id, loc) {
    var m = vtTheoThang(loc);
    vtVe(id, {
        type: 'bar',
        data: {
            labels: m.map(function (x) { return x.thang + '/' + String(x.nam).slice(2); }),
            datasets: [
                { label: 'Nhập', data: m.map(function (x) { return x.nhap; }),
                  backgroundColor: 'rgba(39,174,96,.85)', datalabels: { display: false } },
                { label: 'Xuất', data: m.map(function (x) { return x.xuat; }),
                  backgroundColor: 'rgba(231,76,60,.85)', datalabels: { display: false } },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Số lượng (cái)' } } },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10 } },
                datalabels: { display: false },
                tooltip: { callbacks: { label: function (c) {
                    return c.dataset.label + ': ' + vtSo(c.parsed.y) + ' cái';
                } } },
            },
        },
    });
}

/** Biểu đồ 2: cột ngang tồn cuối (đỏ nếu dưới mức an toàn) cạnh mức tồn an toàn.
 *  Ra false (không vẽ) nếu không loại nào khai mức tồn an toàn — nơi gọi xoá khung. */
function vtVeTonAnToan(id, ds) {
    /* Chỉ vẽ những loại CÓ khai mức tồn an toàn, khỏi cột rỗng vô nghĩa */
    var co = ds.filter(function (x) {
        return x.tonAnToan !== null && isFinite(x.tonAnToan) && x.tonAnToan > 0;
    });
    if (!co.length) return false;

    vtVe(id, {
        type: 'bar',
        data: {
            labels: co.map(function (x) { return x.ten + ' (' + x.day + ')'; }),
            datasets: [
                { label: 'Tồn cuối', data: co.map(function (x) { return x.tonCuoi; }),
                  backgroundColor: co.map(function (x) {
                      /* Dưới mức an toàn thì tô ĐỎ, đủ thì tô XANH */
                      return (x.tonCuoi !== null && x.tonCuoi < x.tonAnToan)
                          ? 'rgba(231,76,60,.85)' : 'rgba(26,79,214,.85)';
                  }), datalabels: { display: false } },
                { label: 'Mức tồn an toàn', data: co.map(function (x) { return x.tonAnToan; }),
                  backgroundColor: 'rgba(243,156,18,.55)', datalabels: { display: false } },
            ],
        },
        options: {
            indexAxis: 'y',                    /* cột nằm ngang */
            responsive: true, maintainAspectRatio: false,
            scales: { x: { beginAtZero: true, title: { display: true, text: 'Số lượng (cái)' } } },
            plugins: {
                legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 10 } },
                datalabels: { display: false },
                tooltip: { callbacks: { label: function (c) {
                    return c.dataset.label + ': ' + vtSo(c.parsed.x) + ' cái';
                } } },
            },
        },
    });
    return true;
}

/* =============================================================================
 * BẢNG CHI TIẾT NHẬP / XUẤT
 * ===========================================================================*/

/** Bảng mọi lượt nhập + xuất (lọc bằng hàm loc), mới nhất lên đầu.
 *  Cột: Loại | Dây chuyền | Ca | Ngày | Vật tư | Số lượng | Diễn giải. */
function vtBangChiTiet(ten, loc) {
    var box = vtEl('div', 'vt-box');
    box.appendChild(vtEl('h3', 'vt-box__title', ten));

    var bang = vtEl('table', 'vt-bang');
    var thead = vtEl('thead');
    var hr = vtEl('tr');
    ['Loại', 'Dây chuyền', 'Ca', 'Ngày', 'Vật tư', 'Số lượng', 'Diễn giải']
        .forEach(function (t) { hr.appendChild(vtEl('th', null, t)); });
    thead.appendChild(hr);
    bang.appendChild(thead);

    var tbody = vtEl('tbody');
    var dong = [];

    [['Nhập', 'nhap', 'is-nhap'], ['Xuất', 'xuat', 'is-xuat']].forEach(function (c) {
        vtGom(c[1]).forEach(function (x) {
            if (loc && !loc(x)) return;
            var d = vtTachNgayCa(x.moTa);
            dong.push({ loai: c[0], cls: c[2], day: x.day, ca: d.ca,
                        ngay: d, ten: x.ten, sl: x.soLuong, moTa: x.moTa });
        });
    });

    /* Mới nhất lên trước: so theo năm, tháng, ngày (ghép thành số yyyymmdd) */
    dong.sort(function (a, b) {
        var ka = (a.ngay.nam || 0) * 10000 + (a.ngay.thang || 0) * 100 + (a.ngay.ngay || 0);
        var kb = (b.ngay.nam || 0) * 10000 + (b.ngay.thang || 0) * 100 + (b.ngay.ngay || 0);
        return kb - ka;
    });

    dong.forEach(function (d) {
        var tr = vtEl('tr', d.cls);
        tr.appendChild(vtEl('td', 'vt-loai', d.loai));
        tr.appendChild(vtEl('td', null, d.day));
        tr.appendChild(vtEl('td', null, d.ca || '--'));
        tr.appendChild(vtEl('td', null,
            d.ngay.ngay ? d.ngay.ngay + '/' + d.ngay.thang
                + (d.ngay.nam ? '/' + d.ngay.nam : '') : '--'));
        tr.appendChild(vtEl('td', null, d.ten));
        tr.appendChild(vtEl('td', 'vt-sl', vtSo(d.sl)));
        tr.appendChild(vtEl('td', 'vt-mota', d.moTa));
        tbody.appendChild(tr);
    });

    bang.appendChild(tbody);

    if (!dong.length) {
        box.appendChild(vtEl('p', 'vt-trong', 'Chưa có dòng nhập / xuất nào cho nhóm này'));
    } else {
        box.appendChild(vtEl('p', 'vt-dem', dong.length + ' lượt nhập - xuất'));
        var cuon = vtEl('div', 'vt-cuon');      /* khung cuộn khi bảng dài */
        cuon.appendChild(bang);
        box.appendChild(cuon);
    }
    return box;
}

/* =============================================================================
 * DỰNG MỘT MỤC (thanh ghi / tấm ốp)
 * ===========================================================================*/

/** Dựng phần tổng quan (thẻ + biểu đồ) và phần chi tiết (bảng) của mục m.
 *  Mục KHÔNG có bộ lọc: dựng một lần.
 *  Mục CÓ bộ lọc: thêm 2 ô chọn (loại vật tư, dây chuyền); mỗi lần đổi lựa chọn
 *  thì dựng lại thẻ, biểu đồ và bảng theo lựa chọn đó (hàm ve bên dưới). */
function vtDungMuc(m) {
    var sec = document.getElementById(m.sec);
    if (!sec) return;

    var tq = document.getElementById(m.tongQuan);
    var ct = document.getElementById(m.chiTiet);
    if (!tq || !ct) return;

    var tatCa = vtGom('tongHop').filter(function (x) { return m.thuoc(x.ten); });

    /* --- Khối tổng quan --- */
    tq.innerHTML = '';
    if (!tatCa.length) {
        tq.appendChild(vtEl('p', 'vt-trong', 'Chưa lấy được số liệu vật tư cho mục này'));
    } else if (!m.loc) {
        tq.appendChild(vtDungThe(tatCa));
        tq.appendChild(vtKhungVe(m.tongQuan + '-thang',
            'NHẬP - XUẤT THEO THÁNG (12 tháng gần nhất)', 340));
        var khungTon = vtKhungVe(m.tongQuan + '-ton', 'TỒN CUỐI SO VỚI MỨC TỒN AN TOÀN', 220);
        tq.appendChild(khungTon);
        /* Vẽ SAU khi canvas đã nằm trong trang, nếu không Chart.js không đo được cỡ */
        setTimeout(function () {
            vtVeNhapXuatThang(m.tongQuan + '-thang', function (x) { return m.thuoc(x.ten); });
            if (!vtVeTonAnToan(m.tongQuan + '-ton', tatCa)) khungTon.remove();
        }, 0);
    } else {
        /* Nhiều loại -> thêm bộ lọc. Mặc định gộp tất cả. */
        var thanh = vtEl('div', 'vt-loc');
        thanh.appendChild(vtEl('label', null, 'Chọn loại vật tư:'));

        var sel = document.createElement('select');
        sel.className = 'vt-select';
        var opt0 = document.createElement('option');
        opt0.value = '';
        opt0.textContent = 'Tất cả (' + demLoai(tatCa) + ' loại)';
        sel.appendChild(opt0);
        tenDuyNhat(tatCa).forEach(function (t) {
            var o = document.createElement('option');
            o.value = t; o.textContent = t;
            sel.appendChild(o);
        });
        thanh.appendChild(sel);

        var selDay = document.createElement('select');
        selDay.className = 'vt-select';
        [['', 'Cả 2 dây chuyền'], ['TK3', 'Dây chuyền 3'], ['TK4', 'Dây chuyền 4']]
            .forEach(function (c) {
                var o = document.createElement('option');
                o.value = c[0]; o.textContent = c[1];
                selDay.appendChild(o);
            });
        thanh.appendChild(vtEl('label', null, 'Dây chuyền:'));
        thanh.appendChild(selDay);

        tq.appendChild(thanh);

        var choThe = vtEl('div', 'vt-cho-the');     /* chỗ đặt 4 thẻ */
        tq.appendChild(choThe);

        var choVe = vtEl('div', 'vt-cho-ve');       /* chỗ đặt biểu đồ */
        tq.appendChild(choVe);

        /* Dựng lại thẻ + biểu đồ + bảng theo lựa chọn hiện tại */
        var ve = function () {
            var ten = sel.value, day = selDay.value;
            var ds = tatCa.filter(function (x) {
                return (!ten || x.ten === ten) && (!day || x.day === day);
            });
            choThe.innerHTML = '';
            if (!ds.length) {
                choThe.appendChild(vtEl('p', 'vt-trong', 'Không có vật tư nào khớp bộ lọc'));
            } else {
                choThe.appendChild(vtDungThe(ds));
            }
            /* Biểu đồ cũng đi theo bộ lọc */
            var locDong = function (x) {
                return m.thuoc(x.ten) && (!ten || x.ten === ten) && (!day || x.day === day);
            };
            choVe.innerHTML = '';
            choVe.appendChild(vtKhungVe('vt-op-thang',
                'NHẬP - XUẤT THEO THÁNG (12 tháng gần nhất)', 340));
            /* Cao theo số loại (mỗi loại một hàng cột ngang) */
            var kt = vtKhungVe('vt-op-ton', 'TỒN CUỐI SO VỚI MỨC TỒN AN TOÀN',
                Math.max(220, ds.length * 34 + 90));
            choVe.appendChild(kt);
            setTimeout(function () {
                vtVeNhapXuatThang('vt-op-thang', locDong);
                if (!vtVeTonAnToan('vt-op-ton', ds)) kt.remove();
            }, 0);

            /* Bảng chi tiết đi theo bộ lọc luôn */
            ct.innerHTML = '';
            ct.appendChild(vtBangChiTiet('Chi tiết nhập - xuất', locDong));
        };
        sel.addEventListener('change', ve);
        selDay.addEventListener('change', ve);
        ve();
        return;                       /* đã dựng bảng chi tiết trong ve() */
    }

    /* --- Khối chi tiết (mục không có bộ lọc) --- */
    ct.innerHTML = '';
    ct.appendChild(vtBangChiTiet('Chi tiết nhập - xuất', function (x) {
        return m.thuoc(x.ten);
    }));
}

/** Các tên vật tư khác nhau trong ds, xếp A-Z. */
function tenDuyNhat(ds) {
    var t = [];
    ds.forEach(function (x) { if (t.indexOf(x.ten) < 0) t.push(x.ten); });
    return t.sort();
}
/** Số loại vật tư khác nhau trong ds. */
function demLoai(ds) { return tenDuyNhat(ds).length; }

/* =============================================================================
 * MỤC TỔNG HỢP: VẬT TƯ XUẤT TRONG THÁNG HIỆN TẠI
 * ===========================================================================*/

/** Bảng + biểu đồ: mỗi (vật tư, dây chuyền) xuất bao nhiêu cái, bao nhiêu lượt
 *  trong tháng này, nhiều nhất lên đầu. Lượt không đọc được ngày từ mô tả thì
 *  bỏ qua và ghi chú số dòng bị bỏ. */
function vtDungTongHop() {
    var bang = document.getElementById('vt-thang-bang');
    if (!bang) return;
    bang.innerHTML = '';

    var now = new Date();
    var thang = now.getMonth() + 1, nam = now.getFullYear();

    var box = vtEl('div', 'vt-box');
    box.appendChild(vtEl('h3', 'vt-box__title',
        'VẬT TƯ XUẤT TRONG THÁNG ' + thang + '/' + nam));

    /* Gom theo tên vật tư + dây, cộng số lượng xuất của tháng hiện tại */
    var gom = {}, tongLuot = 0, boQua = 0;
    vtGom('xuat').forEach(function (x) {
        var d = vtTachNgayCa(x.moTa);
        if (!d.ngay || !d.thang) { boQua++; return; }
        /* Dòng thiếu năm thì coi là năm hiện tại */
        var y = d.nam || nam;
        if (d.thang !== thang || y !== nam) return;
        var k = x.ten + '|' + x.day;
        if (!gom[k]) gom[k] = { ten: x.ten, day: x.day, sl: 0, luot: 0 };
        if (x.soLuong !== null && isFinite(x.soLuong)) gom[k].sl += x.soLuong;
        gom[k].luot += 1;
        tongLuot += 1;
    });

    var ds = Object.keys(gom).map(function (k) { return gom[k]; })
        .sort(function (a, b) { return b.sl - a.sl; });

    if (!ds.length) {
        box.appendChild(vtEl('p', 'vt-trong',
            'Chưa có lượt xuất nào trong tháng ' + thang + '/' + nam));
    } else {
        var t = vtEl('table', 'vt-bang');
        var thead = vtEl('thead'), hr = vtEl('tr');
        ['Vật tư', 'Dây chuyền', 'Số lượng xuất', 'Số lượt'].forEach(function (x) {
            hr.appendChild(vtEl('th', null, x));
        });
        thead.appendChild(hr); t.appendChild(thead);

        var tb = vtEl('tbody');
        ds.forEach(function (x) {
            var tr = vtEl('tr');
            tr.appendChild(vtEl('td', null, x.ten));
            tr.appendChild(vtEl('td', null, x.day));
            tr.appendChild(vtEl('td', 'vt-sl', vtSo(x.sl)));
            tr.appendChild(vtEl('td', 'vt-sl', String(x.luot)));
            tbody0(tr, tb);
        });
        t.appendChild(tb);

        box.appendChild(vtEl('p', 'vt-dem',
            ds.length + ' loại vật tư — ' + tongLuot + ' lượt xuất'));
        var cuon = vtEl('div', 'vt-cuon');
        cuon.appendChild(t);
        box.appendChild(cuon);

        /* Ghi chú phải thêm TRƯỚC khi gắn box, vì bên dưới có return sớm —
           thiếu chỗ này thì dòng "bỏ qua N dòng thiếu ngày" không bao giờ hiện. */
        if (boQua) {
            box.appendChild(vtEl('p', 'vt-ghichu',
                boQua + ' dòng xuất không đọc được ngày trong phần diễn giải nên chưa tính vào đây.'));
        }

        bang.appendChild(box);
        /* Biểu đồ cột ngang, cao theo số loại */
        var khung = vtKhungVe('vt-thang-chart',
            'XUẤT TRONG THÁNG ' + thang + '/' + nam + ' — theo loại vật tư',
            Math.max(260, ds.length * 32 + 90));
        bang.appendChild(khung);
        setTimeout(function () {
            vtVe('vt-thang-chart', {
                type: 'bar',
                data: {
                    labels: ds.map(function (x) { return x.ten + ' (' + x.day + ')'; }),
                    datasets: [{ label: 'Số lượng xuất',
                        data: ds.map(function (x) { return x.sl; }),
                        backgroundColor: 'rgba(231,76,60,.85)',
                        datalabels: { display: false } }],
                },
                options: {
                    indexAxis: 'y',
                    responsive: true, maintainAspectRatio: false,
                    scales: { x: { beginAtZero: true, title: { display: true, text: 'Số lượng (cái)' } } },
                    plugins: {
                        legend: { display: false }, datalabels: { display: false },
                        tooltip: { callbacks: { label: function (c) {
                            return vtSo(c.parsed.x) + ' cái';
                        } } },
                    },
                },
            });
        }, 0);
        return;                    /* đã gắn box ở trên */
    }

    if (boQua) {
        box.appendChild(vtEl('p', 'vt-ghichu',
            boQua + ' dòng xuất không đọc được ngày trong phần diễn giải nên chưa tính vào đây.'));
    }
    bang.appendChild(box);
}

/** Gắn một hàng vào thân bảng (tách hàm chỉ để dòng trên ngắn gọn). */
function tbody0(tr, tb) { tb.appendChild(tr); }

/* =============================================================================
 * MENU BÊN: HIỆN ĐÚNG KHỐI MENU CỦA MỤC ĐANG XEM
 * ===========================================================================*/

/** Bấm liên kết #vat-tu-... trên thanh điều hướng -> hiện khối menu bên của mục
 *  đó. Mỗi liên kết chỉ gắn một lần (đánh dấu data-vt-da-gan). */
function vtNoiMenu() {
    VT_MUC.forEach(function (m) {
        document.querySelectorAll('a[href="#' + m.sec + '"]').forEach(function (a) {
            if (a.dataset.vtDaGan) return;
            a.dataset.vtDaGan = '1';
            a.addEventListener('click', function () {
                setTimeout(function () { vtHienMenu(m.menu); }, 60);
            });
        });
    });
}

/** Ẩn mọi khối menu bên, chỉ hiện khối id.
 *  sidebar.js không biết ba mục vật tư nên xử lý ở đây, khỏi phải sửa file đó. */
function vtHienMenu(id) {
    ['sidebar-menu-tieu-hao', 'sidebar-menu-chat-luong',
     'sidebar-menu-vat-tu', 'sidebar-menu-vat-tu-op', 'sidebar-menu-vat-tu-thang']
    .forEach(function (x) {
        var e = document.getElementById(x);
        if (e) e.style.display = (x === id) ? 'block' : 'none';
    });
}

/* =============================================================================
 * CHẠY KHI CÓ DỮ LIỆU
 * ===========================================================================*/

/** Dựng cả ba mục vật tư từ window.masterSheetDataVATTU. */
function veVatTu() {
    if (!window.masterSheetDataVATTU) return;
    VT_MUC.forEach(function (m) { if (m.tongQuan) vtDungMuc(m); });
    vtDungTongHop();
    vtNoiMenu();

    var n = vtGom('tongHop').length;
    console.info('[Vật tư] Đã dựng ' + n + ' dòng tổng hợp, '
        + vtGom('nhap').length + ' lượt nhập, ' + vtGom('xuat').length + ' lượt xuất.');
}

document.addEventListener('VATTUDataReady', function () {
    try { veVatTu(); } catch (e) { console.error('[Vật tư]', e); }
});

/* Dữ liệu có thể ĐÃ về trước khi file này được nạp (api_loaded.js bắn sự kiện
   ngay từ bản nhớ trong máy). Khi đó nghe sự kiện là muộn — phải tự chạy luôn. */
if (window.masterSheetDataVATTU) {
    try { veVatTu(); } catch (e) { console.error('[Vật tư]', e); }
}
