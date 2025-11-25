import js from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const eslintConfig = [
  // Global ignores
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      ".turbo/**",
      "dist/**",
    ],
  },

  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript configuration
  ...tseslint.configs.recommended,

  // React and Next.js configuration
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
      "@next/next": nextPlugin,
    },
    rules: {
      // React rules
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs["jsx-runtime"].rules,

      // React Hooks rules
      ...reactHooksPlugin.configs.recommended.rules,

      // Next.js rules
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,

      // TypeScript-specific overrides
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/triple-slash-reference": "off", // Allow triple-slash references for Bun types

      // React-specific overrides
      "react/prop-types": "off", // Using TypeScript for prop validation
      "react/react-in-jsx-scope": "off", // Not needed in Next.js
      "react/no-unescaped-entities": "warn", // Allow unescaped quotes in JSX
      "react/no-unknown-property": [
        "error",
        {
          // Allow 'jsx' and 'global' props (used in style tags)
          ignore: ["jsx", "global"],
        },
      ],

      // React Hooks overrides
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off", // Disable experimental rule with false positives
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
  },
];

export default eslintConfig;
