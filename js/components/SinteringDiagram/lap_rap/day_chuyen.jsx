/* =============================================================================
 * js/components/SinteringDiagram/lap_rap/day_chuyen.jsx — MỘT DÂY CHUYỀN THIÊU KẾT (DÙNG CHUNG CHO DÂY 1 VÀ DÂY 2)
 * =============================================================================
 * SinterLinePartA..E + SinterLineGasSystem: 5 mảnh đúng thứ tự chồng lớp.
 *
 * Một phần LẮP RÁP sơ đồ (thư mục lap_rap/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (cau_hinh.js) và LAYOUT (bo_cuc.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import {
    AnnularCooler, BLACK_SINTER_COLORS, ChainConveyorSegment, DriveMotor,
    ExhaustTreatment, FeederWithRollers, FlueGasRecirculation, GlassPane, IgnitionFurnace,
    MainConveyorPlaceHolder, MaterialFall, MaterialSilo, OrePourStream, PalletCarTrack,
    ShuttleDistributor, SingleRollCrusher, SinterCrusher, TrackSuction, WasteHeatBoiler,
    WindBoxRow, WindMainDuct
} from '../diagramContainer.jsx';

import { CFG } from '../cau_hinh.js';

/* =============================================================================
 * CỤM DÂY CHUYỀN THIÊU KẾT — dùng CHUNG cho DÂY CHUYỀN 1 và DÂY CHUYỀN 2
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
export const SinterLinePartA = ({ beltLength = CFG.COOLER_OUT.beltLength }) => (
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
export const SinterLinePartB = () => (
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
export const SinterLinePartC = () => (
    <>
        {/* Dòng liệu nâu đổ từ bố liệu xuống phủ lên xe ghi */}
        <MaterialFall area={CFG.MATERIAL_FALL} />
    </>
);

/* D — silo liệu hỗn hợp + silo liệu lót của dây chuyền */
export const SinterLinePartD = () => (
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
       2 phải LẬT NGƯỢC LẠI cụm này (xem lap_rap/day_chuyen_2.jsx): nồi hơi luôn nằm PHÍA TRÊN xe
       ghi, tuần hoàn khí (xanh) luôn nằm PHÍA DƯỚI — giống hệt dây chuyền 1. */
/* boiler: cấu hình nồi hơi + TUYẾN ỐNG NHIỆT từ máy làm mát sang nồi.
   Mặc định = CFG.BOILER (bố trí dây chuyền 1, chụp ở cung TRÊN).
   Dây chuyền 2 truyền CFG.BOILER_LINE2 để dùng tuyến ống kiểu mới. Đây là điểm
   DUY NHẤT khác nhau giữa hệ khí 2 dây chuyền. */
export const SinterLineGasSystem = ({ boiler = CFG.BOILER }) => (
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
export const SinterLinePartE = () => (
    <>
        {/* HỆ XỬ LÝ KHÍ THẢI cuối đường: (1) lọc bụi tĩnh điện + (2) quạt gió chính */}
        <ExhaustTreatment {...CFG.EXHAUST} />

        {/* KHUNG KÍNH MỜ phủ đúng dải xe ghi (không tràn ra ngoài) */}
        <GlassPane frame={CFG.GLASS_STRAND} />
    </>
);
