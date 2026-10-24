/* =============================================================================
 * js/components/SinteringDiagram/equipment/coalCrushing.jsx — NHÀ NGHIỀN THAN
 * =============================================================================
 * CoalCrushingPlant: hệ nghiền than 2 cấp.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/* =============================================================================
 * NHÀ NGHIỀN THAN — hệ nghiền 2 cấp:
 *   Cấp 1: 2 MÁY NGHIỀN 2 TRỤC dạng rulo (đặt trên) đập thô than cục.
 *   Cấp 2: liệu đổ xuống 2 MÁY NGHIỀN 4 TRỤC nghiền mịn.
 *   Than sau nghiền rơi xuống BĂNG THAN (chạy ngay dưới hàng silo dưới) -> 3 ỐNG
 *   TẢI ĐỨNG tại cột silo 17/16/15 đưa than lên, nhả vào cả 2 hàng silo.
 * @param {object[]} twinRolls  tâm 2 máy nghiền 2 trục
 * @param {object[]} quadRolls  tâm 2 máy nghiền 4 trục
 * @param {object}   twinBox/quadBox  {w,h} vỏ máy
 * @param {object}   belt  {y,h,x0,x1} băng than chạy ngay DƯỚI hàng silo dưới,
 *                         đưa than về dãy silo
 * @param {number[]} risers  toạ độ x 3 ống tải đứng (silo 17/16/15)
 * @param {number}   riserW, riserTopY  bề rộng ống + cao độ đỉnh (hết hàng silo trên)
 * @param {number[]} dropYs  cao độ 2 cửa nhả liệu (đáy hàng silo dưới / trên)
 * ===========================================================================*/
