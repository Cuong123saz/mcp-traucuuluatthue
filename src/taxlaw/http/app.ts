import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import {
    HTTP_STATUS_BY_CODE,
    invalidArgument,
    notFound,
    toDomainError,
    type DomainErrorDetail
} from "../domain/errors.js";
import type { RequestContext } from "../domain/dto.js";
import type { TaxLawService } from "../service/tax-law-service.js";
import { createSilentLogger, type Logger } from "../logging.js";
import { errorEnvelope, successEnvelope } from "./envelope.js";

export interface BuildAppOptions {
    service: TaxLawService;
    logger?: Logger;
}

/**
 * Routes do three things and nothing else: validate the transport shape, call
 * the Service, serialize the result. No SQL, no repository access, no version
 * or date business rules (service-contract.md "Luồng và trách nhiệm").
 */
export function buildApp(options: BuildAppOptions): FastifyInstance {
    const logger = options.logger ?? createSilentLogger();

    const app = Fastify({
        // Fastify's own request logging would echo the full URL, including the
        // user's query text. All logging goes through the allowlist logger.
        logger: false,
        genReqId: () => randomUUID()
    });

    app.decorateRequest("startedAt", 0);

    app.addHook("onRequest", (request, _reply, done) => {
        (request as FastifyRequest & { startedAt: number }).startedAt = Date.now();
        done();
    });

    app.get("/health", async (request, reply) => {
        // Liveness only: deliberately does not touch the database or the
        // Service, so it stays up while the DB is down.
        return reply.code(200).send(successEnvelope({ status: "ok" }, request.id));
    });

    app.get("/search", async (request, reply) => {
        const query = readQuery(request, ["q", "asOf", "limit", "offset"]);
        const ctx = requestContext(request, reply);

        const result = await options.service.searchTaxLaw(
            { q: query.q, asOf: query.asOf, limit: query.limit, offset: query.offset },
            ctx
        );

        logSuccess(logger, request, "GET /search", result.items.length);
        return reply.code(200).send({
            data: { asOf: result.asOf, items: result.items },
            pagination: result.pagination,
            requestId: request.id
        });
    });

    app.get("/relations", async (request, reply) => {
        const query = readQuery(request, ["documentNumber", "asOf"]);
        const ctx = requestContext(request, reply);

        const result = await options.service.getDocumentRelations(
            { documentNumber: query.documentNumber, asOf: query.asOf },
            ctx
        );

        logSuccess(logger, request, "GET /relations", result.outgoing.length + result.incoming.length);
        return reply.code(200).send(successEnvelope(result, request.id));
    });

    app.setNotFoundHandler((request, reply) => {
        const error = notFound("Không tìm thấy tài nguyên.");
        logger.log({
            requestId: request.id,
            operation: "unknown-route",
            durationMs: elapsed(request),
            outcome: "error",
            errorCode: error.code
        });
        return reply.code(404).send(errorEnvelope(error, request.id));
    });

    app.setErrorHandler((raw, request, reply) => {
        const domainError = normalizeError(raw);
        logger.log({
            requestId: request.id,
            operation: `${request.method} ${request.routeOptions?.url ?? "unknown"}`,
            durationMs: elapsed(request),
            outcome: "error",
            errorCode: domainError.code
        });
        // Only the domain envelope is serialized: the original error's message,
        // stack and any SQL it carried stop here.
        return reply.code(HTTP_STATUS_BY_CODE[domainError.code]).send(errorEnvelope(domainError, request.id));
    });

    return app;
}

/**
 * Rejects unknown and repeated query parameters before anything reaches the
 * Service (api-contract.md: "Tham số lạ/lặp ... bị từ chối"). Fastify parses a
 * repeated key into an array, which is how duplicates are detected.
 */
function readQuery(
    request: FastifyRequest,
    allowed: readonly string[]
): Record<string, string | undefined> {
    const raw = (request.query ?? {}) as Record<string, unknown>;
    const details: DomainErrorDetail[] = [];
    const result: Record<string, string | undefined> = {};

    for (const [key, value] of Object.entries(raw)) {
        if (!allowed.includes(key)) {
            details.push({ field: key, issue: "Tham số không được hỗ trợ." });
            continue;
        }
        if (Array.isArray(value)) {
            details.push({ field: key, issue: "Tham số bị lặp." });
            continue;
        }
        if (typeof value !== "string") {
            details.push({ field: key, issue: "Giá trị không hợp lệ." });
            continue;
        }
        result[key] = value;
    }

    if (details.length > 0) {
        throw invalidArgument("Tham số không hợp lệ.", details);
    }
    return result;
}

/**
 * Ties an AbortSignal to the client connection so a closed connection
 * propagates cancellation down to the Repository and its pooled client.
 */
function requestContext(request: FastifyRequest, reply: FastifyReply): RequestContext {
    const controller = new AbortController();
    request.raw.on("close", () => {
        if (!reply.sent) {
            controller.abort();
        }
    });
    return { requestId: request.id, signal: controller.signal };
}

function elapsed(request: FastifyRequest): number {
    const startedAt = (request as FastifyRequest & { startedAt?: number }).startedAt;
    return typeof startedAt === "number" ? Date.now() - startedAt : 0;
}

function logSuccess(logger: Logger, request: FastifyRequest, operation: string, resultCount: number): void {
    logger.log({
        requestId: request.id,
        operation,
        durationMs: elapsed(request),
        outcome: "ok",
        resultCount
    });
}

/**
 * Fastify's own 4xx failures (malformed URL encoding, unsupported media type)
 * are client errors; everything else becomes an opaque INTERNAL_ERROR.
 */
function normalizeError(raw: unknown) {
    const statusCode =
        typeof raw === "object" && raw !== null && "statusCode" in raw
            ? (raw as { statusCode?: unknown }).statusCode
            : undefined;

    if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
        const domain = toDomainError(raw);
        if (domain.code === "INTERNAL_ERROR") {
            return invalidArgument("Yêu cầu không hợp lệ.");
        }
        return domain;
    }
    return toDomainError(raw);
}

export type { FastifyInstance, FastifyReply };
