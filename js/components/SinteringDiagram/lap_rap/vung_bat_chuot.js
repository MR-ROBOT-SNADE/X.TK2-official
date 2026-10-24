/* =============================================================================
 * js/components/SinteringDiagram/lap_rap/vung_bat_chuot.js — VÙNG BẮT CHUỘT CỦA CÁC HẠNG MỤC
 * =============================================================================
 * HOTSPOTS, FLOW_ROWS (ráp toạ độ thật cho pop-up — nội dung ở hang_muc.js),
 * feedRectToCanvas (đổi toạ độ feed-local -> điểm ảnh trên canvas).
 *
 * Một phần LẮP RÁP sơ đồ (thư mục lap_rap/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (cau_hinh.js) và LAYOUT (bo_cuc.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import { buildHotspots } from '../hang_muc.js';
import { buildFlowRows } from '../diagramHotspots.jsx';

import { CFG, STAGE } from '../cau_hinh.js';
import { LAYOUT } from '../bo_cuc.js';
import { LINE2_GAS_FLIP_AXIS, LINE2_PIVOT } from './day_chuyen_2.jsx';

/* =============================================================================
 * VÙNG BẮT CHUỘT CỦA CÁC HẠNG MỤC (cho bảng thông tin pop-up)
 * Danh mục + nội dung nằm ở hang_muc.js; ở đây chỉ ráp toạ độ thật.
 * Hạng mục nào có ở cả 2 dây chuyền sẽ tự sinh thêm bản dây 2 bằng cách lấy
 * gương qua ĐÚNG trục mà SinterLine2 đang dùng (tâm Trạm S1).
 * ===========================================================================*/
/* Hệ khí (nồi hơi + tuần hoàn khí thải) của dây 2 bị lật HAI LẦN nên rốt cuộc
   chỉ là TỊNH TIẾN, không lật. Vùng bắt chuột của 2 hạng mục đó phải theo đúng
   phép biến đổi này, lấy gương như phần còn lại là trỏ sai chỗ ~360 đơn vị. */
const LINE2_GAS_SHIFT = LINE2_PIVOT.y * 2 - LINE2_GAS_FLIP_AXIS * 2;   // = 850

export const HOTSPOTS = buildHotspots(CFG, LAYOUT, LINE2_PIVOT.y, LINE2_GAS_SHIFT);

/* Các dòng của bảng danh mục bên cạnh sơ đồ — đánh số theo chiều đi của liệu. */
export const FLOW_ROWS = buildFlowRows(HOTSPOTS);

/* Đổi toạ độ FEED-LOCAL -> toạ độ điểm ảnh trên canvas (khớp đúng phép biến đổi
   của camera ảo + Container cụm nạp liệu), để đặt bảng HTML nằm chồng lên canvas. */
export const feedRectToCanvas = (rects) => {
    const z = STAGE.camera.zoom;
    const ox = STAGE.camera.x + z * CFG.FEEDING_SECTION.x;
    const oy = STAGE.camera.y + z * CFG.FEEDING_SECTION.y;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    rects.forEach((r) => {
        x0 = Math.min(x0, ox + z * r.x);
        y0 = Math.min(y0, oy + z * r.y);
        x1 = Math.max(x1, ox + z * (r.x + r.w));
        y1 = Math.max(y1, oy + z * (r.y + r.h));
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};
