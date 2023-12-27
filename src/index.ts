// @ts-nocheck

import { HttpsProxyAgent } from 'https-proxy-agent';
import { ScriptKind, Project, SyntaxKind } from 'ts-morph';
import * as recast from 'recast';
import { cosmiconfig } from 'cosmiconfig';
import { createMatchPath } from 'tsconfig-paths';
import { detect } from '@antfu/ni';
import { execa } from 'execa';
import fsExtra, { pathExists } from 'fs-extra';
import { promises, existsSync } from 'fs';
import chalk from 'chalk';
import { tmpdir } from 'os';
import ora from 'ora';
import { parse } from '@babel/parser';
import { transformFromAstSync } from '@babel/core';
import transformTypescript from '@babel/plugin-transform-typescript';
import fetch from 'node-fetch';
import * as path from 'path';
import { Command } from 'commander';
import prompts from 'prompts';
import * as zod from 'zod';

// Component Configuration

const ComponentConfigSchema = zod.object({
  $schema: zod.string().optional(),
  style: zod.string(),
  rsc: zod.coerce.boolean().default(!1),
  tsx: zod.coerce.boolean().default(!0),
  tailwind: zod.object({
    config: zod.string(),
    css: zod.string(),
    baseColor: zod.string(),
    cssVariables: zod.boolean().default(!0),
  }),
  aliases: zod.object({ components: zod.string(), utils: zod.string() }),
}).strict();

const ExtendedComponentConfigSchema = ComponentConfigSchema.extend({
  resolvedPaths: zod.object({
    tailwindConfig: zod.string(),
    tailwindCss: zod.string(),
    utils: zod.string(),
    components: zod.string(),
  }),
});

// Project Configuration

const ProjectConfigurationSchema = zod.object({
  name: zod.string(),
  dependencies: zod.array(zod.string()).optional(),
  registryDependencies: zod.array(zod.string()).optional(),
  files: zod.array(zod.string()),
  type: zod.enum([
    'components:ui',
    'components:component',
    'components:example',
  ]),
});

const registryUrl = process.env.COMPONENTS_REGISTRY_URL ?? 'https://ui.shadcn.com';
const externalRegistryUrl = process.env.EXTERNAL_REGISTRY_URL ?? 'https://v0.dev';
const httpsProxyAgent = process.env.https_proxy ? new HttpsProxyAgent(process.env.https_proxy) : void 0;

const babelParserOptions = {
  sourceType: 'module',
  allowImportExportEverywhere: !0,
  allowReturnOutsideFunction: !0,
  startLine: 1,
  tokens: !0,
  plugins: [
    'asyncGenerators',
    'bigInt',
    'classPrivateMethods',
    'classPrivateProperties',
    'classProperties',
    'classStaticBlock',
    'decimal',
    'decorators-legacy',
    'doExpressions',
    'dynamicImport',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'functionBind',
    'functionSent',
    'importAssertions',
    'importMeta',
    'nullishCoalescingOperator',
    'numericSeparator',
    'objectRestSpread',
    'optionalCatchBinding',
    'optionalChaining',
    ['pipelineOperator', { proposal: 'minimal' }],
    ['recordAndTuple', { syntaxType: 'hash' }],
    'throwExpressions',
    'topLevelAwait',
    'v8intrinsic',
    'typescript',
    'jsx',
  ],
};

const typescriptProject = new Project({ compilerOptions: {} });

const componentsConfigExplorer = cosmiconfig('components', { searchPlaces: ['components.json'] });

// Command Line Interface (CLI)

const addComponentCommand = new Command()
  .name('add')
  .alias('i')
  .description('add a component to your project')
  .argument('id', 'the component id to add')
  .option('-n, --name <name>', 'the filename of the component to add.')
  .option('-y, --yes', 'skip confirmation prompt.', !0)
  .option('-o, --overwrite', 'overwrite existing files.', !1)
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .option('-p, --path <path>', 'the path to add the component to.')
  .action(async (e, t) => {
    await tt(e, t);
  });

const consoleUtils = {
  error(...e) {
    console.log(chalk.red(...e));
  },
  warn(...e) {
    console.log(chalk.yellow(...e));
  },
  info(...e) {
    console.log(chalk.cyan(...e));
  },
  success(...e) {
    console.log(chalk.green(...e));
  },
  break() {
    console.log('');
  },
};

