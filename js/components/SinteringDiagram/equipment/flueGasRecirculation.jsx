/* =============================================================================
 * js/components/SinteringDiagram/equipment/flueGasRecirculation.jsx — HỆ TUẦN HOÀN KHÍ THẢI
 * =============================================================================
 * FlueGasRecirculation: hút gió + bụi từ phễu ống gió đầu / cuối dãy, gom vào
 * ống góp đáy.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/**
 * HỆ TUẦN HOÀN KHÍ THẢI — hút gió + bụi từ phễu ống gió ĐẦU/CUỐI dãy (20,21 ở
 * đầu; 1,2,3 ở cuối) cùng NHIỆT đoạn giữa máy làm mát vòng, gom vào ống góp đáy.
 * Khí từ 2 nhánh ĐẨY NGƯỢC CHIỀU NHAU DỒN VÀO GIỮA -> ống lên TÂM -> ống góp
 * SPINE chạy dọc trên thân xe ghi -> nhiều ống rẽ THỔI GIÓ LÊN thẳng mặt xe ghi
 * (đè khuất mặt xe ghi). Vẽ SAU cùng, nằm trên mọi chi tiết.
 * @param {array}  leftHoods   [x] tâm phễu 20,21 (đầu dãy, gần vành).
 * @param {array}  rightHoods  [x] tâm phễu 1,2,3 (cuối dãy, gần lò).
 * @param {object} midTap      {x,y} chụp lấy nhiệt đoạn giữa vành (nối vào góp đáy).
 * @param {number} windBottomY mép dưới dãy phễu (điểm bắt đầu hút xuống).
 * @param {object} manifold    {y,x0,x1} ống góp đáy.
 * @param {number} centerX     trục ống lên ở GIỮA (nơi 2 nhánh khí gặp nhau).
 * @param {number} spineY      cao độ ống góp spine chạy dọc trên xe ghi.
 * @param {object} spine       {x0,x1} phạm vi ống spine.
 * @param {array}  blowX       [x] vị trí các ống rẽ thổi gió LÊN mặt xe ghi.
 * @param {number} trackTopY   mặt trên xe ghi (đích khí thổi tới).
 */
