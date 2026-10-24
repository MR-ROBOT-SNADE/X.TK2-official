/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/nhip_ve.js — GIẢM NHỊP DỰNG LẠI HÌNH HỌC
 * =============================================================================
 * HEAVY_REDRAW_EVERY, useRedrawGate: các lớp hạt trang trí nặng chỉ dựng lại
 * hình mỗi 2 khung hình — dùng chung cho nhiều thiết bị.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import { useRef } from 'react';

/* =============================================================================
 * GIẢM NHỊP DỰNG LẠI HÌNH HỌC
 * Các lớp hạt trang trí (cục liệu quay trên vành làm mát, dòng liệu rơi, bụi
 * trong ống, vệt hút dưới xe ghi) đang gọi g.clear() rồi vẽ lại TOÀN BỘ ở MỖI
 * khung hình. Mỗi lần như vậy Pixi phải dựng lại bộ đệm hình học và cấp phát
 * bộ nhớ mới -> bộ dọn rác chạy liên tục, đó là lý do càng để lâu càng giật.
 * Vị trí hạt vẫn cập nhật đủ 60 lần/giây (nên tốc độ chạy KHÔNG đổi), chỉ có
 * việc DỰNG LẠI HÌNH là giãn ra 2 khung một lần — mắt thường không nhận ra.
 * ===========================================================================*/
export const HEAVY_REDRAW_EVERY = 2;

/** Trả về true nếu khung hình này ĐƯỢC PHÉP dựng lại hình học.
 *  CHỈ dùng được cho component nào CẬP NHẬT VỊ TRÍ Ở NGOÀI khối vẽ (ví dụ vành
 *  làm mát: góc quay `rot` vẫn cộng đủ mỗi khung, chỉ có việc vẽ lại cục liệu là
 *  giãn nhịp). Nếu component cập nhật vị trí NGAY TRONG khối vẽ thì chặn khối
 *  đó sẽ làm chuyển động chậm đi một nửa — đừng dùng cổng này ở đó. */
export const useRedrawGate = () => {
    const n = useRef(0);
    return () => (++n.current % HEAVY_REDRAW_EVERY) === 0;
};
