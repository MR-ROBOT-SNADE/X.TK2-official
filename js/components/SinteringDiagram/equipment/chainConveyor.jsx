/* =============================================================================
 * js/components/SinteringDiagram/equipment/chainConveyor.jsx — BĂNG TẢI XÍCH + DÒNG QUẶNG ĐỔ
 * =============================================================================
 * ChainConveyorSegment (băng tải xích nhận liệu nóng từ máy làm mát vòng),
 * OrePourStream (dòng quặng đổ qua máng chuyển tiếp giữa 2 thiết bị).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, lerpColor } from './colors.js';
import { drawChunk, makeChunkShape } from './oreChunks.js';
import { BLACK_SINTER_COLORS } from './shuttleDistributor.jsx';

/**
 * BĂNG TẢI XÍCH (chain conveyor) — kết cấu vững hơn băng cao su, dùng cho đoạn
 * đầu nhận liệu thiêu kết nóng từ máy làm mát vòng: khung thép + 2 dây xích 2
 * bên + các THANH GẠT ngang chạy liên tục, mang cục liệu đen.
 * @param {number} x, y, length, angle  Như MainConveyorPlaceHolder.
 * @param {number} beltWidth  Bề rộng băng (mặc định 35 = BELT.height).
 * @param {boolean} reverse   Đảo chiều chạy. false = chạy theo chiều +x cục bộ
 *                            (băng dựng angle=90 -> chạy XUỐNG, tức ĐI RA khỏi
 *                            máy làm mát vòng). true = chạy ngược lại.
 */
