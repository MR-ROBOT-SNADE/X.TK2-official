/* =============================================================================
 * FlowDiagram.jsx — BẢN THỬ CŨ, HIỆN KHÔNG ĐƯỢC DÙNG
 * -----------------------------------------------------------------------------
 * Phần mở đầu của một bản thử vẽ sơ đồ bằng thư viện React Flow (đọc từ biến
 * toàn cục window.ReactFlow). Không file nào nạp file này và dự án cũng không
 * cài React Flow. Sơ đồ công nghệ hiện tại nằm ở js/components/SinteringDiagram/
 * (vẽ bằng Pixi). Không cần nữa thì xoá được.
 * ===========================================================================*/
const { useState, useCallback } = React;
const { Background, Controls, MarkerType, applyNodeChanges, applyEdgeChanges } = window.ReactFlow;
const ReactFlowComponent = window.ReactFlow.default;
