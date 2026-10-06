/* XTK2-CHISO v1 — js/chung/chi_so.js
 * =============================================================================
 * CÔNG THỨC VÀ NGƯỠNG CẢNH BÁO — DÙNG CHUNG CHO TRÌNH DUYỆT VÀ MÁY CHỦ
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Mọi phép TÍNH của trang chủ nằm ở đây, và CHỈ ở đây:
 *     - dải chỉ số tổng quan: sản lượng tháng, % đạt kế hoạch, hệ số lợi dụng;
 *     - sản lượng từng ngày (4 thẻ mục Sản lượng + biểu đồ sản lượng tháng);
 *     - 3 bảng cảnh báo: Tiêu hao, Trợ dung, Chất lượng (ngưỡng + cách chấm).
 *   Phần VẼ lên màn hình thì ở chart_cook.js (dải chỉ số, sản lượng) và
 *   canhbao.js (bảng cảnh báo).
 *
 * MUỐN ĐỔI NGƯỠNG CẢNH BÁO / CÔNG THỨC?
 *   Sửa ngay trong file này rồi deploy:
 *     NGUONG          ngưỡng tiêu hao than, điện, khí than, quặng hồi
 *     CL_CHI_TIEU     ngưỡng chất lượng (FeO, %CaO, cỡ hạt...)
 *     RIBBON_CFG      tên cột sản lượng, diện tích máy, cách đếm ngày của hệ số lợi dụng
 *   Trình duyệt và máy chủ cùng đổi theo.
 *
 * CHẠY Ở HAI NƠI — CÙNG MỘT FILE
 *   - Trình duyệt: index.html nạp như script thường (trước chart_core.js) —
 *     mọi hàm / biến bên dưới thành biến toàn cục.
 *   - Máy chủ: db/chi-so.mjs import file này, tính sẵn rồi trả /api/v2/chi-so.
 *     Trang chủ hiện số ngay từ gói ~4 KB đó, không phải đợi tải số liệu TK3/TK4.
 *   Hai nơi chạy cùng một mã nên KHÔNG THỂ lệch nhau.
 *
 * QUY ƯỚC ĐỂ CHẠY ĐƯỢC Ở CẢ HAI NƠI
 *   - Không đụng window / document. "Hôm nay" (now) và số liệu (rows3, rows4)
 *     luôn truyền vào qua tham số — máy chủ chạy giờ UTC nên phải tự đổi sang giờ
 *     Việt Nam trước khi gọi (gioVN trong db/chi-so.mjs).
 *   - Không dùng toLocaleString: máy chủ không chắc có dữ liệu định dạng tiếng
 *     Việt -> dùng soVN() bên dưới, cho ra đúng chuỗi như vi-VN.
 *
 * "rows3", "rows4" LÀ GÌ
 *   Bảng tính TK3 / TK4 dạng mảng hàng: [{ 'tên cột': 'giá trị ô', ... }, ...] —
 *   đúng như window.masterSheetDataTK3 / TK4 ở trình duyệt.
 *
 * BỐ CỤC FILE
 *   1. soVN — định dạng số kiểu Việt Nam
 *   2. Đọc số / ngày từ ô bảng tính (sheetNumber...)
 *   3. Dải chỉ số trang chủ (RIBBON_CFG, ribbonQuet, tinhRibbon...)
 *   4. Bảng cảnh báo tiêu hao / trợ dung / chất lượng (NGUONG, CB_*, CL_*)
 *   5. tinhChiSo — một lần gọi tính hết cho trang chủ (máy chủ dùng)
 *   6. Xuất ra cho máy chủ (globalThis.XTK2_CHI_SO)
 * ===========================================================================*/

/* =============================================================================
 * 1. ĐỊNH DẠNG SỐ KIỂU VIỆT NAM
 * ===========================================================================*/

/** Định dạng số kiểu vi-VN ("1.234,5") mà không cần Intl — cho ra y hệt
 *    v.toLocaleString('vi-VN', { minimumFractionDigits: minLe, maximumFractionDigits: maxLe })
 *  minLe: số chữ số lẻ TỐI THIỂU (thêm 0 cho đủ); maxLe: TỐI ĐA (làm tròn).
 *    soVN(1234.5, 0, 2) -> '1.234,5'      soVN(1234.5, 2) -> '1.234,50'
 *
 *  Làm tròn trên dạng THẬP PHÂN NGẮN NHẤT của số, như Intl:
 *    String(300.075) = "300.075" -> làm tròn 2 số lẻ -> "300,08".
 *  (toFixed làm tròn trên giá trị nhị phân thật 300.07499999... -> "300,07",
 *  lệch với toLocaleString — nên không dùng toFixed.) */
function soVN(v, minLe, maxLe) {
    if (maxLe === undefined) maxLe = minLe;
    const am = v < 0 || Object.is(v, -0);
    let s = String(Math.abs(v));
    /* Số rất lớn / rất nhỏ String() viết dạng '1e-7' -> viết lại đủ chữ số */
    if (/e/i.test(s)) s = Math.abs(v).toFixed(Math.max(maxLe, 20)).replace(/0+$/, '');
    let [nguyen, le] = s.split('.');
    le = le || '';
    if (le.length > maxLe) {
        /* Làm tròn "bằng tay" trên dãy chữ số: chữ số bị cắt >= 5 thì cộng 1 vào
           chữ số cuối được giữ, nhớ sang trái khi gặp 9 (vd 9,996 -> 10,00) */
        const len = le.charAt(maxLe) >= '5';
        let chu = (nguyen + le.slice(0, maxLe)).split('');
        if (len) {
            let i = chu.length - 1;
            while (i >= 0 && chu[i] === '9') { chu[i] = '0'; i--; }
            if (i < 0) chu.unshift('1'); else chu[i] = String(+chu[i] + 1);
        }
        chu = chu.join('');
        nguyen = chu.slice(0, chu.length - maxLe) || '0';
        le = chu.slice(chu.length - maxLe);
    }
    while (le.length < minLe) le += '0';                                     /* thêm 0 cho đủ minLe */
    while (le.length > minLe && le.charAt(le.length - 1) === '0') le = le.slice(0, -1);  /* bỏ 0 thừa */
    nguyen = nguyen.replace(/\B(?=(\d{3})+(?!\d))/g, '.');                  /* chấm ngăn hàng nghìn */
    return (am ? '-' : '') + nguyen + (le ? ',' + le : '');
}

