class AppConfig {
  static const String appName = 'YenkasaAI';
  static const String apiBaseUrl = String.fromEnvironment(
    'YENKASA_AI_API_BASE_URL',
    defaultValue: 'https://yenkasa-ai-496173204476.europe-west1.run.app',
  );
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 45);
  static const String defaultAudience = 'public';
  static const String logoAsset = String.fromEnvironment(
    'YENKASA_AI_LOGO_ASSET',
    defaultValue: '',
  );
}
