/* =============================================================================
 * pixiStage.jsx — LẮP RÁP SƠ ĐỒ CÔNG NGHỆ (mục #so-do-cong-nghe)
 * =============================================================================
 * FILE NÀY LÀM GÌ
 *   Component gốc PixiStage: dựng toàn bộ sơ đồ dây chuyền thiêu kết trên một
 *   canvas WebGL (Pixi), rồi phủ lên trên các lớp HTML: bảng thông tin hạng mục
 *   (pop-up), bảng danh mục bên cạnh, video lưu trình, các nút tạm dừng / toàn
 *   màn hình. DiagramApp.jsx chỉ nạp file này khi người xem mở tới mục sơ đồ.
 *
 * CÁC FILE CỦA SƠ ĐỒ (trước 24/10/2026 là 3 file lớn, nay tách theo việc)
 *   DiagramApp.jsx        điểm vào: chỉ tải sơ đồ khi người xem mở tới
 *   pixiStage.jsx         FILE NÀY: <Stage> + camera + pop-up + nút điều khiển
 *   stageConfig.js        STAGE, CFG — MUỐN DỜI / CO GIÃN SƠ ĐỒ: CHỈ SỬA SỐ Ở ĐÂY
 *   layout.js             buildLayout(): từ CFG tính toạ độ chi tiết (LAYOUT)
 *   assembly/             ghép thiết bị thành từng khu:
 *     stations.jsx          vá góc băng tải, nhà trạm S1 / S2
 *     productArea.jsx       nhà sàng, bãi liệu, khu xe tải, trạm S3 / S4
 *     sampleArea.jsx        khu lấy mẫu, silo máng, trạm S3
 *     sinterLine.jsx        SinterLinePartA..E (một dây chuyền)
 *     sinterLine2.jsx       SinterLine2: dây 2 = ẢNH GƯƠNG dây 1 qua tâm Trạm S1
 *     hotspotRegions.js     HOTSPOTS, FLOW_ROWS: vùng bắt chuột cho pop-up
 *     feedingSection.jsx    TopFeedingSection: xếp lớp cả sơ đồ
 *     perfGuards.js         TickerGuard, PerfGuard: dừng vẽ khi không ai nhìn, tự hạ tải
 *   diagramContainer.jsx  MỤC LỤC thiết bị; mã từng thiết bị ở equipment/
 *   hotspotData.js        NỘI DUNG pop-up: tên, mô tả, thông số, ảnh / video
 *   diagramHotspots.jsx   giao diện pop-up + bắt chuột + bảng danh mục
 *
 * Thứ tự đọc gợi ý: stageConfig.js -> assembly/feedingSection.jsx -> file này.
 * ===========================================================================*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Container } from '@pixi/react';
import {
    DiagramSidePanel, HotspotLayer, HotspotPopup, ProcessVideo, useHotspotPointer
} from './diagramHotspots.jsx';

import { CFG, STAGE } from './stageConfig.js';
import { StationS2 } from './assembly/stations.jsx';
import { FLOW_ROWS, HOTSPOTS, feedRectToCanvas } from './assembly/hotspotRegions.js';
import { TopFeedingSection } from './assembly/feedingSection.jsx';
import { PerfGuard, TickerGuard } from './assembly/perfGuards.js';

/* =============================================================================
 * STAGE GỐC
 * ===========================================================================*/

/** COMPONENT GỐC của sơ đồ (DiagramApp.jsx dựng component này).
 *  Gồm: khung chứa (hostRef) + <Stage> Pixi có camera ảo + các lớp HTML phủ
 *  trên canvas (pop-up thông tin, bảng danh mục, video, nút tạm dừng / toàn
 *  màn hình). Quản lý trạng thái: hạng mục đang rê chuột / đang ghim. */
