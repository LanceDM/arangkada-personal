// Dev-only. A plain <canvas> that redraws by calling the given onDraw(ctx)
// after every render - no requestAnimationFrame, no animation loop. Lets the
// Renderer Lab call the real drawRoad/renderScene/drawCar directly and get a
// single static frame per control change, which also sidesteps rAF being
// throttled when the tab/pane isn't visible.
//
// The canvas's own pixel buffer stays at its native width/height (drawing
// code positions things in those exact coordinates), but it's wrapped in
// useStageScale - the same hook GameScreen.tsx uses for the real driving
// board - so it visually shrinks to fit whatever space the surrounding grid
// column actually has, instead of forcing that column to its full native
// width and pushing/clipping whatever sits next to it.
import { useEffect, useRef } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/features/driving-sim/domain/world/vehiclePhysics';
import { useStageScale } from '@/features/driving-sim/presentation/ui/useStageScale';

const RendererCanvas = ({
  onDraw,
  width = CANVAS_WIDTH,
  height = CANVAS_HEIGHT,
}: {
  onDraw: (ctx: CanvasRenderingContext2D) => void;
  width?: number;
  height?: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { frameRef, scale } = useStageScale(width, height);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    onDraw(ctx);
  });

  return (
    <div ref={frameRef} className="min-w-0">
      <div className="relative" style={{ width: width * scale, height: height * scale }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="absolute left-0 top-0 origin-top-left rounded-2xl border border-border shadow-2xl"
          style={{ transform: `scale(${scale})` }}
        />
      </div>
    </div>
  );
};

export default RendererCanvas;
