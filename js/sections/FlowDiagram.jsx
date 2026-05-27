const { useState } =  React;
const { Background, Controls, MarkerType } = window.ReactFlow;
const ReactFlowComponent = window.ReactFlow.default;

const initialNodes = [
    {
        id: 'Nha-nghien',
        position: { x: 100, y: 150 },
        data: { label: 'NHÀ NGHIỀN ' },
        style: { background: '#2c3e50', color: 'white', fontWeight: 'bold', width: 150, textAlign: 'center' }
    },
    {
        id: 'Nha-phoi',
        position: { x: 500, y: 150 },
        data: { label: 'NHÀ PHỐI LIỆU'}
    }
]