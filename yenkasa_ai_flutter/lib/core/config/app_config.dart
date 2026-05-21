class AppConfig {
  static const String appName = 'YenkasaAI';
  static const String _productionApiBaseUrl =
      'https://yenkasa-ai-496173204476.europe-west1.run.app';
  static const String _debugApiBaseUrl = 'http://127.0.0.1:8008/api/ai';
  static const String _defaultApiBaseUrl =
      bool.fromEnvironment('dart.vm.product')
      ? _productionApiBaseUrl
      : _debugApiBaseUrl;
  static const String apiBaseUrl = String.fromEnvironment(
    'YENKASA_AI_API_BASE_URL',
    defaultValue: _defaultApiBaseUrl,
  );
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration receiveTimeout = Duration(seconds: 45);
  static const String defaultAudience = 'public';
  static const String logoAsset = String.fromEnvironment(
    'YENKASA_AI_LOGO_ASSET',
    defaultValue: '',
  );
}