/* =============================================================================
 * 2. ĐỌC SỐ VÀ NGÀY TỪ Ô BẢNG TÍNH
 * -----------------------------------------------------------------------------
 * VẤN ĐỀ: bảng tính của xưởng xuất ra CẢ HAI kiểu viết số, tuỳ ô — kiểu Mỹ
 * ("5,854.00") và kiểu Việt ("5.930,000"). Thậm chí trong CÙNG một sheet mỗi
 * cột một kiểu (TK4: sản lượng "5.930,000", "6236,451", "6299"; hệ số biến
 * thiên "0,047"; cỡ hạt "97.23").
 *
 * Cách cũ `Number(v.replace(',', '.'))` chỉ đổi DẤU PHẨY ĐẦU TIÊN nên gãy với
 * mọi số có ngăn hàng nghìn:
 *      "5,854.00"   -> "5.854.00"  -> NaN
 *      "5.930,000"  -> NaN
 *      "313,000.00" -> NaN
 *
 * QUY TẮC ĐOÁN DẤU THẬP PHÂN:
 *   1) Có cả '.' và ',' -> dấu ĐỨNG SAU là thập phân, dấu kia ngăn hàng nghìn.
 *   2) Một loại dấu, xuất hiện NHIỀU lần ("1.234.567") -> ngăn hàng nghìn.
 *   3) Một dấu duy nhất -> là THẬP PHÂN nếu không thể là ngăn hàng nghìn:
 *        - sau dấu không đúng 3 chữ số        "85,48"    -> 85,48
 *        - phần nguyên là 0 hoặc trống         "0,047"    -> 0,047
 *        - phần nguyên dài hơn 3 chữ số        "6236,451" -> 6236,451
 *          (ngăn hàng nghìn thật thì phải viết "6,236,451")
 *   4) Còn lại mới thật sự mơ hồ ("1,500": 1,5 hay 1500?) -> theo dấu thập phân
 *      mà ĐA SỐ ô cùng CỘT dùng (sheetDauThapPhanCot); không có gợi ý thì coi
 *      là ngăn hàng nghìn.
 *
 * LỖI ĐÃ GẶP: bản cũ chỉ xét "đúng 3 chữ số sau dấu" nên đọc "6236,451" (TK4 ca
 * A 16/09) thành 6.236.451 tấn -> luỹ kế tháng vọt lên 6,6 triệu tấn, tỉ lệ đạt
 * 1.070%, hệ số lợi dụng TK4 43,8. Và "0,047" thành 47.
 *
 * db/chuan-hoa.mjs (docSo) CHÉP Y thuật toán này — sửa ở đây thì sửa cả bên đó.
 * ===========================================================================*/

/** Đọc một ô thành số, hoặc null nếu không phải số.
 *  dauThapPhan: gợi ý của cột ('.' / ',' / null) cho ô mơ hồ — quy tắc 4. */
function sheetNumber(v, dauThapPhan) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    let t = v.toString().trim().replace(/\s/g, '');
    if (t === '') return null;
    t = t.replace(/[^\d.,-]/g, '');            // bỏ đơn vị, %, ký tự lạ
    if (t === '' || t === '-') return null;

    const cham = t.lastIndexOf('.');
    const phay = t.lastIndexOf(',');
    let tp = '';                               // dấu thập phân, '' = số nguyên

    if (cham >= 0 && phay >= 0) {
        tp = cham > phay ? '.' : ',';          // quy tắc 1
    } else if (cham >= 0 || phay >= 0) {
        const dau = cham >= 0 ? '.' : ',';
        if (sheetLaDauThapPhan(t, dau, dauThapPhan)) tp = dau;
    }

    /* Bỏ dấu ngăn hàng nghìn, đổi dấu thập phân thành '.' để Number() hiểu */
    const nghin = tp === '.' ? ',' : tp === ',' ? '.' : null;
    if (nghin) t = t.split(nghin).join('');
    else t = t.split('.').join('').split(',').join('');
    if (tp) t = t.replace(tp, '.');

    const n = Number(t);
    return Number.isFinite(n) ? n : null;
}

/** Chuỗi t chỉ có MỘT loại dấu `dau`: dấu đó là thập phân (true) hay ngăn hàng
 *  nghìn (false)? Áp quy tắc 2, 3, 4 ở trên. goiY: gợi ý của cột. */
function sheetLaDauThapPhan(t, dau, goiY) {
    const phan = t.replace(/^-/, '').split(dau);
    if (phan.length > 2) return false;                     // quy tắc 2
    const nguyen = phan[0], le = phan[1];
    if (le.length !== 3) return true;                      // quy tắc 3
    if (/^0*$/.test(nguyen) || nguyen.length > 3) return true;
    if (goiY) return goiY === dau;                         // quy tắc 4
    return false;
}

/** Dò xem CỘT `cot` dùng dấu nào làm thập phân, dựa trên các ô KHÔNG mơ hồ: mỗi
 *  ô "bỏ phiếu" một lần. Ra ',' / '.' / null (hoà, không đủ căn cứ).
 *  Dùng làm gợi ý cho sheetNumber khi gặp ô mơ hồ kiểu "1,500". */
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

/** Đọc ngày kiểu dd/mm/yyyy (định dạng bảng tính đang dùng; nhận cả - và .).
 *  Ra { d, m, y } (số), hoặc null nếu sai dạng. */
function sheetDate(v) {
    if (!v) return null;
    const m = v.toString().trim().match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (!m) return null;
    const d = +m[1], th = +m[2], y = +m[3];
    if (d < 1 || d > 31 || th < 1 || th > 12) return null;
    return { d: d, m: th, y: y };
}

/** Số ngày của tháng (1..12) trong năm nam, có xét năm nhuận. */
function soNgayTrongThang(thang, nam) {
    return new Date(nam, thang, 0).getDate();
}

/* =============================================================================
 * 3. DẢI CHỈ SỐ TỔNG QUAN TRANG CHỦ — sản lượng, % đạt, hệ số lợi dụng
 * -----------------------------------------------------------------------------
 * Tất cả tính cho THÁNG HIỆN TẠI (theo now truyền vào): từ ngày 01 tới hôm nay,
 * cộng CẢ HAI dây chuyền TK3 + TK4 (riêng hệ số lợi dụng tính RIÊNG từng dây).
 * Sang tháng mới là tự nhảy, không phải sửa gì.
 * Trình duyệt gọi qua ribbonTinh() (chart_cook.js), máy chủ qua tinhChiSo().
 * ===========================================================================*/

