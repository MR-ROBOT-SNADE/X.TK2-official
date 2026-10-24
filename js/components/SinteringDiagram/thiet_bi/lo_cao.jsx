/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/lo_cao.jsx — LÒ CAO
 * =============================================================================
 * BlastFurnacePlant: hộ tiêu thụ cuối cùng của quặng thiêu kết.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, lerpColor } from './mau_sac.js';

/* =============================================================================
 * LÒ CAO (nhìn từ trên xuống) — hộ tiêu thụ cuối cùng của quặng thiêu kết.
 * Bố trí theo mặt bằng lò cao thật, ĐỌC TỪ TRÊN XUỐNG:
 *   - LÒ GIÓ NÓNG : 3 tháp xếp thành HÀNG NGANG ở mép trên sân, mỗi tháp có ống
 *                   gió nóng chạy xuống cắm vào ống gió bao.
 *   - THÂN LÒ     : vòng tròn nhiều lớp (vỏ thép -> lớp lót -> nồi lò), quanh
 *                   thân là ỐNG GIÓ BAO (bustle pipe) + vành MẮT GIÓ (tuyère).
 *   - MÁNG GANG   : rãnh ra gang bên trái, gang lỏng chảy ra thùng (hoạt ảnh).
 *   - PHỄU NHẬN QUẶNG có HAI HƯỚNG NẠP:
 *       binsSide : mép PHẢI sân — nhận 2 băng tải NGANG từ TRẠM TRUNG CHUYỂN S4
 *       binsDown : mép DƯỚI sân — nhận 2 băng tải DỌC từ NHÀ VÒM THÀNH PHẨM
 *   - HỐ ĐỔ QUẶNG : sân đổ cho xe ben chở quặng từ khu máng quặng thành phẩm.
 * Mọi toạ độ chi tiết đều CỤC BỘ trong khung (0..width, 0..height) nên muốn dời
 * cả cụm chỉ cần đổi x/y ở CFG.
 * ===========================================================================*/
