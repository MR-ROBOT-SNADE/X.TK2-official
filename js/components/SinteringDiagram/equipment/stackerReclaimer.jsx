/* =============================================================================
 * js/components/SinteringDiagram/equipment/stackerReclaimer.jsx — MÁY ĐÁNH ĐỐNG - RÚT LIỆU
 * =============================================================================
 * StackerReclaimer: cần quật qua lại quanh trụ, rót quặng xuống bãi.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';
import { BLACK_SINTER_COLORS } from './shuttleDistributor.jsx';

/* =============================================================================
 * MÁY ĐÁNH ĐỐNG - RÚT LIỆU (có hoạt ảnh)
 * Cần quật qua quật lại quanh trụ trên băng gallery, đầu cần rót quặng xuống
 * đống. Toàn bộ thân cần được VẼ ĐÚNG MỘT LẦN ở tư thế nằm ngang (chĩa theo
 * +x); mỗi khung hình chỉ đổi `rotation` của Container -> KHÔNG dựng lại hình
 * học, gần như không tốn gì. Chỉ nhúm quặng rót ở đầu cần mới vẽ lại mỗi khung,
 * mà cũng chỉ 14 hạt.
 * ===========================================================================*/
export const StackerReclaimer = ({
    cx, cy, r, deg = 0, sweep = 55, speed = 1, phase = 0,
}) => {
    const boomRef = useRef(null);
    const oreRef = useRef(null);
    const t = useRef(phase);

    /* Thân cần: vẽ ở tư thế chĩa theo +x, trụ quay ở gốc toạ độ. */
    const drawBoom = useCallback((g) => {
        const tail = -r * 0.34;
        g.clear();
        g.lineStyle(9, COLORS.machineDark, 1);              // dầm cần
        g.moveTo(tail, 0); g.lineTo(r, 0);
        g.lineStyle(5, COLORS.ductBody, 1);
        g.moveTo(tail, 0); g.lineTo(r, 0);
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.machineDark, 0.9);               // đối trọng ở đuôi
        g.drawRect(tail - 13, -9, 26, 18);
        g.endFill();
        g.beginFill(COLORS.industrialOrange, 0.95);         // gàu rót ở đầu cần
        g.drawCircle(r, 0, 11);
        g.endFill();
        g.beginFill(COLORS.dustLight, 0.98);                // trụ quay
        g.drawCircle(0, 0, 15);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.8);
        g.drawCircle(0, 0, 5);
        g.endFill();
    }, [r]);

    /* Nhúm quặng đang rót khỏi gàu — toạ độ cục bộ so với đầu cần. */
    const ore = useMemo(() => Array.from({ length: 14 }, () => ({
        t: Math.random(),
        vx: (Math.random() - 0.5) * 0.5,
        sp: 0.020 + Math.random() * 0.030,
        sz: 1.6 + Math.random() * 2.6,
        c: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), []);

    useTick((delta) => {
        t.current += 0.011 * speed * delta;
        const ang = deg + Math.sin(t.current) * sweep;      // quật qua quật lại
        if (boomRef.current) boomRef.current.rotation = (ang * Math.PI) / 180;

        const g = oreRef.current;
        if (!g) return;
        g.clear();
        g.lineStyle(0);
        ore.forEach((o) => {
            o.t += o.sp * delta;
            if (o.t > 1) o.t -= 1;
            const d = o.t * 26;                             // rơi khỏi gàu ~26 đơn vị
            g.beginFill(o.c, 0.92 - o.t * 0.35);
            g.drawRect(r + o.vx * d - o.sz, d - o.sz, o.sz * 2, o.sz * 2);
            g.endFill();
        });
    });

    return (
        <Container x={cx} y={cy}>
            <Container ref={boomRef}>
                <Graphics draw={drawBoom} />
                <Graphics ref={oreRef} />
            </Container>
        </Container>
    );
};
