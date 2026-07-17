import React, { useEffect } from 'react';
import { Stage, Container, Graphics, Text } from '@pixi/react';
import * as PIXI from 'pixi.js';

import {
    CoalCrusherPlaceholder,
    SiloPlaceHolder,
    MainConveyorPlaceHolder,
    DrumMixerTopDown,
    COLORS,
} from './diagramContainer.jsx';

/* =============================================================================
 * 1) THAM SỐ TINH CHỈNH
 * Muốn dịch chuyển / co giãn sơ đồ: chỉ sửa các con số trong khối này.
 * Mọi toạ độ còn lại được TỰ TÍNH trong buildLayout() bên dưới.
 * ===========================================================================*/

/* Sân khấu + camera ảo */
const STAGE = {
    // Kích thước ôm layout hiện tại + chừa HEADROOM phía dưới (~180px) để bạn thiết kế
    // thêm hạng mục xuống dưới mà không bị cắt (overflow) — phần dư này nằm TRONG canvas,
    // còn footer trang luôn bị đẩy xuống dưới wrapper nên không bao giờ cấn vào sơ đồ.
    // aspect-ratio trong diagram.css phải khớp W/H này.
    width: 1746,
    height: 656,
    camera: { x: -50, y: 197, zoom: 0.65 },
};

const CFG = {
    BELT_HEIGHT: 35,            // Phải khớp với chiều cao băng tải trong diagramContainer

    /* Dãy silo */
    SILO_COUNT_PER_ROW: 21,
    SILO_SPACING: 70,          // Giãn để 21 silo lấp kín tới nhà nghiền, silo 1 sát mép băng
    SILO_SHIFT_X: 76,           // Dịch cả dãy silo sang phải; silo 1 chạm đúng mép băng gần nhà nghiền

    /* Dịch RIÊNG cụm (dãy silo + nhà nghiền + đầu phải băng) sang phải, GIỮ NGUYÊN máy trộn
       và Trạm S1. Băng bên trái tự nối dài theo. Tăng = dịch cụm sang phải nhiều hơn. */
    CLUSTER_SHIFT_X: 238,
    ROW_1_Y: -140,              // Tâm tuyến 1 (hàng silo trên + máy trộn 1)
    ROW_2_Y: -70,               // Tâm tuyến 2 (hàng silo dưới + máy trộn 2)

    /* Điểm dừng chung của các băng ngang bên phải:
       băng chạy vượt qua silo cuối bao xa (tính từ silo cuối cùng). */
    BELT_OVERRUN_X: 100,        // Băng trên dừng ngay sau silo 1 (bỏ đoạn băng trống thừa)

    /* Nhà nghiền: đặt SAU điểm dừng băng một khoảng -> icon không chồng lên băng. */
    CRUSHER_CLEAR_X: 30,
    CRUSHER_Y: -170,

    /* Băng tải chính kéo dài sang trái (độ lệch 2 tuyến tạo hiệu ứng so le) */
    EXTENSION_LEFT_1: 440,
    EXTENSION_LEFT_2: 360,

    /* Máy trộn */
    MIXER_SCALE: 0.65,
    MIXER_OVERLAP: 22,          // Độ lấn của băng tải vào thân máy trộn
    MIXER_BASE_HALF_WIDTH: 120, // Nửa chiều dài máy trộn trước khi scale

    /* Băng tải đầu ra sau máy trộn */
    OUTPUT_CONV_LENGTH: 60,

    /* Cụm máy trộn dọc phía dưới.
       Tăng số này = dịch cả cụm dưới (2 máy trộn dọc + 2 băng ngang dài) xuống sâu hơn,
       nới rộng khoảng trống giữa cụm silo/tuyến trên và cụm dưới. */
    VERT_MIXER_2_Y: 500,

    /* Hộp Trạm S1 (model giống Trạm S2): băng dưới cắt tới beltCutX, hộp đặt tại đó,
       MÉP TRÊN hộp = băng phía trong (turn2Y), thân hộp buông dài xuống dưới.
       beltCutX: điểm cắt băng ngang dưới (feed-local) — cũng là mép trái hộp.
       height: chiều cao hộp buông xuống. */
    S1BOX: { beltCutX: 1520, width: 140, height: 220 },

    /* Trạm S2 */
    S2: { x: 100, y: -270, width: 120, height: 100 },

    /* Vị trí cụm nạp liệu trong camera */
    FEEDING_SECTION: { x: 850, y: -110 },
};

