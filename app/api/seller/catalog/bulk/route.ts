import { NextResponse } from "next/server";
import { createCsv } from "@/lib/csv";
import { evaluateProductPolicy, type ProductPolicyResult } from "@/lib/prohibitedProducts";
import {
  createProductPolicyReview,
  loadProductPolicyRules,
  supersedePendingProductPolicyReviews,
} from "@/lib/productPolicyServer";
import {
  requireApprovedSeller,
  sellerErrorStatus,
} from "@/lib/sellerSecurity";

const BULK_LIMIT = 200;
const CSV_HEADERS = [
  "action",
  "product_id",
  "title",
  "description",
  "price",
  "stock",
  "status",
  "delivery_eta_minutes",
  "category_id",
  "category",
  "game_id",
  "game_name",
  "image_url",
  "offer_region",
  "offer_platform",
  "offer_server",
  "offer_tags",
  "slug",
];

type BulkAction = "create" | "update";
type ListingStatus = "active" | "inactive";

type ExistingProduct = {
  id: number;
  has_variants: boolean | null;
  price: string | number | null;
  stock: number | null;
  status: string | null;
};

type NormalizedRow = {
  rowNumber: number;
  action: BulkAction;
  requestedAction: string;
  productId: number | null;
  title: string;
  description: string;
  price: number;
  stock: number;
  status: ListingStatus;
  deliveryEtaMinutes: number;
  categoryId: number | null;
  category: string;
  gameId: number | null;
  gameName: string;
  imageUrl: string;
  offerRegion: string;
  offerPlatform: string;
  offerServer: string;
  offerTags: string[];
  slug: string;
};

type PreparedRow = {
  input: NormalizedRow;
  existing: ExistingProduct | null;
  policy: ProductPolicyResult;
  valid: boolean;
  errors: string[];
  warnings: string[];
};

function clean(value: unknown, maxLength = 5000) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function integer(value: unknown, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return fallback;
  }
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function numeric(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return Number.NaN;
  }
  return Number(value);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function readField(row: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    if (name in row) return row[name];
  }
  return undefined;
}

function cleanTags(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(/[|,]/)
        .map((item) => item.trim());
  const tags = new Map<string, string>();

  for (const raw of source) {
    const tag = clean(raw, 40).replace(/\s+/g, " ");
    const key = tag.toLowerCase();
    if (!key || tags.has(key)) continue;
    tags.set(key, tag);
    if (tags.size >= 12) break;
  }

  return Array.from(tags.values());
}

function normalizeRows(value: unknown): NormalizedRow[] {
  if (!Array.isArray(value)) throw new Error("CSV rows are required.");
  if (value.length < 1) throw new Error("CSV has no listing rows.");
  if (value.length > BULK_LIMIT) {
    throw new Error(`A bulk operation can contain at most ${BULK_LIMIT} rows.`);
  }

  return value.map((raw, index) => {
    const row = (raw || {}) as Record<string, unknown>;
    const productIdValue = integer(
      readField(row, "product_id", "productId"),
      0
    );
    const requestedAction = clean(readField(row, "action"), 20).toLowerCase();
    const action: BulkAction =
      requestedAction === "update" || (!requestedAction && productIdValue > 0)
        ? "update"
        : "create";
    const rawStatus = clean(readField(row, "status"), 20).toLowerCase();

    return {
      rowNumber: Math.max(
        integer(readField(row, "row_number", "rowNumber"), index + 2),
        2
      ),
      action,
      requestedAction,
      productId: productIdValue > 0 ? productIdValue : null,
      title: clean(readField(row, "title"), 180),
      description: clean(readField(row, "description"), 10000),
      price: numeric(readField(row, "price")),
      stock: integer(readField(row, "stock"), -1),
      status: rawStatus === "inactive" ? "inactive" : "active",
      deliveryEtaMinutes: integer(
        readField(row, "delivery_eta_minutes", "deliveryEtaMinutes"),
        60
      ),
      categoryId:
        integer(readField(row, "category_id", "categoryId"), 0) || null,
      category: clean(readField(row, "category"), 120),
      gameId: integer(readField(row, "game_id", "gameId"), 0) || null,
      gameName: clean(readField(row, "game_name", "gameName"), 160),
      imageUrl: clean(readField(row, "image_url", "imageUrl"), 1000),
      offerRegion:
        clean(readField(row, "offer_region", "offerRegion"), 80) || "Global",
      offerPlatform:
        clean(readField(row, "offer_platform", "offerPlatform"), 80) || "Any",
      offerServer: clean(
        readField(row, "offer_server", "offerServer"),
        100
      ),
      offerTags: cleanTags(readField(row, "offer_tags", "offerTags")),
      slug: clean(readField(row, "slug"), 220),
    };
  });
}

