/* XTK2-API v2 — api_thang.js
 * =============================================================================
 * TẢI THÊM THÁNG CŨ ĐÚNG LÚC CẦN
 * =============================================================================
 * BỐI CẢNH
 *   Mở trang chỉ tải số liệu từ tháng này (10 ngày đầu tháng thì từ tháng trước)
 *   — xem apiThangMacDinh() trong api_config.js. Như vậy nhanh hơn nhiều so với
 *   tải cả lịch sử, nhưng có hai lúc người xem cần tháng cũ hơn:
 *
 *   1) LỌC LÙI NGÀY: chọn "Từ ngày" sớm hơn phần đã tải.
 *      -> bọc applyUniversalFilter (hàm lọc của chart_cook.js).
 *   2) MỞ MỘT KHỐI có số liệu đã NGỪNG từ lâu (vd chất lượng quặng thiêu kết
 *      TK3 dừng ở 25/08). Biểu đồ mặc định vẽ 7 ngày CUỐI CÙNG CÓ SỐ, nên phải có
 *      tháng chứa các ngày đó. Ngày cuối có số của từng khối nằm sẵn trong
 *      muc_luc của gói /api/v2 (bảng moc_khoi trong D1).
 *      -> bọc DieuPhoi.moKhoi (hàm mở khối biểu đồ của chart_cook.js).
 *
 *   Tải xong thì gộp vào kho (api_v2.js) và bắn TK3DataReady / TK4DataReady như
 *   mọi lần dữ liệu mới về: biểu đồ đang mở tự vẽ lại, GIỮ NGUYÊN bộ lọc đang chọn.
 *
 * QUY TẮC VÀNG: LUÔN TẢI CHO CẢ HAI DÂY CÙNG LÚC
 *   Biểu đồ gộp TK3 + TK4 ghép số TK4 vào nhãn ngày của TK3 THEO VỊ TRÍ hàng.
 *   Một dây có thêm tháng mà dây kia không là số bị vẽ lệch ngày. Vì vậy chỉ gộp
 *   khi CẢ HAI dây cùng tải về được, và cùng danh mục cột.
 *
 * VỊ TRÍ NẠP: SAU chart_cook.js (cần DieuPhoi, chartConfigs, moduleConfigs) và
 * TRƯỚC main.js. Đang dùng bản KV (vốn đủ mọi tháng) thì file này không làm gì.
 * ===========================================================================*/

/* dangTai: Promise của lượt tải thêm đang chạy (null = không có). Mỗi lúc chỉ
   một lượt, các yêu cầu đến sau xếp hàng chờ lượt trước xong. */
const API_THANG = { dangTai: null };

/* Lùi 10 ngày trước ngày cuối có số: biểu đồ mặc định cần 7 ngày, dư 3 ngày phòng
   các cột trong cùng khối dừng lệch nhau vài hôm */
const API_THANG_LUI_NGAY = 10;

/** Tháng ('YYYY-MM') của ngày iso lùi đi luiNgay ngày:
 *    apiThangCuaNgay('2026-08-05', 10) -> '2026-07' */
function apiThangCuaNgay(iso, luiNgay) {
    const d = new Date(Date.parse(iso + 'T00:00:00Z') - (luiNgay || 0) * 86400000);
    return d.toISOString().slice(0, 7);
}

/** Tháng SỚM NHẤT mà D1 có dữ liệu (xét cả hai dây); null nếu chưa có mục lục.
 *  Không bao giờ xin lùi quá tháng này — có xin cũng không có gì. */
function apiThangSomNhat() {
    let som = null;
    ['TK3', 'TK4'].forEach(function (ten) {
        const k = API_V2_KHO[ten];
        const ds = k && k.mucLuc && k.mucLuc.cac_thang;
        if (ds && ds.length && (!som || ds[0] < som)) som = ds[0];
    });
    return som;
}

/** Gọi /api/v2/<dây>?tu=..&den=.. -> gói, hoặc null nếu lỗi. */
async function apiThangXin(ten, tu, den) {
    try {
        const r = await fetch(API_V2[ten] + '?tu=' + tu + '&den=' + den);
        const j = r.ok ? await r.json() : null;
        return j && j.status === 'success' ? j : null;
    } catch (e) { return null; }
}

/** Bảo đảm kho của CẢ HAI dây có số liệu từ tháng tu trở đi.
 *
 *  Xin khoảng [tu .. tháng liền trước phần đang có] cho hai dây cùng lúc; chỉ gộp
 *  khi CẢ HAI về đủ và cùng danh mục cột (xem "quy tắc vàng" ở đầu file).
 *  lyDo: chữ mô tả (vd 'lọc dien', 'mở chat-luong-quang-thieu-ket'), chỉ để in Console.
 *  Ra: Promise<true> nếu đã tải thêm, <false> nếu không cần / không được. */
