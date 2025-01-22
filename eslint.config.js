import eslint from "@eslint/js";
import tseslint from "typescript-eslint";


export default tseslint.config(
    { ignores: ['**/*.{js,d.ts,cjs}'] },
    eslint.configs.recommended,
    tseslint.configs.strictTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                projectService: {
                    allowDefaultProject: [ '*.ts' ]
                },
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
);