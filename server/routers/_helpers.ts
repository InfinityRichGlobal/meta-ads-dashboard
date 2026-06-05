import { TRPCError } from "@trpc/server";
import { getActiveToken } from "../db";
import { MetaApiError } from "../metaAdsService";

/** Resolve the active Meta token + ad account for a user, or throw a friendly error. */
export async function resolveToken(userId: number): Promise<{ accessToken: string; adAccountId: string }> {
  const token = await getActiveToken(userId);
  if (!token) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "ยังไม่ได้เชื่อมต่อ Meta Access Token กรุณาไปที่หน้า Token Management",
    });
  }
  return { accessToken: token.accessToken, adAccountId: token.adAccountId };
}

/** Wrap Meta API calls so token/permission errors surface as typed TRPC errors. */
export async function withMetaErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof MetaApiError) {
      throw new TRPCError({
        code: err.info.isTokenError ? "UNAUTHORIZED" : "BAD_REQUEST",
        message: err.message,
        cause: err,
      });
    }
    throw err;
  }
}
