# ADR 0003: Timezone Arithmetic via Native `Intl.DateTimeFormat`

- **Context:** All class times are authored in `America/Sao_Paulo` (UTC-3, no DST) and displayed both in Brasília time and the student's local timezone across Latin America, while storing/transmitting UTC instants only.
- **Decision:** Use native `Intl.DateTimeFormat` (`formatToParts` with `timeZone` and `hourCycle: 'h23'`) in `shared/time.ts` instead of shipping Luxon/date-fns-tz to the student bundle. Never parse local strings with `new Date("YYYY-MM-DD HH:mm")`.
- **Consequences:** Zero extra date-library kilobytes in the student bundle, exact IANA timezone conversions in both Node 22+ and all modern browsers, and tested wall-clock accuracy across BR, AR, CL, CO, PE, and MX.
