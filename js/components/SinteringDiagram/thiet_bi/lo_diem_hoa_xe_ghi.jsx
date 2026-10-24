/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/lo_diem_hoa_xe_ghi.jsx — LÒ ĐIỂM HOẢ + XE GHI
 * =============================================================================
 * IgnitionFurnace (lò điểm hoả, rèm lửa), PalletCarTrack (dãy xe ghi chạy
 * vòng), TrackSuction (vệt gió hút trên mặt xe ghi), DriveMotor (động cơ đẩy
 * xe ghi).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS, lerpColor } from './mau_sac.js';

/**
 * Lò điểm hoả: khung lò (nền mờ để thấy xe ghi chạy bên dưới) + các cột mỏ đốt
 * phun NGỌN LỬA XUỐNG (rèm lửa). columns = [{x, count}] — cột đầu là "hàng 1" gần bố liệu.
 * @param {object} frame   {x, y, width, height}
 * @param {array}  columns [{x, count}] toạ độ x tuyệt đối từng cột + số mỏ.
 * @param {number} yTop, yBottom  Dải Y trải đều mỏ đốt.
 */
export const IgnitionFurnace = ({ frame, columns, yTop, yBottom }) => {
    const gRef = useRef(null);
    const [flameMask, setFlameMask] = useState(null);

    /* Mặt nạ = đúng lòng khung lò: ngọn lửa dài tới đâu cũng bị cắt gọn tại
       thành lò, không lòi ra ngoài khung. */
    const drawFlameMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRoundedRect(frame.x, frame.y, frame.width, frame.height, 8);
        g.endFill();
    }, [frame.x, frame.y, frame.width, frame.height]);

    useTick(() => {
        const g = gRef.current;
        if (!g) return;
        const now = Date.now() / 1000;
        g.clear();

        /* Mỗi mỏ đốt PHUN NGỌN LỬA XUỐNG (3 lớp: quầng cam ngoài - thân đỏ -
           lõi vàng sáng), chiều dài ngọn nhấp nhô + đuôi lửa lắc nhẹ theo pha
           riêng từng mỏ -> các ngọn nối nhau thành rèm lửa như lò thật. */
        const drawFlame = (x, y, len, w, sway) => {
            const layers = [
                [w,        len,        0xe67e22, 0.40],  // quầng ngoài
                [w * 0.62, len * 0.74, 0xe74c3c, 0.78],  // thân lửa
                [w * 0.36, len * 0.46, 0xf9e79f, 0.95],  // lõi sáng
            ];
            for (const [lw, ll, color, alpha] of layers) {
                g.lineStyle(0);
                g.beginFill(color, alpha);
                g.moveTo(x - lw, y);
                g.quadraticCurveTo(x - lw, y + ll * 0.55, x + sway, y + ll);
                g.quadraticCurveTo(x + lw, y + ll * 0.55, x + lw, y);
                g.closePath();
                g.endFill();
            }
        };

        columns.forEach((col, ci) => {
            const gap = (yBottom - yTop) / (col.count - 1);
            for (let i = 0; i < col.count; i++) {
                const y = yTop + i * gap;
                const phase = ci * 1.7 + i * 0.6;
                const len = 45 + 15 * Math.sin(now * 6 + phase);         // ngọn nhấp nhô (to 5x)
                const sway = 5 * Math.sin(now * 9 + phase * 1.3);        // đuôi lắc
                drawFlame(col.x, y - 2, len, 24, sway);
                // Đầu mỏ đốt (chấm thép nhỏ phía trên ngọn lửa)
                g.lineStyle(0);
                g.beginFill(COLORS.drumOutline, 0.9);
                g.drawCircle(col.x, y - 3, 2.4);
                g.endFill();
            }
        });
    });

    const drawFrame = useCallback((g) => {
        g.clear();
        // Khung lò gốc (ĐÃ BỎ lớp kính mờ theo yêu cầu): nền mờ nhạt vừa đủ để
        // vẫn thấy xe ghi chạy phía dưới.
        g.lineStyle(3, COLORS.drumOutline);
        g.beginFill(0x34495e, 0.18);
        g.drawRoundedRect(frame.x, frame.y, frame.width, frame.height, 8);
        g.endFill();
    }, [frame.x, frame.y, frame.width, frame.height]);

    return (
        <Container>
            <Graphics draw={drawFrame} />
            <Graphics draw={drawFlameMask} ref={setFlameMask} />
            {flameMask && (
                <Container mask={flameMask}>
                    <Graphics ref={gRef} />
                </Container>
            )}
        </Container>
    );
};

