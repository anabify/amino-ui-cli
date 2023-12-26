// @ts-nocheck

import { Command as dt } from "commander";
import { existsSync as W, promises as ce } from "fs";
import z from "path";
import G from "path";
import { createMatchPath as ze } from "tsconfig-paths";

async function O(e, t) {
  return ze(t.absoluteBaseUrl, t.paths)(e, void 0, () => !0, [".ts", ".tsx"]);
}

import { cosmiconfig as Te } from "cosmiconfig";
import { loadConfig as Pe } from "tsconfig-paths";
import * as c from "zod";

var je = Te("components", { searchPlaces: ["components.json"] }),
  V = c
    .object({
      $schema: c.string().optional(),
      style: c.string(),
      rsc: c.coerce.boolean().default(!1),
      tsx: c.coerce.boolean().default(!0),
      tailwind: c.object({
        config: c.string(),
        css: c.string(),
        baseColor: c.string(),
        cssVariables: c.boolean().default(!0),
      }),
      aliases: c.object({ components: c.string(), utils: c.string() }),
    })
    .strict(),
  be = V.extend({
    resolvedPaths: c.object({
      tailwindConfig: c.string(),
      tailwindCss: c.string(),
      utils: c.string(),
      components: c.string(),
    }),
  });

async function b(e) {
  let t = await Ie(e);
  return t ? await D(e, t) : null;
}

async function D(e, t) {
  let r = await Pe(e);

  if (r.resultType === "failed")
    throw new Error(`Failed to load tsconfig.json. ${r.message ?? ""}`.trim());

  return be.parse({
    ...t,
    resolvedPaths: {
      tailwindConfig: G.resolve(e, t.tailwind.config),
      tailwindCss: G.resolve(e, t.tailwind.css),
      utils: await O(t.aliases.utils, r),
      components: await O(t.aliases.components, r),
    },
  });
}

async function Ie(e) {
  try {
    let t = await je.search(e);
    return t ? V.parse(t.config) : null;
  } catch {
    throw new Error(`Invalid configuration found in ${e}/components.json.`);
  }
}

import { detect as Ee } from "@antfu/ni";

async function S(e) {
  let t = await Ee({ programmatic: !0, cwd: e });

  return t === "yarn@berry"
    ? "yarn"
    : t === "pnpm@6"
    ? "pnpm"
    : t === "bun"
    ? "bun"
    : t ?? "npm";
}

async function K(e) {
  let t = await S(e);
  return t === "pnpm" ? "pnpm dlx" : t === "bun" ? "bunx" : "npx";
}

import I from "chalk";

var p = {
  error(...e) {
    console.log(I.red(...e));
  },
  warn(...e) {
    console.log(I.yellow(...e));
  },
  info(...e) {
    console.log(I.cyan(...e));
  },
  success(...e) {
    console.log(I.green(...e));
  },
  break() {
    console.log("");
  },
};

function E(e) {
  typeof e == "string" && (p.error(e), process.exit(1)),
    e instanceof Error && (p.error(e.message), process.exit(1)),
    p.error("Something went wrong. Please try again."),
    process.exit(1);
}

import $e from "path";
import * as s from "zod";

var Y = s.object({
    name: s.string(),
    dependencies: s.array(s.string()).optional(),
    registryDependencies: s.array(s.string()).optional(),
    files: s.array(s.string()),
    type: s.enum([
      "components:ui",
      "components:component",
      "components:example",
    ]),
  }),
  q = s.array(Y),
  ke = Y.extend({
    files: s.array(s.object({ name: s.string(), content: s.string() })),
  }),
  k = s.array(ke),
  Fe = s.array(s.object({ name: s.string(), label: s.string() })),
  H = s.object({
    inlineColors: s.object({
      light: s.record(s.string(), s.string()),
      dark: s.record(s.string(), s.string()),
    }),
    cssVars: s.object({
      light: s.record(s.string(), s.string()),
      dark: s.record(s.string(), s.string()),
    }),
    inlineColorsTemplate: s.string(),
    cssVarsTemplate: s.string(),
  });