function apiThangDamBao(tu, lyDo) {
    const a = API_V2_KHO.TK3, b = API_V2_KHO.TK4;
    if (!a || !b || !tu) return Promise.resolve(false);
    /* Đang có lượt tải khác: đợi nó xong rồi xét lại (có khi không cần nữa) */
    if (API_THANG.dangTai) {
        return API_THANG.dangTai.then(function () { return apiThangDamBao(tu, lyDo); });
    }
    const dangCo = a.tu > b.tu ? a.tu : b.tu;      /* tháng đầu mà CẢ HAI dây đều có */
    const som = apiThangSomNhat();
    if (som && tu < som) tu = som;
    if (tu >= dangCo) return Promise.resolve(false);   /* đã có đủ */
    const den = apiV2CongThang(dangCo, -1);

    API_THANG.dangTai = Promise.all([apiThangXin('TK3', tu, den), apiThangXin('TK4', tu, den)])
        .then(function (goi) {
            API_THANG.dangTai = null;
            const k3 = API_V2_KHO.TK3, k4 = API_V2_KHO.TK4;
            if (!goi[0] || !goi[1] || !k3 || !k4
                || goi[0].van_tay !== k3.vanTay || goi[1].van_tay !== k4.vanTay) {
                console.warn('[Dữ liệu] Chưa tải thêm được tháng ' + tu + '..' + den
                    + ' (' + lyDo + ') — thử lại ở lần lọc / mở khối sau.');
                return false;
            }
            ['TK3', 'TK4'].forEach(function (ten, i) {
                const rows = apiV2NhanGoi(ten, goi[i], false);
                if (rows) apiApDung(ten, rows, apiV2VanTayKho(ten), 'D1 thêm tháng ' + tu + '..' + den + ' (' + lyDo + ')');
            });
            return true;
        });
    return API_THANG.dangTai;
}

/* --- 1) LỌC LÙI NGÀY ---------------------------------------------------- */

/** Đọc ô "Từ ngày" / "Đến ngày" của một loại biểu đồ — đúng cách
 *  applyUniversalFilter (chart_cook.js) đọc. Ra { tu, den } dạng 'YYYY-MM-DD'.
 *  Riêng biểu đồ cỡ hạt than chỉ có MỘT ô ngày. */
function apiThangOLoc(loai) {
    if (loai === 'CoHatThan') {
        const el = document.getElementById('start-CoHatThan');
        const v = el ? el.value : '';
        return { tu: v, den: v };
    }
    const cfg = typeof chartConfigs !== 'undefined' ? chartConfigs[loai] : null;
    if (!cfg) return { tu: '', den: '' };
    const s = document.getElementById('start' + cfg.filterSuffix);
    const e = document.getElementById((cfg.filterSuffix === '-CoHatThan' ? 'start' : 'end') + cfg.filterSuffix);
    return { tu: s ? s.value : '', den: e ? e.value : '' };
}

/** Sau mỗi lần người xem bấm lọc biểu đồ loai: cần tháng nào thì tải thêm. */
function apiThangChoLoc(loai) {
    const o = apiThangOLoc(loai);
    if (!o.tu && !o.den) return;                       /* không lọc ngày: việc của mục 2 */
    /* Chỉ có "Đến ngày" = xem mọi thứ tới ngày đó -> cần từ tháng đầu tiên */
    const tu = o.tu ? o.tu.slice(0, 7) : apiThangSomNhat();
    apiThangDamBao(tu, 'lọc ' + loai);
}

/* --- 2) MỞ KHỐI CÓ SỐ LIỆU CŨ ----------------------------------------- */

/** Một loại biểu đồ đọc từ KHỐI nào của sheet? Lần theo chuỗi cấu hình, vd 'ChemicalQTK':
 *    chartConfigs.ChemicalQTK.dataSource = () => window.AppChartData.ChemicalQTK
 *      -> moduleConfigs có namespaceKey 'ChemicalQTK'
 *      -> timeCol 'Thời gian (QTK)' -> tên khối 'QTK'.
 *  Ra tên khối như trong D1 (moc_khoi), hoặc null. */
function apiThangKhoiCuaLoai(loai) {
    if (typeof chartConfigs === 'undefined' || typeof moduleConfigs === 'undefined') return null;
    const cfg = chartConfigs[loai];
    const m = cfg && String(cfg.dataSource).match(/AppChartData\.(\w+)/);
    const mod = m && moduleConfigs.find(function (x) { return x.namespaceKey === m[1]; });
    const t = mod && String(mod.timeCol).match(/^Thời gian \((.*)\)$/);
    return t ? t[1] : null;
}

/** Khi mở khối biểu đồ idKhoi: tìm ngày cuối có số MUỘN NHẤT trong các khối dữ
 *  liệu mà khối biểu đồ đó dùng (xét cả TK3, TK4), rồi bảo đảm đã tải từ tháng
 *  của (ngày đó - 10 ngày). */