export const BlastFurnacePlant = ({
    x, y, width, height,
    shell,                 // { cx, cy, r }
    stoves,                // { cy, cxs: [...], r }  — HÀNG NGANG ở mép trên
    binsSide,              // { cx, cys: [...], r }  — phễu nhận băng NGANG từ S4
    binsDown,              // { cxs: [...], cy, r }  — phễu nhận băng DỌC từ nhà vòm
    tipPit,                // { x, y, width, height }
    ladle,                 // { cx, cy, r }
}) => {
    const hotRef = useRef(null);
    const t = useRef(0);

    /* --- Phần TĨNH: nền sân, lò gió nóng, ống bao, thân lò, máng gang, phễu --- */
    const drawBase = useCallback((g) => {
        const { cx, cy, r } = shell;
        g.clear();

        /* 1) SÂN LÒ CAO — nền bê tông bo góc + viền, đồng bộ với các khu khác.
              LỚP LÓT ĐỤC vẽ trước: nền sân chỉ đục 28% nên đầu 4 băng tải cắm
              vào (2 ngang từ Trạm S4, 2 dọc từ nhà vòm) vẫn lộ xuyên qua. */
        g.lineStyle(0);
        g.beginFill(COLORS.white, 1);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(2.5, COLORS.siloBorder, 0.85);
        g.beginFill(COLORS.dustLight, 0.28);
        g.drawRoundedRect(0, 0, width, height, 16);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.45);
        g.drawRoundedRect(9, 9, width - 18, height - 18, 10);

        /* 2) ỐNG GIÓ NÓNG: từ mỗi lò gió chạy XUỐNG cắm vào ống gió bao */
        stoves.cxs.forEach((sx) => {
            const dx = cx - sx, dy = cy - stoves.cy;
            const len = Math.hypot(dx, dy) || 1;
            const ex = sx + (dx / len) * (len - r - 12);
            const ey = stoves.cy + (dy / len) * (len - r - 12);
            g.lineStyle(11, COLORS.machineDark, 0.55);
            g.moveTo(sx, stoves.cy); g.lineTo(ex, ey);
            g.lineStyle(7, COLORS.ductBody, 1);
            g.moveTo(sx, stoves.cy); g.lineTo(ex, ey);
        });

        /* 3) ỐNG GIÓ BAO (bustle pipe) — vành ống lớn ôm quanh thân lò */
        g.lineStyle(12, COLORS.machineDark, 0.5);
        g.drawCircle(cx, cy, r + 13);
        g.lineStyle(8, COLORS.ductBody, 1);
        g.drawCircle(cx, cy, r + 13);

        /* 4) THÂN LÒ — các lớp từ ngoài vào trong */
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.steelFrame, 1);            // vỏ thép
        g.drawCircle(cx, cy, r);
        g.endFill();
        g.lineStyle(1.5, COLORS.machineDark, 0.55);
        g.beginFill(COLORS.machineBody, 0.95);        // lớp lót chịu lửa
        g.drawCircle(cx, cy, r * 0.80);
        g.endFill();
        g.beginFill(COLORS.linerBlack, 0.92);         // nồi lò (nền cho vệt nóng)
        g.drawCircle(cx, cy, r * 0.52);
        g.endFill();

        /* Gân chịu lực toả tia trên vỏ lò */
        g.lineStyle(1.4, COLORS.machineDark, 0.45);
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + 0.2;
            g.moveTo(cx + Math.cos(a) * r * 0.54, cy + Math.sin(a) * r * 0.54);
            g.lineTo(cx + Math.cos(a) * r * 0.98, cy + Math.sin(a) * r * 0.98);
        }

        /* MẮT GIÓ (tuyère) — vành vòi phun gió nóng vào nồi lò */
        g.lineStyle(1.2, COLORS.machineDark, 0.9);
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            g.beginFill(COLORS.industrialOrange, 0.95);
            g.drawCircle(cx + Math.cos(a) * r * 0.90, cy + Math.sin(a) * r * 0.90, 3.6);
            g.endFill();
        }

        /* 5) MÁNG GANG + THÙNG CHỨA GANG LỎNG (bên trái thân lò) */
        g.lineStyle(9, COLORS.machineDark, 0.6);
        g.moveTo(cx - r * 0.9, cy); g.lineTo(ladle.cx + ladle.r * 0.6, ladle.cy);
        g.lineStyle(5, COLORS.sinterCool, 1);
        g.moveTo(cx - r * 0.9, cy); g.lineTo(ladle.cx + ladle.r * 0.6, ladle.cy);
        g.lineStyle(2.5, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 1);
        g.drawCircle(ladle.cx, ladle.cy, ladle.r);
        g.endFill();

        /* 6) LÒ GIÓ NÓNG — 3 tháp tròn xếp HÀNG NGANG ở mép trên sân */
        stoves.cxs.forEach((sx) => {
            g.lineStyle(3, COLORS.machineDark);
            g.beginFill(COLORS.steelFrame, 1);
            g.drawCircle(sx, stoves.cy, stoves.r);
            g.endFill();
            g.lineStyle(1.4, COLORS.machineDark, 0.6);
            g.drawCircle(sx, stoves.cy, stoves.r * 0.62);
            g.moveTo(sx - stoves.r * 0.62, stoves.cy); g.lineTo(sx + stoves.r * 0.62, stoves.cy);
            g.moveTo(sx, stoves.cy - stoves.r * 0.62); g.lineTo(sx, stoves.cy + stoves.r * 0.62);
        });

        /* 7) BĂNG NẠP LIỆU TRONG SÂN: từ mỗi phễu chạy vào chân thân lò.
              - phễu MÉP PHẢI  : nhận quặng NGANG từ Trạm trung chuyển S4
              - phễu MÉP DƯỚI  : nhận quặng DỌC từ Nhà vòm thành phẩm  */
        const feedLine = (bx, by, tx, ty) => {
            g.lineStyle(10, COLORS.machineDark, 0.45);
            g.moveTo(bx, by); g.lineTo(tx, ty);
            g.lineStyle(6, COLORS.dustGray, 1);
            g.moveTo(bx, by); g.lineTo(tx, ty);
        };
        binsSide.cys.forEach((by) => feedLine(binsSide.cx, by, cx + r * 0.86, cy));
        binsDown.cxs.forEach((bx) => feedLine(bx, binsDown.cy, cx, cy + r * 0.86));

        /* 8) PHỄU NHẬN QUẶNG (vẽ sau nên đè lên đầu băng nạp) */
        const drawBin = (bx, by, br) => {
            g.lineStyle(3, COLORS.siloBorder);
            g.beginFill(COLORS.siloBody, 0.95);
            g.drawCircle(bx, by, br);
            g.endFill();
            g.lineStyle(1.5, COLORS.siloBorder, 0.6);
            g.drawCircle(bx, by, br * 0.6);
        };
        binsSide.cys.forEach((by) => drawBin(binsSide.cx, by, binsSide.r));
        binsDown.cxs.forEach((bx) => drawBin(bx, binsDown.cy, binsDown.r));

        /* 9) HỐ ĐỔ QUẶNG cho xe ben — miệng hố có lưới chắn cục lớn */
        g.lineStyle(2.5, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineDark, 0.42);
        g.drawRoundedRect(tipPit.x, tipPit.y, tipPit.width, tipPit.height, 6);
        g.endFill();
        g.lineStyle(1.6, COLORS.dustLight, 0.75);
        for (let gx = tipPit.x + 7; gx < tipPit.x + tipPit.width - 4; gx += 9) {
            g.moveTo(gx, tipPit.y + 5);
            g.lineTo(gx, tipPit.y + tipPit.height - 5);
        }
        /* Ống rót từ hố đổ sang phễu nhận quặng dưới gần nhất */
        const nearest = binsDown.cxs[binsDown.cxs.length - 1];
        g.lineStyle(9, COLORS.machineDark, 0.45);
        g.moveTo(tipPit.x, tipPit.y + tipPit.height / 2);
        g.lineTo(nearest, binsDown.cy);
        g.lineStyle(5, COLORS.dustGray, 1);
        g.moveTo(tipPit.x, tipPit.y + tipPit.height / 2);
        g.lineTo(nearest, binsDown.cy);
    }, [width, height, shell, stoves, binsSide, binsDown, tipPit, ladle]);

    /* Giọt gang lỏng chảy dọc máng gang */
    const drops = useMemo(() => Array.from({ length: 16 }, () => ({
        t: Math.random(), sp: 0.010 + Math.random() * 0.014,
        off: (Math.random() - 0.5) * 5, sz: 1.7 + Math.random() * 2.2,
    })), []);

    /* --- Phần ĐỘNG: nồi lò rực nóng + gang lỏng chảy ra thùng --- */
    useTick((delta) => {
        const g = hotRef.current;
        if (!g) return;
        t.current += 0.045 * delta;

        const { cx, cy, r } = shell;
        const beat = 0.5 + 0.5 * Math.sin(t.current);
        g.clear();
        g.lineStyle(0);

        // Nồi lò: 3 lớp lửa lồng nhau, thở theo nhịp
        g.beginFill(lerpColor(COLORS.sinterFire, COLORS.sinterHot, beat), 0.55 + 0.25 * beat);
        g.drawCircle(cx, cy, r * 0.50);
        g.endFill();
        g.beginFill(lerpColor(COLORS.sinterHot, COLORS.statusWarn, beat), 0.60 + 0.25 * beat);
        g.drawCircle(cx, cy, r * 0.33);
        g.endFill();
        g.beginFill(COLORS.statusWarn, 0.55 + 0.35 * (1 - beat));
        g.drawCircle(cx, cy, r * 0.15);
        g.endFill();

        // 3 lò gió nóng sáng lệch pha nhau
        stoves.cxs.forEach((sx, i) => {
            const b = 0.5 + 0.5 * Math.sin(t.current * 0.7 + i * 2.1);
            g.beginFill(COLORS.sinterHot, 0.20 + 0.40 * b);
            g.drawCircle(sx, stoves.cy, stoves.r * 0.45);
            g.endFill();
        });

        // Gang lỏng chảy từ lỗ ra gang xuống thùng chứa
        const x1 = cx - r * 0.9, y1 = cy;
        const x2 = ladle.cx + ladle.r * 0.6, y2 = ladle.cy;
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len, ny = dx / len;
        drops.forEach((d) => {
            d.t += d.sp * delta;
            if (d.t > 1) { d.t -= 1; d.off = (Math.random() - 0.5) * 5; }
            const px = x1 + dx * d.t + nx * d.off;
            const py = y1 + dy * d.t + ny * d.off;
            g.beginFill(lerpColor(COLORS.statusWarn, COLORS.sinterFire, d.t), 0.9 - d.t * 0.25);
            g.drawCircle(px, py, d.sz);
            g.endFill();
        });
        // Mặt gang trong thùng sôi lăn tăn
        g.beginFill(lerpColor(COLORS.sinterFire, COLORS.statusWarn, beat), 0.85);
        g.drawCircle(ladle.cx, ladle.cy, ladle.r * 0.66);
        g.endFill();
    });

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawBase} />
            <Graphics ref={hotRef} />
        </Container>
    );
};
