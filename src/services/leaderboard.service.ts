import { db, Timestamp } from "../config/firebase";
import type { Creator } from "../models/creator.model";

/**
 * Leaderboard service.
 * Returns creators ordered by totalVotes DESC.
 * Also computes a 24h trend by comparing vote timestamps in the `votes` collection.
 */

export interface LeaderboardEntry extends Creator {
  rank: number;
  /** Net votes gained in the last 24 hours */
  trend24h: number;
}

/**
 * Fetch paginated leaderboard of active creators ordered by totalVotes.
 */
export async function getLeaderboard(opts: {
  page: number;
  limit: number;
}): Promise<LeaderboardEntry[]> {
  const { limit, page } = opts;
  const offset = (page - 1) * limit;

  const snap = await db
    .collection("creators")
    .where("status", "==", "active")
    .orderBy("totalVotes", "desc")
    .limit(limit)
    .offset(offset)
    .get();

  const creators = snap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() } as Creator)
  );

  // Calculate 24h vote trends from the `votes` collection
  const since = new Date();
  since.setHours(since.getHours() - 24);

  const trendMap = await buildTrendMap(
    creators.map((c) => c.id),
    since
  );

  return creators.map((creator, index) => ({
    ...creator,
    rank: offset + index + 1,
    trend24h: trendMap[creator.id] ?? 0,
  }));
}

/**
 * Build a map of creatorId → votes gained in the last 24h.
 * Queries confirmed votes created after `since` for the given creator ids.
 */
async function buildTrendMap(
  creatorIds: string[],
  since: Date
): Promise<Record<string, number>> {
  if (creatorIds.length === 0) return {};

  const sinceTs = Timestamp.fromDate(since);

  const trendMap: Record<string, number> = {};

  // Firestore `in` operator supports up to 10 values — chunk if needed
  const chunks: string[][] = [];
  for (let i = 0; i < creatorIds.length; i += 10) {
    chunks.push(creatorIds.slice(i, i + 10));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await db
        .collection("votes")
        .where("creatorId", "in", chunk)
        .where("status", "==", "confirmed")
        .where("createdAt", ">=", sinceTs)
        .get();

      for (const doc of snap.docs) {
        const data = doc.data() as { creatorId: string; voteCount: number };
        trendMap[data.creatorId] =
          (trendMap[data.creatorId] ?? 0) + (data.voteCount ?? 0);
      }
    })
  );

  return trendMap;
}
