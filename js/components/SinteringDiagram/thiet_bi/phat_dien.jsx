/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/phat_dien.jsx — TRẠM PHÁT ĐIỆN NHIỆT DƯ + ĐƯỜNG HƠI
 * =============================================================================
 * PowerPlant (trạm phát điện), SteamLines (ống hơi từ nồi hơi sang trạm).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './mau_sac.js';

/* =============================================================================
 * TRẠM PHÁT ĐIỆN NHIỆT DƯ + ĐƯỜNG HƠI (nhìn từ trên xuống)
 * Hơi sinh ra ở nồi hơi nhiệt dư (thu nhiệt từ máy làm mát vòng) theo hai ống
 * hơi MÀU XANH chạy về trạm, đẩy hai tổ tuabin - máy phát.
 * Tách làm hai thành phần để xếp lớp cho đúng:
 *   <SteamLines>   — ĐƯỜNG ỐNG HƠI, vẽ SỚM nên các thiết bị bắc ngang qua
 *                    (ống gió, đường xe ghi...) vẫn nằm trên, đúng kiểu ống hơi
 *                    luồn dưới giàn ống trong nhà máy.
 *   <PowerPlant>   — NHÀ TRẠM, vẽ như các nhà khác.
 * ===========================================================================*/

/* MÀU ĐƯỜNG HƠI — ĐỎ cho đúng nghĩa "hơi quá nhiệt". Khai một chỗ, dùng chung
   cho cả ống ngoài trời lẫn ống góp trong nhà trạm phát điện. */
const STEAM_CORE = COLORS.statusBad;     // 0xe74c3c — lòng ống
const STEAM_CASING = 0xc0392b;           // đỏ sẫm  — vỏ bảo ôn

