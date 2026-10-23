export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['auth','home','studio','agent','editor','run','template','market','deploy','settings','ui','api-client','mocks','entities','deps']],
    'subject-case': [0],
    'header-max-length': [2, 'always', 72],
  },
};
