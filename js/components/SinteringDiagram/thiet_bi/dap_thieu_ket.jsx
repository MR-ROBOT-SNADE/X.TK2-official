/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/dap_thieu_ket.jsx — NGHIỀN TRỤC ĐƠN + LIỆU BỊ ĐÁNH BỂ
 * =============================================================================
 * SingleRollCrusher (trụ nghiền ở cuối đường xe ghi), SinterCrusher (tảng
 * quặng thiêu kết bị đánh bể thành mảnh khi qua trụ).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useMemo, useRef } from 'react';
import { Graphics, useTick } from '@pixi/react';

import { COLORS } from './mau_sac.js';
import { drawChunk, makeChunkShape } from './cuc_quang.js';
import { drawSpinningCylinder } from './nha_xuong.jsx';

/**
 * NGHIỀN TRỤC ĐƠN (single roll crusher) — đặt ở cuối đường xe ghi, đánh vỡ
 * bánh quặng thiêu kết nóng. Dạng trụ đứng dài như bố liệu nhưng có các
 * BÁNH RĂNG NGHIỀN CỠ TO: răng tam giác nhô ra 2 mép thân + các hàng răng
 * mặt trước chạy ngang theo chiều quay. Quay NGƯỢC chiều với bố liệu.
 * @param {object} cfg {x, y, radius, height}
 */
export const SingleRollCrusher = ({ x, y, radius, height }) => {
    const gRef = useRef(null);
    const phase = useRef(0);

    useTick((delta) => {
        phase.current += 0.05 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // Thân trụ quay NGƯỢC chiều bố liệu (phase âm)
        drawSpinningCylinder(g, x, y, radius, height, -phase.current, COLORS.drumShell, 6);

        const half = height / 2;

        // Răng nghiền TO nhô ra 2 mép thân (silhouette răng luôn nhìn thấy)
        g.lineStyle(1.5, COLORS.drumOutline);
        g.beginFill(0x808b96);
        const toothH = 13, toothW = 7;
        for (let ty = y - half + 10; ty <= y + half - 10; ty += toothH + 6) {
            // Mép trái
            g.moveTo(x - radius, ty);
            g.lineTo(x - radius - toothW, ty + toothH / 2);
            g.lineTo(x - radius, ty + toothH);
            g.closePath();
            // Mép phải (so le nửa bước)
            const ty2 = ty + (toothH + 6) / 2;
            if (ty2 + toothH <= y + half - 6) {
                g.moveTo(x + radius, ty2);
                g.lineTo(x + radius + toothW, ty2 + toothH / 2);
                g.lineTo(x + radius, ty2 + toothH);
                g.closePath();
            }
        }
        g.endFill();

        // Các hàng răng MẶT TRƯỚC chạy ngang theo chiều quay (ngược bố liệu)
        g.lineStyle(0);
        g.beginFill(0x566573, 0.9);
        const seams = 6;
        for (let i = 0; i < seams; i++) {
            const a = -phase.current + (i * Math.PI * 2) / seams;
            if (Math.cos(a) <= 0.15) continue;
            const sx = x + radius * Math.sin(a);
            for (let ty = y - half + 14; ty <= y + half - 14; ty += 18) {
                g.drawRect(sx - 2.5, ty - 4, 5, 8);   // mấu răng vuông to trên mặt trụ
            }
        }
        g.endFill();
    });

    return <Graphics ref={gRef} />;
};


/**
 * LIỆU TẠI TRỤ NGHIỀN (trục do SingleRollCrusher vẽ): tảng quặng đen to trôi
 * từ phía toa về, phủ trên trục, qua trục thì bị ĐÁNH BỂ thành mảnh nhỏ văng
 * sang trái trong phạm vi HẸP rồi mờ nhanh.
 * @param {object} roll {x, yTop, height} — x tâm trụ, dải y thân trụ.
 */
export const SinterCrusher = ({ roll }) => {
    const gRef = useRef(null);
    const SINTER_COLORS = [COLORS.sinterOre, 0x17202a, 0x212f3d, 0x0e1418];   // quặng thiêu kết ĐEN
    const OVERRUN = 40;                                               // đoạn mờ dần dưới chân trụ

    /* --- Dòng NGANG: tảng chia "làn" y phủ đều, trôi qua trục rồi bể --- */
    const horiz = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
        bx: -6 + Math.random() * 44,
        lane: roll.yTop + 12 + (i / 13) * (roll.height - 24),
        jitter: (Math.random() - 0.5) * 8,
        size: 9 + Math.random() * 6,
        vx: 0.35 + Math.random() * 0.45,
        color: SINTER_COLORS[Math.floor(Math.random() * 4)],
        shape: makeChunkShape(7),
        spin: Math.random() * Math.PI,
    })), [roll.yTop, roll.height]);
    const frags = useMemo(() => Array.from({ length: 30 }, () => ({ life: 0, shape: makeChunkShape(6), spin: 0 })), []);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // Dòng ngang + đánh bể
        horiz.forEach((b) => {
            b.bx -= b.vx * delta;
            const by = b.lane + b.jitter;
            if (b.bx <= -12) {
                let spawned = 0;
                for (const f of frags) {
                    if (f.life <= 0 && spawned < 4) {
                        f.fx = roll.x - 14;
                        f.fy = by + (Math.random() - 0.5) * 8;
                        f.vx = -(0.5 + Math.random() * 0.5);
                        f.vy = (Math.random() - 0.5) * 0.5;
                        f.size = 3 + Math.random() * 2.6;
                        f.color = b.color;
                        f.shape = makeChunkShape(6);
                        f.spin = Math.random() * Math.PI;
                        f.life = 1;
                        spawned++;
                    }
                }
                b.bx = 28 + Math.random() * 20;
                b.jitter = (Math.random() - 0.5) * 8;
                b.size = 9 + Math.random() * 6;
                b.color = SINTER_COLORS[Math.floor(Math.random() * 4)];
                b.shape = makeChunkShape(7);
            }
            b.spin += 0.012 * delta;                       // cục quặng lăn chậm khi bị cuốn
            g.lineStyle(1.5, 0x000000, 0.65);
            g.beginFill(b.color);
            drawChunk(g, roll.x + b.bx, by, b.size, b.shape, b.spin);
            g.endFill();
        });
        frags.forEach((f) => {
            if (f.life <= 0) return;
            f.fx += f.vx * delta;
            f.fy += f.vy * delta;
            f.life = Math.max(0, 1 - (roll.x - 14 - f.fx) / 32);
            if (f.life > 0) {
                f.spin += 0.06 * delta;                    // mảnh vỡ xoay nhanh khi văng
                g.lineStyle(0);
                g.beginFill(f.color, 0.25 + 0.7 * f.life);
                drawChunk(g, f.fx, f.fy, f.size, f.shape, f.spin);
                g.endFill();
            }
        });

    });

    return <Graphics ref={gRef} />;
};
