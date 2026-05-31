# MaixCAM2 Hardware App

This folder contains the real hardware-side AirJam app. It runs on MaixCAM2, uses the built-in camera and MaixPy hand landmark model for gesture recognition, then sends instrument events to the PC backend over UDP.

## Configure PC Host

Copy:

```bash
cp config.example.py config.py
```

Set:

```python
PC_SYNTH_HOST = "10.143.177.237"
PC_EVENT_PORT = 5020
```

`PC_SYNTH_HOST` must be the computer running `backend/main.py`.

## Run

Upload this folder to MaixCAM2 and run:

```bash
python main.py
```

The app sends:

- `PING|maixcam|mode` every second
- `MODE|instrument` after instrument selection
- `NOTE|piano|midi|duration`
- `HIT|snare|hit|velocity|power`
- `GUITAR|instrument|chord|direction`
- `FRAME|seq|index|total|<jpeg bytes>` for the low-FPS browser preview