const RIBBON_CFG = {
    /* --- Tên cột trong bảng tính. Khai NHIỀU tên cũng được: lấy tên đầu tiên
           tìm thấy, nên sheet đổi tên cột vẫn chạy. --- */
    cols: {
        ngay:   ['Thời gian (Sản lượng)'],
        ca:     ['Ca/kíp (Sản lượng)'],
        sanLuong: ['Sản lượng (sản lượng)', 'Sản lượng'],
        keHoach:  ['Sản lượng kế hoạch'],

        /* Giờ máy KHÔNG chạy — công thức trừ CẢ HAI loại:
             gioDung   : dừng đình trệ (sự cố, hỏng hóc)
             gioDungKH : dừng theo kế hoạch (sửa chữa định kỳ, cắt điện…)
           Tên cột của loại thứ hai CHƯA XÁC MINH ĐƯỢC — mấy tên dưới là phỏng
           đoán. Mở F12 -> Console gõ  xemCotSanLuong()  để in tên cột thật rồi
           chép vào đây. Không khớp tên nào thì phần đó tính bằng 0 và Console
           báo rõ, chứ không âm thầm ra số sai. */
        gioDung:   ['Thời gian dừng', 'Thời gian dừng đình trệ',
                    'Thời gian đình trệ', 'Giờ dừng đình trệ'],
        gioDungKH: ['Thời gian dừng kế hoạch', 'Giờ dừng kế hoạch',
                    'Thời gian dừng KH', 'Dừng kế hoạch'],
    },

    /* --- CÔNG THỨC HỆ SỐ LỢI DỤNG — TÍNH RIÊNG TỪNG DÂY ------------------
     *   hệ số(TK) = sản lượng của DÂY ĐÓ từ ngày 01 tới HÔM NAY (đủ 3 ca)
     *             / [ dienTich x ( gioMoiNgay x soNgay − tổng giờ dừng ) ]
     *   (đơn vị: tấn / m²·giờ)
     *
     *   dienTich   : 360 — diện tích của MỘT máy thiêu kết (m²)
     *   gioMoiNgay : 24
     *   soNgay     : 'daQua'    = số ngày từ 01 tới HÔM NAY  <-- đang dùng
     *                'coSoLieu' = tới ngày CUỐI CÙNG CÓ SẢN LƯỢNG. Dùng khi
     *                             sheet chưa nhập kịp ngày hôm nay, tránh việc
     *                             cộng thêm một ngày trống làm hệ số tụt.
     *                'caThang'  = trọn tháng (cách tính cũ, giữ để đối chiếu)
     *   tranHopLe  : 1.5 — trần kỹ thuật t/m²·h, vượt là số liệu có vấn đề
     *   sanHopLe   : 0   — bằng hoặc dưới mức này cũng coi là bất thường
     * ------------------------------------------------------------------- */
    heSo: {
        dienTich: 360,
        gioMoiNgay: 24,
        soNgay: 'daQua',
        tranHopLe: 1.5,
        sanHopLe: 0,
    },

    /* Số chữ số thập phân hiển thị của từng ô */
    lamTron: { sanLuong: 0, dat: 1, heSo: 3 },
};

/** Trong danh sách tên `ten`, lấy tên ĐẦU TIÊN thực sự là một cột của rows.
 *  Không tên nào khớp -> null. */
function ribbonCot(rows, ten) {
    if (!rows || !rows.length) return null;
    const keys = Object.keys(rows[0]);
    return ten.find(function (n) { return keys.indexOf(n) >= 0; }) || null;
}

/** Hệ số lợi dụng hs có hợp lý không? Ra { ok, ma, loi }.
 *
 *  Trần kỹ thuật của máy thiêu kết là 1,5 t/m²·h. Ra cao hơn thì KHÔNG phải xưởng
 *  chạy giỏi mà là số liệu sai — thường do một trong ba nguyên nhân:
 *      - cộng sản lượng của cả hai dây rồi chia cho diện tích một máy
 *      - thiếu cột giờ dừng nên mẫu số bị to giả (hoặc ngược lại, nhỏ giả)
 *      - đơn vị sản lượng trong sheet không phải tấn
 *  Số vẫn được hiện để người xem soi, nhưng bị tô đỏ kèm lý do, thay vì lặng lẽ
 *  đưa lên bảng như số đúng.
 *  ma: 'thieu' (không tính được) | 'am' (<= 0) | 'vuot' (> trần) | 'dat' (ổn). */
function kiemTraHeSoLoiDung(hs) {
    const H = RIBBON_CFG.heSo;

    if (hs === null || hs === undefined || !isFinite(hs)) {
        return { ok: false, ma: 'thieu',
                 loi: 'Chưa tính được — thiếu sản lượng hoặc mẫu số ≤ 0' };
    }
    if (hs <= H.sanHopLe) {
        return { ok: false, ma: 'am',
                 loi: 'Hệ số ≤ ' + H.sanHopLe + ' — xem lại cột sản lượng và giờ dừng' };
    }
    if (hs > H.tranHopLe) {
        return { ok: false, ma: 'vuot',
                 loi: 'Vượt trần kỹ thuật ' + soVN(H.tranHopLe, 0, 3)
                      + ' t/m²·h — số liệu nhiều khả năng sai, kiểm tra lại '
                      + 'sản lượng, diện tích ' + H.dienTich + ' m² và giờ dừng' };
    }
    return { ok: true, ma: 'dat', loi: '' };
}