/**
 * Dãy xe ghi điểm hoả thiêu kết chạy sang TRÁI liên tục (vòng lặp vô tận).
 * Model theo bản vẽ tay: mỗi toa là khung chữ nhật ĐỨNG cao vừa lòng khung lò
 * điểm hoả, bên trong là các THANH GHI xếp chéo dày, 2 đầu toa có mấu nối.
 * Màu nền liệu trên thanh ghi đổi theo hành trình: trống (chưa rải) -> nâu
 * (sau bố liệu) -> rực lửa (trong lò, nhấp nháy) -> nguội sẫm dần về cuối máy.
 * Toàn dãy được cắt (mask) gọn tại 2 mép track: toa vào/ra biên mượt, không lòi.
 * @param {object} track {xLeft, xRight, yTop, height, carWidth, gap, speed}
 * @param {object} zones {feederX, furnaceLeft, furnaceRight} mốc đổi màu liệu.
 */
export const PalletCarTrack = ({ track, zones, labelDy = 14 }) => {
    const gRef = useRef(null);
    const [maskG, setMaskG] = useState(null);
    const offset = useRef(0);

    const { xLeft, xRight, yTop, height, carWidth, gap, speed } = track;
    const step = carWidth + gap;
    const trackLen = xRight - xLeft;

    /* 2 TRỤC QUAY tại đầu và cuối đường xe (nơi toa vòng 180° xuống đường hồi) */
    const drawTurnAxles = useCallback((g) => {
        g.clear();
        [xRight].forEach((ax) => {  // trục trái đã thay bằng máy nghiền trục đơn
            g.lineStyle(2, COLORS.drumOutline);
            g.beginFill(COLORS.machineBody);
            g.drawRoundedRect(ax - 5, yTop - 9, 10, height + 18, 5);
            g.endFill();
            g.beginFill(COLORS.steelLight);
            g.drawCircle(ax, yTop - 3, 3);
            g.drawCircle(ax, yTop + height + 3, 3);
            g.endFill();
        });
    }, [xLeft, xRight, yTop, height]);

    /* Mặt nạ vùng track: toa bị cắt gọn tại 2 mép thay vì lòi ra rồi biến mất */
    const drawTrackMask = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRect(xLeft, yTop - 6, trackLen, height + 12); // +6 mỗi phía cho mấu nối
        g.endFill();
    }, [xLeft, yTop, trackLen, height]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;

        // Cuộn sang trái, lặp theo chu kỳ 1 bước toa
        offset.current = (offset.current + speed * delta) % step;
        const now = Date.now() / 1000;

        g.clear();
        const carCount = Math.ceil(trackLen / step) + 2;

        for (let i = 0; i < carCount; i++) {
            const x = xRight + step - offset.current - i * step; // dư 1 toa mỗi đầu, mask sẽ cắt
            if (x + carWidth < xLeft - step || x > xRight + step) continue;
            const cx = x + carWidth / 2;

            /* --- HIỆU ỨNG VÒNG 180° TẠI 2 MÉP BIÊN: xe chạy hết đường thì cuốn
               quanh trục quay xuống đường hồi bên dưới -> toa NÉN BỀ NGANG dần
               (hình chiếu khi lật qua mép cong) và MỜ DẦN rồi biến mất. --- */
            const TURN = 26;
            let squeeze = 1, fade = 1;
            if (cx > xRight - TURN) {
                const t = Math.min(1, (cx - (xRight - TURN)) / TURN);
                squeeze = Math.cos((t * Math.PI) / 2);
                fade = 1 - t * 0.65;
            } else if (cx < xLeft + TURN) {
                const t = Math.min(1, ((xLeft + TURN) - cx) / TURN);
                squeeze = Math.cos((t * Math.PI) / 2);
                fade = 1 - t * 0.65;
            }
            const w2 = Math.max(3, carWidth * squeeze);
            const x2 = cx - w2 / 2;

            // --- Màu nền liệu theo vị trí tâm toa (đúng trình tự yêu cầu):
            //     vàng (trước silo lót) -> ĐEN (qua silo lót) -> NÂU (tới con lăn
            //     nhận liệu từ bố liệu) -> CAM/ĐỎ rực (trong lò) -> nguội sẫm. ---
            let fill = COLORS.palletBody; // Toa trống: vàng
            const band = zones.linerBand ?? 45;
            if (zones.linerX !== undefined && cx <= zones.linerX && cx > zones.linerX - band) {
                fill = COLORS.linerBlack;                                   // Dải NGẮN qua silo lót: màu ĐEN
            } else if (cx <= (zones.linerX !== undefined ? zones.linerX - band : zones.feederX) && cx > zones.furnaceRight) {
                fill = COLORS.mixedOre;                                   // Từ sau dải đen tới lò: NÂU
            } else if (cx <= zones.furnaceRight && cx > zones.furnaceLeft) {
                const t = (Math.sin(now * 7 + cx * 0.08) + 1) / 2; // Trong lò: cam/đỏ rực
                fill = lerpColor(COLORS.sinterHot, COLORS.sinterFire, t);
            } else if (cx <= zones.furnaceLeft) {
                const t = Math.min(1, (zones.furnaceLeft - cx) / (zones.furnaceLeft - xLeft));
                fill = lerpColor(COLORS.sinterFire, COLORS.sinterCool, t);           // Nguội sẫm dần
            }

            // --- Mấu nối 2 đầu toa (trên + dưới) ---
            g.lineStyle(0);
            g.beginFill(COLORS.machineDark, fade);
            g.drawRect(x2 + 2, yTop - 6, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + w2 - 9, yTop - 6, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + 2, yTop + height, Math.min(7, w2 * 0.25), 6);
            g.drawRect(x2 + w2 - 9, yTop + height, Math.min(7, w2 * 0.25), 6);
            g.endFill();

            // --- Khung toa + nền liệu (nén ngang + mờ theo mép biên) ---
            g.lineStyle(2, COLORS.machineDark, fade);
            g.beginFill(fill, 0.95 * fade);
            g.drawRect(x2, yTop, w2, height);
            g.endFill();

            // --- Các THANH GHI xếp chéo dày bên trong toa ---
            g.lineStyle(1.5, COLORS.machineDark, 0.55 * fade);
            const barGap = 9;
            for (let by = yTop + 4; by < yTop + height - 4; by += barGap) {
                g.moveTo(x2 + 3, by + 5);
                g.lineTo(x2 + w2 - 3, by);
            }
        }
    });

    return (
        <Container>
            <Graphics draw={drawTrackMask} ref={setMaskG} />
            {maskG && (
                <Container mask={maskG}>
                    <Graphics ref={gRef} />
                </Container>
            )}
            <Graphics draw={drawTurnAxles} />
        </Container>
    );
};