import { HttpsProxyAgent as Ae } from "https-proxy-agent";
import Re from "node-fetch";

var X = process.env.COMPONENTS_REGISTRY_URL ?? "https://ui.shadcn.com",
  Le = process.env.https_proxy ? new Ae(process.env.https_proxy) : void 0;

async function Z() {
  try {
    let [e] = await M(["index.json"]);
    return q.parse(e);
  } catch {
    throw new Error("Failed to fetch components from registry.");
  }
}

async function Q(e) {
  try {
    let [t] = await M([`colors/${e}.json`]);
    return H.parse(t);
  } catch {
    throw new Error("Failed to fetch base color from registry.");
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
    let r = t.map((n) => `styles/${e}/${n.name}.json`),
      o = await M(r);

    return k.parse(o);
  } catch {
    throw new Error("Failed to fetch tree from registry.");
  }
}

async function _(e, t, r) {
  if (r && t.type !== "components:ui") return r;

  let [o, n] = t.type.split(":");

  return o in e.resolvedPaths ? $e.join(e.resolvedPaths[o], n) : null;
}

async function M(e) {
  try {
    return await Promise.all(
      e.map(
        async (r) =>
          await (await Re(`${X}/registry/${r}`, { agent: Le })).json()
      )
    );
  } catch (t) {
    throw (console.log(t), new Error(`Failed to fetch registry from ${X}.`));
  }
}

import { HttpsProxyAgent as Ne } from "https-proxy-agent";
import Oe from "node-fetch";

var te = process.env.EXTERNAL_REGISTRY_URL ?? "https://v0.dev",
  De = process.env.https_proxy ? new Ne(process.env.https_proxy) : void 0;

async function re(e) {
  try {
    let t = await Ue(e);
    return k.parse(t);
  } catch (t) {
    throw (
      (console.log(t), new Error("Failed to fetch components from registry."))
    );
  }
}

async function Ue(e) {
  try {
    return await Promise.all(
      e.map(async (r) => {
        let o = await Oe(`${te}/api/r/${r}`, { agent: De });

        if (o.status === 404) throw new Error(`Component ${r} not found.`);
        if (o.status === 401)
          throw new Error(
            "This is a private component. Use the app at https://v0.dev to copy and paste the code."
          );
        if (o.status === 200) return await o.json();

        throw new Error(`Failed to fetch component ${r}. ${o.statusText}`);
      })
    );
  } catch (t) {
    throw (console.log(t), new Error(`Failed to fetch component from ${te}.`));
  }
}

import { promises as Ge } from "fs";
import { tmpdir as Ve } from "os";
import ie from "path";

var oe = async ({ sourceFile: e, config: t }) => {
  let r = e.getImportDeclarations();

  for (let o of r) {
    let n = o.getModuleSpecifierValue();
    n.startsWith("@/components/") &&
      o.setModuleSpecifier(n.replace(/^@\/components/, t.aliases.components)),
      n.startsWith("@/registry/") &&
        o.setModuleSpecifier(
          n.replace(/^@\/registry\/[^/]+/, t.aliases.components)
        ),
      n == "@/lib/utils" &&
        o.getNamedImports().find((g) => g.getName() === "cn") &&
        o.setModuleSpecifier(n.replace(/^@\/lib\/utils/, t.aliases.utils));
  }

  return e;
};

import { transformFromAstSync as _e } from "@babel/core";
import { parse as Me } from "@babel/parser";
import We from "@babel/plugin-transform-typescript";
import * as F from "recast";

