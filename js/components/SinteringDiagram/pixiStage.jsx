import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Container, Graphics, Sprite, Text, useApp } from '@pixi/react';
import * as PIXI from 'pixi.js';

import {
    CoalCrushingPlant,
    SiloPlaceHolder,
    MainConveyorPlaceHolder,
    DrumMixerTopDown,
    COLORS,
    lerpColor,
    MIXED_ORE_COLORS,
    WHITE_ORE_COLORS,
    MaterialSilo,
    FeederWithRollers,
    IgnitionFurnace,
    PalletCarTrack,
    MaterialFall,
    WindBoxRow,
    WindMainDuct,
    SinterCrusher,
    StackerReclaimer,
    ShuttleDistributor,
    AnnularCooler,
    COOLED_SINTER_COLORS,
    BLACK_SINTER_COLORS,
    ChainConveyorSegment,
    TrackSuction,
    DriveMotor,
    SingleRollCrusher,
    OrePourStream,
    WasteHeatBoiler,
    FlueGasRecirculation,
    GlassPane,
    ExhaustTreatment,
    IronRemovalStation,
    BlastFurnacePlant,
    WaterRecircStation,
    SiloFeedLine,
    CoolingWaterLines,
    PowerPlant,
    SteamLines,
    HaulRoad,
    HaulTrucks,
} from './diagramContainer.jsx';

import {
    buildHotspots, buildFlowRows, HotspotLayer, HotspotPopup,
    DiagramSidePanel, ProcessVideo, useHotspotPointer,
} from './diagramHotspots.jsx';

/* =============================================================================
 * 1) THAM SỐ TINH CHỈNH
 * Muốn dịch chuyển / co giãn sơ đồ: chỉ sửa các con số trong khối này.
 * Mọi toạ độ còn lại được TỰ TÍNH trong buildLayout() bên dưới.
 * ===========================================================================*/