/**
 * HIỆU ỨNG HÚT GIÓ TRÊN MẶT XE GHI: các vệt gió/bụi dọc mờ (style giống bụi
 * trong 2 ống gió tổng) chảy từ TÂM dãy xe ra 2 BÊN HÔNG — thể hiện gió bị hút
 * qua lớp liệu xuống các phễu ống gió 2 bên.
 * @param {object} area {xStart, xEnd, yTop, height} vùng dãy xe có phễu hút.
 */
export const TrackSuction = ({ area, count = 72 }) => {
    const gRef = useRef(null);
    const mid = area.yTop + area.height / 2;

    const flows = useMemo(() => Array.from({ length: count }, () => ({
        px: area.xStart + Math.random() * (area.xEnd - area.xStart),
        py: mid + (Math.random() - 0.5) * 30,
        dir: Math.random() < 0.5 ? -1 : 1,                 // lên mép trên / xuống mép dưới
        vy: 0.5 + Math.random() * 0.7,
        streak: 4 + Math.random() * 4,
        color: [COLORS.dustLight, COLORS.dustGray][Math.floor(Math.random() * 2)],
    })), [area.xStart, area.xEnd, mid, count]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        flows.forEach((w) => {
            w.py += w.dir * w.vy * delta;
            const outTop = w.py < area.yTop + 5;
            const outBot = w.py > area.yTop + area.height - 5;
            if (outTop || outBot) {
                w.px = area.xStart + Math.random() * (area.xEnd - area.xStart);
                w.py = mid + (Math.random() - 0.5) * 30;
                w.dir = Math.random() < 0.5 ? -1 : 1;
            }
            // Vệt dọc mờ theo chiều bị hút (đậm dần nhẹ khi gần mép — gió mạnh gần phễu)
            const t = Math.abs(w.py - mid) / (area.height / 2);
            g.lineStyle(1.3, w.color, 0.14 + 0.16 * t);
            g.moveTo(w.px, w.py - w.dir * w.streak);
            g.lineTo(w.px, w.py);
        });
    });

    return <Graphics ref={gRef} />;
};

