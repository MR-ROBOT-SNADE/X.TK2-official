import React from 'react';
import { createRoot } from 'react-dom/client';
import PixiStage from './pixiStage.jsx';

const domNode = document.getElementById('react-sodo-boot');


if (domNode) {
    const root = createRoot(domNode);
    root.render(<PixiStage/>);
} else {
    console.error("Cannot find div card name id = 'react-sodo-boot'");
}