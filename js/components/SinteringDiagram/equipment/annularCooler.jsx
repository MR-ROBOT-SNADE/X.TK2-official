/* =============================================================================
 * js/components/SinteringDiagram/equipment/annularCooler.jsx — MÁY LÀM MÁT VÒNG
 * =============================================================================
 * AnnularCooler: vành làm mát đầy liệu quay, quạt thổi từ dưới lên.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, lerpColor } from './colors.js';
import { useRedrawGate } from './redrawGate.js';
import { drawChunk, makeChunkShape } from './oreChunks.js';
import { BLACK_SINTER_COLORS } from './shuttleDistributor.jsx';
import { drawFanAirflow, drawIndustrialFan } from './fans.js';

/**
 * MÁY LÀM MÁT VÒNG (annular cooler) — view từ trên xuống.
 * Lòng máng ĐẦY LIỆU: nền lớp liệu phủ kín trọn vành (trừ đúng cung cửa nạp/xả)
 * + hàng trăm cục quặng đen chạy vòng trên nền, tạo cảm giác máng chất đầy ắp.
 * Vành quay NGƯỢC CHIỀU KIM ĐỒNG HỒ: quặng nóng từ nghiền trục đơn nạp vào (còn
 * đỏ lửa), nguội dần suốt cung quay, rồi xả qua máng xả xuống băng tải xích.
 * Quanh vành là dãy QUẠT HƯỚNG TRỤC công nghiệp áp SÁT vỏ máy, trải đều trên
 * cung trống (né vùng nghiền trục đơn, cửa nạp và băng xả), liên tục hút gió
 * mát từ ngoài thổi xuyên lớp liệu.
 * @param {number} cx, cy, rOuter, rInner   Hình học vành.
 * @param {number} chunkCount, cellCount    Mật độ cục liệu / số khoang chia.
 * @param {number} fanCount, fanGap, fanRadius, fanBlades   Thông số dãy quạt.
 * @param {object} fanArc  {start, end} cung (độ) được phép đặt quạt.
 * @param {object} gate, gateHalfSpan, chute  Phễu nạp, cung vành bị cắt, máng xả —
 *                 xem chú thích ngay cạnh từng tham số bên dưới.
 * @param {number} hotArc  Cung (độ) sau cửa nạp mà liệu còn nóng đỏ.
 */
