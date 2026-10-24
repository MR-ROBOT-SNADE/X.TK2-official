/* =============================================================================
 * js/components/SinteringDiagram/equipment/waterSystem.jsx — TRẠM NƯỚC TUẦN HOÀN + ỐNG NƯỚC LÀM MÁT
 * =============================================================================
 * WaterRecircStation (trạm nước tuần hoàn nhiệt dư), CoolingWaterLines (ống
 * nước nối trạm phát điện với trạm nước).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/* =============================================================================
 * TRẠM NƯỚC TUẦN HOÀN NHIỆT DƯ (nhìn từ trên xuống)
 * Nhà bơm nước tuần hoàn cho hệ thu hồi nhiệt dư. Bố trí kiểu nhà bơm thật:
 *   - HAI ỐNG GÓP chạy dọc suốt nhà: ống trên = nước NÓNG từ nồi hơi về,
 *     ống dưới = nước NGUỘI cấp trở lại.
 *   - MỘT DÃY BƠM xếp SONG SONG nối hai ống góp; nước qua bơm nào cũng được,
 *     hỏng một bơm vẫn chạy — đúng nguyên tắc đấu song song.
 *   - Bể chứa / bình giãn nở ở cuối nhà.
 * Toạ độ chi tiết đều CỤC BỘ trong khung (0..width, 0..height).
 * ===========================================================================*/
