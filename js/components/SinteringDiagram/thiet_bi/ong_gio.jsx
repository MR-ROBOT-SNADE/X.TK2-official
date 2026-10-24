/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/ong_gio.jsx — PHỄU ỐNG GIÓ + ỐNG GIÓ TỔNG
 * =============================================================================
 * WindBoxRow (dãy phễu ống gió dọc đường xe ghi), WindMainDuct (ống gió tổng,
 * bụi chạy theo chiều hút).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container, Text } from '@pixi/react';

import { COLORS } from './mau_sac.js';
import { SMALL_LABEL } from './nha_xuong.jsx';

/**
 * Dãy PHỄU ỐNG GIÓ (wind box) dọc một bên hông đường xe ghi — theo bản vẽ mặt
 * bằng: mỗi vị trí là ống cuống nối từ mép track ra một bầu tròn (khuỷu ống
 * gió) có mặt bích. Vẽ tĩnh, xếp cách đều trong đoạn [xStart, xEnd].
 * @param {number} y       Tâm Y của hàng bầu tròn.
 * @param {number} stemY   Mép track phía hàng này (điểm ống cuống nối vào).
 * @param {number} xStart, xEnd, count, radius
 * @param {string} label   Nhãn (chỉ truyền cho MỘT hàng để tránh lặp chữ).
 */
export const WindBoxRow = ({ y, stemY, xStart, xEnd, count, radius = 13, label, ductY }) => {
    const flowRef = useRef(null);

    /* Dòng KHÔNG KHÍ HÚT: mỗi phễu 3 vệt bụi mảnh chạy trong ống cuống từ tâm
       bầu về phía ỐNG GIÓ CHÍNH (hàng trên đi lên, hàng dưới đi xuống), đậm
       dần khi gần ống chính -- cùng phong cách vệt bụi trong ống tổng. */
    const suction = useMemo(() => {
        if (ductY === undefined) return [];
        const step = (xEnd - xStart) / (count - 1);
        const arr = [];
        for (let i = 0; i < count; i++) {
            for (let k = 0; k < 3; k++) {
                arr.push({
                    x: xStart + i * step + (Math.random() - 0.5) * 4,
                    t: Math.random(),
                    v: 0.013 + Math.random() * 0.012,
                    streak: 3 + Math.random() * 3.5,
                    color: k % 2 === 0 ? COLORS.dustGray : COLORS.dustLight,
                });
            }
        }
        return arr;
    }, [xStart, xEnd, count, ductY]);

    /* Bụi bị HÚT XOÁY vào tâm mỗi bầu phễu: men theo vòng, bán kính co dần về
       tâm rồi tái sinh ở rìa — cùng ngôn ngữ với bụi trong ống gió chính. */
    const swirl = useMemo(() => {
        const step = (xEnd - xStart) / (count - 1);
        const arr = [];
        for (let i = 0; i < count; i++) {
            for (let k = 0; k < 2; k++) {
                arr.push({
                    cx: xStart + i * step,
                    a: Math.random() * Math.PI * 2,
                    r: 0.35 + Math.random() * 0.6,
                    va: 0.055 + Math.random() * 0.05,
                    vr: 0.004 + Math.random() * 0.004,
                });
            }
        }
        return arr;
    }, [xStart, xEnd, count]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g || suction.length === 0) return;
        g.clear();

        // Bụi xoáy hút vào tâm bầu phễu
        swirl.forEach((w) => {
            w.a += w.va * delta;
            w.r -= w.vr * delta;
            if (w.r < 0.18) { w.r = 0.95; w.a = Math.random() * Math.PI * 2; }
            g.lineStyle(0);
            g.beginFill(COLORS.dustLight, 0.15 + 0.35 * (1 - w.r));
            g.drawCircle(w.cx + Math.cos(w.a) * radius * w.r, y + Math.sin(w.a) * radius * w.r, 1.5);
            g.endFill();
        });

        const dir = Math.sign(ductY - y);                  // hàng trên: -1 (lên), hàng dưới: +1 (xuống)
        suction.forEach((p) => {
            p.t += p.v * delta;
            if (p.t > 1) p.t = 0;
            const py = y + (ductY - y) * p.t;
            g.lineStyle(1.2, p.color, 0.2 + 0.2 * p.t);    // đậm dần khi gần ống chính
            g.moveTo(p.x, py - dir * p.streak);
            g.lineTo(p.x, py);
        });
    });

    const draw = useCallback((g) => {
        g.clear();
        const step = (xEnd - xStart) / (count - 1);
        for (let i = 0; i < count; i++) {
            const x = xStart + i * step;
            // Ống cuống nối từ mép track ra bầu
            g.lineStyle(0);
            g.beginFill(COLORS.ductBody);
            const top = Math.min(y, stemY);
            g.drawRect(x - 4, top, 8, Math.abs(stemY - y));
            g.endFill();
            // Ống cuống thứ 2: nối từ bầu ra ỐNG GIÓ TỔNG (nếu có)
            if (ductY !== undefined) {
                const dTop = Math.min(y, ductY);
                g.beginFill(COLORS.ductBody);
                g.drawRect(x - 3, dTop, 6, Math.abs(ductY - y));
                g.endFill();
                g.lineStyle(1.5, COLORS.drumOutline, 0.8);
                g.drawRect(x - 3, dTop, 6, Math.abs(ductY - y));
                g.lineStyle(0);
            }
            g.lineStyle(1.5, COLORS.drumOutline, 0.8);
            g.drawRect(x - 4, top, 8, Math.abs(stemY - y));
            // Bầu tròn 2 lớp (khuỷu ống gió)
            g.lineStyle(2, COLORS.drumOutline);
            g.beginFill(COLORS.ductBody);
            g.drawCircle(x, y, radius);
            g.endFill();
            g.beginFill(COLORS.drumShell);
            g.drawCircle(x, y, radius * 0.45);
            g.endFill();
            // 2 tai mặt bích
            g.lineStyle(0);
            g.beginFill(COLORS.drumOutline, 0.85);
            g.drawRect(x - radius - 4, y - 2.5, 5, 5);
            g.drawRect(x + radius - 1, y - 2.5, 5, 5);
            g.endFill();
        }
    }, [y, stemY, xStart, xEnd, count, radius, ductY]);

    return (
        <Container>
            <Graphics draw={draw} />
            <Graphics ref={flowRef} />
            {label && (
                <Text text={label} x={xEnd + 18} y={y - 7} style={SMALL_LABEL} />
            )}
        </Container>
    );
};



