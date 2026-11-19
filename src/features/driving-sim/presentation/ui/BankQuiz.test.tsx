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

  it('lists what practice missed, with the right answer, and keeps a course quiz silent', async () => {
    const items = QUESTION_BANK.filter(item => item.competency === 'parking').slice(0, 3);
    const render = async (reviewMissed: boolean) => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => {
        root.render(
          <BankQuiz
            items={items}
            kind="quiz"
            title="Short Quiz"
            reviewMissed={reviewMissed}
            onSubmit={async () => [{ competency: 'parking', correct: 2, total: 3, passed: true }]}
            onDone={() => {}}
          />
        );
      });
      for (const [i, item] of items.entries()) {
        // The first item answered wrongly, the rest rightly.
        const want = i === 0 ? item.choices[(item.answer + 1) % item.choices.length] : item.choices[item.answer];
        const button = [...host.querySelectorAll('button')].find(b => b.textContent?.startsWith(want));
        await click(button!);
      }
      return { host, root };
    };

    const practice = await render(true);
    const missed = practice.host.querySelector('[data-testid="missed-items"]');
    expect(missed?.textContent).toContain(items[0].question);
    expect(missed?.textContent).toContain(items[0].choices[items[0].answer]);
    expect(missed?.textContent).not.toContain(items[1].question);
    await act(async () => practice.root.unmount());

    const course = await render(false);
    expect(course.host.querySelector('[data-testid="missed-items"]')).toBeNull();
    await act(async () => course.root.unmount());
  });
});