export const WaterRecircStation = ({
    x, y, width, height,
    headers,               // { hotY, coldY, x0, x1 }
    pumps,                 // { count, x0, spacing, cy, bodyR, motorW, motorH }
    tank,                  // { x, y, w, h }
}) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    /* Tâm từng bơm — tính một lần, dùng cho cả vẽ tĩnh lẫn hoạt ảnh */
    const pumpXs = useMemo(
        () => Array.from({ length: pumps.count }, (_, i) => pumps.x0 + i * pumps.spacing),
        [pumps.count, pumps.x0, pumps.spacing]
    );

    const drawBase = useCallback((g) => {
        g.clear();

        /* 1) NHÀ BƠM — nền bo góc + viền trong, đồng bộ với các khu khác */
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) HAI ỐNG GÓP chạy suốt nhà (vỏ tối bọc ngoài, lòng ống sáng) */
        [headers.hotY, headers.coldY].forEach((hy) => {
            g.lineStyle(16, COLORS.machineDark, 0.5);
            g.moveTo(headers.x0, hy); g.lineTo(headers.x1, hy);
            g.lineStyle(11, COLORS.ductBody, 1);
            g.moveTo(headers.x0, hy); g.lineTo(headers.x1, hy);
        });

        /* 3) DÃY BƠM ĐẤU SONG SONG giữa hai ống góp */
        pumpXs.forEach((px) => {
            // ống nhánh nối lên/xuống hai ống góp
            g.lineStyle(11, COLORS.machineDark, 0.45);
            g.moveTo(px, headers.hotY); g.lineTo(px, headers.coldY);
            g.lineStyle(7, COLORS.ductBody, 1);
            g.moveTo(px, headers.hotY); g.lineTo(px, headers.coldY);

            // van chặn hai đầu nhánh
            g.lineStyle(1.4, COLORS.machineDark, 0.9);
            [headers.hotY + 16, headers.coldY - 16].forEach((vy) => {
                g.beginFill(COLORS.industrialOrange, 0.95);
                g.drawRect(px - 6, vy - 4, 12, 8);
                g.endFill();
            });

            // thân bơm + động cơ kéo
            g.lineStyle(2.2, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 1);
            g.drawCircle(px, pumps.cy, pumps.bodyR);
            g.endFill();
            g.lineStyle(1.6, COLORS.machineDark, 0.6);
            g.drawCircle(px, pumps.cy, pumps.bodyR * 0.45);

            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRect(px + pumps.bodyR - 2, pumps.cy - pumps.motorH / 2, pumps.motorW, pumps.motorH);
            g.endFill();
            g.lineStyle(1.2, COLORS.machineDark, 0.5);
            for (let k = 1; k <= 3; k++) {
                const fx = px + pumps.bodyR - 2 + (pumps.motorW * k) / 4;
                g.moveTo(fx, pumps.cy - pumps.motorH / 2 + 3);
                g.lineTo(fx, pumps.cy + pumps.motorH / 2 - 3);
            }
        });

        /* 4) BỂ NƯỚC TUẦN HOÀN cuối nhà, nối vào cả hai ống góp */
        g.lineStyle(2.5, COLORS.siloBorder);
        g.beginFill(COLORS.steelLight, 1);
        g.drawRoundedRect(tank.x, tank.y, tank.w, tank.h, 8);
        g.endFill();
        g.lineStyle(1.4, COLORS.siloBorder, 0.5);
        g.drawRoundedRect(tank.x + 6, tank.y + 6, tank.w - 12, tank.h - 12, 5);
        [headers.hotY, headers.coldY].forEach((hy) => {
            g.lineStyle(9, COLORS.machineDark, 0.45);
            g.moveTo(headers.x1, hy); g.lineTo(tank.x + tank.w / 2, hy);
            g.lineStyle(5, COLORS.ductBody, 1);
            g.moveTo(headers.x1, hy); g.lineTo(tank.x + tank.w / 2, hy);
        });
    }, [width, height, headers, pumps, tank, pumpXs]);

    /* Hạt nước chạy trong hai ống góp — ống nóng chạy một chiều, ống nguội
       chạy NGƯỢC LẠI cho ra dáng vòng tuần hoàn khép kín. */
    const drops = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
        hot: i % 2 === 0,
        t: Math.random(),
        sp: 0.004 + Math.random() * 0.005,
        sz: 2.2 + Math.random() * 1.8,
    })), []);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.09 * delta;
        g.clear();
        g.lineStyle(0);

        // Nước chạy trong ống góp
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) d.t -= 1;
            const p = d.hot ? d.t : 1 - d.t;
            const px = headers.x0 + (headers.x1 - headers.x0) * p;
            const py = d.hot ? headers.hotY : headers.coldY;
            g.beginFill(d.hot ? COLORS.sinterHot : COLORS.coolAir, d.hot ? 0.75 : 0.95);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });

        // Cánh bơm quay + đèn báo chạy
        pumpXs.forEach((px, i) => {
            const a = t.current * (0.8 + i * 0.05);
            g.lineStyle(2.4, COLORS.coolAir, 0.95);
            for (let k = 0; k < 4; k++) {
                const ang = a + (k * Math.PI) / 2;
                g.moveTo(px, pumps.cy);
                g.lineTo(px + Math.cos(ang) * pumps.bodyR * 0.72,
                         pumps.cy + Math.sin(ang) * pumps.bodyR * 0.72);
            }
            g.lineStyle(0);
            const blink = 0.5 + 0.5 * Math.sin(t.current * 1.6 + i);
            g.beginFill(COLORS.statusGood, 0.45 + 0.55 * blink);
            g.drawCircle(px + pumps.bodyR + pumps.motorW - 6, pumps.cy - pumps.motorH / 2 + 5, 2.6);
            g.endFill();
        });

        // Mặt nước trong bể gợn nhẹ
        const wave = 0.5 + 0.5 * Math.sin(t.current * 0.7);
        g.beginFill(COLORS.coolAir, 0.55 + 0.2 * wave);
        g.drawRoundedRect(tank.x + 10, tank.y + 10, tank.w - 20, tank.h - 20, 4);
        g.endFill();
        g.lineStyle(1.6, COLORS.siloBody, 0.5);
        for (let k = 0; k < 3; k++) {
            const wy = tank.y + 24 + k * ((tank.h - 48) / 2) + Math.sin(t.current + k) * 3;
            g.moveTo(tank.x + 16, wy);
            g.lineTo(tank.x + tank.w - 16, wy);
        }
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={flowRef} />
        </Container>
    );
};