/* Hai ống hơi: chạy NGANG từ nồi hơi mỗi dây chuyền ra rồi bẻ DỌC vào trạm. */
export const SteamLines = ({ lines, riserX, joinTopY, joinBottomY, pipeW = 12 }) => {
    const flowRef = useRef(null);
    const t = useRef(0);

    /* Mỗi đường hơi là một đường gấp khúc 3 điểm: (xFrom,y) -> (riserX,y) -> (riserX,yJoin) */
    const paths = useMemo(() => lines.map((ln, i) => {
        const yJoin = i === 0 ? joinTopY : joinBottomY;
        return [[ln.xFrom, ln.y], [riserX, ln.y], [riserX, yJoin]];
    }), [lines, riserX, joinTopY, joinBottomY]);

    const draw = useCallback((g) => {
        g.clear();
        paths.forEach((pts) => {
            const trace = () => pts.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));
            // vỏ bảo ôn
            g.lineStyle({ width: pipeW + 6, color: STEAM_CASING, alpha: 0.55, join: 'round', cap: 'round' });
            trace();
            // lòng ống hơi — MÀU ĐỎ (hơi quá nhiệt từ nồi hơi nhiệt dư)
            g.lineStyle({ width: pipeW, color: STEAM_CORE, alpha: 1, join: 'round', cap: 'round' });
            trace();
            // vạch bảo ôn
            g.lineStyle(1.4, STEAM_CASING, 0.5);
            for (let k = 0; k < pts.length - 1; k++) {
                const [x1, y1] = pts[k], [x2, y2] = pts[k + 1];
                const len = Math.hypot(x2 - x1, y2 - y1);
                const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
                for (let s = 24; s < len - 10; s += 46) {
                    const cx = x1 + ux * s, cy = y1 + uy * s;
                    g.moveTo(cx - uy * (pipeW / 2), cy + ux * (pipeW / 2));
                    g.lineTo(cx + uy * (pipeW / 2), cy - ux * (pipeW / 2));
                }
            }
        });
    }, [paths, pipeW]);

    /* Nút hơi chạy dọc đường ống về trạm */
    const puffs = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
        line: i % 2, t: Math.random(), sp: 0.0035 + Math.random() * 0.004, sz: 2.4 + Math.random() * 2.2,
    })), []);

    const lens = useMemo(() => paths.map((pts) => {
        const segs = []; let total = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
            segs.push(l); total += l;
        }
        return { segs, total };
    }), [paths]);

    useTick((delta) => {
        const g = flowRef.current;
        if (!g) return;
        t.current += 0.06 * delta;
        g.clear();
        g.lineStyle(0);
        puffs.forEach((p) => {
            p.t += p.sp * delta;
            if (p.t > 1) p.t -= 1;
            const pts = paths[p.line], { segs, total } = lens[p.line];
            let d = p.t * total;
            let px = pts[0][0], py = pts[0][1];
            for (let i = 0; i < segs.length; i++) {
                if (d <= segs[i]) {
                    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
                    const k = d / segs[i];
                    px = x1 + (x2 - x1) * k; py = y1 + (y2 - y1) * k;
                    break;
                }
                d -= segs[i];
            }
            g.beginFill(COLORS.white, 0.75);
            g.drawCircle(px, py, p.sz);
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

/* NHÀ TRẠM PHÁT ĐIỆN: ống góp hơi dọc mép trái, hai tổ tuabin - máy phát nằm
   ngang, cuối cùng là tủ hoà lưới. */
export const PowerPlant = ({
    x, y, width, height,
    header,                // { x, y0, y1 }
    sets,                  // [{ cy }, ...]
    turbine,               // { x, w, h }
    generator,             // { x, w, h }
    panel,                 // { x, y, w, h }
}) => {
    const spinRef = useRef(null);
    const t = useRef(0);

    const drawBase = useCallback((g) => {
        g.clear();

        /* 1) NHÀ TRẠM */
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) ỐNG GÓP HƠI dọc mép trái — nơi hai ống hơi ngoài trời cắm vào */
        g.lineStyle(16, STEAM_CASING, 0.5);
        g.moveTo(header.x, header.y0); g.lineTo(header.x, header.y1);
        g.lineStyle(11, STEAM_CORE, 1);
        g.moveTo(header.x, header.y0); g.lineTo(header.x, header.y1);

        /* 3) HAI TỔ TUABIN - MÁY PHÁT */
        sets.forEach((s) => {
            // ống hơi vào tuabin
            g.lineStyle(9, STEAM_CASING, 0.5);
            g.moveTo(header.x, s.cy); g.lineTo(turbine.x, s.cy);
            g.lineStyle(5, STEAM_CORE, 1);
            g.moveTo(header.x, s.cy); g.lineTo(turbine.x, s.cy);

            // thân tuabin
            g.lineStyle(2.4, COLORS.machineDark);
            g.beginFill(COLORS.machineBody, 1);
            g.drawRoundedRect(turbine.x, s.cy - turbine.h / 2, turbine.w, turbine.h, 7);
            g.endFill();
            g.lineStyle(1.3, COLORS.machineDark, 0.55);
            for (let k = 1; k <= 4; k++) {
                const fx = turbine.x + (turbine.w * k) / 5;
                g.moveTo(fx, s.cy - turbine.h / 2 + 4);
                g.lineTo(fx, s.cy + turbine.h / 2 - 4);
            }

            // khớp nối trục
            g.lineStyle(2, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRect(turbine.x + turbine.w, s.cy - 7, generator.x - (turbine.x + turbine.w), 14);
            g.endFill();

            // máy phát
            g.lineStyle(2.4, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawRoundedRect(generator.x, s.cy - generator.h / 2, generator.w, generator.h, 7);
            g.endFill();
            g.lineStyle(1.4, COLORS.machineDark, 0.5);
            g.drawCircle(generator.x + generator.w / 2, s.cy, generator.h * 0.32);

            // ống hơi thoát xuống bình ngưng
            g.lineStyle(7, COLORS.machineDark, 0.4);
            g.moveTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2);
            g.lineTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2 + 14);
            g.lineStyle(4, COLORS.ductBody, 1);
            g.moveTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2);
            g.lineTo(turbine.x + turbine.w / 2, s.cy + turbine.h / 2 + 14);
        });

        /* 4) TỦ HOÀ LƯỚI */
        g.lineStyle(2.2, COLORS.siloBorder);
        g.beginFill(COLORS.steelLight, 1);
        g.drawRoundedRect(panel.x, panel.y, panel.w, panel.h, 6);
        g.endFill();
        g.lineStyle(1.3, COLORS.siloBorder, 0.5);
        for (let k = 1; k <= 3; k++) {
            const py = panel.y + (panel.h * k) / 4;
            g.moveTo(panel.x + 5, py); g.lineTo(panel.x + panel.w - 5, py);
        }
        // cáp lực từ hai máy phát sang tủ
        sets.forEach((s) => {
            g.lineStyle(3, COLORS.machineDark, 0.6);
            g.moveTo(generator.x + generator.w, s.cy);
            g.lineTo(panel.x, panel.y + panel.h / 2);
        });
    }, [width, height, header, sets, turbine, generator, panel]);

    useTick((delta) => {
        const g = spinRef.current;
        if (!g) return;
        t.current += 0.12 * delta;
        g.clear();

        sets.forEach((s, i) => {
            // rotor tuabin quay
            const a = t.current * (1 + i * 0.12);
            g.lineStyle(2.2, COLORS.coolAir, 0.9);
            const rc = turbine.x + turbine.w / 2;
            for (let k = 0; k < 6; k++) {
                const ang = a + (k * Math.PI) / 3;
                g.moveTo(rc, s.cy);
                g.lineTo(rc + Math.cos(ang) * turbine.h * 0.38, s.cy + Math.sin(ang) * turbine.h * 0.38);
            }
            // rotor máy phát + quầng sáng phát điện
            const gc = generator.x + generator.w / 2;
            g.lineStyle(2, COLORS.statusWarn, 0.95);
            for (let k = 0; k < 4; k++) {
                const ang = -a * 1.3 + (k * Math.PI) / 2;
                g.moveTo(gc, s.cy);
                g.lineTo(gc + Math.cos(ang) * generator.h * 0.3, s.cy + Math.sin(ang) * generator.h * 0.3);
            }
            const beat = 0.5 + 0.5 * Math.sin(t.current * 0.8 + i * 1.7);
            g.lineStyle(0);
            g.beginFill(COLORS.statusWarn, 0.15 + 0.25 * beat);
            g.drawCircle(gc, s.cy, generator.h * 0.5);
            g.endFill();
        });

        // đèn tủ hoà lưới nhấp nháy
        g.lineStyle(0);
        for (let k = 0; k < 3; k++) {
            const on = 0.5 + 0.5 * Math.sin(t.current * 1.4 + k * 2);
            g.beginFill(k === 2 ? COLORS.statusWarn : COLORS.statusGood, 0.35 + 0.65 * on);
            g.drawCircle(panel.x + 9 + k * 9, panel.y + 8, 2.8);
            g.endFill();
        }
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={spinRef} />
        </Container>
    );
};
