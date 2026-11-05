// Minimal in-memory stand-ins for the two career Mongoose models. They honour
// only the operations career-store.ts uses ($set with dotted paths,
// $setOnInsert, upsert, sort, lean) so tests can exercise ownership and
// persistence rules without a database.

type Doc = Record<string, any>;

function setPath(target: Doc, path: string, value: unknown) {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) {
    cursor[key] = cursor[key] && typeof cursor[key] === "object" ? cursor[key] : {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]!] = value;
}

function matches(doc: Doc, filter: Doc): boolean {
  return Object.entries(filter).every(([key, value]) => String(doc[key]) === String(value));
}

export function createFakeCollection(defaults: () => Doc) {
  let rows: Doc[] = [];

  const apply = (doc: Doc, update: Doc) => {
    for (const [path, value] of Object.entries(update.$set ?? {})) setPath(doc, path, value);
  };

  return {
    rows: () => rows,
    reset: () => {
      rows = [];
    },
    model: {
      findOne: (filter: Doc) => ({ lean: async () => clone(rows.find((row) => matches(row, filter)) ?? null) }),
      find: (filter: Doc) => ({
        sort: () => ({ lean: async () => clone(rows.filter((row) => matches(row, filter))) }),
        lean: async () => clone(rows.filter((row) => matches(row, filter))),
      }),
      findOneAndUpdate: (filter: Doc, update: Doc, options: Doc = {}) => {
        const run = async () => {
          let doc: Doc | undefined = rows.find((row) => matches(row, filter));
          if (!doc && options.upsert) {
            doc = { ...defaults(), ...filter, ...(update.$setOnInsert ?? {}), createdAt: new Date() };
            rows.push(doc as Doc);
          }
          if (!doc) return null;
          apply(doc, update);
          doc.updatedAt = new Date();
          return clone(doc);
        };
        return { lean: run, then: (resolve: any, reject: any) => run().then(resolve, reject) };
      },
      deleteOne: async (filter: Doc) => {
        const before = rows.length;
        const index = rows.findIndex((row) => matches(row, filter));
        if (index >= 0) rows.splice(index, 1);
        return { deletedCount: before - rows.length };
      },
    },
  };
}

function clone<T>(value: T): T {
  return value === null ? value : structuredClone(value);
}
