import type { RequestContext } from "../../src/taxlaw/domain/dto.js";
import type {
    FindProvisionAtInput,
    ProvisionRow,
    SearchTaxLawAtInput,
    TaxLawRepository
} from "../../src/taxlaw/repository/tax-law-repository.js";
import { FIXTURE_ROWS, type FixtureRow } from "./fixture.js";

/**
 * In-memory stand-in for the two query artifacts, used to exercise the Service
 * and both transports without a database.
 *
 * It reproduces the rules the Service depends on — approved-only, inclusive
 * date containment, no cross-version mixing, LIMIT/OFFSET — but it is only an
 * approximation of PostgreSQL full-text search and of ts_rank_cd ordering.
 * It therefore does NOT replace the integration tests that run the real SQL
 * (tests/integration-postgres.test.ts).
 */
export class InMemoryTaxLawRepository implements TaxLawRepository {
    lastSearchCall?: SearchTaxLawAtInput;

    constructor(private readonly rows: FixtureRow[] = FIXTURE_ROWS) {}

    async searchTaxLawAt(input: SearchTaxLawAtInput, _ctx: RequestContext): Promise<ProvisionRow[]> {
        this.lastSearchCall = input;

        const tokens = tokenize(input.q);
        if (tokens.length === 0) {
            return [];
        }

        return this.rows
            .filter((row) => isVisibleAt(row, input.asOf))
            .filter((row) => tokens.every((token) => tokenize(`${row.heading} ${row.body}`).includes(token)))
            .sort(byStableOrder)
            .slice(input.offset, input.offset + input.readLimit)
            .map(stripStatus);
    }

    async findProvisionAt(input: FindProvisionAtInput, _ctx: RequestContext): Promise<ProvisionRow[]> {
        return this.rows
            .filter((row) => isVisibleAt(row, input.asOf))
            .filter((row) => row.documentNumber === input.documentNumber && row.articleKey === input.articleKey)
            .map(stripStatus);
    }
}

/** Repository that returns whatever it is given — for invariant-guard tests. */
export class StubTaxLawRepository implements TaxLawRepository {
    constructor(private readonly rows: ProvisionRow[]) {}

    async searchTaxLawAt(): Promise<ProvisionRow[]> {
        return this.rows;
    }

    async findProvisionAt(): Promise<ProvisionRow[]> {
        return this.rows;
    }
}

/** Repository that always throws — for error-leak tests. */
export class ThrowingTaxLawRepository implements TaxLawRepository {
    constructor(private readonly error: unknown) {}

    async searchTaxLawAt(): Promise<ProvisionRow[]> {
        throw this.error;
    }

    async findProvisionAt(): Promise<ProvisionRow[]> {
        throw this.error;
    }
}

/** status = 'approved' AND effective_interval @> asOf, both ends inclusive. */
function isVisibleAt(row: FixtureRow, asOf: string): boolean {
    if (row.status !== "approved") {
        return false;
    }
    if (asOf < row.effectiveFrom) {
        return false;
    }
    return row.effectiveTo === null || asOf <= row.effectiveTo;
}

/** Case-insensitive, accent-sensitive, whole-token matching, as `simple` is. */
function tokenize(value: string): string[] {
    return value
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((token) => token.length > 0);
}

/** The ORDER BY tail the SQL uses after ts_rank_cd, which is not modelled. */
function byStableOrder(a: FixtureRow, b: FixtureRow): number {
    return (
        a.documentNumber.localeCompare(b.documentNumber) ||
        a.articleKey.localeCompare(b.articleKey) ||
        Number(a.provisionId) - Number(b.provisionId)
    );
}

function stripStatus(row: FixtureRow): ProvisionRow {
    const { status: _status, ...rest } = row;
    return rest;
}
