import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

export interface RenderHookResult<T> {
  /** Every value the hook returned, in render order. */
  renders: T[];
  current: () => T;
  unmount: () => void;
}

// Hand-rolled instead of @testing-library/react: React 19 exports act itself,
// and these tests only need a probe component and a root.
export function renderHook<T>(useHook: () => T): RenderHookResult<T> {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  const renders: T[] = [];

  function Probe() {
    renders.push(useHook());
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);

  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
    root.render(<Probe />);
  });

  return {
    renders,
    current: () => renders[renders.length - 1],
    unmount: () => {
      act(() => root?.unmount());
      container.remove();
    },
  };
}