var Be = {
    sourceType: "module",
    allowImportExportEverywhere: !0,
    allowReturnOutsideFunction: !0,
    startLine: 1,
    tokens: !0,
    plugins: [
      "asyncGenerators",
      "bigInt",
      "classPrivateMethods",
      "classPrivateProperties",
      "classProperties",
      "classStaticBlock",
      "decimal",
      "decorators-legacy",
      "doExpressions",
      "dynamicImport",
      "exportDefaultFrom",
      "exportNamespaceFrom",
      "functionBind",
      "functionSent",
      "importAssertions",
      "importMeta",
      "nullishCoalescingOperator",
      "numericSeparator",
      "objectRestSpread",
      "optionalCatchBinding",
      "optionalChaining",
      ["pipelineOperator", { proposal: "minimal" }],
      ["recordAndTuple", { syntaxType: "hash" }],
      "throwExpressions",
      "topLevelAwait",
      "v8intrinsic",
      "typescript",
      "jsx",
    ],
  },
  ne = async ({ sourceFile: e, config: t }) => {
    let r = e.getFullText();

    if (t.tsx) return r;

    let o = F.parse(r, { parser: { parse: (i) => Me(i, Be) } }),
      n = _e(o, r, {
        cloneInputAst: !1,
        code: !1,
        ast: !0,
        plugins: [We],
        configFile: !1,
      });

    if (!n || !n.ast) throw new Error("Failed to transform JSX");

    return F.print(n.ast).code;
  };

import { SyntaxKind as Je } from "ts-morph";

var se = async ({ sourceFile: e, config: t }) => {
  if (t.rsc) return e;

  let r = e.getFirstChildByKind(Je.ExpressionStatement);

  return r?.getText() === '"use client"' && r.remove(), e;
};

import { Project as Ke, ScriptKind as Ye } from "ts-morph";

var qe = new Ke({ compilerOptions: {} });

async function He(e) {
  let t = await Ge.mkdtemp(ie.join(Ve(), "shadcn-"));
  return ie.join(t, e);
}

async function $(e, t = [oe, se]) {
  let r = await He(e.filename),
    o = qe.createSourceFile(r, e.raw, { scriptKind: Ye.TSX });

  for (let n of t) n({ sourceFile: o, ...e });

  return await ne({ sourceFile: o, ...e });
}

import B from "chalk";
import { Command as Xe } from "commander";
import { execa as Ze } from "execa";
import Qe from "ora";
import pe from "prompts";
import * as f from "zod";

function ae(e, t) {
  return e.replace(
    /export default function Component/g,
    `export function ${t}`
  );
}

var et = f.object({
    id: f.string(),
    yes: f.boolean(),
    overwrite: f.boolean(),
    cwd: f.string(),
    path: f.string().optional(),
    name: f.string().optional(),
  }),
  me = new Xe()
    .name("add")
    .alias("i")
    .description("add a component to your project")
    .argument("id", "the component id to add")
    .option("-n, --name <name>", "the filename of the component to add.")
    .option("-y, --yes", "skip confirmation prompt.", !0)
    .option("-o, --overwrite", "overwrite existing files.", !1)
    .option(
      "-c, --cwd <cwd>",
      "the working directory. defaults to the current directory.",
      process.cwd()
    )
    .option("-p, --path <path>", "the path to add the component to.")
    .action(async (e, t) => {
      await tt(e, t);
    });

