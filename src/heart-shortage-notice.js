export const HEART_SHORTAGE_TIMEOUT=5000;
export const isHeartShortageMessage=text=>/^심장(?:이\s*부족해요|\s+\d+개가\s*필요해요)[.!]?$/.test(String(text).trim());
