const js = require("@eslint/js");

module.exports = [
  {
    ignores: ["node_modules/**", "coverage/**", "frontend/js/vendor/**"],
  },
  {
    ...js.configs.recommended,
    files: ["src/**/*.js", "api/**/*.js", "tests/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "writable",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        URL: "readonly",
        fetch: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "error",
      eqeqeq: ["warn", "smart"],
      "no-var": "warn",
    },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: {
      sourceType: "module",
      globals: {
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
  },
  {
    files: ["frontend/js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        location: "readonly",
        fetch: "readonly",
        console: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        CustomEvent: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        Blob: "readonly",
        crypto: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        FormData: "readonly",
        alert: "readonly",
        confirm: "readonly",
        navigator: "readonly",
        HTMLElement: "readonly",
        customElements: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-undef": "off",
    },
  },
];
