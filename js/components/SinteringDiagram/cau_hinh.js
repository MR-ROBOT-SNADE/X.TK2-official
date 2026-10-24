/* =============================================================================
 * js/components/SinteringDiagram/cau_hinh.js — THAM SỐ TINH CHỈNH SƠ ĐỒ (STAGE, CFG)
 * =============================================================================
 * MUỐN DỜI / CO GIÃN SƠ ĐỒ: CHỈ SỬA SỐ Ở ĐÂY. STAGE = cỡ canvas + camera ảo;
 * CFG = mọi kích thước, vị trí của thiết bị. Toạ độ chi tiết còn lại được TỰ
 * TÍNH trong buildLayout() (bo_cuc.js). Trước 24/10/2026 khối này nằm ở đầu
 * pixiStage.jsx.
 *
 * HỆ TOẠ ĐỘ
 *   Toạ độ trong CFG là "feed-local": gốc tại CFG.FEEDING_SECTION. Camera ảo
 *   (STAGE.camera) dời cả cụm rồi thu nhỏ theo zoom để vừa canvas STAGE.width x
 *   STAGE.height. aspect-ratio của khung sơ đồ trong css/diagram.css phải khớp
 *   tỉ lệ width / height này.
 * ===========================================================================*/

/* =============================================================================
 * THAM SỐ TINH CHỈNH
 * Muốn dịch chuyển / co giãn sơ đồ: chỉ sửa các con số trong khối này.
 * Mọi toạ độ còn lại được TỰ TÍNH trong buildLayout() (bo_cuc.js).
 * ===========================================================================*/

/* Sân khấu + camera ảo */
export const STAGE = {
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

/* Mọi kích thước + vị trí của sơ đồ (đơn vị feed-local). Mỗi khối con là một
   khu / thiết bị; chú thích ngay trong từng khối. */
export const CFG = {
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
     * Tuyến QUẶNG HỒI NGUỘI từ Trạm S2 chạy dọc phía TRÊN dãy silo, chỉ rót vào
     * 4 CỘT SILO CUỐI (21, 20, 19, 18) rồi hết.
     * Cột silo n nằm ở x = (21 - n) * 70 + 314  (silo 1 ngoài cùng bên phải).
     *   height 20 : băng mảnh cho khỏi át dãy silo
     *   xEnd 560  : quá cột silo 18 (x 524) một chút là dừng
     * ======================================================================= */
    SILO_FEED: {
        y: -192, height: 20,
        xStart: -620,        // trong lòng Trạm S2 (x -754..-604)
        xEnd: 560,
        chuteTopY: -172, chuteBottomY: -44, chuteW: 11,
        groups: [
            { color: 0x1c2833, xs: [314, 384, 454, 524] },
        ],
    },

    /* =========================================================================
     * KHUNG LOGO — đặt ở khoảng trống góc trên - trái bản vẽ.
     * Khai bao nhiêu phần tử thì có bấy nhiêu khung; thêm/bớt chỉ sửa mảng này.
     * Chưa có ảnh -> hiện KHUNG CHỜ nét đứt kèm nhãn, thấy ngay chỗ và cỡ.
     * Vùng trống cho phép: feed x -1500..-819, y -208..146
     *   mép trái canvas ở feed -1502; sân lò cao bắt đầu từ y 170;
     *   nhà Trạm S2 ở x -754..-604 nên khung dừng trước -819 là an toàn.
     * Cỡ 600 x 115 giữ đúng tỉ lệ ảnh logo gốc 208 x 40 (5,2 : 1).
     * ======================================================================= */
    PLANT_LOGOS: [
        { src: 'images/logo-hoa-phat-3.webp', x: -1470, y: -196, width: 600, height: 115,
          label: 'LOGO TẬP ĐOÀN' },
        { src: 'images/logo-xuong.jpg', x: -1470, y: -60, width: 600, height: 115,
          label: 'LOGO XƯỞNG' },
    ],

    /* =========================================================================
     * ĐƯỜNG ỐNG NƯỚC LÀM MÁT: TRẠM PHÁT ĐIỆN <-> TRẠM NƯỚC TUẦN HOÀN
     * ======================================================================= */
    COOLING_WATER: {
        pipeW: 11,
        paths: [
            /* --- CẶP BÊN PHẢI: nối RA từ trạm nước, men mép phải bản vẽ ---
               Cột dọc x 1872 / 1894 nằm ngoài rìa quạt gió chính dây 2 (kết
               thúc ở x 1862) và vẫn trong khung canvas (mép phải 1913). */
            { hot: true, points: [[1866, 752], [1872, 752], [1872, 1548], [1690, 1548]] },
            { hot: false, back: true, points: [[1888, 740], [1894, 740], [1894, 1702], [1690, 1702]] },

            /* --- CẶP BÊN TRÁI: đường nước VÀO trạm. Hai cột dọc x 1744 / 1762
               lọt đúng khe giữa lọc bụi tĩnh điện dây 2 (kết thúc x 1728) và
               quạt gió chính (bắt đầu x 1778) — khe rộng 50, hai ống rộng 15
               vừa đủ. Đoạn ngang y 1372 / 1394 nằm dưới đuôi dây chuyền 2
               (kết thúc y 1320) và trên nóc nhà bơm (y 1490). */
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
        x: 940, y: 1490, width: 760, height: 270,
        headers: { hotY: 58, coldY: 212, x0: 34, x1: 620 },       // ống nóng về / ống nguội cấp
        pumps: { count: 6, x0: 92, spacing: 96, cy: 135, bodyR: 25, motorW: 34, motorH: 30 },
        tank: { x: 636, y: 40, w: 92, h: 190 },                    // bể tuần hoàn
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
