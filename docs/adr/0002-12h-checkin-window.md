# ADR 0002: 12-Hour Check-in Window (12:00 to 00:00 BRT)

- **Context:** The owner updated the window specification from 24 hours to **12 hours**: check-in opens at **12:00 BRT** (6 hours before the 18:00 BRT class) and closes at **00:00 BRT** of the following day (6 hours after the 18:00 BRT class start).
- **Decision:** Set `DEFAULT_OPENS_OFFSET_MIN = 360` and `DEFAULT_CLOSES_OFFSET_MIN = 360` in `src/config/app.ts` and `shared/constants.ts`. Both offsets remain overridable per session in the admin panel.
- **Consequences:** For Tuesday/Thursday 18:00 BRT classes, windows are open `[Tue 12:00, Wed 00:00)` and `[Thu 12:00, Fri 00:00)` in `America/Sao_Paulo`, leaving clean 36h and 108h closed gaps with zero overlap.