/* Sân khấu + camera ảo */
const STAGE = {
    // Kích thước + camera CANH GIỮA: lề đều ~16px cả 4 phía quanh biên nội dung
    // thật (từ Trạm S2 / máy trộn trái -> nhà nghiền + ống gió phải; nhà nghiền
    // trên -> đáy Trạm S1 dưới). aspect-ratio trong diagram.css phải khớp W/H.
    // DÂY CHUYỀN 2 là ẢNH GƯƠNG qua trục ngang y=675 (tâm Trạm S1) nên toạ độ x
    // KHÔNG đổi -> giữ nguyên width 1746. Chỉ cần cao thêm để chứa dây 2:
    //   dây 1: y -23..496 | khe (S1 + trạm khử sắt chung): 496..834
    //   dây 2: 834..1353 (feed-local, đã kéo lên 160 do S1 cao 340->180)
    // => height 1034: nội dung phủ 98,8% ngang và 97,2% dọc, lề đều ~14px.
    //    Tỉ lệ khung 1746/1034 = 1,689 (trước là 1,532) -> canvas BÈ RA, lấp gần
    //    kín bề ngang khung trang thay vì để thừa 2 dải trắng 2 bên.
    //    camera GIỮ NGUYÊN nên dây chuyền 1 không xê dịch pixel nào.
    // aspect-ratio trong diagram.css phải khớp W/H.
    // MỞ RỘNG cho KHU LẤY MẪU - SILO MÁNG - TRẠM S3 và chừa chỗ NHÀ VÒM:
    //   biên nội dung hiện tại: x -893 (Trạm S3) .. 1891, y -192 .. 1675
    //   camera.x 125 -> 380 = đẩy TOÀN BỘ sơ đồ sang phải thêm 255px, chừa sẵn
    //   520 đơn vị (338px) trắng ở mép trái để thiết kế NHÀ VÒM THÀNH PHẨM +
    //   MÁY ĐÁNH ĐỐNG (nằm ngang hàng Trạm S3, sẽ có đường xả từ S3 sang).
    //   width 1921 -> 2176, height 1034 -> 1242 (khu lấy mẫu + silo máng nằm
    //   dưới dây chuyền 2). Tỉ lệ 1,858 -> 1,752.
    // aspect-ratio trong diagram.css phải khớp W/H.
    width: 2220,
    // 1242 -> 1256: KHU VỰC MÁNG QUẶNG kéo đáy nội dung xuống y=1695.
    // 1256 -> 1367: CHỪA THÊM 170 đơn vị (110px) trống dưới đáy theo mũi tên.
    height: 1367,
    // camera.x 400 -> 424: BÃI ĐÁNH ĐỐNG xoay ngang nên nới sang trái tới
    // x=-1470 (kể cả sân là -1482); mép trái canvas xuống feed -1502.
    // width 2196 -> 2220 để giữ nguyên lề phải ~14px.
    camera: { x: 424, y: 210, zoom: 0.65 },
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
    VERT_MIXER_2_Y: 595,        // Đẩy cụm dưới + Trạm S1 xuống, giãn băng lên S1
                                // để nhường chỗ cho nhà xưởng mở rộng

    /* Hộp Trạm S1 (model giống Trạm S2): băng dưới cắt tới beltCutX, hộp đặt tại đó,
       MÉP TRÊN hộp = băng phía trong (turn2Y), thân hộp buông dài xuống dưới.
       beltCutX: điểm cắt băng ngang dưới (feed-local) — cũng là mép trái hộp.
       height: chiều cao hộp buông xuống. */
    // Toà nhà S1 5 tầng (nhìn từ trên). Hộp bắt đầu ở y=575 (turn2Y).
    // CHIỀU CAO HỘP = "thanh chống" quyết định dây chuyền 2 nằm cách dây 1 bao xa:
    // trục lấy gương của dây 2 chính là TÂM hộp S1, nên tăng/giảm chiều cao H thì
    // dây chuyền 2 tụt xuống / kéo lên đúng H, mà 2 băng dọc cấp bố liệu vẫn cắm
    // ĐÚNG 10px vào mép trên/mép dưới hộp và vẫn DÀI BẰNG NHAU (362).
    //   200 -> 260 -> 340 : nới dần cho trạm khử sắt dùng chung
    //   340 -> 180 : THU LẠI 160. Sau khi trạm khử sắt được kéo xuống sát dây 2,
    //                đoạn 690..903 thành KHOẢNG CHẾT 213 đơn vị không vẽ gì cả.
    //                Cắt bớt 160 (còn chết 53) -> sơ đồ BÈ RA: tỉ lệ khung
    //                1746/1140 = 1,53 nâng lên 1746/1036 = 1,69, lấp gần kín bề
    //                ngang khung trang. Trạm khử sắt được kéo lên CÙNG một lượng
    //                nên khe trạm <-> dây chuyền 2 vẫn giữ nguyên đúng 16px.
    S1BOX: { beltCutX: 1400, width: 210, height: 180 },
                                                          // chân cả 2 băng dọc cấp liệu

    /* ===== NHÀ XƯỞNG THIÊU KẾT (vòng đỏ) và các hạng mục bên trong =====
       Toàn bộ toạ độ ở hệ feed-local. Khung xưởng đã MỞ RỘNG bao trọn mọi
       thiết bị: xe ghi, lò điểm hoả, con lăn, trống bố liệu, silo hỗn hợp,
       silo lót và 2 băng ngang cấp liệu. */
    /* Xe ghi điểm hoả: toa ĐỨNG cao vừa lòng khung lò (model bản vẽ), mật độ dày
       (carWidth nhỏ + gap nhỏ), chạy sang TRÁI, cắt gọn tại 2 mép track. */
    /* Track nối dài ra SAU silo liệu lót (xe chạy xuyên dưới silo lót, nhận
       lớp lót trước, rồi tới bố liệu nhận liệu hỗn hợp). */
    /* xRight cắt NGAY SAU silo liệu lót (1560+26+10): bỏ đoạn toa trống phía
       trước silo; toa xuất hiện từ trục quay là vào ngay vùng rải lớp lót. */
    TRACK: { xLeft: 312, xRight: 1596, yTop: 158, height: 164, carWidth: 34, gap: 4, speed: 0.5 },
                                // (xLeft lùi vào ~1 toa, nhường chỗ cho nghiền trục đơn)

    /* NGHIỀN TRỤC ĐƠN ở cuối đường xe (sau chỗ lật 180°): trụ đứng như bố liệu,
       bánh răng nghiền cỡ to, quay NGƯỢC chiều bố liệu. */
    ROLL_CRUSHER: { x: 283, y: 240, radius: 16, height: 164 },   // y = TÂM trụ; 240 = tâm
                                                                 // track (158..322) -> cân đúng toa

    /* Lò điểm hoả: 35 mỏ đốt chia 3 hàng. Hàng 1 GẦN bố liệu nhất (11 mỏ),
       hàng 2 giữa (12), hàng sau ĐỐI DIỆN bố liệu (12). */
    FURNACE: {
        frame: { x: 1260, y: 150, width: 150, height: 180 },
        burnersYTop: 165, burnersYBottom: 305,   // lùi vào trong để ngọn lửa
                                                 // không lòi khỏi khung lò
        columns: [
            { x: 1380, count: 11 },   // Hàng 1 — gần bố liệu
            { x: 1335, count: 12 },   // Hàng 2 — giữa
            { x: 1290, count: 12 },   // Hàng sau — đối diện bố liệu
        ],
    },

    /* CỤM CẤP LIỆU theo nguyên lý phân LỚP:
       - Silo liệu hỗn hợp ngồi TRÊN ĐẦU trống bố liệu.
       - BỐ LIỆU: trống dài VẮT NGANG track, chiều dài = đúng bề xe ghi (164).
       - 9 CON LĂN: cột dọc NGAY DƯỚI (hạ nguồn) bố liệu, trải đều 2 bên cạnh track.
       - Silo liệu lót đứng riêng trên track phía sau (không còn băng nối). */
    FEEDER: {
        drum: { x: 1425, y: 240, radius: 14, height: 164 },   // Bố liệu: trụ MẢNH sát mép phải lò
        rollerClusters: [
            { cx: 1467, cy: 185, count: 4 },   // 3 hàng x 4 con lăn, khớp trọn
            { cx: 1467, cy: 240, count: 4 },   // chiều dài của bố liệu
            { cx: 1467, cy: 295, count: 4 },
        ],
        rollerSize: { radius: 5.5, height: 40 },
    },

    /* Dòng liệu nâu ĐỔ từ bố liệu xuống xe ghi (vùng hạt chảy sang trái). */
    MATERIAL_FALL: { x: 1440, yTop: 175, width: 56, height: 130 },

    /* Silo liệu HỖN HỢP và silo liệu LÓT: THẲNG HÀNG cùng trục tâm với trống
       bố liệu (y = 205). Băng hỗn hợp NHỎ (bề cao 20) nằm ĐÈ TRÊN băng lót
       (bề cao 35) cùng trục -> băng lót lòi đều 2 mép để thấy hạt liệu lót. */
    /* MÁY RẢI LIỆU CON THOI: chạy qua-lại dọc mặt trống bố liệu. Render TRƯỚC
       lớp băng liệu hỗn hợp (topLayer) nên khi chạy sang nửa đó sẽ bị khuất. */
    SHUTTLE: { x: 1425, yTop: 175, yBottom: 305, width: 50, height: 26, speed: 0.55 },

    /* MÁY LÀM MÁT VÒNG: vành quay NGƯỢC chiều kim đồng hồ; nạp liệu nóng phía
       máy nghiền trục đơn, chạy hết vòng thì xả liệu nguội xuống băng xích.
       - chunkCount: mật độ cục quặng chạy trên máng (nền liệu đã phủ kín sẵn,
         số này chỉ quyết định độ "dày" của lớp cục nổi bên trên).
       - fanArc: cung ĐƯỢC PHÉP đặt quạt (độ, 0° = hướng 3 giờ, tăng theo chiều
         kim đồng hồ). Chừa hẳn cung 330°..56° cho nghiền trục đơn + hộp cửa
         nạp/xả + tuyến băng xả -> KHÔNG quạt nào bị che khuất nữa. */
    COOLER: {
        cx: 42, cy: 235, rOuter: 225, rInner: 175,
        chunkCount: 300, cellCount: 40,   // 700 -> 450 -> 300 cho FPS (có 2 vành nên tiết kiệm gấp đôi)
        fanCount: 9, fanGap: 20, fanRadius: 16, fanBlades: 6,
        fanArc: { start: 56, end: 330 },
        hotArc: 55,               // cung ngay sau cửa nạp: liệu còn đỏ lửa
        /* PHỄU NẠP: x1 = mặt nhả liệu của nghiền trục đơn; yTop/yBot = đúng biên
           trên–dưới THÂN trục nghiền (158..322) để cổ phễu cắm khít mặt máy, hai
           mép không còn thò ra. Miệng phễu vẫn tự loe theo cung vành ±21,5°. */
        gate: { x1: 268, yTop: 158, yBot: 322 },
        gateHalfSpan: 21.5,
        /* MÁNG XẢ nằm NGANG (vuông góc băng tải xích) ở góc dưới-phải vành:
           mép trên y0=318 chạm đúng góc dưới phễu nạp (không còn khe hở); thành
           dưới y1=350 là lưỡi gạt hớt liệu; đầu máng x1=250 tucking dưới góc phễu,
           nằm gọn trên mặt băng tải xích (223..258). */
        chute: { x0: 176, x1: 250, y0: 318, y1: 350 },
    },
    /* Tuyến xả: BĂNG XÍCH (1/5 đầu) + băng cao su, chạy DỌC ngay dưới cửa xả,
       nằm BÊN DƯỚI máy làm mát vòng (render trước nên bị vành che một đoạn).
       x = MÉP PHẢI băng (băng dựng angle=90 nên thân băng nằm bên trái x):
       258 -> tâm băng 240.5, trùng đúng tâm phễu cửa xả (242) — cụm băng xích
       + băng vuông góc về S1 đã dời sang NGAY DƯỚI miệng đổ quặng sau làm mát. */
    /* Băng xả quặng: CẢ 2 DÂY CHUYỀN cùng đổ vào MỘT trạm khử sắt (903..971).
       Băng xích 318..390 (giống nhau ở 2 dây), sau đó băng cao su:
         - dây 1 (từ trên xuống): 390 -> 811  => beltLength  = 421
         - dây 2 (từ dưới lên, toạ độ local): 390 -> 587, gương thành 743..940
                                              => beltLength2 = 197
       LƯU Ý: TỔNG chiều dài tuyến băng nối 2 máy làm mát là HẰNG SỐ = 778 (do
       khoảng cách 2 dây chuyền không đổi). Đẩy trạm xuống Δ chỉ là TRƯỢT trạm
       DỌC tuyến: beltLength += Δ và beltLength2 -= Δ, tổng vẫn 778 -> chiều dài
       băng tải nhìn tổng thể GIỮ NGUYÊN đúng như yêu cầu.  (Δ = 88 lần này.) */
    COOLER_OUT: { x: 258, yTop: 318, chainLength: 72, beltLength: 421, beltLength2: 197 },

    /* 2 ĐIỂM ĐỔ QUẶNG (máng chuyển tiếp) quanh máy làm mát vòng:
       IN  : nghiền trục đơn  -> cửa nạp trên vành (quặng còn nóng).
       OUT : phễu cửa xả      -> đầu băng tải xích (quặng đã nguội). */
    COOLER_POUR_IN: { from: { x: 284, y: 235 }, to: { x: 236, y: 235 }, width: 150 },
    COOLER_POUR_OUT: { from: { x: 184, y: 334 }, to: { x: 246, y: 334 }, width: 22 },

    MIX_SILO: { x: 1425, y: 240, radius: 26 },    // CHỒNG LÊN che giữa thân bố liệu (theo bản vẽ)
    LINING_SILO: { x: 1560, y: 240, radius: 26 },  // Đứng riêng sau cụm con lăn
    FEED_TOP_Y: 223,             // Đỉnh 2 băng dọc (2 silo cùng tâm y=205 đè lên)

    /* Dãy PHỄU ỐNG GIÓ 2 bên hông đường xe (theo bản vẽ mặt bằng): mỗi bên 11
       bầu tròn nối ống cuống vào mép track, trải đều vùng thiêu kết (trước lò). */
    /* 21 phễu MỖI BÊN (tổng 42) — bầu thu nhỏ (r=10) để trải đủ mà vẫn thoáng. */
    WINDBOX: { xStart: 340, xEnd: 1210, count: 21, radius: 10, topY: 126, bottomY: 354 },

    /* 2 ỐNG GIÓ TỔNG chạy dọc phía ngoài 2 dãy phễu (bầu nối ống cuống vào ống
       tổng); bên trong có hiệu ứng gió + bụi hút TỪ TRÁI SANG PHẢI. */
    /* Ống gió chính ĐẨY SÁT bầu phễu (bầu trên 116..136, bầu dưới 344..364):
       mép ống chạm mép bầu -> không còn đoạn ống cuống ngắn lòi ra. */
    WIND_DUCT: { xStart: 315, xEnd: 1620, height: 16, topY: 108, bottomY: 372 },  // Nối dài sang phải tới khu trục quay

    /* NỒI HƠI NHIỆT DƯ 20 MW: 3 chụp hút úp trên CUNG NÓNG của vành (ngay sau
       cửa nạp, liệu còn đỏ) ở góc phần tư trên-phải; ống góp ngang y=16 gom về
       thân nồi đặt phía trên dãy phễu. hoods tính sẵn ở r≈200, các góc 333/311/289°. */
    BOILER: {
        /* 3 CHỤP HÚT trên cung NÓNG (cung TRÊN) của vành làm mát — TRẢ LẠI đúng
           bố trí của máy làm mát vòng dây chuyền CŨ.
           (Đã thử dời xuống cung dưới + ống góp dưới + ống đứng men sườn phải,
            nhưng ống đứng cắt ngang khu xả liệu trông không giống dây chuyền cũ
            nên bỏ. Component WasteHeatBoiler vẫn hỗ trợ bố trí đó qua 2 props
            lowerCollectorY/riserX nếu sau này cần dùng lại.) */
        hoods: [
            { x: 220, y: 144 },   // sector 1 (sát cửa nạp)
            { x: 173, y: 84 },    // sector 2
            { x: 107, y: 46 },    // sector 3 (đỉnh vành)
        ],
        // Ống góp hạ xuống ngang thân nồi (ô hồng): y=43 -> nằm DƯỚI quạt làm mát
        // 296° (y -1.6..30.4) nên quạt lộ hẳn, và cắm thẳng vào sườn trái nồi.
        collectorY: 43,
        // Nồi nằm dưới hàng silo phối liệu (nhãn silo hàng 2 ở y≈-30).
        // Đỉnh cụm (cửa hơi trên bao hơi) = y-37 = -16  -> KHÔNG che silo.
        // Đáy nồi = y+h = 99 < ống gió tổng trên (topY 108).
        boiler: { x: 322, y: 21, w: 232, h: 78 },
    },

    /* =========================================================================
     * NỒI HƠI DÂY CHUYỀN 2 — CHỈ KHÁC Ở TUYẾN ỐNG NHIỆT TỪ MÁT VÒNG SANG NỒI.
     * Dây chuyền 1 giữ NGUYÊN bố trí cũ (3 chụp ở cung TRÊN, 1 ống góp y=43).
     * Dây chuyền 2 lấy bố trí kiểu mới: 3 chụp xuống CUNG DƯỚI -> ống góp dưới
     * -> ống đứng men sườn phải vành -> lên ống góp trên -> vào giữa nồi.
     *
     * LƯU Ý TOẠ ĐỘ: vành làm mát của dây 2 bị LẤY GƯƠNG còn hệ khí chỉ được
     * TỊNH TIẾN, nên trong khung cục bộ của hệ khí, TÂM VÀNH DÂY 2 nằm ở
     * (42, 245) chứ không phải (42, 235) như dây 1. Mọi số dưới đây tính theo
     * tâm (42,245), bán kính 200 (giữa dải vành 175..225):
     *     24° -> (225,326) | 46° -> (181,389) | 68° -> (117,430)
     * Ba góc này rơi đúng KHE GIỮA các quạt của dây 2 (quạt dây 2 nằm ở
     * x 132..164, 238..270, -10..22 phía dưới) nên cuống chụp không đâm quạt nào.
     * ======================================================================= */
    BOILER_LINE2: {
        hoods: [
            { x: 225, y: 326 },   // 24°
            { x: 181, y: 389 },   // 46°
            { x: 117, y: 430 },   // 68°
        ],
        collectorY: 43,
        /* ỐNG GÓP CUNG — thay hẳn cho ống góp dưới + ống đứng thẳng trước đây
           (cả hai đã BỎ). Ống cong chạy vòng theo dải vành làm mát ở ĐÚNG bán
           kính 200 của 3 chụp hút, nên 3 chụp nằm ngay trên thân ống, không cần
           cuống nối. Đầu trên cung (14°) leo thẳng lên ống góp trên rồi vào nồi.
           Đo trên hình vẽ tay của người dùng: trục ống bám r = 199..203 suốt từ
           góc 17° tới 67° -> lấy cung 14°..74° để phủ trọn 3 chụp (24/46/68°). */
        arcDuct: { cx: 42, cy: 245, r: 200, from: 14, to: 74, width: 22 },
        boiler: { x: 322, y: 21, w: 232, h: 78 },
    },

    /* HỆ TUẦN HOÀN KHÍ THẢI (xanh): hút phễu 20,21 (đầu) + 1,2,3 (cuối) + nhiệt
       đoạn giữa vành -> ống góp đáy y=402. Khí 2 nhánh ĐẨY NGƯỢC CHIỀU DỒN VÀO
       GIỮA (centerX) -> 2 QUẠT ĐẨY trên ống góp -> đoạn ống ĐỨNG chân dưới ống
       góp đẩy gió LÊN -> spine -> 9 ống rẽ xả GIỮA mặt xe ghi (y=240). */
    FLUE_RECIRC: {
        leftHoods: [340, 383.5],
        rightHoods: [1123, 1166.5, 1210],
        midTap: { x: -108, y: 378 },
        windBottomY: 372,
        manifold: { y: 402, x0: 288, x1: 1245 },
        centerX: 775,
        spineY: 310,             // spine hạ xuống nửa dưới xe ghi
        blowTopY: 240,           // ĐIỂM XẢ nằm GIỮA xe ghi (158..322 -> 240)
        riserFootY: 432,         // chân ống đứng dưới ống góp (đã dịch vào sát ống góp)
        fans: [580, 970],        // 2 quạt đẩy gió vào ống đứng, đối xứng qua centerX
        spine: { x0: 372, x1: 1178 },
        blowX: [403, 496, 589, 682, 775, 868, 961, 1054, 1147],
        trackTopY: 158,
    },

    /* NHÀ NGHIỀN THAN: 2 máy nghiền 2 TRỤC (rulo) ở trên -> đổ liệu xuống 2 máy
       nghiền 4 TRỤC -> băng tải chuyển than về rót vào silo 15, 16, 17 của dãy
       silo phối liệu. Silo n có x = (21-n)*70 + 314  ->  15:734  16:664  17:594. */
    COAL_PLANT: {
        // Khung nhìn bị CẮT ở x≈1912 -> máy nhỏ + dồn sang trái (biên phải 1887).
        twinRolls: [{ x: 1782, y: -152 }, { x: 1856, y: -152 }],
        quadRolls: [{ x: 1782, y: -62 }, { x: 1856, y: -62 }],
        twinBox: { w: 62, h: 46 },
        quadBox: { w: 62, h: 62 },
        /* BĂNG THAN nằm NGAY DƯỚI hàng silo dưới (đáy silo -46, nhãn số ở -30 nên
           không bị che), chạy từ nhà nghiền sang trái. Đã BỎ băng cam trên đỉnh
           silo + gầu tải đứng. */
        belt: { y: -2, h: 18, x0: 560, x1: 1888 },
        /* 3 ỐNG TẢI ĐỨNG đặt ĐÚNG cột silo 17/16/15, đi thẳng từ băng LÊN HẾT hàng
           silo trên; nhả liệu vào cả 2 hàng silo. */
        risers: [594, 664, 734],       // silo 17, 16, 15
        riserW: 14,
        riserTopY: -164,               // đỉnh silo hàng trên
        dropYs: [-46, -116],           // đáy silo hàng dưới / hàng trên = 2 điểm nhả
    },

    /* ĐỘNG CƠ ĐẨY XE GHI: trên rìa ngoài dãy xe, cùng cột (x) với silo liệu lót,
       dây đai truyền xuống cổ trục quay đầu máy. */
    DRIVE_MOTOR: { x: 1560, y: 121 },

    /* HỆ XỬ LÝ KHÍ THẢI CUỐI ĐƯỜNG (bên phải): ống gió tổng nối dài ra ->
       (1) LỌC BỤI TĨNH ĐIỆN -> (2) QUẠT GIÓ CHÍNH (to gấp đôi quạt làm mát vòng)
       -> ống khói. Toạ độ feed-local; đặt ngoài mép phải khu trục quay. */
    EXHAUST: {
        /* 2 CỤM SONG SONG, mỗi cụm nối vào 1 đầu ống gió tổng (ống trên y=108 và
           ống dưới y=372): ống gió -> (1) LỌC BỤI TĨNH ĐIỆN -> (2) QUẠT GIÓ CHÍNH
           -> ống khói. Đã THU NHỎ để cả cụm nằm gọn trong khung (biên phải 1912):
           cụm chạy 1620..1884 -> còn dư 28px lề, KHÔNG bị cắt. */
        trains: [
            { ductFromX: 1620, ductY: 108, espX: 1700, fanX: 1820 },   // đầu ống gió TRÊN
            { ductFromX: 1620, ductY: 372, espX: 1700, fanX: 1820 },   // đầu ống gió DƯỚI
        ],
        espW: 56, espH: 78,            // lọc bụi tĩnh điện: THU NHỎ tiếp (76x104 -> 56x78)
        fanR: 42,                      // quạt gió chính: TĂNG quy mô (30 -> 42)
        // (đã BỎ ống khói + họng thổi — phần dư nhô ra khỏi quạt)
    },

    /* TRẠM KHỬ SẮT — CHỈ CÒN 1 TRẠM DÙNG CHUNG cho cả 2 dây chuyền, TRƯỢT XUỐNG
       SÁT dây chuyền 2. Sau khi thu khoảng chết, trạm nằm ở 743..811:
         - 743..811 (+ bóng 818), cách băng ngang dưới vào Trạm S1 (690) 53px
         - cách mép trên dây chuyền 2 (834) 16px — GIỮ NGUYÊN như trước khi thu; trong đúng dải x của trạm
           (156..310) thì chi tiết dây 2 gần nhất là quạt làm mát 56° ở y=1036
           và ống góp nồi hơi ở y=1043 -> vẫn hở 58px, không chạm nhau.
       Băng xả của CẢ HAI máy làm mát vòng cùng chạy vào trạm này theo cột x=258:
       dây 1 đi XUỐNG cắm mép dưới, dây 2 đi LÊN cắm mép trên. */
    IRON_STATION: { frame: { x: 156, y: 743, width: 148, height: 68 }, beltX: 258, beltW: 26 },

    /* =========================================================================
     * KHU THÀNH PHẨM (mới) — nằm ở hành lang trái, dưới Trạm S2
     * -------------------------------------------------------------------------
     * NHÀ SÀNG THÀNH PHẨM: cùng kiểu vẽ với Trạm S1 (drawBuildingTopDown) nhưng
     * 3 TẦNG và khổ nhỏ hơn một chút (180x160 so với 210x180 của S1).
     * Đặt ở x -752..-572: mép phải -572 chính là điểm xuất phát của băng ĐỎ và
     * băng VÀNG; nhà sàng vẽ ĐÈ LÊN nên 2 băng trông như cắm hẳn vào nhà.
     * Chỗ này trống hoàn toàn: thứ gần nhất bên phải là máy trộn đứng ở x=-547.
     * ======================================================================= */
    SCREEN_HOUSE: { x: -752, y: 668, width: 180, height: 160, floors: 3 },

    /* 4 TUYẾN BĂNG CỦA KHU THÀNH PHẨM.
       Toạ độ lấy từ hình chú thích của người dùng, quy đổi bằng hệ số 1 px ảnh
       = 1,8975 đơn vị (hiệu chuẩn theo khoảng cách 2 tâm vành làm mát = 860).

       CHIỀU CHẠY HẠT (quy ước của MainConveyorPlaceHolder):
         - băng ngang: reverseFlow=true  -> hạt chạy SANG PHẢI
                       reverseFlow=false -> hạt chạy SANG TRÁI
         - băng dọc  : reverseFlow=true  -> hạt chạy XUỐNG
                       reverseFlow=false -> hạt chạy LÊN                         */
    PRODUCT_BELTS: {
        /* (1) BĂNG ĐỎ — trạm khử sắt -> nhà sàng. Liệu ĐI TỪ PHẢI SANG TRÁI.
               Cỡ hạt + màu GIỐNG HỆT băng xả từ thiêu kết sang trạm khử sắt
               (BLACK_SINTER_COLORS, particleScale 2.2).
               Đầu phải thọc 20 vào trong nhà trạm khử sắt (156..304) cho liền mạch. */
        fromIron: { y: 762, xStart: -572, xEnd: 176 },

        /* (2) BĂNG VÀNG — nhà sàng -> Trạm S1, chở QUẶNG LÓT ĐÁY XE GHI để S1
               trung chuyển cho cả 2 dây chuyền. Liệu ĐI TỪ TRÁI SANG PHẢI.
               Cỡ hạt bằng băng liệu lót đen 'lining-vert' (particleScale 1.8).
               Đầu phải thọc 20 vào trong hộp Trạm S1 (mép trái x=1400). */
        toS1: { y: 700, xStart: -572, xEnd: 1420 },

        /* (3)+(4) HAI CỘT BĂNG DỌC ở hành lang trái. NHÀ SÀNG cắt mỗi cột làm
               2 ĐOẠN, và 2 CỘT TRONG CÙNG MỘT ĐOẠN THÌ GIỐNG HỆT NHAU:

               - ĐOẠN TRÊN nhà sàng: quặng hồi nguội thiêu kết cỡ < 5mm ĐI LÊN
                 Trạm S2. Hạt NHỎ (0.85 — nhỏ hơn băng vàng 1.8), mật độ thưa.
                 Đầu trên thọc 10 vào đáy Trạm S2 (đáy S2 ở y = -68).

               - ĐOẠN DƯỚI nhà sàng: quặng THÀNH PHẨM ĐI XUỐNG ra khỏi xưởng.
                 Liệu ĐỦ CỠ HẠT: 2 lớp hạt chồng nhau trên cùng một băng (lớp to
                 2.6 + lớp nhỏ 1.0) -> dải cỡ hạt từ khá to đến rất nhỏ, mật độ dày.

               Hai đầu giáp nhà sàng đều thọc 20 vào trong nhà (mái 668, đáy 828)
               để nhà sàng vẽ đè lên, trông như băng cắm thẳng vào nhà. */
        columns: [-684, -604],
        upper: { yTop: -78, yBottom: 688 },
        /* NỐI DÀI xuống TRẠM LẤY MẪU THÀNH PHẨM (mái 1523): thọc 20 vào trong nhà. */
        lower: { yTop: 808, yBottom: 1543 },
    },

    /* =========================================================================
     * KHU LẤY MẪU — SILO MÁNG — TRẠM S3 (mới)
     * Toạ độ quy đổi từ hình chú thích, hệ số 1 px ảnh = 1/0,3385 đơn vị
     * (hiệu chuẩn theo hộp Trạm S1 và hộp nhà sàng đang có sẵn trên ảnh).
     * ======================================================================= */

    /* TRẠM LẤY MẪU THÀNH PHẨM (ô chữ nhật xanh): 2 băng dọc thành phẩm từ nhà
       sàng đổ vào đây; ra khỏi đây có 2 băng lên Trạm S3 và 1 băng ngang sang
       cụm silo máng. */
    SAMPLE_HOUSE: { x: -882, y: 1523, width: 280, height: 138, floors: 2 },

    /* TRẠM TRUNG CHUYỂN S3 (ô vuông vàng) — QUY MÔ NHỎ HƠN Trạm S2 (150x118):
       128x98, 2 tầng. */
    S3: { x: -886, y: 1019, width: 128, height: 98, floors: 2 },

    /* 4 BĂNG VÀNG — 2 cột chạy xuyên Trạm S3, CHIỀU ĐI LÊN cả 4:
         - đoạn DƯỚI S3: chở quặng từ TRẠM LẤY MẪU lên S3
         - đoạn TRÊN S3: chở quặng từ S3 đi LÒ NẤU GANG (ra khỏi bản vẽ ở mép trên)
       Cỡ hạt: ĐỦ DẢI TO->NHỎ, y hệt băng thành phẩm từ nhà sàng sang
       (2 lớp hạt 2.6 + 1.0). Cả 2 cột nằm gọn trong bề ngang hộp S3. */
    S3_BELTS: {
        columns: [-836, -773],
        /* Tuyến lên LÒ NẤU GANG: chỉ còn ĐOẠN DƯỚI, từ trong Trạm S3 (1039) lên
           cắm vào đáy TRẠM TRUNG CHUYỂN S4 (362, thọc 20 vào trong nhà).
           Đoạn phía TRÊN S4 (chạy tiếp ra khỏi mép trên bản vẽ) ĐÃ BỎ theo yêu
           cầu — S4 nay là điểm cuối của sơ đồ về phía máng gang. */
        toFurnaceLower: { yTop: 362, yBottom: 1039 },
        fromSample: { yTop: 1097, yBottom: 1543 },  // 1097 = trong S3; 1543 = trong nhà lấy mẫu
    },

    /* TRẠM TRUNG CHUYỂN S4 — chặng cuối trước khi quặng sang máng gang.
       Đo từ ô khoanh đỏ: x -919..-731, y 217..405. Lấy 176x150 đặt giữa ô đó,
       đủ ôm trọn CẢ HAI cột băng (-871..-836 và -808..-773). */
    S4: { x: -917, y: 232, width: 176, height: 150, floors: 3 },

    /* BĂNG NGANG (xanh) — trạm lấy mẫu -> cụm silo máng. Liệu ĐI TỪ TRÁI SANG.
       Mật độ/cỡ hạt giống hệt 2 băng dọc thành phẩm (PRODUCT_GRAIN, giữ nguyên).
       TỪ 1 BĂNG -> 2 BĂNG: mỗi dãy silo có băng riêng chạy XUYÊN QUA tâm dãy,
       đúng kiểu 2 dãy silo phối liệu ở phía trên (silo ngồi trên mặt băng).
         ys = mép trên băng = tâm dãy - BELT_HEIGHT/2 (35/2 = 17.5 -> làm tròn) */
    SAMPLE_OUT: { ys: [1543, 1631], xStart: -602, xEnd: 676 },

    /* CỤM SILO MÁNG QUẶNG: 2 DÃY x 5 SILO nằm ngang, MỖI DÃY NGỒI TRÊN 1 BĂNG.
       Bán kính silo 24 (như dãy phối liệu). */
    TROUGH_SILOS: { xs: [100, 190, 280, 370, 460], rowTopY: 1560, rowBottomY: 1648 },

    /* KHU VỰC MÁNG QUẶNG THÀNH PHẨM (ô khoanh vàng) — sân/nhà bao quanh cả cụm
       silo máng và 2 băng. Vẽ ĐẦU TIÊN nên nằm dưới cùng, chỉ là nền + viền.
       Đo từ hình: feed x 71..559, y 1501..1695. */
    TROUGH_AREA: { x: 71, y: 1501, width: 488, height: 194 },

    /* BĂNG HỒI — chạy trong RÃNH GIỮA 2 dãy silo máng (1578..1631), gom quặng
       thành phẩm từ trong máng CHUYỂN NGƯỢC về Trạm lấy mẫu, từ đó lên Trạm S3
       rồi đi lò. Liệu ĐI TỪ PHẢI SANG TRÁI (không reverseFlow).
       Đúng chỗ băng đơn cũ trước khi tách làm 2, nên không đụng silo nào. */
    TROUGH_RETURN: { y: 1587, xStart: -622, xEnd: 520 },

    /* =========================================================================
     * NHÀ VÒM THÀNH PHẨM (ô khoanh đỏ) — kho vòm chứa quặng thiêu kết, nằm
     * NGANG HÀNG Trạm S3 ở hành lang trái đã chừa sẵn từ trước.
     * Đo từ hình: x -1426..-1049, y 881..1197. Lấy -1400..-1044 / 890..1190 để
     * còn ~23 đơn vị hở tới mép trái canvas (feed -1434,6).
     * ======================================================================= */
    /* PHÓNG TO thành BÃI CHỨA THÀNH PHẨM có MÁY ĐÁNH ĐỐNG - RÚT LIỆU, dựng theo
       bản vẽ "Sinter & Pellet Product Storage Yard": băng gallery chạy dọc giữa
       bãi, 2 máy đánh đống đặt trên gallery, mỗi máy quét một VÒNG TRÒN tạo ra
       một đống liệu hình quạt.
       356x300 -> 460x620 (khung vàng đo được -1428..-1020 / 844..1219, em lấy
       rộng hơn chút vì phải nhét 2 vòng quét vào trong). */
    STOCK_YARD: {
        /* ĐÃ XOAY 90°: băng gallery nay chạy NGANG, 2 máy đánh đống đứng CẠNH
           NHAU theo phương ngang thay vì xếp chồng dọc như trước.
           460x620 (dọc) -> 520x300 (ngang); bán kính quét 150 -> 125 để 2 vòng
           quét vừa đủ nằm cạnh nhau trong hành lang trái. */
        x: -1470, y: 895, width: 520, height: 300,
        galleryY: 150,                 // toạ độ CỤC BỘ: băng gallery chạy ngang giữa bãi
        /* 2 máy đánh đống: cx = tâm quay trên gallery, deg = góc GIỮA của cần,
           sweep = biên độ quật (độ) sang mỗi bên, speed = tốc độ quật.
           Hai máy đặt lệch pha nhau cho sinh động. */
        booms: [
            { cx: 130, deg: -125, sweep: 58, speed: 0.9, phase: 0 },
            { cx: 390, deg: 55, sweep: 58, speed: 0.75, phase: 2.1 },
        ],
        sweepR: 125,
    },

    /* BĂNG ĐỔ QUẶNG từ Trạm S3 RA nhà vòm. Liệu ĐI TỪ PHẢI SANG TRÁI (ra khỏi
       S3). Hai đầu thọc 20 vào trong 2 nhà để nhìn liền mạch. */
    DOME_FEED: { y: 1045, xStart: -970, xEnd: -866 },

    /* BĂNG ĐỔ TỪ SILO MÁNG xuống BĂNG HỒI: cột chuyển tiếp thẳng đứng ở đầu
       phải cụm silo (x 485..520, ngoài rìa silo cuối ở 484), nối cả 3 tuyến
       ngang lại: băng cấp dãy trên -> băng hồi -> băng cấp dãy dưới.
       Liệu chạy XUỐNG, tức trút từ máng quặng vào băng hồi về trạm lấy mẫu. */
    TROUGH_DROP: { x: 520, yTop: 1543, yBottom: 1666 },

    /* =========================================================================
     * KHU XẢ XE BEN (khung xanh dương) — 2 silo nhận quặng từ cụm silo máng,
     * dưới đáy là đường xả cho xe ben chở quặng thiêu kết đi lò.
     * Đo từ hình: x 584..780, y 1498..1687; 2 silo tâm x=694, y 1552 & 1646.
     * ======================================================================= */
    TRUCK_AREA: { x: 584, y: 1496, width: 214, height: 268 },
    TRUCK_SILOS: { x: 694, ys: [1552, 1646], radius: 34 },
    TRUCK_LANE: { x: 598, y: 1698, width: 188, height: 48 },

    /* =========================================================================
     * BĂNG CẤP LIỆU VÀO DÃY SILO PHỐI LIỆU
     * Một băng chạy dọc phía TRÊN cả dãy silo, đầu trái cắm vào Trạm S2 — tức
     * chính là tuyến QUẶNG HỒI THIÊU KẾT quay lại dãy phối liệu. Mỗi nhóm vật
     * liệu có ống rót riêng thả xuống đúng cột silo của mình, cùng kiểu với 3
     * ống tải than sẵn có rót vào silo 15, 16, 17.
     * Cột silo n nằm ở x = (21 - n) * 70 + 314  (silo 1 ngoài cùng bên phải).
     * ======================================================================= */
    SILO_FEED: {
        /* ĐÃ SỬA: trước đây kéo dài suốt 21 cột silo là SAI. Tuyến quặng hồi
           nguội từ Trạm S2 chỉ rót vào 4 CỘT SILO CUỐI (21, 20, 19, 18) rồi hết.
           Các cột còn lại nhận liệu từ nguồn khác, không nằm trên tuyến này.
             height 30 -> 20 : băng mảnh hơn cho khỏi át dãy silo
             y      -202 -> -192 : giữ nguyên đáy băng ở -172, sát nóc hàng silo 1
             xEnd   1762 -> 560  : quá cột silo 18 (x 524) một chút là dừng */
        y: -192, height: 20,
        xStart: -620,        // trong lòng Trạm S2 (x -754..-604)
        xEnd: 560,           // quá cột silo 18 (x 524) một chút
        chuteTopY: -172, chuteBottomY: -44, chuteW: 11,
        groups: [
            // silo 21, 20, 19, 18 — quặng hồi nguội từ Trạm S2
            { color: 0x1c2833, xs: [314, 384, 454, 524] },
        ],
    },

    /* =========================================================================
     * LOGO NHÀ MÁY — đặt vào khoảng trống góc trên - trái bản vẽ.
     * ĐƯỜNG DẪN: sửa `src` nếu tên hoặc đuôi file khác. Ảnh nằm trong thư mục
     * images/ ở gốc dự án; đã chỉnh vite.config.js để thư mục này được chép
     * nguyên cấu trúc sang dist khi build.
     * Kích thước giữ đúng tỉ lệ ảnh gốc 208 x 40 (5,2 : 1).
     * ======================================================================= */
    PLANT_LOGO: {
        src: 'images/logo-hoa-phat-3.png',
        x: -1402, y: -87, width: 520, height: 100,
    },

    /* =========================================================================
     * ĐƯỜNG ỐNG NƯỚC LÀM MÁT: TRẠM PHÁT ĐIỆN <-> TRẠM NƯỚC TUẦN HOÀN
     * Hai ống chạy song song men mép phải bản vẽ, khép thành vòng tuần hoàn:
     *   hot  : nước ngưng NÓNG từ trạm phát điện chảy XUỐNG ống góp nóng của
     *          trạm nước (ống góp nóng ở feed y 1548)
     *   nguội: bơm đẩy nước đã nguội TỪ ống góp nguội (feed y 1702) quay LÊN
     * Cột dọc đặt ở x 1872 và 1894: nằm ngoài rìa quạt gió chính dây 2 (kết
     * thúc ở x 1862) và vẫn trong khung canvas (mép phải feed 1913).
     * ======================================================================= */
    COOLING_WATER: {
        pipeW: 11,
        paths: [
            /* --- CẶP BÊN PHẢI: nối RA từ trạm nước, men mép phải bản vẽ ---
               Cột dọc x 1872 / 1894 nằm ngoài rìa quạt gió chính dây 2 (kết
               thúc ở x 1862) và vẫn trong khung canvas (mép phải 1913). */
            { hot: true, points: [[1866, 752], [1872, 752], [1872, 1548], [1690, 1548]] },
            { hot: false, back: true, points: [[1888, 740], [1894, 740], [1894, 1702], [1690, 1702]] },

            /* --- CẶP BÊN TRÁI: đường nước VÀO trạm, đi vòng phía trên rồi
               xuống mép trái nhà bơm. Hai cột dọc x 1744 / 1762 lọt đúng khe
               giữa lọc bụi tĩnh điện dây 2 (kết thúc x 1728) và quạt gió chính
               (bắt đầu x 1778) — khe rộng 50, hai ống rộng 16 vừa đủ.
               Đoạn ngang y 1372 / 1394 nằm dưới đuôi dây chuyền 2 (kết thúc ở
               y 1320) và trên nóc nhà bơm (y 1490).
               Đoạn dọc x 884 / 906 nằm bên trái nhà bơm (x 940), cách 34. */
            { hot: false, pipeW: 9,
              points: [[1744, 756], [1744, 1372], [884, 1372], [884, 1548], [1000, 1548]] },
            { hot: false, pipeW: 9,
              points: [[1762, 744], [1762, 1394], [906, 1394], [906, 1702], [1000, 1702]] },
        ],
    },

    /* =========================================================================
     * TRẠM NƯỚC TUẦN HOÀN NHIỆT DƯ — nhà bơm nước cho hệ thu hồi nhiệt dư.
     * Đặt ở khoảng trống góc dưới - phải: bên phải khu xả xe ben (kết thúc ở
     * x 798) và dưới đuôi dây chuyền 2 (kết thúc ở y ~1320) nên không đụng gì.
     * Bố trí: 2 ống góp chạy suốt nhà, MỘT DÃY BƠM đấu SONG SONG nối hai ống,
     * bể tuần hoàn ở cuối nhà.
     * ======================================================================= */
    WATER_STATION: {
        /* ĐÃ TRẢ VỀ vị trí cũ và BỎ XOAY: khoảng trống góc dưới - phải, bên phải
           khu xả xe ben (kết thúc ở x 798) và dưới đuôi dây chuyền 2 (y ~1320).
           Bố trí: 2 ống góp chạy suốt nhà, MỘT DÃY BƠM đấu SONG SONG nối hai
           ống, bể tuần hoàn ở cuối nhà. */
        x: 940, y: 1490, width: 760, height: 270,
        headers: { hotY: 58, coldY: 212, x0: 34, x1: 620 },
        pumps: { count: 6, x0: 92, spacing: 96, cy: 135, bodyR: 25, motorW: 34, motorH: 30 },
        tank: { x: 636, y: 40, w: 92, h: 190 },
    },

    /* =========================================================================
     * TRẠM PHÁT ĐIỆN NHIỆT DƯ — hai tổ tuabin phát điện chạy bằng hơi thu từ
     * nồi hơi nhiệt dư của cả hai dây chuyền.
     * Đặt ở hành lang GIỮA hai dây chuyền, phía ngoài cùng bên phải:
     *   - đuôi dây chuyền 1 ở đó kết thúc tại y ~414 (quạt gió chính)
     *   - đầu dây chuyền 2 bắt đầu tại y ~916
     *   - Trạm S1 kết thúc tại x 1610  -> đặt từ x 1642 là hở 32
     * ======================================================================= */
    POWER_STATION: {
        x: 1636, y: 556, width: 262, height: 220,
        header: { x: 18, y0: 26, y1: 194 },                        // ống góp hơi dọc mép trái
        sets: [{ cy: 70 }, { cy: 150 }],                           // 2 tổ tuabin - máy phát
        turbine: { x: 48, w: 78, h: 44 },
        generator: { x: 146, w: 62, h: 38 },
        panel: { x: 216, y: 96, w: 30, h: 48 },                    // tủ hoà lưới
    },

    /* 2 ĐƯỜNG ỐNG HƠI (màu xanh) từ nồi hơi nhiệt dư của mỗi dây chuyền chạy
       ngang ra rồi bẻ dọc vào trạm phát điện.
       CẢ HAI ĐỀU PHẢI XUẤT PHÁT TỪ ĐÚNG TÂM NỒI HƠI:
         y 55  = tâm nồi hơi dây 1 (y 21..99).
         y 910 = tâm nồi hơi dây 2. LƯU Ý: hệ khí dây 2 KHÔNG lấy gương qua trục
                 dây chuyền (665) mà bị LẬT HAI LẦN quanh LINE2_GAS_FLIP_AXIS
                 (=240), rốt cuộc chỉ TỊNH TIẾN xuống 2*(665-240) = 850 đơn vị.
                 Vậy nồi hơi dây 2 nằm ở 871..949, tâm 910 — KHÔNG phải 1275 như
                 phép lấy gương thường. Đặt nhầm 1275 thì ống hơi vừa không dính
                 nồi hơi, vừa đè lên ống góp tuần hoàn khí thải dây 2 (y 1252).
         riserX 1654 : khe giữa đầu ống gió tổng (x 1620) và lọc bụi tĩnh điện
                 (x 1672) -> ống dọc lọt vừa, hở 9 mỗi bên; thẳng hàng luôn với
                 ống góp hơi của trạm (1636 + 18 = 1654). */
    STEAM_LINES: {
        lines: [{ xFrom: 470, y: 55 }, { xFrom: 470, y: 910 }],
        riserX: 1654, joinTopY: 600, joinBottomY: 732, pipeW: 12,
    },

    /* =========================================================================
     * LÒ CAO — hộ tiêu thụ cuối cùng của quặng thiêu kết.
     * ĐÃ ĐẨY LÊN NGANG HÀNG TRẠM TRUNG CHUYỂN S4 (S4 ở y 232..382, tâm 307):
     *   y 590 -> 170, cao 222 -> 320  => sân lò 170..490, tâm 330 ~ ngang S4.
     * Nhờ vậy 2 băng tải quặng từ S4 chạy NGANG thẳng sang lò, không phải bẻ
     * gấp khúc xuống như khi lò còn nằm dưới thấp.
     * Bố cục trong sân (toạ độ CỤC BỘ 0..306 x 0..320):
     *   - hàng 3 LÒ GIÓ NÓNG ở mép trên
     *   - THÂN LÒ ở giữa, MÁNG GANG + thùng gang ở mép trái
     *   - binsSide (mép phải)  : 2 phễu nhận băng NGANG từ Trạm S4
     *   - binsDown (mép dưới)  : 2 phễu nhận băng DỌC từ Nhà vòm thành phẩm
     *   - tipPit               : hố đổ cho xe ben
     * ======================================================================= */
    BLAST_FURNACE: {
        x: -1476, y: 170, width: 306, height: 320,
        shell:    { cx: 116, cy: 158, r: 62 },                 // thân lò
        stoves:   { cy: 42, cxs: [58, 116, 174], r: 20 },      // 3 lò gió nóng
        binsSide: { cx: 264, cys: [105, 175], r: 16 },         // phễu nhận từ S4
        binsDown: { cxs: [60, 130], cy: 280, r: 16 },          // phễu nhận từ nhà vòm
        tipPit:   { x: 196, y: 252, width: 84, height: 46 },   // hố đổ cho xe ben
        ladle:    { cx: 22, cy: 158, r: 13 },                  // thùng chứa gang lỏng
    },

    /* 2 BĂNG CHUYỀN QUẶNG từ NHÀ VÒM THÀNH PHẨM LÊN LÒ CAO (băng DỌC).
       Băng dựng angle=90 nên `columns` là MÉP PHẢI băng, thân băng nằm bên trái
       35 đơn vị -> tâm băng = columns - 17,5, đặt trùng tâm 2 phễu binsDown
       (cục bộ 60 và 130 -> feed -1416 và -1346).
       Liệu ĐI LÊN (không reverseFlow). Hai đầu thọc vào trong 2 công trình:
         yTop 456    = ngay dưới 2 phễu nhận của lò (đáy sân lò ở 490)
         yBottom 912 = trong lòng bãi chứa (mép trên bãi 883), vẫn hở 8 đơn vị
                       so với vòng quét máy đánh đống (đỉnh vòng ở 920) */
    FURNACE_FEED: { columns: [-1398.5, -1328.5], yTop: 456, yBottom: 912 },

    /* 2 BĂNG CHUYỀN QUẶNG từ TRẠM TRUNG CHUYỂN S4 SANG LÒ CAO (băng NGANG).
       Đây là chặng CUỐI của tuyến quặng: nhà lấy mẫu -> S3 -> S4 -> LÒ CAO.
       ys = MÉP TRÊN băng; tâm băng = ys + 17,5 = 275 và 345, trùng đúng tâm 2
       phễu binsSide của lò. Liệu ĐI TỪ PHẢI SANG TRÁI (không reverseFlow).
         xStart -1220 : nằm trong lòng phễu nhận của lò (phễu -1228..-1196)
         xEnd   -897  : thọc 20 vào trong nhà Trạm S4 (mép trái S4 = -917) */
    S4_TO_FURNACE: { ys: [257.5, 327.5], xStart: -1220, xEnd: -897 },

    /* =========================================================================
     * TUYẾN ĐƯỜNG XE BEN: máng quặng thành phẩm -> LÒ CAO.
     * Các đỉnh đi theo đúng mũi tên trên bản vẽ:
     *   (694,1722) nhận quặng dưới ống xả -> lùi ra khỏi khu xả (566,1722)
     *   -> xuống mép dưới bản vẽ (566,1806) -> chạy dài sang trái (-913,1806)
     *   -> ngược lên hành lang GIỮA bãi chứa và trạm lấy mẫu (-913,445)
     *   -> rẽ trái vào hố đổ quặng ở sân lò cao (-1240,445).
     * LÒ CAO ĐÃ ĐẨY LÊN nên điểm rẽ cũng lên theo: 772 -> 445 (= tâm hố đổ mới,
     * feed 422..468). Đoạn dọc dừng ở 445 nên mép trên đường (425) vẫn cách đáy
     * Trạm S4 (382) 43 đơn vị — không đè vào nhà trạm.
     * Bề rộng 40 nằm gọn trong lòng làn xe cũ (cao 48) nên hai thứ nối liền mạch.
     * ======================================================================= */
    TRUCK_ROAD: {
        width: 40,
        points: [[694, 1722], [566, 1722], [566, 1806], [-913, 1806], [-913, 445], [-1240, 445]],
        count: 5, speed: 3.2, loadFrames: 200, dumpFrames: 160,
    },

    /* Trạm S2 — TOÀ NHÀ 2 TẦNG nhìn từ trên xuống. */
    S2: { x: 96, y: -296, w: 150, h: 118, floors: 2 },   // x>=75 để không bị cắt mép trái
    /* Trạm S1 — TOÀ NHÀ 5 TẦNG nhìn từ trên xuống. */
    S1: { w: 210, h: 200, floors: 5 },

    /* KHUNG KÍNH MỜ (frosted) phủ dải xe ghi thiêu kết. Bám ĐÚNG mép trên/dưới
       xe ghi (TRACK.yTop=158 .. yBottom=322) -> KHÔNG tràn ra ngoài dải xe ghi.
       (Đã BỎ khung mờ phía lò điểm hoả theo yêu cầu.) */
    // Bắt đầu ĐÚNG từ vạch xanh lá (x=375) -> đã cắt bỏ phần làm mờ phía trái.
    GLASS_STRAND: { x: 375, y: 158, width: 821, height: 164 },

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

/* --- Trạm S2 — TOÀ NHÀ 2 TẦNG nhìn từ trên xuống --- */

/* Toà nhà nhìn TỪ TRÊN XUỐNG (mái bằng công nghiệp):
   - Bệ/sân bao quanh + bóng đổ mềm
   - Các tầng GIẬT CẤP (mỗi bậc mái = 1 tầng), sáng dần lên cao
   - Mái tầng trên cùng: lõi thang bộ + buồng thang máy + 2 cụm điều hoà + bồn nước
   - Ô cửa mái (skylight) chạy dọc mái, rãnh thoát nước, mái đua lối vào
   -> nhìn ra được số tầng và không còn "thô" như khối hộp đặc. */
const drawBuildingTopDown = (g, w, h, floors, roof) => {
    g.clear();

    /* --- bóng đổ mềm (2 lớp) --- */
    g.lineStyle(0);
    g.beginFill(COLORS.ink, 0.10);
    g.drawRoundedRect(10, 12, w, h, 12);
    g.endFill();
    g.beginFill(COLORS.ink, 0.10);
    g.drawRoundedRect(5, 6, w, h, 12);
    g.endFill();

    /* --- sân/bệ bê tông bao quanh chân nhà --- */
    g.lineStyle(1.5, COLORS.borderGray, 0.85);
    g.beginFill(COLORS.surfaceLight, 0.95);
    g.drawRoundedRect(-7, -7, w + 14, h + 14, 12);
    g.endFill();

    /* --- các tầng giật cấp --- */
    const inset = Math.max(9, Math.min(18, (Math.min(w, h) * 0.42) / floors));
    let ix = 0, iy = 0, fw = w, fh = h;
    for (let f = 0; f < floors; f++) {
        ix = f * inset; iy = f * inset * 0.72;
        fw = w - ix * 2; fh = h - iy * 2;
        if (fw < 26 || fh < 26) break;
        const t = f / Math.max(1, floors - 1);
        const col = lerpColor(roof, COLORS.steelLight, 0.06 + 0.66 * t);
        // vệt bóng của bậc trên đổ xuống mái bậc dưới
        if (f > 0) {
            g.lineStyle(0);
            g.beginFill(COLORS.ink, 0.13);
            g.drawRoundedRect(ix - 4, iy - 4, fw + 8, fh + 8, 9);
            g.endFill();
        }
        g.lineStyle(2, COLORS.machineDark, 0.85);
        g.beginFill(col, 0.99);
        g.drawRoundedRect(ix, iy, fw, fh, 8);
        g.endFill();
        // gờ mái (parapet) chạy quanh mép mỗi bậc
        g.lineStyle(1.2, COLORS.white, 0.5);
        g.drawRoundedRect(ix + 4, iy + 4, fw - 8, fh - 8, 6);
    }

    /* --- chi tiết trên MÁI tầng trên cùng --- */
    const cx0 = ix, cy0 = iy, cw = fw, ch = fh;
    if (cw > 40 && ch > 40) {
        // lõi thang bộ + buồng thang máy
        g.lineStyle(1.8, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.machineBody, 0.98);
        g.drawRoundedRect(cx0 + 9, cy0 + 9, Math.min(30, cw * 0.34), Math.min(24, ch * 0.2), 4);
        g.endFill();
        g.beginFill(COLORS.steelFrame, 0.98);
        g.drawRoundedRect(cx0 + 9, cy0 + 9 + Math.min(24, ch * 0.2) + 5, Math.min(22, cw * 0.26), 14, 3);
        g.endFill();
        // 2 cụm điều hoà / quạt mái
        g.lineStyle(1.5, COLORS.machineDark, 0.85);
        for (let k = 0; k < 2; k++) {
            const ux = cx0 + cw - 34, uy = cy0 + 12 + k * 26;
            if (uy + 18 < cy0 + ch - 8) {
                g.beginFill(COLORS.steelLight, 0.98);
                g.drawRoundedRect(ux, uy, 24, 18, 3);
                g.endFill();
                g.lineStyle(1, COLORS.borderGray, 0.9);
                for (let i = 1; i <= 3; i++) { g.moveTo(ux + i * 6, uy + 3); g.lineTo(ux + i * 6, uy + 15); }
                g.lineStyle(1.5, COLORS.machineDark, 0.85);
            }
        }
        // bồn nước tròn
        g.lineStyle(1.6, COLORS.machineDark, 0.9);
        g.beginFill(COLORS.dustLight, 0.98);
        g.drawCircle(cx0 + cw - 20, cy0 + ch - 20, 8);
        g.endFill();
        // ô cửa mái (skylight) chạy dọc giữa mái
        g.lineStyle(0);
        g.beginFill(COLORS.surfaceLight, 0.92);
        for (let sy = cy0 + 16; sy < cy0 + ch - 20; sy += 20) {
            g.drawRoundedRect(cx0 + cw * 0.42, sy, Math.min(16, cw * 0.16), 11, 2);
        }
        g.endFill();
        // rãnh thoát nước mái
        g.lineStyle(1, COLORS.borderGray, 0.75);
        g.moveTo(cx0 + 6, cy0 + ch / 2); g.lineTo(cx0 + cw - 6, cy0 + ch / 2);
    }

    /* --- mái đua lối vào (cạnh dưới) --- */
    g.lineStyle(1.8, COLORS.machineDark, 0.8);
    g.beginFill(COLORS.steelFrame, 0.95);
    g.drawRoundedRect(w * 0.30, h - 3, w * 0.30, 14, 4);
    g.endFill();
};

const drawStationS2Box = (g) => drawBuildingTopDown(g, CFG.S2.w, CFG.S2.h, CFG.S2.floors, COLORS.industrialOrange);

const StationS2 = () => (
    <Container x={CFG.S2.x} y={CFG.S2.y}>
        <Graphics draw={drawStationS2Box} />
    </Container>
);

/* --- Trạm S1 — TOÀ NHÀ 5 TẦNG nhìn từ trên xuống (giật cấp rõ 5 bậc mái) --- */
const drawStationS1Box = (g) =>
    drawBuildingTopDown(g, LAYOUT.s1Box.width, LAYOUT.s1Box.height, CFG.S1.floors, COLORS.industrialOrange);

const StationS1 = () => (
    <Container x={LAYOUT.s1Box.x} y={LAYOUT.s1Box.y}>
        <Graphics draw={drawStationS1Box} />
    </Container>
);

/* =============================================================================
 * KHU THÀNH PHẨM — NHÀ SÀNG 3 TẦNG + 4 TUYẾN BĂNG
 * Vẽ SỚM NHẤT trong TopFeedingSection để toàn bộ sơ đồ cũ nằm đè lên trên:
 *   - hộp Trạm S1 che đầu phải băng vàng
 *   - nhà trạm khử sắt che đầu phải băng đỏ
 *   - hộp Trạm S2 che đầu trên băng xanh đi lên
 * Riêng NHÀ SÀNG vẽ NGAY SAU 4 băng nên nó che chỗ 2 băng xanh xuyên qua và che
 * đầu trái của băng đỏ/vàng -> nhìn như các băng cắm thẳng vào nhà sàng.
 * ===========================================================================*/
const drawScreenHouseBox = (g) =>
    drawBuildingTopDown(
        g, CFG.SCREEN_HOUSE.width, CFG.SCREEN_HOUSE.height,
        CFG.SCREEN_HOUSE.floors, COLORS.siloBody,
    );

const drawS3Box = (g) =>
    drawBuildingTopDown(g, CFG.S3.width, CFG.S3.height, CFG.S3.floors, COLORS.industrialOrange);

/* TRẠM TRUNG CHUYỂN S4 — chặng cuối trước khi quặng sang máng gang. */
const drawS4Box = (g) =>
    drawBuildingTopDown(g, CFG.S4.width, CFG.S4.height, CFG.S4.floors, COLORS.industrialOrange);

/* Sinh cục liệu cho 1 đống trong bãi chứa — bộ số giả ngẫu nhiên HẠT CỐ ĐỊNH
   nên đống không nhảy chỗ mỗi lần vẽ lại. */
const makePile = (seed0, R, deg, n = 130) => {
    let seed = seed0;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
    const a0 = ((deg - 62) * Math.PI) / 180;
    const a1 = ((deg + 62) * Math.PI) / 180;
    return Array.from({ length: n }, () => {
        const a = a0 + rnd() * (a1 - a0);
        const t = 0.25 + Math.sqrt(rnd()) * 0.72;
        return {
            x: Math.cos(a) * t * R,
            y: Math.sin(a) * t * R,
            r: 2.4 + rnd() * 4.6,
            c: BLACK_SINTER_COLORS[Math.floor(rnd() * BLACK_SINTER_COLORS.length)],
        };
    });
};
const YARD_PILES = CFG.STOCK_YARD.booms.map((b, i) =>
    makePile(20260728 + i * 7919, CFG.STOCK_YARD.sweepR, b.deg));

/* BÃI CHỨA THÀNH PHẨM + 2 MÁY ĐÁNH ĐỐNG - RÚT LIỆU.
   Dựng theo bản vẽ mặt bằng: băng gallery chạy dọc giữa bãi, mỗi máy đặt trên
   gallery, cần quay quét một vòng tròn và vun ra một đống hình quạt.
   Không gắn nhãn. */
const drawStockYard = (g) => {
    const Y = CFG.STOCK_YARD;
    const { width: w, height: h, galleryY: gy, sweepR: R } = Y;
    g.clear();

    // sân bê tông + hàng rào bãi.
    // LỚP LÓT ĐỤC vẽ trước: nền bãi vốn chỉ đục 22% nên đầu 2 băng tải cắm từ
    // trên xuống vẫn lộ xuyên qua, nhìn như băng nổi trên mái nhà vòm.
    g.lineStyle(0);
    g.beginFill(COLORS.white, 1);
    g.drawRoundedRect(-12, -12, w + 24, h + 24, 14);
    g.endFill();
    g.lineStyle(2.5, COLORS.machineDark, 0.5);
    g.beginFill(COLORS.dustLight, 0.22);
    g.drawRoundedRect(-12, -12, w + 24, h + 24, 14);
    g.endFill();
    g.lineStyle(1.5, COLORS.machineDark, 0.30);
    g.drawRect(8, 8, w - 16, h - 16);

    Y.booms.forEach((b, i) => {
        g.lineStyle(1.4, COLORS.machineDark, 0.35);      // vòng quét của cần
        g.drawCircle(b.cx, gy, R);
        g.lineStyle(0);                                   // đống liệu hình quạt
        YARD_PILES[i].forEach((p) => {
            g.beginFill(p.c, 0.9);
            g.drawRect(b.cx + p.x - p.r, gy + p.y - p.r, p.r * 2, p.r * 2);
            g.endFill();
        });
    });

    // BĂNG GALLERY chạy NGANG giữa bãi (trước đây chạy dọc)
    g.lineStyle(2, COLORS.machineDark, 0.9);
    g.beginFill(COLORS.dustGray, 0.9);
    g.drawRect(22, gy - 11, w - 44, 22);
    g.endFill();

    // Thân cần + trụ quay + gàu rót nay do <StackerReclaimer> vẽ và làm hoạt
    // ảnh riêng, xem phần render bên dưới.

};

/* KHU XẢ XE BEN: 2 silo xanh + ống xả + đường xe ben chạy dưới. */
const drawTruckArea = (g) => {
    const A = CFG.TRUCK_AREA;
    g.clear();
    g.lineStyle(2.5, COLORS.siloBorder, 0.85);
    g.beginFill(COLORS.dustLight, 0.28);
    g.drawRoundedRect(0, 0, A.width, A.height, 16);
    g.endFill();
};

const drawTruckSilos = (g) => {
    const S = CFG.TRUCK_SILOS, A = CFG.TRUCK_AREA, L = CFG.TRUCK_LANE;
    const lx = S.x - A.x;
    g.clear();
    // ỐNG XẢ chạy từ silo trên, luồn sau silo dưới, xuống tới đường xe ben
    g.lineStyle(2, COLORS.machineDark, 0.9);
    g.beginFill(COLORS.dustGray, 0.95);
    g.drawRect(lx - 9, S.ys[0] - A.y, 18, (L.y - A.y) - (S.ys[0] - A.y));
    g.endFill();
    // 2 SILO
    S.ys.forEach((sy) => {
        const cy = sy - A.y;
        g.lineStyle(3, COLORS.siloBorder);
        g.beginFill(COLORS.siloBody, 0.95);
        g.drawCircle(lx, cy, S.radius);
        g.endFill();
        g.lineStyle(1.5, COLORS.siloBorder, 0.6);
        g.drawCircle(lx, cy, S.radius * 0.62);
        g.lineStyle(0);
        g.beginFill(COLORS.machineDark, 0.35);
        g.drawCircle(lx, cy, S.radius * 0.24);
        g.endFill();
    });
};

/* BẾN XẢ XE BEN: chỉ còn LÀN ĐƯỜNG + vạch kẻ.
   2 xe ben vẽ cứng trước đây ĐÃ BỎ — nay là đoàn xe CHẠY THẬT do <HaulTrucks>
   điều khiển: đứng nhận quặng ngay tại bến này rồi chở sang lò cao. */
const drawTruckLane = (g) => {
    const L = CFG.TRUCK_LANE;
    g.clear();
    g.lineStyle(2, COLORS.machineDark, 0.75);
    g.beginFill(COLORS.machineDark, 0.16);
    g.drawRoundedRect(0, 0, L.width, L.height, 6);
    g.endFill();
    g.lineStyle(2, COLORS.dustLight, 0.9);                       // vạch tim đường
    for (let x = 8; x < L.width - 8; x += 22) {
        g.moveTo(x, L.height / 2);
        g.lineTo(x + 12, L.height / 2);
    }
};

/* Nền khu vực máng quặng thành phẩm: chỉ là sân bê tông bo góc + viền mảnh,
   KHÔNG có nhãn, để silo và băng nổi rõ lên trên. */
const drawTroughArea = (g) => {
    const { width: w, height: h } = CFG.TROUGH_AREA;
    g.clear();
    g.lineStyle(2.5, COLORS.siloBorder, 0.85);
    g.beginFill(COLORS.dustLight, 0.28);
    g.drawRoundedRect(0, 0, w, h, 16);
    g.endFill();
    g.lineStyle(1.5, COLORS.siloBorder, 0.45);
    g.drawRoundedRect(9, 9, w - 18, h - 18, 10);
};

const drawSampleHouseBox = (g) =>
    drawBuildingTopDown(g, CFG.SAMPLE_HOUSE.width, CFG.SAMPLE_HOUSE.height,
                        CFG.SAMPLE_HOUSE.floors, COLORS.siloBorder);

/* Băng "liệu thành phẩm ĐỦ CỠ HẠT": mỗi hạt bốc cỡ ngẫu nhiên trong dải
   1.0 .. 2.6 nên trên cùng một băng có cả cục to lẫn hạt mịn.
   Trước đây phải CHỒNG 2 BĂNG (lớp 2.6 + lớp 1.0) mới ra hiệu ứng này -> tốn
   gấp đôi số hạt; nay MainConveyorPlaceHolder nhận particleScale dạng dải nên
   1 lớp là đủ, nhìn y hệt mà nhẹ đi một nửa.
   PRODUCT_GRAIN để ở cấp module (không tạo mảng mới mỗi lần render) để useMemo
   sinh hạt bên trong băng không bị chạy lại liên tục. */
const PRODUCT_GRAIN = [1.0, 2.6];

const ProductBelt = ({ x, y, length, angle = 0, reverseFlow = false }) => (
    <MainConveyorPlaceHolder
        x={x} y={y} length={length} angle={angle} reverseFlow={reverseFlow}
        particleColors={BLACK_SINTER_COLORS} particleScale={PRODUCT_GRAIN}
    />
);

/* =============================================================================
 * KHU LẤY MẪU — SILO MÁNG — TRẠM S3
 * Vẽ SỚM (cùng tầng với 2 cột băng dọc thành phẩm) rồi 2 nhà trạm vẽ đè lên để
 * che các đầu băng, cho ra hiệu ứng băng cắm thẳng vào nhà.
 * ===========================================================================*/
const SampleAndS3Area = () => {
    const SB = CFG.S3_BELTS, SO = CFG.SAMPLE_OUT, TS = CFG.TROUGH_SILOS;
    return (
        <>
            {/* 2 băng LÊN LÒ NẤU GANG (trên S3) + 2 băng TỪ TRẠM LẤY MẪU (dưới S3).
                Cả 4 đều CHIỀU ĐI LÊN -> không reverseFlow. */}
            {SB.columns.map((cx) => (
                <React.Fragment key={`s3-${cx}`}>
                    {/* Trạm S3 -> Trạm trung chuyển S4 */}
                    <ProductBelt x={cx} y={SB.toFurnaceLower.yTop} angle={90}
                                 length={SB.toFurnaceLower.yBottom - SB.toFurnaceLower.yTop} />
                    {/* Trạm lấy mẫu -> Trạm S3 */}
                    <ProductBelt x={cx} y={SB.fromSample.yTop} angle={90}
                                 length={SB.fromSample.yBottom - SB.fromSample.yTop} />
                </React.Fragment>
            ))}

            {/* KHU VỰC MÁNG QUẶNG THÀNH PHẨM — nền + viền bao cả cụm, vẽ TRƯỚC
                mọi thứ nên nằm dưới cùng, không che băng và silo. */}
            <Container x={CFG.TROUGH_AREA.x} y={CFG.TROUGH_AREA.y}>
                <Graphics draw={drawTroughArea} />
            </Container>

            {/* 2 ĐƯỜNG ỐNG HƠI về trạm phát điện — vẽ SỚM NHẤT nên mọi thiết bị
                bắc ngang qua đều nằm trên, giống ống hơi luồn dưới giàn ống. */}
            <SteamLines {...CFG.STEAM_LINES} />

            {/* MẶT ĐƯỜNG tuyến xe ben đi lò cao — vẽ SỚM nên mọi băng tải bắc
                ngang qua (băng đổ ra nhà vòm...) đều nằm TRÊN, đúng kiểu cầu
                băng vượt đường trong nhà máy. Đoàn xe vẽ ở cuối sơ đồ. */}
            <HaulRoad points={CFG.TRUCK_ROAD.points} width={CFG.TRUCK_ROAD.width} />

            {/* 2 BĂNG NGANG sang cụm silo máng (trước là 1) — mỗi băng nuôi một
                dãy silo, liệu ĐI TỪ TRÁI SANG (reverseFlow). Mật độ giữ nguyên. */}
            {SO.ys.map((by) => (
                <ProductBelt key={`sampleout-${by}`}
                             x={SO.xStart} y={by} length={SO.xEnd - SO.xStart} reverseFlow />
            ))}

            {/* BĂNG HỒI trong rãnh giữa 2 dãy silo — chuyển ngược quặng thành
                phẩm từ trong máng về Trạm lấy mẫu (liệu chạy PHẢI -> TRÁI). */}
            <ProductBelt x={CFG.TROUGH_RETURN.xStart} y={CFG.TROUGH_RETURN.y}
                         length={CFG.TROUGH_RETURN.xEnd - CFG.TROUGH_RETURN.xStart} />

            {/* BĂNG ĐỔ từ cụm silo máng XUỐNG BĂNG HỒI — cột chuyển tiếp đứng
                ở đầu phải, nối băng cấp dãy trên -> băng hồi -> băng cấp dãy dưới. */}
            <ProductBelt x={CFG.TROUGH_DROP.x} y={CFG.TROUGH_DROP.yTop} angle={90}
                         reverseFlow
                         length={CFG.TROUGH_DROP.yBottom - CFG.TROUGH_DROP.yTop} />

            {/* KHU XẢ XE BEN: nền khu -> ống xả + 2 silo -> đường xe ben */}
            <Container x={CFG.TRUCK_AREA.x} y={CFG.TRUCK_AREA.y}>
                <Graphics draw={drawTruckArea} />
                <Graphics draw={drawTruckSilos} />
            </Container>
            <Container x={CFG.TRUCK_LANE.x} y={CFG.TRUCK_LANE.y}>
                <Graphics draw={drawTruckLane} />
            </Container>

            {/* CỤM SILO MÁNG: 2 dãy x 5 silo, mỗi dãy ngồi trên một băng.
                Không gắn số hiệu (index rỗng) theo yêu cầu không thêm tag name. */}
            {TS.xs.map((sx) => (
                <React.Fragment key={`trough-${sx}`}>
                    <SiloPlaceHolder x={sx} y={TS.rowTopY} index="" textYOffset={0} />
                    <SiloPlaceHolder x={sx} y={TS.rowBottomY} index="" textYOffset={0} />
                </React.Fragment>
            ))}

            {/* BĂNG ĐỔ QUẶNG từ Trạm S3 ra NHÀ VÒM (liệu chạy PHẢI -> TRÁI) */}
            <ProductBelt x={CFG.DOME_FEED.xStart} y={CFG.DOME_FEED.y}
                         length={CFG.DOME_FEED.xEnd - CFG.DOME_FEED.xStart} />

            {/* 2 BĂNG CHUYỀN QUẶNG: NHÀ VÒM THÀNH PHẨM -> LÒ CAO (băng DỌC, liệu
                ĐI LÊN). Vẽ TRƯỚC bãi chứa và sân lò để hai đầu băng bị 2 công
                trình che, nhìn như băng cắm thẳng vào trong nhà. */}
            {CFG.FURNACE_FEED.columns.map((cx) => (
                <ProductBelt key={`furnace-feed-${cx}`}
                             x={cx} y={CFG.FURNACE_FEED.yTop} angle={90}
                             length={CFG.FURNACE_FEED.yBottom - CFG.FURNACE_FEED.yTop} />
            ))}

            {/* 2 BĂNG CHUYỀN QUẶNG: TRẠM TRUNG CHUYỂN S4 -> LÒ CAO (băng NGANG,
                liệu chạy PHẢI -> TRÁI). Chặng cuối của tuyến quặng thành phẩm.
                Vẽ trước sân lò (trái) và nhà Trạm S4 (phải) nên cả 2 đầu băng
                đều bị công trình đè lên, trông như cắm thẳng vào nhà. */}
            {CFG.S4_TO_FURNACE.ys.map((by) => (
                <ProductBelt key={`s4-furnace-${by}`}
                             x={CFG.S4_TO_FURNACE.xStart} y={by}
                             length={CFG.S4_TO_FURNACE.xEnd - CFG.S4_TO_FURNACE.xStart} />
            ))}

            {/* BÃI CHỨA THÀNH PHẨM + 2 MÁY ĐÁNH ĐỐNG-RÚT LIỆU — vẽ trước 2 nhà
                trạm, che đầu trái băng đổ từ Trạm S3 sang. */}
            <Container x={CFG.STOCK_YARD.x} y={CFG.STOCK_YARD.y}>
                <Graphics draw={drawStockYard} />
                {/* 2 MÁY ĐÁNH ĐỐNG có hoạt ảnh: cần quật qua quật lại + rót quặng */}
                {CFG.STOCK_YARD.booms.map((b) => (
                    <StackerReclaimer
                        key={`stacker-${b.cx}`}
                        cx={b.cx} cy={CFG.STOCK_YARD.galleryY} r={CFG.STOCK_YARD.sweepR}
                        deg={b.deg} sweep={b.sweep} speed={b.speed} phase={b.phase}
                    />
                ))}
            </Container>

            {/* LOGO NHÀ MÁY ở góc trên - trái, chỗ bản vẽ còn trống. */}
            <Sprite
                image={CFG.PLANT_LOGO.src}
                x={CFG.PLANT_LOGO.x} y={CFG.PLANT_LOGO.y}
                width={CFG.PLANT_LOGO.width} height={CFG.PLANT_LOGO.height}
            />

            {/* LÒ CAO — vẽ SAU 2 băng từ nhà vòm nên sân lò che gọn đầu băng. */}
            <BlastFurnacePlant {...CFG.BLAST_FURNACE} />

            {/* HAI HẠNG MỤC THU HỒI NHIỆT DƯ — vẽ SAU đường ống hơi nên nhà trạm
                che gọn đầu ống, nhìn như ống cắm thẳng vào trong nhà. */}
            {/* ỐNG NƯỚC LÀM MÁT — vẽ TRƯỚC hai nhà trạm nên hai đầu ống bị nhà
                che, nhìn như ống cắm thẳng vào trong. */}
            <CoolingWaterLines {...CFG.COOLING_WATER} />

            <WaterRecircStation {...CFG.WATER_STATION} />
            <PowerPlant {...CFG.POWER_STATION} />

            {/* 2 NHÀ TRẠM vẽ SAU CÙNG -> đè lên đầu các băng */}
            <Container x={CFG.SAMPLE_HOUSE.x} y={CFG.SAMPLE_HOUSE.y}>
                <Graphics draw={drawSampleHouseBox} />
            </Container>
            <Container x={CFG.S3.x} y={CFG.S3.y}>
                <Graphics draw={drawS3Box} />
            </Container>
            {/* TRẠM TRUNG CHUYỂN S4 — đè lên 2 đầu băng lên lò gang */}
            <Container x={CFG.S4.x} y={CFG.S4.y}>
                <Graphics draw={drawS4Box} />
            </Container>
        </>
    );
};

const ProductAreaVerticals = () => {
    const B = CFG.PRODUCT_BELTS;
    return (
        <>
            {/* ĐOẠN TRÊN nhà sàng — hồi nguội < 5mm, CẢ 2 CỘT đều ĐI LÊN Trạm S2,
                cùng cỡ hạt nhỏ 0.85 (mật độ thưa, giống nhau tuyệt đối). */}
            {B.columns.map((cx) => (
                <MainConveyorPlaceHolder
                    key={`up-${cx}`}
                    x={cx} y={B.upper.yTop} length={B.upper.yBottom - B.upper.yTop}
                    angle={90}
                    particleColors={BLACK_SINTER_COLORS} particleScale={0.85}
                />
            ))}

            {/* ĐOẠN DƯỚI nhà sàng — thành phẩm, CẢ 2 CỘT đều ĐI XUỐNG, cùng kiểu
                2 lớp hạt (to 2.6 + nhỏ 1.0) cho mật độ dày và đủ dải cỡ hạt. */}
            {B.columns.map((cx) => (
                <ProductBelt
                    key={`down-${cx}`}
                    x={cx} y={B.lower.yTop} length={B.lower.yBottom - B.lower.yTop}
                    angle={90} reverseFlow
                />
            ))}
        </>
    );
};

/* Băng ĐỎ + băng VÀNG + NHÀ SÀNG — vẽ MUỘN (ngay trước Trạm S1) để băng xả
   quặng từ máy làm mát vòng CHUI XUỐNG DƯỚI 3 băng ngang (2 băng về Trạm S1 và
   băng vàng), không còn cắt ngang đè lên như trước. */
const ProductAreaTransfer = () => {
    const B = CFG.PRODUCT_BELTS;
    return (
        <>
            {/* (1) ĐỎ — trạm khử sắt -> nhà sàng, liệu ĐI TỪ PHẢI SANG TRÁI.
                   Cỡ hạt/màu y hệt băng xả thiêu kết -> trạm khử sắt. */}
            <MainConveyorPlaceHolder
                x={B.fromIron.xStart} y={B.fromIron.y}
                length={B.fromIron.xEnd - B.fromIron.xStart}
                particleColors={BLACK_SINTER_COLORS} particleScale={2.2}
            />

            {/* (2) VÀNG — nhà sàng -> Trạm S1, liệu ĐI TỪ TRÁI SANG PHẢI.
                   Cỡ hạt bằng băng liệu lót đen cấp cho xe ghi. */}
            <MainConveyorPlaceHolder
                x={B.toS1.xStart} y={B.toS1.y}
                length={B.toS1.xEnd - B.toS1.xStart}
                reverseFlow particleScale={1.8}
            />

            {/* NHÀ SÀNG THÀNH PHẨM 3 TẦNG — đè lên đầu các băng để trông liền mạch */}
            <Container x={CFG.SCREEN_HOUSE.x} y={CFG.SCREEN_HOUSE.y}>
                <Graphics draw={drawScreenHouseBox} />
            </Container>
        </>
    );
};

/* =============================================================================
 * 4a) CỤM DÂY CHUYỀN THIÊU KẾT — dùng CHUNG cho DÂY CHUYỀN 1 và DÂY CHUYỀN 2
 * Cụm được tách thành 5 mảnh A..E ĐÚNG THỨ TỰ CHỒNG LỚP cũ, để dây chuyền 1
 * vẫn xen kẽ được các lớp băng tải cấp liệu / silo / nhà nghiền ở giữa; còn dây
 * chuyền 2 chỉ việc gọi liền A->E trong 1 Container đã lật 180°.
 * Các mảnh KHÔNG nhận props (mọi toạ độ đọc thẳng từ CFG/LAYOUT) nên muốn lật
 * cả cụm chỉ cần đổi transform của Container cha.
 * Lưu ý: mảnh chỉ là Fragment -> KHÔNG sinh thêm Container Pixi, thứ tự chồng
 * lớp của dây chuyền 1 giữ nguyên y hệt trước khi tách.
 * ===========================================================================*/

/* A — xe ghi, vệt hút, tuyến băng xả, máy làm mát vòng, ống gió + phễu gió.
       beltLength: chiều dài BĂNG XẢ QUẶNG. Đây là tham số DUY NHẤT khác nhau
       giữa 2 dây chuyền, vì cả hai cùng đổ vào MỘT trạm khử sắt đặt thiên về
       phía dây chuyền 2 -> băng dây 1 phải dài hơn băng dây 2. */
const SinterLinePartA = ({ beltLength = CFG.COOLER_OUT.beltLength }) => (
    <>
        {/* --- LỚP 0.5: XE GHI chạy xuyên dưới toàn bộ thiết bị (đúng tầng bản vẽ) --- */}
        <PalletCarTrack
            track={CFG.TRACK}
            zones={{
                linerX: CFG.LINING_SILO.x,
                linerBand: 45,
                feederX: CFG.FEEDER.rollerClusters[0].cx,
                furnaceLeft: CFG.FURNACE.frame.x,
                furnaceRight: CFG.FURNACE.frame.x + CFG.FURNACE.frame.width,
            }}
            labelDy={58}
        />

        {/* Vệt gió/bụi mờ trên mặt xe ghi: hút từ tâm ra 2 bên hông xuống phễu */}
        <TrackSuction
            area={{
                xStart: CFG.WINDBOX.xStart, xEnd: CFG.WINDBOX.xEnd,
                yTop: CFG.TRACK.yTop, height: CFG.TRACK.height,
            }}
        />

        {/* --- TUYẾN XẢ của máy làm mát: vẽ TRƯỚC vành -> nằm DƯỚI máy làm mát,
            bị vành che một đoạn như băng chui dưới sàn vành.
            Chiều chạy: ĐI RA khỏi máy làm mát (xuống dưới, về Trạm S1) --- */}
        <ChainConveyorSegment
            x={CFG.COOLER_OUT.x} y={CFG.COOLER_OUT.yTop}
            length={CFG.COOLER_OUT.chainLength} angle={90}
            reverse={false}
        />
        <MainConveyorPlaceHolder
            x={CFG.COOLER_OUT.x} y={CFG.COOLER_OUT.yTop + CFG.COOLER_OUT.chainLength}
            length={beltLength} angle={90} hasMaterial={false}
        />
        <MainConveyorPlaceHolder
            x={CFG.COOLER_OUT.x} y={CFG.COOLER_OUT.yTop + CFG.COOLER_OUT.chainLength}
            length={beltLength} angle={90}
            showBackground={false} clipMask="none"
            reverseFlow                       // hạt chạy XUỐNG = ra khỏi máy làm mát
            particleColors={BLACK_SINTER_COLORS} particleScale={2.2}
        />

        {/* --- MÁY LÀM MÁT VÒNG: máng đầy liệu quay ngược kim đồng hồ,
            dãy quạt hướng trục áp sát vỏ máy hút gió mát từ ngoài vào --- */}
        <AnnularCooler {...CFG.COOLER} />

        {/* Quặng nguội bị lưỡi gạt hớt ra, trượt NGANG dọc máng xả sang đầu
            băng tải xích (vuông góc với băng) */}
        <OrePourStream
            from={CFG.COOLER_POUR_OUT.from} to={CFG.COOLER_POUR_OUT.to}
            width={CFG.COOLER_POUR_OUT.width} count={26}
            colors={BLACK_SINTER_COLORS} sizeRange={[3, 7]} speed={0.02}
        />

        {/* --- LỚP 0.7: ỐNG GIÓ TỔNG + PHỄU ỐNG GIÓ 2 bên hông track --- */}
        <WindMainDuct
            y={CFG.WIND_DUCT.topY} xStart={CFG.WIND_DUCT.xStart}
            xEnd={CFG.WIND_DUCT.xEnd} height={CFG.WIND_DUCT.height}
        />
        <WindMainDuct
            y={CFG.WIND_DUCT.bottomY} xStart={CFG.WIND_DUCT.xStart}
            xEnd={CFG.WIND_DUCT.xEnd} height={CFG.WIND_DUCT.height}
        />
        <WindBoxRow
            y={CFG.WINDBOX.topY} stemY={CFG.TRACK.yTop}
            xStart={CFG.WINDBOX.xStart} xEnd={CFG.WINDBOX.xEnd}
            count={CFG.WINDBOX.count} radius={CFG.WINDBOX.radius}
            ductY={CFG.WIND_DUCT.topY + CFG.WIND_DUCT.height / 2}
        />
        <WindBoxRow
            y={CFG.WINDBOX.bottomY} stemY={CFG.TRACK.yTop + CFG.TRACK.height}
            xStart={CFG.WINDBOX.xStart} xEnd={CFG.WINDBOX.xEnd}
            count={CFG.WINDBOX.count} radius={CFG.WINDBOX.radius}
            ductY={CFG.WIND_DUCT.bottomY - CFG.WIND_DUCT.height / 2}
        />
    </>
);

/* B — lò điểm hoả, động cơ đẩy xe, bố liệu, nghiền trục đơn, con thoi rải liệu */
const SinterLinePartB = () => (
    <>
        {/* --- LỚP 3.5: LÒ ĐIỂM HOẢ + BỐ LIỆU (xe ghi đã chuyển xuống lớp đáy) --- */}
        <IgnitionFurnace
            frame={CFG.FURNACE.frame}
            columns={CFG.FURNACE.columns}
            yTop={CFG.FURNACE.burnersYTop}
            yBottom={CFG.FURNACE.burnersYBottom}
        />
        {/* Động cơ đẩy xe ghi: trên rìa track, cùng cột silo lót, đai xuống trục quay */}
        <DriveMotor
            motor={CFG.DRIVE_MOTOR}
            axle={{ x: CFG.TRACK.xRight, y: CFG.TRACK.yTop - 6 }}
        />

        <FeederWithRollers
            drum={CFG.FEEDER.drum}
            rollerClusters={CFG.FEEDER.rollerClusters}
            rollerSize={CFG.FEEDER.rollerSize}
        />

        {/* Nghiền trục đơn ở cuối đường xe (vị trí toa vừa cắt bớt) */}
        <SingleRollCrusher {...CFG.ROLL_CRUSHER} />

        {/* Dòng liệu thiêu kết ĐỔ XUỐNG dọc trụ nghiền: tảng đen to phân bổ
            trên trụ, rơi xuống và được nghiền NHỎ DẦN, mật độ thưa để lộ trụ */}
        <SinterCrusher
            roll={{
                x: CFG.ROLL_CRUSHER.x,
                yTop: CFG.ROLL_CRUSHER.y - CFG.ROLL_CRUSHER.height / 2,
                height: CFG.ROLL_CRUSHER.height,
            }}
        />

        {/* Quặng vừa nghiền, CÒN NÓNG, đổ thành MÀN RỘNG suốt chiều dài trục
            nghiền qua phễu nạp sang lòng máng máy làm mát vòng */}
        <OrePourStream
            from={CFG.COOLER_POUR_IN.from} to={CFG.COOLER_POUR_IN.to}
            width={CFG.COOLER_POUR_IN.width} count={95}
            colors={BLACK_SINTER_COLORS} sizeRange={[3.5, 8]} speed={0.017}
            hot
        />

        {/* Con thoi rải liệu: chạy qua-lại trên mặt bố liệu; vẽ TRƯỚC băng liệu
            hỗn hợp nên khi chạy sang nửa bên đó sẽ khuất sau băng + silo */}
        <ShuttleDistributor
            rail={{ x: CFG.SHUTTLE.x, yTop: CFG.SHUTTLE.yTop, yBottom: CFG.SHUTTLE.yBottom }}
            size={{ width: CFG.SHUTTLE.width, height: CFG.SHUTTLE.height }}
            speed={CFG.SHUTTLE.speed}
        />
    </>
);

/* C — dòng liệu nâu đổ từ bố liệu xuống mặt xe ghi */
const SinterLinePartC = () => (
    <>
        {/* Dòng liệu nâu đổ từ bố liệu xuống phủ lên xe ghi */}
        <MaterialFall area={CFG.MATERIAL_FALL} />
    </>
);

/* D — silo liệu hỗn hợp + silo liệu lót của dây chuyền */
const SinterLinePartD = () => (
    <>
        {/* Silo quặng TRỘN (nâu, đè trên băng dọc từ S1 lên) + Silo quặng LÓT (ngoài xưởng) */}
        <MaterialSilo
            x={CFG.MIX_SILO.x} y={CFG.MIX_SILO.y} radius={CFG.MIX_SILO.radius}
            bodyColor={0x795548}
        />
        <MaterialSilo
            x={CFG.LINING_SILO.x} y={CFG.LINING_SILO.y} radius={CFG.LINING_SILO.radius}
            bodyColor={0x616a6b}
        />
    </>
);

/* G — HỆ KHÍ (nồi hơi nhiệt dư + tuần hoàn khí thải). TÁCH RIÊNG vì dây chuyền
       2 phải LẬT NGƯỢC LẠI cụm này (xem mục 4b): nồi hơi luôn nằm PHÍA TRÊN xe
       ghi, tuần hoàn khí (xanh) luôn nằm PHÍA DƯỚI — giống hệt dây chuyền 1. */
/* boiler: cấu hình nồi hơi + TUYẾN ỐNG NHIỆT từ máy làm mát sang nồi.
   Mặc định = CFG.BOILER (bố trí dây chuyền 1, chụp ở cung TRÊN).
   Dây chuyền 2 truyền CFG.BOILER_LINE2 để dùng tuyến ống kiểu mới. Đây là điểm
   DUY NHẤT khác nhau giữa hệ khí 2 dây chuyền. */
const SinterLineGasSystem = ({ boiler = CFG.BOILER }) => (
    <>
        {/* 1) Nồi hơi nhiệt dư 20 MW hút khí nóng 3 sector đầu máy làm mát vòng. */}
        <WasteHeatBoiler {...boiler} />
        {/* 2) Hệ tuần hoàn khí thải hút phễu 20,21 + 1,2,3 + nhiệt giữa vành,
               thổi ngược nhiệt xuống mặt xe ghi thiêu kết. */}
        <FlueGasRecirculation {...CFG.FLUE_RECIRC} />
    </>
);

/* E — lọc bụi tĩnh điện + quạt gió chính, khung kính mờ (lớp trên cùng của cụm).
       TRẠM KHỬ SẮT đã tách khỏi đây: nay CHỈ CÒN 1 TRẠM DÙNG CHUNG cho cả 2 dây
       chuyền, vẽ riêng một lần trong TopFeedingSection. */
const SinterLinePartE = () => (
    <>
        {/* HỆ XỬ LÝ KHÍ THẢI cuối đường: (1) lọc bụi tĩnh điện + (2) quạt gió chính */}
        <ExhaustTreatment {...CFG.EXHAUST} />

        {/* KHUNG KÍNH MỜ phủ đúng dải xe ghi (không tràn ra ngoài) */}
        <GlassPane frame={CFG.GLASS_STRAND} />
    </>
);

/* =============================================================================
 * 4b) DÂY CHUYỀN 2 — ẢNH GƯƠNG (lật 180°) CỦA DÂY CHUYỀN 1 QUA TRẠM S1
 * TRỤC LẬT = đường NGANG đi qua TÂM hộp Trạm S1 (y = 675). Container đặt tại
 * y = 2 x tâm kèm scale.y = -1 thì mọi điểm p vẽ tại (px, 2 x tâm - py).
 *   -> x GIỮ NGUYÊN: cả 2 dây chuyền cùng chiều máy làm mát vòng ở TRÁI, lò
 *      điểm hoả + bố liệu + lọc bụi/quạt ở PHẢI (không bị quay ngược đầu).
 *   -> y lấy gương: dây 2 nằm hẳn phía dưới, ĐỐI XỨNG TUYỆT ĐỐI với dây 1.
 * Vì trục lật đi qua đúng tâm S1 nên:
 *   - 2 băng cấp liệu bố liệu (lining-vert / mix-vert) của hai dây cùng toạ độ
 *     x (1442.5 / 1577.5), cùng chiều dài 362, một băng chạy LÊN một băng chạy
 *     XUỐNG, cắm vào S1 đúng 10px ở mép trên / mép dưới -> đối xứng chuẩn.
 *   - 2 tuyến băng xả cùng chạy trên cột x = 258 vào CHUNG 1 trạm khử sắt.
 * Cụm không chứa <Text> nào nên lật KHÔNG sinh chữ ngược.
 *
 * NGOẠI LỆ — HỆ KHÍ (nồi hơi nhiệt dư + tuần hoàn khí thải):
 * Nếu để phép gương tác động vào cụm này thì dây chuyền 2 sẽ bị nồi hơi rơi
 * xuống dưới còn ống tuần hoàn khí (xanh) vọt lên trên — NGƯỢC hẳn dây chuyền 1.
 * Cách xử lý: LẬT NGƯỢC LẠI một lần nữa quanh TRỤC TÂM XE GHI (y = 240 = tâm
 * dải xe ghi 158..322). Hai phép lật triệt tiêu nhau, còn lại đúng một phép
 * TỊNH TIẾN -> hệ khí của dây chuyền 2 GIỐNG 100% dây chuyền 1: nồi hơi ở TRÊN,
 * tuần hoàn khí thải ở DƯỚI. Chọn đúng trục y=240 vì hệ ống gió/phễu gió/xe ghi
 * vốn đối xứng qua trục này (ống gió trên 108 <-> ống gió dưới 372) nên mọi
 * điểm đấu nối của hệ khí vẫn khớp khít y như dây chuyền 1.
 * ===========================================================================*/
const LINE2_GAS_FLIP_AXIS = CFG.TRACK.yTop + CFG.TRACK.height / 2;   // = 240
const LINE2_PIVOT = {
    x: LAYOUT.s1Box.x + LAYOUT.s1Box.width / 2,
    y: LAYOUT.s1Box.y + LAYOUT.s1Box.height / 2,
};

/* =============================================================================
 * VÙNG BẮT CHUỘT CỦA CÁC HẠNG MỤC (cho bảng thông tin pop-up)
 * Danh mục + nội dung nằm ở diagramHotspots.jsx; ở đây chỉ ráp toạ độ thật.
 * Hạng mục nào có ở cả 2 dây chuyền sẽ tự sinh thêm bản dây 2 bằng cách lấy
 * gương qua ĐÚNG trục mà SinterLine2 đang dùng (tâm Trạm S1).
 * ===========================================================================*/
/* Hệ khí (nồi hơi + tuần hoàn khí thải) của dây 2 bị lật HAI LẦN nên rốt cuộc
   chỉ là TỊNH TIẾN, không lật. Vùng bắt chuột của 2 hạng mục đó phải theo đúng
   phép biến đổi này, lấy gương như phần còn lại là trỏ sai chỗ ~360 đơn vị. */
const LINE2_GAS_SHIFT = LINE2_PIVOT.y * 2 - LINE2_GAS_FLIP_AXIS * 2;   // = 850

const HOTSPOTS = buildHotspots(CFG, LAYOUT, LINE2_PIVOT.y, LINE2_GAS_SHIFT);

/* Các dòng của bảng danh mục bên cạnh sơ đồ — đánh số theo chiều đi của liệu. */
const FLOW_ROWS = buildFlowRows(HOTSPOTS);

/* Đổi toạ độ FEED-LOCAL -> toạ độ điểm ảnh trên canvas (khớp đúng phép biến đổi
   của camera ảo + Container cụm nạp liệu), để đặt bảng HTML nằm chồng lên canvas. */
const feedRectToCanvas = (rects) => {
    const z = STAGE.camera.zoom;
    const ox = STAGE.camera.x + z * CFG.FEEDING_SECTION.x;
    const oy = STAGE.camera.y + z * CFG.FEEDING_SECTION.y;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    rects.forEach((r) => {
        x0 = Math.min(x0, ox + z * r.x);
        y0 = Math.min(y0, oy + z * r.y);
        x1 = Math.max(x1, ox + z * (r.x + r.w));
        y1 = Math.max(y1, oy + z * (r.y + r.h));
    });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/* 2 băng dọc cấp liệu từ Trạm S1 lên silo — lật cùng cụm để dây chuyền 2 cũng
   được Trạm S1 cấp liệu (nền xám + lớp hạt, đúng cặp như dây chuyền 1). */
const FeedBeltPair = ({ id }) => {
    const c = LAYOUT.conveyors.find((b) => b.id === id);
    if (!c) return null;
    return (
        <>
            <MainConveyorPlaceHolder
                x={c.x} y={c.y} length={c.length} angle={c.angle}
                hasMaterial={false} beltHeight={c.beltHeight}
            />
            <MainConveyorPlaceHolder
                x={c.x} y={c.y} length={c.length} angle={c.angle}
                reverseFlow={c.reverseFlow} clipMask={c.clipMask}
                showBackground={false}
                particleColors={c.particleColors} particleScale={c.particleScale}
                beltHeight={c.beltHeight}
            />
        </>
    );
};

const SinterLine2 = () => (
    <Container x={0} y={LINE2_PIVOT.y * 2} scale={{ x: 1, y: -1 }}>
        {/* Băng xả NGẮN HƠN dây 1: trạm khử sắt dùng chung nằm thiên về dây 2 */}
        <SinterLinePartA beltLength={CFG.COOLER_OUT.beltLength2} />
        <FeedBeltPair id="lining-vert" />
        <SinterLinePartB />
        <FeedBeltPair id="mix-vert" />
        <SinterLinePartC />
        <SinterLinePartD />

        {/* HỆ KHÍ lật ngược lại quanh trục tâm xe ghi -> nồi hơi vẫn ở TRÊN, tuần
            hoàn khí vẫn ở DƯỚI giống dây chuyền 1. RIÊNG tuyến ống nhiệt từ máy
            làm mát vòng sang nồi thì dùng bố trí RIÊNG của dây chuyền 2. */}
        <Container y={LINE2_GAS_FLIP_AXIS * 2} scale={{ x: 1, y: -1 }}>
            <SinterLineGasSystem boiler={CFG.BOILER_LINE2} />
        </Container>

        <SinterLinePartE />
    </Container>
);

/* =============================================================================
 * 4) CỤM NẠP LIỆU — lắp ráp từ dữ liệu LAYOUT
 * Thứ tự 4 lớp (dưới lên): nền xám -> vá góc -> hạt liệu -> thiết bị.
 * ===========================================================================*/
const TopFeedingSection = ({ x, y }) => (
    <Container x={x} y={y}>

        {/* ===== KHU THÀNH PHẨM (phần dọc) — vẽ ĐẦU TIÊN, nằm dưới cùng ===== */}
        <ProductAreaVerticals />

        {/* ===== KHU LẤY MẪU - SILO MÁNG - TRẠM S3 (cùng tầng đáy) ===== */}
        <SampleAndS3Area />

        {/* BĂNG CẤP LIỆU VÀO DÃY SILO — vẽ SỚM, trước cả dãy silo, nên chân các
            ống rót bị silo che, nhìn như rót thẳng vào trong silo. */}
        <SiloFeedLine {...CFG.SILO_FEED} />

        {/* ===== DÂY CHUYỀN 1 — cụm gốc, xen kẽ đúng thứ tự chồng lớp cũ ===== */}
        <SinterLinePartA />

        {/* --- LỚP 1: NỀN XÁM của tất cả băng tải (tắt hạt liệu) --- */}
        {LAYOUT.conveyors.filter((c) => !c.noBackground && !c.topLayer).map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-bg-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                hasMaterial={false}
                beltHeight={c.beltHeight}
            />
        ))}

        {/* --- LỚP 2: MẢNG VÁ GÓC CHỮ L (đè lên che mí nối nền xám) --- */}
        {LAYOUT.cornerPatches.map((p) => (
            <CornerPatch key={p.id} x={p.x} y={p.y} variant={p.variant} />
        ))}

        {/* --- LỚP 3: CHỈ HẠT LIỆU (màu/cỡ hạt tuỳ từng băng) --- */}
        {LAYOUT.conveyors.filter((c) => !c.noParticles && !c.topLayer).map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-flow-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                reverseFlow={c.reverseFlow}
                clipMask={c.clipMask}
                showBackground={false}
                particleColors={c.particleColors}
                particleScale={c.particleScale}
                beltHeight={c.beltHeight}
            />
        ))}

        <SinterLinePartB />

        {/* --- LỚP 3.7: BĂNG CẤP LIỆU HỖN HỢP nằm CHỒNG LÊN TRÊN bố liệu --- */}
        {LAYOUT.conveyors.filter((c) => c.topLayer).map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-top-bg-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                hasMaterial={false}
                beltHeight={c.beltHeight}
            />
        ))}
        {LAYOUT.conveyors.filter((c) => c.topLayer).map((c) => (
            <MainConveyorPlaceHolder
                key={`belt-top-flow-${c.id}`}
                x={c.x} y={c.y}
                length={c.length}
                angle={c.angle}
                reverseFlow={c.reverseFlow}
                clipMask={c.clipMask}
                showBackground={false}
                particleColors={c.particleColors}
                particleScale={c.particleScale}
                beltHeight={c.beltHeight}
            />
        ))}
        <SinterLinePartC />

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

        {/* NHÀ NGHIỀN THAN: băng than là 1 ĐƯỜNG THẲNG chạy qua TRÊN ĐỈNH dãy silo.
            Vẽ SAU dãy silo để băng đè lên đỉnh silo. */}
        <CoalCrushingPlant {...CFG.COAL_PLANT} />

        <SinterLinePartD />

        {/* HỆ KHÍ dây chuyền 1: nồi hơi nhiệt dư (trên) + tuần hoàn khí thải (dưới) */}
        <SinterLineGasSystem />

        {/* ===== DÂY CHUYỀN 2 — lấy gương qua TÂM TRẠM S1 ======================
            Vẽ TRƯỚC Trạm S1 để nhà trạm đè lên chân 2 băng cấp liệu của dây 2. */}
        <SinterLine2 />

        {/* KHU THÀNH PHẨM (băng đỏ + băng vàng + nhà sàng) — vẽ SAU băng xả của
            máy làm mát vòng nên băng xả nằm CHUI XUỐNG DƯỚI, không đè lên nữa. */}
        <ProductAreaTransfer />

        {/* Trạm S1 ở cuối 2 băng ngang dưới (toạ độ feeding-local nên đặt trong section này) */}
        <StationS1 />

        {/* TRẠM KHỬ SẮT DÙNG CHUNG — chỉ MỘT trạm cho cả 2 dây chuyền, nằm trong
            khoảng hở giữa 2 dây và thiên về phía dây chuyền 2. Vẽ SAU cả 2 dây +
            sau 2 băng ngang về S1 nên nhà trạm luôn nổi trên mọi băng cắt qua. */}
        <IronRemovalStation {...CFG.IRON_STATION} />

        <SinterLinePartE />

        {/* ĐOÀN XE BEN chở quặng thành phẩm sang LÒ CAO — vẽ CUỐI CÙNG nên xe
            luôn nổi trên mặt đường và mọi công trình mà tuyến đi qua. */}
        <HaulTrucks
            points={CFG.TRUCK_ROAD.points}
            count={CFG.TRUCK_ROAD.count}
            speed={CFG.TRUCK_ROAD.speed}
            loadFrames={CFG.TRUCK_ROAD.loadFrames}
            dumpFrames={CFG.TRUCK_ROAD.dumpFrames}
        />
    </Container>
);

