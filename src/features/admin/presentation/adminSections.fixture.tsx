/**
 * The admin sections' test harness: a renderer that mounts a section in
 * Strict Mode inside a router, and the clicks the sections' tests use.
 * For tests only.
 */
import { StrictMode, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

export const unmount = () => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
};

export const flush = async () => {
  for (let i = 0; i < 6; i++) await act(async () => new Promise(resolve => setTimeout(resolve, 0)));
};

export const mount = async (element: ReactNode) => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() =>
    root!.render(
      <StrictMode>
        <MemoryRouter>{element}</MemoryRouter>
      </StrictMode>
    )
  );
  await flush();
  return host;
};

export const view = () => host!;
export const text = () => host!.textContent ?? '';

export const click = (selector: string) =>
  act(() => host!.querySelector<HTMLElement>(selector)!.dispatchEvent(new MouseEvent('click', { bubbles: true })));

export const clickLabel = (label: string) => click(`[aria-label="${label}"]`);

/** Radix tabs switch on a mouse down, not a click. */
export const pressTab = async (label: string) => {
  const tab = [...host!.querySelectorAll<HTMLElement>('[role="tab"]')].find(each => each.textContent === label)!;
  act(() => {
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  await flush();
};

export const choose = async (label: string, value: string) => {
  act(() => {
    const element = host!.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await flush();
};