export const FlueGasRecirculation = ({
    leftHoods, rightHoods, midTap, windBottomY, manifold, centerX, spineY, spine, blowX, trackTopY,
    blowTopY, riserFootY, fans,
}) => {
    const convRef = useRef(null);
    const spineRef = useRef(null);
    const intakeRef = useRef(null);
    const blowRef = useRef(null);
    const fanRef = useRef(null);
    const fanPhase = useRef(0);

    const DUCT = 0x5dade2, DUCT_LINE = 0x1f618d, GAS = 0xaed6f1;
    const windTaps = useMemo(() => [...leftHoods, ...rightHoods], [leftHoods, rightHoods]);

    /* Hạt khí trong ống góp đáy: 2 nhánh chạy NGƯỢC CHIỀU dồn về centerX.
       side=-1: từ x0 -> centerX (đi phải);  side=+1: từ x1 -> centerX (đi trái). */
    const conv = useMemo(() => {
        const arr = [];
        for (let k = 0; k < 34; k++) arr.push({ side: -1, u: Math.random(), v: 0.004 + Math.random() * 0.004 });
        for (let k = 0; k < 34; k++) arr.push({ side: 1, u: Math.random(), v: 0.004 + Math.random() * 0.004 });
        return arr;
    }, []);
    /* Hạt khí trên spine: từ TÂM toả ra 2 phía (mô phỏng phân bổ đều dọc dãy). */
    const spineDust = useMemo(() => Array.from({ length: 40 }, () => ({
        side: Math.random() < 0.5 ? -1 : 1, u: Math.random(), v: 0.006 + Math.random() * 0.005,
    })), []);
    /* Hạt bụi bị hút xuống tại 5 phễu. */
    const intake = useMemo(() => {
        const arr = [];
        windTaps.forEach((x) => { for (let k = 0; k < 3; k++)
            arr.push({ x, t: Math.random(), v: 0.02 + Math.random() * 0.015, streak: 5 + Math.random() * 4 }); });
        return arr;
    }, [windTaps]);
    /* Tia gió TOẢ RA tại mỗi điểm xả (hiệu ứng thổi gió lên mặt liệu). */
    const puff = useMemo(() => {
        const arr = [];
        blowX.forEach((x) => {
            for (let k = 0; k < 9; k++)
                arr.push({ x, a: (k * Math.PI * 2) / 9 + Math.random() * 0.3,
                           t: Math.random(), v: 0.016 + Math.random() * 0.014 });
        });
        return arr;
    }, [blowX]);
    /* Hạt khí THỔI LÊN mặt xe ghi tại mỗi ống rẽ. */
    const blow = useMemo(() => {
        const arr = [];
        blowX.forEach((x) => { for (let k = 0; k < 4; k++)
            arr.push({ x: x + (Math.random() - 0.5) * 12, t: Math.random(),
                       v: 0.02 + Math.random() * 0.02, streak: 6 + Math.random() * 6, warm: Math.random() }); });
        return arr;
    }, [blowX]);

    const drawStruct = useCallback((g) => {
        g.clear();
        const H = 15;

        /* ============ 5 CHỤP HÚT phễu 20,21 / 1,2,3 (điểm 2) ============
           Cuống chạy từ ngay dưới bầu phễu XUỐNG ống góp; NẮP CHỤP loe GẮN VÀO
           ỐNG GÓP ở đáy (không còn trùm lên bầu phễu bên trên). */
        windTaps.forEach((x) => {
            g.lineStyle(2, DUCT_LINE);
            g.beginFill(DUCT, 0.95);
            g.drawRect(x - 6, windBottomY, 12, manifold.y - windBottomY - 6);   // cuống dọc
            g.endFill();
            // nắp chụp loe úp GẮN VÀO ống góp đáy (đỉnh hẹp nối cuống, đáy loe ôm ống góp)
            g.beginFill(DUCT, 0.95);
            g.moveTo(x - 6, manifold.y - 6);
            g.lineTo(x + 6, manifold.y - 6);
            g.lineTo(x + 16, manifold.y - H / 2);
            g.lineTo(x - 16, manifold.y - H / 2);
            g.closePath();
            g.endFill();
            // mũi tên HÚT xuống
            g.lineStyle(0);
            g.beginFill(DUCT_LINE, 0.8);
            g.moveTo(x - 5, windBottomY + 6);
            g.lineTo(x + 5, windBottomY + 6);
            g.lineTo(x, windBottomY + 14);
            g.closePath();
            g.endFill();
        });

        /* ============ MID-TAP: ĐIỂM HÚT KÍN bên máy làm mát vòng (điểm 4) ============
           Thay chụp tròn hở bằng CHỤP HÚT KÍN: buồng hút ôm sát mặt vành + viền
           gioăng làm kín + cổ côn thu + mặt bích bắt bulông, rồi mới xuống ống. */
        const midW = H + 2;
        const hoodW = 54, hoodH = 30;                       // buồng hút (plenum) ôm mặt vành
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRect(midTap.x - midW / 2, midTap.y, midW, manifold.y - midTap.y);          // tụt xuống
        g.drawRoundedRect(midTap.x - midW / 2, manifold.y - midW / 2,
                          (manifold.x0 + 40 - midTap.x) + midW / 2, midW, midW / 2);      // ngang cắm sâu vào góp
        g.endFill();
        // mặt bích tại điểm đấu nối vào ống góp
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.9);
        g.drawRect(manifold.x0 - 3, manifold.y - midW / 2 - 3, 6, midW + 6);
        g.endFill();
        // GIOĂNG LÀM KÍN quanh mép buồng hút (viền tối ôm sát mặt vành)
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.85);
        g.drawRoundedRect(midTap.x - hoodW / 2 - 3, midTap.y - hoodH / 2 - 3, hoodW + 6, hoodH + 6, 9);
        g.endFill();
        // BUỒNG HÚT KÍN
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.97);
        g.drawRoundedRect(midTap.x - hoodW / 2, midTap.y - hoodH / 2, hoodW, hoodH, 7);
        g.endFill();
        // CỔ CÔN THU từ buồng hút vào ống đứng (kín, không hở mép)
        g.beginFill(DUCT, 0.97);
        g.moveTo(midTap.x - hoodW / 2 + 6, midTap.y + hoodH / 2 - 2);
        g.lineTo(midTap.x + hoodW / 2 - 6, midTap.y + hoodH / 2 - 2);
        g.lineTo(midTap.x + midW / 2, midTap.y + hoodH / 2 + 12);
        g.lineTo(midTap.x - midW / 2, midTap.y + hoodH / 2 + 12);
        g.closePath();
        g.endFill();
        // BULÔNG trên mặt bích buồng hút + khe hút ám nóng bên trong
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.85);
        for (let bx = midTap.x - hoodW / 2 + 6; bx <= midTap.x + hoodW / 2 - 6; bx += 10) {
            g.drawCircle(bx, midTap.y - hoodH / 2 + 4, 1.8);
            g.drawCircle(bx, midTap.y + hoodH / 2 - 4, 1.8);
        }
        g.endFill();
        g.beginFill(COLORS.sinterHot, 0.42);
        g.drawRoundedRect(midTap.x - hoodW / 2 + 8, midTap.y - 6, hoodW - 16, 12, 5);
        g.endFill();
        // mũi tên dòng khí từ vành CHẢY VÀO ống góp (→)
        g.beginFill(DUCT_LINE, 0.8);
        for (let ax = midTap.x + 40; ax < manifold.x0 - 10; ax += 90) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax + 11, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        g.endFill();

        /* ============ ỐNG GÓP ĐÁY ============ */
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRoundedRect(manifold.x0, manifold.y - H / 2, manifold.x1 - manifold.x0, H, H / 2);
        g.endFill();

        /* ============ 2 QUẠT ĐẨY trên ống góp (điểm 3) — VỎ tĩnh ============
           Cánh quạt QUAY được vẽ ở lớp fanRef trong useTick. */
        fans.forEach((fx) => {
            const dir = fx < centerX ? 1 : -1;              // hướng đẩy về tâm
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(COLORS.machineBody, 0.98);          // vỏ quạt
            g.drawRoundedRect(fx - 21, manifold.y - 19, 42, 38, 9);
            g.endFill();
            g.beginFill(COLORS.steelLight, 0.98);           // buồng cánh
            g.drawCircle(fx, manifold.y, 13);
            g.endFill();
            g.beginFill(COLORS.industrialOrange, 0.95);      // motor kéo
            g.drawRoundedRect(fx - 8, manifold.y - 32, 16, 13, 3);
            g.endFill();
            g.beginFill(COLORS.statusBad, 0.9);              // mũi tên hướng đẩy về tâm
            const ax0 = fx + dir * 27;
            g.moveTo(ax0, manifold.y - 6);
            g.lineTo(ax0 + dir * 12, manifold.y);
            g.lineTo(ax0, manifold.y + 6);
            g.closePath();
            g.endFill();
        });

        /* ============ ĐOẠN ỐNG GIÓ ĐỨNG đẩy gió TỪ DƯỚI LÊN (điểm 2) ============
           Chân ống nằm DƯỚI ống góp (có đế + mặt bích), xuyên qua ống góp rồi
           chạy thẳng lên spine -> thấy rõ gió được đẩy từ dưới lên. */
        const rW = H + 6;
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.97);
        g.drawRoundedRect(centerX - rW / 2, spineY, rW, riserFootY - spineY, rW / 2);   // thân ống đứng
        g.endFill();
        g.beginFill(COLORS.machineBody, 0.98);              // ĐẾ chân ống
        g.drawRoundedRect(centerX - 26, riserFootY - 10, 52, 18, 5);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.9);                        // 2 mặt bích kẹp ống góp
        g.drawRect(centerX - rW / 2 - 5, manifold.y - H / 2 - 4, rW + 10, 5);
        g.drawRect(centerX - rW / 2 - 5, manifold.y + H / 2 - 1, rW + 10, 5);
        g.endFill();
        g.beginFill(COLORS.sinterHot, 0.9);                 // mũi tên gió ĐI LÊN trong ống đứng
        for (let ay = riserFootY - 22; ay > spineY + 10; ay -= 30) {
            g.moveTo(centerX - 7, ay);
            g.lineTo(centerX + 7, ay);
            g.lineTo(centerX, ay - 12);
            g.closePath();
        }
        g.endFill();

        /* ============ SPINE dọc trên xe ghi ============ */
        g.lineStyle(2.5, DUCT_LINE);
        g.beginFill(DUCT, 0.96);
        g.drawRoundedRect(spine.x0, spineY - H / 2, spine.x1 - spine.x0, H, H / 2);
        g.endFill();

        /* ============ ỐNG RẼ XẢ GIÓ LÊN mặt xe ghi (điểm 1) ============
           Điểm xả (nắp chụp TRÒN) nằm ĐÚNG GIỮA bề rộng xe ghi: blowTopY = 240. */
        blowX.forEach((x) => {
            g.lineStyle(2.5, DUCT_LINE);
            g.beginFill(DUCT, 0.96);
            g.drawRect(x - 7, blowTopY, 14, spineY - blowTopY);                        // ống đứng
            g.endFill();
            g.beginFill(DUCT, 0.94);                                                   // NẮP CHỤP TRÒN (điểm xả)
            g.drawCircle(x, blowTopY, 12);
            g.endFill();
            g.lineStyle(0);                                                            // mũi tên XẢ LÊN trong nắp
            g.beginFill(COLORS.sinterHot, 0.9);
            g.moveTo(x - 6, blowTopY + 4);
            g.lineTo(x + 6, blowTopY + 4);
            g.lineTo(x, blowTopY - 6);
            g.closePath();
            g.endFill();
        });

        /* ============ Mũi tên hướng dòng ============ */
        g.lineStyle(0);
        g.beginFill(DUCT_LINE, 0.8);
        // góp đáy: nhánh trái -> phải (dồn vào tâm)
        for (let ax = manifold.x0 + 70; ax < centerX - 30; ax += 150) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax + 12, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        // góp đáy: nhánh phải -> trái (dồn vào tâm)
        for (let ax = manifold.x1 - 70; ax > centerX + 30; ax -= 150) {
            g.moveTo(ax, manifold.y - 5); g.lineTo(ax - 12, manifold.y); g.lineTo(ax, manifold.y + 5); g.closePath();
        }
        // spine: toả 2 phía từ tâm
        for (let ax = centerX + 60; ax < spine.x1 - 20; ax += 150) {
            g.moveTo(ax, spineY - 5); g.lineTo(ax + 11, spineY); g.lineTo(ax, spineY + 5); g.closePath();
        }
        for (let ax = centerX - 60; ax > spine.x0 + 20; ax -= 150) {
            g.moveTo(ax, spineY - 5); g.lineTo(ax - 11, spineY); g.lineTo(ax, spineY + 5); g.closePath();
        }
        g.endFill();

    }, [windTaps, midTap, windBottomY, manifold, centerX, spineY, spine, blowX, trackTopY,
        blowTopY, riserFootY, fans]);

    useTick((delta) => {
        // Khí dồn vào tâm trong ống góp đáy
        const cg = convRef.current;
        if (cg) {
            cg.clear();
            conv.forEach((p) => {
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const x = p.side < 0
                    ? manifold.x0 + (centerX - manifold.x0) * p.u
                    : manifold.x1 + (centerX - manifold.x1) * p.u;
                cg.lineStyle(1.5, GAS, 0.5);
                cg.moveTo(x - p.side * 6, manifold.y);
                cg.lineTo(x, manifold.y);
            });
        }
        // Khí lên riser + toả trên spine
        const sg = spineRef.current;
        if (sg) {
            sg.clear();
            spineDust.forEach((p) => {
                p.u += p.v * delta;
                if (p.u > 1) p.u = 0;
                const end = p.side < 0 ? spine.x0 : spine.x1;
                const x = centerX + (end - centerX) * p.u;
                sg.lineStyle(1.5, GAS, 0.5);
                sg.moveTo(x - Math.sign(end - centerX) * 6, spineY);
                sg.lineTo(x, spineY);
            });
        }
        // Bụi bị HÚT xuống tại 5 phễu
        const ig = intakeRef.current;
        if (ig) {
            ig.clear();
            intake.forEach((p) => {
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const py = (windBottomY - 4) + (manifold.y - (windBottomY - 4)) * p.t;
                ig.lineStyle(1.4, COLORS.dustGray, 0.25 + 0.4 * p.t);
                ig.moveTo(p.x, py - p.streak);
                ig.lineTo(p.x, py);
            });
        }
        // Khí THỔI LÊN mặt xe ghi tại các ống rẽ
        const bg = blowRef.current;
        if (bg) {
            bg.clear();
            blow.forEach((p) => {
                p.t += p.v * delta;
                if (p.t > 1) p.t = 0;
                const py = spineY - (spineY - (blowTopY - 6)) * p.t;   // đi LÊN (py giảm)
                bg.lineStyle(1.8, p.warm > 0.5 ? COLORS.sinterHot : GAS, 0.3 + 0.5 * p.t);
                bg.moveTo(p.x, py + p.streak);
                bg.lineTo(p.x, py);
            });
            /* Gió TOẢ RA khỏi nắp chụp: tia ngắn bung đều quanh điểm xả. */
            puff.forEach((q) => {
                q.t += q.v * delta;
                if (q.t > 1) q.t = 0;
                const r0 = 11 + 16 * q.t, r1 = r0 + 7;
                const ca = Math.cos(q.a), sa = Math.sin(q.a);
                bg.lineStyle(2, q.t < 0.5 ? COLORS.coolAir : GAS, 0.75 * (1 - q.t));
                bg.moveTo(q.x + ca * r0, blowTopY + sa * r0);
                bg.lineTo(q.x + ca * r1, blowTopY + sa * r1);
            });
        }
        // 2 QUẠT ĐẨY: cánh QUAY liên tục (điểm 3)
        const fg2 = fanRef.current;
        if (fg2) {
            fg2.clear();
            fanPhase.current += 0.16 * delta;
            fans.forEach((fx, fi) => {
                const spin = fanPhase.current * (fi === 0 ? 1 : -1);   // 2 quạt quay ngược nhau
                fg2.lineStyle(0);
                fg2.beginFill(COLORS.machineDark, 0.92);
                for (let k = 0; k < 5; k++) {
                    const a = spin + (k * Math.PI * 2) / 5;
                    fg2.moveTo(fx, manifold.y);
                    fg2.lineTo(fx + Math.cos(a) * 12, manifold.y + Math.sin(a) * 12);
                    fg2.lineTo(fx + Math.cos(a + 0.6) * 12, manifold.y + Math.sin(a + 0.6) * 12);
                    fg2.closePath();
                }
                fg2.endFill();
                fg2.beginFill(COLORS.machineBody);                     // trục
                fg2.drawCircle(fx, manifold.y, 3.5);
                fg2.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={fanRef} />
            <Graphics ref={convRef} />
            <Graphics ref={spineRef} />
            <Graphics ref={intakeRef} />
            <Graphics ref={blowRef} />
        </Container>
    );
};