/** Quét bảng của MỘT dây chuyền, cộng dồn số liệu của tháng `thang`/`nam`.
 *
 *  Ra: { tongSL        sản lượng CẢ THÁNG (mọi ca đã nhập)
 *        tongSLToiNay  sản lượng tới hết ngày ngayToiDa (tử số hệ số lợi dụng)
 *        tongDung, tongDungKH   tổng giờ dừng đình trệ / kế hoạch tới ngayToiDa
 *        ngayCuoiCoSL  ngày cuối cùng có sản lượng (<= ngayToiDa)
 *        keHoach       kế hoạch sản lượng tháng
 *        soCa          số ca có sản lượng
 *        thieuCot      cột nào không tìm thấy }
 *    hoặc null nếu bảng không có cột sản lượng.
 *
 *  Ngày trong bảng tính chỉ ghi ở HÀNG ĐẦU mỗi ngày (ô gộp), các hàng ca sau để
 *  trống -> phải nhớ ngày gần nhất rồi gán tiếp (giống extractChartData).
 *
 *  ngayToiDa CHỈ áp cho phần hệ số lợi dụng (sản lượng tới nay, giờ dừng). Sản
 *  lượng / kế hoạch / số ca vẫn quét trọn tháng như cũ — các ô Kế hoạch, Sản
 *  lượng đã đạt, Tỉ lệ đạt và biểu đồ không được phép đổi số. */
function ribbonQuet(rows, thang, nam, ngayToiDa) {
    const C = RIBBON_CFG.cols;
    const cNgay = ribbonCot(rows, C.ngay);
    const cCa = ribbonCot(rows, C.ca);
    const cSL = ribbonCot(rows, C.sanLuong);
    const cKH = ribbonCot(rows, C.keHoach);
    const cDung = ribbonCot(rows, C.gioDung);
    const cDungKH = ribbonCot(rows, C.gioDungKH);

    if (!cSL) return null;                       // thiếu cột sản lượng thì chịu

    /* Mỗi cột một kiểu số (TK3 "5,854.00", TK4 "5.930,000") — dò dấu thập phân
       của từng cột một lần để đọc đúng các ô mơ hồ. Xem sheetNumber(). */
    const tpSL = sheetDauThapPhanCot(rows, cSL);
    const tpKH = sheetDauThapPhanCot(rows, cKH);
    const tpDung = sheetDauThapPhanCot(rows, cDung);
    const tpDungKH = sheetDauThapPhanCot(rows, cDungKH);

    let tongSL = 0, tongDung = 0, tongDungKH = 0, keHoach = 0, soCa = 0;
    /* Tử số của hệ số lợi dụng (cắt tới hôm nay), tách riêng khỏi tongSL trọn
       tháng để các ô Kế hoạch / Sản lượng đã đạt / Tỉ lệ đạt giữ nguyên số. */
    let tongSLToiNay = 0, ngayCuoiCoSL = 0;
    let ngayHienTai = null;

    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && row[cNgay].toString().trim() !== '') {
            const d = sheetDate(row[cNgay]);
            if (d) ngayHienTai = d;
        }
        if (!ngayHienTai) return;
        if (ngayHienTai.m !== thang || ngayHienTai.y !== nam) return;

        /* Kế hoạch ghi MỘT LẦN ở hàng ngày 01 của MỖI tháng (8/2026: 313.000,
           9/2026: 310.000…), nên phải đọc SAU khi lọc tháng. (Bản cũ đọc trước
           bộ lọc, lấy ô kế hoạch đầu tiên của cả sheet -> tháng 9 vẫn hiện số
           của tháng 8.) Đọc TRƯỚC dòng kiểm tra ca vì hàng ngày 01 của tháng
           chưa chạy có thể chưa điền ca. */
        if (cKH && !keHoach) {
            const kh = sheetNumber(row[cKH], tpKH);
            if (kh) keHoach = kh;
        }

        if (cCa && !row[cCa]) return;            // hàng không phải một ca

        const sl = sheetNumber(row[cSL], tpSL);
        if (sl !== null) { tongSL += sl; soCa += 1; }

        /* TỪ ĐÂY TRỞ XUỐNG chỉ phục vụ hệ số lợi dụng. Ngày chưa tới thì dừng
           ở đây — giờ dừng điền sẵn cho cuối tháng mà cộng vào từ giữa tháng
           thì mẫu số tụt, hệ số vọt lên sai. */
        if (ngayToiDa && ngayHienTai.d > ngayToiDa) return;

        if (sl !== null) {
            tongSLToiNay += sl;
            if (ngayHienTai.d > ngayCuoiCoSL) ngayCuoiCoSL = ngayHienTai.d;
        }

        if (cDung) {
            const gd = sheetNumber(row[cDung], tpDung);
            if (gd !== null) tongDung += gd;
        }
        if (cDungKH) {
            const gk = sheetNumber(row[cDungKH], tpDungKH);
            if (gk !== null) tongDungKH += gk;
        }
    });

    return { tongSL: tongSL, tongSLToiNay: tongSLToiNay,
             tongDung: tongDung, tongDungKH: tongDungKH,
             ngayCuoiCoSL: ngayCuoiCoSL,
             keHoach: keHoach, soCa: soCa,
             thieuCot: { ngay: !cNgay, keHoach: !cKH,
                         dung: !cDung, dungKH: !cDungKH } };
}

/* -----------------------------------------------------------------------------
 * HỆ SỐ LỢI DỤNG CỦA MỘT DÂY — ví dụ tháng 8, hôm nay 26/8:
 *
 *      sản lượng dây đó, cộng đủ 3 ca, từ 1/8 tới 26/8
 *   ----------------------------------------------------------------
 *      360 x ( 24 x 26 ngày − tổng giờ dừng cả 3 ca từ 1/8 tới 26/8 )
 *
 * BA CHỖ CẦN NHỚ:
 *   1. 360 m² là diện tích của MỘT máy thiêu kết -> tử số cũng phải là sản
 *      lượng của MỘT máy. Gộp TK3 + TK4 rồi chia 360 là ra 2,135, cao gần gấp
 *      đôi trần kỹ thuật 1,5 — đó là lỗi của bản đầu.
 *   2. Cả ba vế (sản lượng, số ngày, giờ dừng) cùng chốt ở HÔM NAY. Lấy số
 *      ngày trọn tháng mà sản lượng chỉ tới hôm nay thì mẫu số phình ra, hệ số
 *      tụt xuống rồi bò lên dần tới cuối tháng.
 *   3. Giờ dừng gộp CẢ đình trệ lẫn dừng kế hoạch — sheet hiện chỉ có một cột
 *      "Thời gian dừng" nên phần dừng kế hoạch bằng 0, có thêm cột thì tự cộng.
 * -------------------------------------------------------------------------- */

