import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

const TABLE = "app_lib_shadowing_game";
const DEFAULT_DATA_TABLE = "cantonese_corpus_all";

export type ShadowingLibInsert = {
  name: string;
  description: string;
  creator_email: string;
  data_table?: string;
  item_index_collection?: unknown;
  user_data?: unknown;
};

export type ShadowingLibUpdate = Partial<
  Pick<
    ShadowingLibInsert,
    "name" | "description" | "creator_email" | "data_table" | "item_index_collection" | "user_data"
  >
>;

type MutateAction = "create" | "update" | "delete";

let supabase: SupabaseClient | null = null;

export function initSupabase(): SupabaseClient | null {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (url && key) supabase = createClient(url, key);
  return supabase;
}

function db(context: Context): SupabaseClient | null {
  if (!supabase) {
    context.response.status = 500;
    context.response.body = {
      error: "Supabase not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)",
    };
    return null;
  }
  return supabase;
}

function expectedPasswd(action: MutateAction): string {
  switch (action) {
    case "create":
      return Deno.env.get("LIB_CREATE_PASSWD") || "";
    case "update":
      return Deno.env.get("LIB_UPDATE_PASSWD") || "";
    case "delete":
      return Deno.env.get("LIB_DELETE_PASSWD") || "";
  }
}

function authorizeMutate(context: Context, action: MutateAction, passwd: unknown): boolean {
  const expected = expectedPasswd(action);
  if (!expected) {
    context.response.status = 500;
    context.response.body = {
      error: `LIB_${action.toUpperCase()}_PASSWD not configured`,
    };
    return false;
  }
  if (typeof passwd !== "string" || passwd !== expected) {
    context.response.status = 401;
    context.response.body = { error: "Unauthorized: invalid passwd" };
    return false;
  }
  return true;
}

