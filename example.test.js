describe('dummy addition helper', () => {
  const add = (a, b) => a + b;

  test('adds two numbers together', () => {
    expect(add(2, 3)).toBe(5);
  });
});
