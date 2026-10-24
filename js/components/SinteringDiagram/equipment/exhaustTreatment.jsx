/* =============================================================================
 * js/components/SinteringDiagram/equipment/exhaustTreatment.jsx — HỆ XỬ LÝ KHÍ THẢI
 * =============================================================================
 * ExhaustTreatment: 2 cụm lọc bụi + quạt song song, mỗi cụm nối một đầu ống
 * gió tổng.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/* =============================================================================
 * HỆ XỬ LÝ KHÍ THẢI — 2 CỤM SONG SONG, mỗi cụm nối vào 1 đầu ống gió tổng:
 *   (1) LỌC BỤI TĨNH ĐIỆN: buồng lọc + các bản cực song song, bụi bị hút bám
 *       vào bản cực (hạt thưa dần khi đi qua).
 *   (2) QUẠT GIÓ CHÍNH: quạt ly tâm vỏ xoắn ốc + cánh quay nhanh + motor lớn
 *       (đã bỏ ống khói/họng thổi để không thừa chi tiết nhô ra).
 * Kích thước lấy từ tham số -> dễ thu nhỏ cho vừa khung hình.
 * @param {object[]} trains [{ductFromX, ductY, espX, fanX}]
 * @param {number}   espW, espH, fanR
 * ===========================================================================*/
export const ExhaustTreatment = ({ trains, espW, espH, fanR }) => {
    const dustRef = useRef(null);
    const fanRef = useRef(null);
    const spin = useRef(0);

    const DUCT = 0xd5dbdb, DUCT_LINE = 0x7f8c8d;

    /* Bụi bị hút vào ESP rồi thưa dần (bám bản cực) — cho từng cụm. */
    const dust = useMemo(() => {
        const arr = [];
        trains.forEach((t, ti) => {
            for (let k = 0; k < 34; k++)
                arr.push({ ti, u: Math.random(), v: 0.006 + Math.random() * 0.006,
                           oy: (Math.random() - 0.5) * (espH - 22), r: 1 + Math.random() * 1.6 });
        });
        return arr;
    }, [trains, espH]);

    const drawStruct = useCallback((g) => {
        g.clear();
        const H = 16;

        trains.forEach((t) => {
            const { ductFromX, ductY, espX, fanX } = t;
            const ex = espX - espW / 2, ey = ductY - espH / 2;

            /* --- ống gió tổng NỐI DÀI tới ESP --- */
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.97);
            g.drawRoundedRect(ductFromX, ductY - H / 2, (ex + 4) - ductFromX, H, H / 2);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(DUCT_LINE, 0.8);
            for (let ax = ductFromX + 14; ax < ex - 10; ax += 34) {
                g.moveTo(ax, ductY - 5); g.lineTo(ax + 10, ductY); g.lineTo(ax, ductY + 5); g.closePath();
            }
            g.endFill();

            /* --- (1) LỌC BỤI TĨNH ĐIỆN --- */
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.steelLight, 0.98);                 // vỏ buồng lọc
            g.drawRoundedRect(ex, ey, espW, espH, 8);
            g.endFill();
            g.beginFill(COLORS.machineBody, 0.98);                // phễu thu bụi đáy
            g.drawRoundedRect(ex + 8, ductY + espH / 2 - 6, espW - 16, 12, 4);
            g.endFill();
            g.lineStyle(1.6, COLORS.siloBorder, 0.85);            // BẢN CỰC song song
            for (let i = 1; i <= 5; i++) {
                const px = ex + (espW * i) / 6;
                g.moveTo(px, ey + 11); g.lineTo(px, ductY + espH / 2 - 9);
            }
            g.lineStyle(0);                                        // ký hiệu tĩnh điện + / −
            g.beginFill(COLORS.statusBad, 0.9);
            g.drawRect(espX - 15, ey - 8, 10, 3); g.drawRect(espX - 11.5, ey - 11.5, 3, 10);
            g.endFill();
            g.beginFill(COLORS.siloBorder, 0.95);
            g.drawRect(espX + 5, ey - 8, 10, 3);
            g.endFill();

            /* --- ống nối ESP -> quạt --- */
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.97);
            g.drawRoundedRect(ex + espW - 4, ductY - H / 2, (fanX - fanR) - (ex + espW) + 8, H, H / 2);
            g.endFill();

            /* --- (2) QUẠT GIÓ CHÍNH (ly tâm, vỏ xoắn ốc) --- */
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 0.98);                // vỏ xoắn ốc
            g.drawCircle(fanX, ductY, fanR);
            g.endFill();
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelLight, 0.98);                 // đĩa buồng cánh
            g.drawCircle(fanX, ductY, fanR - 7);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.95);                // bệ máy
            g.drawRoundedRect(fanX - fanR - 4, ductY + fanR - 3, 2 * fanR + 8, 11, 3);
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.97);           // motor lớn
            g.drawRoundedRect(fanX - 15, ductY + fanR + 7, 30, 15, 4);
            g.endFill();
        });
    }, [trains, espW, espH, fanR]);

    useTick((delta) => {
        spin.current += 0.26 * delta;

        const dg = dustRef.current;
        if (dg) {
            dg.clear();
            dust.forEach((p) => {
                const t = trains[p.ti];
                if (!t) return;
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const ex0 = t.espX - espW / 2 + 5, ex1 = t.espX + espW / 2 - 5;
                const x = ex0 + (ex1 - ex0) * p.u;
                const fade = 1 - p.u;                              // bụi thưa dần khi qua bản cực
                if (Math.random() < 0.55) {
                    dg.beginFill(COLORS.machineDark, 0.26 + 0.55 * fade);
                    dg.drawCircle(x, t.ductY + p.oy * (0.4 + 0.6 * fade), p.r);
                    dg.endFill();
                }
            });
        }

        const fgc = fanRef.current;                                // cánh quạt chính quay
        if (fgc) {
            fgc.clear();
            fgc.lineStyle(0);
            trains.forEach((t, ti) => {
                const rr = fanR - 9;
                const sgn = ti % 2 === 0 ? 1 : -1;
                fgc.beginFill(COLORS.machineDark, 0.92);
                for (let k = 0; k < 9; k++) {
                    const a = spin.current * sgn + (k * Math.PI * 2) / 9;
                    fgc.moveTo(t.fanX, t.ductY);
                    fgc.lineTo(t.fanX + Math.cos(a) * rr, t.ductY + Math.sin(a) * rr);
                    fgc.lineTo(t.fanX + Math.cos(a + 0.42) * rr, t.ductY + Math.sin(a + 0.42) * rr);
                    fgc.closePath();
                }
                fgc.endFill();
                fgc.beginFill(COLORS.borderGray);
                fgc.drawCircle(t.fanX, t.ductY, 4.5);
                fgc.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={fanRef} />
            <Graphics ref={dustRef} />
        </Container>
    );
};
