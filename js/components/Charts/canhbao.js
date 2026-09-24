/* XTK2-CANHBAO v3 — canhbao.js
 * Đi CẶP với cb.css v3 và chart_cook.js mới nhất.
 * Bản này đã có: bảng Tiêu hao + bảng Chất lượng, ghi rõ NGÀY GẦN NHẤT của số
 * liệu, bỏ qua dòng của ngày chưa tới, mục "Bảng nhận xét" trong menu bên.
 * =============================================================================
 * BẢNG CẢNH BÁO TIÊU HAO SẢN XUẤT — hiện ở đầu mục "Tiêu hao sản xuất"
 * -----------------------------------------------------------------------------
 * Trước đây mục này trống trơn, phải mở menu chọn từng nhóm mới thấy gì. Nay
 * vào là biết ngay chỉ tiêu nào đang vượt ngưỡng, bấm vào là nhảy tới biểu đồ
 * chi tiết của nhóm đó.
 *
 * KHÔNG dùng Chart.js — chỉ số và màu, nên gần như không tốn tài nguyên.
 *
 * NGƯỠNG CẢNH BÁO đặt ở NGUONG bên dưới, sửa một chỗ là xong.
 * ===========================================================================*/

/* --- Ngưỡng do người dùng quy định --- */
var NGUONG = {
    than:     { ngay: 50, luyKe: 45, donVi: 'kg/Tsp' },
    dien:     { ngay: 48, luyKe: 48, donVi: 'kWh/Tsp' },
    khiThan:  { ngay: 51, luyKe: 51, donVi: 'm³/Tsp' },
    quangHoi: { ngay: 35, luyKe: 35, donVi: '%' },
};

/* --- Khai báo từng chỉ tiêu: lấy cột nào, so ngưỡng nào, nhảy tới đâu --- */
var CB_CHI_TIEU = [
    {
        ten: 'Tiêu hao than', bieuTuong: '🔥', nhay: 'tieu-hao-than',
        nguong: NGUONG.than,
        ngayCol: 'Thời gian (THthan)', caCol: 'Ca/kíp (THthan)',
        /* Bảng tính có HAI cách tính than. Cả hai đều áp CÙNG ngưỡng, và chấm
           RIÊNG từng cách — cách nào vượt thì báo cách đó, không gộp lại. */
        tach: [
            { nhan: 'Ccd', ngay: 'Tiêu hao theo Ccd',
              luyKe: 'Tiêu hao than tích luỹ (tính theo Ccd)' },
            { nhan: 'nhiệt trị', ngay: 'Tiêu hao theo nhiệt trị',
              luyKe: 'Tiêu hao than tích luỹ (tính theo nhiệt trị)' },
        ],
    },
    {
        ten: 'Tiêu hao điện', bieuTuong: '⚡', nhay: 'tieu-hao-dien',
        nguong: NGUONG.dien,
        ngayCol: 'Thời gian (Điện)', caCol: 'Ca/kíp (Điện)',
        colNgay:  ['Tiêu hao điện (ca)'],
        colLuyKe: ['Tiêu hao điện tích luỹ tháng'],
    },
    {
        ten: 'Tiêu hao khí than', bieuTuong: '💨', nhay: 'tieu-hao-khi-than',
        nguong: NGUONG.khiThan,
        ngayCol: 'Thời gian (khí than)', caCol: 'Ca/kíp (khí than)',
        colNgay:  ['Tiêu hao khí than (khí than)'],
        colLuyKe: ['Tiêu hao khí than tích luỹ (khí than)'],
    },
    {
        /* Tỉ lệ quặng hồi = hồi nguội + hồi lò cao, CỘNG hai cột lại rồi mới so. */
        ten: 'Tỉ lệ quặng hồi', bieuTuong: '♻️', nhay: 'ti-le-quang-hoi',
        nguong: NGUONG.quangHoi, cong: true,
        ngayCol: 'Thời gian (QH)', caCol: 'Ca/kíp (QH)',
        colNgay:  ['Tỉ lệ quặng hồi nguội (QH)', 'Tỉ lệ quặng HLC (QH)'],
        colLuyKe: ['Tỉ lệ quặng hồi nguội tích lũy (QH)', 'Tỉ lệ quặng HLC tích lũy (QH)'],
    },
];

/* Trợ dung: CHỈ hiện bảng ngày gần nhất, KHÔNG cảnh báo (theo yêu cầu) */
var CB_TRO_DUNG = {
    ten: 'Tiêu hao trợ dung', bieuTuong: '🪨', nhay: 'tieu-hao-tro-dung',
    ngayCol: 'Thời gian (THTD)', caCol: 'Ca/kíp (THTD)',
    dong: [
        { nhan: 'Vôi nung',  ngay: 'Tiêu hao quy đổi vôi nung',
          luyKe: 'Tiêu hao quy đổi vôi nung (tích luỹ)' },
        { nhan: 'Dolomite',  ngay: 'Tiêu hao quy đổi đá dolomite',
          luyKe: 'Tiêu hao quy đổi đá dolomite (tích luỹ)' },
    ],
};

/* =============================================================================
 * BẢNG CẢNH BÁO CHẤT LƯỢNG (#chat-luong)
 * -----------------------------------------------------------------------------
 * Khác bên tiêu hao ở chỗ mỗi chỉ tiêu so theo MỘT trong ba kiểu:
 *   'tren'    -> vượt LÊN TRÊN ngưỡng thì cảnh báo   (FeO > 9%)
 *   'duoi'    -> tụt XUỐNG DƯỚI ngưỡng thì cảnh báo  (%CaO < 82%)
 *   'daoDong' -> chênh lệch giữa NGÀY MỚI NHẤT và NGÀY LIỀN TRƯỚC đạt ngưỡng
 *                thì cảnh báo                        (%SiO2 dao động >= 0,5%)
 * Ngưỡng để ngay trong từng dòng, sửa tại chỗ.
 * ===========================================================================*/
