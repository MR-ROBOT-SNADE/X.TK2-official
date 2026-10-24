/* =============================================================================
 * js/components/SinteringDiagram/assembly/sinterLine2.jsx — DÂY CHUYỀN 2 = ẢNH GƯƠNG CỦA DÂY 1
 * =============================================================================
 * SinterLine2 (lật dây 1 qua tâm Trạm S1, hệ khí lật ngược lại lần nữa),
 * FeedBeltPair, LINE2_PIVOT / LINE2_GAS_FLIP_AXIS (trục lật).
 *
 * Một phần LẮP RÁP sơ đồ (thư mục assembly/, trước 24/10/2026 nằm chung trong
 * pixiStage.jsx — đọc đầu pixiStage.jsx để biết cả sơ đồ). Toạ độ lấy từ CFG
 * (stageConfig.js) và LAYOUT (layout.js); thiết bị lấy từ diagramContainer.jsx.
 * ===========================================================================*/

import React from 'react';
import { Container } from '@pixi/react';
import { MainConveyorPlaceHolder } from '../diagramContainer.jsx';

import { CFG } from '../stageConfig.js';
import { LAYOUT } from '../layout.js';
import {
    SinterLineGasSystem, SinterLinePartA, SinterLinePartB, SinterLinePartC,
    SinterLinePartD, SinterLinePartE
} from './sinterLine.jsx';

/* =============================================================================
 * DÂY CHUYỀN 2 — ẢNH GƯƠNG (lật 180°) CỦA DÂY CHUYỀN 1 QUA TRẠM S1
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
export const LINE2_GAS_FLIP_AXIS = CFG.TRACK.yTop + CFG.TRACK.height / 2;   // = 240
export const LINE2_PIVOT = {
    x: LAYOUT.s1Box.x + LAYOUT.s1Box.width / 2,
    y: LAYOUT.s1Box.y + LAYOUT.s1Box.height / 2,
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

/* DÂY CHUYỀN 2: các đoạn A..E của dây 1 đặt trong Container lật dọc quanh tâm
   Trạm S1 (xem khung đầu file); riêng hệ khí lật ngược lại lần nữa. */
export const SinterLine2 = () => (
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