const initCommandOptions = zod.object({ cwd: zod.string(), yes: zod.boolean() });

const initCommand = new Command()
  .name('init')
  .description('initialize your project and install dependencies')
  .option('-y, --yes', 'skip confirmation prompt.', !1)
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd()
  )
  .action(async (e) => {
    await ft(e);
  });

// Type Definitions

const componentsArray = zod.array(ProjectConfigurationSchema);

const extendedProjectConfigSchema = ProjectConfigurationSchema.extend({
  files: zod.array(zod.object({ name: zod.string(), content: zod.string() })),
});

const arrayOfExtendedProjectConfig = zod.array(extendedProjectConfigSchema);

const colorConfiguration = zod.object({
  inlineColors: zod.object({
    light: zod.record(zod.string(), zod.string()),
    dark: zod.record(zod.string(), zod.string()),
  }),
  cssVars: zod.object({
    light: zod.record(zod.string(), zod.string()),
    dark: zod.record(zod.string(), zod.string()),
  }),
  inlineColorsTemplate: zod.string(),
  cssVarsTemplate: zod.string(),
});

const inputObject = zod.object({
  id: zod.string(),
  yes: zod.boolean(),
  overwrite: zod.boolean(),
  cwd: zod.string(),
  path: zod.string().optional(),
  name: zod.string().optional(),
});

// Templates

const tsxTemplate = `import { type ClassValue, clsx } from 'clsx'
  import { twMerge } from 'tailwind-merge'
  
  export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
  }
`;

const jsTemplate = `import { clsx } from 'clsx'
  import { twMerge } from 'tailwind-merge'
  
  export function cn(...inputs) {
    return twMerge(clsx(inputs))
  }
`;

// Default Packages

const defaultPackages = [
  'tailwindcss-animate',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
];

// Functions

async function O(e, t) {
  return createMatchPath(t.absoluteBaseUrl, t.paths)(e, void 0, () => !0, ['.ts', '.tsx']);
}

async function b(e) {
  let t = await Ie(e);

  return t ? await D(e, t) : null;
}

async function D(e, t) {
  let r = createMatchPath(e);

  if (r.resultType === 'failed') {
    throw new Error(`Failed to load tsconfig.json. ${r.message ?? ''}`.trim());
  }

  return ExtendedComponentConfigSchema.parse({
    ...t,
    resolvedPaths: {
      tailwindConfig: path.resolve(e, t.tailwind.config),
      tailwindCss: path.resolve(e, t.tailwind.css),
      utils: await O(t.aliases.utils, r),
      components: await O(t.aliases.components, r),
    },
  });
}

async function Ie(e) {
  try {
    let t = await componentsConfigExplorer.search(e);

    return t ? ComponentConfigSchema.parse(t.config) : null;
  } catch {
    throw new Error(`Invalid configuration found in ${e}/components.json.`);
  }
}

async function S(e) {
  let t = await detect({ programmatic: !0, cwd: e });

  return t === 'yarn@berry'
    ? 'yarn'
    : t === 'pnpm@6'
    ? 'pnpm'
    : t === 'bun'
    ? 'bun'
    : t ?? 'npm';
}

async function K(e) {
  let t = await S(e);

  return t === 'pnpm' ? 'pnpm dlx' : t === 'bun' ? 'bunx' : 'npx';
}

function E(e) {
  typeof e == 'string' && (consoleUtils.error(e), process.exit(1)),
    e instanceof Error && (consoleUtils.error(e.message), process.exit(1)),
    p.error('Something went wrong. Please try again.'),
    process.exit(1);
}

async function Z() {
  try {
    let [e] = await M(['index.json']);
    return componentsArray.parse(e);
  } catch {
    throw new Error('Failed to fetch components from registry.');
  }
}

async function Q(e) {
  try {
    let [t] = await M([`colors/${e}.json`]);
    return colorConfiguration.parse(t);
  } catch {
    throw new Error('Failed to fetch base color from registry.');
  }
}

async function U(e, t) {
  let r = [];

  for (let o of t) {
    let n = e.find((i) => i.name === o);

    if (n && (r.push(n), n.registryDependencies)) {
      let i = await U(e, n.registryDependencies);

      r.push(...i);
    }
  }

  return r.filter((o, n, i) => i.findIndex((m) => m.name === o.name) === n);
}