/* =============================================================================
 * ĐƯỜNG ỐNG NƯỚC LÀM MÁT — nối TRẠM PHÁT ĐIỆN NHIỆT DƯ với TRẠM NƯỚC TUẦN HOÀN
 * Hơi sau khi qua tuabin ngưng lại thành nước nóng, chảy xuống trạm nước; bơm
 * ở đó đẩy nước đã làm nguội quay ngược lên. Thành vòng tuần hoàn khép kín.
 * Mỗi đường là một ĐƯỜNG GẤP KHÚC khai bằng danh sách đỉnh [[x,y], ...].
 * ===========================================================================*/

/* MÀU ỐNG NƯỚC — XANH LÁ CÂY. Ba loại ống phân biệt rõ: gió XÁM, hơi ĐỎ,
   nước XANH LÁ. Khai một chỗ, dùng cho MỌI tuyến nước. */
const WATER_CORE = COLORS.statusGood;    // 0x2ecc71 — lòng ống, xanh lá
const WATER_CASING = 0x1e8449;           // xanh lá sẫm — vỏ ống

export const CoolingWaterLines = ({ paths, pipeW = 11 }) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    const draw = useCallback((g) => {
        g.clear();
        paths.forEach((ln) => {
            const w = ln.pipeW || pipeW;     // mỗi tuyến có thể tự khai bề rộng
            const trace = () => ln.points.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
            g.lineStyle({ width: w + 5, color: WATER_CASING, alpha: 0.55, join: 'round', cap: 'round' });
            trace();
            g.lineStyle({ width: w, color: WATER_CORE, alpha: 1, join: 'round', cap: 'round' });
            trace();
            // vòng đai kẹp ống
            g.lineStyle(1.4, WATER_CASING, 0.5);
            for (let k = 0; k < ln.points.length - 1; k++) {
                const [x1, y1] = ln.points[k], [x2, y2] = ln.points[k + 1];
                const len = Math.hypot(x2 - x1, y2 - y1) || 1;
                const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
                for (let s = 30; s < len - 12; s += 58) {
                    const cx = x1 + ux * s, cy = y1 + uy * s;
                    g.moveTo(cx - uy * (w / 2), cy + ux * (w / 2));
                    g.lineTo(cx + uy * (w / 2), cy - ux * (w / 2));
                }
            }
        });
    }, [paths, pipeW]);

    const geo = useMemo(() => paths.map((ln) => {
        const segs = []; let total = 0;
        for (let i = 0; i < ln.points.length - 1; i++) {
            const l = Math.hypot(ln.points[i + 1][0] - ln.points[i][0], ln.points[i + 1][1] - ln.points[i][1]);
            segs.push(l); total += l;
        }
        return { segs, total };
    }), [paths]);

    const drops = useMemo(() => {
        const out = [];
        paths.forEach((ln, li) => {
            for (let k = 0; k < 10; k++) {
                out.push({ li, t: Math.random(), sp: 0.0028 + Math.random() * 0.0026, sz: 2.2 + Math.random() * 1.6 });
            }
        });
        return out;
    }, [paths]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.05 * delta;
        g.clear();
        g.lineStyle(0);
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) d.t -= 1;
            const ln = paths[d.li], { segs, total } = geo[d.li];
            // `back: true` -> chạy ngược chiều khai báo (nước nguội bơm trở lên)
            let dist = (ln.back ? 1 - d.t : d.t) * total;
            let px = ln.points[0][0], py = ln.points[0][1];
            for (let i = 0; i < segs.length; i++) {
                if (dist <= segs[i]) {
                    const [x1, y1] = ln.points[i], [x2, y2] = ln.points[i + 1];
                    const k = dist / segs[i];
                    px = x1 + (x2 - x1) * k; py = y1 + (y2 - y1) * k;
                    break;
                }
                dist -= segs[i];
            }
            g.beginFill(ln.hot ? COLORS.sinterHot : COLORS.white, 0.85);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });
    });

    return (
        <Container>
            <Graphics draw={draw} />
            <Graphics ref={flowRef} />
        </Container>
    );
};
