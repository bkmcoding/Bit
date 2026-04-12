BOX CRAWLER - Audio Files Structure
====================================

To add custom audio to the game, place your audio files in this folder
following the structure below. The game will automatically use them
instead of the synthesized fallback sounds where paths match.

ATMOSPHERE LEVELS (white noise, cave loops, skitter on/off & volume) are NOT
set in the game UI — edit the repo file:

  lib/game/settings/atmosphere-audio.ts

Then rebuild / refresh. Master volume and mute on the title screen still apply.

FOLDER STRUCTURE:
-----------------

public/audio/
├── menu-music.mp3      (Background music for main menu)
├── game-music.mp3      (Background music during gameplay)
├── boss-music.mp3      (Background music for boss fight)
├── ambience/           (Optional looping beds — volumes in lib/game/settings/atmosphere-audio.ts)
│   ├── white-noise.mp3   (Harsh static / wind; also tries ambience_white_noise.mp3)
│   └── cave.mp3          (Drips, rumble; also tries ambience-cave.mp3)
│                           If missing, a low synthesized “room rumble” still plays when caveVolume > 0.
└── sfx/
    ├── shoot.mp3       (Player shooting)
    ├── hit.mp3         (Player projectile hitting enemy)
    ├── enemy-hit.mp3   (Enemy taking damage)
    ├── enemy-death.mp3 (Enemy dying)
    ├── enemy-skitter.mp3  (Proximity leg/chitin ticks — also tries skitter.mp3)
    ├── player-hurt.mp3 (Player taking damage)
    ├── door-open.mp3   (Room cleared, doors opening)
    ├── upgrade.mp3     (Selecting an upgrade)
    ├── victory.mp3     (Winning the game)
    ├── game-over.mp3   (Player death)
    ├── dash.mp3        (Dasher enemy charging)
    ├── web.mp3         (Web trap placed)
    └── boss-roar.mp3   (Broodmother spawn)


ALTERNATE PATHS (code tries these if the first name is missing):
----------------------------------------------------------------
- Music: music_menu.mp3, music_gameplay.mp3, music_boss.mp3 (repo root of /audio/)
- Ambience: see AMBIENCE_SEARCH_PATHS in lib/game/audio/AudioManager.ts
- Skitter: chitin-scuttle.mp3 under sfx/


SUPPORTED FORMATS:
------------------
- MP3 (recommended)
- WAV
- OGG


TIPS:
-----
- Keep sound effects short (< 1 second for most)
- Music and ambience beds should loop seamlessly
- White noise / cave layers are independent: you can use one or both
- Normalize audio levels for consistency
- Compress files to reduce load times


If no audio files are found, the game will use synthesized
sounds created with the Web Audio API oscillators (including a
short synthetic skitter when no MP3 is present).