/**
 * ỐNG GIÓ TỔNG chạy dọc phía ngoài dãy phễu ống gió, kèm hiệu ứng HÚT GIÓ + BỤI:
 * các vệt bụi mảnh chảy liên tục TỪ TRÁI SANG PHẢI bên trong ống (chiều hút),
 * cùng các mũi tên chỉ hướng gió cố định trên thân ống.
 * @param {object} duct {y, xStart, xEnd, height}
 */
export const WindMainDuct = ({ y, xStart, xEnd, height = 16, dustCount = 55 }) => {
    const gRef = useRef(null);
    const len = xEnd - xStart;

    /* Vệt bụi: vị trí + vận tốc + độ dài vệt + màu, tái sinh bên trái khi ra khỏi ống */
    const dust = useMemo(() => Array.from({ length: dustCount }, () => ({
        px: Math.random() * len,
        py: 3 - height / 2 + Math.random() * (height - 6),
        vx: 1.1 + Math.random() * 1.9,
        streak: 4 + Math.random() * 7,
        color: [COLORS.dustGray, COLORS.borderGray, COLORS.mixedOre][Math.floor(Math.random() * 3)],
    })), [len, height, dustCount]);

    const drawDuct = useCallback((g) => {
        g.clear();
        // Thân ống tổng
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.ductBody, 0.92);
        g.drawRoundedRect(xStart, y - height / 2, len, height, height / 2);
        g.endFill();
        // Mặt bích định kỳ
        g.lineStyle(1.5, COLORS.drumOutline, 0.7);
        for (let fx = xStart + 130; fx < xEnd - 20; fx += 150) {
            g.moveTo(fx, y - height / 2 - 2);
            g.lineTo(fx, y + height / 2 + 2);
        }
        // Mũi tên chỉ HƯỚNG GIÓ (trái -> phải) trên thân ống
        g.lineStyle(0);
        g.beginFill(COLORS.drumOutline, 0.55);
        for (let ax = xStart + 90; ax < xEnd - 40; ax += 280) {
            g.moveTo(ax, y - 4);
            g.lineTo(ax + 9, y);
            g.lineTo(ax, y + 4);
            g.closePath();
        }
        g.endFill();
    }, [y, xStart, xEnd, height, len]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        dust.forEach((d) => {
            d.px += d.vx * delta;
            if (d.px > len - 4) { d.px = 4; d.py = 3 - height / 2 + Math.random() * (height - 6); }
            g.lineStyle(1.3, d.color, 0.4);
            g.moveTo(xStart + d.px - d.streak, y + d.py);
            g.lineTo(xStart + d.px, y + d.py);
        });
    });

    return (
        <Container>
            <Graphics draw={drawDuct} />
            <Graphics ref={gRef} />
        </Container>
    );
};
