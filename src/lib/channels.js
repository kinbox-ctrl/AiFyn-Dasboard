// Groups a visit's referrer + UTM tags into an acquisition channel.
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|search\.brave)(\.|$)/;
const SOCIAL = /(^|\.)(facebook|fb|instagram|linkedin|lnkd|t\.co|twitter|x|youtube|youtu|whatsapp|wa|reddit|quora|pinterest|threads|telegram)(\.|$)/;
const EMAIL = /(mail\.|outlook\.|gmail)/;

export const CHANNELS = ["Direct", "Organic search", "Paid", "Social", "Referral", "Email"];

export function channelOf({ referrer, utm_source, utm_medium }) {
  const medium = (utm_medium || "").toLowerCase();
  const source = (utm_source || "").toLowerCase();
  if (/cpc|ppc|paid|display|ads?$/.test(medium)) return "Paid";
  if (medium === "email" || medium === "newsletter") return "Email";
  if (medium === "social" || SOCIAL.test(source)) return "Social";
  const ref = referrer ? `${referrer}`.toLowerCase() : "";
  if (!ref && !source) return "Direct";
  if (SEARCH.test(ref)) return "Organic search";
  if (SOCIAL.test(ref)) return "Social";
  if (EMAIL.test(ref)) return "Email";
  return "Referral";
}

export const sourceOf = ({ referrer, utm_source }) => utm_source || referrer || "Direct";
