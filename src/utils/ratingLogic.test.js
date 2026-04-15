import { buildLeaderboardKey, normalizeScores } from './ratingLogic';

describe('ratingLogic', () => {
  test('normalizeScores keeps backward-compatible legacy fields', () => {
    const normalized = normalizeScores({ inspiration: 7, visual: 8, fluency: 9, professionalism: 10 });

    expect(normalized).toEqual({
      structure: 7,
      fluency: 9,
      professionalism: 10,
      visualDesign: 8,
    });
  });

  test('buildLeaderboardKey prefers presentationKey and falls back to full tuple', () => {
    expect(buildLeaderboardKey({ presentationKey: 'roomA%7C%7Ckey' })).toBe('roomA%7C%7Ckey');

    expect(
      buildLeaderboardKey({
        roomId: 'A605',
        session: 'S2',
        time: '10:10-10:20',
        presenter: 'Alex',
        topic: 'AI Safety',
      })
    ).toBe('A605||S2||10:10-10:20||Alex||AI Safety');
  });
});
