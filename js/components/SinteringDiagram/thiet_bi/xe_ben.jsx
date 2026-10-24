/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/xe_ben.jsx — ĐƯỜNG + XE BEN CHỞ QUẶNG SANG LÒ CAO
 * =============================================================================
 * HaulRoad (mặt đường), HaulTrucks (xe ben chạy theo đường).
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef } from 'react';
import { Graphics, useTick, Container } from '@pixi/react';

import { COLORS } from './mau_sac.js';
import { BLACK_SINTER_COLORS } from './con_thoi.jsx';

/* =============================================================================
 * TUYẾN XE BEN CHỞ QUẶNG THIÊU KẾT SANG LÒ CAO
 * Tuyến đường là một ĐƯỜNG GẤP KHÚC (polyline) khai báo bằng danh sách đỉnh:
 *   [ [x0,y0], [x1,y1], ... ]  — điểm ĐẦU là chỗ nhận quặng dưới silo xả,
 *                                điểm CUỐI là hố đổ quặng ở sân lò cao.
 * Tách làm HAI thành phần để xếp lớp cho đúng:
 *   <HaulRoad>   — MẶT ĐƯỜNG, vẽ SỚM nên các băng tải bắc ngang qua vẫn nằm
 *                  trên (giống cầu băng vượt đường trong nhà máy thật).
 *   <HaulTrucks> — ĐOÀN XE, vẽ MUỘN nên luôn nổi trên mọi thứ.
 * Cả hai dùng CHUNG một mảng `points` khai báo trong CFG.
 * ===========================================================================*/

/** Dựng dữ liệu hình học của tuyến: từng đoạn thẳng + hàm tra toạ độ theo
 *  quãng đường s (0 .. tổng chiều dài). */
const buildHaulPath = (points) => {
    const segs = [];
    let total = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const [x1, y1] = points[i];
        const [x2, y2] = points[i + 1];
        const dx = x2 - x1, dy = y2 - y1;
        const len = Math.hypot(dx, dy) || 1;
        segs.push({ x1, y1, ux: dx / len, uy: dy / len, len, ang: Math.atan2(dy, dx) });
        total += len;
    }
    /** Trả về { x, y, ang } tại quãng đường s. */
    const at = (s) => {
        let d = Math.max(0, Math.min(total, s));
        for (const g of segs) {
            if (d <= g.len) return { x: g.x1 + g.ux * d, y: g.y1 + g.uy * d, ang: g.ang };
            d -= g.len;
        }
        const last = segs[segs.length - 1];
        return { x: last.x1 + last.ux * last.len, y: last.y1 + last.uy * last.len, ang: last.ang };
    };
    return { segs, total, at };
};

/* MẶT ĐƯỜNG VẬN CHUYỂN — nền nhựa + lề + vạch tim đường nét đứt. */
export const HaulRoad = ({ points, width = 40 }) => {
    const path = useMemo(() => buildHaulPath(points), [points]);

    const draw = useCallback((g) => {
        g.clear();
        const trace = () => points.forEach(([px, py], i) => (i === 0 ? g.moveTo(px, py) : g.lineTo(px, py)));

        // Lề đường / bó vỉa
        g.lineStyle({ width: width + 7, color: COLORS.machineDark, alpha: 0.42, join: 'round', cap: 'round' });
        trace();
        // Mặt đường
        g.lineStyle({ width, color: COLORS.surfaceLight, alpha: 1, join: 'round', cap: 'round' });
        trace();

        // Vạch tim đường (nét đứt chạy dọc suốt tuyến)
        g.lineStyle(2.4, COLORS.machineDark, 0.42);
        const STEP = 34, DASH = 18;
        for (let s = 12; s < path.total - 12; s += STEP) {
            const a = path.at(s);
            const b = path.at(Math.min(path.total - 4, s + DASH));
            g.moveTo(a.x, a.y);
            g.lineTo(b.x, b.y);
        }
    }, [points, width, path]);

    return <Graphics draw={draw} />;
};

/* ĐOÀN XE BEN — mỗi xe chạy một chu trình khép kín:
     NHẬN QUẶNG (đứng dưới ống xả, thùng đầy dần + hạt quặng rơi vào thùng)
     -> CHỞ ĐẦY sang lò cao
     -> ĐỔ QUẶNG (thùng vơi dần + quặng trào ra sau đuôi xe, xe quay đầu)
     -> CHẠY RỖNG quay về máng quặng.
   Các xe được rải đều pha nên lúc nào trên tuyến cũng có xe đang chạy. */
