import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';

export interface RenderHookResult<T> {
  /** Every value the hook returned, in render order. */
  renders: T[];
  current: () => T;
  unmount: () => void;
}

function mount(node: ReactNode): { root: Root; container: HTMLElement } {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
    true;

  const container = document.createElement('div');
  document.body.appendChild(container);

  let root: Root | undefined;
  act(() => {
    root = createRoot(container);
    root.render(node);
  });

  return { root: root as Root, container };
}

// Hand-rolled instead of @testing-library/react: React 19 exports act itself,
// so a probe component and a root are all these tests need.
export function renderHook<T>(useHook: () => T): RenderHookResult<T> {
  const renders: T[] = [];

  function Probe() {
    renders.push(useHook());
    return null;
  }

  const { root, container } = mount(<Probe />);

  return {
    renders,
    current: () => renders[renders.length - 1],
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function render(node: ReactNode) {
  const { root, container } = mount(node);

  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

export function typeInto(input: HTMLInputElement, value: string): void {
  // React tracks the last value it wrote, so assigning input.value directly is
  // swallowed. Going through the prototype setter is what makes it notice.
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;

  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

export function pressKey(
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...init }));
  });
}