async function ee(e, t) {
  try {
    const r = t.map((n) => `styles/${e}/${n.name}.json`);
    const o = await M(r);

    return arrayOfExtendedProjectConfig.parse(o);
  } catch {
    throw new Error('Failed to fetch tree from registry.');
  }
}

async function _(e, t, r) {
  if (r && t.type !== 'components:ui') return r;

  let [o, n] = t.type.split(':');

  return o in e.resolvedPaths ? path.join(e.resolvedPaths[o], n) : null;
}

async function M(e) {
  try {
    return await Promise.all(
      e.map(async (r) => {
        await (await fetch(`${registryUrl}/registry/${r}`, { agent: httpsProxyAgent })).json();
      })
    );
  } catch (t) {
    throw (console.log(t), new Error(`Failed to fetch registry from ${registryUrl}.`));
  }
}

async function re(e) {
  try {
    let t = await Ue(e);

    return arrayOfExtendedProjectConfig.parse(t);
  } catch (t) {
    throw (console.log(t), new Error('Failed to fetch components from registry.'));
  }
}

async function Ue(e) {
  try {
    return await Promise.all(
      e.map(async (r) => {
        let o = await fetch(`${externalRegistryUrl}/api/r/${r}`, { agent: httpsProxyAgent });

        if (o.status === 404) throw new Error(`Component ${r} not found.`);

        if (o.status === 401) {
          throw new Error('This is a private component. Use the app at https://v0.dev to copy and paste the code.');
        }

        if (o.status === 200) return await o.json();

        throw new Error(`Failed to fetch component ${r}. ${o.statusText}`);
      })
    );
  } catch (t) {
    throw (console.log(t), new Error(`Failed to fetch component from ${externalRegistryUrl}.`));
  }
}

async function oe({ sourceFile: e, config: t }) {
  let r = e.getImportDeclarations();

  for (let o of r) {
    let n = o.getModuleSpecifierValue();

    if (n.startsWith('@/components/')) {
      o.setModuleSpecifier(n.replace(/^@\/components/, t.aliases.components));
    }
    
    if (n.startsWith('@/registry/')) {
      o.setModuleSpecifier(n.replace(/^@\/registry\/[^/]+/, t.aliases.components));
    }
    
    if (n == '@/lib/utils') {
      const namedImport = o.getNamedImports().find((g) => g.getName() === 'cn');

      if (namedImport) {
        o.setModuleSpecifier(n.replace(/^@\/lib\/utils/, t.aliases.utils));
      }
    }
    
  }

  return e;
};

async function ne({ sourceFile: e, config: t }) {
  let r = e.getFullText();

  if (t.tsx) return r;

  let o = recast.parse(r, { parser: { parse: (i) => parse(i, babelParserOptions) } }),
    n = transformFromAstSync(o, r, {
      cloneInputAst: !1,
      code: !1,
      ast: !0,
      plugins: [transformTypescript],
      configFile: !1,
    });

  if (!n || !n.ast) throw new Error('Failed to transform JSX');

  return recast.print(n.ast).code;
};

async function se({ sourceFile: e, config: t }) {
  if (t.rsc) return e;

  let r = e.getFirstChildByKind(SyntaxKind.ExpressionStatement);

  return r?.getText() === '"use client"' && r.remove(), e;
};

async function He(e) {
  let t = await promises.mkdtemp(path.join(tmpdir(), 'shadcn-'));

  return path.join(t, e);
}

async function $(e, t = [oe, se]) {
  let r = await He(e.filename);
  let o = typescriptProject.createSourceFile(r, e.raw, { scriptKind: ScriptKind.TSX });

  for (let n of t) n({ sourceFile: o, ...e });

  return await ne({ sourceFile: o, ...e });
}

function ae(e, t) {
  return e.replace(
    /export default function Component/g,
    `export function ${t}`
  );
}