/**
 * ĐỘNG CƠ ĐẨY XE GHI: hộp motor có khe tản nhiệt + puly quay + dây đai truyền
 * xuống cổ trục quay đầu máy.
 * @param {object} motor {x, y} tâm thân motor.
 * @param {object} axle  {x, y} cổ trục quay nhận truyền động.
 */
export const DriveMotor = ({ motor, axle }) => {
    const gRef = useRef(null);
    const phase = useRef(0);
    const pulley = { x: motor.x + 33, y: motor.y };

    const drawBody = useCallback((g) => {
        g.clear();
        // Chân đế
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark);
        g.drawRect(motor.x - 22, motor.y + 14, 12, 5);
        g.drawRect(motor.x + 10, motor.y + 14, 12, 5);
        g.endFill();
        // Thân motor + khe tản nhiệt
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.machineBody);
        g.drawRoundedRect(motor.x - 26, motor.y - 15, 52, 30, 6);
        g.endFill();
        g.lineStyle(1.5, COLORS.machineDark, 0.9);
        for (let fx = motor.x - 18; fx <= motor.x + 18; fx += 7) {
            g.moveTo(fx, motor.y - 10);
            g.lineTo(fx, motor.y + 10);
        }
        // Dây đai truyền xuống cổ trục quay
        g.lineStyle(2.5, COLORS.machineDark, 0.85);
        g.moveTo(pulley.x - 8, pulley.y + 3);
        g.lineTo(axle.x - 4, axle.y);
        g.moveTo(pulley.x + 8, pulley.y + 3);
        g.lineTo(axle.x + 4, axle.y);
    }, [motor.x, motor.y, axle.x, axle.y]);

    useTick((delta) => {
        phase.current += 0.11 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();
        // Puly quay (vòng + 2 vạch đường kính xoay)
        g.lineStyle(2, COLORS.drumOutline);
        g.beginFill(COLORS.steelLight);
        g.drawCircle(pulley.x, pulley.y, 9);
        g.endFill();
        g.lineStyle(2, COLORS.drumOutline, 0.85);
        for (let k = 0; k < 2; k++) {
            const a = phase.current + (k * Math.PI) / 2;
            g.moveTo(pulley.x - Math.cos(a) * 9, pulley.y - Math.sin(a) * 9);
            g.lineTo(pulley.x + Math.cos(a) * 9, pulley.y + Math.sin(a) * 9);
        }
    });

    return (
        <Container>
            <Graphics draw={drawBody} />
            <Graphics ref={gRef} />
        </Container>
    );
};
