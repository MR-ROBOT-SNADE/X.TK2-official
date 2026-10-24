/* =============================================================================
 * js/components/Charts/controller/home_ribbon.js — DẢI CHỈ SỐ TRANG CHỦ — PHẦN VẼ
 * =============================================================================
 * Phần 7/8 của phần điều khiển biểu đồ (thư mục controller/, trước 24/10/2026 là
 * chart_cook.js) — đọc controller/module_configs.js trước để biết cả thư mục.
 * -----------------------------------------------------------------------------
 * Phần TÍNH (RIBBON_CFG, ribbonQuet, hệ số lợi dụng...) nằm ở js/chung/chi_so.js
 * để máy chủ tính được y hệt. Ở đây chỉ lấy kết quả rồi ghi vào trang.
 * Vẽ lại khi: số liệu TK3+TK4 về (processAllModulesData) hoặc khi máy chủ gửi
 * chỉ số tính sẵn (sự kiện ChiSoReady).
 * ===========================================================================*/

/** Chỉ số tháng này (kết quả tinhRibbon). Có bản máy chủ tính sẵn cho đúng hôm
 *  nay (/api/v2/chi-so) thì dùng luôn — có ngay khi mở trang; không thì tự tính
 *  trên số liệu đang có. Cùng một mã tính nên hai đường ra cùng một số. */
function ribbonTinh() {
    const may = (typeof chiSoMayChu === 'function') ? chiSoMayChu() : null;
    if (may) return may.ribbon;
    return tinhRibbon(window.masterSheetDataTK3, window.masterSheetDataTK4, new Date());
}

/* Máy chủ tính xong trước khi số liệu TK3/TK4 về -> vẽ trang chủ ngay. Số liệu về
   sau thì processAllModulesData() vẽ lại — vẫn từ bản máy chủ, nên số không nháy. */
document.addEventListener('ChiSoReady', function () {
    try { ribbonVe(); } catch (e) { console.error('[Dải chỉ số]', e); }
    try { kpiVe(); } catch (e) { console.error('[Mục sản lượng]', e); }
    try { veBieuDoSanLuong(); } catch (e) { console.error('[Biểu đồ sản lượng]', e); }
});

/** CÔNG CỤ TRA CỨU — gõ trong Console (F12): xemCotSanLuong() hoặc
 *  xemCotSanLuong('TK4') để in bảng toàn bộ tên cột của một dây kèm giá trị
 *  hàng đầu. Dùng khi cần lấy tên cột THẬT để khai vào RIBBON_CFG.cols
 *  (js/chung/chi_so.js) — đừng đoán tên cột. */
function xemCotSanLuong(day) {
    const rows = (String(day).toUpperCase() === 'TK4')
        ? window.masterSheetDataTK4 : window.masterSheetDataTK3;
    if (!rows || !rows.length) {
        console.warn('[Dải chỉ số] Chưa có dữ liệu để xem tên cột.');
        return [];
    }
    const keys = Object.keys(rows[0]);
    console.table(keys.map(function (k, i) {
        return { STT: i, 'Tên cột': k, 'Ví dụ dòng 1': rows[0][k] };
    }));
    return keys;
}
window.xemCotSanLuong = xemCotSanLuong;

window.kiemTraHeSoLoiDung = kiemTraHeSoLoiDung;


/** Ghi số vào một ô của dải chỉ số (kiểu Việt: 1.234,5), GIỮ NGUYÊN thẻ <span>
 *  đơn vị đứng sau. Không có số -> '--'. */
function ribbonGhi(id, giaTri, soLe) {
    const el = document.getElementById(id);
    if (!el) return;
    const unit = el.querySelector('span');
    if (giaTri === null || !isFinite(giaTri)) {
        el.textContent = '--';
    } else {
        el.textContent = giaTri.toLocaleString('vi-VN', {
            minimumFractionDigits: soLe, maximumFractionDigits: soLe
        });
    }
    if (unit) el.appendChild(unit);
}

/** Đổ số ra dải chỉ số trang chủ (3 ô: tổng sản lượng, % đạt, hệ số lợi dụng)
 *  và in nhật ký đối chiếu ra Console. */