async function tt(e, t) {
  try {
    let r = et.parse({ id: e, ...t }),
      o = z.resolve(r.cwd);
    W(o) ||
      (p.error(`The path ${o} does not exist. Please try again.`),
      process.exit(1));

    let n = await b(o);

    if (!n) {
      let a = await K(o);
      p.warn(
        `Configuration is missing. Please run the following command to create a ${B.green(
          "components.json"
        )} file.`
      ),
        p.info(""),
        p.info(` ${B.green(`${a} amino-ui@latest init`)}`),
        p.info(""),
        process.exit(1);
    }
    r.id || (p.warn("No component id provided. Exiting."), process.exit(0));
    let [i] = await re([e]),
      m = r.name;

    if (!m) {
      let { name: a } = await pe({
        type: "text",
        name: "name",
        message: `What should we name ${B.cyan("the component")}?`,
        initial: "Component",
        format: (l) => l.trim(),
        validate: (l) =>
          l.length > 128 ? "Name should be less than 128 characters." : !0,
      });

      m = a;
    }

    m || (p.warn("No component name provided."), process.exit(0));

    let g = m.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(),
      P = `${g}.${n.tsx ? "tsx" : "jsx"}`;
    (i.name = g),
      (i.files[0].name = P),
      (i.files[0].content = ae(i.files[0].content, m));

    let R = await Z(),
      L = await U(R, i.registryDependencies ?? []),
      j = await ee(n.style, L),
      w = [];

    for (let a of j) {
      if (a.type !== "components:ui") continue;
      let l = await _(n, a, r.path ? z.resolve(o, r.path) : void 0);
      if (!l) continue;
      a.files.filter((C) => W(z.resolve(l, C.name))).length && w.push(a.name);
    }

    let v = j.filter((a) => !w.includes(a.name));

    if (
      (v.push(i),
      v.length ||
        (p.warn("Invalid component dependencies found. Exiting."),
        process.exit(0)),
      !r.yes)
    ) {
      let { proceed: a } = await pe({
        type: "confirm",
        name: "proceed",
        message: "Ready to add components and dependencies. Proceed?",
        initial: !0,
      });
      a || process.exit(0);
    }

    let N = await Q(n.tailwind.baseColor),
      u = Qe("Adding components...").start();

    for (let a of v) {
      u.text = `Adding ${
        a.type === "components:component" ? "component" : a.name
      }...`;
      let l = await _(n, a, r.path ? z.resolve(o, r.path) : void 0);
      if (l) {
        (l = l.replace(/\/component$/, "")),
          W(l) || (await ce.mkdir(l, { recursive: !0 }));
        for (let h of a.files) {
          let C = z.resolve(l, h.name),
            Se = await $({
              filename: h.name,
              raw: h.content,
              config: n,
              baseColor: N,
            });
          n.tsx || (C = C.replace(/\.tsx$/, ".jsx")), await ce.writeFile(C, Se);
        }
        if (a.dependencies?.length) {
          let h = await S(o);
          await Ze(h, ["add", ...a.dependencies], { cwd: o });
        }
      }
    }

    u.succeed("Done.");
  } catch (r) {
    console.log({ error: r }), E(r);
  }
}

import rt from "path";
import le from "fs-extra";

function fe() {
  let e = rt.join("package.json");

  return (
    le.existsSync(e) ||
      (console.error(
        `No package.json found at ${e}. Are you in the right directory?`
      ),
      process.exit(1)),
    le.readJSONSync(e)
  );
}

import { existsSync as y } from "fs";
import d from "path";
import de, { pathExists as ot } from "fs-extra";

async function ge(e) {
  let t = await nt(e);

  if (!t) return null;

  let r = t.srcDir ? "src/" : "";
  return {
    $schema: "https://ui.shadcn.com/schema.json",
    style: "default",
    rsc: t.appDir,
    tsx: t.tsx,
    tailwind: {
      config: t.tailwindConfig,
      css: t.appDir ? `${r}app/globals.css` : `${r}styles/globals.css`,
      baseColor: "gray",
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
      y(d.resolve(e, "next.config.js")) ||
      y(d.resolve(e, "next.config.ts")) ||
      y(d.resolve(e, "next.config.mjs"))
    )
  )

  return null;

  let r = await st(e);

  if (!r) return null;

  let o = y(d.resolve(e, "src")),
    n = y(d.resolve(e, o ? "src/app" : "app")),
    i = r.compilerOptions?.paths,
    m = Object.keys(i)
      .find((g) => g.endsWith("/*"))
      ?.slice(0, -2);

  return {
    srcDir: o,
    appDir: n,
    pathPrefix: m,
    tsx: await ue(e),
    tailwindConfig: y(d.resolve(e, "tailwind.config.ts"))
      ? "tailwind.config.ts"
      : "tailwind.config.js",
  };
}

async function ue(e) {
  return await ot(d.resolve(e, "tsconfig.json"));
}

