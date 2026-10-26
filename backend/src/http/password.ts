import { hash, verify } from "@node-rs/argon2";
import type { Options } from "@node-rs/argon2";

/**
 * Parameter argon2id SPEC §8.1. Ditulis eksplisit, tidak mengandalkan default
 * library: default bisa berubah di versi berikutnya dan melemahkan hashing diam-diam.
 */
const ARGON2_OPTIONS: Options = {
  algorithm: 2, // Argon2id
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export const hashPassword = (plain: string): Promise<string> =>
  hash(plain, ARGON2_OPTIONS);

/** False bila hash rusak/tidak cocok; tidak pernah melempar ke pemanggil. */
export async function verifyPassword(
  digest: string,
  plain: string,
): Promise<boolean> {
  try {
    return await verify(digest, plain);
  } catch {
    return false;
  }
}