export const ChainConveyorSegment = ({ x, y, length, angle = 0, beltWidth = 35, speed = 0.45, reverse = false }) => {
    const barsRef = useRef(null);
    const offset = useRef(0);
    const BAR_GAP = 16;

    const chunks = useMemo(() => Array.from({ length: Math.round(length / 9) }, () => ({
        px: Math.random() * length,
        py: 6 + Math.random() * (beltWidth - 12),
        size: 2.2 + Math.random() * 2,
        shape: makeChunkShape(6),
        color: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), [length, beltWidth]);

    const drawFrame = useCallback((g) => {
        g.clear();
        // Khung thép nặng
        g.lineStyle(2.5, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody, 0.95);
        g.drawRect(0, 0, length, beltWidth);
        g.endFill();
        // 2 ray dẫn xích 2 bên
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.9);
        g.drawRect(0, 0, length, 4);
        g.drawRect(0, beltWidth - 4, length, 4);
        g.endFill();
    }, [length, beltWidth]);

    useTick((delta) => {
        const g = barsRef.current;
        if (!g) return;
        const dir = reverse ? -1 : 1;                       // chiều chạy của xích + cục liệu
        offset.current = (offset.current + dir * speed * delta + BAR_GAP) % BAR_GAP;
        g.clear();

        // Thanh gạt ngang + mắt xích 2 bên chạy liên tục
        for (let bx = -BAR_GAP + offset.current; bx < length; bx += BAR_GAP) {
            if (bx < 0 || bx > length - 2) continue;
            g.lineStyle(0);
            g.beginFill(COLORS.steelLight, 0.9);
            g.drawRect(bx, 4, 3, beltWidth - 8);
            g.endFill();
            g.beginFill(COLORS.ductBody, 0.95);
            g.drawCircle(bx + 1.5, 2, 1.8);
            g.drawCircle(bx + 1.5, beltWidth - 2, 1.8);
            g.endFill();
        }

        // Cục liệu thiêu kết đen chạy theo băng
        chunks.forEach((c) => {
            c.px += dir * speed * delta;
            if (c.px > length) c.px -= length;
            if (c.px < 0) c.px += length;
            g.lineStyle(0);
            g.beginFill(c.color, 0.95);
            drawChunk(g, c.px, c.py, c.size, c.shape, 0);
            g.endFill();
        });
    });

    return (
        <Container x={x} y={y} angle={angle}>
            <Graphics draw={drawFrame} />
            <Graphics ref={barsRef} />
        </Container>
    );
};

/**
 * DÒNG QUẶNG ĐỔ (máng chuyển tiếp giữa 2 thiết bị).
 * Các cục quặng liên tục rời điểm `from`, rơi/trượt theo máng sang điểm `to`,
 * xoè nhẹ giữa dòng rồi CHỤM lại đúng miệng nhận, kèm bụi bay và cụm mảnh vụn
 * nảy lên tại điểm va đập. Dùng cho 2 điểm chuyển tiếp:
 *   - Nghiền trục đơn  -> máng máy làm mát vòng (quặng còn NÓNG).
 *   - Máy làm mát vòng -> băng tải xích (quặng đã nguội).
 * @param {object} from  {x, y} miệng xả của thiết bị nguồn.
 * @param {object} to    {x, y} điểm rơi trên thiết bị nhận.
 * @param {number} width Bề rộng máng (độ xoè ngang của dòng).
 * @param {number} count Số cục trong dòng (mật độ).
 * @param {boolean} hot  true = quặng còn đỏ lửa (đổ từ nghiền trục sang làm mát).
 */
export const OrePourStream = ({
    from, to,
    width = 26,
    count = 22,
    colors = BLACK_SINTER_COLORS,
    sizeRange = [3, 7],
    speed = 0.016,
    hot = false,
}) => {
    const gRef = useRef(null);

    /* Trục dòng chảy: u = dọc dòng, p = ngang dòng */
    const axis = useMemo(() => {
        const dx = to.x - from.x, dy = to.y - from.y;
        const len = Math.max(1, Math.hypot(dx, dy));
        return { len, ux: dx / len, uy: dy / len, px: -dy / len, py: dx / len };
    }, [from.x, from.y, to.x, to.y]);

    const grains = useMemo(() => Array.from({ length: count }, () => ({
        t: Math.random(),
        off: (Math.random() - 0.5) * width,
        size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
        vt: speed * (0.7 + Math.random() * 0.7),
        spin: Math.random() * Math.PI,
        vs: (Math.random() - 0.5) * 0.12,
        ci: Math.floor(Math.random() * colors.length),
        shape: makeChunkShape(6),
    })), [count, width, speed, colors, sizeRange[0], sizeRange[1]]);

    /* Mảnh vụn + bụi bật lên tại miệng nhận */
    const splash = useMemo(() => Array.from({ length: 14 }, () => ({
        life: 0, x: 0, y: 0, vx: 0, vy: 0, size: 2, shape: makeChunkShape(5),
    })), []);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        const { len, ux, uy, px, py } = axis;

        g.lineStyle(1.1, 0x000000, 0.45);
        grains.forEach((p) => {
            p.t += p.vt * delta;
            if (p.t >= 1) {
                // Chạm miệng nhận -> bắn mảnh vụn rồi quay về đầu máng
                let spawned = 0;
                for (const s of splash) {
                    if (s.life <= 0 && spawned < 2) {
                        s.x = to.x + px * p.off * 0.3;
                        s.y = to.y + py * p.off * 0.3;
                        s.vx = (Math.random() - 0.5) * 1.6 - ux * 0.3;
                        s.vy = (Math.random() - 0.5) * 1.6 - uy * 0.9;
                        s.size = 1.6 + Math.random() * 1.8;
                        s.life = 1;
                        spawned++;
                    }
                }
                p.t -= 1;
                p.off = (Math.random() - 0.5) * width;
                p.size = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
                p.ci = Math.floor(Math.random() * colors.length);
            }
            p.spin += p.vs * delta;

            // Rơi nhanh dần + dòng chụm lại về phía miệng nhận
            const e = p.t * p.t * 0.45 + p.t * 0.55;
            const spread = 1 - 0.55 * p.t;
            const x = from.x + ux * len * e + px * p.off * spread;
            const y = from.y + uy * len * e + py * p.off * spread;

            const fade = Math.min(1, p.t / 0.12) * Math.min(1, (1 - p.t) / 0.1);
            const color = hot
                ? lerpColor(COLORS.sinterFire, colors[p.ci], Math.min(1, p.t * 1.6))
                : colors[p.ci];
            g.beginFill(color, 0.35 + 0.6 * fade);
            drawChunk(g, x, y, p.size, p.shape, p.spin);
            g.endFill();
        });

        // Mảnh vụn bật lên tại điểm va đập
        g.lineStyle(0);
        splash.forEach((s) => {
            if (s.life <= 0) return;
            s.life -= 0.045 * delta;
            s.x += s.vx * delta;
            s.y += s.vy * delta;
            s.vy += 0.06 * delta;                       // trọng lực kéo mảnh rơi lại
            if (s.life > 0) {
                g.beginFill(hot ? COLORS.sinterHot : COLORS.dustGray, 0.55 * s.life);
                drawChunk(g, s.x, s.y, s.size, s.shape, 0);
                g.endFill();
            }
        });
    });

    return <Graphics ref={gRef} />;
};
