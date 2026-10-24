/* =============================================================================
 * js/components/Charts/ve/nhap_nhay.js — NHẤP NHÁY CỘT VƯỢT ĐỊNH MỨC
 * =============================================================================
 * Phần 2/7 của bộ đồ nghề vẽ biểu đồ (thư mục ve/, trước 24/10/2026 là
 * chart_core.js) — đọc ve/chung.js trước để biết cả thư mục.
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
 * "Khối nào đang mở" do DieuPhoi trong bep/dieu_phoi.js nắm giữ (một nguồn duy
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