/** Giờ dừng cộng dồn hay ra số lẻ dài kiểu 0.5199999999999995 -> cắt còn tối đa
 *  2 số lẻ cho dòng chú thích dễ đọc. Phép tính vẫn dùng số gốc. */
function hsGio(v) {
    return soVN(Math.round((v || 0) * 100) / 100, 0, 2);
}

/** Tính hệ số lợi dụng của MỘT dây từ kết quả ribbonQuet (dat).
 *  homNay: ngày trong tháng của "hôm nay" (1..31).
 *  Ra: { heSo (null nếu không tính được), tongSL, soNgay, gioDung, gioChay,
 *        mauSo, moTaMauSo — dòng chữ diễn giải phép tính để hiện khi rê chuột }. */
function heSoMotDay(dat, thang, nam, homNay) {
    const H = RIBBON_CFG.heSo;

    let soNgay;
    if (H.soNgay === 'caThang') {
        soNgay = soNgayTrongThang(thang, nam);
    } else if (H.soNgay === 'coSoLieu') {
        soNgay = (dat && dat.ngayCuoiCoSL) ? dat.ngayCuoiCoSL : homNay;
    } else {
        soNgay = homNay;                     // 'daQua' — mặc định
    }

    if (!dat) {
        return { heSo: null, tongSL: 0, soNgay: soNgay, gioDung: 0,
                 gioChay: 0, mauSo: 0, moTaMauSo: 'Không có dữ liệu dây này' };
    }

    /* Tổng giờ dừng = đình trệ + dừng kế hoạch, cộng đủ 3 ca từ ngày 01 */
    const gioDung = (dat.tongDung || 0) + (dat.tongDungKH || 0);
    const gioChay = H.gioMoiNgay * soNgay - gioDung;
    const mauSo = H.dienTich * gioChay;

    return {
        heSo: mauSo > 0 ? dat.tongSLToiNay / mauSo : null,
        tongSL: dat.tongSLToiNay,
        soNgay: soNgay, gioDung: gioDung, gioChay: gioChay, mauSo: mauSo,
        moTaMauSo: soVN(Math.round(dat.tongSLToiNay), 0) + ' tấn ÷ ['
            + H.dienTich + ' × (' + H.gioMoiNgay + ' × ' + soNgay + ' ngày − '
            + hsGio(gioDung) + 'h dừng) = ' + soVN(Math.round(mauSo), 0) + ']',
    };
}

/** Tính TOÀN BỘ dải chỉ số của tháng chứa now, cho cả hai dây.
 *  rows3 / rows4: bảng TK3 / TK4.
 *  now: đối tượng có getMonth() / getFullYear() / getDate() ra đúng NGÀY GIỜ
 *       VIỆT NAM (trình duyệt: new Date(); máy chủ: gioVN()).
 *  Ra: { thang, nam, ngayChot, soNgay, ngayCuoiCoSL,
 *        tongSL, tongKH, dat (% đạt kế hoạch),
 *        tk3, tk4 (hệ số lợi dụng từng dây — xem heSoMotDay),
 *        soCa, thieuCot }  hoặc null nếu cả hai bảng đều thiếu cột sản lượng. */
function tinhRibbon(rows3, rows4, now) {
    const thang = now.getMonth() + 1;
    const nam = now.getFullYear();
    const ngayChot = now.getDate();          // cộng tới hết hôm nay

    const a = ribbonQuet(rows3, thang, nam, ngayChot);
    const b = ribbonQuet(rows4, thang, nam, ngayChot);
    if (!a && !b) return null;

    const tongSL = (a ? a.tongSL : 0) + (b ? b.tongSL : 0);
    const tongKH = (a ? a.keHoach : 0) + (b ? b.keHoach : 0);
    const mau = a || b;

    return {
        thang: thang, nam: nam, ngayChot: ngayChot,
        soNgay: heSoMotDay(a || b, thang, nam, ngayChot).soNgay,
        ngayCuoiCoSL: Math.max(a ? a.ngayCuoiCoSL : 0, b ? b.ngayCuoiCoSL : 0),
        tongSL: tongSL,
        tongKH: tongKH,
        dat: tongKH > 0 ? (tongSL / tongKH) * 100 : null,

        /* Hệ số lợi dụng TÍNH RIÊNG từng dây */
        tk3: heSoMotDay(a, thang, nam, ngayChot),
        tk4: heSoMotDay(b, thang, nam, ngayChot),

        soCa: (a ? a.soCa : 0) + (b ? b.soCa : 0),
        thieuCot: {
            ngay: mau.thieuCot.ngay,
            keHoach: mau.thieuCot.keHoach,
            dung: (!a || a.thieuCot.dung) && (!b || b.thieuCot.dung),
            dungKH: (!a || a.thieuCot.dungKH) && (!b || b.thieuCot.dungKH),
        },
    };
}

/** Sản lượng THEO NGÀY của một dây trong tháng thang/nam (cộng các ca).
 *  Ra: { 1: 6123.4, 2: 5980, ... } — khoá là ngày trong tháng. Dùng cho 4 thẻ mục
 *  Sản lượng và biểu đồ sản lượng tháng. */
function slTheoNgay(rows, thang, nam) {
    const C = RIBBON_CFG.cols;
    const cNgay = ribbonCot(rows, C.ngay);
    const cCa = ribbonCot(rows, C.ca);
    const cSL = ribbonCot(rows, C.sanLuong);
    const map = {};
    if (!cSL) return map;
    const tpSL = sheetDauThapPhanCot(rows, cSL);

    let ngay = null;
    rows.forEach(function (row) {
        if (cNgay && row[cNgay] && row[cNgay].toString().trim() !== '') {
            const d = sheetDate(row[cNgay]);
            if (d) ngay = d;
        }
        if (!ngay || ngay.m !== thang || ngay.y !== nam) return;
        if (cCa && !row[cCa]) return;
        const v = sheetNumber(row[cSL], tpSL);
        if (v === null) return;
        map[ngay.d] = (map[ngay.d] || 0) + v;
    });
    return map;
}

