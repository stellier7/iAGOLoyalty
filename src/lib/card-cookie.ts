import { cookies } from "next/headers";
import { CARD_COOKIE, isCardToken } from "@/domain/card-token";

export { CARD_COOKIE };

export async function readCardToken() {
  const cookieStore = await cookies();
  const value = cookieStore.get(CARD_COOKIE)?.value ?? "";
  return isCardToken(value) ? value : null;
}
