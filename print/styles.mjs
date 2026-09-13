// ==================================================================
// STYLE LOADING
// ------------------------------------------------------------------

// A style variant is a module in print/styles/ whose default export is a plain
// object. It may list presets in `extends`; those are deep-merged first, in
// order, and the variant's own values win. Arrays are replaced, not merged.

// ------------------------------------------------------------------

const STYLE_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ------------------------------------------------------------------

export async function loadStyle(name) {
  if (!STYLE_NAME_PATTERN.test(name)) throw new Error(`Invalid style name: ${name}`);
  const { default: own } = await import(new URL(`./styles/${name}.mjs`, import.meta.url).href);
  const presets = await Promise.all((own.extends ?? []).map(loadStyle));
  const { extends: _, ...ownValues } = own;
  return [...presets, ownValues].reduce(deepMerge, {});
}

// ------------------------------------------------------------------

function deepMerge(target, source) {
  const result = { ...target };
  Object.entries(source).forEach(([key, value]) => {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? deepMerge(result[key], value)
      : value;
  });
  return result;
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