/* =============================================================================
 * 4. BẢNG CẢNH BÁO TIÊU HAO / TRỢ DUNG / CHẤT LƯỢNG — NGƯỠNG VÀ CÁCH CHẤM
 * -----------------------------------------------------------------------------
 * Phần VẼ bảng nằm ở canhbao.js; ngưỡng và phép chấm ở đây để máy chủ chấm
 * được y hệt. Đổi ngưỡng: sửa NGUONG / CL_CHI_TIEU bên dưới rồi deploy.
 *
 * Mỗi chỉ tiêu khai báo:
 *   ten, bieuTuong   tên + biểu tượng hiện trên bảng
 *   nhay             id khối biểu đồ chi tiết — bấm vào dòng là nhảy tới đó
 *   ngayCol, caCol   cột "Thời gian (...)" và "Ca/kíp (...)" của khối dữ liệu
 *   ...              các cột số liệu cần đọc + ngưỡng
 * ===========================================================================*/

/* --- Ngưỡng TIÊU HAO do xưởng quy định ---
   ngay: ngưỡng của số ngày gần nhất; luyKe: ngưỡng của luỹ kế tháng.
   Vượt (lớn hơn) ngưỡng là cảnh báo. */
var NGUONG = {
    than:     { ngay: 50, luyKe: 45, donVi: 'kg/Tsp' },
    dien:     { ngay: 48, luyKe: 48, donVi: 'kWh/Tsp' },
    khiThan:  { ngay: 51, luyKe: 51, donVi: 'm³/Tsp' },
    quangHoi: { ngay: 35, luyKe: 35, donVi: '%' },
};

/* --- Các chỉ tiêu tiêu hao: lấy cột nào, so ngưỡng nào, nhảy tới đâu ---
   colNgay / colLuyKe: danh sách tên cột có thể có (lấy tên đầu tiên tìm thấy),
   trừ khi có cong: true (CỘNG các cột) hoặc tach (chấm RIÊNG từng cách tính). */
var CB_CHI_TIEU = [
    {
        ten: 'Tiêu hao than', bieuTuong: '🔥', nhay: 'tieu-hao-than',
        nguong: NGUONG.than,
        ngayCol: 'Thời gian (THthan)', caCol: 'Ca/kíp (THthan)',
        /* Bảng tính có HAI cách tính than. Cả hai áp CÙNG ngưỡng, và chấm RIÊNG
           từng cách — cách nào vượt thì báo cách đó, không gộp lại. */
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
        /* Tỉ lệ quặng hồi = hồi nguội + hồi lò cao: CỘNG hai cột rồi mới so. */
        ten: 'Tỉ lệ quặng hồi', bieuTuong: '♻️', nhay: 'ti-le-quang-hoi',
        nguong: NGUONG.quangHoi, cong: true,
        ngayCol: 'Thời gian (QH)', caCol: 'Ca/kíp (QH)',
        colNgay:  ['Tỉ lệ quặng hồi nguội (QH)', 'Tỉ lệ quặng HLC (QH)'],
        colLuyKe: ['Tỉ lệ quặng hồi nguội tích lũy (QH)', 'Tỉ lệ quặng HLC tích lũy (QH)'],
    },
];

/* --- Trợ dung: CHỈ hiện số ngày gần nhất + luỹ kế, KHÔNG cảnh báo (theo yêu cầu) --- */
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

/* -----------------------------------------------------------------------------
 * CHỈ TIÊU CHẤT LƯỢNG (bảng #chat-luong)
 * Khác bên tiêu hao ở chỗ mỗi phép đo ("phep") so theo MỘT trong ba kiểu (huong):
 *   'tren'    -> vượt LÊN TRÊN ngưỡng thì cảnh báo   (FeO > 9%)
 *   'duoi'    -> tụt XUỐNG DƯỚI ngưỡng thì cảnh báo  (%CaO < 82%)
 *   'daoDong' -> chênh lệch giữa NGÀY MỚI NHẤT và NGÀY LIỀN TRƯỚC đạt ngưỡng
 *                thì cảnh báo                        (%SiO2 dao động >= 0,5%)
 * Ngưỡng để ngay trong từng dòng, sửa tại chỗ. nguong: null = tắt phép đo đó.
 * -------------------------------------------------------------------------- */
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

/* --- Tiện ích dùng chung cho các phép chấm --- */

/** Đọc số từ ô bảng tính — chính là sheetNumber() ở trên (đặt tên riêng cho
 *  phần cảnh báo). Ví dụ:
 *      "38.5"      -> 38,5   (dấu chấm là THẬP PHÂN, không phải hàng nghìn)
 *      "1.234"     -> 1234   (đúng 3 chữ số sau dấu -> hàng nghìn)
 *      "38,5"      -> 38,5
 *      "1,234.56"  -> 1234,56
 *  Bản riêng đầu tiên của hàm này xoá mọi dấu chấm nên đọc "38.5" thành 385 —
 *  sai gấp 10 lần mà lại âm thầm, rất nguy hiểm với một bảng cảnh báo. */
function cbSo(v, goiY) {
    return sheetNumber(v, goiY);
}

/** Dấu thập phân của cả cột (',' / '.' / null) — gợi ý cho cbSo với ô mơ hồ kiểu
 *  "2.144" (R2 TK3: 2,144 chứ không phải 2144). */
function cbDauTP(rows, cot) {
    return cot ? sheetDauThapPhanCot(rows, cot) : null;
}

/** Đọc ngày dd/mm/yyyy -> { d, m, y } (chính là sheetDate). */
function cbNgay(v) {
    return sheetDate(v);
}

/** Trong danh sách tên `ds`, lấy tên đầu tiên thực sự là một cột của rows. */
function cbTimCot(rows, ds) {
    if (!rows || !rows.length) return null;
    var keys = Object.keys(rows[0]);
    for (var i = 0; i < ds.length; i++) if (keys.indexOf(ds[i]) >= 0) return ds[i];
    return null;
}

/** Lấy số của NGÀY CÓ SỐ LIỆU MỚI NHẤT (tới hôm nay) trong tháng chứa now.
 *
 *  cfg: chỉ tiêu (cần ngayCol, caCol). dsColNgay / dsColLuyKe: các tên cột số
 *  ngày / số luỹ kế. cong = true: CỘNG mọi cột trong danh sách; false: dùng cột
 *  đầu tiên tìm thấy.
 *  Ra: { ngay: {d,m,y}, giaTriNgay, giaTriLuyKe (null nếu không có) } hoặc null.
 *
 *  Ngày trong bảng tính chỉ ghi ở hàng đầu mỗi ngày (ô gộp) nên phải nhớ ngày
 *  gần nhất rồi gán tiếp — giống cách chart_core làm. */
