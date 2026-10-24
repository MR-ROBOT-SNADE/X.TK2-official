/* =============================================================================
 * js/components/SinteringDiagram/equipment/ironRemoval.jsx — TRẠM KHỬ SẮT
 * =============================================================================
 * IronRemovalStation: tuyển từ ở cuối băng xả quặng từ máy làm mát.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/* =============================================================================
 * TRẠM KHỬ SẮT (magnetic separator) — đặt ở cuối băng xả quặng từ máy làm mát
 * vòng. Nhìn từ trên xuống: nhà trạm bao ngoài, băng quặng chạy XUYÊN QUA giữa
 * trạm, phía trên băng treo NAM CHÂM ĐIỆN hút mạt sắt; sắt bị hút lên mặt nam
 * châm rồi gạt sang MÁNG XẢ SẮT bên cạnh và rơi vào THÙNG CHỨA.
 * @param {object} frame  {x, y, width, height} khung nhà trạm
 * @param {number} beltX  toạ độ x của băng quặng chạy xuyên qua trạm
 * @param {number} beltW  bề rộng băng
 * ===========================================================================*/
export const IronRemovalStation = ({ frame, beltX, beltW = 26 }) => {
    const flowRef = useRef(null);
    const coilRef = useRef(null);
    const phase = useRef(0);

    const { x, y, width: w, height: h } = frame;
    const magX0 = beltX - 36, magX1 = beltX + 30;          // nam châm điện trùm lên băng
    const magY0 = y + 16, magY1 = y + h - 16;
    const binX = x + 12, binW = 34;                        // thùng chứa mạt sắt (bên trái)
    const chuteY = (magY0 + magY1) / 2;

    /* Quặng chạy XUỐNG trên băng xuyên qua trạm. */
    const ore = useMemo(() => Array.from({ length: 34 }, () => ({
        t: Math.random(), v: 0.010 + Math.random() * 0.009,
        off: (Math.random() - 0.5) * (beltW - 9), r: 1.5 + Math.random() * 2.2,
    })), [beltW]);

    /* Mạt sắt: bị hút LÊN mặt nam châm -> trượt sang trái -> rơi vào thùng. */
    const iron = useMemo(() => Array.from({ length: 16 }, () => ({
        t: Math.random(), v: 0.009 + Math.random() * 0.008,
        off: (Math.random() - 0.5) * (beltW - 12), r: 1.4 + Math.random() * 1.5,
    })), [beltW]);

    const drawStruct = useCallback((g) => {
        g.clear();

        /* --- bóng đổ + nền nhà trạm --- */
        g.lineStyle(0);
        g.beginFill(COLORS.ink, 0.13);
        g.drawRoundedRect(x + 6, y + 7, w, h, 10);
        g.endFill();
        g.lineStyle(2.5, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.surfaceLight, 0.99);
        g.drawRoundedRect(x, y, w, h, 10);
        g.endFill();
        g.lineStyle(1.2, COLORS.borderGray, 0.55);           // gờ mép sàn
        g.drawRoundedRect(x + 5, y + 5, w - 10, h - 10, 7);

        /* --- BĂNG QUẶNG chạy xuyên qua trạm --- */
        g.lineStyle(2, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.dustLight, 0.98);
        g.drawRect(beltX - beltW / 2, y - 2, beltW, h + 4);
        g.endFill();
        g.lineStyle(1, COLORS.borderGray, 0.55);             // con lăn băng
        for (let ry = y + 8; ry < y + h - 4; ry += 12) {
            g.moveTo(beltX - beltW / 2, ry); g.lineTo(beltX + beltW / 2, ry);
        }

        /* --- MÁNG XẢ SẮT: từ nam châm gạt sang trái --- */
        g.lineStyle(2, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.ductBody, 0.98);
        g.drawRoundedRect(binX + binW - 4, chuteY - 8, (magX0 + 6) - (binX + binW - 4), 16, 5);
        g.endFill();

        /* --- THÙNG CHỨA MẠT SẮT --- */
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(binX, chuteY - 17, binW, 34, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.dustGray, 0.9);                   // mạt sắt đã thu
        g.drawRoundedRect(binX + 5, chuteY - 6, binW - 10, 18, 3);
        g.endFill();

        /* --- NAM CHÂM ĐIỆN treo trên băng --- */
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 0.98);               // vỏ nam châm
        g.drawRoundedRect(magX0, magY0, magX1 - magX0, magY1 - magY0, 7);
        g.endFill();
        g.beginFill(COLORS.steelLight, 0.97);                // mặt cực
        g.drawRoundedRect(magX0 + 6, magY0 + 6, (magX1 - magX0) - 12, (magY1 - magY0) - 12, 5);
        g.endFill();
        g.lineStyle(0);                                       // cực + / −
        g.beginFill(COLORS.statusBad, 0.95);
        g.drawRect(magX0 + 12, magY0 + 12, 11, 3);
        g.drawRect(magX0 + 16, magY0 + 8, 3, 11);
        g.endFill();
        g.beginFill(COLORS.siloBorder, 0.95);
        g.drawRect(magX1 - 23, magY0 + 12, 11, 3);
        g.endFill();
    }, [x, y, w, h, beltX, beltW, magX0, magX1, magY0, magY1, binX, chuteY]);

    useTick((delta) => {
        phase.current += 0.09 * delta;

        const cg = coilRef.current;                           // cuộn dây nam châm chạy sáng
        if (cg) {
            cg.clear();
            const n = 5, span = (magY1 - magY0) - 16;
            for (let i = 0; i < n; i++) {
                const t = (i / n + (phase.current % 1)) % 1;
                cg.lineStyle(2, COLORS.coolAir, 0.35 + 0.5 * Math.sin(t * Math.PI));
                const cy2 = magY0 + 8 + span * t;
                cg.moveTo(magX0 + 9, cy2); cg.lineTo(magX1 - 9, cy2);
            }
        }

        const fg = flowRef.current;
        if (fg) {
            fg.clear();
            ore.forEach((p) => {                              // quặng chạy XUỐNG qua trạm
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                fg.beginFill(p.r > 2.6 ? 0x1c2833 : 0x4d5656, 0.95);
                fg.drawCircle(beltX + p.off, (y - 2) + (h + 4) * p.t, p.r);
                fg.endFill();
            });
            iron.forEach((p) => {                             // mạt sắt: hút lên -> sang thùng
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const yEnter = y + h, yPick = y + h - h * 0.55;
                let px2, py2, al;
                if (p.t < 0.45) {                             // còn trên băng, tiến vào vùng nam châm
                    px2 = beltX + p.off;
                    py2 = yEnter + (yPick - yEnter) * (p.t / 0.45);
                    al = 0.9;
                } else if (p.t < 0.62) {                      // bị HÚT lên mặt nam châm
                    const k = (p.t - 0.45) / 0.17;
                    px2 = beltX + p.off * (1 - k);
                    py2 = yPick + (chuteY - yPick) * k;
                    al = 0.9;
                } else {                                      // gạt sang trái, rơi vào thùng
                    const k = (p.t - 0.62) / 0.38;
                    px2 = beltX - (beltX - (binX + binW / 2)) * k;
                    py2 = chuteY;
                    al = 0.9 * (1 - k * 0.5);
                }
                fg.beginFill(COLORS.dustGray, al);
                fg.drawCircle(px2, py2, p.r);
                fg.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={coilRef} />
            <Graphics ref={flowRef} />
        </Container>
    );
};