const PixiStage = () => {
    const hostRef = useRef(null);

    /* --- Trạng thái bảng thông tin hạng mục ---------------------------------
       hover  : đang rê chuột qua hạng mục nào (tự tắt khi rời ra)
       pinned : đã bấm chọn -> bảng đứng yên cho tới khi bấm × hoặc Esc
       Hai bộ đếm giờ tạo độ trễ nhỏ: vào 110ms cho khỏi loé khi lướt ngang,
       ra 260ms để kịp đưa chuột từ sơ đồ vào trong bảng mà bảng không biến mất. */
    const [hovered, setHovered] = useState(null);
    const [pinned, setPinned] = useState(null);
    const enterTimer = useRef(null);
    const leaveTimer = useRef(null);

    const clearTimers = useCallback(() => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
    }, []);
    useEffect(() => clearTimers, [clearTimers]);

    const handleEnter = useCallback((item) => {
        clearTimeout(leaveTimer.current);
        clearTimeout(enterTimer.current);
        enterTimer.current = setTimeout(() => setHovered(item), 110);
    }, []);

    const handleLeave = useCallback(() => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => setHovered(null), 260);
    }, []);

    const handlePick = useCallback((item) => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        setHovered(item);
        setPinned((cur) => (cur && cur.key === item.key ? null : item));
    }, []);

    const holdPopup = useCallback(() => clearTimeout(leaveTimer.current), []);
    const releasePopup = useCallback(() => {
        if (pinned) return;
        clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => setHovered(null), 200);
    }, [pinned]);

    const closePopup = useCallback(() => {
        clearTimers();
        setPinned(null);
        setHovered(null);
    }, [clearTimers]);

    /* Bắt chuột THẲNG trên thẻ canvas (không qua hệ sự kiện của Pixi — xem lời
       giải thích trong diagramHotspots.jsx). */
    useHotspotPointer({
        hostRef,
        items: HOTSPOTS,
        stage: STAGE,
        camera: STAGE.camera,
        feed: CFG.FEEDING_SECTION,
        onEnter: handleEnter,
        onLeave: handleLeave,
        onPick: handlePick,
    });

    /* --- PHÓNG TO TOÀN MÀN HÌNH ------------------------------------------
       Ở chế độ thường, sơ đồ phải lọt trọn trong phần màn hình còn trống thì
       mới không bị 2 thanh cố định che mất mép trên. Nút này bỏ qua giới hạn
       đó: đưa cả khung sơ đồ ra toàn màn hình, không còn thanh nào che. */
    const [isFull, setIsFull] = useState(false);

    /* (4) TẠM DỪNG / CHẠY. Mặc định CHẠY khi mới vào trang.
       Dừng vòng vẽ cũng là cách hạ tải mạnh nhất cho máy yếu. */
    const [paused, setPaused] = useState(false);

    const toggleFullscreen = useCallback(() => {
        const host = hostRef.current;
        if (!host) return;
        const target = host.closest('.sintering-diagram-wrapper') || host;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else target.requestFullscreen?.();
    }, []);

    useEffect(() => {
        const onChange = () => {
            setIsFull(Boolean(document.fullscreenElement));
            // canvas đổi cỡ -> bắn resize để mọi thứ tính lại
            setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    /* Rê chuột từ BẢNG DANH MỤC bên cạnh. Tách riêng khỏi `hovered` (rê trên
       canvas) vì một dòng trong bảng có thể ứng với NHIỀU vùng trên sơ đồ —
       thiết bị có ở cả hai dây chuyền thì phải sáng cả hai chỗ. */
    const [rowHover, setRowHover] = useState(null);
    const handleRowEnter = useCallback((row) => setRowHover(row), []);
    const handleRowLeave = useCallback(() => setRowHover(null), []);
    const handleRowPick = useCallback((row) => {
        const item = HOTSPOTS.find((h) => h.key === row.key);
        if (!item) return;
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        setHovered(item);
        setPinned((cur) => (cur && cur.key === item.key ? null : item));
    }, []);

    const shown = pinned || hovered;
    const shownRect = useMemo(
        () => (shown ? feedRectToCanvas(shown.rects) : null),
        [shown]
    );

    /* Ưu tiên vùng đang rê trong bảng danh mục, sau đó mới tới vùng đang rê
       trên canvas. */
    const highlightRects = useMemo(() => {
        if (rowHover) return rowHover.rects;
        return shown ? shown.rects : null;
    }, [rowHover, shown]);

    /* Dòng nào trong bảng đang được làm nổi — nối NGƯỢC từ sơ đồ về bảng. */
    const activeRowId = rowHover ? rowHover.id : (shown ? shown.id : null);

    // Ép trình duyệt tính lại kích thước sau khi mount (canvas co giãn theo CSS,
    // đôi khi render lần đầu bị sai kích thước nên bắn lại resize 2 nhịp)
    useEffect(() => {
        const timer1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        const timer2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    /* Thẻ gắn React (#react-sodo-boot) trước đây được hướng dẫn gắn class
       .sintering-diagram-wrapper. Nay khung sơ đồ do chính React dựng ra bên
       trong, nếu thẻ ngoài VẪN còn class đó thì thành hai lớp tỉ lệ lồng nhau
       -> canvas bẹp dí. Gỡ luôn ở đây để không phải sửa index.html. */
    useEffect(() => {
        const boot = hostRef.current && hostRef.current.closest('#react-sodo-boot');
        if (boot) boot.classList.remove('sintering-diagram-wrapper');
    }, []);

    /* TỰ KIỂM TRA khi khởi động: in ra Console (F12) tình trạng của tính năng
       pop-up, và TỰ CHỮA nếu canvas đang bị CSS khoá chuột. Nhờ vậy khi có trục
       trặc chỉ cần mở F12 là biết ngay hỏng ở đâu, không phải mò. */
    useEffect(() => {
        const t = setTimeout(() => {
            const host = hostRef.current;
            const canvas = host && host.querySelector('canvas');
            if (!canvas) {
                console.error('[Sơ đồ công nghệ] Không tìm thấy thẻ canvas — sơ đồ chưa dựng được.');
                return;
            }

            // 1) Canvas có nhận chuột không?
            if (getComputedStyle(canvas).pointerEvents === 'none') {
                canvas.style.pointerEvents = 'auto';           // tự chữa
                console.warn('[Sơ đồ công nghệ] Canvas đang bị CSS khoá chuột — đã tự bật lại. '
                    + 'Nguyên nhân: css/diagram.css vẫn là BẢN CŨ.');
            }

            // 2) File CSS đã có phần định dạng bảng pop-up chưa?
            let cssOk = false;
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && rule.selectorText.includes('sd-pop')) { cssOk = true; break; }
                    }
                } catch { /* stylesheet khác miền, bỏ qua */ }
                if (cssOk) break;
            }
            if (!cssOk) {
                console.warn('[Sơ đồ công nghệ] css/diagram.css CHƯA có định dạng bảng pop-up (.sd-pop). '
                    + 'Bảng vẫn hiện được nhưng sẽ xấu. Hãy chép đè css/diagram.css bằng bản mới.');
            }

            const box = canvas.getBoundingClientRect();
            console.log(`[Sơ đồ công nghệ] Pop-up hạng mục: ĐÃ BẬT — ${HOTSPOTS.length} vùng bắt chuột. `
                + `Canvas ${Math.round(box.width)}x${Math.round(box.height)}px, `
                + `nhận chuột: ${getComputedStyle(canvas).pointerEvents}, `
                + `CSS bảng: ${cssOk ? 'có' : 'THIẾU'}.`);
        }, 300);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="sd-root">
        <div className="sintering-diagram-layout">

            {/* BẢNG BÊN CẠNH SƠ ĐỒ: khung mô tả luồng + danh mục hạng mục.
                Đặt TRƯỚC khung sơ đồ trong DOM nên nằm bên TRÁI, đúng chỗ trống
                sau khi sơ đồ dồn sang phải. Muốn đảo sang phải thì xem ghi chú
                `flex-direction` ở .sintering-diagram-layout trong diagram.css. */}
            <DiagramSidePanel
                rows={FLOW_ROWS}
                activeId={activeRowId}
                onHoverRow={handleRowEnter}
                onLeaveRow={handleRowLeave}
                onPickRow={handleRowPick}
            />

            <div className="sintering-diagram-wrapper">
        <div ref={hostRef} className="sintering-diagram-host" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Stage
            width={STAGE.width}
            height={STAGE.height}
            options={{
                backgroundAlpha: 0,
                antialias: true,
                // Khoá về 1 để không phải vẽ gấp 4 lần số điểm ảnh trên màn
                // hình HiDPI — canvas vốn đã lớn hơn khung hiển thị.
                resolution: 1,
                autoDensity: false,
                powerPreference: 'high-performance',
            }}
            style={{
                width: '100%', height: '100%', display: 'block', margin: '0 auto',

                /* BẮT BUỘC ĐẶT INLINE, không được chỉ dựa vào diagram.css.
                   Bản diagram.css CŨ có luật `.sintering-diagram-wrapper canvas
                   { pointer-events: none }` — canvas không nhận chuột thì pop-up
                   hạng mục không bao giờ hiện. Luật đó KHÔNG có !important nên
                   style inline ở đây thắng, tính năng chạy được ngay cả khi file
                   CSS chưa kịp cập nhật. */
                pointerEvents: 'auto',

                /* Pixi tự ghi đè touch-action = 'none' lên canvas khi bật hệ sự
                   kiện -> trên di động đặt ngón tay vào sơ đồ là không vuốt cuộn
                   trang được. Đặt lại 'auto' để trả cử chỉ vuốt cho trình duyệt. */
                touchAction: 'auto',
            }}
        >
            {/* Bộ canh vòng vẽ — không vẽ gì, chỉ bật/tắt ticker cho đỡ tốn máy */}
            <TickerGuard hostRef={hostRef} paused={paused} />
            <PerfGuard hostRef={hostRef} />

            {/* CAMERA ẢO: quản lý toạ độ toàn cục (pan qua position, zoom qua scale) */}
            <Container
                position={[STAGE.camera.x, STAGE.camera.y]}
                scale={{ x: STAGE.camera.zoom, y: STAGE.camera.zoom }}
            >
                {/* Cụm nạp liệu chính */}
                <TopFeedingSection x={CFG.FEEDING_SECTION.x} y={CFG.FEEDING_SECTION.y} />

                {/* Trạm S2 (vị trí cố định) — PHẢI vẽ SAU cụm nạp liệu.
                    Trước đây vẽ trước nên 2 băng tải thành phẩm cắm vào đáy nhà
                    trạm bị vẽ ĐÈ LÊN nhà, nhìn như băng nổi trên mái. */}
                <StationS2 />

                {/* KHUNG TÔ SÁNG hạng mục đang trỏ tới — vẽ CUỐI CÙNG nên nằm
                    trên mọi thiết bị. Đặt trong Container cùng gốc toạ độ với
                    cụm nạp liệu để dùng thẳng toạ độ feed-local của CFG.
                    Việc BẮT CHUỘT do useHotspotPointer lo, làm trên thẻ canvas. */}
                <Container x={CFG.FEEDING_SECTION.x} y={CFG.FEEDING_SECTION.y}>
                    <HotspotLayer rects={highlightRects} />
                </Container>
            </Container>
        </Stage>

        {/* HAI NÚT ĐIỀU KHIỂN: tạm dừng và phóng to */}
        <div className="sd-tools">
            <button
                type="button"
                className="sd-btn"
                onClick={() => setPaused((v) => !v)}
                title={paused ? 'Chạy tiếp sơ đồ' : 'Tạm dừng sơ đồ'}
            >
                <span className="sd-btn__ico">{paused ? '\u25B6' : '\u23F8'}</span>
                {paused ? 'Chạy' : 'Tạm dừng'}
            </button>

            <button
                type="button"
                className="sd-btn"
                onClick={toggleFullscreen}
                title={isFull ? 'Thoát toàn màn hình (Esc)' : 'Phóng to toàn màn hình'}
            >
                <span className="sd-btn__ico">{isFull ? '\u2715' : '\u26F6'}</span>
                {isFull ? 'Thoát' : 'Phóng to'}
            </button>
        </div>

        {/* BẢNG THÔNG TIN HẠNG MỤC — HTML thường nằm chồng lên canvas */}
        {shown && shownRect && (
            <HotspotPopup
                key={shown.key}
                item={shown}
                rect={shownRect}
                hostRef={hostRef}
                stage={STAGE}
                pinned={Boolean(pinned)}
                onHold={holdPopup}
                onRelease={releasePopup}
                onClose={closePopup}
            />
        )}
        </div>
            </div>
        </div>

        {/* KHUNG PHÁT VIDEO LƯU TRÌNH — dải RIÊNG chạy hết bề ngang, nằm DƯỚI
            cả bảng danh mục lẫn sơ đồ. */}
        <ProcessVideo />
        </div>
    );
};

export default PixiStage;
