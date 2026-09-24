/**
 * Nạp văn bản luật từ data/laws/*.json vào PostgreSQL.
 *
 *   npm run db:import                                   # nạp, version chưa duyệt để 'draft'
 *   npm run db:import -- --approve-as "Nguyễn Văn A"   # duyệt các file chưa có reviewedBy
 *   npm run db:import -- --remove-demo                  # xoá dữ liệu minh họa DEMO-TAX-*
 *
 * Quan hệ giữa các văn bản khai báo trong "relations" của văn bản TÁC ĐỘNG, ví dụ trong file
 * văn bản mới: { "type": "repeals", "target": "<số hiệu văn bản cũ>", "effectiveFrom": "2026-01-01" }.
 * type: amends (sửa đổi, bổ sung) | repeals (bãi bỏ, thay thế) | guides (hướng dẫn) | consolidates (hợp nhất).
 * Quan hệ được nạp sau cùng, nên văn bản đích phải có file trong data/laws.
 *
 * Mỗi file là một văn bản. Nạp lại cùng số hiệu thì bản cũ trong DB bị thay hoàn toàn.
 * Chỉ version 'approved' mới hiện ra ở web và MCP, nên chỉ duyệt sau khi đã đối chiếu nguồn gốc.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

interface LawFile {
  documentNumber: string;
  title: string;
  issuingBody: string;
  issuedOn: string;
  sourceUrl: string;
  reviewedBy?: string;
  relations?: {
    type: "amends" | "repeals" | "guides" | "consolidates";
    target: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    sourceUrl?: string;
  }[];
  versions: {
    versionNumber: number;
    title: string;
    sourceUrl?: string;
    effectiveFrom: string;
    effectiveTo: string | null;
    provisions: { articleKey: string; heading: string; body: string; sourceUrl?: string }[];
  }[];
}

const args = process.argv.slice(2);
const approveAs = args.includes("--approve-as") ? args[args.indexOf("--approve-as") + 1] : undefined;
const removeDemo = args.includes("--remove-demo");
const LAWS_DIR = path.join(import.meta.dirname, "..", "data", "laws");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  if (removeDemo) {
    await deleteDocuments("SELECT id FROM documents WHERE document_number LIKE 'DEMO-TAX-%'");
    console.log("Đã xoá dữ liệu minh họa DEMO-TAX-*");
  }

  const files = readdirSync(LAWS_DIR).filter((f) => f.endsWith(".json")).sort()
    .map((file) => ({ file, raw: readFileSync(path.join(LAWS_DIR, file), "utf8") }));

  // Lượt 1: văn bản, phiên bản, điều khoản.
  for (const { file, raw } of files) {
    const law = JSON.parse(raw) as LawFile;
    const reviewer = law.reviewedBy?.trim() || approveAs?.trim();

    await client.query("BEGIN");
    try {
      await deleteDocuments("SELECT id FROM documents WHERE document_number = $1", [law.documentNumber]);
      const docId = await insertOne(
        `INSERT INTO documents (document_number, title, issuing_body, issued_on, source_url)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [law.documentNumber, law.title, law.issuingBody, law.issuedOn, law.sourceUrl]
      );
      const snapshotId = await insertOne(
        `INSERT INTO ingestion_snapshots (document_id, source_url, content_sha256, raw_payload)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [docId, law.sourceUrl, createHash("sha256").update(raw).digest("hex"), raw]
      );
      for (const v of law.versions) {
        const versionUrl = v.sourceUrl ?? law.sourceUrl;
        const versionId = await insertOne(
          `INSERT INTO document_versions
             (document_id, version_number, title, source_url, ingestion_snapshot_id,
              status, approved_at, approved_by, effective_from, effective_to)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
          [
            docId, v.versionNumber, v.title, versionUrl, snapshotId,
            reviewer ? "approved" : "draft", reviewer ? new Date() : null, reviewer ?? null,
            v.effectiveFrom, v.effectiveTo,
          ]
        );
        for (const p of v.provisions) {
          await client.query(
            `INSERT INTO provisions (document_version_id, article_key, heading, body, source_url)
             VALUES ($1, $2, $3, $4, $5)`,
            [versionId, p.articleKey, p.heading, p.body, p.sourceUrl ?? versionUrl]
          );
        }
      }
      await client.query("COMMIT");
      const count = law.versions.reduce((n, v) => n + v.provisions.length, 0);
      console.log(`✓ ${law.documentNumber}: ${count} điều khoản, ${reviewer ? `approved bởi "${reviewer}"` : "draft (chưa duyệt, chưa hiện ra)"}`);
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`✗ ${file}: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }

  // Lượt 2: quan hệ. Chạy sau khi mọi văn bản đã có trong DB.
  for (const { file, raw } of files) {
    const law = JSON.parse(raw) as LawFile;
    if (!law.relations?.length) continue;

    await client.query("BEGIN");
    try {
      const fromId = await insertOne("SELECT id FROM documents WHERE document_number = $1", [law.documentNumber]);
      await client.query("DELETE FROM document_relations WHERE from_document_id = $1", [fromId]);
      for (const r of law.relations) {
        const { rows } = await client.query("SELECT id FROM documents WHERE document_number = $1", [r.target]);
        if (rows.length === 0) throw new Error(`không có văn bản đích ${r.target} trong DB`);
        await client.query(
          `INSERT INTO document_relations
             (from_document_id, to_document_id, relation_type, source_url, effective_from, effective_to)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [fromId, rows[0].id, r.type, r.sourceUrl ?? law.sourceUrl, r.effectiveFrom, r.effectiveTo ?? null]
        );
        console.log(`  ↳ ${law.documentNumber} --${r.type}--> ${r.target} (từ ${r.effectiveFrom})`);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(`✗ quan hệ trong ${file}: ${error instanceof Error ? error.message : error}`);
      process.exitCode = 1;
    }
  }
} finally {
  await client.end();
}

async function insertOne(sql: string, params: unknown[]): Promise<string> {
  const { rows } = await client.query(sql, params);
  return rows[0].id;
}

/** Xoá văn bản cùng toàn bộ dữ liệu phụ thuộc, theo đúng thứ tự khoá ngoại. */
async function deleteDocuments(selectIds: string, params: unknown[] = []): Promise<void> {
  const ids = `(${selectIds})`;
  await client.query(`DELETE FROM provisions WHERE document_version_id IN
    (SELECT id FROM document_versions WHERE document_id IN ${ids})`, params);
  await client.query(`DELETE FROM document_versions WHERE document_id IN ${ids}`, params);
  await client.query(`DELETE FROM document_relations WHERE from_document_id IN ${ids} OR to_document_id IN ${ids}`, params);
  await client.query(`DELETE FROM ingestion_snapshots WHERE document_id IN ${ids}`, params);
  await client.query(`DELETE FROM documents WHERE id IN ${ids}`, params);
}