function cbLayMoiNhat(rows, cfg, dsColNgay, dsColLuyKe, cong, now) {
    if (!rows || !rows.length) return null;
    var cNgay = cbTimCot(rows, [cfg.ngayCol]);
    var cCa = cbTimCot(rows, [cfg.caCol]);

    var cacNgay = cong ? dsColNgay.slice() : [cbTimCot(rows, dsColNgay)];
    var cacLuyKe = cong ? dsColLuyKe.slice() : [cbTimCot(rows, dsColLuyKe)];
    if (!cong && !cacNgay[0]) return null;

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
        if (ngay.d > homNay) return;          /* hàng của ngày CHƯA TỚI */
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

    /* Ưu tiên hàng CUỐI CÙNG CÓ SỐ THẬT (> 0).
       Vì sao: bảng tính dựng sẵn hàng cho CẢ THÁNG. Những ca chưa sản xuất có
       tiêu hao ngày = 0 nhưng cột luỹ kế VẪN có số (công thức kéo xuống). Lấy
       hàng cuối cùng bất kể giá trị thì ra "ngày 0,00 | luỹ kế 38,70".
       Chỉ khi cả tháng không có số nào > 0 mới chịu lấy hàng cuối. */
    return cuoiCoSo || cuoiBatKy;
}

/** Chấm một chỉ tiêu TIÊU HAO (phần tử của CB_CHI_TIEU) cho cả 2 dây chuyền.
 *  Ba kiểu lấy số:
 *    - mặc định : lấy cột đầu tiên tìm thấy
 *    - cong     : CỘNG các cột rồi mới so ngưỡng   (tỉ lệ quặng hồi)
 *    - tach     : chấm RIÊNG từng cột, cùng ngưỡng (than: Ccd và nhiệt trị)
 *  Ra: { ten, bieuTuong, nhay, nguong, viPham (số lần vượt), thieuCot,
 *        day: [{ ten: 'TK3', nhan, ngay, giaTriNgay, giaTriLuyKe,
 *                loi: [{ loai: 'ngày'|'luỹ kế', giaTri, nguong }] }, ...] } */