function parseId(raw: string | undefined): number | null {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function routeId(context: Context): number | null {
  const raw = (context as Context & { params: Record<string, string> }).params?.id;
  return parseId(raw);
}

async function readJsonBody(context: Context): Promise<Record<string, unknown> | null> {
  try {
    const body = await context.request.body({ type: "json" }).value;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      context.response.status = 400;
      context.response.body = { error: "JSON object body is required" };
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    context.response.status = 400;
    context.response.body = { error: "Invalid JSON body" };
    return null;
  }
}

async function readDeletePasswd(context: Context): Promise<string | undefined> {
  const fromQuery = context.request.url.searchParams.get("passwd");
  if (fromQuery) return fromQuery;

  try {
    if (!context.request.hasBody) return undefined;
    const body = await context.request.body({ type: "json" }).value;
    if (body && typeof body === "object" && !Array.isArray(body)) {
      const passwd = (body as Record<string, unknown>).passwd;
      return typeof passwd === "string" ? passwd : undefined;
    }
  } catch {
    // ignore invalid JSON on DELETE
  }
  return undefined;
}

function requireString(
  body: Record<string, unknown>,
  field: string,
): string | null {
  const value = body[field];
  if (typeof value !== "string" || !value.trim()) return null;
  return value.trim();
}

function parseCreateBody(body: Record<string, unknown>): ShadowingLibInsert | null {
  const name = requireString(body, "name");
  const description = requireString(body, "description");
  const creator_email = requireString(body, "creator_email");
  if (!name || !description || !creator_email) return null;

  const row: ShadowingLibInsert = { name, description, creator_email };
  if ("data_table" in body) {
    const data_table = requireString(body, "data_table");
    if (!data_table) return null;
    row.data_table = data_table;
  }
  if ("item_index_collection" in body) {
    row.item_index_collection = body.item_index_collection;
  }
  if ("user_data" in body) {
    row.user_data = body.user_data;
  }
  return row;
}

function parseUpdateBody(body: Record<string, unknown>): ShadowingLibUpdate | null {
  const update: ShadowingLibUpdate = {};
  const fields = [
    "name",
    "description",
    "creator_email",
    "data_table",
    "item_index_collection",
    "user_data",
  ] as const;

  for (const field of fields) {
    if (!(field in body)) continue;
    const value = body[field];
    if (
      field === "name" ||
      field === "description" ||
      field === "creator_email" ||
      field === "data_table"
    ) {
      if (typeof value !== "string" || !value.trim()) return null;
      update[field] = value.trim();
    } else {
      update[field] = value;
    }
  }

  return Object.keys(update).length > 0 ? update : null;
}

/*
curl http://localhost:3003/api/libs

curl "http://localhost:3003/api/libs?creator_email=alice@example.com&limit=10&offset=0"

curl "http://localhost:3003/api/libs?data_table=cantonese_corpus_all"
*/
export async function listLibs(context: Context) {
  const client = db(context);
  if (!client) return;

  try {
    const params = context.request.url.searchParams;
    const creatorEmail = params.get("creator_email")?.trim();
    const dataTable = params.get("data_table")?.trim();
    const limit = Math.min(Math.max(parseInt(params.get("limit") || "50", 10) || 50, 1), 200);
    const offset = Math.max(parseInt(params.get("offset") || "0", 10) || 0, 0);

    let query = client
      .from(TABLE)
      .select("*", { count: "exact" })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (creatorEmail) query = query.eq("creator_email", creatorEmail);
    if (dataTable) query = query.eq("data_table", dataTable);

    const { data, error, count } = await query;
    if (error) throw error;

    context.response.body = { data, count };
  } catch (err) {
    console.error("listLibs error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}

/*
curl http://localhost:3003/api/libs/1
*/
export async function getLib(context: Context) {
  const client = db(context);
  if (!client) return;

  const id = routeId(context);
  if (id === null) {
    context.response.status = 400;
    context.response.body = { error: "Invalid id" };
    return;
  }

  try {
    const { data, error } = await client.from(TABLE).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) {
      context.response.status = 404;
      context.response.body = { error: "Library not found", id };
      return;
    }
    context.response.body = { data };
  } catch (err) {
    console.error("getLib error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}

/*
curl -X POST http://localhost:3003/api/libs \
  -H "Content-Type: application/json" \
  -d '{"passwd":"YOUR_LIB_CREATE_PASSWD","name":"我的语料集","description":"日常粤语","creator_email":"alice@example.com","data_table":"cantonese_corpus_all","item_index_collection":[],"user_data":[]}'
*/
export async function createLib(context: Context) {
  const client = db(context);
  if (!client) return;

  const body = await readJsonBody(context);
  if (!body) return;

  if (!authorizeMutate(context, "create", body.passwd)) return;

  const row = parseCreateBody(body);
  if (!row) {
    context.response.status = 400;
    context.response.body = {
      error: "'name', 'description', and 'creator_email' are required non-empty strings",
    };
    return;
  }

  try {
    const { data, error } = await client
      .from(TABLE)
      .insert({
        name: row.name,
        description: row.description,
        creator_email: row.creator_email,
        data_table: row.data_table ?? DEFAULT_DATA_TABLE,
        item_index_collection: row.item_index_collection ?? [],
        user_data: row.user_data ?? [],
      })
      .select()
      .single();

    if (error) throw error;
    context.response.status = 201;
    context.response.body = { data };
  } catch (err) {
    console.error("createLib error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}

/*
curl -X PATCH http://localhost:3003/api/libs/1 \
  -H "Content-Type: application/json" \
  -d '{"passwd":"YOUR_LIB_UPDATE_PASSWD","description":"更新后的描述","data_table":"cantonese_corpus_all","item_index_collection":[1,2,3]}'
*/
export async function updateLib(context: Context) {
  const client = db(context);
  if (!client) return;

  const id = routeId(context);
  if (id === null) {
    context.response.status = 400;
    context.response.body = { error: "Invalid id" };
    return;
  }

  const body = await readJsonBody(context);
  if (!body) return;

  if (!authorizeMutate(context, "update", body.passwd)) return;

  const update = parseUpdateBody(body);
  if (!update) {
    context.response.status = 400;
    context.response.body = {
      error: "At least one updatable field is required: name, description, creator_email, data_table, item_index_collection, user_data",
    };
    return;
  }

  try {
    const { data, error } = await client
      .from(TABLE)
      .update({ ...update, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      context.response.status = 404;
      context.response.body = { error: "Library not found", id };
      return;
    }
    context.response.body = { data };
  } catch (err) {
    console.error("updateLib error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}

/*
curl -X DELETE "http://localhost:3003/api/libs/1?passwd=YOUR_LIB_DELETE_PASSWD"

curl -X DELETE http://localhost:3003/api/libs/1 \
  -H "Content-Type: application/json" \
  -d '{"passwd":"YOUR_LIB_DELETE_PASSWD"}'
*/
export async function deleteLib(context: Context) {
  const client = db(context);
  if (!client) return;

  const id = routeId(context);
  if (id === null) {
    context.response.status = 400;
    context.response.body = { error: "Invalid id" };
    return;
  }

  const passwd = await readDeletePasswd(context);
  if (!authorizeMutate(context, "delete", passwd)) return;

  try {
    const { data, error } = await client.from(TABLE).delete().eq("id", id).select().maybeSingle();
    if (error) throw error;
    if (!data) {
      context.response.status = 404;
      context.response.body = { error: "Library not found", id };
      return;
    }
    context.response.body = { success: true, data };
  } catch (err) {
    console.error("deleteLib error:", err);
    context.response.status = 500;
    context.response.body = { error: String(err) };
  }
}
