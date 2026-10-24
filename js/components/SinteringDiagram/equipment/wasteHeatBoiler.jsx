/* =============================================================================
 * js/components/SinteringDiagram/equipment/wasteHeatBoiler.jsx — NỒI HƠI NHIỆT DƯ
 * =============================================================================
 * WasteHeatBoiler: nồi hơi 20 MW tận dụng khí nóng của máy làm mát vòng.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục equipment/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở stageConfig.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './colors.js';

/**
 * NỒI HƠI NHIỆT DƯ 20 MW — tận dụng khí nóng thoát ra ở 3 ĐOẠN (sector) ĐẦU
 * của máy làm mát vòng, ngay sau khi liệu nóng vừa xả xuống (cung còn đỏ lửa).
 *   • 3 chụp hút úp trên cung nóng của vành -> ống góp ngang -> thân nồi hơi.
 *   • Thân nồi: dàn ống trao đổi nhiệt + 2 góp + bao hơi (steam drum) nằm trên,
 *     quy mô vẽ tương xứng công suất 20 MW.
 *   • Khí NÓNG (đỏ/cam) chảy từ chụp về nồi; hơi nước trắng bốc lên bao hơi.
 * Vẽ SAU cùng (đè lên vành + ống gió) theo yêu cầu "đường ống nằm trên".
 * @param {array}  hoods       [{x,y}] tâm 3 chụp hút trên cung nóng của vành.
 * @param {number} collectorY  cao độ ống góp ngang gom khí về nồi.
 * @param {object} boiler      {x,y,w,h} khung thân nồi hơi.
 */
