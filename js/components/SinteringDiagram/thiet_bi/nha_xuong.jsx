/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/nha_xuong.jsx — NHÀ XƯỞNG THIÊU KẾT: KHUNG + CẤP LIỆU
 * =============================================================================
 * PlantFrame, MaterialSilo, FeederWithRollers (bố liệu + cụm con lăn),
 * MaterialFall (liệu rơi), FrostedFrame / GlassPane (khung kính mờ). Các
 * thiết bị khác của nhà xưởng nằm ở lo_diem_hoa_xe_ghi.jsx, ong_gio.jsx,
 * noi_hoi.jsx, tuan_hoan_khi.jsx, dap_thieu_ket.jsx.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Graphics, useTick, Container, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

import { COLORS } from './mau_sac.js';

/* =============================================================================
 * CONTAINER 5: NHÀ XƯỞNG THIÊU KẾT
 * Gồm: khung nhà xưởng, silo liệu (quặng lót / quặng trộn), bố liệu + con lăn
 * xoay, lò điểm hoả 35 mỏ đốt, dãy xe ghi điểm hoả chạy vòng.
 * Toàn bộ toạ độ nhận qua props (tính sẵn trong pixiStage/buildLayout).
 * ===========================================================================*/

/* Bảng màu hạt QUẶNG TRỘN (nâu) — dùng cho các băng sau máy trộn & băng lên bố liệu */
export const MIXED_ORE_COLORS = [0x5d4037, 0x795548, 0x8d6e63, 0x4e342e];

/* Bảng màu hạt QUẶNG TRẮNG — dùng cho các đoạn băng dưới nhóm silo khoanh vàng */
export const WHITE_ORE_COLORS = [0xffffff, 0xf4f6f7, 0xd5dbdb, 0xfdfefe];

/* Kiểu chữ của khu nhà xưởng: nhãn lớn đỏ (tên nhà xưởng) và nhãn nhỏ (thiết bị) */
const PLANT_TEXT = new PIXI.TextStyle({ fontSize: 17, fill: '#c0392b', fontWeight: 'bold' });
export const SMALL_LABEL = new PIXI.TextStyle({ fontSize: 14, fill: '#2c3e50', fontWeight: 'bold' });

/** Khung nhà xưởng Thiêu Kết (viền đỏ + nền nhạt + nhãn). Vẽ ở lớp DƯỚI CÙNG. */
export const PlantFrame = ({ x, y, width, height, label = 'NHÀ XƯỞNG THIÊU KẾT' }) => {
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, 0xc0392b, 0.9);
        g.beginFill(0xfdf2f0, 0.35);
        g.drawRoundedRect(0, 0, width, height, 10);
        g.endFill();
    }, [width, height]);

    return (
        <Container x={x} y={y}>
            <Graphics draw={draw} />
            <Text text={label} x={14} y={10} style={PLANT_TEXT} />
        </Container>
    );
};

/** Silo liệu hình tròn (top-down) có nhãn — dùng cho Silo quặng lót / quặng trộn. */
export const MaterialSilo = ({ x, y, radius = 26, bodyColor, label, labelBelow = true, labelOffset }) => {
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, COLORS.drumOutline);
        g.beginFill(bodyColor);
        g.drawCircle(0, 0, radius);
        g.endFill();
        // Lỗ xả liệu ở tâm
        g.beginFill(COLORS.ink);
        g.drawCircle(0, 0, radius * 0.33);
        g.endFill();
    }, [radius, bodyColor]);

    return (
        <Container x={x} y={y}>
            <Graphics draw={draw} />
            {label && (
                <Text
                    text={label}
                    x={0}
                    y={labelBelow ? (labelOffset ?? radius + 16) : -(labelOffset ?? radius + 16)}
                    anchor={0.5}
                    style={SMALL_LABEL}
                />
            )}
        </Container>
    );
};

/* --- Vẽ 1 TRỤ ĐỨNG đang quay quanh trục dọc (model bản vẽ tay): thân chữ nhật
   đứng + nắp elip trên/dưới + các vạch dọc chạy ngang theo phase (chỉ vẽ nửa
   mặt trước) tạo cảm giác trụ đang xoay. --- */
