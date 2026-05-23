import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../../../models/backend_health.dart';
import '../models/chat_message.dart';
import '../models/chat_models.dart';

final aiApiServiceProvider = Provider<AiApiService>((ref) {
  return AiApiService(ref.watch(apiClientProvider));
});

class ChatStreamFrame {
  const ChatStreamFrame({
    required this.partialAnswer,
    this.response,
    this.done = false,
  });

  final String partialAnswer;
  final ChatResponseModel? response;
  final bool done;
}

class AiApiService {
  AiApiService(this._dio);

  final Dio _dio;

  Future<BackendHealth> fetchHealth() async {
    try {
      final response = await _dio.get<Map<String, dynamic>>('/health');
      return BackendHealth.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Future<SearchResponseModel> search({
    required String question,
    String audience = 'public',
    int? topK,
  }) async {
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        '/search',
        data: {
          'question': question,
          'audience': audience,
          if (topK != null) 'top_k': topK,
        },
      );
      return SearchResponseModel.fromJson(response.data ?? const {});
    } on DioException catch (error) {
      throw _mapDioError(error);
    }
  }

  Stream<ChatStreamFrame> streamChat({
    required String question,
    required List<ChatMessage> history,
    required String audience,
    bool includeDebug = false,
  }) async* {
    try {
      final response = await _dio.post<ResponseBody>(
        '/chat',
        data: {
          'question': question,
          'history': history.map((item) => item.toApiJson()).toList(),
          'audience': audience,
          'include_debug': includeDebug,
        },
        options: Options(responseType: ResponseType.stream),
      );

      final body = await utf8.decoder.bind(response.data!.stream).join();
      final contentType =
          response.headers.value(Headers.contentTypeHeader) ?? '';

      if (contentType.contains('text/event-stream')) {
        yield* _streamFromSse(body);
        return;
      }

      final decoded = jsonDecode(body) as Map<String, dynamic>;
      final parsed = ChatResponseModel.fromJson(decoded);
      final answer = parsed.answer.trim();

      if (answer.isEmpty) {
        throw const ApiException('YenkasaAI returned an empty answer.');
      }

      var buffer = '';
      for (final token in _tokenizeForStreaming(answer)) {
        buffer += token;
        yield ChatStreamFrame(partialAnswer: buffer);
        await Future<void>.delayed(const Duration(milliseconds: 14));
      }

      yield ChatStreamFrame(
        partialAnswer: answer,
        response: parsed,
        done: true,
      );
    } on DioException catch (error) {
      throw _mapDioError(error);
    } on FormatException {
      throw const ApiException('YenkasaAI returned an unreadable response.');
    }
  }

  Stream<ChatStreamFrame> _streamFromSse(String body) async* {
    var buffer = '';
    ChatResponseModel? finalResponse;

    for (final line in const LineSplitter().convert(body)) {
      if (!line.startsWith('data:')) continue;
      final raw = line.substring(5).trim();
      if (raw.isEmpty || raw == '[DONE]') continue;

      final payload = jsonDecode(raw) as Map<String, dynamic>;
      final delta = payload['delta'] as String? ?? '';
      if (delta.isNotEmpty) {
        buffer += delta;
        yield ChatStreamFrame(partialAnswer: buffer);
      }

      if (payload['done'] == true &&
          payload['response'] is Map<String, dynamic>) {
        finalResponse = ChatResponseModel.fromJson(
          Map<String, dynamic>.from(payload['response'] as Map),
        );
      }
    }

    final finalAnswer = finalResponse?.answer ?? '';
    if (buffer.isEmpty && finalAnswer.isNotEmpty) {
      buffer = finalAnswer;
    }

    if (buffer.isEmpty) {
      throw const ApiException('YenkasaAI stream closed without an answer.');
    }

    yield ChatStreamFrame(
      partialAnswer: buffer,
      response: finalResponse,
      done: true,
    );
  }

  List<String> _tokenizeForStreaming(String text) {
    final matches = RegExp(r'\S+\s*').allMatches(text);
    return matches.map((match) => match.group(0) ?? '').toList();
  }

  ApiException _mapDioError(DioException error) {
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.connectionError) {
      return ApiException(
        'YenkasaAI backend is unreachable at ${AppConfig.apiBaseUrl}.',
        statusCode: error.response?.statusCode,
      );
    }
    final data = error.response?.data;
    if (data is Map<String, dynamic>) {
      final detail = data['detail'] ?? data['error'];
      if (detail is String && detail.isNotEmpty) {
        return ApiException(detail, statusCode: error.response?.statusCode);
      }
    }
    if (data is String && data.isNotEmpty) {
      return ApiException(data, statusCode: error.response?.statusCode);
    }
    return ApiException(
      error.message ?? 'YenkasaAI request failed.',
      statusCode: error.response?.statusCode,
    );
  }
}