/* =============================================================================
 * 5) STAGE GỐC
 * ===========================================================================*/
/* =============================================================================
 * TIẾT KIỆM TÀI NGUYÊN — DỪNG HẲN VÒNG VẼ KHI KHÔNG AI NHÌN
 * Sơ đồ có hàng trăm nghìn hạt liệu chạy liên tục. Trước đây nó vẫn chạy kể cả
 * khi người dùng đã cuộn sang mục khác hoặc chuyển sang tab khác: CPU/GPU nóng
 * lên, máy tự hạ xung, và CÀNG ĐỂ LÂU CÀNG GIẬT.
 * Hai điều kiện dừng:
 *   1) Canvas cuộn ra khỏi màn hình  -> IntersectionObserver
 *   2) Tab trình duyệt bị ẩn         -> sự kiện visibilitychange
 * Quay lại thì chạy tiếp, không mất trạng thái.
 * Component này KHÔNG vẽ gì, chỉ nằm trong <Stage> để lấy được đúng ticker của
 * ứng dụng Pixi này qua useApp() (mỗi Stage có ticker riêng, không phải shared).
 * ===========================================================================*/
const TickerGuard = ({ hostRef, paused }) => {
    const app = useApp();
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    useEffect(() => {
        const host = hostRef.current;
        if (!app || !host) return undefined;
        const ticker = app.ticker;

        let onScreen = true;
        let tabVisible = !document.hidden;
        const sync = () => {
            if (onScreen && tabVisible && !pausedRef.current) {
                if (!ticker.started) ticker.start();
            } else if (ticker.started) {
                ticker.stop();
                /* Vẽ thêm MỘT khung nữa để hình dừng lại không bị trắng.
                   Bọc try/catch: lúc thành phần đang bị gỡ thì renderer có thể
                   đã huỷ, gọi vào là nổ lỗi làm hỏng cả sơ đồ. */
                try { app.renderer.render(app.stage); } catch { /* đã huỷ */ }
            }
        };
        // Đổi trạng thái tạm dừng thì gọi lại sync ngay
        TickerGuard._sync = sync;

        const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); },
                                            { threshold: 0 });
        io.observe(host);
        const onVis = () => { tabVisible = !document.hidden; sync(); };
        document.addEventListener('visibilitychange', onVis);
        sync();

        return () => {
            io.disconnect();
            document.removeEventListener('visibilitychange', onVis);
            TickerGuard._sync = null;
            if (!ticker.destroyed && !ticker.started) ticker.start();
        };
    }, [app, hostRef]);

    /* Bấm nút tạm dừng -> chạy lại sync để bật/tắt vòng vẽ */
    useEffect(() => { if (TickerGuard._sync) TickerGuard._sync(); }, [paused]);

    return null;
};