function ribbonVe() {
    const kq = ribbonTinh();
    if (!kq) {
        console.warn('[Dải chỉ số] Không tìm thấy cột "' + RIBBON_CFG.cols.sanLuong[0]
            + '". Xem tên cột thật bằng: xemCotSanLuong()');
        return;
    }

    const R = RIBBON_CFG.lamTron;
    ribbonGhi('tong-san-luong', kq.tongSL, R.sanLuong);
    ribbonGhi('tb-loi', kq.dat, R.dat);
    ribbonVeHeSo(kq);

    /* Tiêu đề ô đầu ghi rõ đang là tháng nào — khỏi phải sửa index.html mỗi tháng. */
    const h = document.querySelector('#tong-san-luong');
    const box = h && h.closest ? h.closest('.stat-box') : null;
    const tieuDe = box ? box.querySelector('h3') : null;
    if (tieuDe) tieuDe.textContent = 'TỔNG SẢN LƯỢNG THÁNG ' + kq.thang + '/' + kq.nam;

    /* Báo ra Console khi thiếu cột, để biết vì sao một ô trống / thấp */
    if (kq.thieuCot.keHoach) {
        console.warn('[Dải chỉ số] Thiếu cột "' + RIBBON_CFG.cols.keHoach[0]
            + '" -> ô % đạt để trống.');
    }
    if (kq.thieuCot.dung) {
        console.warn('[Dải chỉ số] Không thấy cột giờ dừng (thử: '
            + RIBBON_CFG.cols.gioDung.join(' | ')
            + ') -> mẫu số đang tính với giờ dừng = 0, hệ số sẽ THẤP hơn thực tế. '
            + 'Gõ xemCotSanLuong() để lấy tên cột thật.');
    }
    if (kq.thieuCot.dungKH) {
        /* Sheet hiện chỉ có MỘT cột "Thời gian dừng" gộp cả đình trệ lẫn dừng
           kế hoạch — đúng như công thức đang dùng, nên đây chỉ là ghi chú. */
        console.info('[Dải chỉ số] Không có cột giờ dừng kế hoạch riêng — '
            + 'đang coi cột "' + RIBBON_CFG.cols.gioDung[0] + '" là TỔNG giờ dừng. '
            + 'Nếu sau này tách làm hai cột thì khai tên cột thứ hai vào '
            + 'RIBBON_CFG.cols.gioDungKH, chương trình tự cộng thêm.');
    }

    /* Nhật ký đầy đủ để đối chiếu tay với bảng tính */
    [['TK3', kq.tk3], ['TK4', kq.tk4]].forEach(function (c) {
        const d = c[1];
        if (!d) return;
        const kt = kiemTraHeSoLoiDung(d.heSo);
        const dong = '[Hệ số lợi dụng ' + c[0] + '] '
            + (d.heSo === null ? '--' : d.heSo.toFixed(3)) + ' t/m²·h = '
            + Math.round(d.tongSL).toLocaleString('vi-VN') + ' / ['
            + RIBBON_CFG.heSo.dienTich + ' x (' + RIBBON_CFG.heSo.gioMoiNgay
            + ' x ' + d.soNgay + ' ngày - ' + hsGio(d.gioDung) + 'h dừng)] — '
            + (kt.ok ? 'HỢP LỆ' : 'KHÔNG HỢP LỆ: ' + kt.loi);
        if (kt.ok) console.info(dong); else console.warn(dong);
    });

    console.info('[Dải chỉ số] Tháng ' + kq.thang + '/' + kq.nam
        + ' — ' + kq.soCa + ' ca, sản lượng ' + Math.round(kq.tongSL).toLocaleString('vi-VN')
        + ' / kế hoạch ' + Math.round(kq.tongKH).toLocaleString('vi-VN')
        + ' (cộng tới hết ngày ' + kq.ngayChot + ')');
}

/** Ô hệ số lợi dụng trên trang chủ: một ô nhưng HAI số, TK3 và TK4 đứng cạnh
 *  nhau. Số không hợp lệ (kiemTraHeSoLoiDung) tô đỏ kèm ⚠, rê chuột để xem lý
 *  do; số hợp lệ thì rê chuột xem phép tính. Đơn vị chuyển lên tiêu đề cho khỏi
 *  lặp hai lần. */
function ribbonVeHeSo(kq) {
    const el = document.getElementById('he-so-loi-dung');
    if (!el) return;

    const box = el.closest ? el.closest('.stat-box') : null;
    const tieuDe = box ? box.querySelector('h3') : null;
    if (tieuDe) {
        /* Đơn vị tách thành span riêng để CSS giữ chữ thường "t/m²·h" — h3 đang
           in hoa toàn bộ, để chung thì thành "T/M²·H" khó đọc. */
        tieuDe.textContent = 'HỆ SỐ LỢI DỤNG THÁNG ';
        const dv = document.createElement('span');
        dv.className = 'heso-donvi';
        dv.textContent = '(t/m²·h)';
        tieuDe.appendChild(dv);
    }

    const R = RIBBON_CFG.lamTron;
    el.classList.add('heso-doi');
    el.innerHTML = '';

    [['TK3', kq.tk3], ['TK4', kq.tk4]].forEach(function (c) {
        const d = c[1];
        const hs = d ? d.heSo : null;
        const kt = kiemTraHeSoLoiDung(hs);

        const o = document.createElement('span');
        o.className = 'heso-mot' + (kt.ok ? '' : ' is-loi');
        o.title = kt.ok ? (d ? d.moTaMauSo : '') : kt.loi;

        const ten = document.createElement('b');
        ten.textContent = c[0] + (kt.ok ? '' : ' ⚠');
        const so = document.createElement('i');
        so.textContent = (hs === null || !isFinite(hs)) ? '--'
            : hs.toLocaleString('vi-VN', {
                minimumFractionDigits: R.heSo, maximumFractionDigits: R.heSo });

        o.appendChild(ten);
        o.appendChild(so);
        el.appendChild(o);
    });
}
