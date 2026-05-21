class AnswerCardModel {
  const AnswerCardModel({
    required this.title,
    required this.category,
    required this.summary,
  });

  final String title;
  final String category;
  final String summary;

  factory AnswerCardModel.fromJson(Map<String, dynamic> json) {
    return AnswerCardModel(
      title: json['title'] as String? ?? '',
      category: json['category'] as String? ?? '',
      summary: json['summary'] as String? ?? '',
    );
  }
}

class SourceChunkModel {
  const SourceChunkModel({
    required this.id,
    required this.label,
    required this.title,
    required this.area,
    required this.score,
    required this.rawScore,
    required this.excerpt,
    required this.citation,
    required this.metadata,
  });

  final String id;
  final String label;
  final String title;
  final String area;
  final double score;
  final double rawScore;
  final String excerpt;
  final String citation;
  final Map<String, dynamic> metadata;

  factory SourceChunkModel.fromJson(Map<String, dynamic> json) {
    return SourceChunkModel(
      id: json['id'] as String? ?? '',
      label: json['label'] as String? ?? '',
      title: json['title'] as String? ?? '',
      area: json['area'] as String? ?? '',
      score: (json['score'] as num? ?? 0).toDouble(),
      rawScore: (json['rawScore'] as num? ?? 0).toDouble(),
      excerpt: json['excerpt'] as String? ?? '',
      citation: json['citation'] as String? ?? '',
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
    );
  }
}

class ChatResponseModel {
  const ChatResponseModel({
    required this.provider,
    required this.model,
    required this.audience,
    required this.answer,
    required this.answerCards,
    required this.suggestedFollowUps,
    required this.sources,
    required this.timings,
    required this.debug,
  });

  final String provider;
  final String model;
  final String audience;
  final String answer;
  final List<AnswerCardModel> answerCards;
  final List<String> suggestedFollowUps;
  final List<SourceChunkModel> sources;
  final Map<String, dynamic> timings;
  final Map<String, dynamic>? debug;

  factory ChatResponseModel.fromJson(Map<String, dynamic> json) {
    final answerCardsJson =
        (json['answer_cards'] as List?) ??
        (json['answerCards'] as List?) ??
        const [];
    final suggestedFollowUpsJson =
        (json['suggested_follow_ups'] as List?) ??
        (json['suggestedFollowUps'] as List?) ??
        const [];
    return ChatResponseModel(
      provider: json['provider'] as String? ?? '',
      model: json['model'] as String? ?? '',
      audience: json['audience'] as String? ?? 'public',
      answer: json['answer'] as String? ?? '',
      answerCards: answerCardsJson
          .map(
            (item) => AnswerCardModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      suggestedFollowUps: suggestedFollowUpsJson.cast<String>(),
      sources: ((json['sources'] as List?) ?? const [])
          .map(
            (item) => SourceChunkModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
      timings: Map<String, dynamic>.from(json['timings'] as Map? ?? const {}),
      debug: json['debug'] is Map
          ? Map<String, dynamic>.from(json['debug'] as Map)
          : null,
    );
  }
}

class SearchResponseModel {
  const SearchResponseModel({
    required this.audience,
    required this.count,
    required this.sources,
  });

  final String audience;
  final int count;
  final List<SourceChunkModel> sources;

  factory SearchResponseModel.fromJson(Map<String, dynamic> json) {
    return SearchResponseModel(
      audience: json['audience'] as String? ?? 'public',
      count: json['count'] as int? ?? 0,
      sources: ((json['sources'] as List?) ?? const [])
          .map(
            (item) => SourceChunkModel.fromJson(
              Map<String, dynamic>.from(item as Map),
            ),
          )
          .toList(),
    );
  }
}
