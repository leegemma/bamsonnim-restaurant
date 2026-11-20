export const audioIsMuted=settings=>settings.music===0&&settings.sfx===0;
export function toggleAudioSettings(settings){
 if(!audioIsMuted(settings)){settings.audioBeforeMute={music:settings.music,sfx:settings.sfx};settings.music=0;settings.sfx=0;return;}
 const previous=settings.audioBeforeMute,volume=(key,fallback)=>Number.isFinite(previous?.[key])&&previous[key]>=0&&previous[key]<=1?previous[key]:fallback;
 settings.music=volume('music',.22);settings.sfx=volume('sfx',.45);
 if(audioIsMuted(settings)){settings.music=.22;settings.sfx=.45;}
 delete settings.audioBeforeMute;
}
