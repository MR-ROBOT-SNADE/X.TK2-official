/* =============================================================================
 * js/components/SinteringDiagram/thiet_bi/logo.jsx — KHUNG LOGO
 * =============================================================================
 * LogoPlate: chỗ dành sẵn để nạp ảnh logo.
 *
 * Một phần "kho linh kiện" của sơ đồ công nghệ (thư mục thiet_bi/, trước
 * 24/10/2026 nằm chung trong diagramContainer.jsx — nay file đó là MỤC LỤC).
 * Vị trí / kích thước truyền vào qua props; bố cục ở cau_hinh.js (CFG).
 * ===========================================================================*/

import React, { useCallback, useEffect, useState } from 'react';
import { Graphics, Container, Sprite, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

import { COLORS } from './mau_sac.js';

/* =============================================================================
 * KHUNG LOGO — chỗ dành sẵn để nạp ảnh logo vào sau
 * Có ảnh  -> hiện ảnh, không viền không nền.
 * Chưa có -> hiện KHUNG CHỜ nét đứt kèm nhãn, để nhìn thấy ngay vị trí và cỡ.
 * Việc dò ảnh làm bằng thẻ Image của trình duyệt: nạp được thì mới vẽ Sprite,
 * nhờ vậy file thiếu KHÔNG làm Pixi văng lỗi hay để lại ô đen.
 * ===========================================================================*/
export const LogoPlate = ({ src, x, y, width, height, label = 'LOGO' }) => {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        setReady(false);
        /* Chặn nơi KHÔNG có trình duyệt (render phía máy chủ, môi trường kiểm
           thử...): thiếu chốt này là văng "Image is not defined" và hỏng cả
           sơ đồ. Ở đó cứ hiện khung chờ, không dò ảnh. */
        if (!src || typeof window === 'undefined' || typeof window.Image !== 'function') return undefined;
        let alive = true;
        const probe = new window.Image();
        probe.onload = () => { if (alive) setReady(true); };
        probe.onerror = () => {
            if (!alive) return;
            console.warn(`[Sơ đồ công nghệ] Chưa có ảnh logo: ${src} — `
                + 'đang hiện khung chờ. Bỏ file vào đúng đường dẫn này là tự hiện.');
        };
        probe.src = src;
        return () => { alive = false; };
    }, [src]);

    const drawFrame = useCallback((g) => {
        g.clear();
        if (ready) return;                       // có ảnh rồi thì không vẽ khung

        g.lineStyle(0);
        g.beginFill(COLORS.dustLight, 0.22);
        g.drawRoundedRect(0, 0, width, height, 10);
        g.endFill();

        /* Viền nét đứt tự vẽ (Pixi không có kiểu nét đứt sẵn) */
        g.lineStyle(2.4, COLORS.siloBorder, 0.65);
        const dash = 14, gap = 9;
        const seg = (x1, y1, x2, y2) => {
            const len = Math.hypot(x2 - x1, y2 - y1);
            const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
            for (let d = 0; d < len; d += dash + gap) {
                const e = Math.min(d + dash, len);
                g.moveTo(x1 + ux * d, y1 + uy * d);
                g.lineTo(x1 + ux * e, y1 + uy * e);
            }
        };
        seg(0, 0, width, 0);
        seg(width, 0, width, height);
        seg(width, height, 0, height);
        seg(0, height, 0, 0);

        /* Dấu ảnh ở giữa cho ra dáng ô ảnh trống */
        const cx = width / 2, cy = height / 2 - height * 0.06;
        const w = Math.min(width, height) * 0.42, h = w * 0.72;
        g.lineStyle(2.2, COLORS.siloBorder, 0.5);
        g.drawRoundedRect(cx - w / 2, cy - h / 2, w, h, 4);
        g.lineStyle(0);
        g.beginFill(COLORS.siloBorder, 0.45);
        g.drawCircle(cx - w * 0.22, cy - h * 0.16, h * 0.1);
        g.drawPolygon([
            cx - w * 0.34, cy + h * 0.32,
            cx - w * 0.04, cy - h * 0.1,
            cx + w * 0.16, cy + h * 0.12,
            cx + w * 0.3, cy - h * 0.02,
            cx + w * 0.4, cy + h * 0.32,
        ]);
        g.endFill();
    }, [ready, width, height]);

    return (
        <Container x={x} y={y}>
            <Graphics draw={drawFrame} />
            {ready && <Sprite image={src} x={0} y={0} width={width} height={height} />}
            {!ready && (
                <Text
                    text={label}
                    x={width / 2}
                    y={height * 0.80}
                    anchor={0.5}
                    style={new PIXI.TextStyle({
                        fontFamily: 'Arial, sans-serif',
                        fontSize: Math.max(13, height * 0.15),
                        fontWeight: '700',
                        fill: 0x1f618d,
                        letterSpacing: 1.2,
                    })}
                />
            )}
        </Container>
    );
};
