import js from '@eslint/js'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // The core purity gate. src/core must stay a pure, deterministic,
    // dependency-free simulation: it is what makes auto-resolve, headless
    // balance runs and replays possible. Breaking this silently breaks all three.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['three', 'three/*', 'react', 'react/*', 'react-dom', 'react-dom/*', '@react-three/*', 'zustand', 'zustand/*', 'next', 'next/*', '@/render/*', '@/scenes/*', '@/ui/*'],
              message:
                'src/core must stay pure TypeScript — no three, react, or render-layer imports. See the plan: the core has to run headlessly for auto-resolve, balance harnesses and replays.',
            },
          ],
        },
      ],
      // Determinism gate: unseeded randomness and wall-clock reads make
      // replays and the auto-resolve/live-battle equivalence impossible.
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'src/core must be deterministic — take time as a tick parameter instead.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'src/core must be deterministic — use the seeded rng from @/core/math/rng.' },
        { object: 'Date', property: 'now', message: 'src/core must be deterministic — take time as a tick parameter instead.' },
      ],
    },
  },
)