async function uniqueSlug(
  supabaseAdmin: Awaited<ReturnType<typeof requireApprovedSeller>>["supabaseAdmin"],
  requested: string,
  productId?: number
) {
  const base = slugify(requested) || `listing-${Date.now()}`;
  let candidate = base;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    let query = supabaseAdmin.from("products").select("id").eq("slug", candidate);
    if (productId) query = query.neq("id", productId);
    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return candidate;
    candidate = `${base}-${attempt + 2}`;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}`;
}

async function prepareRows(
  supabaseAdmin: Awaited<ReturnType<typeof requireApprovedSeller>>["supabaseAdmin"],
  sellerId: string,
  rawRows: unknown
) {
  const rows = normalizeRows(rawRows);
  const policyRules = await loadProductPolicyRules(supabaseAdmin);
  const categoryResult = await supabaseAdmin
    .from("categories")
    .select("id,name,slug");
  if (categoryResult.error) throw new Error(categoryResult.error.message);

  const gameIds = Array.from(
    new Set(rows.map((row) => row.gameId).filter((id): id is number => Boolean(id)))
  );
  const gameSlugs = Array.from(
    new Set(rows.map((row) => slugify(row.gameName)).filter(Boolean))
  );
  const updateIds = Array.from(
    new Set(
      rows
        .filter((row) => row.action === "update")
        .map((row) => row.productId)
        .filter((id): id is number => Boolean(id))
    )
  );

  const [gamesByIdResult, gamesBySlugResult, existingResult] = await Promise.all([
    gameIds.length
      ? supabaseAdmin
          .from("game_master")
          .select("id,name,slug,status,is_active")
          .in("id", gameIds)
      : Promise.resolve({ data: [], error: null }),
    gameSlugs.length
      ? supabaseAdmin
          .from("game_master")
          .select("id,name,slug,status,is_active")
          .in("slug", gameSlugs)
      : Promise.resolve({ data: [], error: null }),
    updateIds.length
      ? supabaseAdmin
          .from("products")
          .select("id,has_variants,price,stock,status")
          .eq("seller_id", sellerId)
          .in("id", updateIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (gamesByIdResult.error) throw new Error(gamesByIdResult.error.message);
  if (gamesBySlugResult.error) throw new Error(gamesBySlugResult.error.message);
  if (existingResult.error) throw new Error(existingResult.error.message);

  const categoryById = new Map<number, { id: number; name: string; slug: string }>();
  const categoryBySlug = new Map<string, { id: number; name: string; slug: string }>();
  for (const item of categoryResult.data || []) {
    const category = {
      id: Number(item.id),
      name: String(item.name || ""),
      slug: String(item.slug || ""),
    };
    categoryById.set(category.id, category);
    categoryBySlug.set(category.slug || slugify(category.name), category);
  }

  const gameById = new Map<number, { id: number; name: string; slug: string }>();
  const gameBySlug = new Map<string, { id: number; name: string; slug: string }>();
  for (const item of [
    ...(gamesByIdResult.data || []),
    ...(gamesBySlugResult.data || []),
  ]) {
    if (String(item.status || "active") !== "active" || item.is_active === false) {
      continue;
    }
    const game = {
      id: Number(item.id),
      name: String(item.name || ""),
      slug: String(item.slug || ""),
    };
    gameById.set(game.id, game);
    gameBySlug.set(game.slug || slugify(game.name), game);
  }

  const existingById = new Map<number, ExistingProduct>();
  for (const item of existingResult.data || []) {
    existingById.set(Number(item.id), item as ExistingProduct);
  }

  const seenUpdateIds = new Set<number>();
  const prepared: PreparedRow[] = rows.map((row) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const existing = row.productId ? existingById.get(row.productId) || null : null;

    if (row.requestedAction && !["create", "update"].includes(row.requestedAction)) {
      errors.push("action must be create or update.");
    }

    if (row.action === "update") {
      if (!row.productId) errors.push("product_id is required for update rows.");
      else if (seenUpdateIds.has(row.productId)) {
        errors.push("The same product_id appears more than once in this file.");
      } else {
        seenUpdateIds.add(row.productId);
      }
      if (row.productId && !existing) {
        errors.push("Product was not found or is not owned by this seller.");
      }
    } else if (row.productId) {
      errors.push("product_id must be empty for create rows.");
    }

    if (row.title.length < 4) errors.push("Title must contain at least 4 characters.");
    if (row.description.length < 20) {
      errors.push("Description must contain at least 20 characters.");
    }
    if (!Number.isFinite(row.price) || row.price <= 0 || row.price > 1_000_000_000) {
      errors.push("Price must be greater than 0 and at most 1,000,000,000.");
    }
    if (!Number.isInteger(row.stock) || row.stock < 0 || row.stock > 1_000_000) {
      errors.push("Stock must be a whole number between 0 and 1,000,000.");
    }
    if (
      row.deliveryEtaMinutes < 15 ||
      row.deliveryEtaMinutes > 10080
    ) {
      errors.push("Delivery ETA must be between 15 and 10,080 minutes.");
    }

    const category = row.categoryId
      ? categoryById.get(row.categoryId)
      : categoryBySlug.get(slugify(row.category));
    if (!category) {
      errors.push("Use a valid category_id or exact category name.");
    } else {
      if (row.category && slugify(row.category) !== slugify(category.name)) {
        warnings.push(`Category name normalized to “${category.name}”.`);
      }
      row.categoryId = category.id;
      row.category = category.name;
    }

    const game = row.gameId
      ? gameById.get(row.gameId)
      : gameBySlug.get(slugify(row.gameName));
    if (!game) {
      errors.push("Use a valid game_id or exact game name.");
    } else {
      if (row.gameName && slugify(row.gameName) !== slugify(game.name)) {
        warnings.push(`Game name normalized to “${game.name}”.`);
      }
      row.gameId = game.id;
      row.gameName = game.name;
    }

    if (row.imageUrl) {
      try {
        const imageUrl = new URL(row.imageUrl);
        if (!['http:', 'https:'].includes(imageUrl.protocol)) throw new Error();
      } catch {
        errors.push("image_url must be a valid HTTP or HTTPS URL.");
      }
    }

    if (row.stock === 0 && row.status === "active") {
      row.status = "inactive";
      warnings.push("Status changed to inactive because stock is 0.");
    }

    if (existing?.has_variants) {
      warnings.push(
        "This listing has variants; price and stock will remain controlled by its SKU rows."
      );
    }

    const policy = evaluateProductPolicy({
      title: row.title,
      description: row.description,
      category: row.category,
      gameName: row.gameName,
      tags: row.offerTags,
      rules: policyRules,
    });
    if (policy.decision === "block") {
      errors.push(...policy.reasons);
    } else if (policy.decision === "review") {
      row.status = "inactive";
      warnings.push("Listing will remain inactive until compliance review is approved.");
      warnings.push(...policy.reasons);
    }

    return {
      input: row,
      existing,
      policy,
      valid: errors.length === 0,
      errors,
      warnings,
    };
  });

  return prepared;
}

function publicPreview(rows: PreparedRow[]) {
  const previewRows = rows.map(({ input, policy, valid, errors, warnings }) => ({
    ...input,
    policy,
    valid,
    errors,
    warnings,
  }));

  return {
    rows: previewRows,
    summary: {
      total: rows.length,
      valid: rows.filter((row) => row.valid).length,
      invalid: rows.filter((row) => !row.valid).length,
      creates: rows.filter((row) => row.valid && row.input.action === "create").length,
      updates: rows.filter((row) => row.valid && row.input.action === "update").length,
      warnings: rows.reduce((sum, row) => sum + row.warnings.length, 0),
    },
  };
}

async function notifyFollowersOfBulkCreate({
  supabaseAdmin,
  sellerId,
  sellerName,
  created,
}: {
  supabaseAdmin: Awaited<ReturnType<typeof requireApprovedSeller>>["supabaseAdmin"];
  sellerId: string;
  sellerName: string;
  created: number;
}) {
  if (created < 1) return;

  const { data: followerRows } = await supabaseAdmin
    .from("seller_followers")
    .select("user_id")
    .eq("seller_id", sellerId);
  const userIds = Array.from(
    new Set((followerRows || []).map((row) => String(row.user_id || "")).filter(Boolean))
  );
  if (userIds.length === 0) return;

  await supabaseAdmin.from("notifications").insert(
    userIds.map((userId) => ({
      user_id: userId,
      type: "seller_new_product",
      title: "New Seller Listings",
      message: `${sellerName} added ${created} new listing${created === 1 ? "" : "s"}.`,
      link_url: `/seller-profile/${sellerId}`,
      is_read: false,
    }))
  );
}

export async function GET(request: Request) {
  try {
    const { user, supabaseAdmin } = await requireApprovedSeller(request);
    const mode = new URL(request.url).searchParams.get("mode") || "export";

    if (mode === "template") {
      const template = createCsv(CSV_HEADERS, [
        [
          "create",
          "",
          "Example Game Currency 1,000 Coins",
          "Replace this example with a clear listing description of at least twenty characters.",
          50000,
          10,
          "active",
          60,
          "",
          "Game Coins",
          "",
          "Example Game",
          "",
          "Global",
          "PC",
          "",
          "fast|safe-delivery",
          "",
        ],
      ]);
      return new Response(`\uFEFF${template}`, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="comeplayers-bulk-listing-template.csv"',
        },
      });
    }

    const { data, error } = await supabaseAdmin
      .from("products")
      .select(
        "id,title,description,price,stock,status,delivery_eta_minutes,category_id,category,game_category_id,game_name,image_url,offer_region,offer_platform,offer_server,offer_tags,slug"
      )
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const csv = createCsv(
      CSV_HEADERS,
      (data || []).map((product) => [
        "update",
        product.id,
        product.title,
        product.description,
        product.price,
        product.stock,
        product.status,
        product.delivery_eta_minutes,
        product.category_id,
        product.category,
        product.game_category_id,
        product.game_name,
        product.image_url,
        product.offer_region || "Global",
        product.offer_platform || "Any",
        product.offer_server,
        Array.isArray(product.offer_tags) ? product.offer_tags.join("|") : "",
        product.slug,
      ])
    );

    return new Response(`\uFEFF${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="comeplayers-listings-${new Date()
          .toISOString()
          .slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected bulk export error.";
    return NextResponse.json({ error: message }, { status: sellerErrorStatus(error) });
  }
}