var CL_CHI_TIEU = [
    {
        ten: 'Chất lượng vôi nung', bieuTuong: '⚪', nhay: 'chat-luong-voi-nung',
        ngayCol: 'Thời gian (vôi nung)', caCol: 'Ca/kíp (vôi nung)',
        phep: [
            { nhan: 'Cỡ hạt 0-3mm', cot: 'Cỡ hạt 0 - 3mm (VN) (%)',
              huong: 'duoi', nguong: 90, donVi: '%' },
            /* Bảng tính có HAI cột %CaO (lò 12 và lò 13), chấm riêng từng lò */
            { nhan: '%CaO lò 12', cot: '% CaO (vôi) (12)', huong: 'duoi', nguong: 82, donVi: '%' },
            { nhan: '%CaO lò 13', cot: '% CaO (vôi) (13)', huong: 'duoi', nguong: 82, donVi: '%' },
        ],
    },
    {
        ten: 'Chất lượng dolomite nung', bieuTuong: '🟤', nhay: 'chat-luong-dolomite-nung',
        ngayCol: 'Thời gian (đo nung)', caCol: 'Ca/kíp (đo nung)',
        phep: [
            { nhan: 'Cỡ hạt 0-3mm', cot: 'Cỡ hạt 0 - 3mm (ĐN) (%)',
              huong: 'duoi', nguong: 90, donVi: '%' },
            /* CHÚ Ý: bảng tính KHÔNG có cột %CaO cho dolomite, chỉ có %MgO.
               Ngưỡng 82% của vôi không áp được cho MgO (MgO trong dolomite nung
               thường chỉ 20-30%), để 82 là báo đỏ liên tục.
               Đang TẮT (nguong: null). Điền số đúng vào là bật lại. */
            { nhan: '%MgO', cot: '%MgO', huong: 'duoi', nguong: null, donVi: '%' },
        ],
    },
    {
        ten: 'Chất lượng quặng trung hoà', bieuTuong: '🟡', nhay: 'chat-luong-quang-trung-hoa',
        ngayCol: 'Thời gian (QTH)', caCol: 'Ca/kíp (QTH)',
        phep: [
            { nhan: 'Dao động %SiO2', cot: '%SiO2 (QTH)',
              huong: 'daoDong', nguong: 0.5, donVi: '%' },
        ],
    },
    {
        ten: 'Chất lượng quặng hồi', bieuTuong: '♻️', nhay: 'chat-luong-quang-hoi',
        ngayCol: 'Thời gian (HLC)', caCol: 'Ca/kíp (HLC)',
        phep: [
            { nhan: 'Dao động %SiO2', cot: '%SiO2 (HLC)',
              huong: 'daoDong', nguong: 1, donVi: '%' },
        ],
    },
    {
        ten: 'Chất lượng than', bieuTuong: '🔥', nhay: 'chat-luong-than',
        ngayCol: 'Thời gian (chất lượng than)', caCol: 'Ca/kíp (chất lượng than)',
        phep: [
            { nhan: 'Cỡ hạt <0,5mm — than nghiền', cot: 'Cỡ hạt < 0,5mm (than nghiền)',
              huong: 'tren', nguong: 20, donVi: '%' },
            { nhan: 'Cỡ hạt <0,5mm — than coke', cot: 'Cỡ hạt < 0,5mm (than coke)',
              huong: 'tren', nguong: 20, donVi: '%' },
            /* "Độ tro than 3A" = cột AK của than nghiền. Than coke thì KHÔNG
               chấm độ tro và chất bốc, theo đúng yêu cầu. */
            { nhan: 'Độ tro than 3A', cot: 'AK (than nghiền)',
              huong: 'tren', nguong: 8, donVi: '%' },
        ],
    },
    {
        ten: 'Chất lượng quặng thiêu kết', bieuTuong: '⬛', nhay: 'chat-luong-quang-thieu-ket',
        ngayCol: 'Thời gian (QTK)', caCol: 'Ca/kíp (QTK)',
        phep: [
            { nhan: 'FeO', cot: 'FeO', huong: 'tren', nguong: 9, donVi: '%' },
            { nhan: 'Trống quay', cot: 'T', huong: 'duoi', nguong: 77, donVi: '%' },
            { nhan: 'Mài mòn', cot: 'A', huong: 'tren', nguong: 6, donVi: '%' },
        ],
    },
    {
        ten: 'Cỡ hạt quặng thiêu kết', bieuTuong: '📏', nhay: 'co-hat-quang-thieu-ket',
        ngayCol: 'Thời gian (QTK)', caCol: 'Ca/kíp (QTK)',
        phep: [
            { nhan: 'Cỡ hạt <5mm', cot: '< 5mm', huong: 'tren', nguong: 5, donVi: '%' },
            /* Bảng tính hiện KHÔNG có cột 5-10mm (chỉ có "< 5mm" và "> 40mm").
               Khai sẵn vài tên có thể có; tìm không thấy thì bỏ qua và ghi
               nhắc trong Console chứ không báo sai. */
            { nhan: 'Cỡ hạt 5-10mm',
              cot: ['5-10mm', '5 - 10mm', 'Cỡ hạt 5-10mm', 'Cỡ hạt 5 - 10mm'],
              huong: 'tren', nguong: 20, donVi: '%' },
        ],
    },
];