/* =============================================================================
 * BỘ TỰ HẠ TẢI — giữ sơ đồ chạy mượt trên máy yếu
 * -----------------------------------------------------------------------------
 * Sơ đồ vẽ trên canvas 2220x1367 = 3,0 triệu điểm ảnh mỗi khung hình. Máy có
 * card rời nuốt trôi, máy dùng đồ hoạ tích hợp thì nghẹn.
 * Hai việc thành phần này làm:
 *   1) KHỚP ĐỘ PHÂN GIẢI VỚI CỠ HIỂN THỊ THẬT. Khung sơ đồ trên màn 1920 chỉ
 *      rộng ~1290px trong khi canvas vẽ ở 2220px -> đang vẽ thừa gần 3 lần số
 *      điểm ảnh rồi thu nhỏ lại. Hạ độ phân giải cho khớp là giảm ~66% khối
 *      lượng vẽ mà mắt KHÔNG thấy khác, vì vẫn đúng 1 điểm ảnh trên màn.
 *   2) TỰ ĐO TỐC ĐỘ KHUNG HÌNH. Chậm quá thì hạ tiếp: trước hết khoá 30 khung
 *      hình/giây (đủ mượt cho băng tải), vẫn chậm thì hạ thêm độ phân giải.
 * ===========================================================================*/
