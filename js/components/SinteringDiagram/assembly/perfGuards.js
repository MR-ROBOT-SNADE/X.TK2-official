/* =============================================================================
 * js/components/SinteringDiagram/assembly/perfGuards.js — TIẾT KIỆM TÀI NGUYÊN + TỰ HẠ TẢI
 * =============================================================================
 * TickerGuard (dừng vòng vẽ khi cuộn khỏi sơ đồ / ẩn tab), PerfGuard (hạ độ
 * phân giải, khoá 30 khung hình/giây trên máy yếu). Không vẽ gì.
 *
 * Một phần LẮP RÁP sơ đồ (thư mục assembly/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (stageConfig.js) và LAYOUT (layout.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import { useEffect, useRef } from 'react';
import { useApp } from '@pixi/react';

import { STAGE } from '../stageConfig.js';

/* =============================================================================
 * TIẾT KIỆM TÀI NGUYÊN — DỪNG HẲN VÒNG VẼ KHI KHÔNG AI NHÌN
 * Sơ đồ có hàng trăm nghìn hạt liệu chạy liên tục. Trước đây nó vẫn chạy kể cả
 * khi người dùng đã cuộn sang mục khác hoặc chuyển sang tab khác: CPU/GPU nóng
 * lên, máy tự hạ xung, và CÀNG ĐỂ LÂU CÀNG GIẬT.
 * Hai điều kiện dừng:
 *   1) Canvas cuộn ra khỏi màn hình  -> IntersectionObserver
 *   2) Tab trình duyệt bị ẩn         -> sự kiện visibilitychange
 * Quay lại thì chạy tiếp, không mất trạng thái.
 * Component này KHÔNG vẽ gì, chỉ nằm trong <Stage> để lấy được đúng ticker của
 * ứng dụng Pixi này qua useApp() (mỗi Stage có ticker riêng, không phải shared).
 * ===========================================================================*/
export const TickerGuard = ({ hostRef, paused }) => {
    const app = useApp();
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    useEffect(() => {
        const host = hostRef.current;
        if (!app || !host) return undefined;
        const ticker = app.ticker;

        let onScreen = true;
        let tabVisible = !document.hidden;
        const sync = () => {
            if (onScreen && tabVisible && !pausedRef.current) {
                if (!ticker.started) ticker.start();
            } else if (ticker.started) {
                ticker.stop();
                /* Vẽ thêm MỘT khung nữa để hình dừng lại không bị trắng.
                   Bọc try/catch: lúc thành phần đang bị gỡ thì renderer có thể
                   đã huỷ, gọi vào là nổ lỗi làm hỏng cả sơ đồ. */
                try { app.renderer.render(app.stage); } catch { /* đã huỷ */ }
            }
        };
        // Đổi trạng thái tạm dừng thì gọi lại sync ngay
        TickerGuard._sync = sync;

        const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); },
                                            { threshold: 0 });
        io.observe(host);
        const onVis = () => { tabVisible = !document.hidden; sync(); };
        document.addEventListener('visibilitychange', onVis);
        sync();

        return () => {
            io.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            TickerGuard._sync = null;
            if (!ticker.destroyed && !ticker.started) ticker.start();
        };
    }, [app, hostRef]);

    /* Bấm nút tạm dừng -> chạy lại sync để bật/tắt vòng vẽ */
    useEffect(() => { if (TickerGuard._sync) TickerGuard._sync(); }, [paused]);

    return null;
};

/* =============================================================================
 * BỘ TỰ HẠ TẢI — giữ sơ đồ chạy mượt trên máy yếu
 * -----------------------------------------------------------------------------
 * Sơ đồ vẽ trên canvas 2220x1367 = 3,0 triệu điểm ảnh mỗi khung hình. Máy có
 * card rời nuốt trôi, máy dùng đồ hoạ tích hợp thì nghẹn.
 * Hai việc thành phần này làm:
 *   1) KHỚP ĐỘ PHÂN GIẢI VỚI CỠ HIỂN THỊ THẬT. Khung sơ đồ trên màn 1920 chỉ
 *      rộng ~1290px trong khi canvas vẽ ở 2220px -> đang vẽ thừa gần 3 lần số
 *      điểm ảnh rồi thu nhỏ lại. Hạ độ phân giải cho khớp là giảm ~66% khối
 *      lượng vẽ mà mắt KHÔNG thấy khác, vì vẫn đúng 1 điểm ảnh trên màn.
 *   2) TỰ ĐO TỐC ĐỘ KHUNG HÌNH. Chậm quá thì hạ tiếp: trước hết khoá 30 khung
 *      hình/giây (đủ mượt cho băng tải), vẫn chậm thì hạ thêm độ phân giải.
 * ===========================================================================*/
export const PerfGuard = ({ hostRef }) => {
    const app = useApp();

    useEffect(() => {
        if (!app || !app.renderer) return undefined;
        const renderer = app.renderer;

        let step = 0;                       // 0 = đủ chất lượng, 1 = khoá 30fps, 2 = hạ thêm
        let extra = 1;                      // hệ số hạ thêm độ phân giải

        const applyResolution = () => {
            const host = hostRef.current;
            const w = host ? host.getBoundingClientRect().width : 0;
            if (!w) return;
            // Vẽ vừa đủ cỡ hiển thị; chặn dưới 0.45 cho khỏi vỡ hạt, trên 1 cho
            // khỏi vẽ thừa. Nhân `extra` khi máy quá yếu.
            const want = Math.max(0.45, Math.min(1, (w / STAGE.width) * extra));
            if (Math.abs(renderer.resolution - want) < 0.03) return;
            renderer.resolution = want;
            renderer.resize(STAGE.width, STAGE.height);
        };

        applyResolution();
        const onResize = () => applyResolution();
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);

        /* Đo tốc độ khung hình mỗi giây, chậm thì hạ tải */
        let frames = 0;
        let t0 = performance.now();
        const probe = () => {
            frames += 1;
            const now = performance.now();
            if (now - t0 < 1000) return;
            const fps = (frames * 1000) / (now - t0);
            frames = 0; t0 = now;
            const target = app.ticker.maxFPS || 60;
            if (fps < target * 0.7 && step < 2) {
                step += 1;
                if (step === 1) {
                    app.ticker.maxFPS = 30;
                    console.warn('[Sơ đồ công nghệ] Máy chạy chậm — đã khoá 30 khung hình/giây.');
                } else {
                    extra = 0.75;
                    applyResolution();
                    console.warn('[Sơ đồ công nghệ] Vẫn chậm — đã hạ thêm độ phân giải canvas.');
                }
            }
        };
        app.ticker.add(probe);

        return () => {
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
            if (!app.ticker.destroyed) app.ticker.remove(probe);
        };
    }, [app, hostRef]);

    return null;
};