/* --- Tiện ích --- */

/** Đọc số từ ô bảng tính. Tự làm chứ KHÔNG dựa vào chart_core.js, để bảng cảnh
 *  báo vẫn đúng kể cả khi thứ tự nạp file thay đổi.
 *  Bảng tính xuất ra cả hai kiểu ngăn cách nên phải phân biệt được:
 *      "38.5"      -> 38,5   (dấu chấm là THẬP PHÂN, không phải hàng nghìn)
 *      "1.234"     -> 1234   (đúng 3 chữ số sau -> hàng nghìn)
 *      "38,5"      -> 38,5
 *      "1,234.56"  -> 1234,56
 *  Bản đầu của hàm này xoá mọi dấu chấm nên đọc "38.5" thành 385 — sai gấp 10
 *  lần, mà lại âm thầm nên rất nguy hiểm với một bảng cảnh báo. */
function cbSo(v, goiY) {
    /* Dùng chung bộ đọc số của chart_core.js: bản riêng dưới đây đọc "0,047"
       thành 47 và "6236,451" thành 6.236.451. Chỉ dùng bản riêng khi thiếu file đó. */
    if (typeof sheetNumber === 'function') return sheetNumber(v, goiY);
    if (v === undefined || v === null) return null;
    var t = String(v).trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
    if (t === '' || t === '-') return null;

    var cham = t.lastIndexOf('.');
    var phay = t.lastIndexOf(',');

    if (cham >= 0 && phay >= 0) {
        /* Có cả hai: dấu ĐỨNG SAU là thập phân, dấu kia là ngăn hàng nghìn */
        var tp = cham > phay ? '.' : ',';
        var nghin = tp === '.' ? ',' : '.';
        t = t.split(nghin).join('').replace(tp, '.');
    } else if (cham >= 0 || phay >= 0) {
        var dau = cham >= 0 ? '.' : ',';
        var sau = t.slice(t.lastIndexOf(dau) + 1);
        var motDau = t.split(dau).length === 2;
        if (motDau && /^\d{3}$/.test(sau)) {
            t = t.split(dau).join('');            // ngăn hàng nghìn
        } else {
            var cac = t.split(dau);
            t = cac.slice(0, -1).join('') + '.' + cac[cac.length - 1];   // thập phân
        }
    }

    var n = Number(t);
    return isFinite(n) ? n : null;
}

/** Dấu thập phân của cả cột (',' / '.' / null) — gợi ý cho cbSo với ô mơ hồ kiểu
 *  "2.144" (R2 TK3: 2,144 chứ không phải 2144). */
function cbDauTP(rows, cot) {
    return (cot && typeof sheetDauThapPhanCot === 'function') ? sheetDauThapPhanCot(rows, cot) : null;
}

function cbNgay(v) {
    if (typeof sheetDate === 'function') return sheetDate(v);
    var m = String(v || '').trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    return m ? { d: +m[1], m: +m[2], y: +m[3] } : null;
}

function cbTimCot(rows, ds) {
    if (!rows || !rows.length) return null;
    var keys = Object.keys(rows[0]);
    for (var i = 0; i < ds.length; i++) if (keys.indexOf(ds[i]) >= 0) return ds[i];
    return null;
}

/** Lấy giá trị của NGÀY CÓ SỐ LIỆU MỚI NHẤT trong tháng hiện tại.
 *  Ngày trong bảng tính chỉ ghi ở dòng đầu mỗi ngày (ô gộp) nên phải nhớ ngày
 *  gần nhất mà gán tiếp — giống cách chart_core đang làm. */
function cbLayMoiNhat(rows, cfg, dsColNgay, dsColLuyKe, cong) {
    if (!rows || !rows.length) return null;
    var cNgay = cbTimCot(rows, [cfg.ngayCol]);
    var cCa = cbTimCot(rows, [cfg.caCol]);

    var cacNgay = cong ? dsColNgay.slice() : [cbTimCot(rows, dsColNgay)];
    var cacLuyKe = cong ? dsColLuyKe.slice() : [cbTimCot(rows, dsColLuyKe)];
    if (!cong && !cacNgay[0]) return null;

    var now = new Date();
    var thang = now.getMonth() + 1, nam = now.getFullYear();

    var homNay = now.getDate();
    var ngay = null, cuoiCoSo = null, cuoiBatKy = null;
    var tpCot = {};
    cacNgay.concat(cacLuyKe).forEach(function (c) { if (c) tpCot[c] = cbDauTP(rows, c); });
    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && String(row[cNgay]).trim() !== '') {
            var d = cbNgay(row[cNgay]);
            if (d) ngay = d;
        }
        if (!ngay || ngay.m !== thang || ngay.y !== nam) return;
        if (ngay.d > homNay) return;          /* dòng của ngày CHƯA TỚI */
        if (cCa && !row[cCa]) return;

        var tongNgay = 0, coNgay = false;
        cacNgay.forEach(function (c) {
            if (!c) return;
            var v = cbSo(row[c], tpCot[c]);
            if (v !== null) { tongNgay += v; coNgay = true; }
        });
        if (!coNgay) return;

        var tongLuyKe = 0, coLuyKe = false;
        cacLuyKe.forEach(function (c) {
            if (!c) return;
            var v = cbSo(row[c], tpCot[c]);
            if (v !== null) { tongLuyKe += v; coLuyKe = true; }
        });

        var ban = { ngay: ngay, giaTriNgay: tongNgay,
                    giaTriLuyKe: coLuyKe ? tongLuyKe : null };
        cuoiBatKy = ban;
        if (tongNgay > 0) cuoiCoSo = ban;
    });

    /* Ưu tiên dòng CUỐI CÙNG CÓ SỐ THẬT.
       Vì sao: bảng tính dựng sẵn dòng cho CẢ THÁNG. Những ca chưa sản xuất có
       tiêu hao ngày = 0 nhưng cột luỹ kế VẪN có số (công thức kéo xuống). Lấy
       dòng cuối cùng bất kể giá trị thì ra "ngày 0,00 | luỹ kế 38,70" — đúng
       cái đang thấy trên bảng.
       Chỉ khi cả tháng không có số nào > 0 mới chịu lấy dòng cuối. */
    return cuoiCoSo || cuoiBatKy;
}