export const drawSpinningCylinder = (g, cx, cy, radius, height, phase, fillColor, seams = 6) => {
    const half = height / 2;
    const capRy = Math.max(4, radius * 0.32);   // độ dẹt của nắp elip

    // Thân trụ
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawRect(cx - radius, cy - half, radius * 2, height);
    g.endFill();

    // Vạch quay: đường dọc tại x = R*sin(angle), chỉ hiện khi ở mặt trước (cos > 0)
    g.lineStyle(2, COLORS.drumOutline, 0.75);
    for (let i = 0; i < seams; i++) {
        const a = phase + (i * Math.PI * 2) / seams;
        if (Math.cos(a) <= 0) continue;
        const sx = cx + radius * Math.sin(a);
        g.moveTo(sx, cy - half + 2);
        g.lineTo(sx, cy + half - 2);
    }

    // Nắp elip trên + đáy elip dưới (vẽ sau để đè lên vạch)
    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawEllipse(cx, cy - half, radius, capRy);
    g.endFill();
    g.beginFill(fillColor);
    g.drawEllipse(cx, cy + half, radius, capRy);
    g.endFill();
};

/* --- Vẽ 1 TRỤ NẰM NGANG đang quay quanh trục ngang: thân chữ nhật ngang +
   nắp elip trái/phải + các vạch ngang chạy dọc theo phase (nửa mặt trước). --- */
const drawSpinningCylinderH = (g, cx, cy, radius, length, phase, fillColor, seams = 4) => {
    const half = length / 2;
    const capRx = Math.max(3, radius * 0.4);

    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawRect(cx - half, cy - radius, length, radius * 2);
    g.endFill();

    g.lineStyle(1.5, COLORS.drumOutline, 0.75);
    for (let i = 0; i < seams; i++) {
        const a = phase + (i * Math.PI * 2) / seams;
        if (Math.cos(a) <= 0) continue;
        const sy = cy + radius * Math.sin(a);
        g.moveTo(cx - half + 2, sy);
        g.lineTo(cx + half - 2, sy);
    }

    g.lineStyle(2, COLORS.drumOutline);
    g.beginFill(fillColor);
    g.drawEllipse(cx - half, cy, capRx, radius);
    g.endFill();
    g.beginFill(fillColor);
    g.drawEllipse(cx + half, cy, capRx, radius);
    g.endFill();
};

/**
 * BỐ LIỆU: trống trụ đứng DÀY, dài vắt ngang suốt bề xe ghi; silo liệu hỗn hợp
 * ngồi trên đầu trống. 9 CON LĂN trụ ĐỨNG (cùng phương trống) chia 2 HÀNG
 * (trên 5 / dưới 4) đặt sát giữa lò điểm hoả và trống.
 * @param {object} drum           {x, y, radius, height}
 * @param {array}  rollerClusters [{cx, cy, count}] 2 cụm hàng ngang.
 * @param {object} rollerSize     {radius, height} kích thước mỗi con lăn đứng.
 */
export const FeederWithRollers = ({ drum, rollerClusters, rollerSize, rollersLabel }) => {
    const gRef = useRef(null);
    const phase = useRef(0);

    useTick((delta) => {
        phase.current += 0.05 * delta;
        const g = gRef.current;
        if (!g) return;
        g.clear();

        // 2 HÀNG con lăn TRỤ ĐỨNG (cùng phương với trống bố liệu), xếp ngang
        // trong từng cụm, quay ngược chiều trống để cuốn liệu rải xuống xe
        rollerClusters.forEach((cl, ci) => {
            const stepX = rollerSize.radius * 2 + 2;
            const startX = cl.cx - ((cl.count - 1) * stepX) / 2;
            for (let i = 0; i < cl.count; i++) {
                drawSpinningCylinder(
                    g, startX + i * stepX, cl.cy,
                    rollerSize.radius, rollerSize.height,
                    -phase.current * 1.6 + ci * 0.9 + i * 0.5,
                    COLORS.steelLight, 4
                );
            }
        });

        // Trống bố liệu dài vắt ngang track (đổi dấu phase nếu muốn đảo chiều quay)
        drawSpinningCylinder(g, drum.x, drum.y, drum.radius, drum.height, phase.current, COLORS.drumShell, 8);
    });

    return (
        <Container>
            <Graphics ref={gRef} />
        </Container>
    );
};

/**
 * Dòng liệu nâu ĐỔ XUỐNG XE GHI: đám hạt chảy sang trái trong một vùng hẹp
 * giữa bố liệu và mép phải track, nhạt dần rồi tái sinh — mô phỏng liệu tràn
 * từ bố liệu phủ lên toa xe.
 * @param {object} area {x, yTop, width, height} vùng dòng liệu.
 */
