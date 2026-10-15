import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // HTML cru vira XSS com qualquer dado digitado (nome, observações, anamnese). Se um dia for
      // preciso, sanitizar (DOMPurify) e liberar só naquele arquivo, com o motivo (task 20).
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Não renderize HTML cru: o React já escapa o texto. Se for inevitável, sanitize com DOMPurify.',
        },
        {
          selector: "AssignmentExpression > MemberExpression[property.name=/^(innerHTML|outerHTML)$/]",
          message: 'Não atribua innerHTML/outerHTML: use textContent ou JSX.',
        },
        {
          selector: "CallExpression[callee.property.name=/^(insertAdjacentHTML|write|writeln)$/][callee.object.name='document'], CallExpression[callee.property.name='insertAdjacentHTML']",
          message: 'Não insira HTML cru no DOM: use JSX.',
        },
      ],
    },
  },
);