export const WasteHeatBoiler = ({ hoods, collectorY, boiler, lowerCollectorY, riserX, arcDuct }) => {
    const flowRef = useRef(null);
    const steamRef = useRef(null);

    const cLeftX = useMemo(() => Math.min(...hoods.map((h) => h.x)), [hoods]);
    const midInX = boiler.x + boiler.w / 2;

    /* TUYẾN KHÍ NÓNG của 1 chụp, mô tả bằng ĐƯỜNG GẤP KHÚC. Cả phần VẼ ống lẫn
       phần CHẠY vệt khí đều đọc từ đây nên không bao giờ lệch nhau.

       - Nếu có lowerCollectorY (3 chụp nằm ở CUNG DƯỚI vành làm mát):
           chụp -> cuống ĐI XUỐNG ống góp dưới -> chạy NGANG sang ống đứng ở
           riserX -> LEO LÊN ống góp trên (collectorY) -> chạy NGANG vào giữa
           nồi -> cắm xuống thân nồi.
       - Nếu không (bố trí cũ, chụp ở cung trên): chụp -> lên thẳng ống góp trên
         -> ngang vào nồi. */
    /* --- Kiểu ỐNG GÓP CUNG (arcDuct) ---------------------------------------
       Thay ống góp thẳng + ống đứng bằng MỘT ỐNG CONG chạy vòng theo dải vành
       làm mát, xâu qua đúng 3 chụp hút (cùng bán kính r), rồi từ đầu trên của
       cung leo thẳng lên ống góp trên và vào nồi. Đây chính là kiểu hood cong
       ôm cung nóng của máy làm mát vòng ngoài thực tế. */
    const arcPt = (deg) => {
        const a = (deg * Math.PI) / 180;
        return [arcDuct.cx + arcDuct.r * Math.cos(a), arcDuct.cy + arcDuct.r * Math.sin(a)];
    };
    const hoodDeg = (h) => (Math.atan2(h.y - arcDuct.cy, h.x - arcDuct.cx) * 180) / Math.PI;

    const hoodPath = (h) => {
        if (arcDuct) {
            /* chụp -> chạy DỌC CUNG ngược về đầu trên -> leo ống đứng -> vào nồi */
            const d0 = hoodDeg(h);
            const pts = [];
            const step = (arcDuct.from - d0) / 12;
            for (let i = 0; i <= 12; i++) pts.push(arcPt(d0 + step * i));
            const [sx] = arcPt(arcDuct.from);
            pts.push([sx, collectorY], [midInX, collectorY], [midInX, boiler.y]);
            return pts;
        }
        return lowerCollectorY != null && riserX != null
            ? [[h.x, h.y], [h.x, lowerCollectorY], [riserX, lowerCollectorY],
               [riserX, collectorY], [midInX, collectorY], [midInX, boiler.y]]
            : [[h.x, h.y], [h.x, collectorY], [midInX, collectorY], [midInX, boiler.y]];
    };

    /* Nội suy điểm ở tỉ lệ t (0..1) dọc chiều dài thật của đường gấp khúc. */
    const pathPoint = (h, t) => {
        const pts = hoodPath(h);
        const segLen = [];
        let total = 0;
        for (let i = 1; i < pts.length; i++) {
            const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
            segLen.push(l); total += l;
        }
        if (total <= 0) return pts[0];
        let d = t * total;
        for (let i = 0; i < segLen.length; i++) {
            if (d <= segLen[i] || i === segLen.length - 1) {
                const k = segLen[i] > 0 ? d / segLen[i] : 0;
                return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
                        pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
            }
            d -= segLen[i];
        }
        return pts[pts.length - 1];
    };

    const streaks = useMemo(() => {
        const arr = [];
        hoods.forEach((_, hi) => {
            for (let k = 0; k < 6; k++)
                arr.push({ hi, t: (k / 6 + Math.random() * 0.12) % 1,
                           v: 0.006 + Math.random() * 0.006, warm: Math.random() });
        });
        return arr;
    }, [hoods]);

    const steam = useMemo(() => Array.from({ length: 18 }, () => ({
        x: Math.random(), y: Math.random(), vy: 0.4 + Math.random() * 0.5, r: 3 + Math.random() * 4,
    })), []);

    const drawStruct = useCallback((g) => {
        g.clear();
        const { x, y, w, h } = boiler;

        /* --- ỐNG GÓP NGANG (gom khí nóng từ 3 chụp) -> vào GIỮA thân nồi (điểm 2) ---
           Chạy dưới quạt làm mát 296° (quạt lộ hẳn), băng ngang qua sườn trái tới
           GIỮA nồi rồi cắm vào (đầu vào nằm chính giữa hệ nồi, không còn ở mép). */
        g.lineStyle(2.5, COLORS.machineDark);

        /* ỐNG GÓP TRÊN: nếu 3 chụp nằm ở cung DƯỚI thì ống góp trên chỉ chạy từ
           ống đứng (riserX) vào giữa nồi; nếu bố trí cũ thì chạy từ chụp trái nhất. */
        const arcStartX = arcDuct ? arcPt(arcDuct.from)[0] : null;
        const upFromX = arcDuct ? arcStartX
            : (lowerCollectorY != null && riserX != null) ? riserX : cLeftX;
        g.beginFill(COLORS.ductBody, 0.96);
        g.drawRoundedRect(upFromX - 10, collectorY - 10, (midInX + 10) - (upFromX - 10), 20, 10);
        g.endFill();

        /* --- ỐNG GÓP CUNG: ống cong ôm dải vành, xâu qua 3 chụp hút --- */
        if (arcDuct) {
            const { cx, cy, r, from, to } = arcDuct;
            const W = arcDuct.width ?? 20;
            const rad = (d) => (d * Math.PI) / 180;
            const [sx, sy] = arcPt(from);
            const [ex, ey] = arcPt(to);

            // đoạn ĐỨNG nối đầu trên của cung lên ống góp trên
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(sx - W / 2, collectorY - 10, W, (sy + W / 2) - (collectorY - 10), W / 2);
            g.endFill();

            // thân ống cong: vẽ viền đậm trước rồi lồng ruột sáng lên trên
            g.lineStyle(W + 5, COLORS.machineDark, 1);
            g.moveTo(sx, sy); g.arc(cx, cy, r, rad(from), rad(to));
            g.lineStyle(W, COLORS.ductBody, 0.96);
            g.moveTo(sx, sy); g.arc(cx, cy, r, rad(from), rad(to));

            // nắp bịt đầu dưới của cung
            g.lineStyle(2.5, COLORS.machineDark);
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawCircle(ex, ey, W / 2 + 1);
            g.endFill();
            g.lineStyle(2.5, COLORS.machineDark);
        }

        /* --- BỐ TRÍ MỚI: ống góp DƯỚI + ống ĐỨNG men sườn phải vành làm mát --- */
        if (lowerCollectorY != null && riserX != null) {
            const lowFromX = Math.min(cLeftX, riserX) - 10;
            const lowToX = Math.max(...hoods.map((h) => h.x), riserX) + 10;
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(lowFromX, lowerCollectorY - 10, lowToX - lowFromX, 20, 10);   // ống góp dưới
            g.endFill();
            g.beginFill(COLORS.ductBody, 0.96);
            g.drawRoundedRect(riserX - 10, collectorY - 10,                                  // ống đứng nối 2 ống góp
                              20, (lowerCollectorY + 10) - (collectorY - 10), 10);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, 0.8);                                            // 2 mặt bích ở 2 đầu ống đứng
            g.drawRect(riserX - 13, collectorY - 3, 26, 5);
            g.drawRect(riserX - 13, lowerCollectorY - 2, 26, 5);
            g.endFill();
            g.lineStyle(2.5, COLORS.machineDark);
        }
        // cổ nối vào giữa nồi (chạm mặt trên thân nồi tại tâm)
        g.beginFill(COLORS.ductBody, 0.96);
        g.drawRoundedRect(midInX - 10, collectorY - 10, 20, (y + 6) - (collectorY - 10), 6);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.85);                        // mặt bích tại điểm cắm giữa nồi
        g.drawRect(midInX - 13, y - 3, 26, 5);
        g.endFill();

        /* --- 3 CHỤP HÚT trên cung nóng: cuống nối lên ống góp + NẮP TRÒN vẽ SAU
           để nắp luôn nổi trên ống góp, không bị ống trùm mất. --- */
        hoods.forEach((hd) => {
            const capR = 13;
            /* Cuống nối chụp lên ống góp: bố trí MỚI thì chụp nằm ở cung DƯỚI
               nên cuống chạy XUỐNG ống góp dưới (mốc lowerCollectorY), bố trí cũ
               thì chạy LÊN ống góp trên. */
            g.lineStyle(2, COLORS.machineDark);
            /* Kiểu ống góp CUNG thì 3 chụp nằm NGAY TRÊN thân ống cong -> không
               cần cuống nối; các kiểu khác mới vẽ cuống chạy về ống góp. */
            if (!arcDuct) {
                const stemTo = (lowerCollectorY != null && riserX != null) ? lowerCollectorY : collectorY;
                const s0 = Math.min(stemTo, hd.y - capR);
                const s1 = Math.max(stemTo, hd.y + capR);
                g.beginFill(COLORS.ductBody, 0.96);
                if (s1 - s0 > 1) g.drawRect(hd.x - 6, s0, 12, s1 - s0);        // cuống
                g.endFill();
            }
            g.beginFill(COLORS.dustLight, 0.96);                                // NẮP CHỤP TRÒN
            g.drawCircle(hd.x, hd.y, capR);
            g.endFill();
            g.lineStyle(0);
            g.beginFill(COLORS.sinterFire, 0.3);                               // tâm nắp ám đỏ (khí nóng)
            g.drawCircle(hd.x, hd.y, capR * 0.5);
            g.endFill();
        });

        /* --- THÂN NỒI HƠI --- */
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.steelLight, 0.98);
        g.drawRoundedRect(x, y, w, h, 8);                              // bao nước / casing
        g.endFill();
        g.beginFill(COLORS.machineBody);                              // 2 góp ống trên/dưới
        g.drawRoundedRect(x + 12, y + 10, w - 24, 9, 4);
        g.drawRoundedRect(x + 12, y + h - 19, w - 24, 9, 4);
        g.endFill();
        g.lineStyle(3, COLORS.borderGray, 0.9);                       // dàn ống trao đổi nhiệt
        const tubeN = Math.max(7, Math.round(w / 26));
        for (let i = 0; i < tubeN; i++) {
            const tx = x + 18 + (w - 36) * (i / (tubeN - 1));
            g.moveTo(tx, y + 17);
            g.lineTo(tx, y + h - 17);
        }
        // BAO HƠI (steam drum) nằm NGAY GIỮA TRONG thân nồi (điểm 3)
        const dr = 15, dcx = x + w / 2, dcy = y + h / 2;
        g.lineStyle(3, COLORS.machineDark);
        g.beginFill(COLORS.drumShell);
        g.drawRoundedRect(dcx - w * 0.33, dcy - dr, w * 0.66, dr * 2, dr);
        g.endFill();
        g.lineStyle(0);                                               // 2 cửa hơi 2 đầu bao hơi
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(dcx - w * 0.33 - 7, dcy - 5, 8, 10, 2);
        g.drawRoundedRect(dcx + w * 0.33 - 1, dcy - 5, 8, 10, 2);
        g.endFill();

        /* --- MŨI TÊN hướng khí nóng chảy về nồi (trên ống góp + đoạn rẽ xuống) --- */
        g.beginFill(COLORS.statusBad, 0.85);
        for (let ax = cLeftX + 40; ax < midInX - 16; ax += 74) {
            g.moveTo(ax, collectorY - 6);
            g.lineTo(ax + 12, collectorY);
            g.lineTo(ax, collectorY + 6);
            g.closePath();
        }
        g.endFill();
    }, [hoods, collectorY, boiler, cLeftX, midInX, lowerCollectorY, riserX, arcDuct]);

    useTick((delta) => {
        const g = flowRef.current;
        if (g) {
            g.clear();
            streaks.forEach((s) => {
                s.t += s.v * delta;
                if (s.t > 1) s.t -= 1;
                const [px, py] = pathPoint(hoods[s.hi], s.t);
                const [qx, qy] = pathPoint(hoods[s.hi], Math.max(0, s.t - 0.03));
                g.lineStyle(1.8, s.warm > 0.5 ? COLORS.sinterFire : COLORS.sinterHot, 0.6);
                g.moveTo(qx, qy);
                g.lineTo(px, py);
            });
        }
        const sg = steamRef.current;
        if (sg) {
            sg.clear();
            const { x, y, w } = boiler;
            const topcx = x + w / 2, topY = y - 36;
            steam.forEach((p) => {
                p.y -= p.vy * delta * 0.4;
                if (p.y < -1.2) { p.y = 0; p.x = Math.random(); }
                sg.lineStyle(0);
                sg.beginFill(COLORS.white, 0.18 * Math.max(0, 1 - Math.abs(p.y)));
                sg.drawCircle(topcx + (p.x - 0.5) * 30, topY + p.y * 34, p.r);
                sg.endFill();
            });
        }
    });

    return (
        <Container>
            <Graphics draw={drawStruct} />
            <Graphics ref={flowRef} />
            <Graphics ref={steamRef} />
        </Container>
    );
};