/** Chấm một chỉ tiêu cho cả 2 dây chuyền.
 *  Ba kiểu lấy số:
 *    - mặc định : lấy cột đầu tiên tìm thấy
 *    - cong     : CỘNG các cột rồi mới so ngưỡng   (tỉ lệ quặng hồi)
 *    - tach     : chấm RIÊNG từng cột, cùng ngưỡng (than: Ccd và nhiệt trị) */
function cbChamChiTieu(ct) {
    var ra = { ten: ct.ten, bieuTuong: ct.bieuTuong, nhay: ct.nhay,
               nguong: ct.nguong, day: [], viPham: 0, thieuCot: false };

    /* Quy về CÙNG một dạng: mỗi phép đo có nhãn + cột ngày + cột luỹ kế */
    var pheps = ct.tach
        ? ct.tach.map(function (t) { return { nhan: t.nhan, ngay: [t.ngay], luyKe: [t.luyKe] }; })
        : [{ nhan: '', ngay: ct.colNgay, luyKe: ct.colLuyKe }];

    [['TK3', window.masterSheetDataTK3], ['TK4', window.masterSheetDataTK4]]
    .forEach(function (cap) {
        pheps.forEach(function (p) {
            var d = cbLayMoiNhat(cap[1], ct, p.ngay, p.luyKe, ct.cong);
            if (!d) { ra.thieuCot = true; return; }

            var loi = [];
            if (d.giaTriNgay !== null && d.giaTriNgay > ct.nguong.ngay) {
                loi.push({ loai: 'ngày', giaTri: d.giaTriNgay, nguong: ct.nguong.ngay });
            }
            if (d.giaTriLuyKe !== null && d.giaTriLuyKe > ct.nguong.luyKe) {
                loi.push({ loai: 'luỹ kế', giaTri: d.giaTriLuyKe, nguong: ct.nguong.luyKe });
            }
            ra.viPham += loi.length;
            ra.day.push({ ten: cap[0], nhan: p.nhan, ngay: d.ngay,
                          giaTriNgay: d.giaTriNgay, giaTriLuyKe: d.giaTriLuyKe, loi: loi });
        });
    });
    return ra;
}

/** Lấy giá trị của N NGÀY GẦN NHẤT có số liệu, trong tháng hiện tại.
 *  Mỗi ngày lấy giá trị của ca CUỐI CÙNG có số. Dùng cho cả phép so ngưỡng
 *  (chỉ cần ngày mới nhất) lẫn phép dao động (cần thêm ngày liền trước). */
function cbLayNgayGanNhat(rows, cfg, dsCot, soNgay) {
    if (!rows || !rows.length) return null;
    var cNgay = cbTimCot(rows, [cfg.ngayCol]);
    var cCa = cbTimCot(rows, [cfg.caCol]);
    var cot = cbTimCot(rows, Array.isArray(dsCot) ? dsCot : [dsCot]);
    if (!cot) return null;

    var now = new Date();
    var thang = now.getMonth() + 1, nam = now.getFullYear();
    var homNay = now.getDate();

    var theoNgay = {}, thuTu = [];
    var ngay = null;
    var tp = cbDauTP(rows, cot);
    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && String(row[cNgay]).trim() !== '') {
            var d = cbNgay(row[cNgay]);
            if (d) ngay = d;
        }
        if (!ngay || ngay.m !== thang || ngay.y !== nam) return;
        if (ngay.d > homNay) return;          /* dòng của ngày CHƯA TỚI */
        if (cCa && !row[cCa]) return;
        var v = cbSo(row[cot], tp);
        if (v === null) return;
        /* Bỏ qua ô = 0: với chỉ tiêu chất lượng, 0 nghĩa là CHƯA LẤY MẪU chứ
           không phải kết quả thật (không có mẫu nào %CaO = 0). */
        if (v === 0) return;
        var k = ngay.d;
        if (theoNgay[k] === undefined) thuTu.push(k);
        theoNgay[k] = { ngay: { d: ngay.d, m: ngay.m, y: ngay.y }, giaTri: v };
    });

    thuTu.sort(function (a, b) { return b - a; });          // mới nhất trước
    return thuTu.slice(0, soNgay || 1).map(function (k) { return theoNgay[k]; });
}

