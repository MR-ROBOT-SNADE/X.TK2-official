/* =============================================================================
 * js/components/SinteringDiagram/equipment/shuttleDistributor.jsx — CON THOI RẢI LIỆU + MÀU QUẶNG THIÊU KẾT
 * =============================================================================
 * ShuttleDistributor (xe rải liệu chạy qua lại trên trống bố liệu),
 * COOLED_SINTER_COLORS, BLACK_SINTER_COLORS (bảng màu quặng thiêu kết).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/* =============================================================================
 * CONTAINER 6: CON THOI RẢI LIỆU • MÁY LÀM MÁT VÒNG • QUẠT HÚT GIÓ
 * ===========================================================================*/

/* Quặng thiêu kết đã qua làm mát (đổ ra băng sau máy làm mát vòng) */
export const COOLED_SINTER_COLORS = [0x4e342e, 0x5d4037, 0x3e2723, 0x2c1e1a];

/* Quặng thiêu kết ĐEN — liệu trên vành làm mát và trên băng xả */
export const BLACK_SINTER_COLORS = [0x1c2833, 0x17202a, 0x212f3d, 0x0e1418];

/**
 * MÁY RẢI LIỆU CON THOI: xe rải chạy qua-lại dọc theo mặt trống bố liệu.
 * Component chỉ vẽ con thoi; việc "chạy sang nửa bên kia thì khuất" được xử lý
 * bằng THỨ TỰ LỚP — render component này TRƯỚC silo/băng liệu hỗn hợp.
 * @param {object} rail {x, yTop, yBottom} đường chạy (dọc theo trống bố liệu).
 * @param {object} size {width, height} kích thước thân con thoi.
 */
export const ShuttleDistributor = ({ rail, size = { width: 50, height: 26 }, speed = 0.55 }) => {
    const gRef = useRef(null);
    const pos = useRef(rail.yTop);
    const dir = useRef(1);

    const drawRail = useCallback((g) => {
        g.clear();
        // Ray dẫn hướng con thoi (2 thanh mảnh dọc)
        g.lineStyle(1.5, COLORS.machineDark, 0.55);
        g.moveTo(rail.x - size.width / 2 + 4, rail.yTop);
        g.lineTo(rail.x - size.width / 2 + 4, rail.yBottom);
        g.moveTo(rail.x + size.width / 2 - 4, rail.yTop);
        g.lineTo(rail.x + size.width / 2 - 4, rail.yBottom);
    }, [rail.x, rail.yTop, rail.yBottom, size.width]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;

        // Chạy qua-lại giữa 2 đầu ray
        pos.current += dir.current * speed * delta;
        if (pos.current >= rail.yBottom) { pos.current = rail.yBottom; dir.current = -1; }
        if (pos.current <= rail.yTop) { pos.current = rail.yTop; dir.current = 1; }

        const y = pos.current;
        const hw = size.width / 2;
        const hh = size.height / 2;
        g.clear();

        // Thân con thoi
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(rail.x - hw, y - hh, size.width, size.height, 4);
        g.endFill();
        // Băng rải bên trong (vạch chéo chạy theo chiều di chuyển)
        g.lineStyle(1.5, COLORS.steelLight, 0.75);
        for (let i = 0; i < 4; i++) {
            const bx = rail.x - hw + 8 + i * 11;
            g.moveTo(bx, y - hh + 4);
            g.lineTo(bx + 5, y + hh - 4);
        }
        // 2 bánh xe 2 đầu
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark);
        g.drawCircle(rail.x - hw + 5, y - hh - 2, 3);
        g.drawCircle(rail.x + hw - 5, y - hh - 2, 3);
        g.drawCircle(rail.x - hw + 5, y + hh + 2, 3);
        g.drawCircle(rail.x + hw - 5, y + hh + 2, 3);
        g.endFill();
        // Liệu đang rải xuống dưới con thoi
        g.beginFill(COLORS.mixedOre, 0.6);
        for (let i = 0; i < 5; i++) {
            g.drawCircle(rail.x - hw + 9 + Math.random() * (size.width - 18), y + hh + 3 + Math.random() * 5, 1.6);
        }
        g.endFill();
    });

    return (
        <Container>
            <Graphics draw={drawRail} />
            <Graphics ref={gRef} />
        </Container>
    );
};
