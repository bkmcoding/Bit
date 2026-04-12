BOX CRAWLER - Audio Files Structure
====================================

To add custom audio to the game, place your audio files in this folder
following the structure below. The game will automatically use them
instead of the synthesized fallback sounds.

FOLDER STRUCTURE:
-----------------

public/audio/
├── menu-music.mp3      (Background music for main menu)
├── game-music.mp3      (Background music during gameplay)
├── boss-music.mp3      (Background music for boss fight)
└── sfx/
    ├── shoot.mp3       (Player shooting)
    ├── hit.mp3         (Player projectile hitting enemy)
    ├── enemy-hit.mp3   (Enemy taking damage)
    ├── enemy-death.mp3 (Enemy dying)
    ├── player-hurt.mp3 (Player taking damage)
    ├── door-open.mp3   (Room cleared, doors opening)
    ├── upgrade.mp3     (Selecting an upgrade)
    ├── victory.mp3     (Winning the game)
    ├── game-over.mp3   (Player death)
    ├── dash.mp3        (Dasher enemy charging)
    ├── web.mp3         (Web trap placed)
    └── boss-roar.mp3   (Broodmother spawn)


SUPPORTED FORMATS:
------------------
- MP3 (recommended)
- WAV
- OGG


TIPS:
-----
- Keep sound effects short (< 1 second for most)
- Music should loop seamlessly
- Normalize audio levels for consistency
- Compress files to reduce load times


If no audio files are found, the game will use synthesized
sounds created with the Web Audio API oscillators.