export async function POST(request: Request) {
  try {
    const { user, profile, supabaseAdmin } = await requireApprovedSeller(request);
    const body = (await request.json()) as Record<string, unknown>;
    const mode = clean(body.mode || "preview", 20).toLowerCase();
    if (!["preview", "commit"].includes(mode)) throw new Error("Invalid bulk operation mode.");

    const prepared = await prepareRows(supabaseAdmin, user.id, body.rows);
    const preview = publicPreview(prepared);

    if (mode === "preview") return NextResponse.json(preview);
    if (preview.summary.invalid > 0) {
      return NextResponse.json(
        {
          error: "Fix all invalid CSV rows before importing.",
          ...preview,
        },
        { status: 400 }
      );
    }

    const sellerName = clean(
      profile.seller_name || profile.username || user.email || "Seller",
      160
    );
    const results: Array<{
      rowNumber: number;
      action: BulkAction;
      productId: number | null;
      title: string;
      ok: boolean;
      published?: boolean;
      error?: string;
    }> = [];

    for (const preparedRow of prepared) {
      const row = preparedRow.input;
      try {
        const slug = await uniqueSlug(
          supabaseAdmin,
          row.slug || row.title,
          row.productId || undefined
        );

        if (row.action === "create") {
          const { data, error } = await supabaseAdmin
            .from("products")
            .insert({
              title: row.title,
              description: row.description,
              price: row.price,
              stock: row.stock,
              status:
                preparedRow.policy.decision === "allow" && row.stock > 0
                  ? row.status
                  : "inactive",
              policy_status:
                preparedRow.policy.decision === "allow"
                  ? "allowed"
                  : "pending_review",
              policy_reasons: preparedRow.policy.reasons,
              policy_checked_at: new Date().toISOString(),
              delivery_eta_minutes: row.deliveryEtaMinutes,
              category_id: row.categoryId,
              category: row.category,
              game_category_id: row.gameId,
              game_name: row.gameName,
              image_url: row.imageUrl || null,
              offer_region: row.offerRegion,
              offer_platform: row.offerPlatform,
              offer_server: row.offerServer || null,
              offer_tags: row.offerTags,
              slug,
              seller: sellerName,
              seller_name: sellerName,
              seller_id: user.id,
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error || !data) throw new Error(error?.message || "Failed to create listing.");
          if (preparedRow.policy.decision === "review") {
            await createProductPolicyReview({
              supabaseAdmin,
              productId: Number(data.id),
              sellerId: user.id,
              decision: "review",
              severity:
                preparedRow.policy.severity === "info"
                  ? "medium"
                  : preparedRow.policy.severity,
              matchedRules: preparedRow.policy.matchedRules,
              reasons: preparedRow.policy.reasons,
              listingSnapshot: { ...row, id: data.id },
            });
          }

          results.push({
            rowNumber: row.rowNumber,
            action: row.action,
            productId: Number(data.id),
            title: row.title,
            ok: true,
            published: preparedRow.policy.decision === "allow",
          });
          continue;
        }

        const existing = preparedRow.existing;
        if (!existing || !row.productId) throw new Error("Product was not found.");
        const effectivePrice = existing.has_variants
          ? Number(existing.price || 0)
          : row.price;
        const effectiveStock = existing.has_variants
          ? Number(existing.stock || 0)
          : row.stock;

        const { data: updatedProduct, error } = await supabaseAdmin
          .from("products")
          .update({
            title: row.title,
            description: row.description,
            price: effectivePrice,
            stock: effectiveStock,
            status:
              preparedRow.policy.decision === "allow" && effectiveStock > 0
                ? row.status
                : "inactive",
            policy_status:
              preparedRow.policy.decision === "allow"
                ? "allowed"
                : "pending_review",
            policy_reasons: preparedRow.policy.reasons,
            policy_checked_at: new Date().toISOString(),
            ...(preparedRow.policy.decision === "allow"
              ? { policy_review_id: null }
              : {}),
            delivery_eta_minutes: row.deliveryEtaMinutes,
            category_id: row.categoryId,
            category: row.category,
            game_category_id: row.gameId,
            game_name: row.gameName,
            image_url: row.imageUrl || null,
            offer_region: row.offerRegion,
            offer_platform: row.offerPlatform,
            offer_server: row.offerServer || null,
            offer_tags: row.offerTags,
            slug,
            seller: sellerName,
            seller_name: sellerName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.productId)
          .eq("seller_id", user.id)
          .select("id")
          .maybeSingle();
        if (error) throw new Error(error.message);
        if (!updatedProduct) throw new Error("Product no longer exists or is no longer owned by this seller.");
        if (preparedRow.policy.decision === "review") {
          await createProductPolicyReview({
            supabaseAdmin,
            productId: row.productId,
            sellerId: user.id,
            decision: "review",
            severity:
              preparedRow.policy.severity === "info"
                ? "medium"
                : preparedRow.policy.severity,
            matchedRules: preparedRow.policy.matchedRules,
            reasons: preparedRow.policy.reasons,
            listingSnapshot: { ...row, id: row.productId },
          });
        } else {
          await supersedePendingProductPolicyReviews({
            supabaseAdmin,
            productId: row.productId,
          });
        }

        results.push({
          rowNumber: row.rowNumber,
          action: row.action,
          productId: row.productId,
          title: row.title,
          ok: true,
          published: preparedRow.policy.decision === "allow",
        });
      } catch (rowError) {
        results.push({
          rowNumber: row.rowNumber,
          action: row.action,
          productId: row.productId,
          title: row.title,
          ok: false,
          error: rowError instanceof Error ? rowError.message : "Unexpected row error.",
        });
      }
    }

    const created = results.filter((row) => row.ok && row.action === "create").length;
    const updated = results.filter((row) => row.ok && row.action === "update").length;
    const publishedCreates = results.filter(
      (row) => row.ok && row.action === "create" && row.published
    ).length;
    const pendingReview = results.filter((row) => row.ok && !row.published).length;
    const failed = results.filter((row) => !row.ok).length;

    try {
      await notifyFollowersOfBulkCreate({
        supabaseAdmin,
        sellerId: user.id,
        sellerName,
        created: publishedCreates,
      });
    } catch {
      // The catalog operation must not fail because a follower notification failed.
    }

    return NextResponse.json({
      ok: failed === 0,
      summary: {
        total: results.length,
        created,
        updated,
        pendingReview,
        failed,
      },
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected bulk catalog error.";
    return NextResponse.json({ error: message }, { status: sellerErrorStatus(error) });
  }
}
