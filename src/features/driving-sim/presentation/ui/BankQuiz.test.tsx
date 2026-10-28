// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK } from '@/domain/assessment/questionBank';
import BankQuiz from './BankQuiz';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const click = async (el: Element) => {
  await act(async () => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('the bank quiz', () => {
  it('collects one choice per item, submits once, and shows the per-competency result', async () => {
    const items = QUESTION_BANK.filter(item => item.competency === 'parking').slice(0, 3);
    const submitted: (number | null)[][] = [];
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <BankQuiz
          items={items}
          kind="quiz"
          title="Short Quiz"
          onSubmit={async choices => {
            submitted.push(choices);
            const correct = choices.filter((c, i) => c === items[i].answer).length;
            return [{ competency: 'parking', correct, total: 3, passed: correct >= 2 }];
          }}
          onDone={() => {}}
        />
      );
    });
    for (const item of items) {
      const buttons = [...host.querySelectorAll('button')].filter(b => b.textContent?.includes(item.choices[item.answer]));
      await click(buttons[0]);
    }
    expect(submitted).toHaveLength(1);
    expect(submitted[0]).toEqual(items.map(item => item.answer));
    expect(host.textContent).toContain('3 of 3 passed');
    await act(async () => root.unmount());
  });
});
