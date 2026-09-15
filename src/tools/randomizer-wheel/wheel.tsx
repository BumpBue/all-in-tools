'use client';

import { useEffect, useRef } from 'react';

import {
  FULL_TURN,
  type Segment,
} from '@/tools/randomizer-wheel/logic';

const SIZE = 320;
const LABEL_RADIUS_RATIO = 0.68;
const LABEL_MAX_CHARS = 14;
const HUB_RATIO = 0.12;
const FONT = '600 13px system-ui, sans-serif';
const RADIANS_PER_DEGREE = Math.PI / 180;
const QUARTER_TURN = 90;

function drawWheel(
  canvas: HTMLCanvasElement,
  segments: Segment[],
  angle: number,
  scale: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  const size = SIZE * scale;
  const centre = size / 2;
  const radius = centre - scale;

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, size, size);
  context.translate(centre, centre);
  // The pointer sits at the top, so the wheel is drawn a quarter turn back.
  context.rotate((angle - QUARTER_TURN) * RADIANS_PER_DEGREE);

  for (const segment of segments) {
    const start = segment.start * RADIANS_PER_DEGREE;
    const end = segment.end * RADIANS_PER_DEGREE;

    context.beginPath();
    context.moveTo(0, 0);
    context.arc(0, 0, radius, start, end);
    context.closePath();
    context.fillStyle = segment.color;
    context.fill();

    context.save();
    context.rotate((start + end) / 2);
    context.textAlign = 'right';
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.font = FONT;

    const label =
      segment.option.label.length > LABEL_MAX_CHARS
        ? `${segment.option.label.slice(0, LABEL_MAX_CHARS - 1)}…`
        : segment.option.label;

    context.fillText(label, radius * LABEL_RADIUS_RATIO, 0);
    context.restore();
  }

  context.beginPath();
  context.arc(0, 0, radius * HUB_RATIO, 0, FULL_TURN * RADIANS_PER_DEGREE);
  context.fillStyle = '#ffffff';
  context.fill();
}

export function Wheel({
  segments,
  angle,
  label,
}: {
  segments: Segment[];
  angle: number;
  label: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Drawn at the device's own pixel density, or the labels blur.
    const scale = window.devicePixelRatio || 1;
    canvas.width = SIZE * scale;
    canvas.height = SIZE * scale;

    drawWheel(canvas, segments, angle, scale);
  }, [angle, segments]);

  return (
    <div className="relative w-fit">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        style={{ width: SIZE, height: SIZE }}
        className="max-w-full rounded-full border border-border"
      />
      <span
        aria-hidden
        className="absolute -top-1 left-1/2 -translate-x-1/2 text-2xl leading-none text-danger"
      >
        ▼
      </span>
    </div>
  );
}

export { SIZE as WHEEL_SIZE };