/* =============================================================================
 * 2) TÍNH TOÁN LAYOUT (hàm thuần — không React, có thể test độc lập)
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

    /* =========================================================================
     * DANH SÁCH BĂNG TẢI — nguồn dữ liệu DUY NHẤT cho cả 2 lớp render:
     *   - Lớp nền xám  (hasMaterial=false)
     *   - Lớp hạt liệu (showBackground=false)
     * Trước đây mỗi băng phải khai báo 2 lần nên toạ độ dễ lệch nhau khi sửa.
     * Lưu ý: THỨ TỰ trong mảng = thứ tự vẽ chồng lớp, không đổi tuỳ tiện.
     * =======================================================================*/
    const conveyors = [
        // Băng dọc từ tuyến ngang xuống máy trộn dọc
        { id: 'vert-1', x: outConv1X + CFG.BELT_HEIGHT, y: conv1Y, length: vertConv1Len, angle: 90, reverseFlow: true, clipMask: 'diagonal-both-vert' },
        { id: 'vert-2', x: outConv2X + CFG.BELT_HEIGHT, y: conv2Y, length: vertConv2Len, angle: 90, reverseFlow: true, clipMask: 'diagonal-both-vert' },

        // Băng đầu ra ngắn sau máy trộn ngang
        { id: 'out-1', x: outConv1X, y: conv1Y, length: CFG.OUTPUT_CONV_LENGTH, angle: 0, reverseFlow: false, clipMask: 'diagonal-horz' },
        { id: 'out-2', x: outConv2X, y: conv2Y, length: CFG.OUTPUT_CONV_LENGTH, angle: 0, reverseFlow: false, clipMask: 'diagonal-horz' },

        // Băng tải chính dưới dãy silo
        { id: 'main-1', x: mainConv1X, y: conv1Y, length: mainConv1Len, angle: 0, reverseFlow: false, clipMask: 'none' },
        { id: 'main-2', x: mainConv2X, y: conv2Y, length: mainConv2Len, angle: 0, reverseFlow: false, clipMask: 'none' },

        // Băng ngang dài phía dưới chạy vào Trạm S1
        { id: 'to-s1-1', x: horzStart1X, y: turn1Y, length: longHorz1Len, angle: 0, reverseFlow: true, clipMask: 'diagonal-left-horz' },
        { id: 'to-s1-2', x: horzStart2X, y: turn2Y, length: longHorz2Len, angle: 0, reverseFlow: true, clipMask: 'diagonal-left-horz' },
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
const LAYOUT = buildLayout();

/* =============================================================================
 * 3) CÁC HÀM VẼ TĨNH & COMPONENT PHỤ
 * ===========================================================================*/

const PATCH_SIZE = CFG.BELT_HEIGHT;     // 35
const PATCH_HALF = PATCH_SIZE / 2;      // 17.5

/* Vá góc trên-trái: nối băng ngang (đi sang phải) với băng dọc (đi xuống) */
const drawTopLeftPatch = (g) => {
    g.clear();
    g.lineStyle(0);
    g.beginFill(COLORS.surfaceLight);
    g.drawRect(0, 0, PATCH_SIZE, PATCH_SIZE);

    g.lineStyle(2, COLORS.borderGray);
    g.moveTo(PATCH_HALF, 0); g.lineTo(PATCH_SIZE, 0);
    g.moveTo(0, PATCH_HALF); g.lineTo(0, PATCH_SIZE);
    g.moveTo(0, PATCH_HALF); g.arc(PATCH_HALF, PATCH_HALF, PATCH_HALF, Math.PI, Math.PI * 1.5);
};

/* Vá góc dưới-trái: nối băng dọc (đi xuống) rẽ sang băng ngang (đi phải) */
const drawBottomLeftPatch = (g) => {
    g.clear();
    g.lineStyle(0);
    g.beginFill(COLORS.surfaceLight);
    g.drawRect(0, 0, PATCH_SIZE, PATCH_SIZE);

    // Viền lề trái và lề dưới
    g.lineStyle(2, COLORS.borderGray);
    g.moveTo(0, 0); g.lineTo(0, PATCH_HALF);
    g.moveTo(PATCH_HALF, PATCH_SIZE); g.lineTo(PATCH_SIZE, PATCH_SIZE);

    g.moveTo(PATCH_HALF, PATCH_SIZE);
    g.arc(PATCH_HALF, PATCH_HALF, PATCH_HALF, Math.PI / 2, Math.PI);

    g.moveTo(PATCH_SIZE, PATCH_HALF);
    g.lineTo(PATCH_SIZE, 0);
    g.lineTo(PATCH_HALF, 0);
};

const PATCH_DRAWERS = {
    'top-left': drawTopLeftPatch,
    'bottom-left': drawBottomLeftPatch,
};

/** Mảng vá góc chữ L, đè lên để che mí nối giữa 2 băng tải vuông góc. */
const CornerPatch = ({ x, y, variant }) => (
    <Container x={x} y={y}>
        <Graphics draw={PATCH_DRAWERS[variant]} />
    </Container>
);

/* --- Trạm S2 --- */
const S2_TEXT_STYLE = new PIXI.TextStyle({ fontSize: 18, fontWeight: 'bold' });

const drawStationS2Box = (g) => {
    g.clear();
    g.lineStyle(2, COLORS.borderGray);
    g.beginFill(COLORS.industrialOrange);
    g.drawRect(0, 0, CFG.S2.width, CFG.S2.height);
    g.endFill();
};

const StationS2 = () => (
    <Container x={CFG.S2.x} y={CFG.S2.y}>
        <Graphics draw={drawStationS2Box} />
        <Text
            text="TRẠM S2"
            x={CFG.S2.width / 2}
            y={CFG.S2.height / 2}
            anchor={0.5}
            style={S2_TEXT_STYLE}
        />
    </Container>
);

/* --- Trạm S1: model giống Trạm S2, đặt ở cuối 2 băng ngang dưới (toạ độ từ LAYOUT) --- */
const drawStationS1Box = (g) => {
    g.clear();
    g.lineStyle(2, COLORS.borderGray);
    g.beginFill(COLORS.industrialOrange);
    g.drawRect(0, 0, LAYOUT.s1Box.width, LAYOUT.s1Box.height);
    g.endFill();
};

const StationS1 = () => (
    <Container x={LAYOUT.s1Box.x} y={LAYOUT.s1Box.y}>
        <Graphics draw={drawStationS1Box} />
        <Text
            text="TRẠM S1"
            x={LAYOUT.s1Box.width / 2}
            y={LAYOUT.s1Box.height / 2}
            anchor={0.5}
            style={S2_TEXT_STYLE}
        />
    </Container>
);

/* =============================================================================
 * 4) CỤM NẠP LIỆU — lắp ráp từ dữ liệu LAYOUT
 * Thứ tự 4 lớp (dưới lên): nền xám -> vá góc -> hạt liệu -> thiết bị.
 * ===========================================================================*/
const TopFeedingSection = ({ x, y }) => (
    <Container x={x} y={y}>

        {/* --- LỚP 1: NỀN XÁM của tất cả băng tải (tắt hạt liệu) --- */}
        {LAYOUT.conveyors.map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-bg-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                hasMaterial={false}
            />
        ))}

        {/* --- LỚP 2: MẢNG VÁ GÓC CHỮ L (đè lên che mí nối nền xám) --- */}
        {LAYOUT.cornerPatches.map((p) => (
            <CornerPatch key={p.id} x={p.x} y={p.y} variant={p.variant} />
        ))}

        {/* --- LỚP 3: CHỈ HẠT LIỆU (tắt nền để không đè xám lên lớp dưới) --- */}
        {LAYOUT.conveyors.map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-flow-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                reverseFlow={c.reverseFlow}
                clipMask={c.clipMask}
                showBackground={false}
            />
        ))}

        {/* --- LỚP 4: MÁY TRỘN, SILO & NHÀ NGHIỀN --- */}
        {LAYOUT.mixers.map((m) => (
            <DrumMixerTopDown
                key={m.id}
                x={m.x} y={m.y}
                scale={CFG.MIXER_SCALE}
                angle={m.angle}
            />
        ))}

        {LAYOUT.siloRows.map((row) =>
            Array.from({ length: CFG.SILO_COUNT_PER_ROW }).map((_, index) => (
                <SiloPlaceHolder
                    key={`silo-${row.id}-${index}`}
                    index={CFG.SILO_COUNT_PER_ROW - index}
                    x={index * CFG.SILO_SPACING + CFG.SILO_SHIFT_X + CFG.CLUSTER_SHIFT_X}
                    y={row.y}
                    textYOffset={row.textYOffset}
                />
            ))
        )}

        <CoalCrusherPlaceholder x={LAYOUT.crusher.x} y={LAYOUT.crusher.y} />

        {/* Trạm S1 ở cuối 2 băng ngang dưới (toạ độ feeding-local nên đặt trong section này) */}
        <StationS1 />
    </Container>
);

/* =============================================================================
 * 5) STAGE GỐC
 * ===========================================================================*/
const PixiStage = () => {

    // Ép trình duyệt tính lại kích thước sau khi mount (canvas co giãn theo CSS,
    // đôi khi render lần đầu bị sai kích thước nên bắn lại resize 2 nhịp)
    useEffect(() => {
        const timer1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
        const timer2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 500);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, []);

    return (
        <Stage
            width={STAGE.width}
            height={STAGE.height}
            options={{ backgroundAlpha: 0, antialias: true }}
            style={{ width: '100%', height: '100%', display: 'block', margin: '0 auto' }}
        >
            {/* CAMERA ẢO: quản lý toạ độ toàn cục (pan qua position, zoom qua scale) */}
            <Container
                position={[STAGE.camera.x, STAGE.camera.y]}
                scale={{ x: STAGE.camera.zoom, y: STAGE.camera.zoom }}
            >
                {/* Trạm S2 (vị trí cố định) */}
                <StationS2 />

                {/* Cụm nạp liệu chính */}
                <TopFeedingSection x={CFG.FEEDING_SECTION.x} y={CFG.FEEDING_SECTION.y} />
            </Container>
        </Stage>
    );
};

export default PixiStage;
