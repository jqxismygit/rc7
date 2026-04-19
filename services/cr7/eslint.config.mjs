import js from '@eslint/js';
import tsEslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import stylistic from '@stylistic/eslint-plugin';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'coverage/'],
  },
  js.configs.recommended,
  ...tsEslint.configs.recommended,
  prettierConfig,
  stylistic.configs.recommended,
  stylistic.configs.customize({
    semi: true,
    commaDangle: 'only-multiline',
    braceStyle: '1tbs',
  }),
  {
    files: ['src/**/*.ts', 'src/**/*.js', 'config/**/*.ts'],
    languageOptions: {
      parser: tsEslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      '@stylistic/max-len': [
        'error',
        {
          code: 120,
          ignoreComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      parser: tsEslint.parser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: `${import.meta.dirname}/tests/`,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      '@stylistic/max-len': [
        'warn',
        {
          code: 120,
          ignoreComments: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
        },
      ],
    },
  },
  {
    files: ['src/scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  }
];
