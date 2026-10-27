/**
 * Optional Firebase App Check integration for the student client.
 * Loaded lazily only when `VITE_APPCHECK_SITE_KEY` and `VITE_FIREBASE_API_KEY` are set,
 * keeping the student initial bundle small while supporting reCAPTCHA v3 in production.
 */

let tokenFetcherPromise: Promise<() => Promise<string | null>> | null = null;

export async function getAppCheckToken(): Promise<string | null> {
  const siteKey = import.meta.env.VITE_APPCHECK_SITE_KEY as string | undefined;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  if (!siteKey || !apiKey) return null;

  tokenFetcherPromise ??= (async () => {
    try {
      const [{ getApps, initializeApp }, { ReCaptchaV3Provider, getToken, initializeAppCheck }] =
        await Promise.all([import('firebase/app'), import('firebase/app-check')]);
      const app =
        getApps()[0] ??
        initializeApp({
          apiKey,
          authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
          projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
          appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
        });
      const check = initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
      return async () => {
        try {
          const res = await getToken(check, false);
          return res.token || null;
        } catch {
          return null;
        }
      };
    } catch {
      return async () => null;
    }
  })();

  const fetcher = await tokenFetcherPromise;
  return fetcher();
}
