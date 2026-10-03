// Блок «Недавно на сайте»: три последние записи, текст, метка и адрес записи с базовым путём.
import { describe, expect, it } from 'vitest';
import { recentUpdates } from '@/lib/recent-updates';

const entry = (id: string, type: 'new' | 'updated', items: string[] = []) => ({
  id,
  date: '2026-10-04',
  type,
  title: 'Волны',
  items: items.map((text) => ({ text })),
});

describe('recentUpdates', () => {
  it('пустой журнал — пустой список', () => {
    expect(recentUpdates([], '/')).toEqual([]);
  });

  it('берёт не больше трёх первых записей', () => {
    const list = ['a', 'b', 'c', 'd'].map((id) => entry(id, 'new'));
    expect(recentUpdates(list, '/').map(({ id }) => id)).toEqual(['a', 'b', 'c']);
  });

  it('«Новое» — название статьи, «Дополнено» — название и первый пункт', () => {
    const [created, added, bare] = recentUpdates(
      [entry('n', 'new'), entry('u', 'updated', ['Фаза', 'Другое']), entry('v', 'updated')],
      '/',
    );
    expect([created.typeLabel, created.text]).toEqual(['Новое', 'Волны']);
    expect([added.typeLabel, added.text]).toEqual(['Дополнено', 'Волны: Фаза']);
    expect(bare.text).toBe('Волны');
    expect(created.dateLabel).toBe('4 октября 2026');
  });

  it('ссылка ведёт на запись архива, базовый путь добавляется один раз', () => {
    const [prefixed] = recentUpdates([entry('n', 'new')], '/audio-theory/');
    expect(prefixed.href).toBe('/audio-theory/updates/2026/#update-n');
    expect(recentUpdates([entry('n', 'new')], '/')[0].href).toBe('/updates/2026/#update-n');
  });
});
