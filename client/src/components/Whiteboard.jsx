import React, { useRef, useEffect, useState } from 'react';
import { Square, Circle, Minus, Trash2, Edit2, Eraser, Download } from 'lucide-react';
import { encryptText, decryptText } from '../utils/crypto';

export default function Whiteboard({ socket, roomId, roomKey }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#3b82f6');
  const [lineWidth, setLineWidth] = useState(4);
  const [tool, setTool] = useState('pen'); // 'pen' or 'eraser'
  const prevPosRef = useRef({ x: 0, y: 0 });

  const colors = [
    '#ffffff', // White
    '#f87171', // Red
    '#fbbf24', // Yellow
    '#34d399', // Green
    '#3b82f6', // Blue
    '#a78bfa', // Purple
    '#f472b6', // Pink
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set display size (css)
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    // Set actual resolution
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    contextRef.current = context;

    // Redraw if window resizes
    const handleResize = () => {
      // Create backup of current canvas image
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      // Resize
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;

      // Restore settings & image
      context.lineCap = 'round';
      context.lineJoin = 'round';
      context.strokeStyle = color;
      context.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;
      context.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', handleResize);

    // Socket drawing listener
    const handleDrawEvent = async (encryptedData) => {
      if (!roomKey) return;
      try {
        const decryptedJson = await decryptText(encryptedData, roomKey);
        const data = JSON.parse(decryptedJson);

        if (data.clear) {
          clearLocalCanvas();
          return;
        }

        // Draw incoming stroke
        drawStroke(
          data.prevX * canvas.width,
          data.prevY * canvas.height,
          data.currX * canvas.width,
          data.currY * canvas.height,
          data.color,
          data.lineWidth
        );
      } catch (err) {
        console.error('Failed to decrypt incoming whiteboard stroke:', err);
      }
    };

    socket.on('draw-event', handleDrawEvent);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('draw-event', handleDrawEvent);
    };
  }, [socket, roomKey, color, lineWidth, tool]);

  // Draw helper
  const drawStroke = (x0, y0, x1, y1, strokeColor, strokeWidth) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  };

  const getCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    
    // Support Touch Events
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }

    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    prevPosRef.current = coords;
    setIsDrawing(true);
  };

  const draw = async (e) => {
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;

    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;

    const strokeColor = tool === 'eraser' ? '#0f172a' : color;
    const strokeWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth;

    // Draw locally
    drawStroke(prevPosRef.current.x, prevPosRef.current.y, coords.x, coords.y, strokeColor, strokeWidth);

    // Sync with E2EE
    if (roomKey) {
      // Normalize coordinates
      const drawData = {
        prevX: prevPosRef.current.x / canvas.width,
        prevY: prevPosRef.current.y / canvas.height,
        currX: coords.x / canvas.width,
        currY: coords.y / canvas.height,
        color: strokeColor,
        lineWidth: strokeWidth,
      };

      try {
        const encrypted = await encryptText(JSON.stringify(drawData), roomKey);
        socket.emit('draw', { roomId, drawData: encrypted });
      } catch (err) {
        console.error('Failed to encrypt drawing coordinates:', err);
      }
    }

    prevPosRef.current = coords;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleClear = async () => {
    clearLocalCanvas();
    if (roomKey) {
      try {
        const encrypted = await encryptText(JSON.stringify({ clear: true }), roomKey);
        socket.emit('draw', { roomId, drawData: encrypted });
      } catch (err) {
        console.error('Failed to encrypt clear command:', err);
      }
    }
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `syncsphere-whiteboard-${Date.now()}.png`;
    link.href = image;
    link.click();
  };

  return (
    <div className="whiteboard-container">
      {/* Toolbar */}
      <div className="whiteboard-toolbar">
        {/* Tools toggle */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setTool('pen')}
            className={`btn-icon ${tool === 'pen' ? 'active' : ''}`}
            title="Pencil Tool"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`btn-icon ${tool === 'eraser' ? 'active' : ''}`}
            title="Eraser Tool"
          >
            <Eraser size={16} />
          </button>
        </div>

        <div style={{ width: '1px', height: '24px', background: 'hsl(var(--border-color))' }} />

        {/* Colors (only enabled if tool is not eraser) */}
        <div style={{ display: 'flex', gap: '8px', opacity: tool === 'eraser' ? 0.3 : 1 }}>
          {colors.map((c) => (
            <button
              key={c}
              className={`color-dot ${color === c && tool !== 'eraser' ? 'selected' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                if (tool === 'eraser') setTool('pen');
                setColor(c);
              }}
              disabled={tool === 'eraser'}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '24px', background: 'hsl(var(--border-color))' }} />

        {/* Stroke thickness slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Minus size={12} />
          <input
            type="range"
            min="2"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(parseInt(e.target.value))}
            style={{
              flex: 1,
              maxWidth: '120px',
              accentColor: 'hsl(var(--accent-primary))',
              height: '4px',
              borderRadius: '9999px',
              background: 'hsl(var(--border-color))',
              outline: 'none',
              cursor: 'pointer'
            }}
          />
          <span style={{ fontSize: '0.8rem', width: '20px', textAlign: 'right' }}>{lineWidth}</span>
        </div>

        {/* Clear & Save Actions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={downloadCanvas} className="btn-icon" title="Save whiteboard drawing">
            <Download size={16} />
          </button>
          <button onClick={handleClear} className="btn-icon danger" title="Clear Canvas">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <canvas
        ref={canvasRef}
        className="whiteboard-canvas"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
    </div>
  );
}