async function tt(e, t) {
  try {
    let r = inputObject.parse({ id: e, ...t });
    let o = path.resolve(r.cwd);

    existsSync(o) || (consoleUtils.error(`The path ${o} does not exist. Please try again.`), process.exit(1));

    let n = await b(o);

    if (!n) {
      let a = await K(o);

      p.warn(
        `Configuration is missing. Please run the following command to create a ${chalk.green(
          'components.json'
        )} file.`
      );
      p.info('');
      p.info(` ${chalk.green(`${a} amino-ui@latest init`)}`);
      p.info('');

      process.exit(1);
    }

    r.id || (consoleUtils.warn('No component id provided. Exiting.'), process.exit(0));

    let [i] = await re([e]);
    let m = r.name;

    if (!m) {
      let { name: a } = await prompts({
        type: 'text',
        name: 'name',
        message: `What should we name ${chalk.cyan('the component')}?`,
        initial: 'Component',
        format: (l) => l.trim(),
        validate: (l) => l.length > 128 ? 'Name should be less than 128 characters.' : !0,
      });

      m = a;
    }

    m || (consoleUtils.warn('No component name provided.'), process.exit(0));

    let g = m.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    let P = `${g}.${n.tsx ? 'tsx' : 'jsx'}`;

    i.name = g;
    i.files[0].name = P;
    i.files[0].content = ae(i.files[0].content, m);

    let R = await Z();
    let L = await U(R, i.registryDependencies ?? []);
    let j = await ee(n.style, L);
    let w = [];

    for (let a of j) {
      if (a.type !== 'components:ui') continue;

      let l = await _(n, a, r.path ? path.resolve(o, r.path) : void 0);

      if (!l) continue;
      
      a.files.filter((C) => existsSync(path.resolve(l, C.name))).length && w.push(a.name);
    }

    let v = j.filter((a) => !w.includes(a.name));

    if (v.push(i), v.length || !r.yes) {
      if (!v.length) {
        p.warn('Invalid component dependencies found. Exiting.');
        process.exit(0);
      }
    
      if (!r.yes) {
        const { proceed } = await prompts({
          type: 'confirm',
          name: 'proceed',
          message: 'Ready to add components and dependencies. Proceed?',
          initial: true,
        });
    
        if (!proceed) {
          process.exit(0);
        }
      }
    }    

    let N = await Q(n.tailwind.baseColor);
    let u = ora('Adding components...').start();

    for (let component of v) {
      u.text = `Adding ${
        component.type === 'components:component' ? 'component' : component.name
      }...`;
    
      let componentPath = await resolveComponentPath(component, r.path, o);
      
      if (componentPath) {
        componentPath = componentPath.replace(/\/component$/, '');
    
        if (!existsSync(componentPath)) {
          await promises.mkdir(componentPath, { recursive: true });
        }
    
        for (let file of component.files) {
          let filePath = path.resolve(componentPath, file.name);
          let fileContent = await generateFileContent(file, n, N);
    
          if (!n.tsx) {
            filePath = filePath.replace(/\.tsx$/, '.jsx');
          }
    
          await promises.writeFile(filePath, fileContent);
        }
    
        if (component.dependencies?.length) {
          let packageManager = await determinePackageManager(o);
          await execa(packageManager, ['add', ...component.dependencies], { cwd: o });
        }
      }
    }
    
    async function resolveComponentPath(component, relativePath, basePath) {
      return await _(n, component, relativePath ? path.resolve(basePath, relativePath) : undefined);
    }
    
    async function generateFileContent(file, config, baseColor) {
      return await $({
        filename: file.name,
        raw: file.content,
        config: config,
        baseColor: baseColor,
      });
    }
    
    async function determinePackageManager(cwd) {
      let packageManagerPath = await S(cwd);
      return path.basename(packageManagerPath);
    }
    

    u.succeed('Done.');
  } catch (r) {
    console.log({ error: r }), E(r);
  }
}

function fe() {
  let e = path.join('package.json');

  return (
    fsExtra.existsSync(e) ||
      (console.error(`No package.json found at ${e}. Are you in the right directory?`),
      process.exit(1)),
    fsExtra.readJSONSync(e)
  );
}

async function ge(e) {
  let t = await nt(e);

  if (!t) return null;

  let r = t.srcDir ? 'src/' : '';
  
  return {
    $schema: 'https://ui.shadcn.com/schema.json',
    style: 'default',
    rsc: t.appDir,
    tsx: t.tsx,
    tailwind: {
      config: t.tailwindConfig,
      css: t.appDir ? `${r}app/globals.css` : `${r}styles/globals.css`,
      baseColor: 'gray',
      cssVariables: !1,
    },
    aliases: {
      utils: `${t.pathPrefix}/lib/utils`,
      components: `${t.pathPrefix}/components`,
    },
  };
}