export const MaterialFall = ({ area, colors = MIXED_ORE_COLORS, count = 110 }) => {
    const gRef = useRef(null);
    const particles = useMemo(() => Array.from({ length: count }, () => ({
        px: Math.random() * area.width,
        py: Math.random() * area.height,
        vx: 0.7 + Math.random() * 1.4,
        size: 1 + Math.random() * 2.2,
        color: colors[Math.floor(Math.random() * colors.length)],
    })), [area.width, area.height, colors, count]);

    useTick((delta) => {
        const g = gRef.current;
        if (!g) return;
        g.clear();
        g.lineStyle(0);
        particles.forEach((pt) => {
            pt.px += pt.vx * delta;   // Chảy từ TRÁI sang PHẢI (bố liệu -> con lăn)
            if (pt.px > area.width) { pt.px = 0; pt.py = Math.random() * area.height; }
            const fade = Math.min(1, (area.width - pt.px) / (area.width * 0.35)); // nhạt dần về cuối
            g.beginFill(pt.color, 0.35 + 0.6 * fade);
            g.drawCircle(area.x + pt.px, area.yTop + pt.py, pt.size);
            g.endFill();
        });
    });

    return <Graphics ref={gRef} />;
};

/**
 * KHUNG KÍNH MỜ (frosted glass): rectangle bo tròn, KHÔNG có màu nền, phần view
 * bên trong (xe ghi/liệu chạy dưới) bị LÀM MỜ như nhìn qua kính mờ. Dùng chồng
 * lên vùng cần "che mờ" — nội dung bên dưới do component này tự bọc & làm mờ.
 * @param {object}  frame {x,y,width,height}
 * @param {node}    children  nội dung được đặt DƯỚI lớp kính (sẽ bị làm mờ)
 * @param {number}  blur  độ mờ (px)
 */
export const FrostedFrame = ({ frame, children, blur = 4 }) => {
    const [clip, setClip] = useState(null);
    const { x, y, width, height } = frame;

    const drawClip = useCallback((g) => {
        g.clear();
        g.beginFill(COLORS.white);
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
    }, [x, y, width, height]);

    const drawGlass = useCallback((g) => {
        g.clear();
        // Lớp kính mờ: phủ trắng rất nhạt (sương) + viền bo tròn, KHÔNG che hẳn.
        g.lineStyle(3, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.white, 0.28);                    // màng sương -> giảm "độ phân giải"
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
        // vệt loé kính chéo cho giống mặt kính
        g.lineStyle(0);
        g.beginFill(COLORS.white, 0.12);
        g.moveTo(x + width * 0.12, y);
        g.lineTo(x + width * 0.30, y);
        g.lineTo(x + width * 0.12, y + height);
        g.lineTo(x, y + height);
        g.lineTo(x, y + height * 0.5);
        g.closePath();
        g.endFill();
    }, [x, y, width, height]);

    // Filter blur (nếu môi trường Pixi hỗ trợ) -> làm mờ thật phần bên dưới.
    const blurFilter = useMemo(() => {
        try { return [new PIXI.BlurFilter(blur, 2)]; } catch { return null; }
    }, [blur]);

    return (
        <Container>
            {clip && (
                <Container mask={clip} filters={blurFilter}>
                    {children}
                </Container>
            )}
            <Graphics draw={drawClip} ref={setClip} />
            <Graphics draw={drawGlass} />
        </Container>
    );
};

/**
 * TẤM KÍNH MỜ phủ lên 1 vùng (chỉ lớp kính, không bọc nội dung): rectangle bo
 * tròn, KHÔNG màu nền, phủ màng sương trắng nhạt làm "mờ độ phân giải" phần nhìn
 * thấy bên dưới (xe ghi/con lăn vẫn chạy, chỉ mờ đi) + viền + vệt loé kính chéo.
 * Dùng cho vùng khoanh cam (xe ghi) và khoanh tím (con lăn/nghiền cuối máy).
 * @param {object} frame {x,y,width,height}
 */
export const GlassPane = ({ frame }) => {
    const { x, y, width, height } = frame;
    const draw = useCallback((g) => {
        g.clear();
        g.lineStyle(3, COLORS.borderGray, 0.9);
        g.beginFill(COLORS.white, 0.30);                    // màng sương -> mờ view bên dưới
        g.drawRoundedRect(x, y, width, height, 12);
        g.endFill();
        g.lineStyle(0);                                      // vệt loé kính chéo
        g.beginFill(COLORS.white, 0.13);
        g.moveTo(x + width * 0.14, y);
        g.lineTo(x + width * 0.32, y);
        g.lineTo(x + width * 0.14, y + height);
        g.lineTo(x, y + height);
        g.lineTo(x, y + height * 0.5);
        g.closePath();
        g.endFill();
        g.beginFill(COLORS.white, 0.10);
        g.moveTo(x + width * 0.55, y);
        g.lineTo(x + width * 0.66, y);
        g.lineTo(x + width * 0.50, y + height);
        g.lineTo(x + width * 0.39, y + height);
        g.closePath();
        g.endFill();
    }, [x, y, width, height]);
    return <Graphics draw={draw} />;
};
