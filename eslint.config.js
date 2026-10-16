module.exports=[
  {ignores:['node_modules/**','.tools/**','.npm-cache/**']},
  {files:['**/*.js'],languageOptions:{ecmaVersion:2023,sourceType:'commonjs',globals:{console:'readonly',process:'readonly',Buffer:'readonly',__dirname:'readonly',setTimeout:'readonly',clearTimeout:'readonly',AbortSignal:'readonly',URL:'readonly',URLSearchParams:'readonly',fetch:'readonly',document:'readonly',location:'readonly',FormData:'readonly',Intl:'readonly',AbortController:'readonly',structuredClone:'readonly'}},rules:{'no-undef':'error','no-unused-vars':['error',{argsIgnorePattern:'^_',varsIgnorePattern:'^_'}],'no-unreachable':'error','no-constant-condition':'error'}}
];