export const HaulTrucks = ({
    points,
    count = 5,
    speed = 3.2,
    loadFrames = 200,
    dumpFrames = 160,
}) => {
    const path = useMemo(() => buildHaulPath(points), [points]);
    const nodeRefs = useRef([]);
    const oreRefs = useRef([]);

    /* Trạng thái từng xe — rải đều trên toàn chu trình để không xe nào trùng chỗ */
    const fleet = useMemo(() => {
        const run = path.total / speed;
        const cycle = loadFrames + run + dumpFrames + run;
        return Array.from({ length: count }, (_, i) => {
            let t = (i / count) * cycle;
            const st = { phase: 'load', timer: 0, s: 0, load: 0, rot: 0 };
            if (t < loadFrames) {
                st.phase = 'load'; st.timer = t; st.s = 0; st.load = t / loadFrames;
            } else if ((t -= loadFrames) < run) {
                st.phase = 'haul'; st.s = t * speed; st.load = 1;
            } else if ((t -= run) < dumpFrames) {
                st.phase = 'dump'; st.timer = t; st.s = path.total; st.load = 1 - t / dumpFrames;
            } else {
                t -= dumpFrames;
                st.phase = 'back'; st.s = Math.max(0, path.total - t * speed); st.load = 0;
            }
            const p = path.at(st.s);
            st.rot = (st.phase === 'back' || st.phase === 'dump') ? p.ang + Math.PI : p.ang;
            return st;
        });
    }, [path, count, speed, loadFrames, dumpFrames]);

    /* Hạt quặng dùng lại cho cả lúc nhận và lúc đổ (toạ độ CỤC BỘ của xe) */
    const grains = useMemo(() => Array.from({ length: 12 }, () => ({
        t: Math.random(), sp: 0.028 + Math.random() * 0.04,
        off: (Math.random() - 0.5) * 18, sz: 1.5 + Math.random() * 2.3,
        c: BLACK_SINTER_COLORS[Math.floor(Math.random() * BLACK_SINTER_COLORS.length)],
    })), []);

    /* THÂN XE vẽ MỘT LẦN ở hệ toạ độ cục bộ, mũi xe hướng theo trục +x:
       khung gầm -> thùng ben -> ca-bin -> 6 bánh. */
    const drawBody = useCallback((g) => {
        g.clear();
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.machineBody, 1);                 // khung gầm
        g.drawRoundedRect(-30, -13, 56, 26, 4);
        g.endFill();
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.95);              // 6 bánh
        [-22, -8, 18].forEach((wx) => {
            g.drawCircle(wx, -14, 4.6);
            g.drawCircle(wx, 14, 4.6);
        });
        g.endFill();
        g.lineStyle(2, COLORS.machineDark);
        g.beginFill(COLORS.industrialOrange, 0.98);         // thùng ben
        g.drawRect(-28, -12, 34, 24);
        g.endFill();
        g.beginFill(COLORS.steelLight, 1);                  // ca-bin
        g.drawRect(10, -11, 16, 22);
        g.endFill();
        g.lineStyle(1.2, COLORS.machineDark, 0.7);
        g.moveTo(12, -7); g.lineTo(24, -7);
        g.moveTo(12, 7); g.lineTo(24, 7);
    }, []);

    useTick((delta) => {
        fleet.forEach((st, i) => {
            switch (st.phase) {
                case 'load':
                    st.timer += delta;
                    st.load = Math.min(1, st.timer / loadFrames);
                    if (st.timer >= loadFrames) { st.phase = 'haul'; st.timer = 0; st.load = 1; }
                    break;
                case 'haul':
                    st.s += speed * delta;
                    if (st.s >= path.total) { st.s = path.total; st.phase = 'dump'; st.timer = 0; }
                    break;
                case 'dump':
                    st.timer += delta;
                    st.load = Math.max(0, 1 - st.timer / dumpFrames);
                    if (st.timer >= dumpFrames) { st.phase = 'back'; st.timer = 0; st.load = 0; }
                    break;
                default:
                    st.s -= speed * delta;
                    if (st.s <= 0) { st.s = 0; st.phase = 'load'; st.timer = 0; }
            }

            const p = path.at(st.s);
            const node = nodeRefs.current[i];
            if (node) {
                node.x = p.x;
                node.y = p.y;
                // Quay đầu MƯỢT: bám dần về hướng cần đi thay vì lật tức thì
                const target = (st.phase === 'back' || st.phase === 'dump') ? p.ang + Math.PI : p.ang;
                let d = target - st.rot;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                const step = 0.07 * delta;
                st.rot += Math.max(-step, Math.min(step, d));
                node.rotation = st.rot;
            }

            const g = oreRefs.current[i];
            if (!g) return;
            g.clear();
            g.lineStyle(0);

            // Khối quặng trong thùng: cao dần khi nhận, vơi dần khi đổ
            if (st.load > 0.02) {
                const h = 20 * st.load;
                g.beginFill(COLORS.sinterOre, 0.95);
                g.drawRect(-26, -h / 2, 30, h);
                g.endFill();
                g.beginFill(BLACK_SINTER_COLORS[1], 0.85);
                for (let k = 0; k < 5; k++) {
                    g.drawCircle(-24 + k * 6.5, (k % 2 ? -1 : 1) * h * 0.22, 1.6 + (k % 3) * 0.7);
                }
                g.endFill();
            }

            // Hạt quặng rơi vào thùng (nhận) hoặc trào ra sau đuôi (đổ)
            if (st.phase === 'load' || st.phase === 'dump') {
                const pour = st.phase === 'load';
                grains.forEach((q) => {
                    q.t += q.sp * delta;
                    if (q.t > 1) { q.t -= 1; q.off = (Math.random() - 0.5) * 18; }
                    const gx = pour ? -8 + q.off * 0.5 : -30 - q.t * 20;
                    const gy = pour ? -14 + q.t * 22 : q.off * (0.4 + q.t);
                    g.beginFill(q.c, pour ? 0.95 - q.t * 0.25 : 0.9 - q.t * 0.7);
                    g.drawRect(gx - q.sz, gy - q.sz, q.sz * 2, q.sz * 2);
                    g.endFill();
                });
            }
        });
    });

    return (
        <Container>
            {fleet.map((_, i) => (
                <Container
                    key={`haul-truck-${i}`}
                    ref={(el) => { nodeRefs.current[i] = el; }}
                >
                    <Graphics draw={drawBody} />
                    <Graphics ref={(el) => { oreRefs.current[i] = el; }} />
                </Container>
            ))}
        </Container>
    );
};
