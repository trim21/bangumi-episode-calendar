// lint-staged.config.js
export default {
  "*.{ts,md,html,json,cjs,mjs,js,yml,yaml}": "prettier -w",
  "**/pre-commit": "prettier -w",
  "*.ts": ["eslint --fix", () => "tsc -p tsconfig.json --pretty --noEmit"],
};