function apiThangChoKhoi(idKhoi) {
    if (!idKhoi || typeof KHOI_BIEU_DO === 'undefined' || !KHOI_BIEU_DO[idKhoi]) return;
    const a = API_V2_KHO.TK3, b = API_V2_KHO.TK4;
    if (!a || !b) return;
    let cuoi = null;
    KHOI_BIEU_DO[idKhoi].forEach(function (loai) {
        const goc = apiThangKhoiCuaLoai(loai);
        if (!goc) return;
        [a, b].forEach(function (k) {
            const moc = (k.mucLuc && k.mucLuc.khoi) || {};
            Object.keys(moc).forEach(function (ten) {
                /* 'chất lượng than' gồm cả khối 'chất lượng than_1' (than coke) */
                if ((ten === goc || ten.indexOf(goc + '_') === 0) && (!cuoi || moc[ten] > cuoi)) cuoi = moc[ten];
            });
        });
    });
    if (cuoi) apiThangDamBao(apiThangCuaNgay(cuoi, API_THANG_LUI_NGAY), 'mở ' + idKhoi);
}

/* --- 3) HAI DÂY PHẢI CÙNG DẢI THÁNG ------------------------------------- */

/** Trường hợp hiếm: một dây lỡ phải dùng bản KV (đủ mọi tháng) trong khi dây kia
 *  dùng D1 chỉ từ tháng này -> tải nốt mọi tháng cho dây D1, kẻo biểu đồ gộp
 *  lệch ngày. */
function apiThangCanHaiDay() {
    const k = API_V2_KHO.TK3 || API_V2_KHO.TK4;
    if (!k || (API_V2_KHO.TK3 && API_V2_KHO.TK4)) return;   /* cả hai cùng D1 hoặc cùng KV: ổn */
    const coKV = API_V2_KHO.TK3 ? 'TK4' : 'TK3';
    if (!window['masterSheetData' + coKV] || !window['masterSheetData' + coKV].length) return;
    const ten = coKV === 'TK3' ? 'TK4' : 'TK3';
    const som = k.mucLuc && k.mucLuc.cac_thang && k.mucLuc.cac_thang[0];
    if (!som || som >= k.tu || API_THANG.dangTai) return;
    const den = apiV2CongThang(k.tu, -1);
    API_THANG.dangTai = apiThangXin(ten, som, den).then(function (j) {
        API_THANG.dangTai = null;
        const rows = j && API_V2_KHO[ten] ? apiV2NhanGoi(ten, j, false) : null;
        if (rows) apiApDung(ten, rows, apiV2VanTayKho(ten), 'D1 đủ mọi tháng vì ' + coKV + ' đang dùng bản KV');
    });
}

/* --- GẮN VÀO TRANG -------------------------------------------------------
 * "Bọc" hàm có sẵn: thay window.applyUniversalFilter bằng hàm mới gọi hàm GỐC
 * trước (lọc, vẽ như cũ), RỒI mới xét có cần tải thêm tháng không. Lỗi ở phần
 * tải thêm chỉ in Console, không làm hỏng việc lọc / mở khối.
 * ------------------------------------------------------------------------- */
(function apiThangGan() {
    if (typeof API_V2_KHO === 'undefined' || typeof API_NGUON === 'undefined' || API_NGUON !== 'd1') return;

    if (typeof window.applyUniversalFilter === 'function') {
        const gocLoc = window.applyUniversalFilter;
        window.applyUniversalFilter = function (loai) {
            const kq = gocLoc.apply(this, arguments);
            try { apiThangChoLoc(loai); } catch (e) { console.error('[Dữ liệu] tải thêm tháng:', e); }
            return kq;
        };
    }
    if (window.DieuPhoi && typeof window.DieuPhoi.moKhoi === 'function') {
        const gocMo = window.DieuPhoi.moKhoi;
        window.DieuPhoi.moKhoi = function (idKhoi) {
            const kq = gocMo.apply(this, arguments);
            try { apiThangChoKhoi(idKhoi); } catch (e) { console.error('[Dữ liệu] tải thêm tháng:', e); }
            return kq;
        };
    }
    /* Khối được mở TRƯỚC khi dữ liệu về (vào thẳng bằng #địa-chỉ) thì lúc đó chưa
       có mục lục -> xét lại mỗi khi dữ liệu mới về. Hẹn 100 ms để TK3DataReady và
       TK4DataReady về sát nhau chỉ xét một lần. */
    let hen = 0;
    const xetLai = function () {
        clearTimeout(hen);
        hen = setTimeout(function () {
            try {
                apiThangCanHaiDay();
                if (window.DieuPhoi) apiThangChoKhoi(window.DieuPhoi.khoiDangMo);
            } catch (e) { console.error('[Dữ liệu] tải thêm tháng:', e); }
        }, 100);
    };
    document.addEventListener('TK3DataReady', xetLai);
    document.addEventListener('TK4DataReady', xetLai);
})();
