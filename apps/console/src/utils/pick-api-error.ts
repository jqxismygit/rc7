/** 从 axios 错误响应中取出后端 message */
export function pickApiErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const data = (err as { response?: { data?: { message?: string } } })
      .response?.data;
    if (data?.message && typeof data.message === "string") {
      return data.message;
    }
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