async function nt(e) {
  if (
    !(
      existsSync(path.resolve(e, 'next.config.js')) ||
      existsSync(path.resolve(e, 'next.config.ts')) ||
      existsSync(path.resolve(e, 'next.config.mjs'))
    )
  )

  return null;

  let r = await st(e);

  if (!r) return null;

  let o = existsSync(path.resolve(e, 'src'));
  let n = existsSync(path.resolve(e, o ? 'src/app' : 'app'));
  let i = r.compilerOptions?.paths;
  let m = Object.keys(i)
    .find((g) => g.endsWith('/*'))
    ?.slice(0, -2);

  return {
    srcDir: o,
    appDir: n,
    pathPrefix: m,
    tsx: await ue(e),
    tailwindConfig: existsSync(path.resolve(e, 'tailwind.config.ts'))
      ? 'tailwind.config.ts'
      : 'tailwind.config.js',
  };
}

async function ue(e) {
  return await pathExists(path.resolve(e, 'tsconfig.json'));
}

async function st(e) {
  try {
    if (await ue(e)) {
      let o = path.resolve(e, 'tsconfig.json');
      let n = await fsExtra.readJSON(o);

      if (!n) throw new Error('tsconfig.json is missing');

      return n;
    }

    let r = path.resolve(e, 'jsconfig.json');

    if (r) {
      let o = await fsExtra.readJSON(r);

      if (!o) throw new Error('jsconfig.json is missing');

      return o;
    }
  } catch {
    return null;
  }
}

async function we({ sourceFile: e, config: t }) {
  let o = e
    .getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty('plugins');

  return (
    o &&
      o
        .getFirstDescendantByKind(SyntaxKind.ArrayLiteralExpression)
        ?.addElement('require("tailwindcss-animate")'),
    e
  );
};

async function ft(e) {
  try {
    let t = initCommandOptions.parse(e),
      r = path.resolve(t.cwd);

    existsSync(r) ||
      (consoleUtils.error(`The path ${r} does not exist. Please try again.`),
      process.exit(1)),
      (await b(r)) &&
        (consoleUtils.error(
          `The path ${r} already contains a components.json file. Please try again.`
        ),
        process.exit(1));

    let n = await ge(r);

    n ||
      (consoleUtils.error(
        "The amino-ui cli only supports Next.js projects for now. If you're using a different framework, you can copy and paste the generated code into your app."
      ),
      process.exit(1));

    let i = await D(r, n);

    p.info('');

    let m = ora('Writing components.json...').start(),
      g = path.resolve(r, 'components.json');

    await promises.writeFile(g, JSON.stringify(n, null, 2), 'utf8'),
      m.succeed(),
      (m = ora('Initializing project...')?.start());

    for (let [N, u] of Object.entries(i.resolvedPaths)) {
      let a = path.extname(u) ? path.dirname(u) : u;

      N === 'utils' && u.endsWith('/utils') && (a = a.replace(/\/utils$/, '')),
        existsSync(a) || (await promises.mkdir(a, { recursive: !0 }));
    }

    let P = i.tsx ? 'ts' : 'js';
    let R = await promises.readFile(i.resolvedPaths.tailwindConfig, 'utf8');
    let L = await $(
      { filename: i.resolvedPaths.tailwindConfig, raw: R, config: i },
      [we]
    );

    await promises.writeFile(i.resolvedPaths.tailwindConfig, L, 'utf8'),
      await promises.writeFile(
        `${i.resolvedPaths.utils}.${P}`,
        P === 'ts' ? tsxTemplate : jsTemplate,
        'utf8'
      ),
      m?.succeed();
      
    let j = ora('Installing dependencies...')?.start();
    let w = await S(r);
    let v = [...defaultPackages, '@radix-ui/react-icons', 'lucide-react'];

    await execa(w, [w === 'npm' ? 'install' : 'add', ...v], { cwd: r }),
      j?.succeed(),
      p.info(''),
      p.info(
        `${chalk.green(
          'Success!'
        )} Project initialization completed. You can now starting adding components.`
      ),
      p.info('');
  } catch (t) {
    E(t);
  }
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function gt() {
  let e = fe();
  let t = new Command()
    .name('amino-ui')
    .description('add components and dependencies to your project')
    .version(
      e.version || '0.0.1',
      '-v, --version',
      'display the version number'
    );

  t.addCommand(initCommand).addCommand(addComponentCommand), t.parse();
}

gt();
