export type SessionHalf = 'AM' | 'PM';

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const HALF_SESSION_ID_REGEX = new RegExp(`^(${UUID_PATTERN})-(AM|PM)$`, 'i');

export function parseSelectedSessionId(sid: string): {
  sessionId: string;
  sessionHalf: SessionHalf | null;
} {
  const matched = sid.match(HALF_SESSION_ID_REGEX);
  if (!matched) {
    return {
      sessionId: sid,
      sessionHalf: null,
    };
  }

  return {
    sessionId: matched[1],
    sessionHalf: matched[2].toUpperCase() as SessionHalf,
  };
}