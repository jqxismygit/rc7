import { defineConfig } from 'vitest/config';
import { vitestCucumber } from '@deepracticex/vitest-cucumber/plugin';

export default defineConfig({
  plugins: [
    vitestCucumber({
      features: ['features/**/*.feature'],
      steps: 'tests/steps',
    })
  ],
  test: {
    include: ['**/*.feature']
  }
});