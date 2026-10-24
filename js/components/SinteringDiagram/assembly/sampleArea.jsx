/* =============================================================================
 * js/components/SinteringDiagram/assembly/sampleArea.jsx — KHU LẤY MẪU — SILO MÁNG — TRẠM S3
 * =============================================================================
 * SampleAndS3Area, ProductAreaVerticals (2 cột băng dọc thành phẩm),
 * ProductAreaTransfer.
 *
 * Một phần LẮP RÁP sơ đồ (thư mục assembly/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (stageConfig.js) và LAYOUT (layout.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import { Container, Graphics } from '@pixi/react';
import {
    BLACK_SINTER_COLORS, BlastFurnacePlant, CoolingWaterLines, HaulRoad, LogoPlate,
    MainConveyorPlaceHolder, PowerPlant, SiloPlaceHolder, StackerReclaimer, SteamLines,
    WaterRecircStation
} from '../diagramContainer.jsx';

import { CFG } from '../stageConfig.js';
import {
    ProductBelt, drawS3Box, drawS4Box, drawSampleHouseBox, drawScreenHouseBox,
    drawStockYard, drawTroughArea, drawTruckArea, drawTruckLane, drawTruckSilos
} from './productArea.jsx';

/* =============================================================================
 * KHU LẤY MẪU — SILO MÁNG — TRẠM S3
 * Vẽ SỚM (cùng tầng với 2 cột băng dọc thành phẩm) rồi 2 nhà trạm vẽ đè lên để
 * che các đầu băng, cho ra hiệu ứng băng cắm thẳng vào nhà.
 * ===========================================================================*/
export const SampleAndS3Area = () => {
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

            {/* CÁC KHUNG LOGO ở góc trên - trái, chỗ bản vẽ còn trống.
                Chưa nạp ảnh thì hiện khung chờ nét đứt. */}
            {CFG.PLANT_LOGOS.map((lg) => (
                <LogoPlate key={lg.src} {...lg} />
            ))}

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

/* Các tuyến băng DỌC của khu thành phẩm (CFG.PRODUCT_BELTS) — vẽ đầu tiên, nằm
   dưới cùng để các nhà trạm vẽ sau che đầu băng */
export const ProductAreaVerticals = () => {
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
export const ProductAreaTransfer = () => {
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