/** Chấm một phép đo chất lượng cho một dây chuyền. */
function clChamPhep(rows, ct, p) {
    var canNgay = p.huong === 'daoDong' ? 2 : 1;
    var ds = cbLayNgayGanNhat(rows, ct, p.cot, canNgay);
    if (!ds || !ds.length) return null;

    var moi = ds[0];
    var ra = { nhan: p.nhan, donVi: p.donVi, nguong: p.nguong, huong: p.huong,
               ngay: moi.ngay, giaTri: moi.giaTri, loi: null };

    if (p.nguong === null || p.nguong === undefined) return ra;   // đang tắt

    if (p.huong === 'tren') {
        if (moi.giaTri > p.nguong) {
            ra.loi = 'vượt ' + cbLamTron(moi.giaTri) + ' > ' + p.nguong + p.donVi;
        }
    } else if (p.huong === 'duoi') {
        if (moi.giaTri < p.nguong) {
            ra.loi = 'tụt ' + cbLamTron(moi.giaTri) + ' < ' + p.nguong + p.donVi;
        }
    } else if (p.huong === 'daoDong') {
        if (ds.length < 2) {
            ra.thieuNgay = true;              // chưa đủ 2 ngày để so
        } else {
            var truoc = ds[1];
            ra.truoc = truoc;
            ra.chenh = Math.abs(moi.giaTri - truoc.giaTri);
            if (ra.chenh >= p.nguong) {
                ra.loi = 'dao động ' + cbLamTron(ra.chenh) + p.donVi
                    + ' (' + cbLamTron(truoc.giaTri) + ' ngày ' + truoc.ngay.d
                    + ' → ' + cbLamTron(moi.giaTri) + ' ngày ' + moi.ngay.d + ')'
                    + ' >= ' + p.nguong + p.donVi;
            }
        }
    }
    return ra;
}

/** Chấm một chỉ tiêu chất lượng cho cả 2 dây chuyền. */
function clChamChiTieu(ct) {
    var ra = { ten: ct.ten, bieuTuong: ct.bieuTuong, nhay: ct.nhay,
               day: [], viPham: 0, thieuCot: [] };

    [['TK3', window.masterSheetDataTK3], ['TK4', window.masterSheetDataTK4]]
    .forEach(function (cap) {
        ct.phep.forEach(function (p) {
            var kq = clChamPhep(cap[1], ct, p);
            if (!kq) {
                if (ra.thieuCot.indexOf(p.nhan) < 0) ra.thieuCot.push(p.nhan);
                return;
            }
            if (kq.loi) ra.viPham += 1;
            kq.day = cap[0];
            ra.day.push(kq);
        });
    });
    return ra;
}

/** Gom các NGÀY mà bảng đang lấy số. Thường chỉ một ngày, nhưng nếu hai dây
 *  nhập lệch nhau thì liệt kê hết để không hiểu nhầm. */
function cbNgayXet(kqs) {
    var ds = [];
    kqs.forEach(function (k) {
        (k.day || []).forEach(function (d) {
            if (!d.ngay) return;
            var t = d.ngay.d + '/' + d.ngay.m;
            if (ds.indexOf(t) < 0) ds.push(t);
        });
    });
    ds.sort(function (a, b) { return parseInt(b, 10) - parseInt(a, 10); });
    return ds.length ? ds.join(', ') : null;
}

/* --- Dựng giao diện --- */

var cbEl = function (tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
};

var cbLamTron = function (v, le) {
    return (v === null || !isFinite(v)) ? '--'
        : v.toLocaleString('vi-VN', { minimumFractionDigits: le === undefined ? 2 : le,
                                      maximumFractionDigits: le === undefined ? 2 : le });
};

