import { describe, expect, it } from 'vitest';
import { isActive, navItems, type NavItem } from '@/lib/navigation';

const materials: NavItem = { label: 'Материалы', href: '/materials/', activeUnder: ['/articles'] };

describe('активный пункт навигации', () => {
  it('совпадает с адресом страницы под префиксом и в корне', () => {
    expect(isActive(materials, '/audio-theory/materials/', '/audio-theory/')).toBe(true);
    expect(isActive(materials, '/audio-theory/materials', '/audio-theory/')).toBe(true);
    expect(isActive(materials, '/materials/', '/')).toBe(true);
  });

  it('остаётся активным в связанных разделах, но не на похожих адресах', () => {
    expect(isActive(materials, '/audio-theory/articles/sampling/', '/audio-theory/')).toBe(true);
    expect(isActive(materials, '/audio-theory/articles/', '/audio-theory/')).toBe(true);
    expect(isActive(materials, '/audio-theory/articles-old/', '/audio-theory/')).toBe(false);
    expect(isActive(materials, '/audio-theory/', '/audio-theory/')).toBe(false);
    expect(isActive(materials, '/materials/', '/audio-theory/')).toBe(false);
  });

  it('не делает главную активной на всех страницах', () => {
    const home: NavItem = { label: 'Главная', href: '/' };
    expect(isActive(home, '/', '/')).toBe(true);
    expect(isActive(home, '/materials/', '/')).toBe(false);
  });
});

describe('список пунктов', () => {
  it('содержит только существующие маршруты', () => {
    // Пока нет страниц списка, глоссария и «О проекте», ссылок на них быть не должно.
    expect(navItems).toEqual([]);
  });
});