function cbChamChiTieu(ct, rows3, rows4, now) {
    var ra = { ten: ct.ten, bieuTuong: ct.bieuTuong, nhay: ct.nhay,
               nguong: ct.nguong, day: [], viPham: 0, thieuCot: false };

    /* Quy về CÙNG một dạng: mỗi phép đo có nhãn + cột ngày + cột luỹ kế */
    var pheps = ct.tach
        ? ct.tach.map(function (t) { return { nhan: t.nhan, ngay: [t.ngay], luyKe: [t.luyKe] }; })
        : [{ nhan: '', ngay: ct.colNgay, luyKe: ct.colLuyKe }];

    [['TK3', rows3], ['TK4', rows4]]
    .forEach(function (cap) {
        pheps.forEach(function (p) {
            var d = cbLayMoiNhat(cap[1], ct, p.ngay, p.luyKe, ct.cong, now);
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

/** Lấy số của N NGÀY GẦN NHẤT có số liệu (tới hôm nay), trong tháng chứa now.
 *  Mỗi ngày lấy số của ca CUỐI CÙNG có số. Ra mảng xếp mới nhất trước:
 *    [{ ngay: {d,m,y}, giaTri }, ...]   hoặc null nếu không có cột.
 *  Dùng cho phép so ngưỡng (chỉ cần ngày mới nhất) lẫn phép dao động (cần thêm
 *  ngày liền trước). */
function cbLayNgayGanNhat(rows, cfg, dsCot, soNgay, now) {
    if (!rows || !rows.length) return null;
    var cNgay = cbTimCot(rows, [cfg.ngayCol]);
    var cCa = cbTimCot(rows, [cfg.caCol]);
    var cot = cbTimCot(rows, Array.isArray(dsCot) ? dsCot : [dsCot]);
    if (!cot) return null;

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
        if (ngay.d > homNay) return;          /* hàng của ngày CHƯA TỚI */
        if (cCa && !row[cCa]) return;
        var v = cbSo(row[cot], tp);
        if (v === null) return;
        /* Bỏ qua ô = 0: với chỉ tiêu chất lượng, 0 nghĩa là CHƯA LẤY MẪU chứ
           không phải kết quả thật (không có mẫu nào %CaO = 0). */
        if (v === 0) return;
        var k = ngay.d;
        if (theoNgay[k] === undefined) thuTu.push(k);
        theoNgay[k] = { ngay: { d: ngay.d, m: ngay.m, y: ngay.y }, giaTri: v };   /* ca sau đè ca trước */
    });

    thuTu.sort(function (a, b) { return b - a; });          // mới nhất trước
    return thuTu.slice(0, soNgay || 1).map(function (k) { return theoNgay[k]; });
}

/** Chấm MỘT phép đo chất lượng (p) cho MỘT dây chuyền.
 *  Ra: { nhan, donVi, nguong, huong, ngay, giaTri,
 *        loi: null | 'vượt 9,5 > 9%'..., (daoDong thêm: truoc, chenh, thieuNgay) }
 *      hoặc null nếu dây đó không có cột / không có số. */
function clChamPhep(rows, ct, p, now) {
    var canNgay = p.huong === 'daoDong' ? 2 : 1;
    var ds = cbLayNgayGanNhat(rows, ct, p.cot, canNgay, now);
    if (!ds || !ds.length) return null;

    var moi = ds[0];
    var ra = { nhan: p.nhan, donVi: p.donVi, nguong: p.nguong, huong: p.huong,
               ngay: moi.ngay, giaTri: moi.giaTri, loi: null };

    if (p.nguong === null || p.nguong === undefined) return ra;   // phép đo đang tắt

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

/** Chấm một chỉ tiêu CHẤT LƯỢNG (phần tử của CL_CHI_TIEU) cho cả 2 dây chuyền.
 *  Ra: { ten, bieuTuong, nhay, viPham, thieuCot: [nhãn phép đo thiếu cột],
 *        day: [kết quả clChamPhep + day: 'TK3'|'TK4', ...] } */
function clChamChiTieu(ct, rows3, rows4, now) {
    var ra = { ten: ct.ten, bieuTuong: ct.bieuTuong, nhay: ct.nhay,
               day: [], viPham: 0, thieuCot: [] };

    [['TK3', rows3], ['TK4', rows4]]
    .forEach(function (cap) {
        ct.phep.forEach(function (p) {
            var kq = clChamPhep(cap[1], ct, p, now);
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

/** Gom các NGÀY mà bảng đang lấy số, dạng '5/10, 4/10'. Thường chỉ một ngày,
 *  nhưng nếu hai dây nhập lệch nhau thì liệt kê hết để không hiểu nhầm. */
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

/** Số -> chữ với `le` số lẻ (mặc định 2) kiểu Việt; null / NaN -> '--'. */
function cbLamTron(v, le) {
    if (le === undefined) le = 2;
    return (v === null || !isFinite(v)) ? '--' : soVN(v, le, le);
}

/** Bảng trợ dung: số ngày gần nhất + luỹ kế của từng loại, từng dây — không
 *  chấm ngưỡng. Ra [{ nhan, day, d }], d = kết quả cbLayMoiNhat hoặc null khi
 *  dây đó chưa có số. */
function tinhTroDung(rows3, rows4, now) {
    var C = CB_TRO_DUNG, ra = [];
    C.dong.forEach(function (m) {
        [['TK3', rows3], ['TK4', rows4]].forEach(function (cap) {
            ra.push({ nhan: m.nhan, day: cap[0],
                      d: cbLayMoiNhat(cap[1], C, [m.ngay], [m.luyKe], false, now) });
        });
    });
    return ra;
}

/* =============================================================================
 * 5. MỘT LẦN GỌI TÍNH HẾT CHO TRANG CHỦ — máy chủ dùng (/api/v2/chi-so)
 * ===========================================================================*/

/** Tính mọi thứ trang chủ cần, đúng dạng các hàm vẽ đọc:
 *    ngay          'YYYY-MM-DD' của now — trình duyệt chỉ dùng kết quả này khi
 *                  trùng NGÀY HÔM NAY của máy người xem (chiSoMayChu)
 *    ribbon        dải chỉ số (= tinhRibbon)
 *    sanLuongNgay  { TK3: {ngày: tấn}, TK4: {...} } cho mục Sản lượng
 *    canhBao       { tieuHao: [...], troDung: [...], chatLuong: [...] } */
function tinhChiSo(rows3, rows4, now) {
    var thang = now.getMonth() + 1, nam = now.getFullYear();
    var hai = function (n) { return (n < 10 ? '0' : '') + n; };
    return {
        ngay: nam + '-' + hai(thang) + '-' + hai(now.getDate()),
        ribbon: tinhRibbon(rows3, rows4, now),
        sanLuongNgay: { TK3: slTheoNgay(rows3, thang, nam), TK4: slTheoNgay(rows4, thang, nam) },
        canhBao: {
            tieuHao: CB_CHI_TIEU.map(function (ct) { return cbChamChiTieu(ct, rows3, rows4, now); }),
            troDung: tinhTroDung(rows3, rows4, now),
            chatLuong: CL_CHI_TIEU.map(function (ct) { return clChamChiTieu(ct, rows3, rows4, now); }),
        },
    };
}

/** Danh sách mọi cột mà các phép tính ở file này đọc tới. Máy chủ chỉ dựng lại
 *  những khối chứa các cột đó (db/chi-so.mjs) cho nhẹ CPU. */
function cotChiSoCanDoc() {
    var ds = [];
    var them = function (x) {
        (Array.isArray(x) ? x : [x]).forEach(function (c) { if (c && ds.indexOf(c) < 0) ds.push(c); });
    };
    var K = RIBBON_CFG.cols;
    Object.keys(K).forEach(function (k) { them(K[k]); });
    CB_CHI_TIEU.forEach(function (ct) {
        them([ct.ngayCol, ct.caCol]);
        (ct.tach || []).forEach(function (t) { them([t.ngay, t.luyKe]); });
        them(ct.colNgay || []); them(ct.colLuyKe || []);
    });
    them([CB_TRO_DUNG.ngayCol, CB_TRO_DUNG.caCol]);
    CB_TRO_DUNG.dong.forEach(function (m) { them([m.ngay, m.luyKe]); });
    CL_CHI_TIEU.forEach(function (ct) {
        them([ct.ngayCol, ct.caCol]);
        ct.phep.forEach(function (p) { them(p.cot); });
    });
    return ds;
}

/* =============================================================================
 * 6. XUẤT RA CHO MÁY CHỦ
 * -----------------------------------------------------------------------------
 * Khi được import như một module (db/chi-so.mjs), các hàm trên KHÔNG tự thành
 * biến toàn cục, nên gom vào globalThis.XTK2_CHI_SO. Ở trình duyệt dòng này vô
 * hại — các hàm vốn đã là biến toàn cục.
 * ===========================================================================*/
globalThis.XTK2_CHI_SO = {
    tinhChiSo: tinhChiSo, cotChiSoCanDoc: cotChiSoCanDoc, soVN: soVN,
    sheetNumber: sheetNumber, sheetDate: sheetDate,
    /* Toàn bộ cấu hình + mã nguồn các hàm tính, dạng chữ. Máy chủ băm ra vân tay
       để ETag của /api/v2/chi-so đổi khi sửa ngưỡng / công thức (db/chi-so.mjs).
       (Vì String(hàm) gồm cả chú thích bên trong hàm, sửa chú thích cũng làm
       vân tay đổi — vô hại: trình duyệt chỉ tải lại một lần.) */
    maNguon: function () {
        return JSON.stringify([RIBBON_CFG, NGUONG, CB_CHI_TIEU, CB_TRO_DUNG, CL_CHI_TIEU]) + [
            soVN, sheetNumber, sheetLaDauThapPhan, sheetDauThapPhanCot, sheetDate, soNgayTrongThang,
            ribbonCot, kiemTraHeSoLoiDung, ribbonQuet, hsGio, heSoMotDay, tinhRibbon, slTheoNgay,
            cbSo, cbDauTP, cbNgay, cbTimCot, cbLayMoiNhat, cbChamChiTieu, cbLayNgayGanNhat,
            clChamPhep, clChamChiTieu, cbLamTron, tinhTroDung, tinhChiSo,
        ].map(String).join('\n');
    },
};
