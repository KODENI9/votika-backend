import {
  getCreatorById,
  getCreators,
  createCreator,
  updateCreator,
  deleteCreator,
} from "../models/creator.model";
import type { Creator, CreatorStatus } from "../models/creator.model";
import type { CreateCreatorInput, UpdateCreatorInput, AdminUpdateCreatorInput } from "../schemas/creator.schema";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { clerkClient } from "@clerk/express";

/**
 * Creator service — business logic layer.
 * All Firestore access goes through creator.model.ts.
 */

/** Retrieve a creator, throwing 404 if not found */
export async function requireCreator(id: string): Promise<Creator> {
  const creator = await getCreatorById(id);
  if (!creator) {
    throw ApiError.notFound(`Créateur introuvable : ${id}`);
  }
  return creator;
}

/** Get a public creator profile by id */
export async function getCreatorProfile(id: string): Promise<Creator> {
  return requireCreator(id);
}

/** List active creators with optional filters */
export async function listActiveCreators(opts: {
  category?: string;
  country?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<Creator[]> {
  const limit = opts.limit ?? 20;
  const offset = ((opts.page ?? 1) - 1) * limit;

  return getCreators({
    status: "active",
    category: opts.category,
    country: opts.country,
    search: opts.search,
    limit,
    offset,
  });
}

/** List ALL creators for admin (no status filter) */
export async function listAllCreators(opts: {
  category?: string;
  country?: string;
  search?: string;
  status?: CreatorStatus;
  page?: number;
  limit?: number;
}): Promise<Creator[]> {
  const limit = opts.limit ?? 20;
  const offset = ((opts.page ?? 1) - 1) * limit;

  return getCreators({
    status: opts.status,
    category: opts.category,
    country: opts.country,
    search: opts.search,
    limit,
    offset,
  });
}

/**
 * Create a creator profile for a Clerk user.
 * id must equal the Clerk userId.
 * Fails with 409 if the creator already exists.
 */
export async function createCreatorProfile(
  clerkUserId: string,
  data: CreateCreatorInput
): Promise<Creator> {
  const existing = await getCreatorById(clerkUserId);
  if (existing) {
    throw ApiError.conflict("Un profil créateur existe déjà pour ce compte");
  }

  const handle = data.tiktokHandle.startsWith("@")
    ? data.tiktokHandle
    : `@${data.tiktokHandle}`;

  logger.info("Creating creator profile", { clerkUserId });

  return createCreator(clerkUserId, {
    ...data,
    tiktokHandle: handle,
    status: "pending", // new profiles start as pending until admin validates
  });
}

/** Update own creator profile */
export async function updateCreatorProfile(
  clerkUserId: string,
  data: UpdateCreatorInput
): Promise<Creator> {
  // Ensure the creator exists before updating
  await requireCreator(clerkUserId);

  const handle =
    data.tiktokHandle && !data.tiktokHandle.startsWith("@")
      ? `@${data.tiktokHandle}`
      : data.tiktokHandle;

  return updateCreator(clerkUserId, { ...data, tiktokHandle: handle });
}

/** Admin: update any creator including status */
export async function adminUpdateCreator(
  id: string,
  data: AdminUpdateCreatorInput
): Promise<Creator> {
  await requireCreator(id);
  
  if (data.status === "active") {
    try {
      await clerkClient.users.updateUserMetadata(id, {
        publicMetadata: { role: "creator" }
      });
      logger.info("Assigned creator role in Clerk", { id });
    } catch (err) {
      logger.error("Failed to update Clerk user metadata", { id, err });
    }
  }
  
  return updateCreator(id, data);
}

/** Admin: delete a creator */
export async function adminDeleteCreator(id: string): Promise<void> {
  await requireCreator(id);
  return deleteCreator(id);
}

/** Count active creators — for dashboard */
export async function countActiveCreators(): Promise<number> {
  const creators = await getCreators({ status: "active" });
  return creators.length;
}
