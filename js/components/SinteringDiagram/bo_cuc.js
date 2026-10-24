/* =============================================================================
 * js/components/SinteringDiagram/bo_cuc.js — TÍNH BỐ CỤC (buildLayout -> LAYOUT)
 * =============================================================================
 * Từ CFG (cau_hinh.js) tính ra toạ độ chi tiết: băng tải, mảng vá góc, máy
 * trộn... — chạy MỘT lần khi nạp, kết quả là LAYOUT. Hàm thuần, không React.
 * Trước 24/10/2026 nằm trong pixiStage.jsx.
 * ===========================================================================*/

import { MIXED_ORE_COLORS, WHITE_ORE_COLORS } from './diagramContainer.jsx';

import { CFG } from './cau_hinh.js';

/* =============================================================================
 * TÍNH TOÁN LAYOUT (hàm thuần — không React, có thể test độc lập)
 * Trả về mọi toạ độ đã tính sẵn + danh sách băng tải / mảng vá góc / máy trộn.
 * ===========================================================================*/
const buildLayout = () => {
    const HALF_BELT = CFG.BELT_HEIGHT / 2; // 17.5 — dùng để canh tâm băng tải

    /* --- Dãy silo, điểm dừng băng & nhà nghiền --- */
    const silosLength = (CFG.SILO_COUNT_PER_ROW - 1) * CFG.SILO_SPACING;
    const beltEndX = silosLength + CFG.BELT_OVERRUN_X + CFG.CLUSTER_SHIFT_X;  // dừng sau silo 1 (đã dịch)
    const crusherX = beltEndX + CFG.CRUSHER_CLEAR_X;        // nhà nghiền đứng SAU băng, dịch theo cụm

    /* --- Tâm 2 tuyến ngang: băng tải nằm hoàn toàn DƯỚI hàng silo --- */
    const conv1Y = CFG.ROW_1_Y - HALF_BELT;
    const conv2Y = CFG.ROW_2_Y - HALF_BELT;

    /* --- Băng tải chính (dưới dãy silo, kéo dài sang trái tới máy trộn,
           sang phải chạy tới tận nhà nghiền ở mép) --- */
    const mainConv1X = CFG.SILO_SHIFT_X - CFG.EXTENSION_LEFT_1;
    const mainConv2X = CFG.SILO_SHIFT_X - CFG.EXTENSION_LEFT_2;
    const mainConv1Len = beltEndX - mainConv1X;
    const mainConv2Len = beltEndX - mainConv2X;

    /* --- Máy trộn ngang ở đầu trái mỗi tuyến --- */
    const mixerHalfWidth = CFG.MIXER_BASE_HALF_WIDTH * CFG.MIXER_SCALE; // 78
    const mixerDrum1X = mainConv1X + CFG.MIXER_OVERLAP - mixerHalfWidth;
    const mixerDrum2X = mainConv2X + CFG.MIXER_OVERLAP - mixerHalfWidth;

    /* --- Băng tải đầu ra sau máy trộn (tiếp tục sang trái) --- */
    const outConv1X = (mixerDrum1X - mixerHalfWidth + CFG.MIXER_OVERLAP) - CFG.OUTPUT_CONV_LENGTH;
    const outConv2X = (mixerDrum2X - mixerHalfWidth + CFG.MIXER_OVERLAP) - CFG.OUTPUT_CONV_LENGTH;

    /* --- Trục dọc rẽ xuống: dòng liệu nằm vào giữa băng tải --- */
    const vertCenter1X = outConv1X + HALF_BELT;
    const vertCenter2X = outConv2X + HALF_BELT;

    /* Đồng bộ độ lệch (stagger): lệch dọc = lệch ngang giữa 2 tuyến (440 - 360 = 80px) */
    const stagger = Math.abs(CFG.EXTENSION_LEFT_1 - CFG.EXTENSION_LEFT_2);
    const vertMixer2Y = CFG.VERT_MIXER_2_Y;
    const vertMixer1Y = vertMixer2Y + stagger; // Tuyến ngoài lún sâu hơn đúng bằng stagger

    /* Điểm rẽ ngang mới (ngay trên nắp máy trộn dọc) */
    const turn1Y = vertMixer1Y - 20;
    const turn2Y = vertMixer2Y - 20;

    /* Chiều dài băng dọc: đâm từ tuyến ngang xuống hết điểm rẽ */
    const vertConv1Len = (turn1Y + CFG.BELT_HEIGHT) - conv1Y;
    const vertConv2Len = (turn2Y + CFG.BELT_HEIGHT) - conv2Y;

    /* Băng ngang dài phía dưới — cắt tới beltCutX (red line), lấn nhẹ 10px vào hộp S1. */
    const targetEndX = CFG.S1BOX.beltCutX + 10;
    const horzStart1X = vertCenter1X - HALF_BELT; // == outConv1X
    const horzStart2X = vertCenter2X - HALF_BELT; // == outConv2X
    const longHorz1Len = targetEndX - horzStart1X;
    const longHorz2Len = targetEndX - horzStart2X;

    /* --- Hộp Trạm S1: mép trên = băng phía trong (turn2Y), thân buông dài xuống.
           Băng phía ngoài (turn1Y) chạy vào bên trong hộp. --- */
    const s1Box = {
        x: CFG.S1BOX.beltCutX,
        y: turn2Y,
        width: CFG.S1BOX.width,
        height: CFG.S1BOX.height,
    };

    /* --- 2 BĂNG DỌC cấp liệu từ Trạm S1 (xuyên dưới track, chạy sau lưng thiết bị):
       mix-vert   : lên silo liệu hỗn hợp (chồng trên bố liệu) — hạt nâu
       lining-vert: lên silo liệu lót — hạt than CỠ TO (theo yêu cầu) */
    const feedTopY = CFG.FEED_TOP_Y;
    const mixVertX = CFG.MIX_SILO.x + HALF_BELT;
    const liningVertX = CFG.LINING_SILO.x + HALF_BELT;
    const feedVertLen = (turn2Y + 10) - feedTopY;

    /* --- PHÂN ĐOẠN MÀU HẠT trên 2 băng chính theo nhóm silo (yêu cầu khoanh màu):
       - Khoanh ĐỎ  (silo 6..1, đầu phải)      -> hạt NÂU
       - Khoanh VÀNG (silo 14..12 và 8..7)     -> hạt TRẮNG
       - Sau khi ra khỏi silo 21 (đầu trái)    -> hạt NÂU
       - Các đoạn còn lại giữ hạt màu than.
       Toạ độ tâm silo số n: x = (21 - n) * SILO_SPACING + SILO_SHIFT_X + CLUSTER_SHIFT_X. */
    const siloX = (n) => (CFG.SILO_COUNT_PER_ROW - n) * CFG.SILO_SPACING + CFG.SILO_SHIFT_X + CFG.CLUSTER_SHIFT_X;
    const R = 35; // nửa bề rộng vùng ảnh hưởng quanh silo
    const mainSegments = [
        { from: null,           to: siloX(21) - R, colors: MIXED_ORE_COLORS },  // sau silo 21 -> nâu (from=null: từ đầu băng)
        { from: siloX(21) - R,  to: siloX(14) - R, colors: null },              // than (mặc định)
        { from: siloX(14) - R,  to: siloX(12) + R, colors: WHITE_ORE_COLORS },  // khoanh vàng 14..12
        { from: siloX(12) + R,  to: siloX(8) - R,  colors: null },
        { from: siloX(8) - R,   to: siloX(7) + R,  colors: WHITE_ORE_COLORS },  // khoanh vàng 8..7
        { from: siloX(7) + R,   to: siloX(6) - R,  colors: null },
        { from: siloX(6) - R,   to: beltEndX,      colors: MIXED_ORE_COLORS },  // khoanh đỏ 6..1 -> nâu
    ];

    /* =========================================================================
     * DANH SÁCH BĂNG TẢI — nguồn dữ liệu DUY NHẤT cho cả 2 lớp render:
     *   - Lớp nền xám  (hasMaterial=false)
     *   - Lớp hạt liệu (showBackground=false)
     * particleColors: bảng màu hạt (mặc định than đen; NÂU cho quặng đã trộn).
     * particleScale : cỡ hạt (2 = to gấp đôi, dùng cho quặng lót).
     * Lưu ý: THỨ TỰ trong mảng = thứ tự vẽ chồng lớp, không đổi tuỳ tiện.
     * =======================================================================*/
    const conveyors = [
        // Băng dọc từ tuyến ngang xuống máy trộn dọc (SAU trộn -> hạt NÂU)
        { id: 'vert-1', x: outConv1X + CFG.BELT_HEIGHT, y: conv1Y, length: vertConv1Len, angle: 90, reverseFlow: true, clipMask: 'diagonal-both-vert', particleColors: MIXED_ORE_COLORS },
        { id: 'vert-2', x: outConv2X + CFG.BELT_HEIGHT, y: conv2Y, length: vertConv2Len, angle: 90, reverseFlow: true, clipMask: 'diagonal-both-vert', particleColors: MIXED_ORE_COLORS },

        // Băng đầu ra ngắn sau máy trộn ngang (SAU trộn -> hạt NÂU)
        { id: 'out-1', x: outConv1X, y: conv1Y, length: CFG.OUTPUT_CONV_LENGTH, angle: 0, reverseFlow: false, clipMask: 'diagonal-horz', particleColors: MIXED_ORE_COLORS },
        { id: 'out-2', x: outConv2X, y: conv2Y, length: CFG.OUTPUT_CONV_LENGTH, angle: 0, reverseFlow: false, clipMask: 'diagonal-horz', particleColors: MIXED_ORE_COLORS },

        // Băng tải chính dưới dãy silo: NỀN vẽ liền 1 dải, HẠT tách đoạn màu bên dưới
        { id: 'main-1', x: mainConv1X, y: conv1Y, length: mainConv1Len, angle: 0, reverseFlow: false, clipMask: 'none', noParticles: true },
        { id: 'main-2', x: mainConv2X, y: conv2Y, length: mainConv2Len, angle: 0, reverseFlow: false, clipMask: 'none', noParticles: true },

        // Các ĐOẠN HẠT màu theo nhóm silo (nâu / trắng / than) — chỉ hạt, không nền
        ...mainSegments.flatMap((seg, k) => {
            const from1 = seg.from === null ? mainConv1X : seg.from;
            const from2 = seg.from === null ? mainConv2X : seg.from;
            const base = { angle: 0, reverseFlow: false, clipMask: 'none', noBackground: true };
            return [
                { id: `main-1-seg${k}`, x: from1, y: conv1Y, length: seg.to - from1, particleColors: seg.colors ?? undefined, ...base },
                { id: `main-2-seg${k}`, x: from2, y: conv2Y, length: seg.to - from2, particleColors: seg.colors ?? undefined, ...base },
            ].filter((c) => c.length > 0); // bỏ đoạn rỗng (2 ranh màu trùng nhau)
        }),

        // Băng ngang dài phía dưới chạy vào Trạm S1 (SAU trộn -> hạt NÂU)
        { id: 'to-s1-1', x: horzStart1X, y: turn1Y, length: longHorz1Len, angle: 0, reverseFlow: true, clipMask: 'diagonal-left-horz', particleColors: MIXED_ORE_COLORS },
        { id: 'to-s1-2', x: horzStart2X, y: turn2Y, length: longHorz2Len, angle: 0, reverseFlow: true, clipMask: 'diagonal-left-horz', particleColors: MIXED_ORE_COLORS },

        // 2 băng dọc cấp liệu từ Trạm S1 lên 2 silo (lót: hạt than TO; hỗn hợp: hạt nâu)
        { id: 'lining-vert', x: liningVertX, y: feedTopY, length: feedVertLen, angle: 90, reverseFlow: false, clipMask: 'diagonal-vert', particleScale: 1.8 },
        { id: 'mix-vert', x: mixVertX, y: feedTopY, length: feedVertLen, angle: 90, reverseFlow: false, clipMask: 'diagonal-vert', particleColors: MIXED_ORE_COLORS, topLayer: true },

    ];

    /* Mảng vá góc chữ L: che mí nối nền xám tại các điểm rẽ */
    const cornerPatches = [
        { id: 'patch-out-1', x: outConv1X, y: conv1Y, variant: 'top-left' },
        { id: 'patch-out-2', x: outConv2X, y: conv2Y, variant: 'top-left' },
        { id: 'patch-s1-1', x: horzStart1X, y: turn1Y, variant: 'bottom-left' },
        { id: 'patch-s1-2', x: horzStart2X, y: turn2Y, variant: 'bottom-left' },
    ];

    /* Máy trộn: 2 chiếc dọc phía dưới + 2 chiếc ngang ở đầu tuyến */
    const mixers = [
        { id: 'mixer-vert-1', x: vertCenter1X, y: vertMixer1Y - 120, angle: 90 },
        { id: 'mixer-vert-2', x: vertCenter2X, y: vertMixer2Y - 120, angle: 90 },
        { id: 'mixer-horz-1', x: mixerDrum1X, y: CFG.ROW_1_Y, angle: 0 },
        { id: 'mixer-horz-2', x: mixerDrum2X, y: CFG.ROW_2_Y, angle: 0 },
    ];

    /* 2 hàng silo (nhãn hàng trên nằm phía trên, hàng dưới nằm phía dưới) */
    const siloRows = [
        { id: 'top', y: CFG.ROW_1_Y, textYOffset: -40 },
        { id: 'bottom', y: CFG.ROW_2_Y, textYOffset: 40 },
    ];

    return {
        conveyors,
        cornerPatches,
        mixers,
        siloRows,
        crusher: { x: crusherX, y: CFG.CRUSHER_Y },
        s1Box,
    };
};

/* Layout chỉ phụ thuộc hằng số -> tính đúng 1 lần khi nạp module */
export const LAYOUT = buildLayout();