export const CoalCrushingPlant = ({
    twinRolls, quadRolls, twinBox, quadBox, belt, risers, riserW, riserTopY, dropYs,
}) => {
    const flowRef = useRef(null);
    const rollRef = useRef(null);
    const phase = useRef(0);

    const COAL_DARK = 0x1c2833, COAL_MID = 0x4d5656;
    const bTop = belt.y - belt.h / 2;
    const bBot = belt.y + belt.h / 2;

    /* Hạt than chạy DÀY trên băng: từ nhà nghiền (phải) về dãy silo (trái). */
    const grains = useMemo(() => Array.from({ length: 230 }, () => ({
        u: Math.random(), v: 0.0016 + Math.random() * 0.0015,
        off: (Math.random() - 0.5) * (belt.h - 6), r: 1.6 + Math.random() * 2.6,
    })), [belt.h]);

    /* Hạt rơi trong ống: nghiền 2 trục -> nghiền 4 trục -> băng tải. */
    const drops = useMemo(() => {
        const arr = [];
        twinRolls.forEach((m, i) => {
            const q = quadRolls[i];
            for (let k = 0; k < 6; k++)
                arr.push({ x: m.x, y0: m.y + twinBox.h / 2, y1: q.y - quadBox.h / 2,
                           t: Math.random(), v: 0.026 + Math.random() * 0.02 });
        });
        quadRolls.forEach((m) => {
            for (let k = 0; k < 6; k++)
                arr.push({ x: m.x, y0: m.y + quadBox.h / 2, y1: bTop,
                           t: Math.random(), v: 0.026 + Math.random() * 0.02 });
        });
        return arr;
    }, [twinRolls, quadRolls, twinBox.h, quadBox.h, bTop]);

    /* Than đi LÊN trong 3 ống tải đứng (băng -> hết hàng silo trên). */
    const ups = useMemo(() => {
        const arr = [];
        risers.forEach((x) => {
            for (let k = 0; k < 7; k++)
                arr.push({ x, t: Math.random(), v: 0.013 + Math.random() * 0.011 });
        });
        return arr;
    }, [risers]);

    const drawStruct = useCallback((g) => {
        g.clear();

        /* ---------- BĂNG THAN chạy NGAY DƯỚI hàng silo dưới ---------- */
        g.lineStyle(2, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineBody, 0.98);                       // khung đỡ băng
        g.drawRoundedRect(belt.x0 - 5, bTop - 5, (belt.x1 - belt.x0) + 10, belt.h + 10, 4);
        g.endFill();
        g.beginFill(COLORS.industrialOrange, 0.99);                  // mặt băng (màu cam)
        g.drawRect(belt.x0, bTop, belt.x1 - belt.x0, belt.h);
        g.endFill();
        g.lineStyle(1.1, COLORS.machineDark, 0.35);                  // con lăn đỡ
        for (let x = belt.x0 + 20; x < belt.x1; x += 34) { g.moveTo(x, bTop); g.lineTo(x, bBot); }
        g.lineStyle(0);                                              // chiều chạy: sang TRÁI
        g.beginFill(COLORS.white, 0.9);
        for (let x = belt.x1 - 90; x > belt.x0 + 50; x -= 160) {
            g.moveTo(x, belt.y - 5); g.lineTo(x - 13, belt.y); g.lineTo(x, belt.y + 5); g.closePath();
        }
        g.endFill();
        g.lineStyle(2, COLORS.machineDark);                          // 2 tang dẫn động 2 đầu băng
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(belt.x0 - 11, bTop - 4, 12, belt.h + 8, 4);
        g.drawRoundedRect(belt.x1 - 1, bTop - 4, 12, belt.h + 8, 4);
        g.endFill();

        /* ---------- 3 ỐNG TẢI ĐỨNG tại cột silo 17/16/15 ----------
           Đi thẳng từ băng LÊN hết hàng silo trên; có cửa nhả vào cả 2 hàng silo. */
        risers.forEach((x) => {
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.97);
            g.drawRoundedRect(x - riserW / 2, riserTopY, riserW, bTop - riserTopY, 4);   // thân ống đứng
            g.endFill();
            g.lineStyle(0);                                                              // mũi tên than ĐI LÊN
            g.beginFill(COLORS.statusWarn, 0.9);
            for (let ly = bTop - 16; ly > riserTopY + 12; ly -= 34) {
                g.moveTo(x - 5, ly); g.lineTo(x + 5, ly); g.lineTo(x, ly - 11); g.closePath();
            }
            g.endFill();
            // 2 CỬA NHẢ liệu vào đáy mỗi hàng silo
            dropYs.forEach((dy) => {
                g.lineStyle(2, COLORS.machineDark);
                g.beginFill(COLORS.ductBody, 0.97);
                g.moveTo(x - riserW / 2, dy + 12);
                g.lineTo(x + riserW / 2, dy + 12);
                g.lineTo(x + 16, dy - 2);
                g.lineTo(x - 16, dy - 2);
                g.closePath();
                g.endFill();
                g.lineStyle(0);
                g.beginFill(COLORS.statusWarn, 0.95);
                g.moveTo(x - 5, dy + 10); g.lineTo(x + 5, dy + 10); g.lineTo(x, dy); g.closePath();
                g.endFill();
            });
        });

        /* ---------- ỐNG ĐỔ LIỆU: nghiền 2 trục -> nghiền 4 trục -> băng ---------- */
        const chute = (cx, y0, y1) => {
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.97);
            g.drawRect(cx - 9, y0 - 2, 18, (y1 - y0) + 4);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.55);
            g.moveTo(cx - 5, y1 - 13); g.lineTo(cx + 5, y1 - 13); g.lineTo(cx, y1 - 3); g.closePath();
            g.endFill();
        };
        twinRolls.forEach((m, i) => chute(m.x, m.y + twinBox.h / 2, quadRolls[i].y - quadBox.h / 2));
        quadRolls.forEach((m) => chute(m.x, m.y + quadBox.h / 2, bTop));

        /* ---------- VỎ MÁY + RULO NGHIỀN ---------- */
        const machine = (cx, cy, w, h, nRolls) => {
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 0.98);
            g.drawRoundedRect(cx - w / 2, cy - h / 2, w, h, 7);            // vỏ máy
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.97);                    // motor kéo
            g.drawRoundedRect(cx + w / 2 - 5, cy - 11, 17, 22, 4);
            g.endFill();
            g.beginFill(COLORS.machineBody, 0.98);                         // phễu nạp trên nóc
            g.drawRoundedRect(cx - 16, cy - h / 2 - 7, 32, 9, 3);
            g.endFill();
            const rl = w - 28, th = nRolls === 2 ? 15 : 11, gap = h / (nRolls + 1);
            for (let i = 0; i < nRolls; i++) {
                const ry = cy - h / 2 + gap * (i + 1);
                g.lineStyle(1.6, COLORS.drumOutline);
                g.beginFill(COLORS.drumShell, 0.99);                       // rulo nằm ngang
                g.drawRoundedRect(cx - rl / 2, ry - th / 2, rl, th, th / 2);
                g.endFill();
                g.lineStyle(0);
                g.beginFill(COLORS.machineBody);                           // cổ trục 2 đầu
                g.drawCircle(cx - rl / 2 - 4, ry, 3.4);
                g.drawCircle(cx + rl / 2 + 4, ry, 3.4);
                g.endFill();
            }
        };
        twinRolls.forEach((m) => machine(m.x, m.y, twinBox.w, twinBox.h, 2));
        quadRolls.forEach((m) => machine(m.x, m.y, quadBox.w, quadBox.h, 4));
    }, [twinRolls, quadRolls, twinBox, quadBox, belt, risers, riserW, riserTopY, dropYs, bTop, bBot]);

    useTick((delta) => {
        phase.current += 0.06 * delta;

        const fg = flowRef.current;
        if (fg) {
            fg.clear();
            grains.forEach((p) => {                                        // than trên băng -> chạy sang TRÁI
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const x = belt.x1 - (belt.x1 - belt.x0) * p.u;
                fg.beginFill(p.r > 2.7 ? COAL_DARK : COAL_MID, 0.96);
                fg.drawCircle(x, belt.y + p.off, p.r);
                fg.endFill();
            });
            drops.forEach((p) => {                                         // rơi trong ống đổ liệu
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(COAL_DARK, 0.9);
                fg.drawCircle(p.x + ((p.t * 11) % 5) - 2.5, p.y0 + (p.y1 - p.y0) * p.t, 2.2);
                fg.endFill();
            });
            ups.forEach((p) => {                                           // than ĐI LÊN trong ống tải đứng
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(COAL_DARK, 0.92);
                fg.drawCircle(p.x + ((p.t * 11) % 5) - 2.5, bTop - (bTop - riserTopY) * p.t, 2.1);
                fg.endFill();
            });
        }

        const rg = rollRef.current;                                        // răng rulo chạy theo chiều quay
        if (rg) {
            rg.clear();
            const flutes = (cx, cy, w, h, nRolls) => {
                const rl = w - 28, gap = h / (nRolls + 1), half = nRolls === 2 ? 6 : 4;
                for (let i = 0; i < nRolls; i++) {
                    const ry = cy - h / 2 + gap * (i + 1);
                    const dir = i % 2 === 0 ? 1 : -1;
                    rg.lineStyle(1.6, COLORS.machineDark, 0.7);
                    for (let k = 0; k < 7; k++) {
                        const raw = k * (rl / 7) + dir * phase.current * 9;
                        const fx = cx - rl / 2 + (((raw % rl) + rl) % rl);
                        rg.moveTo(fx, ry - half);
                        rg.lineTo(fx, ry + half);
                    }
                }
            };
            twinRolls.forEach((m) => flutes(m.x, m.y, twinBox.w, twinBox.h, 2));
            quadRolls.forEach((m) => flutes(m.x, m.y, quadBox.w, quadBox.h, 4));
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={rollRef} />
            <Graphics ref={flowRef} />
        </Container>
    );
};