function cbNhayToi(id) {
    /* Mục con đang bị ẩn, phải mở qua đúng hàm của trang rồi mới cuộn tới */
    if (typeof showSubContent === 'function') showSubContent(id);
    var el = document.getElementById(id);
    if (el && el.scrollIntoView) {
        setTimeout(function () { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    }
}

/** Một dòng chỉ tiêu trong bảng cảnh báo. */
function cbDungDong(kq) {
    var vp = kq.viPham > 0;
    var dong = cbEl('button', 'cb-row' + (vp ? ' is-vuot' : ' is-ok'));
    dong.type = 'button';
    dong.addEventListener('click', function () { cbNhayToi(kq.nhay); });

    dong.appendChild(cbEl('span', 'cb-row__ico', vp ? '🔺' : '✅'));

    var giua = cbEl('div', 'cb-row__mid');
    giua.appendChild(cbEl('span', 'cb-row__ten', kq.bieuTuong + ' ' + kq.ten));

    if (kq.thieuCot && !kq.day.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu', 'Chưa lấy được số liệu tháng này'));
    } else {
        var chiTiet = cbEl('div', 'cb-row__chitiet');
        kq.day.forEach(function (d) {
            var o = cbEl('span', 'cb-chip' + (d.loi.length ? ' is-vuot' : ''));
            /* GHI RÕ NGÀY: bảng này nhận xét cho NGÀY GẦN NHẤT CÓ SỐ LIỆU, không
               phải hôm nay. Hai dây có thể lệch ngày nhau nên phải ghi từng ô. */
            var mo = d.ten + (d.nhan ? ' (' + d.nhan + ')' : '')
                + ' ' + d.ngay.d + '/' + d.ngay.m + ': '
                + cbLamTron(d.giaTriNgay) + ' ' + kq.nguong.donVi;
            if (d.giaTriLuyKe !== null) {
                mo += '  |  luỹ kế ' + cbLamTron(d.giaTriLuyKe) + ' ' + kq.nguong.donVi;
            }
            o.textContent = mo;
            chiTiet.appendChild(o);
        });
        giua.appendChild(chiTiet);

        if (vp) {
            var ly = [];
            kq.day.forEach(function (d) {
                d.loi.forEach(function (l) {
                    /* l.loai = 'ngày' hoặc 'luỹ kế'. Ghi "ngày 22/8 — ngày 52"
                       thì chữ "ngày" lặp hai lần, đọc rối. */
                    ly.push(d.ten + (d.nhan ? ' ' + d.nhan : '')
                        + ' ' + d.ngay.d + '/' + d.ngay.m + ' — '
                        + (l.loai === 'ngày' ? 'tiêu hao ngày' : 'luỹ kế')
                        + ' ' + cbLamTron(l.giaTri) + ' > ngưỡng ' + l.nguong);
                });
            });
            giua.appendChild(cbEl('span', 'cb-row__phu', ly.join(' · ')));
        } else {
            giua.appendChild(cbEl('span', 'cb-row__phu',
                'Trong ngưỡng (ngày ≤ ' + kq.nguong.ngay
                + ', luỹ kế ≤ ' + kq.nguong.luyKe + ' ' + kq.nguong.donVi + ')'));
        }
    }

    dong.appendChild(giua);
    dong.appendChild(cbEl('span', 'cb-row__mui', '›'));
    return dong;
}

/** Bảng trợ dung — chỉ hiện số ngày gần nhất, không chấm ngưỡng. */
function cbDungTroDung() {
    var C = CB_TRO_DUNG;
    var box = cbEl('div', 'cb-trodung');

    var dau = cbEl('button', 'cb-trodung__dau');
    dau.type = 'button';
    dau.appendChild(cbEl('span', null, C.bieuTuong + ' ' + C.ten));
    dau.appendChild(cbEl('span', 'cb-row__mui', '›'));
    dau.addEventListener('click', function () { cbNhayToi(C.nhay); });
    box.appendChild(dau);

    var bang = cbEl('table', 'cb-bang');
    var thead = cbEl('thead');
    var hr = cbEl('tr');
    ['Loại', 'Dây chuyền', 'Ngày gần nhất', 'Luỹ kế tháng'].forEach(function (t) {
        hr.appendChild(cbEl('th', null, t));
    });
    thead.appendChild(hr);
    bang.appendChild(thead);

    var tbody = cbEl('tbody');
    var coDL = false;
    C.dong.forEach(function (m) {
        [['TK3', window.masterSheetDataTK3], ['TK4', window.masterSheetDataTK4]]
        .forEach(function (cap) {
            var d = cbLayMoiNhat(cap[1], C, [m.ngay], [m.luyKe], false);
            var tr = cbEl('tr');
            tr.appendChild(cbEl('td', null, m.nhan));
            tr.appendChild(cbEl('td', null, cap[0]));
            if (d) {
                coDL = true;
                tr.appendChild(cbEl('td', 'cb-so',
                    cbLamTron(d.giaTriNgay) + '  (' + d.ngay.d + '/' + d.ngay.m + ')'));
                tr.appendChild(cbEl('td', 'cb-so', cbLamTron(d.giaTriLuyKe)));
            } else {
                tr.appendChild(cbEl('td', 'cb-so', '--'));
                tr.appendChild(cbEl('td', 'cb-so', '--'));
            }
            tbody.appendChild(tr);
        });
    });
    bang.appendChild(tbody);

    if (!coDL) {
        box.appendChild(cbEl('p', 'cb-trong', 'Chưa lấy được số liệu trợ dung tháng này'));
    } else {
        box.appendChild(bang);
    }
    return box;
}

/** Một dòng chỉ tiêu trong bảng CHẤT LƯỢNG. */
function clDungDong(kq) {
    var vp = kq.viPham > 0;
    var dong = cbEl('button', 'cb-row' + (vp ? ' is-vuot' : ' is-ok'));
    dong.type = 'button';
    dong.addEventListener('click', function () { cbNhayToi(kq.nhay); });

    dong.appendChild(cbEl('span', 'cb-row__ico', vp ? '🔺' : '✅'));

    var giua = cbEl('div', 'cb-row__mid');
    giua.appendChild(cbEl('span', 'cb-row__ten', kq.bieuTuong + ' ' + kq.ten));

    if (!kq.day.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu', 'Chưa lấy được số liệu tháng này'));
    } else {
        var chiTiet = cbEl('div', 'cb-row__chitiet');
        kq.day.forEach(function (d) {
            var o = cbEl('span', 'cb-chip' + (d.loi ? ' is-vuot' : ''));
            var mo = d.day + ' ' + d.nhan + ' ' + d.ngay.d + '/' + d.ngay.m + ': ';
            if (d.huong === 'daoDong' && d.chenh !== undefined) {
                mo += 'lệch ' + cbLamTron(d.chenh) + d.donVi;
            } else {
                mo += cbLamTron(d.giaTri) + d.donVi;
            }
            if (d.nguong === null || d.nguong === undefined) mo += '  (chưa đặt ngưỡng)';
            o.textContent = mo;
            chiTiet.appendChild(o);
        });
        giua.appendChild(chiTiet);

        if (vp) {
            var ly = kq.day.filter(function (d) { return d.loi; })
                .map(function (d) { return d.day + ' ' + d.nhan + ' ' + d.loi; });
            giua.appendChild(cbEl('span', 'cb-row__phu', ly.join(' · ')));
        } else {
            giua.appendChild(cbEl('span', 'cb-row__phu', 'Trong ngưỡng'));
        }
    }

    if (kq.thieuCot.length) {
        giua.appendChild(cbEl('span', 'cb-row__phu',
            'Chưa có cột trong bảng tính: ' + kq.thieuCot.join(', ')));
    }

    dong.appendChild(giua);
    dong.appendChild(cbEl('span', 'cb-row__mui', '›'));
    return dong;
}

/** Dựng bảng cảnh báo CHẤT LƯỢNG. */
function veCanhBaoChatLuong() {
    var sec = document.getElementById('chat-luong');
    if (!sec) return;

    var cu = document.getElementById('cb-chat-luong');
    if (cu) cu.remove();

    var box = cbEl('section', 'cb-box');
    box.id = 'cb-chat-luong';

    var kqs = CL_CHI_TIEU.map(clChamChiTieu);
    var soVuot = kqs.filter(function (k) { return k.viPham > 0; }).length;

    var h = cbEl('h3', 'cb-box__title');
    var now = new Date();
    h.appendChild(cbEl('span', null,
        'CẦN CHÚ Ý — THÁNG ' + (now.getMonth() + 1) + '/' + now.getFullYear()));
    h.appendChild(cbEl('span', 'cb-box__dem' + (soVuot ? ' is-vuot' : ''),
        soVuot ? soVuot + ' chỉ tiêu vượt ngưỡng' : 'Tất cả trong ngưỡng'));
    box.appendChild(h);

    var ngayXet = cbNgayXet(kqs);
    box.appendChild(cbEl('p', 'cb-ngay',
        ngayXet ? 'Số liệu ngày gần nhất: ' + ngayXet
                : 'Chưa có số liệu trong tháng'));

    var ds = cbEl('div', 'cb-list');
    kqs.filter(function (k) { return k.viPham > 0; })
       .forEach(function (k) { ds.appendChild(clDungDong(k)); });
    kqs.filter(function (k) { return k.viPham === 0; })
       .forEach(function (k) { ds.appendChild(clDungDong(k)); });
    box.appendChild(ds);

    box.appendChild(cbEl('p', 'cb-ghichu',
        'Bấm một dòng để mở biểu đồ chi tiết. Ngưỡng đặt tại CL_CHI_TIEU trong canhbao.js.'));

    var header = sec.querySelector('.section-header');
    if (header && header.nextSibling) sec.insertBefore(box, header.nextSibling);
    else sec.appendChild(box);

    /* Nhắc những cột chưa tìm thấy, để biết mà bổ sung vào bảng tính */
    var thieu = [];
    kqs.forEach(function (k) {
        k.thieuCot.forEach(function (t) { thieu.push(k.ten + ' → ' + t); });
    });
    if (thieu.length) {
        console.warn('[Cảnh báo chất lượng] Chưa tìm thấy cột cho: ' + thieu.join(' | ')
            + '. Xem tên cột thật bằng: Object.keys(window.masterSheetDataTK3[0])');
    }
    cbSauKhiDung(CB_MUC[1]);

    console.info('[Cảnh báo chất lượng] ' + soVuot + ' vượt ngưỡng, '
        + (kqs.length - soVuot) + ' trong ngưỡng.');
}

/** Dựng toàn bộ bảng cảnh báo. */
function veCanhBaoTieuHao() {
    var sec = document.getElementById('tieu-hao-san-xuat');
    if (!sec) return;

    var cu = document.getElementById('cb-tieu-hao');
    if (cu) cu.remove();

    var box = cbEl('section', 'cb-box');
    box.id = 'cb-tieu-hao';

    var kqs = CB_CHI_TIEU.map(cbChamChiTieu);
    var soVuot = kqs.filter(function (k) { return k.viPham > 0; }).length;
    var soOk = kqs.length - soVuot;

    /* Tiêu đề: nói ngay có mấy chỉ tiêu vượt */
    var h = cbEl('h3', 'cb-box__title');
    var now = new Date();
    h.appendChild(cbEl('span', null,
        'CẦN CHÚ Ý — THÁNG ' + (now.getMonth() + 1) + '/' + now.getFullYear()));
    h.appendChild(cbEl('span', 'cb-box__dem' + (soVuot ? ' is-vuot' : ''),
        soVuot ? soVuot + ' chỉ tiêu vượt ngưỡng' : 'Tất cả trong ngưỡng'));
    box.appendChild(h);

    /* Nói rõ đang nhận xét cho NGÀY NÀO — không phải lúc nào cũng là hôm nay,
       vì bảng tính có thể nhập chậm vài ngày. */
    var ngayXet = cbNgayXet(kqs);
    box.appendChild(cbEl('p', 'cb-ngay',
        ngayXet ? 'Số liệu ngày gần nhất: ' + ngayXet
                : 'Chưa có số liệu trong tháng'));

    /* Vượt ngưỡng lên trước, đạt xuống sau */
    var ds = cbEl('div', 'cb-list');
    kqs.filter(function (k) { return k.viPham > 0; })
       .forEach(function (k) { ds.appendChild(cbDungDong(k)); });
    kqs.filter(function (k) { return k.viPham === 0; })
       .forEach(function (k) { ds.appendChild(cbDungDong(k)); });
    box.appendChild(ds);

    box.appendChild(cbDungTroDung());
    box.appendChild(cbEl('p', 'cb-ghichu',
        'Bấm một dòng để mở biểu đồ chi tiết. Ngưỡng đặt tại NGUONG trong canhbao.js.'));

    /* Chèn NGAY SAU tiêu đề mục, trước dòng "Mở menu và chọn..." */
    var header = sec.querySelector('.section-header');
    if (header && header.nextSibling) sec.insertBefore(box, header.nextSibling);
    else sec.appendChild(box);

    cbSauKhiDung(CB_MUC[0]);

    console.info('[Cảnh báo tiêu hao] ' + soVuot + ' vượt ngưỡng, ' + soOk + ' trong ngưỡng.');
}

/* =============================================================================
 * ẨN / HIỆN BẢNG TỔNG HỢP
 * -----------------------------------------------------------------------------
 * Mong muốn:
 *   - Bấm "Tiêu hao sản xuất" trên thanh trên  -> CHỈ hiện bảng tổng hợp
 *   - Chọn một mục trong menu bên              -> ẨN bảng, chỉ còn biểu đồ
 *
 * showSubContent trong sidebar.js chỉ ẩn .chart-group và .intro-msgs, không biết
 * tới bảng này nên nó cứ nằm lại. Ở đây BỌC hàm đó: vẫn chạy y nguyên phần gốc,
 * chỉ thêm việc ẩn bảng sau khi xong.
 * ===========================================================================*/

/* Mỗi mục có một bảng tổng hợp riêng, cùng cách ẩn/hiện */
var CB_MUC = [
    { sec: 'tieu-hao-san-xuat', box: 'cb-tieu-hao', menu: 'sidebar-menu-tieu-hao' },
    { sec: 'chat-luong', box: 'cb-chat-luong', menu: 'sidebar-menu-chat-luong' },
];

function cbHien(m, hien) {
    var box = document.getElementById(m.box);
    if (box) box.style.display = hien ? '' : 'none';

    /* Dòng "Mở menu và chọn để xem dữ liệu": bảng tổng hợp đã thay vai trò đó */
    var sec = document.getElementById(m.sec);
    if (sec) {
        sec.querySelectorAll('.intro-msgs').forEach(function (t) {
            t.style.display = hien ? 'none' : t.style.display;
        });
    }
}

/** Về lại màn tổng hợp của một mục: ẩn hết biểu đồ, hiện lại bảng. */
function cbVeTongHop(m) {
    var sec = document.getElementById(m.sec);
    if (!sec) return;
    sec.querySelectorAll('.chart-group').forEach(function (g) { g.style.display = 'none'; });
    cbHien(m, true);
    var menu = document.getElementById(m.menu);
    if (menu) {
        menu.querySelectorAll('a').forEach(function (x) { x.classList.remove('is-dang-xem'); });
        var mi = menu.querySelector('.cb-menu-item');
        if (mi) mi.classList.add('is-dang-xem');
    }
    var box = document.getElementById(m.box);
    if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Bọc showSubContent — chạy MỘT LẦN, và chỉ khi hàm gốc đã tồn tại. */
var cbDaBoc = false;
function cbBocShowSub() {
    if (cbDaBoc || typeof window.showSubContent !== 'function') return;
    var goc = window.showSubContent;
    window.showSubContent = function (contentId) {
        goc.apply(this, arguments);              // giữ nguyên hành vi cũ
        var t = document.getElementById(contentId);
        if (!t) return;
        /* Chỉ ẩn bảng của ĐÚNG mục chứa nhóm vừa mở. Mở nhóm bên Chất lượng thì
           bảng Tiêu hao không liên quan, và ngược lại. */
        CB_MUC.forEach(function (m) {
            var sec = document.getElementById(m.sec);
            if (sec && sec.contains(t)) {
                cbHien(m, false);
                var menu = document.getElementById(m.menu);
                var mi = menu && menu.querySelector('.cb-menu-item');
                if (mi) mi.classList.remove('is-dang-xem');
            }
        });
    };
    cbDaBoc = true;
}

/** Bấm tên mục trên thanh trên -> về màn tổng hợp của mục đó. */
function cbBatLinkThanhTren() {
    CB_MUC.forEach(function (m) {
        document.querySelectorAll('a[href="#' + m.sec + '"]').forEach(function (a) {
            if (a.dataset.cbDaGan) return;
            a.dataset.cbDaGan = '1';
            a.addEventListener('click', function () {
                setTimeout(function () { cbVeTongHop(m); }, 80);
            });
        });
    });
}

/** Thêm mục "Bảng nhận xét" lên ĐẦU menu bên, để quay lại bảng tổng hợp mà
 *  không phải bấm lên thanh trên. Dựng bằng JS nên không phải sửa index.html. */
function cbThemMucMenu(m) {
    var menu = document.getElementById(m.menu);
    if (!menu || menu.querySelector('.cb-menu-item')) return;

    var a = document.createElement('a');
    a.href = 'javascript:void(0)';
    a.className = 'cb-menu-item';
    a.textContent = '📋 Bảng nhận xét';
    a.addEventListener('click', function () { cbVeTongHop(m); });
    menu.insertBefore(a, menu.firstChild);
}

/** Sau khi dựng xong một bảng: nối sự kiện và quyết định hiện hay ẩn. */
function cbSauKhiDung(m) {
    var sec = document.getElementById(m.sec);
    if (!sec) return;

    /* Dọn nút "Quay lại" của bản cũ nếu trình duyệt còn giữ */
    sec.querySelectorAll('.cb-quaylai').forEach(function (n) { n.remove(); });

    cbBocShowSub();
    cbBatLinkThanhTren();
    cbThemMucMenu(m);

    /* Chưa chọn nhóm nào thì hiện bảng, đã chọn rồi thì để nguyên */
    var dangMo = null;
    sec.querySelectorAll('.chart-group').forEach(function (g) {
        if (g.style.display && g.style.display !== 'none') dangMo = g;
    });
    cbHien(m, !dangMo);
}

/* Đủ cả 2 dây mới chấm, vì mọi chỉ tiêu đều so cả TK3 lẫn TK4 */
var cbSan = { tk3: false, tk4: false };
function cbThu() {
    if (!cbSan.tk3 || !cbSan.tk4) return;
    try { veCanhBaoTieuHao(); } catch (e) { console.error('[Cảnh báo tiêu hao]', e); }
    try { veCanhBaoChatLuong(); } catch (e) { console.error('[Cảnh báo chất lượng]', e); }
}
document.addEventListener('TK3DataReady', function () { cbSan.tk3 = true; cbThu(); });
document.addEventListener('TK4DataReady', function () { cbSan.tk4 = true; cbThu(); });