const PerfGuard = ({ hostRef }) => {
    const app = useApp();

    useEffect(() => {
        if (!app || !app.renderer) return undefined;
        const renderer = app.renderer;

        let step = 0;                       // 0 = đủ chất lượng, 1 = khoá 30fps, 2 = hạ thêm
        let extra = 1;                      // hệ số hạ thêm độ phân giải

        const applyResolution = () => {
            const host = hostRef.current;
            const w = host ? host.getBoundingClientRect().width : 0;
            if (!w) return;
            // Vẽ vừa đủ cỡ hiển thị; chặn dưới 0.45 cho khỏi vỡ hạt, trên 1 cho
            // khỏi vẽ thừa. Nhân `extra` khi máy quá yếu.
            const want = Math.max(0.45, Math.min(1, (w / STAGE.width) * extra));
            if (Math.abs(renderer.resolution - want) < 0.03) return;
            renderer.resolution = want;
            renderer.resize(STAGE.width, STAGE.height);
        };

        applyResolution();
        const onResize = () => applyResolution();
        window.addEventListener('resize', onResize);
        document.addEventListener('fullscreenchange', onResize);

        /* Đo tốc độ khung hình mỗi giây, chậm thì hạ tải */
        let frames = 0;
        let t0 = performance.now();
        const probe = () => {
            frames += 1;
            const now = performance.now();
            if (now - t0 < 1000) return;
            const fps = (frames * 1000) / (now - t0);
            frames = 0; t0 = now;
            const target = app.ticker.maxFPS || 60;
            if (fps < target * 0.7 && step < 2) {
                step += 1;
                if (step === 1) {
                    app.ticker.maxFPS = 30;
                    console.warn('[Sơ đồ công nghệ] Máy chạy chậm — đã khoá 30 khung hình/giây.');
                } else {
                    extra = 0.75;
                    applyResolution();
                    console.warn('[Sơ đồ công nghệ] Vẫn chậm — đã hạ thêm độ phân giải canvas.');
                }
            }
        };
        app.ticker.add(probe);

        return () => {
            window.removeEventListener('resize', onResize);
            document.removeEventListener('fullscreenchange', onResize);
            if (!app.ticker.destroyed) app.ticker.remove(probe);
        };
    }, [app, hostRef]);

    return null;
};

