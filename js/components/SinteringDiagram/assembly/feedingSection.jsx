/* =============================================================================
 * js/components/SinteringDiagram/assembly/feedingSection.jsx — CỤM NẠP LIỆU — XẾP LỚP CẢ SƠ ĐỒ
 * =============================================================================
 * TopFeedingSection: xếp lớp mọi thứ của dây chuyền 1 + các khu chung, theo
 * dữ liệu LAYOUT.
 *
 * Một phần LẮP RÁP sơ đồ (thư mục assembly/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (stageConfig.js) và LAYOUT (layout.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import { Container } from '@pixi/react';
import {
    CoalCrushingPlant, DrumMixerTopDown, HaulTrucks, IronRemovalStation,
    MainConveyorPlaceHolder, SiloFeedLine, SiloPlaceHolder
} from '../diagramContainer.jsx';

import { CFG } from '../stageConfig.js';
import { LAYOUT } from '../layout.js';
import { CornerPatch, StationS1 } from './stations.jsx';
import { ProductAreaTransfer, ProductAreaVerticals, SampleAndS3Area } from './sampleArea.jsx';
import {
    SinterLineGasSystem, SinterLinePartA, SinterLinePartB, SinterLinePartC,
    SinterLinePartD, SinterLinePartE
} from './sinterLine.jsx';
import { SinterLine2 } from './sinterLine2.jsx';

/* =============================================================================
 * CỤM NẠP LIỆU — lắp ráp từ dữ liệu LAYOUT
 * Thứ tự 4 lớp (dưới lên): nền xám -> vá góc -> hạt liệu -> thiết bị.
 * ===========================================================================*/
export const TopFeedingSection = ({ x, y }) => (
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