async function st(e) {
  try {
    if (await ue(e)) {
      let o = d.resolve(e, "tsconfig.json"),
        n = await de.readJSON(o);
      if (!n) throw new Error("tsconfig.json is missing");
      return n;
    }

    let r = d.resolve(e, "jsconfig.json");

    if (r) {
      let o = await de.readJSON(r);
      if (!o) throw new Error("jsconfig.json is missing");
      return o;
    }
  } catch {
    return null;
  }
}

var he = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
  ye = `import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
`;

import { SyntaxKind as xe } from "ts-morph";

var we = async ({ sourceFile: e, config: t }) => {
  let o = e
    .getFirstDescendantByKind(xe.ObjectLiteralExpression)
    ?.getProperty("plugins");

  return (
    o &&
      o
        .getFirstDescendantByKind(xe.ArrayLiteralExpression)
        ?.addElement('require("tailwindcss-animate")'),
    e
  );
};

import at from "chalk";
import { Command as ct } from "commander";
import { execa as pt } from "execa";
import { existsSync as ve, promises as T } from "fs";
import J from "ora";
import A from "path";
import * as x from "zod";

var mt = [
    "tailwindcss-animate",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ],
  lt = x.object({ cwd: x.string(), yes: x.boolean() }),
  Ce = new ct()
    .name("init")
    .description("initialize your project and install dependencies")
    .option("-y, --yes", "skip confirmation prompt.", !1)
    .option(
      "-c, --cwd <cwd>",
      "the working directory. defaults to the current directory.",
      process.cwd()
    )
    .action(async (e) => {
      await ft(e);
    });

async function ft(e) {
  try {
    let t = lt.parse(e),
      r = A.resolve(t.cwd);

    ve(r) ||
      (p.error(`The path ${r} does not exist. Please try again.`),
      process.exit(1)),
      (await b(r)) &&
        (p.error(
          `The path ${r} already contains a components.json file. Please try again.`
        ),
        process.exit(1));

    let n = await ge(r);

    n ||
      (p.error(
        "The amino-ui cli only supports Next.js projects for now. If you're using a different framework, you can copy and paste the generated code into your app."
      ),
      process.exit(1));

    let i = await D(r, n);

    p.info("");

    let m = J("Writing components.json...").start(),
      g = A.resolve(r, "components.json");

    await T.writeFile(g, JSON.stringify(n, null, 2), "utf8"),
      m.succeed(),
      (m = J("Initializing project...")?.start());

    for (let [N, u] of Object.entries(i.resolvedPaths)) {
      let a = A.extname(u) ? A.dirname(u) : u;

      N === "utils" && u.endsWith("/utils") && (a = a.replace(/\/utils$/, "")),
        ve(a) || (await T.mkdir(a, { recursive: !0 }));
    }

    let P = i.tsx ? "ts" : "js",
      R = await T.readFile(i.resolvedPaths.tailwindConfig, "utf8"),
      L = await $(
        { filename: i.resolvedPaths.tailwindConfig, raw: R, config: i },
        [we]
      );

    await T.writeFile(i.resolvedPaths.tailwindConfig, L, "utf8"),
      await T.writeFile(
        `${i.resolvedPaths.utils}.${P}`,
        P === "ts" ? he : ye,
        "utf8"
      ),
      m?.succeed();
      
    let j = J("Installing dependencies...")?.start(),
      w = await S(r),
      // v = [...mt, "@radix-ui/react-icons", "lucide-react"];
      v = [...mt, "react-icons"];

    await pt(w, [w === "npm" ? "install" : "add", ...v], { cwd: r }),
      j?.succeed(),
      p.info(""),
      p.info(
        `${at.green(
          "Success!"
        )} Project initialization completed. You can now starting adding components.`
      ),
      p.info("");
  } catch (t) {
    E(t);
  }
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

async function gt() {
  let e = fe(),
    t = new dt()
      .name("amino-ui")
      .description("add components and dependencies to your project")
      .version(
        e.version || "0.0.1",
        "-v, --version",
        "display the version number"
      );
  t.addCommand(Ce).addCommand(me), t.parse();
}

gt();