export const AnnularCooler = ({
    cx, cy, rOuter, rInner,
    chunkCount = 360, cellCount = 40,
    fanCount = 9, fanGap = 20, fanRadius = 16, fanBlades = 6,
    fanArc = { start: 56, end: 330 },
    gate = null,              // { x1 } mép ngoài PHỄU NẠP (giáp nghiền trục đơn);
                              //   miệng phễu tự ôm theo đúng cung vành bị cắt
    gateHalfSpan = 21.5,      // nửa góc (độ) vành bị cắt = nửa chiều dài phễu nạp
    chute = null,             // {x0,x1,y0,y1} MÁNG XẢ NẰM NGANG -> đầu băng tải xích
    hotArc = 55,              // cung (độ) ngay sau cửa nạp: liệu còn nóng đỏ
}) => {
    const canRedraw = useRedrawGate();          // giãn nhịp dựng lại hình học
    const chunksRef = useRef(null);
    const fansRef = useRef(null);
    const airRef = useRef(null);
    const rot = useRef(0);
    const fanPhase = useRef(0);
    const airPhase = useRef(0);
    const TAU = Math.PI * 2;

    const halfSpan = (gateHalfSpan * Math.PI) / 180;
    const hotSpan = (hotArc * Math.PI) / 180;

    /* Liệu thiêu kết: cục đen đa giác rải KÍN toàn bộ bề rộng máng (từ mép
       trong tới mép ngoài), quay cùng vành. Mỗi cục ghim sẵn chỉ số bảng màu
       (ci) để mỗi khung hình gom cục theo màu -> chỉ vài lệnh tô, giữ FPS. */
    const chunks = useMemo(() => {
        const band = Math.max(4, rOuter - rInner - 14);
        return Array.from({ length: chunkCount }, () => {
            const ci = Math.floor(Math.random() * BLACK_SINTER_COLORS.length);
            return {
                a: Math.random() * TAU,
                r: rInner + 7 + Math.random() * band,
                size: 4 + Math.random() * 4.4,
                shape: makeChunkShape(7),
                spin: Math.random() * Math.PI,
                ci,
                px: 0, py: 0, pa: 0,
            };
        });
    }, [chunkCount, rInner, rOuter]);

    /* Rổ gom cục theo màu (cấp phát 1 lần, mỗi khung chỉ reset độ dài) */
    const buckets = useMemo(() => BLACK_SINTER_COLORS.map(() => []), []);
    const hotBucket = useMemo(() => [], []);

    /* Vị trí dãy quạt: trải ĐỀU trên cung trống fanArc (né hẳn nghiền trục đơn,
       hộp cửa nạp/xả và tuyến băng xả) — không còn quạt nào bị che khuất. */
    const fans = useMemo(() => {
        const rFan = rOuter + fanGap;
        const span = fanArc.end - fanArc.start;
        return Array.from({ length: fanCount }, (_, i) => {
            const deg = fanArc.start + (fanCount > 1 ? (span * i) / (fanCount - 1) : span / 2);
            const a = (deg * Math.PI) / 180;
            const c = Math.cos(a), s = Math.sin(a);
            return { x: cx + c * rFan, y: cy + s * rFan, ux: -c, uy: -s };
        });
    }, [cx, cy, rOuter, fanGap, fanCount, fanArc.start, fanArc.end]);

    /* Vành cố định: 2 đường tròn + NỀN LỚP LIỆU phủ kín + nan chia khoang + trục */
    const drawShell = useCallback((g) => {
        g.clear();
        g.lineStyle(2.5, COLORS.drumOutline);
        g.beginFill(COLORS.steelLight, 0.45);
        g.drawCircle(cx, cy, rOuter);
        g.endFill();
        g.beginFill(COLORS.white, 1);
        g.drawCircle(cx, cy, rInner);
        g.endFill();

        /* Cung liệu: vẽ 1 dải khép kín giữa 2 bán kính, từ mép dưới cửa xả chạy
           hết vòng về mép trên cửa nạp -> máng lúc nào cũng ĐẦY LIỆU. */
        const band = (a0, a1, color, alpha) => {
            g.beginFill(color, alpha);
            g.moveTo(cx + Math.cos(a0) * rInner, cy + Math.sin(a0) * rInner);
            g.lineTo(cx + Math.cos(a0) * rOuter, cy + Math.sin(a0) * rOuter);
            g.arc(cx, cy, rOuter, a0, a1);
            g.lineTo(cx + Math.cos(a1) * rInner, cy + Math.sin(a1) * rInner);
            g.arc(cx, cy, rInner, a1, a0, true);
            g.closePath();
            g.endFill();
        };

        const loadStart = gate ? halfSpan : 0;                 // ngay sau cửa xả
        const loadEnd = gate ? TAU - halfSpan : TAU;           // tới sát cửa nạp
        g.lineStyle(0);
        band(loadStart, loadEnd, COLORS.oreBed, 1);

        /* Vùng liệu CÒN NÓNG ngay sau cửa nạp: 6 nấc đỏ nhạt dần theo chiều
           quay -> đọc được ngay quá trình nguội dần dọc cung máng. */
        const STEPS = 6;
        for (let s = 0; s < STEPS; s++) {
            const t0 = s / STEPS, t1 = (s + 1) / STEPS;
            band(loadEnd - t1 * hotSpan, loadEnd - t0 * hotSpan,
                s < 2 ? COLORS.sinterFire : COLORS.sinterHot, 0.5 * (1 - t0) ** 1.5);
        }

        /* LÒNG MÁNG ĐÃ XẢ TRỐNG: từ lưỡi gạt của máng xả chạy ngược lên tới phễu
           nạp. Liệu bị gạt khỏi máng dọc ĐÚNG thành dưới của máng xả, nên vệt
           cắt là một ĐƯỜNG NẰM NGANG (y = chute.y1) chứ không phải nan quạt —
           khớp với máng xả đặt vuông góc với băng tải xích. */
        if (chute) {
            const yc = chute.y1 - cy;
            const aOut = Math.asin(Math.max(-1, Math.min(1, yc / rOuter)));
            const aIn = Math.asin(Math.max(-1, Math.min(1, yc / rInner)));
            const emptyPath = () => {
                g.moveTo(cx + Math.cos(halfSpan) * rInner, cy + Math.sin(halfSpan) * rInner);
                g.lineTo(cx + Math.cos(halfSpan) * rOuter, cy + Math.sin(halfSpan) * rOuter);
                g.arc(cx, cy, rOuter, halfSpan, aOut);
                g.lineTo(cx + Math.cos(aIn) * rInner, cy + Math.sin(aIn) * rInner);
                g.arc(cx, cy, rInner, aIn, halfSpan, true);
                g.closePath();
            };
            // Tô lại đúng 2 lớp nền của vỏ máng -> xoá sạch lớp liệu ở khúc này
            g.beginFill(COLORS.white, 1); emptyPath(); g.endFill();
            g.beginFill(COLORS.steelLight, 0.45); emptyPath(); g.endFill();
        }

        /* Nan chia khoang vẽ ĐÈ lên nền liệu (vẫn thấy vách ngăn từng khoang) */
        g.lineStyle(1, COLORS.borderGray, 0.4);
        for (let i = 0; i < cellCount; i++) {
            const a = (i / cellCount) * TAU;
            g.moveTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
            g.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
        }
        // Nan chống + trục tâm
        g.lineStyle(2, COLORS.borderGray, 0.5);
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU;
            g.moveTo(cx, cy);
            g.lineTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
        }
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawCircle(cx, cy, 15);
        g.endFill();

        /* PHỄU NẠP: miệng phễu ÔM ĐÚNG cung vành bị cắt (±gateHalfSpan) — lưng
           phễu chạy theo cung mép trong, miệng loe theo cung mép ngoài, rồi nối
           thẳng sang thân nghiền trục đơn bằng một cổ phễu. Nhờ ăn khớp đúng
           cung cắt nên KHÔNG còn mẩu hộp thừa thò ra ngoài lòng máng. */
        if (gate) {
            const a0 = -halfSpan, a1 = halfSpan;
            const PI = (r, a) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
            const [ox0, oy0] = PI(rOuter, a0);
            const [ox1, oy1] = PI(rOuter, a1);
            const [ix0, iy0] = PI(rInner, a0);
            /* Cổ phễu cắm vào ĐÚNG mặt nhả liệu của nghiền trục đơn (yTop..yBot).
               Nhờ vậy 2 mép cổ không còn thò lên/thò xuống lệch so với thân trục
               nghiền — miệng phễu vẫn loe rộng theo cung vành, cổ thì thu về khít
               mặt máy nghiền. */
            const yTop = gate.yTop ?? oy0;
            const yBot = gate.yBot ?? oy1;
            const outline = () => {
                g.moveTo(gate.x1, yTop);          // mép cổ TRÊN, khít mặt nghiền
                g.lineTo(ox0, oy0);               // loe ra mép ngoài máng (trên)
                g.lineTo(ix0, iy0);               // vào mép trong máng (trên)
                g.arc(cx, cy, rInner, a0, a1);    // lưng phễu ôm mép trong máng
                g.lineTo(ox1, oy1);               // ra mép ngoài máng (dưới)
                g.lineTo(gate.x1, yBot);          // mép cổ DƯỚI, khít mặt nghiền
                g.closePath();
            };
            g.lineStyle(2.5, COLORS.drumOutline);
            g.beginFill(COLORS.steelLight, 0.95);
            outline();
            g.endFill();
            /* Lòng phễu ám đỏ: quặng vừa ra khỏi trục nghiền vẫn còn nóng */
            g.lineStyle(0);
            g.beginFill(COLORS.sinterFire, 0.26);
            outline();
            g.endFill();
            /* Các LÀN đổ toả đều suốt chiều dài phễu, mũi tên chỉ vào tâm vành
               -> đọc ngay được "quặng trút xuống trên cả đoạn này". */
            const LANES = 6;
            g.lineStyle(1.4, COLORS.machineDark, 0.4);
            for (let i = 1; i < LANES; i++) {
                const a = a0 + ((a1 - a0) * i) / LANES;
                const [sx, sy] = PI(rInner + 4, a);
                const [ex, ey] = PI(rOuter + 6, a);
                g.moveTo(sx, sy);
                g.lineTo(ex, ey);
            }
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.65);
            for (let i = 0; i < LANES; i++) {
                const a = a0 + ((a1 - a0) * (i + 0.5)) / LANES;
                const ca = Math.cos(a), sa = Math.sin(a);
                const [hx, hy] = PI(rInner + 12, a);      // đầu mũi tên: mép trong
                const nx = -sa, ny = ca;
                g.moveTo(hx, hy);
                g.lineTo(hx + ca * 13 + nx * 5.5, hy + sa * 13 + ny * 5.5);
                g.lineTo(hx + ca * 13 - nx * 5.5, hy + sa * 13 - ny * 5.5);
                g.closePath();
            }
            g.endFill();
        }

        /* MÁNG XẢ: nằm NGANG, VUÔNG GÓC với băng tải xích. Thành dưới máng
           (y1) chính là LƯỠI GẠT hớt liệu nguội ra khỏi lòng máng vòng, liệu
           trượt dọc máng sang thẳng đầu băng tải xích bên phải. */
        if (chute) {
            const chh = chute.y1 - chute.y0;
            const chw = chute.x1 - chute.x0;
            g.lineStyle(2.5, COLORS.drumOutline);
            g.beginFill(COLORS.machineBody, 0.95);
            g.drawRect(chute.x0, chute.y0, chw, chh);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.55);
            g.drawRect(chute.x0 + 3, chute.y0 + 3, chw - 6, chh - 6);
            g.endFill();
            /* Mũi tên chỉ chiều liệu chạy RA phía băng tải xích */
            g.beginFill(COLORS.steelLight, 0.8);
            const ym = chute.y0 + chh / 2;
            for (let i = 0; i < 3; i++) {
                const x = chute.x0 + 14 + ((chw - 34) * i) / 3;
                g.moveTo(x, ym - 6);
                g.lineTo(x + 13, ym);
                g.lineTo(x, ym + 6);
                g.closePath();
            }
            g.endFill();
            /* LƯỠI GẠT: vạch đậm dọc thành dưới — đúng đường liệu bị hớt đi */
            g.lineStyle(3, COLORS.machineDark, 0.9);
            g.moveTo(chute.x0, chute.y1);
            g.lineTo(chute.x1, chute.y1);
        }
    }, [cx, cy, rOuter, rInner, cellCount, gate, chute, halfSpan, hotSpan, TAU]);

    useTick((delta) => {
        rot.current += 0.0026 * delta;        // rad/khung — quay NGƯỢC chiều kim đồng hồ
        fanPhase.current += 0.16 * delta;
        airPhase.current = (airPhase.current + 0.012 * delta) % 1;

        // --- Cục liệu đen quay theo vành (gom theo màu rồi tô 1 lượt) ---
        // Góc quay `rot` đã cộng đủ ở trên nên chỉ giãn nhịp VẼ LẠI, tốc độ quay
        // của vành KHÔNG đổi. Đây là lớp nặng nhất: 300 cục x 2 vành.
        const g = chunksRef.current;
        if (g && canRedraw()) {
            g.clear();
            buckets.forEach((b) => { b.length = 0; });
            hotBucket.length = 0;

            chunks.forEach((c) => {
                const a = c.a - rot.current;               // góc giảm dần = ngược kim đồng hồ
                const da = Math.atan2(Math.sin(a), Math.cos(a));
                // Bỏ liệu ngay dưới phễu nạp -> nhìn rõ hộp phễu & dòng quặng đổ
                if (gate && Math.abs(da) < halfSpan) return;
                c.px = cx + Math.cos(a) * c.r;
                c.py = cy + Math.sin(a) * c.r;
                // Đã bị LƯỠI GẠT của máng xả hớt đi -> máng trống tới tận phễu nạp
                if (chute && da > 0 && da < Math.PI / 2 && c.py < chute.y1) return;
                c.pa = c.spin + a;
                // Quãng đã đi kể từ cửa nạp -> cục vừa vào máng thì còn nóng đỏ
                let trav = (-halfSpan - da) % TAU;
                if (trav < 0) trav += TAU;
                if (trav < hotSpan) {
                    c.tint = lerpColor(COLORS.sinterFire, BLACK_SINTER_COLORS[c.ci], trav / hotSpan);
                    hotBucket.push(c);
                } else {
                    buckets[c.ci].push(c);
                }
            });

            g.lineStyle(1.1, 0x000000, 0.5);
            buckets.forEach((arr, i) => {
                if (!arr.length) return;
                g.beginFill(BLACK_SINTER_COLORS[i]);
                arr.forEach((c) => drawChunk(g, c.px, c.py, c.size, c.shape, c.pa));
                g.endFill();
            });
            hotBucket.forEach((c) => {
                g.beginFill(c.tint);
                drawChunk(g, c.px, c.py, c.size, c.shape, c.pa);
                g.endFill();
            });
        }

        // --- Gió mát hút từ ngoài vào, xuyên qua quạt rồi thổi vào lớp liệu ---
        const ga = airRef.current;
        if (ga) {
            ga.clear();
            const depth = fanGap + (rOuter - rInner) * 0.7;
            fans.forEach((f, i) => {
                drawFanAirflow(ga, f, fanRadius, (airPhase.current + i * 0.11) % 1, 34, depth);
            });
        }

        // --- Dãy quạt hướng trục áp sát vỏ máy làm mát ---
        const gf = fansRef.current;
        if (gf) {
            gf.clear();
            fans.forEach((f, i) => {
                drawIndustrialFan(
                    gf, f.x, f.y, fanRadius,
                    fanPhase.current + i * 0.7,        // lệch pha để 9 quạt không quay trùng nhau
                    fanBlades, f.ux, f.uy,
                    fanGap + 4                          // ống thổi vừa chạm vỏ máy
                );
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawShell} />
            <Graphics ref={chunksRef} />
            <Graphics ref={airRef} />
            <Graphics ref={fansRef} />
        </Container>
    );
};