const PixiStage = () => {
    const hostRef = useRef(null);

    /* --- Trạng thái bảng thông tin hạng mục ---------------------------------
       hover  : đang rê chuột qua hạng mục nào (tự tắt khi rời ra)
       pinned : đã bấm chọn -> bảng đứng yên cho tới khi bấm × hoặc Esc
       Hai bộ đếm giờ tạo độ trễ nhỏ: vào 110ms cho khỏi loé khi lướt ngang,
       ra 260ms để kịp đưa chuột từ sơ đồ vào trong bảng mà bảng không biến mất. */
    const [hovered, setHovered] = useState(null);
    const [pinned, setPinned] = useState(null);
    const enterTimer = useRef(null);
    const leaveTimer = useRef(null);

    const clearTimers = useCallback(() => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
    }, []);
    useEffect(() => clearTimers, [clearTimers]);

    const handleEnter = useCallback((item) => {
        clearTimeout(leaveTimer.current);
        clearTimeout(enterTimer.current);
        enterTimer.current = setTimeout(() => setHovered(item), 110);
    }, []);

    const handleLeave = useCallback(() => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => setHovered(null), 260);
    }, []);

    const handlePick = useCallback((item) => {
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        setHovered(item);
        setPinned((cur) => (cur && cur.key === item.key ? null : item));
    }, []);

    const holdPopup = useCallback(() => clearTimeout(leaveTimer.current), []);
    const releasePopup = useCallback(() => {
        if (pinned) return;
        clearTimeout(leaveTimer.current);
        leaveTimer.current = setTimeout(() => setHovered(null), 200);
    }, [pinned]);

    const closePopup = useCallback(() => {
        clearTimers();
        setPinned(null);
        setHovered(null);
    }, [clearTimers]);

    /* Bắt chuột THẲNG trên thẻ canvas (không qua hệ sự kiện của Pixi — xem lời
       giải thích trong diagramHotspots.jsx). */
    useHotspotPointer({
        hostRef,
        items: HOTSPOTS,
        stage: STAGE,
        camera: STAGE.camera,
        feed: CFG.FEEDING_SECTION,
        onEnter: handleEnter,
        onLeave: handleLeave,
        onPick: handlePick,
    });

    /* --- PHÓNG TO TOÀN MÀN HÌNH ------------------------------------------
       Ở chế độ thường, sơ đồ phải lọt trọn trong phần màn hình còn trống thì
       mới không bị 2 thanh cố định che mất mép trên. Nút này bỏ qua giới hạn
       đó: đưa cả khung sơ đồ ra toàn màn hình, không còn thanh nào che. */
    const [isFull, setIsFull] = useState(false);

    /* (4) TẠM DỪNG / CHẠY. Mặc định CHẠY khi mới vào trang.
       Dừng vòng vẽ cũng là cách hạ tải mạnh nhất cho máy yếu. */
    const [paused, setPaused] = useState(false);

    const toggleFullscreen = useCallback(() => {
        const host = hostRef.current;
        if (!host) return;
        const target = host.closest('.sintering-diagram-wrapper') || host;
        if (document.fullscreenElement) document.exitFullscreen?.();
        else target.requestFullscreen?.();
    }, []);

    useEffect(() => {
        const onChange = () => {
            setIsFull(Boolean(document.fullscreenElement));
            // canvas đổi cỡ -> bắn resize để mọi thứ tính lại
            setTimeout(() => window.dispatchEvent(new Event('resize')), 60);
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    /* Rê chuột từ BẢNG DANH MỤC bên cạnh. Tách riêng khỏi `hovered` (rê trên
       canvas) vì một dòng trong bảng có thể ứng với NHIỀU vùng trên sơ đồ —
       thiết bị có ở cả hai dây chuyền thì phải sáng cả hai chỗ. */
    const [rowHover, setRowHover] = useState(null);
    const handleRowEnter = useCallback((row) => setRowHover(row), []);
    const handleRowLeave = useCallback(() => setRowHover(null), []);
    const handleRowPick = useCallback((row) => {
        const item = HOTSPOTS.find((h) => h.key === row.key);
        if (!item) return;
        clearTimeout(enterTimer.current);
        clearTimeout(leaveTimer.current);
        setHovered(item);
        setPinned((cur) => (cur && cur.key === item.key ? null : item));
    }, []);

    const shown = pinned || hovered;
    const shownRect = useMemo(
        () => (shown ? feedRectToCanvas(shown.rects) : null),
        [shown]
    );

    /* Ưu tiên vùng đang rê trong bảng danh mục, sau đó mới tới vùng đang rê
       trên canvas. */
    const highlightRects = useMemo(() => {
        if (rowHover) return rowHover.rects;
        return shown ? shown.rects : null;
    }, [rowHover, shown]);

    /* Dòng nào trong bảng đang được làm nổi — nối NGƯỢC từ sơ đồ về bảng. */
    const activeRowId = rowHover ? rowHover.id : (shown ? shown.id : null);

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

    /* Thẻ gắn React (#react-sodo-boot) trước đây được hướng dẫn gắn class
       .sintering-diagram-wrapper. Nay khung sơ đồ do chính React dựng ra bên
       trong, nếu thẻ ngoài VẪN còn class đó thì thành hai lớp tỉ lệ lồng nhau
       -> canvas bẹp dí. Gỡ luôn ở đây để không phải sửa index.html. */
    useEffect(() => {
        const boot = hostRef.current && hostRef.current.closest('#react-sodo-boot');
        if (boot) boot.classList.remove('sintering-diagram-wrapper');
    }, []);

    /* TỰ KIỂM TRA khi khởi động: in ra Console (F12) tình trạng của tính năng
       pop-up, và TỰ CHỮA nếu canvas đang bị CSS khoá chuột. Nhờ vậy khi có trục
       trặc chỉ cần mở F12 là biết ngay hỏng ở đâu, không phải mò. */
    useEffect(() => {
        const t = setTimeout(() => {
            const host = hostRef.current;
            const canvas = host && host.querySelector('canvas');
            if (!canvas) {
                console.error('[Sơ đồ công nghệ] Không tìm thấy thẻ canvas — sơ đồ chưa dựng được.');
                return;
            }

            // 1) Canvas có nhận chuột không?
            if (getComputedStyle(canvas).pointerEvents === 'none') {
                canvas.style.pointerEvents = 'auto';           // tự chữa
                console.warn('[Sơ đồ công nghệ] Canvas đang bị CSS khoá chuột — đã tự bật lại. '
                    + 'Nguyên nhân: css/diagram.css vẫn là BẢN CŨ.');
            }

            // 2) File CSS đã có phần định dạng bảng pop-up chưa?
            let cssOk = false;
            for (const sheet of document.styleSheets) {
                try {
                    for (const rule of sheet.cssRules) {
                        if (rule.selectorText && rule.selectorText.includes('sd-pop')) { cssOk = true; break; }
                    }
                } catch { /* stylesheet khác miền, bỏ qua */ }
                if (cssOk) break;
            }
            if (!cssOk) {
                console.warn('[Sơ đồ công nghệ] css/diagram.css CHƯA có định dạng bảng pop-up (.sd-pop). '
                    + 'Bảng vẫn hiện được nhưng sẽ xấu. Hãy chép đè css/diagram.css bằng bản mới.');
            }

            const box = canvas.getBoundingClientRect();
            console.log(`[Sơ đồ công nghệ] Pop-up hạng mục: ĐÃ BẬT — ${HOTSPOTS.length} vùng bắt chuột. `
                + `Canvas ${Math.round(box.width)}x${Math.round(box.height)}px, `
                + `nhận chuột: ${getComputedStyle(canvas).pointerEvents}, `
                + `CSS bảng: ${cssOk ? 'có' : 'THIẾU'}.`);
        }, 300);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className="sd-root">
        <div className="sintering-diagram-layout">

            {/* BẢNG BÊN CẠNH SƠ ĐỒ: khung mô tả luồng + danh mục hạng mục.
                Đặt TRƯỚC khung sơ đồ trong DOM nên nằm bên TRÁI, đúng chỗ trống
                sau khi sơ đồ dồn sang phải. Muốn đảo sang phải thì xem ghi chú
                `flex-direction` ở .sintering-diagram-layout trong diagram.css. */}
            <DiagramSidePanel
                rows={FLOW_ROWS}
                activeId={activeRowId}
                onHoverRow={handleRowEnter}
                onLeaveRow={handleRowLeave}
                onPickRow={handleRowPick}
            />

            <div className="sintering-diagram-wrapper">
        <div ref={hostRef} className="sintering-diagram-host" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Stage
            width={STAGE.width}
            height={STAGE.height}
            options={{
                backgroundAlpha: 0,
                antialias: true,
                // Khoá về 1 để không phải vẽ gấp 4 lần số điểm ảnh trên màn
                // hình HiDPI — canvas vốn đã lớn hơn khung hiển thị.
                resolution: 1,
                autoDensity: false,
                powerPreference: 'high-performance',
            }}
            style={{
                width: '100%', height: '100%', display: 'block', margin: '0 auto',

                /* BẮT BUỘC ĐẶT INLINE, không được chỉ dựa vào diagram.css.
                   Bản diagram.css CŨ có luật `.sintering-diagram-wrapper canvas
                   { pointer-events: none }` — canvas không nhận chuột thì pop-up
                   hạng mục không bao giờ hiện. Luật đó KHÔNG có !important nên
                   style inline ở đây thắng, tính năng chạy được ngay cả khi file
                   CSS chưa kịp cập nhật. */
                pointerEvents: 'auto',

                /* Pixi tự ghi đè touch-action = 'none' lên canvas khi bật hệ sự
                   kiện -> trên di động đặt ngón tay vào sơ đồ là không vuốt cuộn
                   trang được. Đặt lại 'auto' để trả cử chỉ vuốt cho trình duyệt. */
                touchAction: 'auto',
            }}
        >
            {/* Bộ canh vòng vẽ — không vẽ gì, chỉ bật/tắt ticker cho đỡ tốn máy */}
            <TickerGuard hostRef={hostRef} paused={paused} />
            <PerfGuard hostRef={hostRef} />

            {/* CAMERA ẢO: quản lý toạ độ toàn cục (pan qua position, zoom qua scale) */}
            <Container
                position={[STAGE.camera.x, STAGE.camera.y]}
                scale={{ x: STAGE.camera.zoom, y: STAGE.camera.zoom }}
            >
                {/* Cụm nạp liệu chính */}
                <TopFeedingSection x={CFG.FEEDING_SECTION.x} y={CFG.FEEDING_SECTION.y} />

                {/* Trạm S2 (vị trí cố định) — PHẢI vẽ SAU cụm nạp liệu.
                    Trước đây vẽ trước nên 2 băng tải thành phẩm cắm vào đáy nhà
                    trạm bị vẽ ĐÈ LÊN nhà, nhìn như băng nổi trên mái. */}
                <StationS2 />

                {/* KHUNG TÔ SÁNG hạng mục đang trỏ tới — vẽ CUỐI CÙNG nên nằm
                    trên mọi thiết bị. Đặt trong Container cùng gốc toạ độ với
                    cụm nạp liệu để dùng thẳng toạ độ feed-local của CFG.
                    Việc BẮT CHUỘT do useHotspotPointer lo, làm trên thẻ canvas. */}
                <Container x={CFG.FEEDING_SECTION.x} y={CFG.FEEDING_SECTION.y}>
                    <HotspotLayer rects={highlightRects} />
                </Container>
            </Container>
        </Stage>

        {/* HAI NÚT ĐIỀU KHIỂN: tạm dừng và phóng to */}
        <div className="sd-tools">
            <button
                type="button"
                className="sd-btn"
                onClick={() => setPaused((v) => !v)}
                title={paused ? 'Chạy tiếp sơ đồ' : 'Tạm dừng sơ đồ'}
            >
                <span className="sd-btn__ico">{paused ? '\u25B6' : '\u23F8'}</span>
                {paused ? 'Chạy' : 'Tạm dừng'}
            </button>

            <button
                type="button"
                className="sd-btn"
                onClick={toggleFullscreen}
                title={isFull ? 'Thoát toàn màn hình (Esc)' : 'Phóng to toàn màn hình'}
            >
                <span className="sd-btn__ico">{isFull ? '\u2715' : '\u26F6'}</span>
                {isFull ? 'Thoát' : 'Phóng to'}
            </button>
        </div>

        {/* BẢNG THÔNG TIN HẠNG MỤC — HTML thường nằm chồng lên canvas */}
        {shown && shownRect && (
            <HotspotPopup
                key={shown.key}
                item={shown}
                rect={shownRect}
                hostRef={hostRef}
                stage={STAGE}
                pinned={Boolean(pinned)}
                onHold={holdPopup}
                onRelease={releasePopup}
                onClose={closePopup}
            />
        )}
        </div>
            </div>
        </div>

        {/* MÔ PHỎNG 3D — dải RIÊNG chạy hết bề ngang, nằm DƯỚI cả bảng danh mục
            lẫn sơ đồ. Trước đây kẹp trong cột trái nên khung phát bé tí. */}
        <ProcessVideo />
        </div>
    );
};

export default PixiStage;
