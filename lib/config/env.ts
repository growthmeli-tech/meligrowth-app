type ServerEnv = {
  ml: {
    clientId: string | undefined;
    clientSecret: string | undefined;
    redirectUri: string | undefined;
    isConfigured: boolean;
  };
};

export function getServerEnv(): ServerEnv {
  const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
  const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
  const ML_REDIRECT_URI = process.env.ML_REDIRECT_URI;

  return {
    ml: {
      clientId: ML_CLIENT_ID,
      clientSecret: ML_CLIENT_SECRET,
      redirectUri: ML_REDIRECT_URI,
      isConfigured: Boolean(ML_CLIENT_ID && ML_REDIRECT_URI)
    }
  };
}
