class AppConfig {
  static const String appName = 'YenkasaAI';
  static const String _productionApiBaseUrl =
      'https://yenkasa-ai-496173204476.europe-west1.run.app';
  static const String localDebugApiBaseUrl = 'http://127.0.0.1:8008/api/ai';
  static const String apiBaseUrl = String.fromEnvironment(
    'YENKASA_AI_API_BASE_URL',
    defaultValue: _productionApiBaseUrl,
  );
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 90);
  static const Duration healthPollInterval = Duration(seconds: 20);
  static const String defaultAudience = 'public';
  static const String logoAsset = String.fromEnvironment(
    'YENKASA_AI_LOGO_ASSET',
    defaultValue: 'assets/branding/yenkasa_ai_logo.png',
  );
}
